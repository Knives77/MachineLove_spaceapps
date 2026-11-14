"""Paso 4 del ETL: `detection` -> `cell` y `cell_day`.

Especificación: docs/contracts/db_schema.sql (tablas 3 y 4) y docs/contracts/harmonization.md.
  - cell:     una fila por celda 0.01° con al menos una detección; geom = centro de la celda.
  - cell_day: una fila por celda y fecha con alguna detección.
      modis_veg  alguna detección MODIS con is_veg
      viirs_veg  alguna detección is_veg del VIIRS de referencia de ese día y país
      raw_*      todas las detecciones (todos los satélites, todos los type)
      frp_*      suma de FRP de las detecciones que cuentan para modis_veg / viirs_veg

El VIIRS de referencia por (país, día) se calcula en Python con `reference.reference_satellite`
y se sube a una tabla temporal; el resto es SQL en el servidor (no se trae `detection` a memoria).

Todas las tablas se escriben sin esquema: si la sesión tiene tablas temporales con el mismo
nombre (modo `etl.verify --sandbox`), se escribe en ellas y las oficiales no se tocan.
"""
from __future__ import annotations

import time
from collections import Counter

import psycopg

from etl import config
from etl.reference import NO_OUTAGE, VIIRS_START, daterange, load_outages, reference_satellite

CELL_DAY_COLUMNS = (
    "cy, cx, acq_date, modis_veg, viirs_veg, raw_points, raw_modis, raw_viirs, frp_modis, frp_viirs"
)


def _filters(countries: set[str] | None, years: set[int] | None, alias: str = "d") -> tuple[str, list]:
    where, params = ["TRUE"], []
    if countries:
        where.append(f"{alias}.country = ANY(%s)")
        params.append(sorted(countries))
    if years:
        where.append(f"extract(year FROM {alias}.acq_date)::int = ANY(%s)")
        params.append(sorted(years))
    return " AND ".join(where), params


def mask_warning(cur: psycopg.Cursor) -> int:
    """Detecciones NRT que siguen como vegetación dentro de una celda estática (el paso 2 no corrió)."""
    cur.execute(
        "SELECT count(*) FROM detection d JOIN static_cell s USING (cy, cx) "
        "WHERE d.type IS NULL AND d.is_veg"
    )
    return cur.fetchone()[0]


def build_reference(cur: psycopg.Cursor, countries: set[str] | None) -> Counter:
    """Crea la tabla temporal `viirs_ref (country, acq_date, satellite)` y devuelve días por satélite."""
    outages = load_outages(cur, countries)
    where, params = _filters(countries, None)
    cur.execute(f"SELECT d.country, min(d.acq_date), max(d.acq_date) FROM detection d WHERE {where} GROUP BY 1", params)
    spans = cur.fetchall()

    cur.execute("DROP TABLE IF EXISTS viirs_ref")
    cur.execute(
        "CREATE TEMP TABLE viirs_ref (country CHAR(2), acq_date DATE, satellite TEXT, "
        "PRIMARY KEY (country, acq_date))"
    )
    used: Counter = Counter()
    with cur.copy("COPY viirs_ref (country, acq_date, satellite) FROM STDIN") as cp:
        for country, start, end in spans:
            for day in daterange(max(start, VIIRS_START), end):
                sat = reference_satellite(day, outages.get((country, day), NO_OUTAGE))
                used[(country, sat)] += 1
                if sat:
                    cp.write_row((country, day, sat))
    cur.execute("ANALYZE viirs_ref")
    return used


def build(conn: psycopg.Connection, countries: set[str] | None = None, years: set[int] | None = None) -> int:
    """Reconstruye `cell` y `cell_day` para los países/años pedidos. Devuelve filas de cell_day."""
    t0 = time.time()
    with conn.cursor() as cur:
        cur.execute("SET work_mem = '256MB'")
        bad = mask_warning(cur)
        if bad:
            print(f"AVISO: {bad:,} detecciones NRT siguen como vegetación en celdas estáticas. "
                  "¿Corrió el paso 2 (máscara)?", flush=True)

        used = build_reference(cur, countries)
        for (country, sat), n in sorted(used.items(), key=lambda kv: (kv[0][0], kv[0][1] or "~")):
            print(f"  VIIRS de referencia {country} {sat or 'ninguno':5} {n:>6,} días", flush=True)

        # 1. Borrar lo anterior. Los índices no se tocan: un DROP INDEX por nombre sin esquema
        #    alcanzaría el índice oficial aunque la sesión escriba en tablas temporales.
        full = not countries and not years
        cw, cp = _filters(countries, None, "c")
        if full:
            cur.execute("TRUNCATE cell_day, cell")
        elif not years:
            cur.execute(f"DELETE FROM cell c WHERE {cw}", cp)

        # 2. Catálogo de celdas (todas las fechas del país, aunque se limiten los años de cell_day).
        where, params = _filters(countries, None)
        cur.execute(
            f"""
            INSERT INTO cell (cy, cx, country, geom)
            SELECT d.cy, d.cx, min(d.country),
                   ST_SetSRID(ST_MakePoint((d.cx + 0.5) / 100.0, (d.cy + 0.5) / 100.0), 4326)
            FROM detection d
            WHERE {where}
            GROUP BY d.cy, d.cx
            ON CONFLICT (cy, cx) DO NOTHING
            """,
            params,
        )
        n_cells = cur.rowcount
        print(f"  cell: {n_cells:,} celdas nuevas ({time.time() - t0:.0f} s)", flush=True)

        # 3. Celdas-día. En corridas parciales se borra después de reconstruir `cell`, para
        #    alcanzar también filas de celdas que aún no estaban en el catálogo.
        if not full:
            yw, yp = _filters(None, years, "cd")
            cur.execute(f"DELETE FROM cell_day cd USING cell c WHERE c.cy = cd.cy AND c.cx = cd.cx AND {cw} AND {yw}", cp + yp)
        where, params = _filters(countries, years)
        cur.execute(
            f"""
            INSERT INTO cell_day ({CELL_DAY_COLUMNS})
            SELECT d.cy, d.cx, d.acq_date,
                   bool_or(d.family = 'MODIS' AND d.is_veg),
                   bool_or(d.is_veg AND coalesce(d.satellite = r.satellite, false)),
                   least(count(*), 32767)::smallint,
                   least(count(*) FILTER (WHERE d.family = 'MODIS'), 32767)::smallint,
                   least(count(*) FILTER (WHERE d.family = 'VIIRS'), 32767)::smallint,
                   sum(d.frp) FILTER (WHERE d.family = 'MODIS' AND d.is_veg),
                   sum(d.frp) FILTER (WHERE d.is_veg AND d.satellite = r.satellite)
            FROM detection d
            LEFT JOIN viirs_ref r ON r.country = d.country AND r.acq_date = d.acq_date
            WHERE {where}
            GROUP BY d.cy, d.cx, d.acq_date
            ORDER BY d.cy, d.cx, d.acq_date
            """,
            params,
        )
        n = cur.rowcount
        print(f"  cell_day: {n:,} filas ({time.time() - t0:.0f} s)", flush=True)

        cur.execute("ANALYZE cell")
        cur.execute("ANALYZE cell_day")
    return n


def run(countries: set[str] | None = None, years: set[int] | None = None, dsn: str = config.DATABASE_URL) -> int:
    t0 = time.time()
    with psycopg.connect(dsn) as conn:
        n = build(conn, countries, years)
        conn.commit()
    print(f"Listo: {n:,} celdas-día en {time.time() - t0:.0f} s")
    return n
