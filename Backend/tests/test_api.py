"""Pruebas de aceptación de los endpoints FastAPI (docs/contracts/acceptance.md)."""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from Backend.main import app
from Backend.models import AoiInput, ApiException
from Backend.queries import fetch_data_through, resolve_aoi_db


@pytest.fixture(autouse=True)
def enable_mock_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_MOCK", "1")


client = TestClient(app)


def test_health() -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["data_through"] == "2026-11-01"


def test_get_presets_returns_3_regions() -> None:
    res = client.get("/api/v1/presets")
    assert res.status_code == 200
    body = res.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 3
    ids = [f["id"] for f in body["features"]]
    assert ids == ["qro-sierra-gorda", "qro-bajio", "qro-recuadro"]


def test_post_calendar_presets_all_324_months() -> None:
    for pid in ("qro-sierra-gorda", "qro-bajio", "qro-recuadro"):
        res = client.post(
            "/api/v1/calendar",
            json={"aoi": {"preset_id": pid}},
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["months"]) == 324
        assert body["aoi"]["country"] == "MX"
        assert body["unit"] == "modis_equivalent_cell_days"
        if pid == "qro-sierra-gorda":
            assert 0.25 <= body["calibration"]["k"] <= 0.28

    # Mes con no_coverage tiene harmonized = null
    no_cov = [m for m in body["months"] if "no_coverage" in m["flags"]]
    assert no_cov
    for m in no_cov:
        assert m["harmonized"] is None
        assert m["status"] == "no_data"


def test_polygon_in_ocean_returns_422() -> None:
    ocean_poly = {
        "type": "Polygon",
        "coordinates": [
            [
                [-130.0, 0.0],
                [-129.0, 0.0],
                [-129.0, 1.0],
                [-130.0, 1.0],
                [-130.0, 0.0],
            ]
        ],
    }
    res = client.post("/api/v1/calendar", json={"aoi": {"geometry": ocean_poly}})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "aoi_outside_coverage"


def test_polygon_in_argentina_returns_422() -> None:
    ar_poly = {
        "type": "Polygon",
        "coordinates": [
            [
                [-68.3, -29.9],
                [-66.8, -29.9],
                [-66.8, -28.4],
                [-68.3, -28.4],
                [-68.3, -29.9],
            ]
        ],
    }
    res = client.post("/api/v1/calendar", json={"aoi": {"geometry": ar_poly}})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "aoi_outside_coverage"


def test_aoi_too_large_returns_400() -> None:
    huge_poly = {
        "type": "Polygon",
        "coordinates": [
            [
                [-110.0, 18.0],
                [-95.0, 18.0],
                [-95.0, 30.0],
                [-110.0, 30.0],
                [-110.0, 18.0],
            ]
        ],
    }
    res = client.post("/api/v1/calendar", json={"aoi": {"geometry": huge_poly}})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "aoi_too_large"


def test_unknown_preset_returns_404() -> None:
    res = client.post(
        "/api/v1/calendar",
        json={"aoi": {"preset_id": "no-existe"}},
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "unknown_preset"


def test_invalid_range_returns_400() -> None:
    res = client.post(
        "/api/v1/calendar",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "start_year": 2025,
            "end_year": 2010,
        },
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_range"


def test_csv_and_geojson_hotspots_endpoints() -> None:
    res_cal = client.post(
        "/api/v1/calendar.csv",
        json={"aoi": {"preset_id": "qro-sierra-gorda"}},
    )
    assert res_cal.status_code == 200
    assert "text/csv" in res_cal.headers["content-type"]
    assert "burn_calendar_qro-sierra-gorda_2000_2026.csv" in res_cal.headers.get(
        "content-disposition", ""
    )
    lines = res_cal.text.strip().splitlines()
    assert lines[0].startswith("year,month,harmonized,source,raw_points")
    assert len(lines) == 325  # cabecera + 324 meses

    res_hs = client.post(
        "/api/v1/hotspots.csv",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "start_date": "2025-03-01",
            "end_date": "2025-05-31",
        },
    )
    assert res_hs.status_code == 200
    assert "text/csv" in res_hs.headers["content-type"]
    assert res_hs.text.startswith(
        "latitude,longitude,acq_date,acq_time,satellite,family,confidence,frp,daynight,type,source,is_vegetation_fire,cell_id"
    )

    # POST /hotspots GeoJSON (<= 62 días -> 200 OK)
    res_gj = client.post(
        "/api/v1/hotspots",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "start_date": "2025-04-01",
            "end_date": "2025-04-30",
        },
    )
    assert res_gj.status_code == 200
    assert res_gj.json()["type"] == "FeatureCollection"

    # POST /hotspots GeoJSON (> 62 días -> 400 invalid_range)
    res_gj_long = client.post(
        "/api/v1/hotspots",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "start_date": "2025-01-01",
            "end_date": "2025-05-31",
        },
    )
    assert res_gj_long.status_code == 400
    assert res_gj_long.json()["error"]["code"] == "invalid_range"


def test_db_queries_mx_only_and_health_date() -> None:
    """Verifica que fetch_data_through y resolve_aoi_db filtren exclusivamente México (MX)."""
    executed_sql: list[str] = []

    class DummyCursor:
        def __enter__(self) -> DummyCursor:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def execute(self, sql: str, params: object = None) -> None:
            executed_sql.append(sql)

        def fetchone(self) -> tuple[object, ...]:
            last = executed_sql[-1]
            if "ORDER BY d.acq_date DESC" in last:
                assert "c.country = 'MX'" in last
                return (date(2026, 11, 1),)
            if "ST_Area" in last:
                return (15000.0,)
            if "SELECT count(*)" in last:
                assert "cell.country = 'MX'" in last
                return (0,)
            return (None,)

    class DummyConn:
        def cursor(self) -> DummyCursor:
            return DummyCursor()

    conn = DummyConn()
    assert fetch_data_through(conn) == "2026-11-01"  # type: ignore[arg-type]

    ar_poly = {
        "type": "Polygon",
        "coordinates": [
            [
                [-68.3, -29.9],
                [-66.8, -29.9],
                [-66.8, -28.4],
                [-68.3, -28.4],
                [-68.3, -29.9],
            ]
        ],
    }
    with pytest.raises(ApiException) as exc_info:
        resolve_aoi_db(conn, AoiInput(geometry=ar_poly))  # type: ignore[arg-type]
    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "aoi_outside_coverage"
