"""Paso 2 del ETL: máscara de fuentes estáticas.

Contrato (docs/contracts/ingest.md):
  - static_cell = celdas con detecciones type = 2 en al menos 3 fechas distintas (cualquier satélite y año).
  - Las detecciones sin type (NRT) son is_veg = true salvo que caigan en una celda de static_cell.
Se recalcula completo cada vez (es barato); los filtros de país/año no aplican.
"""
from __future__ import annotations

import time

import psycopg

from etl import config

MIN_DATES = 3


def run(countries=None, years=None, dsn: str = config.DATABASE_URL) -> dict:
    t0 = time.time()
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE static_cell")
        cur.execute(
            """
            INSERT INTO static_cell (cy, cx, n_dates)
            SELECT cy, cx, count(DISTINCT acq_date)
            FROM detection WHERE type = 2
            GROUP BY cy, cx
            HAVING count(DISTINCT acq_date) >= %s
            """,
            (MIN_DATES,),
        )
        n_cells = cur.rowcount
        # Reiniciar NRT a true y apagar las que caen en celdas estáticas: así el paso es repetible.
        cur.execute("UPDATE detection SET is_veg = true WHERE type IS NULL AND NOT is_veg")
        cur.execute(
            """
            UPDATE detection d SET is_veg = false
            FROM static_cell s
            WHERE d.type IS NULL AND d.cy = s.cy AND d.cx = s.cx
            """
        )
        n_masked = cur.rowcount
        cur.execute("SELECT count(*) FROM detection WHERE type IS NULL")
        n_nrt = cur.fetchone()[0]
        conn.commit()
    pct = 100 * n_masked / n_nrt if n_nrt else 0
    print(f"static_cell: {n_cells:,} celdas · NRT marcadas como estáticas: {n_masked:,} de {n_nrt:,} ({pct:.1f}%) · {time.time() - t0:.0f} s")
    return {"static_cells": n_cells, "nrt_masked": n_masked, "nrt_total": n_nrt}
