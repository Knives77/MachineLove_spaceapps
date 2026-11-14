import pytest

from etl import calibrate as c


def test_k_is_ratio_of_sums_over_used_months():
    series = {(2012, 2): (30, 100), (2012, 3): (10, 50), (2013, 1): (999, 1)}
    cal = c.calibrate(series, [(2012, 2), (2012, 3)])
    assert cal.k == pytest.approx(40 / 150)
    assert (cal.overlap_months, cal.modis_cell_days, cal.viirs_cell_days) == (2, 40, 150)


def test_missing_months_count_as_zero():
    cal = c.calibrate({(2012, 2): (30, 100)}, [(2012, 2), (2012, 3)])
    assert cal.overlap_months == 2 and cal.k == pytest.approx(0.3)


def test_loyo_skips_small_years_and_matches_hand_calculation():
    series = {(2012, 6): (30, 100), (2013, 6): (40, 100), (2014, 6): (5, 100)}
    cal = c.calibrate(series, list(series))
    # 2014 tiene M < 20: no se valida. 2012: k sin 2012 = 45/200; 2013: k sin 2013 = 35/200.
    e12 = abs(45 / 200 * 100 - 30) / 30
    e13 = abs(35 / 200 * 100 - 40) / 40
    assert cal.loyo_annual_mape == pytest.approx((e12 + e13) / 2)
    assert cal.loyo_annual_max == pytest.approx(max(e12, e13))


def test_monthly_mape_only_months_with_ten_modis():
    series = {(2012, 6): (10, 40), (2012, 7): (9, 90)}
    cal = c.calibrate(series, list(series))
    k = 19 / 130
    assert cal.monthly_mape == pytest.approx(abs(k * 40 - 10) / 10)


def test_single_year_has_no_loyo():
    assert c.calibrate({(2019, 1): (30, 100)}, [(2019, 1)]).loyo_annual_mape is None


def test_no_viirs_raises():
    with pytest.raises(ValueError):
        c.calibrate({(2012, 2): (30, 0)}, [(2012, 2)])
