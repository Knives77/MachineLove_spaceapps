# Project context

## 1. The challenge

**NASA Space Apps Challenge 2026 — Harmonization of MODIS and VIIRS Hot Spots.** Intermediate/advanced difficulty. Author: Marina Compagnucci (CONAE, Argentina).

Satellites have detected hot spots since 2000, but with two sensor families that cannot be compared directly:

| | MODIS (Terra, Aqua) | VIIRS (S-NPP, NOAA-20, NOAA-21) |
|---|---|---|
| Available | Terra Nov 2000, Aqua Jul 2002 → today, near end of life | S-NPP Jan 2012 → Nov 2, 2026 (ceased). NOAA-20 Apr 2018 →. NOAA-21 2024 → |
| Nominal pixel | 1 km (up to 4.8 × 2 km at the swath edge) | 375 m (up to ~0.8 km) |
| Sensitivity | Does not see small fires (median FRP 18 MW in Mexico) | Sees small fires (median FRP ~5 MW) |
| Overpass time | Terra ~10:30, Aqua ~13:30 | ~13:30 |

What is asked for: (1) harmonize both records into a consistent series and (2) a web application with a **burn activity calendar** (year × month matrix) where the user picks a region and a date range, sees seasonal patterns, extreme years and how the current month compares with the historical median, and downloads a CSV.

Users: early warning and emergency response teams, scientists, land managers, fire brigades.

Awards we aim for: Best Use of Science (validated method), Best Use of Data (26 years of FIRMS), Local Impact (Querétaro).

Official case in the challenge video: the Chilecito fire, La Rioja, Argentina (CONAE activation ACT#356, Jul 28 to Aug 2, 2026; affected area 6,549 → 9,158 → 11,655 ha).

## 2. Data on disk

| Folder | Contents | Coverage |
|---|---|---|
| `data/historico_pais/{Mexico,Argentina}/modis/` | CSV per year, FIRMS "country" | 2000-11 → 2025-12 |
| `data/historico_pais/.../viirs-snpp/` | same, S-NPP | 2012-01-20 → 2025-12 |
| `data/historico_pais/.../viirs-jpss1/` | same, NOAA-20 | 2018 → 2025-12 |
| `data/México-Querétaro/*/` | FIRMS requests 844352–844355, all of Mexico, 4 sensors | 2024-01-01 → 2026-11-01 |
| `data/Argentina/*/` | Requests 849410–849413, all of Argentina (outside the MVP) | 2026-01-01 → 2026-11-14 |

- NOAA-21 does not exist in the per-country format; we only have it for 2024–2026 in the requests.
- All of Argentina 2026 is already loaded (Nov 14). The old Jul–Aug CSVs were left in `data/_anterior/`.
- Full profiling of the requests: `docs/reference/DATA_PROFILING_FIRMS.md`.

The two formats have different columns; the details are in `docs/contracts/ingest.md`.

## 3. What we measured (Nov 14, 0.01° grid, `type = 0` only)

### The artificial jump exists and it is large

Querétaro box (lat 20.0–21.7, lon −100.6 to −99.0):

| Year | Raw points, all sensors | MODIS cell-days | S-NPP cell-days | NOAA-20 cell-days |
|---|---:|---:|---:|---:|
| 2011 | 423 | 410 | — | — |
| 2012 | 904 | 190 | 557 | — |
| 2017 | 2,352 | 416 | 1,486 | — |
| 2019 | 4,554 | 414 | 1,374 | 1,409 |
| 2025 | 5,295 | 562 | 1,688 | 1,702 |

Raw points say 2019 was 11 times 2011. MODIS, which observed both years the same way, says they were equal (410 vs 414).

### What each step corrects

| Comparison against MODIS (Querétaro 2024–2026) | Ratio |
|---|---:|
| Raw points, 3 VIIRS added together | 12.6× |
| Cell-days, 3 VIIRS combined | 7.4× |
| Cell-days, a single VIIRS | 3.2× |

The grid removes duplication from resolution, using a single reference VIIRS removes duplication from the constellation, and what remains (≈3×) is sensitivity: that is corrected with calibration.

### The VIIRS instruments are interchangeable

NOAA-20 / S-NPP ratio in cell-days, Apr 2018 to 2025: Querétaro 1.016, Sierra Gorda 1.008, Chilecito 1.001. Monthly correlation 0.98–0.99. The S-NPP → NOAA-20 handover needs no correction.

### MODIS ↔ VIIRS calibration over the 2012–2025 overlap (167 months)

`k = Σ MODIS cell-days / Σ S-NPP cell-days`

| Region | k | Annual error, leaving one year out (median / max.) | Median monthly error |
|---|---:|---:|---:|
| Querétaro box | 0.293 | 6.8% / 13.7% | 29.8% |
| Sierra Gorda (lat > 20.9) | 0.262 | 14.7% / 42.6% | 38.8% |
| Bajío (lat 20.0–20.9) | 0.307 | not measured | not measured |
| Chilecito, Argentina (phase 2) | 0.395 | 23.7% / 55.1% | 28.9% |

- **k changes by region**, even within Querétaro (0.26 Sierra Gorda, 0.31 Bajío; 0.40 in Chilecito): it is computed for the queried area, not globally.
- We tried a log-log regression and it **did not improve** on the regional factor (Querétaro: 8.8% annual versus 6.8%; Sierra Gorda 29.4% versus 14.7%). Discarded for now.
- The monthly error (~30%) is high because monthly counts are small. It has to be shown, not hidden: the calendar classifies by percentiles and the interface shows the validation error.

## 4. Closed decisions

| Topic | Decision |
|---|---|
| Where it runs | Everything on a single machine: database, API and frontend on `127.0.0.1`. No cloud deployment |
| Data | Downloaded files only. No live FIRMS API |
| Coverage | **Mexico only in the MVP** (decided Nov 14). Presets: Sierra Gorda, Querétaro Bajío, Querétaro box. Free polygon inside Mexico. Argentina is loaded but outside the MVP: phase 2 = Chilecito, phase 3 = other countries |
| Processing | Python 3.12, `uv`, polars, psycopg `COPY` |
| Database | PostgreSQL 16 + PostGIS in `podman` (no Docker) |
| Backend | FastAPI |
| Frontend | Figma Make → React + Vite + Tailwind, bilingual ES/EN with a selector |
| Grid | 0.01° × 0.01° (~1.1 × 1.0 km). No H3: one less dependency, and it is the grid we validated with |
| Harmonization | Cell-days + one reference VIIRS + a per-region factor `k` calibrated over the overlap. Output unit: **MODIS-equivalent cell-days** |
| Team | 2 frontend, 2 processing, 1 backend, 1 analyst/liaison. Basic Python level: the code is written by agents |
| Static-source mask | `type = 2` only (≥ 3 dates). `type = 1/3` are not added: coastal cells have more real fire than platforms (measured Nov 14) |
| False outages on quiet days | Accepted: they only flag months in 2001–2002, which are already `terra_only` |

## 5. Corrections to the earlier conversation with Gemini

| What it said | What we found |
|---|---|
| "You don't need to download more data" | With 2024–2026 there is no historical median and no visible jump. 2000–2025 has been downloaded |
| k = 4.22 (VIIRS points / MODIS points) as the official factor | That is a ratio of raw points over 31 months. Calibration is done on cell-days and per region |
| "Divide by k and weight by FRP" | It was never defined as a formula. FRP is out of the MVP method; it remains an optional secondary metric |
| Regression/quantile mapping as an obvious improvement | Measured: the log-log regression does not beat the regional factor |
| H3 resolution 8 | Replaced by the 0.01° grid |
| Docker + `postgis:16-3.4-alpine` | There is no Docker; podman is used |
| The `type = 2` in southern Querétaro is Tula | Not verified. Do not claim it without checking it on the map |
| NOAA-20/21 have no `archive` file (Readme) | They do, and they carry `type` |
| "Chilecito exceeds the historical P90" | It had not been computed. It can be claimed or not once the ETL loads Argentina 2000–2026 |
