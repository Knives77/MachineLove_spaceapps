# MachineLove · NASA Space Apps 2026

**Harmonization of MODIS and VIIRS Hot Spots.** A burn activity calendar where it does not matter which satellite took the data: each month is compared against its own history (2000–2026) to tell whether it is normal or anomalous. MVP: Mexico.

## The problem

Satellites have counted fire hot spots since 2000, but the record is split between two sensor families that cannot be compared directly. MODIS (Terra and Aqua, 1 km pixels) has the long history and is near the end of its operational life; VIIRS (S-NPP, NOAA-20 and NOAA-21, 375 m pixels) has existed since 2012 and sees the same fire as many more points. If the points are simply added up, fire in the Querétaro Bajío appears to multiply ×14.7 between 2011 and 2019, when what actually changed was the sensor. As a result, fire managers cannot tell whether the current month is normal or anomalous against the history of their area.

## Goals

**Overall.** A web application that harmonizes MODIS and VIIRS hot spots (NASA FIRMS) into a consistent burn activity calendar from 2000 to today, so that anyone can see whether this month's fire in their area is normal or anomalous against its own history, regardless of which satellite took the data.

**Specific.**

1. Put MODIS and VIIRS on a single scale and measure how wrong that conversion can be.
2. Show, for an area of interest, a year × month calendar from 2000 to 2026: which months burn the most and which years had the most activity.
3. Compare each month against the historical median of the same month and classify it as Low, Normal, High or Extreme, without confusing "no data" with zero.
4. Let the user choose the area with example regions, by drawing on the map, or by latitude and longitude.
5. Download the results: hot spots CSV and calendar CSV.
6. Keep working when MODIS stops operating.
7. Be accessible: colorblind-safe palettes, the level written out in addition to color, Spanish and English.

**Who it is for:** civil protection agencies, CONAFOR (Mexico's national forestry commission), fire brigades, protected natural areas and scientists. MVP: Mexico; Argentina is already loaded for phase 2.

## Proposed solution

1. **Data.** FIRMS MODIS C6.1 and VIIRS C2 (S-NPP, NOAA-20, NOAA-21) for Mexico, 2000–2026: 9.5 million detections in PostgreSQL + PostGIS.
2. **Cleaning.** Static sources are flagged (cells classified as a static source on 3 or more dates: industry, not vegetation) and each satellite's outages are detected. A month with an outage carries a flag and does not enter the history.
3. **Count places, not points.** The unit is the cell-day: a 0.01° cell (~1 km) with at least one vegetation hot spot that day. A finer sensor can no longer inflate the count. A single reference VIIRS is used each day (S-NPP before April 2018, NOAA-20 after, with a backup if one fails).
4. **Measured factor k.** k = MODIS cell-days / VIIRS cell-days over the 167 months when both operated (Feb 2012 to Dec 2025), computed for the area the user picks (or for the country if there is too little data). Validated by leaving one year out: 6–17 % annual error depending on the region and ~35 % monthly. Across 15 places in Mexico, k ranges from 0.21 to 0.38, which is why a fixed factor is not used.
5. **Each month against its history.** The median and percentiles of the same month in the other years (at least 10) define the level and how many times the median the month is worth.
6. **A future without MODIS.** With "Simulate the end of MODIS" the series uses VIIRS × k from 2012 on: in the Bajío the annual total changes 9 % (median) and the monthly level stays the same or one step away in 89 % of months.
7. **The app.** Python ETL → FastAPI API → React + MapLibre. Expert view: 3D map with the selected month's fire and a card for each point (satellite, date, power), tile calendar, yearly bars, coordinate search, raw/harmonized mode, k-factor inspector and downloads. It responds in 0.2 s or less.

**Result.** With the method, the false jump in the Bajío drops from ×14.7 (raw points) to ×1.07 (harmonized cell-days), and February 2026 shows up as the month with the most fire in 26 years: 150 cell-days, 5 times the median.

**Declared limits.** A cloudy month can look like "little fire"; the monthly error (~35 %) means levels should be read, not exact figures; it does not predict fires: it compares each month with its history.

## Structure

```
etl/        FIRMS ingestion, static-source mask, sensor outages, cell-days, calibration
backend/    FastAPI API: /presets, /calendar, /calendar.csv, /hotspots, /hotspots.csv
web/        React + Vite + Tailwind + MapLibre frontend
docs/       user guide, architecture, results, context and contracts (docs/contracts/)
scripts/    database (Postgres + PostGIS), data download, result figures
data/       FIRMS CSV files (not in Git; downloaded with the scripts)
```

`etl/` and `backend/` share the same `pyproject.toml` (Python 3.12+, `uv`).

## How to run it

Requirements: podman, `uv`, Node 24, `pnpm` and `unzip`.

```bash
scripts/db_up.sh                                   # Postgres + PostGIS on 127.0.0.1:5432
psql postgresql://firms:firms_local@127.0.0.1:5432/firms -f docs/contracts/db_schema.sql
scripts/download_history.sh                        # FIRMS history 2000–2025 into data/
scripts/download_requests.sh MX                    # 2024–2026 requests (GitHub release)
uv run python -m etl.run --all                     # full ETL
uv run uvicorn backend.main:app --port 8000        # API
cp web/.env.example web/.env                       # then set VITE_API_URL=http://localhost:8000/api/v1
pnpm install --frozen-lockfile && pnpm dev         # frontend at http://localhost:5173
```

Without `VITE_API_URL`, the frontend runs on its own with sample data. Details of each step: [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md).

Tests: `uv run pytest etl backend` and `uv run python -m etl.verify`.

## Documentation

| To | Read |
|---|---|
| Use the application | [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) |
| Understand how it is built | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| See the results | [`docs/RESULTS.md`](docs/RESULTS.md) |
| Understand the challenge, the data and the decisions | [`docs/CONTEXT.md`](docs/CONTEXT.md) |
| Get the exact formulas, schemas and API | [`docs/contracts/README.md`](docs/contracts/README.md) |
| Populate the database | [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md) |
| Look inside the API | [`backend/README.md`](backend/README.md), [`backend/OPTIMIZATION_AND_CACHE.md`](backend/OPTIMIZATION_AND_CACHE.md) |
| See the FIRMS data profiling | [`docs/reference/DATA_PROFILING_FIRMS.md`](docs/reference/DATA_PROFILING_FIRMS.md) |

Data: NASA FIRMS (MODIS C6.1, VIIRS C2). We acknowledge the use of data from NASA's FIRMS, part of LANCE.
