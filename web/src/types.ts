// Tipos de docs/contracts/api.md. Si el contrato cambia, se cambia aquí primero.

export type Status =
  | 'no_data'
  | 'insufficient_baseline'
  | 'below'
  | 'normal'
  | 'above'
  | 'critical';

export type Flag =
  | 'terra_only'
  | 'modis_outage'
  | 'viirs_outage'
  | 'nrt'
  | 'partial_month'
  | 'no_coverage';

export type Source = 'modis' | 'viirs_scaled';

export interface Baseline {
  median: number;
  p25: number;
  p75: number;
  p90: number;
  n_years: number;
}

export interface MonthRow {
  year: number;
  month: number;
  harmonized: number | null;
  source: Source | null;
  raw_points: number;
  modis_cell_days: number | null;
  viirs_cell_days: number | null;
  baseline: Baseline | null;
  anomaly_ratio: number | null;
  status: Status;
  flags: Flag[];
}

export interface YearRow {
  year: number;
  harmonized: number | null;
  raw_points: number;
  complete: boolean;
}

export interface Calibration {
  k: number;
  scope: 'aoi' | 'country';
  overlap_months: number;
  modis_cell_days: number;
  viirs_cell_days: number;
  loyo_annual_mape: number | null;
  loyo_annual_max: number | null;
  monthly_mape: number | null;
}

export interface CalendarResponse {
  _note?: string;
  aoi: { preset_id?: string; area_km2: number; country: 'MX' | 'AR' };
  range: { start_year: number; end_year: number };
  basis: Basis;
  unit: 'modis_equivalent_cell_days';
  calibration: Calibration;
  months: MonthRow[];
  years: YearRow[];
  seasonality: number[];
  latest: { year: number; month: number };
}

export interface Polygon {
  type: 'Polygon';
  coordinates: number[][][]; // [lon, lat], anillo cerrado
}

export type Aoi = { preset_id: string } | { geometry: Polygon };

export type Basis = 'modis_primary' | 'viirs_primary';

export interface CalendarRequest {
  aoi: Aoi;
  start_year?: number;
  end_year?: number;
  basis?: Basis;
}

export interface HotspotsRequest {
  aoi: Aoi;
  start_date: string; // YYYY-MM-DD
  end_date: string;
}

export interface PresetFeature {
  type: 'Feature';
  id: string;
  properties: { name_es: string; name_en: string; country: 'MX' | 'AR' };
  geometry: Polygon;
}

export interface PresetCollection {
  type: 'FeatureCollection';
  features: PresetFeature[];
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public detail?: string,
  ) {
    super(code);
  }
}

export type Mode = 'harmonized' | 'raw';
export type Palette = 'inferno' | 'cividis';
export type Lang = 'es' | 'en';
export type Tab = 'general' | 'learn' | 'edu' | 'expert';
