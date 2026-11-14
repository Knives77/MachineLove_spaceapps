from datetime import date

from etl import reference as r


def test_reference_switches_on_2018_04_01():
    assert r.reference_satellite(date(2018, 3, 31)) == "SNPP"
    assert r.reference_satellite(date(2018, 4, 1)) == "N20"


def test_no_viirs_before_snpp():
    assert r.reference_satellite(date(2011, 12, 31)) is None
    assert r.reference_satellite(date(2012, 1, 20)) == "SNPP"


def test_backup_when_reference_is_down():
    assert r.reference_satellite(date(2019, 5, 1), frozenset({"N20"})) == "SNPP"
    assert r.reference_satellite(date(2024, 6, 1), frozenset({"SNPP"})) == "N20"


def test_n21_when_both_are_down():
    assert r.reference_satellite(date(2024, 6, 1), frozenset({"N20", "SNPP"})) == "N21"
    # N21 aún no operaba: no hay VIIRS ese día.
    assert r.reference_satellite(date(2023, 6, 1), frozenset({"N20", "SNPP"})) is None


def test_before_switch_backup_must_be_operational():
    # S-NPP caído en 2015: NOAA-20 todavía no existía.
    assert r.reference_satellite(date(2015, 6, 1), frozenset({"SNPP"})) is None


def test_after_snpp_end_backup_is_n21():
    assert r.reference_satellite(date(2026, 11, 3), frozenset({"N20"})) == "N21"


def test_expand_outages_inclusive():
    out = r.expand_outages([("SNPP", "MX", date(2024, 5, 30), date(2024, 6, 3))])
    assert len(out) == 5
    assert out[("MX", date(2024, 6, 3))] == frozenset({"SNPP"})


def test_modis_outage_needs_both_satellites_three_days():
    one = r.expand_outages([("Terra", "AR", date(2015, 7, 1), date(2015, 7, 10))])
    assert r.outage_flags("AR", 2015, 7, one) == set()
    both = r.expand_outages([
        ("Terra", "AR", date(2015, 7, 1), date(2015, 7, 3)),
        ("Aqua", "AR", date(2015, 7, 2), date(2015, 7, 4)),
    ])
    assert r.modis_missing_days("AR", 2015, 7, both) == 2
    assert r.outage_flags("AR", 2015, 7, both) == set()
    both = r.expand_outages([
        ("Terra", "AR", date(2015, 7, 1), date(2015, 7, 3)),
        ("Aqua", "AR", date(2015, 7, 1), date(2015, 7, 3)),
    ])
    assert r.outage_flags("AR", 2015, 7, both) == {"modis_outage"}
    assert r.outage_flags("MX", 2015, 7, both) == set()   # por país


def test_readme_months_flag_modis():
    assert "modis_outage" in r.outage_flags("MX", 2007, 8, {})


def test_viirs_outage_only_when_reference_and_backup_missing():
    snpp = r.expand_outages([("SNPP", "MX", date(2024, 5, 30), date(2024, 6, 3))])
    assert r.outage_flags("MX", 2024, 6, snpp) == set()   # después de 2018 N20 es la referencia
    snpp15 = r.expand_outages([("SNPP", "MX", date(2015, 6, 1), date(2015, 6, 3))])
    assert r.outage_flags("MX", 2015, 6, snpp15) == {"viirs_outage"}
    assert r.outage_flags("MX", 2011, 6, {}) == set()      # antes de VIIRS no es caída


def test_months_between():
    ms = r.months_between((2012, 2), (2025, 12))
    assert ms[0] == (2012, 2) and ms[-1] == (2025, 12) and len(ms) == 167
