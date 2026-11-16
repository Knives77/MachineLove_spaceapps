# Acceptance tests and control figures

The figures come from an independent measurement on Nov 14 over `data/historico_pais/` (`type = 0` only, 0.01° grid, box edges included). If the ETL does not reproduce them within less than 1 %, there is a bug in the ETL.

## ETL

Cell-days per year. Sierra Gorda = lat 20.9–21.7, lon −100.6 to −99.0. Querétaro box = lat 20.0–21.7, same lon. Bajío = lat 20.0–20.9, same lon.

| Year | Qro MODIS | Qro S-NPP | Qro N20 | S. Gorda MODIS | S. Gorda S-NPP | Bajío MODIS | Bajío S-NPP |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2003 | 268 | — | — | 117 | — | 151 | — |
| 2011 | 410 | — | — | 167 | — | 243 | — |
| 2012 | 190 | 557 | — | 83 | 363 | 107 | 194 |
| 2017 | 416 | 1,486 | — | 99 | 387 | 317 | 1,099 |
| 2019 | 414 | 1,374 | 1,409 | 154 | 563 | 260 | 811 |
| 2024 | 306 | 1,017 | 1,033 | 120 | 332 | 186 | 685 |
| 2025 | 562 | 1,688 | 1,702 | 115 | 389 | 447 | 1,299 |

Raw points (MODIS + S-NPP + N20, `type = 0` only) in the Querétaro box: 2011 = 423 · 2012 = 904 · 2019 = 4,554 · 2025 = 5,295.

Other checks:

- [ ] No row with `satellite = 'N'` or outside {Terra, Aqua, SNPP, N20, N21}.
- [ ] `acq_time` always 4 characters; values starting with `0` exist.
- [ ] No detection duplicated between source A and sources B/C (count by satellite and year 2024, 2025: it must match the number of rows in source A).
- [ ] `detection` with `source = 'nrt'` has `type IS NULL` in all its rows.
- [ ] `static_cell` is not empty and no Sierra Gorda cell with fewer than 3 dates appears.
- [ ] `sensor_outage` contains S-NPP, Mexico, 2024-05-30 → 2024-06-03 and 2026-07-11 → 2026-07-16.

## Calibration

| Region | Expected `k` | `loyo_annual_mape` |
|---|---:|---:|
| Querétaro box | 0.293 | 0.068 |
| Sierra Gorda | 0.262 | 0.147 |
| Bajío | 0.307 | not measured: record the value |

Computed with S-NPP as the VIIRS for all of 2012-02 → 2025-12. With the official rule (NOAA-20 from Apr 2018) they must move by less than 0.01.

## API

- [ ] `GET /presets` returns 3 regions.
- [ ] `POST /calendar` with `qro-sierra-gorda` returns 324 months (2000–2026) and `calibration.k` between 0.25 and 0.28.
- [ ] The sum of `raw_points` for 2019 is more than 5 times that of 2011; that of `harmonized`, less than 1.5 times.
- [ ] With `basis = viirs_primary`, the median of the annual differences in `harmonized` against `modis_primary` (2012–2025) is below 20 %, and the maximum difference for a year does not exceed the same preset's `calibration.loyo_annual_max`. (It used to be a fixed 45 %, which did not come from any measurement; Sierra Gorda 2020 gives 50.7 % with a maximum LOYO of 55.2 %.)
- [ ] A month with `partial_month` (today November 2026) has `status = "no_data"` and `anomaly_ratio = null`, even if `harmonized` carries a value.
- [ ] A month with `no_coverage` has `harmonized = null` and does not count in `baseline.n_years`.
- [ ] Polygon in the ocean → 422 `aoi_outside_coverage`.
- [ ] `/hotspots.csv` for Sierra Gorda, 2025-03-01 → 2025-05-31, downloads and opens in a spreadsheet.
- [ ] Polygon in Argentina → 422 `aoi_outside_coverage` (outside the MVP).

## Frontend

- [ ] It works fully against the mocks without a backend.
- [ ] The raw/harmonized switch changes the matrix and the yearly chart without reloading.
- [ ] `no_data` months can be told apart from months with value 0.
- [ ] The color ramp is readable in grayscale and with a colorblindness simulation.
- [ ] Switching ES/EN translates everything, including statuses and flags.
- [ ] It can be used with a keyboard and on a 1366 × 768 screen.
