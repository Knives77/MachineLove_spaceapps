"""Paso 3 del ETL: días sin datos por satélite y país -> sensor_outage.

Contrato (docs/contracts/harmonization.md, "Detección de caídas"):
  - detected:     días seguidos con CERO detecciones del satélite en todo el país, dentro de su periodo
                  operativo y de la ventana en que tenemos archivos.
  - firms_readme: huecos del Readme de FIRMS con fecha exacta (los imprecisos los marca la API por mes).
  - coverage:     días del periodo operativo (hasta fin de 2026) para los que no tenemos archivos.
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import date, timedelta

import psycopg

from etl import config

# Periodo operativo de cada satélite (harmonization.md). None = sigue operando.
OPERATIONAL = {
    "Terra": (date(2000, 11, 1), None),
    "Aqua": (date(2002, 7, 4), None),
    "SNPP": (date(2012, 1, 20), date(2026, 11, 2)),
    "N20": (date(2018, 4, 1), None),
    "N21": (date(2024, 1, 17), None),
}
CALENDAR_END = date(2026, 12, 31)  # último mes que muestra el calendario

# Readme de FIRMS: el único hueco con fecha exacta. 2001-06/07, 2002 y 2007-08 son imprecisos:
# los cubre la detección automática si hubo días completos sin datos, y la API los marca por mes.
README_GAPS = [
    ("Terra", date(2009, 4, 21), date(2009, 4, 22)),
    ("Aqua", date(2009, 4, 21), date(2009, 4, 22)),
]


def to_ranges(days: list[date]) -> list[tuple[date, date]]:
    """Agrupa fechas (en cualquier orden) en rangos de días consecutivos."""
    out: list[tuple[date, date]] = []
    for d in sorted(set(days)):
        if out and d - out[-1][1] == timedelta(days=1):
            out[-1] = (out[-1][0], d)
        else:
            out.append((d, d))
    return out


def daterange(a: date, b: date):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def compute(present: dict[tuple[str, str], set[date]]) -> list[tuple[str, str, date, date, str]]:
    """present[(satellite, country)] = fechas con al menos una detección. Devuelve filas de sensor_outage."""
    rows: list[tuple[str, str, date, date, str]] = []
    for (sat, country), days in sorted(present.items()):
        if sat not in OPERATIONAL or not days:
            continue
        op_start, op_end = OPERATIONAL[sat]
        op_end = min(op_end or CALENDAR_END, CALENDAR_END)
        first, last = min(days), max(days)
        lo, hi = max(op_start, first), min(op_end, last)
        missing = [d for d in daterange(lo, hi) if d not in days]
        rows += [(sat, country, a, b, "detected") for a, b in to_ranges(missing)]
        uncovered = [d for d in daterange(op_start, op_end) if d < first or d > last]
        rows += [(sat, country, a, b, "coverage") for a, b in to_ranges(uncovered)]
    countries = {c for _, c in present}
    for sat, a, b in README_GAPS:
        for c in sorted(countries):
            rows.append((sat, c, a, b, "firms_readme"))
    return rows


def run(countries=None, years=None, dsn: str = config.DATABASE_URL) -> list:
    t0 = time.time()
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT satellite, country, acq_date FROM detection")
        present: dict[tuple[str, str], set[date]] = defaultdict(set)
        for sat, country, d in cur:
            present[(sat, country)].add(d)
        rows = compute(present)
        cur.execute("TRUNCATE sensor_outage")
        # Un rango firms_readme puede empezar el mismo día que uno detected: la PK no admite ambos.
        cur.executemany(
            """INSERT INTO sensor_outage (satellite, country, start_date, end_date, origin)
               VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
            rows,
        )
        conn.commit()
    by = defaultdict(int)
    for r in rows:
        by[r[4]] += 1
    print(f"sensor_outage: {len(rows)} rangos ({dict(by)}) · {time.time() - t0:.0f} s")
    return rows
