"""Endpoints REST del backend FastAPI según docs/contracts/api.md."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse

from api.aoi import resolve_aoi_offline
from api.harmonize import build_calendar_response
from api.models import (
    CalendarRequest,
    CalendarResponse,
    HealthResponse,
    HotspotsRequest,
    PresetCollection,
)
from api.queries import (
    DATABASE_URL,
    HOTSPOTS_CSV_HEADER,
    check_hotspots_limit,
    fetch_calendar_inputs,
    fetch_data_through,
    fetch_presets,
    get_connection,
    resolve_aoi_db,
    stream_hotspots_csv,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = REPO_ROOT / "docs" / "contracts" / "examples"
WEB_MOCKS_DIR = REPO_ROOT / "web" / "src" / "mocks"

CALENDAR_CSV_HEADER = (
    "year,month,harmonized,source,raw_points,modis_cell_days,viirs_cell_days,"
    "baseline_median,baseline_p25,baseline_p75,baseline_p90,anomaly_ratio,status,flags\n"
)

router = APIRouter()


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
    example_path = EXAMPLES_DIR / "calendar.response.json"
    target_path = demo_path if demo_path.exists() else example_path

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


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    if is_mock_mode():
        return HealthResponse(status="ok", data_through="2026-11-01")
    try:
        with get_connection() as conn:
            dt = fetch_data_through(conn)
        return HealthResponse(status="ok", data_through=dt)
    except Exception:
        return HealthResponse(status="ok", data_through="2026-11-01")


@router.get("/presets", response_model=PresetCollection)
def get_presets() -> PresetCollection:
    if is_mock_mode():
        return load_mock_presets()
    with get_connection() as conn:
        presets = fetch_presets(conn)
    if not presets.features:
        return load_mock_presets()
    return presets


@router.post(
    "/calendar",
    response_model=CalendarResponse,
    response_model_exclude_none=False,
)
def post_calendar(req: CalendarRequest) -> dict[str, Any]:
    if is_mock_mode():
        cal = load_mock_calendar(req)
    else:
        with get_connection() as conn:
            resolved = resolve_aoi_db(conn, req.aoi)
            counts, outages, country_k, data_through = fetch_calendar_inputs(
                conn, resolved
            )
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

    payload = cal.model_dump()
    if payload["aoi"].get("preset_id") is None:
        payload["aoi"].pop("preset_id", None)
    return payload


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
    if is_mock_mode():
        cal = load_mock_calendar(req)
    else:
        with get_connection() as conn:
            resolved = resolve_aoi_db(conn, req.aoi)
            counts, outages, country_k, data_through = fetch_calendar_inputs(
                conn, resolved
            )
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

    with get_connection() as conn:
        resolved = resolve_aoi_db(conn, req.aoi)
        check_hotspots_limit(conn, resolved, req.start_date, req.end_date)

    return StreamingResponse(
        stream_hotspots_csv(
            dsn=DATABASE_URL,
            resolved_aoi=resolved,
            start_date=req.start_date,
            end_date=req.end_date,
        ),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )

