"""Consultas SQL sobre PostgreSQL + PostGIS para los endpoints de la API."""
from __future__ import annotations

import json
import os
import socket
import time
from datetime import date
from typing import Iterator

import psycopg
from shapely.geometry import box, mapping

from backend.aoi import (
    BUILTIN_PRESETS,
    MAX_AREA_KM2,
    ResolvedAoi,
    detect_country_from_bbox,
    parse_and_validate_polygon,
    resolve_aoi_offline,
)
from backend.harmonize import MonthKey, MonthlyCounts, OutageInterval
from backend.models import (
    AoiInput,
    ApiException,
    Country,
    GeoJSONPoint,
    GeoJSONPolygon,
    HotspotCollection,
    HotspotFeature,
    HotspotProperties,
    PresetCollection,
    PresetFeature,
    PresetProperties,
)

HOST_DATABASE_URL = "postgresql://firms:firms_local@127.0.0.1:5432/firms"
TUNNEL_DATABASE_URL = "postgresql://firms:firms_local@127.0.0.1:15432/firms"
DATABASE_URL = os.environ.get("DATABASE_URL", HOST_DATABASE_URL)
_ACTIVE_DEFAULT_DSN: str | None = None

MAX_HOTSPOTS_ROWS = 2_000_000
MAX_HOTSPOTS_GEOJSON_ROWS = 20_000
MAX_HOTSPOTS_GEOJSON_DAYS = 62

COUNTRY_METADATA_TTL_SECONDS = 300.0
_COUNTRY_METADATA_CACHE: dict[
    tuple[str, type],
    tuple[float, set[MonthKey], list[OutageInterval], float | None, date],
] = {}


def _is_local_port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.05):
            return True
    except OSError:
        return False


def resolve_database_url(dsn: str | None = None) -> str:
    """Devuelve DATABASE_URL activa (explícita, descubierta en 5432 anfitrión o 15432 túnel)."""
    if dsn:
        return dsn
    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        return env_url
    if _ACTIVE_DEFAULT_DSN is not None:
        return _ACTIVE_DEFAULT_DSN
    if _is_local_port_open(5432):
        return HOST_DATABASE_URL
    if _is_local_port_open(15432):
        return TUNNEL_DATABASE_URL
    return HOST_DATABASE_URL


def get_connection(dsn: str | None = None) -> psycopg.Connection:
    """Abre conexión a PostgreSQL; sin DATABASE_URL explícita prueba 5432 (host) y 15432 (túnel)."""
    global _ACTIVE_DEFAULT_DSN
    env_url = os.environ.get("DATABASE_URL")
    if dsn or env_url:
        target = dsn or env_url or HOST_DATABASE_URL
        return psycopg.connect(target)

    candidates: list[str] = []
    if _ACTIVE_DEFAULT_DSN is not None:
        candidates.append(_ACTIVE_DEFAULT_DSN)
    for url, port in ((HOST_DATABASE_URL, 5432), (TUNNEL_DATABASE_URL, 15432)):
        if url not in candidates and _is_local_port_open(port):
            candidates.append(url)
    for url in (HOST_DATABASE_URL, TUNNEL_DATABASE_URL):
        if url not in candidates:
            candidates.append(url)

    last_exc: Exception | None = None
    for candidate in candidates:
        try:
            conn = psycopg.connect(candidate, connect_timeout=2)
            _ACTIVE_DEFAULT_DSN = candidate
            return conn
        except psycopg.OperationalError as exc:
            last_exc = exc
            continue
    assert last_exc is not None
    raise last_exc


def fetch_data_through(conn: psycopg.Connection) -> str:
    """Obtiene la última fecha disponible para México (MVP) en cell_day o detection."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT d.acq_date
            FROM cell_day d
            JOIN cell c USING (cy, cx)
            WHERE c.country = 'MX' AND d.cy > 0
            ORDER BY d.acq_date DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if row and row[0] is not None:
            return row[0].isoformat()
        cur.execute(
            """
            SELECT acq_date
            FROM detection
            WHERE country = 'MX'
            ORDER BY acq_date DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if row and row[0] is not None:
            return row[0].isoformat()
    raise ApiException(503, "no_data", "No Mexico data found in database")


def fetch_presets(conn: psycopg.Connection) -> PresetCollection:
    """Devuelve la colección GeoJSON de las 3 regiones predefinidas de México (MVP)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name_es, name_en, country, ST_AsGeoJSON(geom)
            FROM preset
            WHERE country = 'MX'
              AND id IN ('qro-sierra-gorda', 'qro-bajio', 'qro-recuadro')
            """
        )
        rows = {r[0]: r for r in cur.fetchall()}

    order = ("qro-sierra-gorda", "qro-bajio", "qro-recuadro")
    features: list[PresetFeature] = []
    for pid in order:
        if pid in rows:
            _, name_es, name_en, _, geojson_str = rows[pid]
            geom_dict = json.loads(geojson_str)
        else:
            info = BUILTIN_PRESETS[pid]
            name_es = info["name_es"]
            name_en = info["name_en"]
            minx, miny, maxx, maxy = info["bbox"]
            geom_raw = mapping(box(minx, miny, maxx, maxy))
            geom_dict = {
                "type": "Polygon",
                "coordinates": [[list(pt) for pt in geom_raw["coordinates"][0]]],
            }
        features.append(
            PresetFeature(
                id=pid,
                properties=PresetProperties(
                    name_es=name_es,
                    name_en=name_en,
                    country="MX",
                ),
                geometry=GeoJSONPolygon(**geom_dict),
            )
        )
    return PresetCollection(features=features)


def resolve_aoi_db(conn: psycopg.Connection, aoi: AoiInput) -> ResolvedAoi:
    """Resuelve y valida preset_id o geometry usando PostGIS (MVP: solo México)."""
    if aoi.preset_id is not None:
        if aoi.preset_id not in BUILTIN_PRESETS:
            raise ApiException(
                404,
                "unknown_preset",
                f"Unknown preset_id: '{aoi.preset_id}'",
            )
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ST_AsGeoJSON(geom),
                       ST_Area(geom::geography) / 1e6
                FROM preset
                WHERE id = %(preset_id)s AND country = 'MX'
                """,
                {"preset_id": aoi.preset_id},
            )
            row = cur.fetchone()
            if row is not None:
                geojson_str, area_km2 = row
                poly = parse_and_validate_polygon(json.loads(geojson_str))
            else:
                offline = resolve_aoi_offline(aoi)
                poly = offline.polygon
                geojson_str = offline.geojson_str
                cur.execute(
                    """
                    SELECT ST_Area(
                        ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326)::geography
                    ) / 1e6
                    """,
                    {"geojson": geojson_str},
                )
                area_row = cur.fetchone()
                area_km2 = (
                    float(area_row[0])
                    if area_row and area_row[0] is not None
                    else offline.area_km2
                )
        return ResolvedAoi(
            preset_id=aoi.preset_id,
            polygon=poly,
            geojson_str=geojson_str,
            area_km2=float(area_km2),
            country="MX",
        )

    assert aoi.geometry is not None
    poly = parse_and_validate_polygon(aoi.geometry)
    geojson_str = json.dumps(aoi.geometry)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ST_Area(
                ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326)::geography
            ) / 1e6
            """,
            {"geojson": geojson_str},
        )
        area_row = cur.fetchone()
        area_km2 = float(area_row[0]) if area_row and area_row[0] is not None else 0.0

        if area_km2 > MAX_AREA_KM2:
            raise ApiException(
                400,
                "aoi_too_large",
                f"AOI area ({area_km2:,.1f} km²) exceeds maximum of {MAX_AREA_KM2:,.0f} km²",
            )

        # MVP solo México: contar celdas de México dentro del polígono
        cur.execute(
            """
            WITH aoi AS (
                SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g
            )
            SELECT count(*) AS n
            FROM cell, aoi
            WHERE cell.country = 'MX'
              AND ST_Intersects(cell.geom, aoi.g)
            """,
            {"geojson": geojson_str},
        )
        c_row = cur.fetchone()

        if c_row and c_row[0] and int(c_row[0]) > 0:
            country: Country = "MX"
        else:
            country = detect_country_from_bbox(poly)
            cur.execute(
                """
                WITH aoi AS (
                    SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g
                )
                SELECT count(*) AS nearby
                FROM cell, aoi
                WHERE cell.country = 'MX'
                  AND cell.geom && ST_Expand(aoi.g, 0.15)
                  AND ST_DWithin(cell.geom, aoi.g, 0.15)
                """,
                {"geojson": geojson_str},
            )
            near_row = cur.fetchone()
            if not (near_row and near_row[0] and int(near_row[0]) > 0):
                raise ApiException(
                    422,
                    "aoi_outside_coverage",
                    "The requested AOI does not intersect Mexico coverage",
                )

    return ResolvedAoi(
        preset_id=None,
        polygon=poly,
        geojson_str=geojson_str,
        area_km2=area_km2,
        country=country,
    )


def fetch_calendar_inputs(
    conn: psycopg.Connection,
    resolved_aoi: ResolvedAoi,
) -> tuple[
    dict[MonthKey, MonthlyCounts],
    list[OutageInterval],
    float | None,
    date,
]:
    """Ejecuta la consulta central de /calendar (2000..2026) y metadatos de calibración/caídas."""
    counts: dict[MonthKey, MonthlyCounts] = {}
    meta_key = (resolved_aoi.country, type(conn))
    now = time.monotonic()
    cached_meta = _COUNTRY_METADATA_CACHE.get(meta_key)

    with conn.cursor() as cur:
        if (
            cached_meta is not None
            and (now - cached_meta[0]) < COUNTRY_METADATA_TTL_SECONDS
        ):
            _, nrt_months, outages, country_k, data_through = cached_meta
        else:
            # 1. Meses con datos NRT en México (usando índice detection_date)
            cur.execute(
                """
                SELECT DISTINCT
                    extract(year FROM acq_date)::int,
                    extract(month FROM acq_date)::int
                FROM detection
                WHERE acq_date >= '2026-01-01'
                  AND country = %(country)s
                  AND source = 'nrt'
                """,
                {"country": resolved_aoi.country},
            )
            nrt_months = {(r[0], r[1]) for r in cur.fetchall()}

        # 2. Consulta central de /calendar sobre cell_day (siempre 2000-01-01 a 2027-01-01, filtrando cell.country = 'MX')
        cur.execute(
            """
            WITH aoi AS (
                SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g
            ),
            c AS (
                SELECT cy, cx
                FROM cell, aoi
                WHERE cell.country = 'MX'
                  AND ST_Intersects(cell.geom, aoi.g)
            )
            SELECT date_trunc('month', d.acq_date)::date AS month,
                   count(*) FILTER (WHERE d.modis_veg) AS modis_cell_days,
                   count(*) FILTER (WHERE d.viirs_veg) AS viirs_cell_days,
                   coalesce(sum(d.raw_points), 0)      AS raw_points
            FROM cell_day d
            JOIN c USING (cy, cx)
            WHERE d.acq_date >= %(start)s AND d.acq_date < %(end)s
            GROUP BY 1
            ORDER BY 1
            """,
            {
                "geojson": resolved_aoi.geojson_str,
                "start": date(2000, 1, 1),
                "end": date(2027, 1, 1),
            },
        )
        for m_date, modis_cd, viirs_cd, raw_pts in cur.fetchall():
            ym = (m_date.year, m_date.month)
            counts[ym] = MonthlyCounts(
                modis_cell_days=int(modis_cd or 0),
                viirs_cell_days=int(viirs_cd or 0),
                raw_points=int(raw_pts or 0),
                has_nrt=(ym in nrt_months),
            )

        for ym in nrt_months:
            if ym not in counts:
                counts[ym] = MonthlyCounts(has_nrt=True)

        if (
            cached_meta is None
            or (now - cached_meta[0]) >= COUNTRY_METADATA_TTL_SECONDS
        ):
            # 3. Caídas de sensor del país
            cur.execute(
                """
                SELECT satellite, trim(country), start_date, end_date, origin
                FROM sensor_outage
                WHERE country = %(country)s
                ORDER BY start_date
                """,
                {"country": resolved_aoi.country},
            )
            outages = [
                OutageInterval(
                    satellite=r[0],
                    country=r[1],
                    start_date=r[2],
                    end_date=r[3],
                    origin=r[4],
                )
                for r in cur.fetchall()
            ]

            # 4. Factor k de respaldo por país
            cur.execute(
                "SELECT k FROM calibration_country WHERE country = %(country)s",
                {"country": resolved_aoi.country},
            )
            cal_row = cur.fetchone()
            country_k = (
                float(cal_row[0])
                if cal_row and cal_row[0] is not None
                else None
            )

            # 5. Fecha tope de datos para México (MVP)
            cur.execute(
                """
                SELECT d.acq_date
                FROM cell_day d
                JOIN cell c USING (cy, cx)
                WHERE c.country = 'MX' AND d.cy > 0
                ORDER BY d.acq_date DESC
                LIMIT 1
                """,
            )
            max_row = cur.fetchone()
            data_through = (
                max_row[0]
                if max_row and max_row[0] is not None
                else date(2026, 11, 1)
            )
            _COUNTRY_METADATA_CACHE[meta_key] = (
                now,
                nrt_months,
                outages,
                country_k,
                data_through,
            )

    return counts, outages, country_k, data_through


HOTSPOTS_CSV_HEADER = (
    "latitude,longitude,acq_date,acq_time,satellite,family,"
    "confidence,frp,daynight,type,source,is_vegetation_fire,cell_id\n"
)


def check_hotspots_limit(
    conn: psycopg.Connection,
    resolved_aoi: ResolvedAoi,
    start_date: date,
    end_date: date,
    max_rows: int = MAX_HOTSPOTS_ROWS,
) -> None:
    """Verifica que el total de puntos en el rango no supere max_rows."""
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH aoi AS (
                SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g
            ),
            c AS (
                SELECT cy, cx
                FROM cell, aoi
                WHERE cell.country = 'MX'
                  AND ST_Intersects(cell.geom, aoi.g)
            )
            SELECT coalesce(sum(d.raw_points), 0)
            FROM cell_day d
            JOIN c USING (cy, cx)
            WHERE d.acq_date >= %(start_date)s
              AND d.acq_date <= %(end_date)s
            """,
            {
                "geojson": resolved_aoi.geojson_str,
                "start_date": start_date,
                "end_date": end_date,
            },
        )
        row = cur.fetchone()
        est_rows = int(row[0] or 0) if row else 0
        if est_rows > max_rows:
            raise ApiException(
                400,
                "aoi_too_large",
                f"Requested hotspots ({est_rows:,}) exceed maximum of {max_rows:,} rows",
            )


def stream_hotspots_csv(
    dsn: str | None,
    resolved_aoi: ResolvedAoi,
    start_date: date,
    end_date: date,
) -> Iterator[str]:
    """Generador streaming que consulta detection con un cursor de servidor."""
    yield HOTSPOTS_CSV_HEADER

    with get_connection(dsn) as conn:
        with conn.cursor(name="hotspots_stream_cursor") as cur:
            cur.itersize = 2000
            cur.execute(
                """
                WITH aoi AS (
                    SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g
                ),
                c AS (
                    SELECT cy, cx
                    FROM cell, aoi
                    WHERE cell.country = 'MX'
                      AND ST_Intersects(cell.geom, aoi.g)
                )
                SELECT d.latitude,
                       d.longitude,
                       d.acq_date,
                       d.acq_time,
                       d.satellite,
                       d.family,
                       d.confidence_raw,
                       d.frp,
                       d.daynight,
                       d.type,
                       d.source,
                       d.is_veg,
                       d.cy,
                       d.cx
                FROM detection d
                JOIN c USING (cy, cx)
                CROSS JOIN aoi
                WHERE d.country = 'MX'
                  AND d.acq_date >= %(start_date)s
                  AND d.acq_date <= %(end_date)s
                  AND ST_Intersects(
                      ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326),
                      aoi.g
                  )
                ORDER BY d.acq_date, d.acq_time, d.id
                """,
                {
                    "geojson": resolved_aoi.geojson_str,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
            for (
                lat,
                lon,
                acq_date_val,
                acq_time_val,
                sat,
                fam,
                conf,
                frp,
                dn,
                t_val,
                src,
                is_veg,
                cy,
                cx,
            ) in cur:
                type_str = "" if t_val is None else str(t_val)
                veg_str = "true" if is_veg else "false"
                cell_id = f"{cy}_{cx}"
                yield (
                    f"{lat},{lon},{acq_date_val.isoformat()},{acq_time_val.strip()},"
                    f"{sat},{fam},{conf},{frp},{dn.strip()},{type_str},"
                    f"{src},{veg_str},{cell_id}\n"
                )


def fetch_hotspots_geojson(
    conn: psycopg.Connection,
    resolved_aoi: ResolvedAoi,
    start_date: date,
    end_date: date,
) -> HotspotCollection:
    """Devuelve FeatureCollection de puntos dentro del AOI (máx. 62 días, 20,000 puntos)."""
    if (end_date - start_date).days > MAX_HOTSPOTS_GEOJSON_DAYS:
        raise ApiException(
            400,
            "invalid_range",
            f"Date range for /hotspots cannot exceed {MAX_HOTSPOTS_GEOJSON_DAYS} days",
        )
    check_hotspots_limit(
        conn,
        resolved_aoi,
        start_date,
        end_date,
        max_rows=MAX_HOTSPOTS_GEOJSON_ROWS,
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH aoi AS (
                SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g
            ),
            c AS (
                SELECT cy, cx
                FROM cell, aoi
                WHERE cell.country = 'MX'
                  AND ST_Intersects(cell.geom, aoi.g)
            )
            SELECT d.longitude,
                   d.latitude,
                   d.acq_date,
                   d.satellite,
                   d.family,
                   d.frp,
                   d.is_veg
            FROM detection d
            JOIN c USING (cy, cx)
            CROSS JOIN aoi
            WHERE d.country = 'MX'
              AND d.acq_date >= %(start_date)s
              AND d.acq_date <= %(end_date)s
              AND ST_Intersects(
                  ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326),
                  aoi.g
              )
            ORDER BY d.acq_date, d.acq_time, d.id
            LIMIT %(limit)s
            """,
            {
                "geojson": resolved_aoi.geojson_str,
                "start_date": start_date,
                "end_date": end_date,
                "limit": MAX_HOTSPOTS_GEOJSON_ROWS + 1,
            },
        )
        rows = cur.fetchall()

    if len(rows) > MAX_HOTSPOTS_GEOJSON_ROWS:
        raise ApiException(
            400,
            "aoi_too_large",
            f"Hotspots GeoJSON exceeds maximum of {MAX_HOTSPOTS_GEOJSON_ROWS:,} points",
        )

    features = [
        HotspotFeature(
            geometry=GeoJSONPoint(coordinates=[float(lon), float(lat)]),
            properties=HotspotProperties(
                acq_date=acq_d.isoformat(),
                satellite=sat,
                family=fam,
                frp=round(float(frp), 2),
                is_vegetation_fire=bool(is_veg),
            ),
        )
        for lon, lat, acq_d, sat, fam, frp, is_veg in rows
    ]
    return HotspotCollection(features=features)
