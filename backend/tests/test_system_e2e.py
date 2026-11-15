"""Pruebas de sistema extremo a extremo (API_MOCK=0) simulando las cifras reales de acceptance.md."""
from __future__ import annotations

import csv
import io
from contextlib import contextmanager
from datetime import date
from typing import Any, Iterator

import pytest
from fastapi.testclient import TestClient

import backend.queries as queries_mod
import backend.routes as routes_mod
from backend.main import app

# Cifras anuales reales de docs/contracts/acceptance.md para Sierra Gorda y Recuadro Querétaro
SIERRA_GORDA_ANNUAL: dict[int, tuple[int, int, int]] = {
    # año: (modis_cell_days, viirs_cell_days, raw_points)
    2001: (110, 0, 120),
    2002: (115, 0, 125),
    2003: (117, 0, 130),
    2004: (108, 0, 118),
    2005: (122, 0, 135),
    2006: (104, 0, 112),
    2007: (112, 0, 121),
    2008: (98, 0, 108),
    2009: (105, 0, 115),
    2010: (101, 0, 110),
    2011: (167, 0, 175),
    2012: (83, 363, 565),
    2013: (128, 490, 1450),
    2014: (119, 455, 1380),
    2015: (95, 360, 1120),
    2016: (109, 415, 1290),
    2017: (99, 387, 1210),
    2018: (114, 435, 1650),
    2019: (154, 563, 2168),
    2020: (102, 390, 1540),
    2021: (121, 460, 1810),
    2022: (116, 442, 1760),
    2023: (125, 478, 1920),
    2024: (120, 332, 1490),
    2025: (115, 389, 1720),
    2026: (96, 360, 1210),
}

WEIGHTS_12 = [0.03, 0.06, 0.16, 0.27, 0.25, 0.08, 0.03, 0.02, 0.01, 0.01, 0.03, 0.05]


def _distribute_year(total: int) -> list[int]:
    if total == 0:
        return [0] * 12
    vals = [int(round(total * w)) for w in WEIGHTS_12]
    diff = total - sum(vals)
    vals[3] += diff  # ajustar en abril (mes pico)
    return vals


def _build_monthly_db_rows() -> list[tuple[date, int, int, int]]:
    rows: list[tuple[date, int, int, int]] = []
    # Nov-Dic 2000
    rows.append((date(2000, 11, 1), 5, 0, 6))
    rows.append((date(2000, 12, 1), 7, 0, 8))
    for y, (m_tot, v_tot, r_tot) in sorted(SIERRA_GORDA_ANNUAL.items()):
        m_list = _distribute_year(m_tot)
        v_list = _distribute_year(v_tot)
        r_list = _distribute_year(r_tot)
        for m in range(1, 13):
            if y == 2026 and m > 10:
                if m == 11:
                    rows.append((date(2026, 11, 1), 2, 7, 15))
                continue
            v_val = 0 if (y, m) < (2012, 2) else v_list[m - 1]
            rows.append((date(y, m, 1), m_list[m - 1], v_val, r_list[m - 1]))
    return rows


class SimulatedPostgisCursor:
    """Simula respuestas de PostgreSQL + PostGIS con las cifras reales del proyecto."""

    def __init__(self, geojson_state: dict[str, Any]) -> None:
        self._state = geojson_state
        self._last_sql = ""
        self._last_params: Any = None

    def __enter__(self) -> SimulatedPostgisCursor:
        return self

    def __exit__(self, *args: object) -> None:
        pass

    def execute(self, sql: str, params: Any = None) -> None:
        self._last_sql = " ".join(sql.split())
        self._last_params = params

    def fetchone(self) -> tuple[Any, ...] | None:
        sql = self._last_sql
        params = self._last_params or {}

        # 1. /health y data_through -> debe filtrar MX y devolver 2026-11-01
        if "FROM cell_day d" in sql and "ORDER BY d.acq_date DESC" in sql:
            assert "c.country = 'MX'" in sql
            return (date(2026, 11, 1),)

        # 2. preset por id
        if "FROM preset WHERE id =" in sql:
            pid = params.get("preset_id")
            if pid == "qro-sierra-gorda":
                return (
                    '{"type":"Polygon","coordinates":[[[-100.6,20.9],[-99.0,20.9],[-99.0,21.7],[-100.6,21.7],[-100.6,20.9]]]}',
                    14790.2,
                )
            if pid == "qro-bajio":
                return (
                    '{"type":"Polygon","coordinates":[[[-100.6,20.0],[-99.0,20.0],[-99.0,20.9],[-100.6,20.9],[-100.6,20.0]]]}',
                    16780.5,
                )
            # Simular que qro-recuadro aún no estaba insertado en tabla preset para probar el fallback PostGIS
            return None

        # 3. ST_Area
        if "SELECT ST_Area(" in sql:
            gj = str(params.get("geojson", ""))
            if "-95.0" in gj and "30.0" in gj:
                return (1_500_000.0,)
            return (31570.7,)

        # 4. Conteo de celdas MX dentro del polígono
        if "SELECT count(*) AS n FROM cell, aoi" in sql:
            assert "cell.country = 'MX'" in sql
            gj = str(params.get("geojson", ""))
            # Si el polígono está en Querétaro (-100.x, 20.x), tiene celdas MX; en Argentina o el océano, 0
            if "-100." in gj or "-99." in gj:
                return (1480,)
            return (0,)

        # 5. calibration_country
        if "SELECT k FROM calibration_country" in sql:
            return (0.332,)

        # 6. check_hotspots_limit
        if "SELECT coalesce(sum(d.raw_points), 0) FROM cell_day" in sql:
            return (25,)

        return None

    def fetchall(self) -> list[tuple[Any, ...]]:
        sql = self._last_sql
        # 1. Tabla preset (simulando que en la BD solo estaban sierra-gorda y bajio)
        if "FROM preset WHERE country = 'MX'" in sql:
            return [
                (
                    "qro-sierra-gorda",
                    "Sierra Gorda, Querétaro",
                    "Sierra Gorda, Querétaro",
                    "MX",
                    '{"type":"Polygon","coordinates":[[[-100.6,20.9],[-99.0,20.9],[-99.0,21.7],[-100.6,21.7],[-100.6,20.9]]]}',
                ),
                (
                    "qro-bajio",
                    "Bajío queretano",
                    "Querétaro lowlands (Bajío)",
                    "MX",
                    '{"type":"Polygon","coordinates":[[[-100.6,20.0],[-99.0,20.0],[-99.0,20.9],[-100.6,20.9],[-100.6,20.0]]]}',
                ),
            ]

        # 2. Meses NRT
        if "FROM detection WHERE acq_date >= '2026-01-01'" in sql:
            return [(2026, 9), (2026, 10), (2026, 11)]

        # 3. Consulta central sobre cell_day
        if "SELECT date_trunc('month', d.acq_date)::date AS month" in sql:
            assert "cell.country = 'MX'" in sql
            return _build_monthly_db_rows()

        # 4. sensor_outage
        if "FROM sensor_outage" in sql:
            return [
                ("SNPP", "MX", date(2024, 5, 30), date(2024, 6, 3), "detected"),
                ("SNPP", "MX", date(2026, 7, 11), date(2026, 7, 16), "detected"),
            ]

        # 5. /hotspots GeoJSON
        if "SELECT d.longitude, d.latitude, d.acq_date" in sql:
            return [
                (-99.52, 21.15, date(2025, 4, 14), "N20", "VIIRS", 14.8, True),
                (-99.48, 21.18, date(2025, 4, 15), "Terra", "MODIS", 32.1, True),
            ]

        return []

    def __iter__(self) -> Iterator[tuple[Any, ...]]:
        # Para el cursor en streaming de /hotspots.csv
        yield (
            21.15,
            -99.52,
            date(2025, 4, 14),
            "0742",
            "N20",
            "VIIRS",
            "n",
            14.8,
            "N",
            0,
            "country",
            True,
            2115,
            -9952,
        )


class SimulatedPostgisConn:
    def __enter__(self) -> SimulatedPostgisConn:
        return self

    def __exit__(self, *args: object) -> None:
        pass

    def cursor(self, name: str | None = None) -> SimulatedPostgisCursor:
        return SimulatedPostgisCursor({})


@pytest.fixture()
def real_system_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Desactiva API_MOCK y conecta los endpoints al simulador PostGIS con cifras reales."""
    monkeypatch.setenv("API_MOCK", "0")
    routes_mod._PRESET_CALENDAR_CACHE.clear()

    @contextmanager
    def fake_get_conn(dsn: str | None = None) -> Iterator[SimulatedPostgisConn]:
        yield SimulatedPostgisConn()

    monkeypatch.setattr(routes_mod, "get_connection", fake_get_conn)
    monkeypatch.setattr(queries_mod, "get_connection", fake_get_conn)
    monkeypatch.setattr(
        queries_mod.psycopg,
        "connect",
        lambda *a, **kw: SimulatedPostgisConn(),
    )
    return TestClient(app)


def test_real_system_full_workflow(real_system_client: TestClient) -> None:
    """Simula el recorrido completo que hacen el Frontend y el Analista contra el Backend."""
    # 1. GET /api/v1/health -> data_through = 2026-11-01 (México)
    r_health = real_system_client.get("/api/v1/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "ok", "data_through": "2026-11-01"}

    # 2. GET /api/v1/presets -> 3 regiones de México incluso si qro-recuadro no estaba en la tabla preset
    r_presets = real_system_client.get("/api/v1/presets")
    assert r_presets.status_code == 200
    presets = r_presets.json()["features"]
    assert [f["id"] for f in presets] == [
        "qro-sierra-gorda",
        "qro-bajio",
        "qro-recuadro",
    ]

    # 3. POST /api/v1/calendar con qro-sierra-gorda (modis_primary)
    r_cal = real_system_client.post(
        "/api/v1/calendar",
        json={"aoi": {"preset_id": "qro-sierra-gorda"}},
    )
    assert r_cal.status_code == 200
    cal = r_cal.json()
    assert len(cal["months"]) == 324
    assert 0.25 <= cal["calibration"]["k"] <= 0.28
    assert cal["calibration"]["scope"] == "aoi"

    # Verificar que el salto crudo (>5x) desaparece en armonizado (<1.5x) entre 2011 y 2019
    y_2011 = next(y for y in cal["years"] if y["year"] == 2011)
    y_2019 = next(y for y in cal["years"] if y["year"] == 2019)
    raw_ratio = y_2019["raw_points"] / y_2011["raw_points"]
    harm_ratio = y_2019["harmonized"] / y_2011["harmonized"]
    assert raw_ratio > 5.0  # 2168 / 175 = 12.39x
    assert harm_ratio < 1.5  # 154 / 167 = 0.92x

    # Verificar los 11 meses sin cobertura (ene-oct 2000 + dic 2026)
    no_data_months = [
        (m["year"], m["month"])
        for m in cal["months"]
        if m["status"] == "no_data"
    ]
    # nov-2026 es partial_month (solo el día 1) -> no_data por harmonization.md
    expected_no_data = [(2000, m) for m in range(1, 11)] + [(2026, 11), (2026, 12)]
    assert no_data_months == expected_no_data

    # Verificar banderas nrt y partial_month en nov 2026
    m_2026_11 = next(
        m for m in cal["months"] if (m["year"], m["month"]) == (2026, 11)
    )
    assert "nrt" in m_2026_11["flags"]
    assert "partial_month" in m_2026_11["flags"]
    assert m_2026_11["anomaly_ratio"] is None
    assert cal["latest"] == {"year": 2026, "month": 10}

    # 4. POST /api/v1/calendar con basis = viirs_primary (continuidad tras fin de MODIS)
    r_viirs = real_system_client.post(
        "/api/v1/calendar",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "basis": "viirs_primary",
        },
    )
    assert r_viirs.status_code == 200
    cal_viirs = r_viirs.json()
    diffs = []
    for ym_mod, ym_vir in zip(cal["years"], cal_viirs["years"]):
        if 2012 <= ym_mod["year"] <= 2025:
            diff = abs(ym_vir["harmonized"] - ym_mod["harmonized"]) / ym_mod["harmonized"]
            diffs.append(diff)
    diffs.sort()
    median_diff = diffs[len(diffs) // 2]
    assert median_diff < 0.20

    # 5. Polígono libre en Querétaro -> 200 OK; en Argentina -> 422; en Océano -> 422
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
    r_qro_poly = real_system_client.post(
        "/api/v1/calendar", json={"aoi": {"geometry": qro_poly}}
    )
    assert r_qro_poly.status_code == 200
    assert "preset_id" not in r_qro_poly.json()["aoi"]

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
    r_ar = real_system_client.post(
        "/api/v1/calendar", json={"aoi": {"geometry": ar_poly}}
    )
    assert r_ar.status_code == 422
    assert r_ar.json()["error"]["code"] == "aoi_outside_coverage"

    # 6. Descarga de /hotspots.csv y /hotspots GeoJSON en modo real
    r_csv = real_system_client.post(
        "/api/v1/hotspots.csv",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "start_date": "2025-03-01",
            "end_date": "2025-05-31",
        },
    )
    assert r_csv.status_code == 200
    reader = list(csv.DictReader(io.StringIO(r_csv.text)))
    assert len(reader) == 1
    assert reader[0]["satellite"] == "N20"
    assert reader[0]["cell_id"] == "2115_-9952"

    r_gj = real_system_client.post(
        "/api/v1/hotspots",
        json={
            "aoi": {"preset_id": "qro-sierra-gorda"},
            "start_date": "2025-04-01",
            "end_date": "2025-04-30",
        },
    )
    assert r_gj.status_code == 200
    gj = r_gj.json()
    assert gj["type"] == "FeatureCollection"
    assert len(gj["features"]) == 2
    assert gj["features"][0]["properties"]["satellite"] == "N20"

