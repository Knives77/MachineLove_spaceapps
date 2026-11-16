# API contract · v1

Base: `http://localhost:8000/api/v1`. JSON in UTF-8. CORS open to `http://localhost:*`.
The full examples are in `docs/contracts/examples/`; the frontend uses them as mocks.

## Conventions

- The API returns **codes**, never sentences. The frontend translates.
- Dates `YYYY-MM-DD`. Months 1–12.
- Geometry: GeoJSON `Polygon` in WGS84, `[lon, lat]` order.
- Errors: `{"error": {"code": "...", "detail": "..."}}`.

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid_geometry` | not a valid polygon |
| 400 | `aoi_too_large` | more than 200,000 km² |
| 400 | `invalid_range` | `start_year > end_year` or outside 2000–2026 |
| 404 | `unknown_preset` | nonexistent `preset_id` |
| 422 | `aoi_outside_coverage` | the area does not touch Mexico (in the MVP; Argentina is phase 2). A polygon without cells counts as Mexico only if it lies less than 0.15° (~15 km) from cells in Mexico: the Gulf and the Pacific return 422 |
| 503 | `db_unavailable` | the database does not respond (Postgres off or unreachable) |

## The `aoi` object

Exactly one of the two forms:

```json
{"preset_id": "qro-sierra-gorda"}
{"geometry": {"type": "Polygon", "coordinates": [[[-100.6,20.9],[-99.0,20.9],[-99.0,21.7],[-100.6,21.7],[-100.6,20.9]]]}}
```

## GET `/health`

`{"status": "ok", "data_through": "2026-11-01"}`

## GET `/presets`

Returns a `FeatureCollection`. Each `Feature` has an `id` and `properties: {name_es, name_en, country}`. Example: `examples/presets.response.json`.

## POST `/calendar`

Request:

```json
{
  "aoi": {"preset_id": "qro-sierra-gorda"},
  "start_year": 2000,
  "end_year": 2026,
  "basis": "modis_primary"
}
```

`start_year` and `end_year` are optional (2000 and 2026). `basis` is optional: `modis_primary` | `viirs_primary`.

Response: `examples/calendar.response.json`. Fields:

| Field | Type | Meaning |
|---|---|---|
| `aoi.area_km2` | number | area of the polygon |
| `aoi.country` | `MX` | `AR` reserved for phase 2 |
| `unit` | `"modis_equivalent_cell_days"` | unit of `harmonized` |
| `calibration.k` | number | MODIS/VIIRS factor used |
| `calibration.scope` | `aoi` \| `country` | where `k` came from |
| `calibration.overlap_months` | integer | months used |
| `calibration.modis_cell_days`, `viirs_cell_days` | integer | sums over the overlap |
| `calibration.loyo_annual_mape`, `loyo_annual_max`, `monthly_mape` | number 0–1 or `null` | validation errors |
| `months[]` | list | one entry for each month in the range, **including empty ones** |
| `months[].year`, `.month` | integer | |
| `months[].harmonized` | number \| `null` | MODIS-equivalent cell-days |
| `months[].source` | `modis` \| `viirs_scaled` \| `null` | |
| `months[].raw_points` | integer | all hot spots, unfiltered and unharmonized |
| `months[].modis_cell_days`, `.viirs_cell_days` | integer \| `null` | `M(m)` and `V(m)` |
| `months[].baseline` | `{median, p25, p75, p90, n_years}` \| `null` | |
| `months[].anomaly_ratio` | number \| `null` | |
| `months[].status` | `no_data` \| `insufficient_baseline` \| `below` \| `normal` \| `above` \| `critical` | a month with `partial_month` is always `no_data` |
| `months[].flags` | list of codes | see `harmonization.md` |
| `years[]` | `{year, harmonized, raw_points, complete}` | yearly totals; `complete = false` if any month is missing |
| `seasonality[]` | 12 numbers that add up to 1 | historical fraction of `harmonized` per calendar month |
| `latest` | `{year, month}` | latest complete month with data; it is the one shown on the card |

Target time: < 2 s for presets, < 8 s for a free polygon.

## POST `/calendar.csv`

Same request. `text/csv` with one row per month:

`year,month,harmonized,source,raw_points,modis_cell_days,viirs_cell_days,baseline_median,baseline_p25,baseline_p75,baseline_p90,anomaly_ratio,status,flags`

`flags` separated by `|`. Header `Content-Disposition: attachment; filename="burn_calendar_<aoi>_<start>_<end>.csv"`.

## POST `/hotspots.csv`

Request:

```json
{"aoi": {"preset_id": "qro-sierra-gorda"}, "start_date": "2025-03-01", "end_date": "2025-05-31"}
```

Streamed `text/csv`, one row per detection inside the area:

`latitude,longitude,acq_date,acq_time,satellite,family,confidence,frp,daynight,type,source,is_vegetation_fire,cell_id`

`cell_id` = `"<cy>_<cx>"`. Limit: 2,000,000 rows; if exceeded, 400 `aoi_too_large`.

## POST `/hotspots` (enhancement, not MVP)

Same request with a maximum range of 62 days. Returns a `FeatureCollection` of points (max. 20,000) with `properties: {acq_date, satellite, family, frp, is_vegetation_fire}`.
