"""Lógica pura de armonización MODIS ↔ VIIRS, línea base y anomalías.

Especificación: docs/contracts/harmonization.md y docs/contracts/api.md.
Este módulo no depende de la base de datos ni de FastAPI.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import median
from typing import Iterable

from backend.models import (
    AoiSummary,
    BaselineSummary,
    Basis,
    CalendarResponse,
    CalibrationScope,
    CalibrationSummary,
    Country,
    Flag,
    LatestMonth,
    MonthRow,
    Source,
    Status,
    YearRange,
    YearRow,
)

MonthKey = tuple[int, int]  # (year, month)

# Periodos clave del contrato (docs/contracts/harmonization.md)
MODIS_START: MonthKey = (2000, 11)
AQUA_START: MonthKey = (2002, 7)
VIIRS_START_DATE = date(2012, 1, 20)
VIIRS_FULL_MONTH_START: MonthKey = (2012, 2)
SWITCH_DATE = date(2018, 4, 1)

OVERLAP_START: MonthKey = (2012, 2)
OVERLAP_END: MonthKey = (2025, 12)

README_MODIS_OUTAGE_MONTHS: set[MonthKey] = {
    (2001, 6),
    (2001, 7),
    (2007, 8),
    (2009, 4),
}

OUTAGE_MIN_DAYS = 3
MIN_OVERLAP_MODIS_CELL_DAYS = 100
LOYO_MIN_MODIS = 20
MONTHLY_MIN_MODIS = 10
MIN_BASELINE_YEARS = 10

BASELINE_EXCLUDED_FLAGS: set[Flag] = {
    "modis_outage",
    "viirs_outage",
    "partial_month",
    "no_coverage",
}

OPERATIONAL: dict[str, tuple[date, date | None]] = {
    "Terra": (date(2000, 11, 1), None),
    "Aqua": (date(2002, 7, 4), None),
    "SNPP": (date(2012, 1, 20), date(2026, 11, 2)),
    "N20": (date(2018, 4, 1), None),
    "N21": (date(2024, 1, 17), None),
}

DEFAULT_COUNTRY_K: dict[str, float] = {
    "MX": 0.332,
    "AR": 0.464,
}


@dataclass(frozen=True)
class MonthlyCounts:
    """Conteos mensuales crudos de un AOI devueltos por la consulta SQL."""

    modis_cell_days: int = 0
    viirs_cell_days: int = 0
    raw_points: int = 0
    has_nrt: bool = False


@dataclass(frozen=True)
class OutageInterval:
    """Fila de la tabla sensor_outage."""

    satellite: str
    country: str
    start_date: date
    end_date: date
    origin: str = "detected"


def months_in_range(start_year: int, end_year: int) -> list[MonthKey]:
    return [
        (y, m)
        for y in range(start_year, end_year + 1)
        for m in range(1, 13)
    ]


def month_days(year: int, month: int) -> list[date]:
    start = date(year, month, 1)
    nxt = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    n_days = (nxt - start).days
    return [start + timedelta(days=i) for i in range(n_days)]


def is_operational(satellite: str, day: date) -> bool:
    if satellite not in OPERATIONAL:
        return False
    start, end = OPERATIONAL[satellite]
    return start <= day and (end is None or day <= end)


def reference_viirs(day: date, down_sats: frozenset[str]) -> str | None:
    order = ("SNPP", "N20", "N21") if day < SWITCH_DATE else ("N20", "SNPP", "N21")
    for sat in order:
        if is_operational(sat, day) and sat not in down_sats:
            return sat
    return None


def expand_outages_by_day(
    outages: Iterable[OutageInterval],
    country: str,
) -> tuple[dict[date, frozenset[str]], set[date]]:
    """Devuelve (mapa dia -> satélites caídos, conjunto de días sin cobertura de archivos)."""
    down_by_day: dict[date, set[str]] = {}
    no_cov_days: set[date] = set()
    for row in outages:
        if row.country != country:
            continue
        cur = row.start_date
        while cur <= row.end_date:
            down_by_day.setdefault(cur, set()).add(row.satellite)
            if row.origin == "coverage":
                no_cov_days.add(cur)
            cur += timedelta(days=1)
    return {d: frozenset(sats) for d, sats in down_by_day.items()}, no_cov_days


def compute_month_flags(
    year: int,
    month: int,
    country: str,
    down_by_day: dict[date, frozenset[str]],
    no_cov_days: set[date],
    has_nrt: bool = False,
    data_through: date = date(2026, 11, 1),
) -> list[Flag]:
    """Determina las banderas del mes según docs/contracts/harmonization.md."""
    ym = (year, month)
    days = month_days(year, month)
    if not days:
        return ["no_coverage"]

    # Antes de MODIS (nov 2000) o después de data_through completo
    if ym < MODIS_START or days[0] > data_through:
        return ["no_coverage"]

    # Si todos los días del mes están sin cobertura o después de data_through
    covered_days = [
        d for d in days if d <= data_through and d not in no_cov_days
    ]
    if not covered_days:
        return ["no_coverage"]

    flags: list[Flag] = []

    if ym < AQUA_START:
        flags.append("terra_only")

    # Caídas MODIS (Terra y Aqua caídos a la vez en días cubiertos)
    modis_down_days = sum(
        1
        for d in covered_days
        if not any(
            is_operational(sat, d) and sat not in down_by_day.get(d, frozenset())
            for sat in ("Terra", "Aqua")
        )
    )
    if ym in README_MODIS_OUTAGE_MONTHS or modis_down_days >= OUTAGE_MIN_DAYS:
        flags.append("modis_outage")

    # Caídas VIIRS (desde feb 2012)
    if ym >= VIIRS_FULL_MONTH_START:
        viirs_down_days = sum(
            1
            for d in covered_days
            if d >= VIIRS_START_DATE
            and reference_viirs(d, down_by_day.get(d, frozenset())) is None
        )
        if viirs_down_days >= OUTAGE_MIN_DAYS:
            flags.append("viirs_outage")

    if has_nrt:
        flags.append("nrt")

    if len(covered_days) < len(days):
        flags.append("partial_month")

    return flags


def percentile_linear(sorted_vals: list[float], q: float) -> float:
    """Percentil con interpolación lineal (q en 0..1) sobre lista ordenada no vacía."""
    n = len(sorted_vals)
    if n == 1:
        return float(sorted_vals[0])
    pos = q * (n - 1)
    lo = int(pos)
    hi = min(lo + 1, n - 1)
    frac = pos - lo
    return sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac


def compute_calibration(
    counts_by_month: dict[MonthKey, MonthlyCounts],
    flags_by_month: dict[MonthKey, list[Flag]],
    country: Country,
    country_k: float | None = None,
) -> CalibrationSummary:
    """Calcula k y métricas de validación en el traslape 2012-02 a 2025-12."""
    overlap_keys: list[MonthKey] = []
    for y in range(OVERLAP_START[0], OVERLAP_END[0] + 1):
        for m in range(1, 13):
            ym = (y, m)
            if ym < OVERLAP_START or ym > OVERLAP_END:
                continue
            fl = flags_by_month.get(ym, [])
            if (
                "modis_outage" in fl
                or "viirs_outage" in fl
                or "no_coverage" in fl
            ):
                continue
            overlap_keys.append(ym)

    rows = [
        (
            ym,
            counts_by_month.get(ym, MonthlyCounts()).modis_cell_days,
            counts_by_month.get(ym, MonthlyCounts()).viirs_cell_days,
        )
        for ym in overlap_keys
    ]
    sum_m = sum(m for _, m, _ in rows)
    sum_v = sum(v for _, _, v in rows)

    fallback_k = (
        country_k
        if country_k is not None
        else DEFAULT_COUNTRY_K.get(country, 0.332)
    )

    if sum_m < MIN_OVERLAP_MODIS_CELL_DAYS or sum_v == 0:
        scope: CalibrationScope = "country"
        k = float(fallback_k)
    else:
        scope = "aoi"
        k = sum_m / sum_v

    # Validación dejando un año fuera (LOYO) para años con ΣM >= 20
    by_year: dict[int, list[int]] = {}
    for (y, _), m, v in rows:
        acc = by_year.setdefault(y, [0, 0])
        acc[0] += m
        acc[1] += v

    loyo_errs: list[float] = []
    if len(by_year) >= 2:
        for y, (my, vy) in by_year.items():
            if my < LOYO_MIN_MODIS:
                continue
            rem_v = sum_v - vy
            rem_m = sum_m - my
            if rem_v <= 0:
                continue
            k_without_y = rem_m / rem_v if scope == "aoi" else k
            err_y = abs(k_without_y * vy - my) / my
            loyo_errs.append(err_y)

    # Error mensual en meses del traslape con M(m) >= 10
    monthly_errs = [
        abs(k * v - m) / m for _, m, v in rows if m >= MONTHLY_MIN_MODIS
    ]

    return CalibrationSummary(
        k=round(k, 4),
        scope=scope,
        overlap_months=len(overlap_keys),
        modis_cell_days=sum_m,
        viirs_cell_days=sum_v,
        loyo_annual_mape=round(float(median(loyo_errs)), 4) if loyo_errs else None,
        loyo_annual_max=round(float(max(loyo_errs)), 4) if loyo_errs else None,
        monthly_mape=round(float(median(monthly_errs)), 4) if monthly_errs else None,
    )


def classify_status(
    harmonized: float | None,
    baseline: BaselineSummary | None,
) -> Status:
    """Clasifica el estado del mes frente a su línea base."""
    if harmonized is None:
        return "no_data"
    if baseline is None or baseline.n_years < MIN_BASELINE_YEARS:
        return "insufficient_baseline"
    if harmonized < baseline.p25:
        return "below"
    if harmonized <= baseline.p75:
        return "normal"
    if harmonized <= baseline.p90:
        return "above"
    return "critical"


def build_calendar_response(
    aoi_summary: AoiSummary,
    start_year: int,
    end_year: int,
    basis: Basis,
    counts_by_month: dict[MonthKey, MonthlyCounts],
    outages: Iterable[OutageInterval] = (),
    country_k: float | None = None,
    data_through: date = date(2026, 11, 1),
    explicit_flags_by_month: dict[MonthKey, list[Flag]] | None = None,
) -> CalendarResponse:
    """Construye la respuesta completa de POST /calendar."""
    # Siempre calculamos sobre 2000..2026 para calibrar en todo el traslape y recortamos al rango pedido al final.
    full_start = min(2000, start_year)
    full_end = max(2026, end_year)
    all_keys = months_in_range(full_start, full_end)

    down_by_day, no_cov_days = expand_outages_by_day(outages, aoi_summary.country)

    flags_by_month: dict[MonthKey, list[Flag]] = {}
    for ym in all_keys:
        if explicit_flags_by_month is not None and ym in explicit_flags_by_month:
            flags_by_month[ym] = list(explicit_flags_by_month[ym])
        else:
            mc = counts_by_month.get(ym, MonthlyCounts())
            flags_by_month[ym] = compute_month_flags(
                ym[0],
                ym[1],
                aoi_summary.country,
                down_by_day,
                no_cov_days,
                has_nrt=mc.has_nrt,
                data_through=data_through,
            )

    calibration = compute_calibration(
        counts_by_month=counts_by_month,
        flags_by_month=flags_by_month,
        country=aoi_summary.country,
        country_k=country_k,
    )
    if (
        calibration.scope == "aoi"
        and calibration.viirs_cell_days > 0
        and calibration.modis_cell_days >= MIN_OVERLAP_MODIS_CELL_DAYS
    ):
        k = calibration.modis_cell_days / calibration.viirs_cell_days
    else:
        k = (
            float(country_k)
            if country_k is not None
            else calibration.k
        )

    # Paso 1: calcular serie armonizada para el rango consultado (start_year..end_year)
    req_keys = months_in_range(start_year, end_year)
    harmonized_by_ym: dict[MonthKey, float | None] = {}
    source_by_ym: dict[MonthKey, Source | None] = {}
    modis_cd_by_ym: dict[MonthKey, int | None] = {}
    viirs_cd_by_ym: dict[MonthKey, int | None] = {}
    raw_by_ym: dict[MonthKey, int] = {}

    for ym in req_keys:
        fl = flags_by_month[ym]
        mc = counts_by_month.get(ym, MonthlyCounts())
        raw_by_ym[ym] = mc.raw_points

        if "no_coverage" in fl:
            harmonized_by_ym[ym] = None
            source_by_ym[ym] = None
            modis_cd_by_ym[ym] = None
            viirs_cd_by_ym[ym] = None
            continue

        has_modis_cov = ym >= MODIS_START
        has_viirs_cov = ym >= VIIRS_FULL_MONTH_START
        has_viirs_data = ym >= (2012, 1)

        m_val = mc.modis_cell_days if has_modis_cov else None
        v_val = mc.viirs_cell_days if has_viirs_data else None
        modis_cd_by_ym[ym] = m_val
        viirs_cd_by_ym[ym] = v_val

        if basis == "viirs_primary":
            if has_viirs_cov and v_val is not None:
                harmonized_by_ym[ym] = round(k * v_val, 1)
                source_by_ym[ym] = "viirs_scaled"
            elif has_modis_cov and m_val is not None:
                harmonized_by_ym[ym] = round(float(m_val), 1)
                source_by_ym[ym] = "modis"
            else:
                harmonized_by_ym[ym] = None
                source_by_ym[ym] = None
        else:  # modis_primary
            if has_modis_cov and m_val is not None:
                harmonized_by_ym[ym] = round(float(m_val), 1)
                source_by_ym[ym] = "modis"
            elif has_viirs_cov and v_val is not None:
                harmonized_by_ym[ym] = round(k * v_val, 1)
                source_by_ym[ym] = "viirs_scaled"
            else:
                harmonized_by_ym[ym] = None
                source_by_ym[ym] = None

    # Paso 2: calcular línea base, anomalía y estado para cada mes del rango consultado
    month_rows: list[MonthRow] = []
    for ym in req_keys:
        y, m = ym
        h_val = harmonized_by_ym[ym]
        fl = flags_by_month[ym]

        if h_val is None:
            month_rows.append(
                MonthRow(
                    year=y,
                    month=m,
                    harmonized=None,
                    source=None,
                    raw_points=raw_by_ym[ym],
                    modis_cell_days=modis_cd_by_ym[ym],
                    viirs_cell_days=viirs_cd_by_ym[ym],
                    baseline=None,
                    anomaly_ratio=None,
                    status="no_data",
                    flags=fl,
                )
            )
            continue

        # Otros años del mismo mes calendario en el rango consultado sin banderas excluyentes
        peer_vals: list[float] = []
        for other_y in range(start_year, end_year + 1):
            if other_y == y:
                continue
            other_ym = (other_y, m)
            other_h = harmonized_by_ym.get(other_ym)
            if other_h is None:
                continue
            other_fl = flags_by_month.get(other_ym, [])
            if any(f in BASELINE_EXCLUDED_FLAGS for f in other_fl):
                continue
            peer_vals.append(other_h)

        peer_vals.sort()
        n_years = len(peer_vals)
        if n_years > 0:
            med = round(percentile_linear(peer_vals, 0.50), 1)
            p25 = round(percentile_linear(peer_vals, 0.25), 1)
            p75 = round(percentile_linear(peer_vals, 0.75), 1)
            p90 = round(percentile_linear(peer_vals, 0.90), 1)
            baseline = BaselineSummary(
                median=med,
                p25=p25,
                p75=p75,
                p90=p90,
                n_years=n_years,
            )
        else:
            baseline = None

        status = classify_status(h_val, baseline)
        partial = "partial_month" in fl
        if partial:
            # harmonization.md: un mes parcial no se compara contra meses completos.
            status = "no_data"
        if (
            not partial
            and baseline is not None
            and baseline.n_years >= MIN_BASELINE_YEARS
            and baseline.median > 0
        ):
            anomaly_ratio: float | None = round(h_val / baseline.median, 2)
        else:
            anomaly_ratio = None

        month_rows.append(
            MonthRow(
                year=y,
                month=m,
                harmonized=h_val,
                source=source_by_ym[ym],
                raw_points=raw_by_ym[ym],
                modis_cell_days=modis_cd_by_ym[ym],
                viirs_cell_days=viirs_cd_by_ym[ym],
                baseline=baseline if n_years >= MIN_BASELINE_YEARS else None,
                anomaly_ratio=anomaly_ratio,
                status=status,
                flags=fl,
            )
        )

    # Paso 3: agregados anuales (years)
    year_rows: list[YearRow] = []
    for y in range(start_year, end_year + 1):
        m_in_y = [r for r in month_rows if r.year == y]
        valid_h = [r.harmonized for r in m_in_y if r.harmonized is not None]
        raw_sum = sum(r.raw_points for r in m_in_y)
        complete = len(valid_h) == 12 and all(
            "partial_month" not in r.flags and "no_coverage" not in r.flags
            for r in m_in_y
        )
        year_rows.append(
            YearRow(
                year=y,
                harmonized=round(sum(valid_h), 1) if valid_h else None,
                raw_points=raw_sum,
                complete=complete,
            )
        )

    # Paso 4: estacionalidad (12 números que suman 1)
    month_totals = [0.0] * 12
    for r in month_rows:
        if r.harmonized is not None and "no_coverage" not in r.flags:
            month_totals[r.month - 1] += r.harmonized
    grand_total = sum(month_totals)
    if grand_total > 0:
        seasonality = [round(v / grand_total, 4) for v in month_totals]
        # Ajustar el mes mayor para garantizar suma exacta 1.0 tras redondeo
        diff = round(1.0 - sum(seasonality), 4)
        if diff != 0:
            max_idx = max(range(12), key=lambda i: seasonality[i])
            seasonality[max_idx] = round(seasonality[max_idx] + diff, 4)
    else:
        seasonality = [0.0] * 12

    # Paso 5: último mes completo con dato (latest)
    complete_months = [
        r
        for r in month_rows
        if r.harmonized is not None
        and "partial_month" not in r.flags
        and "no_coverage" not in r.flags
    ]
    if complete_months:
        last_m = complete_months[-1]
        latest = LatestMonth(year=last_m.year, month=last_m.month)
    else:
        with_data = [r for r in month_rows if r.harmonized is not None]
        if with_data:
            last_m = with_data[-1]
            latest = LatestMonth(year=last_m.year, month=last_m.month)
        else:
            latest = LatestMonth(year=end_year, month=12)

    return CalendarResponse(
        aoi=aoi_summary,
        range=YearRange(start_year=start_year, end_year=end_year),
        basis=basis,
        calibration=calibration,
        months=month_rows,
        years=year_rows,
        seasonality=seasonality,
        latest=latest,
    )

