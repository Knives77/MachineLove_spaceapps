"""Pruebas unitarias para api/harmonize.py (tablas de docs/contracts/harmonization.md)."""
from __future__ import annotations

from datetime import date

import pytest

from backend.harmonize import (
    MonthKey,
    MonthlyCounts,
    OutageInterval,
    build_calendar_response,
    classify_status,
    compute_calibration,
    compute_month_flags,
    expand_outages_by_day,
)
from backend.models import AoiSummary, BaselineSummary


def test_calibration_aoi_scope() -> None:
    """Cuando ΣM >= 100 en el traslape, usa k del AOI y scope='aoi'."""
    counts: dict[MonthKey, MonthlyCounts] = {}
    for y in range(2012, 2026):
        for m in range(1, 13):
            if (y, m) < (2012, 2):
                continue
            counts[(y, m)] = MonthlyCounts(
                modis_cell_days=10,
                viirs_cell_days=40,
                raw_points=50,
            )
    flags = {ym: [] for ym in counts}
    cal = compute_calibration(counts, flags, country="MX", country_k=0.332)
    assert cal.scope == "aoi"
    assert cal.k == pytest.approx(0.25)
    assert cal.modis_cell_days == 167 * 10
    assert cal.viirs_cell_days == 167 * 40
    assert cal.loyo_annual_mape == pytest.approx(0.0)
    assert cal.monthly_mape == pytest.approx(0.0)


def test_calibration_country_fallback_under_100_modis() -> None:
    """Cuando ΣM < 100 en el traslape, usa k del país y scope='country'."""
    counts: dict[MonthKey, MonthlyCounts] = {
        (2015, 4): MonthlyCounts(modis_cell_days=30, viirs_cell_days=100),
        (2016, 4): MonthlyCounts(modis_cell_days=40, viirs_cell_days=120),
    }
    flags = {ym: [] for ym in counts}
    cal = compute_calibration(counts, flags, country="MX", country_k=0.332)
    assert cal.scope == "country"
    assert cal.k == pytest.approx(0.332)
    assert cal.modis_cell_days == 70


def test_flags_table() -> None:
    """Verifica cada bandera definida en docs/contracts/harmonization.md."""
    outages = [
        OutageInterval("SNPP", "MX", date(2015, 5, 1), date(2015, 5, 5), "detected"),
        OutageInterval("N20", "MX", date(2015, 5, 1), date(2015, 5, 5), "detected"),
        OutageInterval("Terra", "AR", date(2026, 2, 1), date(2026, 2, 28), "coverage"),
    ]
    down_mx, nocov_mx = expand_outages_by_day(outages, "MX")
    down_ar, nocov_ar = expand_outages_by_day(outages, "AR")

    # Antes de MODIS -> no_coverage
    assert compute_month_flags(2000, 5, "MX", down_mx, nocov_mx) == ["no_coverage"]

    # Antes de jul-2002 -> terra_only
    assert "terra_only" in compute_month_flags(2001, 3, "MX", down_mx, nocov_mx)

    # Lista Readme MODIS -> modis_outage
    fl_2001_06 = compute_month_flags(2001, 6, "MX", down_mx, nocov_mx)
    assert "terra_only" in fl_2001_06
    assert "modis_outage" in fl_2001_06

    # Caída de VIIRS >= 3 días -> viirs_outage
    fl_2015_05 = compute_month_flags(2015, 5, "MX", down_mx, nocov_mx)
    assert "viirs_outage" in fl_2015_05

    # NRT y partial_month
    fl_2026_11 = compute_month_flags(
        2026, 11, "MX", down_mx, nocov_mx, has_nrt=True, data_through=date(2026, 11, 1)
    )
    assert "nrt" in fl_2026_11
    assert "partial_month" in fl_2026_11

    # Mes sin archivos (coverage) -> no_coverage
    fl_ar_feb = compute_month_flags(2026, 2, "AR", down_ar, nocov_ar)
    assert fl_ar_feb == ["no_coverage"]


def test_status_classification_table() -> None:
    """Verifica todas las filas de la tabla status en docs/contracts/harmonization.md."""
    base = BaselineSummary(median=20.0, p25=10.0, p75=30.0, p90=50.0, n_years=15)
    short_base = BaselineSummary(median=20.0, p25=10.0, p75=30.0, p90=50.0, n_years=9)

    assert classify_status(None, base) == "no_data"
    assert classify_status(15.0, None) == "insufficient_baseline"
    assert classify_status(15.0, short_base) == "insufficient_baseline"
    assert classify_status(9.9, base) == "below"
    assert classify_status(10.0, base) == "normal"
    assert classify_status(30.0, base) == "normal"
    assert classify_status(30.1, base) == "above"
    assert classify_status(50.0, base) == "above"
    assert classify_status(50.1, base) == "critical"


def test_basis_modis_vs_viirs_primary_and_baseline_exclusions() -> None:
    """Comprueba modis_primary vs viirs_primary y exclusión de meses con bandera en la línea base."""
    aoi = AoiSummary(preset_id="qro-sierra-gorda", area_km2=14790.2, country="MX")
    counts: dict[MonthKey, MonthlyCounts] = {}
    for y in range(2001, 2026):
        for m in range(1, 13):
            v_days = 40 if (y, m) >= (2012, 1) else 0
            counts[(y, m)] = MonthlyCounts(
                modis_cell_days=10,
                viirs_cell_days=v_days,
                raw_points=50,
            )
    # Hacer que abril 2019 sea extremo
    counts[(2019, 4)] = MonthlyCounts(
        modis_cell_days=80, viirs_cell_days=320, raw_points=1000
    )

    resp_modis = build_calendar_response(
        aoi_summary=aoi,
        start_year=2000,
        end_year=2026,
        basis="modis_primary",
        counts_by_month=counts,
        data_through=date(2025, 12, 31),
    )
    resp_viirs = build_calendar_response(
        aoi_summary=aoi,
        start_year=2000,
        end_year=2026,
        basis="viirs_primary",
        counts_by_month=counts,
        data_through=date(2025, 12, 31),
    )

    assert len(resp_modis.months) == 324
    m_2019_04 = next(
        r for r in resp_modis.months if (r.year, r.month) == (2019, 4)
    )
    assert m_2019_04.source == "modis"
    assert m_2019_04.harmonized == 80.0
    assert m_2019_04.status == "critical"

    v_2019_04 = next(
        r for r in resp_viirs.months if (r.year, r.month) == (2019, 4)
    )
    assert v_2019_04.source == "viirs_scaled"
    assert v_2019_04.harmonized == pytest.approx(80.0, abs=0.2)

    # 2001-06 tiene modis_outage -> no debe contarse en la línea base de otros junios
    junes_valid = [
        r
        for r in resp_modis.months
        if r.month == 6 and r.year == 2015
    ][0]
    # De 2001 a 2025 hay 25 junios; 2001-06 se excluye por modis_outage y 2015-06 se excluye a sí mismo -> 23 años
    assert junes_valid.baseline is not None
    assert junes_valid.baseline.n_years == 23

    # Estacionalidad suma 1.0
    assert sum(resp_modis.seasonality) == pytest.approx(1.0, abs=1e-3)

    # Enero 2012 (inicio S-NPP el 2012-01-20) reporta viirs_cell_days pero usa MODIS en viirs_primary
    m_2012_01 = next(
        r for r in resp_viirs.months if (r.year, r.month) == (2012, 1)
    )
    assert m_2012_01.viirs_cell_days == 40
    assert m_2012_01.source == "modis"


