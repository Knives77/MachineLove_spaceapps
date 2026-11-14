"""Punto de entrada de la aplicación FastAPI (Backend.main:app / api.main:app)."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.models import ApiException
from api.routes import router

app = FastAPI(
    title="MachineLove Burn Activity Calendar API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(ApiException)
async def api_exception_handler(
    _request: Request, exc: ApiException
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "detail": exc.detail}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    locs = {str(part) for err in errors for part in err.get("loc", ())}
    if "aoi" in locs or "geometry" in locs or "coordinates" in locs:
        code = "invalid_geometry"
    elif (
        "start_year" in locs
        or "end_year" in locs
        or "start_date" in locs
        or "end_date" in locs
    ):
        code = "invalid_range"
    else:
        code = "invalid_request"

    detail = "; ".join(err.get("msg", "validation error") for err in errors)
    return JSONResponse(
        status_code=400,
        content={"error": {"code": code, "detail": detail}},
    )


app.include_router(router, prefix="/api/v1")
app.include_router(router, include_in_schema=False)
