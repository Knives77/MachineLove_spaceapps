"""Reglas de disponibilidad de sensores compartidas por los pasos 4 y 5.

Especificación: docs/contracts/harmonization.md (VIIRS de referencia, banderas de caída).
Todo aquí es puro (sin base) salvo `load_outages`, para poder probarlo en etl/tests/.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Iterable, Iterator

from etl.outages import OPERATIONAL  # periodos operativos: una sola fuente (paso 3)

# Relevo del VIIRS de referencia: S-NPP antes, NOAA-20 desde este día.
SWITCH_DATE = date(2018, 4, 1)

MODIS_SATS = ("Terra", "Aqua")
VIIRS_START = OPERATIONAL["SNPP"][0]

# Meses con caída de MODIS documentada en el Readme de FIRMS.
README_MODIS_OUTAGE_MONTHS = {(2001, 6), (2001, 7), (2007, 8), (2009, 4)}

# Traslape MODIS-VIIRS usado para calibrar.
OVERLAP_START = (2012, 2)
OVERLAP_END = (2025, 12)

# Un mes lleva bandera de caída si le faltan al menos estos días.
OUTAGE_MIN_DAYS = 3

# (país, día) -> satélites caídos ese día
Outages = dict[tuple[str, date], frozenset[str]]
NO_OUTAGE: frozenset[str] = frozenset()


def is_operational(satellite: str, day: date) -> bool:
    start, end = OPERATIONAL[satellite]
    return start <= day and (end is None or day <= end)


def is_available(satellite: str, day: date, down: frozenset[str]) -> bool:
    return is_operational(satellite, day) and satellite not in down


def reference_satellite(day: date, down: frozenset[str] = NO_OUTAGE) -> str | None:
    """VIIRS de referencia de un día: S-NPP antes del relevo y NOAA-20 después.

    Si la referencia falta, se usa la otra; si faltan las dos, NOAA-21.
    "Falta" = caída en `sensor_outage` o fuera de su periodo operativo.
    None si ningún VIIRS está disponible (antes de 2012 o caída total).
    """
    order = ("SNPP", "N20", "N21") if day < SWITCH_DATE else ("N20", "SNPP", "N21")
    for sat in order:
        if is_available(sat, day, down):
            return sat
    return None


def daterange(start: date, end: date) -> Iterator[date]:
    """Días de `start` a `end`, ambos incluidos."""
    for i in range((end - start).days + 1):
        yield start + timedelta(days=i)


def month_days(year: int, month: int) -> Iterator[date]:
    start = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    return daterange(start, nxt - timedelta(days=1))


def months_between(start: tuple[int, int], end: tuple[int, int]) -> list[tuple[int, int]]:
    y, m = start
    out = []
    while (y, m) <= end:
        out.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def modis_missing_days(country: str, year: int, month: int, outages: Outages) -> int:
    """Días del mes sin ningún MODIS disponible (Terra y Aqua caídos a la vez, o fuera de operación)."""
    return sum(
        1 for d in month_days(year, month)
        if not any(is_available(s, d, outages.get((country, d), NO_OUTAGE)) for s in MODIS_SATS)
    )


def viirs_missing_days(country: str, year: int, month: int, outages: Outages) -> int:
    """Días del mes, desde que existe VIIRS, sin VIIRS de referencia ni respaldo."""
    return sum(
        1 for d in month_days(year, month)
        if d >= VIIRS_START and reference_satellite(d, outages.get((country, d), NO_OUTAGE)) is None
    )


def outage_flags(country: str, year: int, month: int, outages: Outages) -> set[str]:
    """Banderas `modis_outage` y `viirs_outage` de un mes (las demás banderas son del backend)."""
    flags = set()
    if (year, month) in README_MODIS_OUTAGE_MONTHS or modis_missing_days(country, year, month, outages) >= OUTAGE_MIN_DAYS:
        flags.add("modis_outage")
    if viirs_missing_days(country, year, month, outages) >= OUTAGE_MIN_DAYS:
        flags.add("viirs_outage")
    return flags


def expand_outages(rows: Iterable[tuple[str, str, date, date]]) -> Outages:
    """Filas (satellite, country, start_date, end_date) -> mapa por día."""
    acc: dict[tuple[str, date], set[str]] = defaultdict(set)
    for sat, country, start, end in rows:
        for d in daterange(start, end):
            acc[(country, d)].add(sat)
    return {k: frozenset(v) for k, v in acc.items()}


def load_outages(cur, countries: set[str] | None = None) -> Outages:
    sql = "SELECT satellite, country, start_date, end_date FROM sensor_outage"
    params: tuple = ()
    if countries:
        sql += " WHERE country = ANY(%s)"
        params = (sorted(countries),)
    cur.execute(sql, params)
    return expand_outages(cur.fetchall())
