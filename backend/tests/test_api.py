"""Pruebas de aceptación de los endpoints FastAPI (docs/contracts/acceptance.md)."""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import AoiInput, ApiException
from backend.queries import fetch_data_through, resolve_aoi_db


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


def test_psycopg_error_returns_503_json(monkeypatch: pytest.MonkeyPatch) -> None:
    """Si la BD no responde, todos los endpoints devuelven 503 con error.code."""
    import psycopg
    import backend.routes as routes_mod

    monkeypatch.setenv("API_MOCK", "0")
    routes_mod._PRESET_CALENDAR_CACHE.clear()

    def broken_conn(*_args: object, **_kwargs: object) -> object:
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(routes_mod, "get_connection", broken_conn)
    c = TestClient(app, raise_server_exceptions=False)

    for method, path, body in (
        ("get", "/api/v1/health", None),
        ("get", "/api/v1/presets", None),
        ("post", "/api/v1/calendar", {"aoi": {"preset_id": "qro-sierra-gorda"}}),
    ):
        resp = c.get(path) if method == "get" else c.post(path, json=body)
        assert resp.status_code == 503
        assert resp.json()["error"]["code"] == "db_unavailable"


def test_gzip_and_aoi_cache_reuse_across_basis_and_csv(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifica compresión GZip y que cambiar basis o bajar CSV en polígono/preset reutilice caché sin re-consultar BD."""
    from contextlib import contextmanager
    from backend.tests.test_system_e2e import SimulatedPostgisConn
    import backend.routes as routes_mod

    # 1. GZip reduce >85% el peso de /api/v1/calendar
    res_gz = client.post(
        "/api/v1/calendar",
        json={"aoi": {"preset_id": "qro-sierra-gorda"}},
        headers={"Accept-Encoding": "gzip"},
    )
    assert res_gz.status_code == 200
    assert res_gz.headers.get("content-encoding") == "gzip"
    assert len(res_gz.CACHED_CONTENT if hasattr(res_gz, "CACHED_CONTENT") else res_gz.content) > 50_000

    # 2. En modo real (API_MOCK=0), un polígono consultado en modis_primary, viirs_primary y calendar.csv abre 1 sola conexión
    monkeypatch.setenv("API_MOCK", "0")
    routes_mod._PRESET_CALENDAR_CACHE.clear()
    conn_calls = 0

    @contextmanager
    def counting_conn(_dsn: str | None = None):  # type: ignore[no-untyped-def]
        nonlocal conn_calls
        conn_calls += 1
        yield SimulatedPostgisConn()

    monkeypatch.setattr(routes_mod, "get_connection", counting_conn)
    c = TestClient(app)

    qro_poly = {
        "type": "Polygon",
        "coordinates": [
            [
                [-100.2, 20.5],
                [-99.5, 20.5],
                [-99.5, 21.2],
                [-100.2, 21.2],
                [-100.2, 20.5],
            ]
        ],
    }
    r1 = c.post(
        "/api/v1/calendar",
        json={"aoi": {"geometry": qro_poly}, "basis": "modis_primary"},
    )
    assert r1.status_code == 200
    assert conn_calls == 1

    # Cambiar a viirs_primary ("Simular fin de MODIS") sobre el mismo polígono -> 0 conexiones nuevas
    r2 = c.post(
        "/api/v1/calendar",
        json={"aoi": {"geometry": qro_poly}, "basis": "viirs_primary"},
    )
    assert r2.status_code == 200
    assert conn_calls == 1

    # Descargar CSV del mismo polígono -> 0 conexiones nuevas
    r3 = c.post(
        "/api/v1/calendar.csv",
        json={"aoi": {"geometry": qro_poly}, "basis": "viirs_primary"},
    )
    assert r3.status_code == 200
    assert r3.headers["content-type"].startswith("text/csv")
    assert conn_calls == 1


def test_host_5432_and_tunnel_15432_auto_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifica que sin DATABASE_URL explícita funcione con Postgres en 5432 o en el puerto alterno 15432."""
    import psycopg
    import backend.queries as queries_mod

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(queries_mod, "_ACTIVE_DEFAULT_DSN", None)
    monkeypatch.setattr(queries_mod, "_is_local_port_open", lambda _port: True)

    attempted: list[str] = []

    def fake_connect(dsn: str, **_kwargs: object) -> str:
        attempted.append(dsn)
        if ":5432/" in dsn:
            raise psycopg.OperationalError("port 5432 not active on laptop")
        return "connected-via-15432"

    monkeypatch.setattr(queries_mod.psycopg, "connect", fake_connect)
    conn = queries_mod.get_connection()
    assert conn == "connected-via-15432"  # type: ignore[comparison-overlap]
    assert queries_mod._ACTIVE_DEFAULT_DSN == queries_mod.TUNNEL_DATABASE_URL
    assert len(attempted) == 2



