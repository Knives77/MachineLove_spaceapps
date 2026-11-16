# Ingestion contract: from the FIRMS CSVs to `detection`

Ingestion loads Mexico and Argentina; **the MVP only uses Mexico** (Argentina is phase 2).

## Sources and precedence

| Source | Path | Used for |
|---|---|---|
| A. By country and year | `data/historico_pais/<Pais>/<sensor>/<sensor>_<año>_<Pais>.csv` | Everything up to **2025-12-31** |
| B. `archive` requests | `data/México-Querétaro/*/fire_archive_*.csv`, `data/Argentina/*/fire_archive_*.csv` | Only rows with `acq_date >= 2026-01-01` |
| C. `nrt` requests | `.../fire_nrt_*.csv` | Only rows with `acq_date >= 2026-01-01` |

Rows in B and C before 2026 are discarded (they are already in A), except **NOAA-21 2024–2025**, which does not exist in A and is loaded from B.

The paths have accents (`México-Querétaro`) and a typo (`J1-VIRS-C2`): search with wildcards, do not type the path by hand.

## Real schemas

| Canonical column | Source A MODIS | Source A VIIRS | Sources B and C (all) |
|---|---|---|---|
| `latitude`, `longitude` | same | same | same |
| `brightness` | `brightness` | **`bright_ti4`** | `brightness` |
| `bright_t31` | `bright_t31` | **`bright_ti5`** | `bright_t31` |
| `scan`, `track`, `acq_date`, `acq_time`, `frp`, `daynight`, `confidence`, `version` | same | same | same |
| `satellite` | `Terra`, `Aqua` | S-NPP = **`N`**, NOAA-20 = `N20` | `Terra`, `Aqua`, `SNPP`, `N20`, `N21` |
| `instrument` | `MODIS` | `VIIRS` | S-NPP carries **`SNPP`** |
| `type` | yes | yes | `archive` yes; **`nrt` does not have the column** |

Always read by column name, never by position.

## Mandatory normalization

| Target field | Rule |
|---|---|
| `satellite` | `N` → `SNPP`. Final values: `Terra`, `Aqua`, `SNPP`, `N20`, `N21` |
| `family` | `MODIS` if Terra/Aqua, otherwise `VIIRS`. **Do not use the `instrument` column** |
| `acq_time` | Read as text, 4 characters `HHMM`. As a number it loses its zeros (`0055` → `55`) |
| `acq_ts` | `acq_date` + `acq_time` in UTC |
| `confidence_raw` | Text as is (`0`–`100` in MODIS; `l`/`n`/`h` in VIIRS) |
| `type` | Integer or `NULL` (NRT) |
| `source` | `country`, `archive` or `nrt` |
| `country` | `MX` or `AR` |
| `cy`, `cx` | `floor(latitude * 100)`, `floor(longitude * 100)` as integers. Careful: `floor`, not truncate (longitudes are negative) |
| `is_veg` | See below |

Do not use a natural primary key: there are rows with the same (lat, lon, date, time, satellite) and a different FRP.

## Vegetation fire (`is_veg`)

- `type = 0` → `true`
- `type` in (1, 2, 3) → `false`
- `type IS NULL` (NRT) → `true` unless the cell is in `static_cell`

## Static mask (`static_cell`)

A cell `(cy, cx)` is static if it has detections with `type = 2` on **at least 3 different dates** (any satellite, any year). The number of dates is stored too.

## Expected volume

Mexico and Argentina, 2000–2026: on the order of 20 million CSV rows (1.4 GB). Load with `COPY`, create indexes at the end.

## Verifying the ingestion

See `acceptance.md`, ETL section.
