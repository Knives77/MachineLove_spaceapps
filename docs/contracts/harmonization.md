# Harmonization contract

All formulas are applied **inside the queried area (AOI)** and per month.

## Definitions

| Symbol | Definition |
|---|---|
| cell | `(cy, cx)` = `(floor(lat·100), floor(lon·100))` |
| Reference VIIRS | **S-NPP** if `acq_date < 2018-04-01`; **NOAA-20** after. If the reference one has an outage that day (`sensor_outage`), the other is used; if both are missing, NOAA-21 |
| `M(m)` | cell-days in month `m` with `modis_veg = true` |
| `V(m)` | cell-days in month `m` with `viirs_veg = true` |
| `R(m)` | sum of `raw_points` in the month (raw mode) |
| overlap | months from **2012-02 to 2025-12** without an outage flag for MODIS or for the reference VIIRS |

`cell_day.viirs_veg` already comes computed by the ETL with the reference VIIRS rule; the backend does not repeat it.

## Calibration

```
k_aoi = Σ M(m) / Σ V(m)        over the overlap months
```

- If `Σ M(m)` over the overlap is **< 100**, `calibration_country.k` is used and the response carries `calibration.scope = "country"`. Otherwise, `scope = "aoi"`.
- Leave-one-year-out validation: for each year `y` in the overlap with `Σ M ≥ 20`, compute `k` without that year and `err_y = |k·ΣV_y − ΣM_y| / ΣM_y`. The median (`loyo_annual_mape`) and the maximum are reported.
- `monthly_mape`: median of `|k·V(m) − M(m)| / M(m)` over overlap months with `M(m) ≥ 10`.

## Harmonized series (MODIS-equivalent cell-days)

`basis` parameter:

| `basis` | `harmonized(m)` | `source` |
|---|---|---|
| `modis_primary` (default) | `M(m)` if MODIS has coverage that month; otherwise `k · V(m)` | `modis` / `viirs_scaled` |
| `viirs_primary` (simulates the end of MODIS) | `k · V(m)` for `m ≥ 2012-02`; `M(m)` before | `viirs_scaled` / `modis` |

Round to 1 decimal. If no sensor has coverage, `harmonized = null` and `status = "no_data"`.

## Flags per month (`flags`)

| Code | When |
|---|---|
| `terra_only` | before 2002-07 (a single MODIS satellite) |
| `modis_outage` | the month has ≥ 3 days with Terra and Aqua down at the same time, or it is in the FIRMS Readme list: 2001-06, 2001-07, 2007-08, 2009-04 |
| `viirs_outage` | the reference VIIRS and its backup are missing ≥ 3 days of the month |
| `nrt` | the month includes `source = nrt` (provisional) data |
| `partial_month` | the month is not complete (current month or truncated coverage) |
| `no_coverage` | there are no files for that country and month (today: November–December 2026) |

## Baseline and anomaly

For month `m` of year `y`:

- **Baseline** = `harmonized` values of the same calendar month in all the other years of the queried range, excluding those with `modis_outage`, `viirs_outage`, `partial_month` or `no_coverage`.
- At least 10 years are needed; with fewer, `status = "insufficient_baseline"`.
- `median`, `p25`, `p75`, `p90`, `n_years` are reported.
- `anomaly_ratio = harmonized / median` (`null` if the median is 0 or the month has `partial_month`).
- **Partial month** (decided Nov 14): a month with `partial_month` keeps its `harmonized` (what has been observed so far) and its `baseline`, but `status = "no_data"` and `anomaly_ratio = null`. Comparing a few days against full months would make it always look `below` or `normal`. Today this affects November 2026 (Mexico only has data for day 1).

| `status` | Condition |
|---|---|
| `no_data` | `harmonized` is `null`, **or the month has `partial_month`** |
| `insufficient_baseline` | fewer than 10 baseline years |
| `below` | `harmonized < p25` |
| `normal` | `p25 ≤ harmonized ≤ p75` |
| `above` | `p75 < harmonized ≤ p90` |
| `critical` | `harmonized > p90` |

## Outage detection (ETL)

For each satellite and country: consecutive days with **zero** detections across the whole country within its operational period → a row in `sensor_outage` with `origin = 'detected'`. Operational periods: Terra from 2000-11-01, Aqua from 2002-07-04, SNPP 2012-01-20 to 2026-11-02, N20 from 2018-04-01, N21 from 2024-01-17.

## Known limits

- Conversion error measured with the API (Nov 14): annual (median leaving one year out) 6 % in the full Querétaro box, 10 % in the Bajío and 17 % in Sierra Gorda; monthly 33–37 %. That is why the status is given by percentiles and monthly precision is not promised.
- The static-source mask only uses `type = 2`. Offshore platforms (`type = 3`) and volcanoes (`type = 1`) are not filtered in NRT data: coastal cells had more real fire detections (2,938) than platform detections (2,180) since 2024.
- The mask, validated on 2024–2026 with known `type`, catches 94 % (MODIS) and 99.9 % (VIIRS) of static sources and wrongly removes ~2 % of real fire. In Querétaro it over-masks during the rainy season.
- Some quiet days are recorded as a Terra or Aqua "outage". In Mexico they only flag 2001-06/07 and 2002-03, which coincide with real Terra failures and already carry `terra_only`.
- With `basis = viirs_primary` (no MODIS), the **annual** series changes little (median 6–16 % depending on the preset), but the **monthly status** matches in only ~55 % of the months in 2012–2025; in ~90 % it is within one level. Measured Nov 14 on the 3 presets.
- `k` depends on the region and the type of fire; there is no global value.
- Before July 2002 only Terra was observing: those months undercount.
- The 0.01° grid is not equal-area: a cell is ~13 % smaller in northern Mexico than in the south.
- Terra passes mid-morning and VIIRS does not: when MODIS shuts down that window is lost and `k` only absorbs the average.
