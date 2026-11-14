from datetime import date

from etl import outages


def d(s: str) -> date:
    return date.fromisoformat(s)


def test_to_ranges_groups_consecutive_days():
    days = [d("2024-05-31"), d("2024-05-30"), d("2024-06-01"), d("2024-06-05")]
    assert outages.to_ranges(days) == [(d("2024-05-30"), d("2024-06-01")), (d("2024-06-05"), d("2024-06-05"))]


def test_detected_gap_inside_data_window():
    present = {("N20", "MX"): {d("2018-04-01"), d("2018-04-02"), d("2018-04-05")}}
    rows = outages.compute(present)
    assert ("N20", "MX", d("2018-04-03"), d("2018-04-04"), "detected") in rows


def test_coverage_before_first_file_and_after_last():
    # N21 opera desde 2024-01-17 pero solo tenemos archivos de 2026.
    present = {("N21", "AR"): {d("2026-01-01"), d("2026-11-14")}}
    rows = outages.compute(present)
    cov = [(r[2], r[3]) for r in rows if r[4] == "coverage"]
    assert (d("2024-01-17"), d("2025-12-31")) in cov
    assert (d("2026-11-15"), d("2026-12-31")) in cov


def test_snpp_ends_at_operational_end():
    present = {("SNPP", "MX"): {d("2026-11-01")}, ("SNPP", "AR"): {d("2026-11-02")}}
    cov = {(r[1], r[3]) for r in outages.compute(present) if r[4] == "coverage" and r[3] >= d("2026-11-02")}
    assert ("MX", d("2026-11-02")) in cov          # falta el último día operativo
    assert all(c != "AR" for c, _ in cov)          # AR llega justo al cese


def test_readme_gap_for_each_country():
    rows = outages.compute({("Terra", "MX"): {d("2009-04-20")}, ("Terra", "AR"): {d("2009-04-20")}})
    readme = {(r[0], r[1]) for r in rows if r[4] == "firms_readme"}
    assert {("Terra", "MX"), ("Terra", "AR"), ("Aqua", "MX"), ("Aqua", "AR")} <= readme
