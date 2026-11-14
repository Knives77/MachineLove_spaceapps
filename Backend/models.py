"""Modelos Pydantic idénticos al contrato docs/contracts/api.md."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Status = Literal[
    "no_data",
    "insufficient_baseline",
    "below",
    "normal",
    "above",
    "critical",
]

Flag = Literal[
    "terra_only",
    "modis_outage",
    "viirs_outage",
    "nrt",
    "partial_month",
    "no_coverage",
]

Source = Literal["modis", "viirs_scaled"]
Basis = Literal["modis_primary", "viirs_primary"]
Country = Literal["MX", "AR"]
CalibrationScope = Literal["aoi", "country"]


class ApiException(Exception):
    """Excepción de dominio con código y estado HTTP según docs/contracts/api.md."""

    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.detail = detail


class ErrorDetail(BaseModel):
    code: str
    detail: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    data_through: str = "2026-11-01"


class GeoJSONPolygon(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]


class PresetProperties(BaseModel):
    name_es: str
    name_en: str
    country: Country


class PresetFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    properties: PresetProperties
    geometry: GeoJSONPolygon


class PresetCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[PresetFeature]


class AoiInput(BaseModel):
    """Objeto AOI: exactamente una de preset_id o geometry."""

    model_config = ConfigDict(extra="forbid")

    preset_id: str | None = None
    geometry: dict[str, Any] | None = None

    @model_validator(mode="after")
    def check_exclusivity(self) -> AoiInput:
        has_preset = self.preset_id is not None
        has_geom = self.geometry is not None
        if has_preset == has_geom:
            raise ApiException(
                400,
                "invalid_geometry",
                "aoi must provide exactly one of 'preset_id' or 'geometry'",
            )
        return self


class CalendarRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aoi: AoiInput
    start_year: int = 2000
    end_year: int = 2026
    basis: Basis = "modis_primary"

    @model_validator(mode="after")
    def validate_range(self) -> CalendarRequest:
        if (
            self.start_year < 2000
            or self.end_year > 2026
            or self.start_year > self.end_year
        ):
            raise ApiException(
                400,
                "invalid_range",
                "start_year and end_year must be within 2000..2026 and start_year <= end_year",
            )
        return self


class HotspotsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aoi: AoiInput
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self) -> HotspotsRequest:
        if (
            self.start_date.year < 2000
            or self.end_date.year > 2026
            or self.start_date > self.end_date
        ):
            raise ApiException(
                400,
                "invalid_range",
                "start_date and end_date must be within 2000..2026 and start_date <= end_date",
            )
        return self


class AoiSummary(BaseModel):
    preset_id: str | None = None
    area_km2: float
    country: Country


class YearRange(BaseModel):
    start_year: int
    end_year: int


class CalibrationSummary(BaseModel):
    k: float
    scope: CalibrationScope
    overlap_months: int
    modis_cell_days: int
    viirs_cell_days: int
    loyo_annual_mape: float | None = None
    loyo_annual_max: float | None = None
    monthly_mape: float | None = None


class BaselineSummary(BaseModel):
    median: float
    p25: float
    p75: float
    p90: float
    n_years: int


class MonthRow(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    harmonized: float | None
    source: Source | None
    raw_points: int
    modis_cell_days: int | None
    viirs_cell_days: int | None
    baseline: BaselineSummary | None
    anomaly_ratio: float | None
    status: Status
    flags: list[Flag]


class YearRow(BaseModel):
    year: int
    harmonized: float | None
    raw_points: int
    complete: bool


class LatestMonth(BaseModel):
    year: int
    month: int


class CalendarResponse(BaseModel):
    aoi: AoiSummary
    range: YearRange
    basis: Basis
    unit: Literal["modis_equivalent_cell_days"] = "modis_equivalent_cell_days"
    calibration: CalibrationSummary
    months: list[MonthRow]
    years: list[YearRow]
    seasonality: list[float]
    latest: LatestMonth

