"""Endpoints REST del backend FastAPI según docs/contracts/api.md."""
from __future__ import annotations

from collections import OrderedDict
from datetime import date
import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response, StreamingResponse
import shapely

from backend.aoi import (
    ResolvedAoi,
    parse_and_validate_polygon,
    resolve_aoi_offline,
)
from backend.harmonize import (
    MonthKey,
    MonthlyCounts,
    OutageInterval,
    build_calendar_response,
)
from backend.models import (
    AoiInput,
    ApiException,
    CalendarRequest,
    CalendarResponse,
    HealthResponse,
    HotspotCollection,
    HotspotsRequest,
    PresetCollection,
)
from backend.queries import (
    _COUNTRY_METADATA_CACHE,
    HOTSPOTS_CSV_HEADER,
    MAX_HOTSPOTS_GEOJSON_DAYS,
    check_hotspots_limit,
    fetch_calendar_inputs,
    fetch_data_through,
    fetch_hotspots_geojson,
    fetch_presets,
    get_connection,
    resolve_aoi_db,
    resolve_database_url,
    stream_hotspots_csv,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = REPO_ROOT / "docs" / "contracts" / "examples"
WEB_MOCKS_DIR = REPO_ROOT / "web" / "src" / "mocks"

CALENDAR_CSV_HEADER = (
    "year,month,harmonized,source,raw_points,modis_cell_days,viirs_cell_days,"
    "baseline_median,baseline_p25,baseline_p75,baseline_p90,anomaly_ratio,status,flags\n"
)

CACHE_TTL_SECONDS = 600.0
HEALTH_CACHE_TTL_SECONDS = 30.0
MAX_AOI_CACHE_ENTRIES = 64
MAX_CALENDAR_CACHE_ENTRIES = 128

_AOI_INPUTS_CACHE: OrderedDict[
    tuple[str, str, int],
    tuple[
        float,
        ResolvedAoi,
        dict[MonthKey, MonthlyCounts],
        list[OutageInterval],
        float | None,
        date,
    ],
] = OrderedDict()
_PRESETS_RESPONSE_CACHE: dict[tuple[str, int], tuple[float, PresetCollection]] = {}
_HEALTH_RESPONSE_CACHE: dict[tuple[str, int], tuple[float, str]] = {}
_CACHE_LOCK = threading.RLock()
_KEY_LOCKS: dict[tuple[str, str, int], threading.Lock] = {}


class _UnifiedCacheStore(OrderedDict):  # type: ignore[type-arg]
    """Almacén LRU de respuestas de calendario cuyo .clear() limpia todas las cachés en memoria."""

    def clear(self) -> None:
        with _CACHE_LOCK:
            super().clear()
            _AOI_INPUTS_CACHE.clear()
            _PRESETS_RESPONSE_CACHE.clear()
            _HEALTH_RESPONSE_CACHE.clear()
            _COUNTRY_METADATA_CACHE.clear()
            _KEY_LOCKS.clear()


_PRESET_CALENDAR_CACHE: _UnifiedCacheStore = _UnifiedCacheStore()

router = APIRouter()


def _canonical_aoi_key(aoi: AoiInput) -> str:
    """Genera llave canónica para preset_id o polígono normalizado en WKB."""
    if aoi.preset_id is not None:
        return f"preset:{aoi.preset_id}"
    assert aoi.geometry is not None
    poly = parse_and_validate_polygon(aoi.geometry)
    norm_wkb = shapely.normalize(poly).wkb
    digest = hashlib.sha256(norm_wkb).hexdigest()
    return f"poly:{digest}"


def _get_aoi_lock(key: tuple[str, str, int]) -> threading.Lock:
    with _CACHE_LOCK:
        lock = _KEY_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _KEY_LOCKS[key] = lock
        return lock


def is_mock_mode() -> bool:
    return os.environ.get("API_MOCK", "0") == "1"


def aoi_slug(req: CalendarRequest | HotspotsRequest) -> str:
    return req.aoi.preset_id if req.aoi.preset_id else "polygon"


def load_mock_presets() -> PresetCollection:
    path = EXAMPLES_DIR / "presets.response.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return PresetCollection(**data)


def load_mock_calendar(req: CalendarRequest) -> CalendarResponse:
    resolved = resolve_aoi_offline(req.aoi)
    preset_id = resolved.preset_id or "qro-sierra-gorda"

    demo_path = WEB_MOCKS_DIR / f"calendar.demo.{preset_id}.json"
    fallback_demo_path = WEB_MOCKS_DIR / "calendar.demo.qro-sierra-gorda.json"
    example_path = EXAMPLES_DIR / "calendar.response.json"
    if demo_path.exists():
        target_path = demo_path
    elif fallback_demo_path.exists():
        target_path = fallback_demo_path
    else:
        target_path = example_path

    raw_data: dict[str, Any] = json.loads(target_path.read_text(encoding="utf-8"))
    raw_data.pop("_note", None)
    raw_data["aoi"] = resolved.to_summary().model_dump(exclude_none=True)
    raw_data["range"] = {
        "start_year": req.start_year,
        "end_year": req.end_year,
    }
    raw_data["basis"] = req.basis
    raw_data["months"] = [
        m
        for m in raw_data.get("months", [])
        if req.start_year <= m["year"] <= req.end_year
    ]
    raw_data["years"] = [
        y
        for y in raw_data.get("years", [])
        if req.start_year <= y["year"] <= req.end_year
    ]
    return CalendarResponse(**raw_data)


def compute_or_get_calendar(req: CalendarRequest) -> CalendarResponse:
    if is_mock_mode():
        return load_mock_calendar(req)

    dsn = resolve_database_url()
    conn_fn_id = id(get_connection)
    aoi_key = _canonical_aoi_key(req.aoi)
    cal_key = (
        aoi_key,
        req.start_year,
        req.end_year,
        req.basis,
        dsn,
        conn_fn_id,
    )

    now = time.monotonic()
    with _CACHE_LOCK:
        cached_cal = _PRESET_CALENDAR_CACHE.get(cal_key)
        if cached_cal is not None and (now - cached_cal[0]) < CACHE_TTL_SECONDS:
            _PRESET_CALENDAR_CACHE.move_to_end(cal_key)
            return cached_cal[1]

    inputs_key = (aoi_key, dsn, conn_fn_id)
    key_lock = _get_aoi_lock(inputs_key)
    with key_lock:
        now = time.monotonic()
        with _CACHE_LOCK:
            cached_inputs = _AOI_INPUTS_CACHE.get(inputs_key)
            if (
                cached_inputs is not None
                and (now - cached_inputs[0]) < CACHE_TTL_SECONDS
            ):
                _AOI_INPUTS_CACHE.move_to_end(inputs_key)
                _, resolved, counts, outages, country_k, data_through = (
                    cached_inputs
                )
            else:
                cached_inputs = None

        if cached_inputs is None:
            with get_connection() as conn:
                resolved = resolve_aoi_db(conn, req.aoi)
                counts, outages, country_k, data_through = (
                    fetch_calendar_inputs(conn, resolved)
                )
            with _CACHE_LOCK:
                _AOI_INPUTS_CACHE[inputs_key] = (
                    time.monotonic(),
                    resolved,
                    counts,
                    outages,
                    country_k,
                    data_through,
                )
                _AOI_INPUTS_CACHE.move_to_end(inputs_key)
                while len(_AOI_INPUTS_CACHE) > MAX_AOI_CACHE_ENTRIES:
                    _AOI_INPUTS_CACHE.popitem(last=False)

    cal = build_calendar_response(
        aoi_summary=resolved.to_summary(),
        start_year=req.start_year,
        end_year=req.end_year,
        basis=req.basis,
        counts_by_month=counts,
        outages=outages,
        country_k=country_k,
        data_through=data_through,
    )
    with _CACHE_LOCK:
        _PRESET_CALENDAR_CACHE[cal_key] = (time.monotonic(), cal)
        _PRESET_CALENDAR_CACHE.move_to_end(cal_key)
        while len(_PRESET_CALENDAR_CACHE) > MAX_CALENDAR_CACHE_ENTRIES:
            _PRESET_CALENDAR_CACHE.popitem(last=False)
    return cal


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    if is_mock_mode():
        return HealthResponse(status="ok", data_through="2026-11-01")
    dsn = resolve_database_url()
    h_key = (dsn, id(get_connection))
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _HEALTH_RESPONSE_CACHE.get(h_key)
        if cached is not None and (now - cached[0]) < HEALTH_CACHE_TTL_SECONDS:
            return HealthResponse(status="ok", data_through=cached[1])
    try:
        with get_connection() as conn:
            dt = fetch_data_through(conn)
        with _CACHE_LOCK:
            prev = _HEALTH_RESPONSE_CACHE.get(h_key)
            if prev is not None and prev[1] != dt:
                _PRESET_CALENDAR_CACHE.clear()
            _HEALTH_RESPONSE_CACHE[h_key] = (time.monotonic(), dt)
        return HealthResponse(status="ok", data_through=dt)
    except ApiException:
        raise
    except Exception as exc:
        raise ApiException(503, "db_unavailable", f"Database unavailable: {type(exc).__name__}")


@router.get("/presets", response_model=PresetCollection)
def get_presets(response: Response) -> PresetCollection:
    response.headers["Cache-Control"] = "public, max-age=300"
    if is_mock_mode():
        return load_mock_presets()
    dsn = resolve_database_url()
    p_key = (dsn, id(get_connection))
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _PRESETS_RESPONSE_CACHE.get(p_key)
        if cached is not None and (now - cached[0]) < CACHE_TTL_SECONDS:
            return cached[1]
    with get_connection() as conn:
        presets = fetch_presets(conn)
    if not presets.features:
        return load_mock_presets()
    with _CACHE_LOCK:
        _PRESETS_RESPONSE_CACHE[p_key] = (time.monotonic(), presets)
    return presets


@router.post("/calendar", response_model=CalendarResponse)
def post_calendar(req: CalendarRequest) -> JSONResponse:
    cal = compute_or_get_calendar(req)
    payload = cal.model_dump()
    if payload["aoi"].get("preset_id") is None:
        payload["aoi"].pop("preset_id", None)
    return JSONResponse(content=payload)


def format_calendar_csv(cal: CalendarResponse) -> str:
    def fmt(val: Any) -> str:
        return "" if val is None else str(val)

    lines = [CALENDAR_CSV_HEADER]
    for m in cal.months:
        b = m.baseline
        row = [
            str(m.year),
            str(m.month),
            fmt(m.harmonized),
            fmt(m.source),
            str(m.raw_points),
            fmt(m.modis_cell_days),
            fmt(m.viirs_cell_days),
            fmt(b.median if b else None),
            fmt(b.p25 if b else None),
            fmt(b.p75 if b else None),
            fmt(b.p90 if b else None),
            fmt(m.anomaly_ratio),
            m.status,
            "|".join(m.flags),
        ]
        lines.append(",".join(row) + "\n")
    return "".join(lines)


@router.post("/calendar.csv")
def post_calendar_csv(req: CalendarRequest) -> Response:
    cal = compute_or_get_calendar(req)
    filename = (
        f"burn_calendar_{aoi_slug(req)}_{req.start_year}_{req.end_year}.csv"
    )
    csv_body = format_calendar_csv(cal)
    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/hotspots.csv")
def post_hotspots_csv(req: HotspotsRequest) -> StreamingResponse:
    filename = (
        f"hotspots_{aoi_slug(req)}_"
        f"{req.start_date.isoformat()}_{req.end_date.isoformat()}.csv"
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    if is_mock_mode():
        resolve_aoi_offline(req.aoi)
        return StreamingResponse(
            iter([HOTSPOTS_CSV_HEADER]),
            media_type="text/csv; charset=utf-8",
            headers=headers,
        )

    dsn = os.environ.get("DATABASE_URL")
    with get_connection(dsn) as conn:
        resolved = resolve_aoi_db(conn, req.aoi)
        check_hotspots_limit(conn, resolved, req.start_date, req.end_date)

    return StreamingResponse(
        stream_hotspots_csv(
            dsn=dsn,
            resolved_aoi=resolved,
            start_date=req.start_date,
            end_date=req.end_date,
        ),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


@router.post("/hotspots", response_model=HotspotCollection)
def post_hotspots_geojson(req: HotspotsRequest) -> HotspotCollection:
    if (req.end_date - req.start_date).days > MAX_HOTSPOTS_GEOJSON_DAYS:
        raise ApiException(
            400,
            "invalid_range",
            f"Date range for /hotspots cannot exceed {MAX_HOTSPOTS_GEOJSON_DAYS} days",
        )
    if is_mock_mode():
        resolve_aoi_offline(req.aoi)
        return HotspotCollection(features=[])

    with get_connection() as conn:
        resolved = resolve_aoi_db(conn, req.aoi)
        return fetch_hotspots_geojson(
            conn, resolved, req.start_date, req.end_date
        )
