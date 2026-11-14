"""Paso 5 del ETL: factor MODIS/VIIRS por país -> `calibration_country`.

Especificación: docs/contracts/harmonization.md, sección "Calibración".
  k = Σ M(m) / Σ V(m) sobre los meses del traslape (2012-02 a 2025-12) sin `modis_outage`
  ni `viirs_outage`. Validación dejando un año fuera sobre los años con Σ M ≥ 20.

`calibrate()` es pura y la reutiliza `etl.verify` para los recuadros de control.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from statistics import median

import psycopg

from etl import config
from etl.reference import OVERLAP_END, OVERLAP_START, Outages, load_outages, months_between, outage_flags

LOYO_MIN_MODIS = 20      # años con menos celdas-día MODIS no se validan
MONTHLY_MIN_MODIS = 10   # meses con menos celdas-día MODIS no entran al error mensual

Month = tuple[int, int]


@dataclass(frozen=True)
class Calibration:
    k: float
    overlap_months: int
    modis_cell_days: int
    viirs_cell_days: int
    loyo_annual_mape: float | None
    loyo_annual_max: float | None
    monthly_mape: float | None
    excluded_months: int


def overlap_months(country: str, outages: Outages) -> tuple[list[Month], list[Month]]:
    """Meses del traslape que sirven para calibrar y los excluidos por bandera de caída."""
    used, excluded = [], []
    for y, m in months_between(OVERLAP_START, OVERLAP_END):
        (excluded if outage_flags(country, y, m, outages) else used).append((y, m))
    return used, excluded


def loyo_errors(series: dict[Month, tuple[int, int]], months: list[Month]) -> dict[int, float]:
    """Error anual dejando un año fuera: |k_sin_y · ΣV_y − ΣM_y| / ΣM_y para años con ΣM_y ≥ 20."""
    by_year: dict[int, list[int]] = {}
    for ym in months:
        m, v = series.get(ym, (0, 0))
        acc = by_year.setdefault(ym[0], [0, 0])
        acc[0] += m
        acc[1] += v
    if len(by_year) < 2:
        return {}
    sum_m = sum(a[0] for a in by_year.values())
    sum_v = sum(a[1] for a in by_year.values())
    errs = {}
    for y, (my, vy) in by_year.items():
        if my < LOYO_MIN_MODIS or sum_v - vy == 0:
            continue
        errs[y] = abs((sum_m - my) / (sum_v - vy) * vy - my) / my
    return errs


def calibrate(series: dict[Month, tuple[int, int]], months: list[Month], excluded: int = 0) -> Calibration:
    """`series[(año, mes)] = (M, V)`; meses ausentes cuentan como 0. Solo se usan `months`."""
    rows = [(ym, *series.get(ym, (0, 0))) for ym in months]
    sum_m = sum(r[1] for r in rows)
    sum_v = sum(r[2] for r in rows)
    if sum_v == 0:
        raise ValueError("sin celdas-día VIIRS en el traslape: no se puede calibrar")
    k = sum_m / sum_v
    errs = list(loyo_errors(series, months).values())
    monthly = [abs(k * v - m) / m for _, m, v in rows if m >= MONTHLY_MIN_MODIS]
    return Calibration(
        k=k,
        overlap_months=len(months),
        modis_cell_days=sum_m,
        viirs_cell_days=sum_v,
        loyo_annual_mape=median(errs) if errs else None,
        loyo_annual_max=max(errs) if errs else None,
        monthly_mape=median(monthly) if monthly else None,
        excluded_months=excluded,
    )


def monthly_series(cur: psycopg.Cursor, cell_filter: str = "c.country = %s", params: tuple = ()) -> dict[Month, tuple[int, int]]:
    """M(m) y V(m) del traslape para las celdas que cumplan `cell_filter` (alias c = cell, cd = cell_day)."""
    cur.execute(
        f"""
        SELECT extract(year FROM cd.acq_date)::int, extract(month FROM cd.acq_date)::int,
               count(*) FILTER (WHERE cd.modis_veg), count(*) FILTER (WHERE cd.viirs_veg)
        FROM cell_day cd JOIN cell c ON c.cy = cd.cy AND c.cx = cd.cx
        WHERE cd.acq_date BETWEEN %s AND %s AND {cell_filter}
        GROUP BY 1, 2
        """,
        (f"{OVERLAP_START[0]}-{OVERLAP_START[1]:02d}-01", f"{OVERLAP_END[0]}-{OVERLAP_END[1]:02d}-31", *params),
    )
    return {(y, m): (mm, vv) for y, m, mm, vv in cur.fetchall()}


def build(conn: psycopg.Connection, countries: set[str] | None = None) -> dict[str, Calibration]:
    out: dict[str, Calibration] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT country FROM cell ORDER BY 1")
        todo = [c for (c,) in cur.fetchall() if not countries or c in countries]
        outages = load_outages(cur, set(todo))
        for country in todo:
            months, excluded = overlap_months(country, outages)
            cal = calibrate(monthly_series(cur, "c.country = %s", (country,)), months, len(excluded))
            if cal.loyo_annual_mape is None:
                print(f"AVISO {country}: no hay años suficientes para validar; no se escribe la fila", flush=True)
                continue
            cur.execute("DELETE FROM calibration_country WHERE country = %s", (country,))
            cur.execute(
                "INSERT INTO calibration_country "
                "(country, k, overlap_months, modis_cell_days, viirs_cell_days, loyo_annual_mape) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (country, cal.k, cal.overlap_months, cal.modis_cell_days, cal.viirs_cell_days, cal.loyo_annual_mape),
            )
            out[country] = cal
            print(
                f"  {country}: k={cal.k:.3f}  meses={cal.overlap_months} (excluidos {cal.excluded_months}: "
                f"{', '.join(f'{y}-{m:02d}' for y, m in excluded[:12])}{' …' if len(excluded) > 12 else ''})  "
                f"M={cal.modis_cell_days:,} V={cal.viirs_cell_days:,}  "
                f"LOYO anual mediana={cal.loyo_annual_mape:.3f} máx={cal.loyo_annual_max:.3f}  "
                f"mensual={cal.monthly_mape:.3f}",
                flush=True,
            )
    return out


def run(countries: set[str] | None = None, years: set[int] | None = None, dsn: str = config.DATABASE_URL) -> dict[str, Calibration]:
    t0 = time.time()
    with psycopg.connect(dsn) as conn:
        out = build(conn, countries)
        conn.commit()
    print(f"Listo: {len(out)} países en {time.time() - t0:.0f} s")
    return out
