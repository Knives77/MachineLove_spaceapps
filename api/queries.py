"""Consultas SQL sobre PostgreSQL + PostGIS para los endpoints de la API."""
from __future__ import annotations

import json
import os
from datetime import date
from typing import Iterator

import psycopg

from api.aoi import (
    MAX_AREA_KM2,
    ResolvedAoi,
    detect_country_from_bbox,
    parse_and_validate_polygon,
    resolve_aoi_offline,
)
from api.harmonize import MonthKey, MonthlyCounts, OutageInterval
from api.models import (
    AoiInput,
    ApiException,
    Country,
    GeoJSONPolygon,
    PresetCollection,
    PresetFeature,
    PresetProperties,
)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://firms:firms_local@127.0.0.1:5432/firms",
)


def get_connection(dsn: str | None = None) -> psycopg.Connection:
    return psycopg.connect(dsn or DATABASE_URL)


def fetch_data_through(conn: psycopg.Connection) -> str:
    """Obtiene la última fecha disponible en cell_day o detection."""
    with conn.cursor() as cur:
        cur.execute("SELECT max(acq_date) FROM cell_day")
        row = cur.fetchone()
        if row and row[0] is not None:
            return row[0].isoformat()
        cur.execute("SELECT max(acq_date) FROM detection")
        row = cur.fetchone()
        if row and row[0] is not None:
            return row[0].isoformat()
    return "2026-11-01"


def fetch_presets(conn: psycopg.Connection) -> PresetCollection:
    """Devuelve la colección GeoJSON de regiones predefinidas desde la tabla preset."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name_es, name_en, country, ST_AsGeoJSON(geom)
            FROM preset
            WHERE country = 'MX'
            ORDER BY CASE id
                WHEN 'qro-sierra-gorda' THEN 1
                WHEN 'qro-bajio' THEN 2
                WHEN 'qro-recuadro' THEN 3
                ELSE 4
            END, id
            """
        )
        rows = cur.fetchall()

    features: list[PresetFeature] = []
    for pid, name_es, name_en, country_raw, geojson_str in rows:
        country: Country = "MX" if country_raw.strip() == "MX" else "AR"
        geom_dict = json.loads(geojson_str)
        features.append(
            PresetFeature(
                id=pid,
                properties=PresetProperties(
                    name_es=name_es,
                    name_en=name_en,
                    country=country,
                ),
                geometry=GeoJSONPolygon(**geom_dict),
            )
        )
    return PresetCollection(features=features)


def resolve_aoi_db(conn: psycopg.Connection, aoi: AoiInput) -> ResolvedAoi:
    """Resuelve y valida preset_id o geometry usando PostGIS."""
    if aoi.preset_id is not None:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT country,
                       ST_AsGeoJSON(geom),
                       ST_Area(geom::geography) / 1e6
                FROM preset
                WHERE id = %(preset_id)s AND country = 'MX'
                """,
                {"preset_id": aoi.preset_id},
            )
            row = cur.fetchone()
        if row is None:
            # Si la tabla preset aún está vacía pero es uno de los 3 presets oficiales, usar offline
            return resolve_aoi_offline(aoi)
        country_raw, geojson_str, area_km2 = row
        country: Country = "MX"
        poly = parse_and_validate_polygon(json.loads(geojson_str))
        return ResolvedAoi(
            preset_id=aoi.preset_id,
            polygon=poly,
            geojson_str=geojson_str,
            area_km2=float(area_km2),
            country=country,
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

        # MVP solo México: verificar si tiene celdas de México
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
        country = "MX"
    else:
        country = detect_country_from_bbox(poly)

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
    with conn.cursor() as cur:
        # 1. Meses con datos NRT en este país (usando índice detection_date)
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
        nrt_months: set[MonthKey] = {(r[0], r[1]) for r in cur.fetchall()}

        # 2. Consulta central de /calendar sobre cell_day (siempre 2000-01-01 a 2027-01-01)
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

        # Marcar has_nrt incluso en meses del rango con 0 detecciones en el AOI si el país tiene NRT ese mes
        for ym in nrt_months:
            if ym not in counts:
                counts[ym] = MonthlyCounts(has_nrt=True)

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
        country_k = float(cal_row[0]) if cal_row and cal_row[0] is not None else None

        # 5. Fecha tope de datos para este país
        cur.execute(
            """
            SELECT max(d.acq_date)
            FROM cell_day d
            JOIN cell c USING (cy, cx)
            WHERE c.country = %(country)s
            """,
            {"country": resolved_aoi.country},
        )
        max_row = cur.fetchone()
        data_through = (
            max_row[0]
            if max_row and max_row[0] is not None
            else date(2026, 11, 1)
        )

    return counts, outages, country_k, data_through


HOTSPOTS_CSV_HEADER = (
    "latitude,longitude,acq_date,acq_time,satellite,family,"
    "confidence,frp,daynight,type,source,is_vegetation_fire,cell_id\n"
)


def stream_hotspots_csv(
    dsn: str,
    resolved_aoi: ResolvedAoi,
    start_date: date,
    end_date: date,
) -> Iterator[str]:
    """Generador streaming que consulta detection con un cursor de servidor."""
    yield HOTSPOTS_CSV_HEADER

    with psycopg.connect(dsn) as conn:
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
                    WHERE ST_Intersects(cell.geom, aoi.g)
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
                WHERE d.acq_date >= %(start_date)s
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

