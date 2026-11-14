"""Paso 1 del ETL: CSV de FIRMS -> tabla `detection`.

Especificación: docs/contracts/ingest.md. Resumen:
  - Fuente A  data/historico_pais/<Pais>/<sensor>/*.csv      todo hasta 2025-12-31
  - Fuente B  data/<carpeta solicitud>/*/fire_archive_*.csv  solo >= 2026-01-01 (N21: todo)
  - Fuente C  data/<carpeta solicitud>/*/fire_nrt_*.csv      solo >= 2026-01-01 (N21: todo)
`is_veg` de las filas NRT queda en true provisional; el paso 2 (máscara) lo corrige.
"""
from __future__ import annotations

import io
import time
from dataclasses import dataclass
from pathlib import Path

import polars as pl
import psycopg

from etl import config

# Orden exacto de columnas en el COPY. Debe coincidir con docs/contracts/db_schema.sql.
DETECTION_COLUMNS = [
    "country", "latitude", "longitude", "acq_date", "acq_time", "acq_ts",
    "satellite", "family", "confidence_raw", "frp", "scan", "track",
    "daynight", "type", "source", "is_veg", "cy", "cx",
]

SATELLITE_MAP = {"N": "SNPP"}  # fuente A llama "N" a S-NPP
VALID_SATELLITES = {"Terra", "Aqua", "SNPP", "N20", "N21"}

INDEXES = [
    "CREATE INDEX IF NOT EXISTS detection_cell_date ON detection (cy, cx, acq_date)",
    "CREATE INDEX IF NOT EXISTS detection_date ON detection (acq_date)",
]


@dataclass(frozen=True)
class SourceFile:
    path: Path
    country: str   # MX | AR
    source: str    # country | archive | nrt


def discover(data_dir: Path, countries: set[str] | None = None) -> list[SourceFile]:
    """Encuentra todos los CSV de entrada. Usa comodines porque hay rutas con acentos y typos."""
    files: list[SourceFile] = []
    for folder, code in config.COUNTRIES.items():
        if countries and code not in countries:
            continue
        for p in sorted((data_dir / "historico_pais" / folder).glob("*/*.csv")):
            files.append(SourceFile(p, code, "country"))
    for req_dir in sorted(p for p in data_dir.iterdir() if p.is_dir() and p.name != "historico_pais"):
        code = _country_of_request_dir(req_dir.name)
        if code is None or (countries and code not in countries):
            continue
        for kind in ("archive", "nrt"):
            for p in sorted(req_dir.glob(f"*/fire_{kind}_*.csv")):
                files.append(SourceFile(p, code, kind))
    return files


def _country_of_request_dir(name: str) -> str | None:
    low = name.lower()
    if low.startswith("m") and "xico" in low:
        return "MX"
    if low.startswith("argentina"):
        return "AR"
    return None


def read_raw(path: Path) -> pl.DataFrame:
    """Lee todo como texto: así acq_time conserva sus ceros y confidence no se rompe por tipo mixto."""
    return pl.read_csv(path, infer_schema=False)


def normalize(df: pl.DataFrame, country: str, source: str) -> pl.DataFrame:
    """Convierte un CSV crudo (cualquier formato) a las columnas de `detection`."""
    df = df.rename({"bright_ti4": "brightness", "bright_ti5": "bright_t31"}, strict=False)
    if "type" not in df.columns:
        df = df.with_columns(pl.lit(None, dtype=pl.String).alias("type"))

    sat = pl.col("satellite").replace(SATELLITE_MAP)
    acq_time = pl.col("acq_time").str.zfill(4)
    out = df.select(
        pl.lit(country).alias("country"),
        pl.col("latitude").cast(pl.Float64),
        pl.col("longitude").cast(pl.Float64),
        pl.col("acq_date").str.to_date("%Y-%m-%d"),
        acq_time.alias("acq_time"),
        (pl.col("acq_date") + " " + acq_time.str.slice(0, 2) + ":" + acq_time.str.slice(2, 2) + ":00+00").alias("acq_ts"),
        sat.alias("satellite"),
        pl.when(sat.is_in(["Terra", "Aqua"])).then(pl.lit("MODIS")).otherwise(pl.lit("VIIRS")).alias("family"),
        pl.col("confidence").alias("confidence_raw"),
        pl.col("frp").cast(pl.Float32),
        pl.col("scan").cast(pl.Float32),
        pl.col("track").cast(pl.Float32),
        pl.col("daynight"),
        pl.col("type").cast(pl.Int16),
        pl.lit(source).alias("source"),
    )
    out = out.with_columns(
        # NRT no trae type: true provisional, lo corrige el paso 2 con static_cell.
        pl.when(pl.col("type").is_null()).then(True).otherwise(pl.col("type") == 0).alias("is_veg"),
        # floor, no truncar: las longitudes son negativas.
        (pl.col("latitude") * 100).floor().cast(pl.Int32).alias("cy"),
        (pl.col("longitude") * 100).floor().cast(pl.Int32).alias("cx"),
    )
    return out.select(DETECTION_COLUMNS)


def apply_window(df: pl.DataFrame, source: str) -> pl.DataFrame:
    """Precedencia entre fuentes (ingest.md): A hasta 2025; B y C desde 2026, salvo N21 completo."""
    if source == "country":
        return df.filter(pl.col("acq_date") <= pl.date(2025, 12, 31))
    return df.filter((pl.col("acq_date") >= pl.date(2026, 1, 1)) | (pl.col("satellite") == "N21"))


def validate(df: pl.DataFrame, path: Path) -> None:
    bad_sat = set(df["satellite"].unique().to_list()) - VALID_SATELLITES
    if bad_sat:
        raise ValueError(f"{path}: satélites desconocidos {bad_sat}")
    if df["acq_time"].str.len_chars().ne(4).any():
        raise ValueError(f"{path}: acq_time con longitud distinta de 4")
    nulls = {c: n for c, n in zip(df.columns, df.null_count().row(0)) if n and c != "type"}
    if nulls:
        raise ValueError(f"{path}: nulos inesperados {nulls}")


def copy_frame(cur: psycopg.Cursor, df: pl.DataFrame) -> None:
    buf = io.BytesIO()
    df.write_csv(buf, include_header=False, null_value="")
    cols = ", ".join(DETECTION_COLUMNS)
    with cur.copy(f"COPY detection ({cols}) FROM STDIN (FORMAT csv)") as cp:
        cp.write(buf.getvalue())


def run(countries: set[str] | None = None, years: set[int] | None = None, dsn: str = config.DATABASE_URL) -> int:
    files = discover(config.DATA_DIR, countries)
    if not files:
        raise SystemExit(f"No hay CSV en {config.DATA_DIR}")
    total = 0
    t0 = time.time()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("DROP INDEX IF EXISTS detection_cell_date")
            cur.execute("DROP INDEX IF EXISTS detection_date")
            if countries:
                cur.execute("DELETE FROM detection WHERE country = ANY(%s)", (sorted(countries),))
            else:
                cur.execute("TRUNCATE detection RESTART IDENTITY")
            for i, f in enumerate(files, 1):
                df = apply_window(normalize(read_raw(f.path), f.country, f.source), f.source)
                if years:
                    df = df.filter(pl.col("acq_date").dt.year().is_in(sorted(years)))
                if df.height == 0:
                    continue
                validate(df, f.path)
                copy_frame(cur, df)
                total += df.height
                print(f"[{i:3}/{len(files)}] {f.country} {f.source:7} {f.path.name:45} {df.height:>9,} filas", flush=True)
            print("Creando índices...", flush=True)
            for sql in INDEXES:
                cur.execute(sql)
            cur.execute("ANALYZE detection")
        conn.commit()
    print(f"Listo: {total:,} filas en {time.time() - t0:.0f} s")
    return total
