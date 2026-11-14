"""Resolución y validación de AOI (preset_id o geometry GeoJSON Polygon)."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any

from shapely.geometry import Polygon, box, mapping, shape

from api.models import AoiInput, AoiSummary, ApiException, Country

MAX_AREA_KM2 = 200_000.0

# Rectángulos de cobertura de respaldo (docs/.claude/skills/api/SKILL.md)
COUNTRY_BBOXES: dict[Country, Polygon] = {
    "MX": box(-118.5, 14.5, -86.5, 32.8),
    "AR": box(-73.6, -55.1, -53.6, -21.7),
}

BUILTIN_PRESETS: dict[str, dict[str, Any]] = {
    "qro-sierra-gorda": {
        "id": "qro-sierra-gorda",
        "name_es": "Sierra Gorda, Querétaro",
        "name_en": "Sierra Gorda, Querétaro",
        "country": "MX",
        "bbox": (-100.6, 20.9, -99.0, 21.7),
    },
    "qro-bajio": {
        "id": "qro-bajio",
        "name_es": "Bajío queretano",
        "name_en": "Querétaro lowlands (Bajío)",
        "country": "MX",
        "bbox": (-100.6, 20.0, -99.0, 20.9),
    },
    "ar-chilecito": {
        "id": "ar-chilecito",
        "name_es": "Chilecito, La Rioja",
        "name_en": "Chilecito, La Rioja",
        "country": "AR",
        "bbox": (-68.3, -29.9, -66.8, -28.4),
    },
}


@dataclass(frozen=True)
class ResolvedAoi:
    preset_id: str | None
    polygon: Polygon
    geojson_str: str
    area_km2: float
    country: Country

    def to_summary(self) -> AoiSummary:
        return AoiSummary(
            preset_id=self.preset_id,
            area_km2=round(self.area_km2, 1),
            country=self.country,
        )


def estimate_area_km2(poly: Polygon) -> float:
    """Área aproximada en km² sobre WGS84 (usada antes o sin PostGIS)."""
    minx, miny, maxx, maxy = poly.bounds
    mean_lat_rad = math.radians((miny + maxy) / 2.0)
    # 1° lat ≈ 110.574 km, 1° lon ≈ 111.320 * cos(lat) km
    km_per_deg_lat = 110.574
    km_per_deg_lon = 111.320 * math.cos(mean_lat_rad)
    return float(poly.area * km_per_deg_lat * km_per_deg_lon)


def parse_and_validate_polygon(geom_dict: dict[str, Any]) -> Polygon:
    """Valida que el diccionario sea un GeoJSON Polygon válido en WGS84."""
    if not isinstance(geom_dict, dict) or geom_dict.get("type") != "Polygon":
        raise ApiException(
            400,
            "invalid_geometry",
            "geometry must be a GeoJSON Polygon",
        )
    coords = geom_dict.get("coordinates")
    if not isinstance(coords, list) or not coords:
        raise ApiException(
            400,
            "invalid_geometry",
            "Polygon coordinates cannot be empty",
        )
    for ring in coords:
        if not isinstance(ring, list) or len(ring) < 4:
            raise ApiException(
                400,
                "invalid_geometry",
                "Each polygon ring must have at least 4 coordinates",
            )
        for pt in ring:
            if (
                not isinstance(pt, (list, tuple))
                or len(pt) != 2
                or not isinstance(pt[0], (int, float))
                or not isinstance(pt[1], (int, float))
            ):
                raise ApiException(
                    400,
                    "invalid_geometry",
                    "Each coordinate must be a [lon, lat] numeric pair",
                )
            lon, lat = float(pt[0]), float(pt[1])
            if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
                raise ApiException(
                    400,
                    "invalid_geometry",
                    "Coordinates out of WGS84 bounds",
                )
        if ring[0] != ring[-1]:
            raise ApiException(
                400,
                "invalid_geometry",
                "Polygon ring must be closed (first point == last point)",
            )

    try:
        geom = shape(geom_dict)
    except Exception as exc:
        raise ApiException(400, "invalid_geometry", str(exc)) from exc

    if not isinstance(geom, Polygon) or geom.is_empty or not geom.is_valid or geom.area <= 0:
        raise ApiException(
            400,
            "invalid_geometry",
            "Polygon is empty, self-intersecting, or degenerate",
        )
    return geom


def detect_country_from_bbox(poly: Polygon) -> Country:
    """Determina el país comparando la intersección con los rectángulos de México y Argentina."""
    overlaps: list[tuple[float, Country]] = []
    for code, bbox in COUNTRY_BBOXES.items():
        if poly.intersects(bbox):
            inter_area = poly.intersection(bbox).area
            if inter_area > 0:
                overlaps.append((inter_area, code))
    if not overlaps:
        raise ApiException(
            422,
            "aoi_outside_coverage",
            "The requested AOI does not intersect Mexico or Argentina coverage",
        )
    overlaps.sort(reverse=True)
    return overlaps[0][1]


def resolve_aoi_offline(aoi: AoiInput) -> ResolvedAoi:
    """Resuelve y valida un AOI sin consultar la base de datos (para mocks o pre-validación)."""
    if aoi.preset_id is not None:
        preset = BUILTIN_PRESETS.get(aoi.preset_id)
        if preset is None:
            raise ApiException(
                404,
                "unknown_preset",
                f"Unknown preset_id: '{aoi.preset_id}'",
            )
        minx, miny, maxx, maxy = preset["bbox"]
        poly = box(minx, miny, maxx, maxy)
        area_km2 = estimate_area_km2(poly)
        country: Country = preset["country"]
        return ResolvedAoi(
            preset_id=aoi.preset_id,
            polygon=poly,
            geojson_str=json.dumps(mapping(poly)),
            area_km2=area_km2,
            country=country,
        )

    assert aoi.geometry is not None
    poly = parse_and_validate_polygon(aoi.geometry)
    area_km2 = estimate_area_km2(poly)
    if area_km2 > MAX_AREA_KM2:
        raise ApiException(
            400,
            "aoi_too_large",
            f"AOI area ({area_km2:,.1f} km²) exceeds maximum of {MAX_AREA_KM2:,.0f} km²",
        )
    country = detect_country_from_bbox(poly)
    return ResolvedAoi(
        preset_id=None,
        polygon=poly,
        geojson_str=json.dumps(mapping(poly)),
        area_km2=area_km2,
        country=country,
    )

