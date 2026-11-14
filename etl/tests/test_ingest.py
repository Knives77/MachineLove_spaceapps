from datetime import date
from pathlib import Path

import polars as pl

from etl import ingest

A_VIIRS = {  # formato fuente A (por país): bright_ti4/ti5, satélite "N"
    "latitude": ["20.95"], "longitude": ["-99.005"], "bright_ti4": ["310.9"], "scan": ["0.32"],
    "track": ["0.55"], "acq_date": ["2015-01-01"], "acq_time": ["0055"], "satellite": ["N"],
    "instrument": ["VIIRS"], "confidence": ["n"], "version": ["2"], "bright_ti5": ["279.7"],
    "frp": ["1.48"], "daynight": ["N"], "type": ["0"],
}
NRT_MODIS = {  # formato NRT: sin type
    "latitude": ["-28.9"], "longitude": ["-67.5"], "brightness": ["310.1"], "scan": ["2.38"],
    "track": ["1.49"], "acq_date": ["2026-09-01"], "acq_time": ["0211"], "satellite": ["Terra"],
    "instrument": ["MODIS"], "confidence": ["79"], "version": ["6.1NRT"], "bright_t31": ["291.4"],
    "frp": ["27.66"], "daynight": ["N"],
}


def test_source_a_viirs_is_normalized():
    out = ingest.normalize(pl.DataFrame(A_VIIRS), "MX", "country").row(0, named=True)
    assert out["satellite"] == "SNPP"
    assert out["family"] == "VIIRS"
    assert out["acq_time"] == "0055"
    assert out["acq_ts"] == "2015-01-01 00:55:00+00"
    assert out["is_veg"] is True
    assert (out["cy"], out["cx"]) == (2095, -9901)  # floor de negativo baja


def test_nrt_without_type():
    out = ingest.normalize(pl.DataFrame(NRT_MODIS), "AR", "nrt").row(0, named=True)
    assert out["type"] is None
    assert out["is_veg"] is True
    assert out["family"] == "MODIS"
    assert out["confidence_raw"] == "79"
    assert (out["cy"], out["cx"]) == (-2890, -6750)


def test_static_type_is_not_veg():
    row = dict(A_VIIRS, type=["2"])
    assert ingest.normalize(pl.DataFrame(row), "MX", "country")["is_veg"][0] is False


def test_columns_match_contract():
    assert ingest.normalize(pl.DataFrame(NRT_MODIS), "AR", "nrt").columns == ingest.DETECTION_COLUMNS


def test_window_precedence():
    df = pl.DataFrame({
        "acq_date": [date(2025, 12, 31), date(2026, 1, 1), date(2024, 5, 1)],
        "satellite": ["N20", "N20", "N21"],
    })
    assert ingest.apply_window(df, "country").height == 2           # todo <= 2025
    req = ingest.apply_window(df, "archive")
    assert req["acq_date"].to_list() == [date(2026, 1, 1), date(2024, 5, 1)]  # 2026 + N21 completo


def test_request_dirs_are_recognized():
    assert ingest._country_of_request_dir("México-Querétaro") == "MX"
    assert ingest._country_of_request_dir("Argentina") == "AR"
    assert ingest._country_of_request_dir("profiling") is None


def test_discover_on_real_data():
    files = ingest.discover(Path(ingest.config.DATA_DIR))
    kinds = {(f.country, f.source) for f in files}
    assert {("MX", "country"), ("MX", "archive"), ("MX", "nrt"), ("AR", "country"), ("AR", "archive")} <= kinds
