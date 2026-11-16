# Architecture

How the system is built: what its parts are, what each one does, how a piece of data travels from the FIRMS CSV to the screen, and why it was designed this way. To use the application, see [`USER_GUIDE.md`](USER_GUIDE.md). The exact formulas and schemas live in [`contracts/`](contracts/README.md); this document summarizes and connects them, it does not replace them.

## 1. Overview

```
   NASA FIRMS (CSV)                      A single machine (everything on 127.0.0.1)
 ┌──────────────────┐    ┌────────────────────────────────────────────────────────────────┐
 │ MODIS C6.1       │    │                                                                │
 │ VIIRS C2         │    │  data/*.csv ──▶ ETL (Python, 5 steps) ──▶ PostgreSQL + PostGIS │
 │ S-NPP, N20, N21  │───▶│   1.4 GB         etl/                      podman, :5432       │
 └──────────────────┘    │                                                │               │
                         │                                                ▼ SELECT        │
                         │                               FastAPI API (backend/, :8000)    │
                         │                               calibrates k, builds the calendar│
                         │                                                │ JSON / CSV    │
                         │                                                ▼               │
                         │                         React + MapLibre frontend (web/, :5173)│
                         │                         only draws what the API returns        │
                         └────────────────────────────────────────────────────────────────┘
                                                                          ▲
                           base map and terrain: tiles from the internet ─┘
```

Three layers, each with a single responsibility:

| Layer | Folder | Does | Does not |
|---|---|---|---|
| ETL | `etl/` | Reads the CSVs, normalizes, flags static sources and sensor outages, aggregates to cell-days, computes the fallback `k` per country | Serve requests |
| API | `backend/` | Receives an area, computes `k`, the harmonized series, the baseline and each month's level; returns JSON and CSV | Write to the database (`SELECT` only) |
| Frontend | `web/` | Map, calendar, time console, ES/EN translation, downloads | Compute harmonization: it only draws |

Ports: Postgres on 5432, API on 8000 and frontend on 5173, all on `127.0.0.1`.

## 2. Technologies

| Part | Technology |
|---|---|
| Database | PostgreSQL 16 + PostGIS 3.4 in a podman container (`firms_postgis`) |
| ETL | Python 3.12, `polars` (CSV reading), `psycopg` 3 (`COPY`), server-side SQL |
| API | FastAPI, Pydantic v2, `psycopg` 3, `shapely`, `uvicorn` |
| Frontend | React 18, TypeScript, Vite 6, Tailwind 4, `maplibre-gl` (WebGL), `motion` |
| Package managers | `uv` for Python (one `pyproject.toml` for ETL and API), `pnpm` (workspace at the root that groups `web/`), Node 24 |
| Base map | OpenFreeMap vector tiles and Terrarium terrain (elevation) |

## 3. The data

### 3.1 Sources

NASA FIRMS detections for Mexico and Argentina, 2000–2026 (the MVP only uses Mexico):

| Source | What it covers | Where it lands |
|---|---|---|
| A. By country and year | Everything up to 2025-12-31 | `data/historico_pais/` (`scripts/download_history.sh`) |
| B. `archive` requests | 2026 (and NOAA-21 2024–2025, which is not in A) | `data/México-Querétaro/`, `data/Argentina/` (`scripts/download_requests.sh`) |
| C. `nrt` requests | 2026, provisional, without a `type` column | Same as B |

The three schemas differ (column names, satellite codes). The precedence rule and the normalization are in [`contracts/ingest.md`](contracts/ingest.md).

### 3.2 Data model

Seven tables ([`contracts/db_schema.sql`](contracts/db_schema.sql)):

```
detection ──(cy,cx)──▶ cell ◀──(cy,cx)── cell_day          preset (3 example regions)
  one row per          catalog of         one row per      sensor_outage (days without data)
  hot spot             cells with geom    cell and date    calibration_country (k per country)
     │                                                     static_cell (static sources)
     └── feeds raw mode, the CSV and the points on the map
```

| Table | Rows (Nov 14) | Purpose |
|---|---:|---|
| `detection` | 16.2 million (9.5 for Mexico) | Every normalized hot spot. Raw mode, hot spots CSV, points on the map |
| `cell` | 1.48 million | Center of each 0.01° cell with any detection; this is what is intersected with the polygon (GiST index) |
| `cell_day` | 8.7 million | **The unit of activity.** One row per cell and date, with `modis_veg` and `viirs_veg` |
| `static_cell` | 3,111 | Cells with a recurring static source (industry) |
| `sensor_outage` | 463 | Ranges of days without data per satellite and country |
| `calibration_country` | 2 | Fallback national `k` (Mexico 0.3323) |
| `preset` | 3 | Sierra Gorda, Querétaro Bajío and the Querétaro box |

How to populate, back up or restore it: [`DATABASE_SETUP.md`](DATABASE_SETUP.md).

### 3.3 The cell-day

A cell is a 0.01° × 0.01° square (~1 km): `cy = floor(lat·100)`, `cx = floor(lon·100)`. A **cell-day** is a cell with at least one vegetation detection on a given date. Ten points in the same cell on the same day count once.

This is the central decision of the project: VIIRS (375 m pixels) puts several points where MODIS (1 km) puts one. Counting cell-days instead of points removes that resolution difference before the sensors are compared.

## 4. ETL (`etl/`)

Five steps; each one deletes and regenerates its own output (it can be repeated without duplicating):

| Step | Module | Input → output | What it does |
|---|---|---|---|
| 1 | `ingest.py` | CSV → `detection` | Reads by column name, normalizes satellite (`N` → `SNPP`), family, `HHMM` time, `cy`/`cx`; applies source precedence; loads with `COPY` and creates indexes at the end |
| 2 | `mask.py` | `detection` → `static_cell` | A cell with `type = 2` on 3 or more dates = static source. NRT detections (no `type`) in those cells stop counting as vegetation |
| 3 | `outages.py` | `detection` → `sensor_outage` | Consecutive days with zero detections from a satellite across the whole country within its operational period, plus the gaps in the FIRMS Readme and the days without files |
| 4 | `cells.py` | `detection` → `cell`, `cell_day` | Aggregates to cell-days. `viirs_veg` uses a single **reference VIIRS** per day (`reference.py`) |
| 5 | `calibrate.py` | `cell_day` → `calibration_country` | `k` per country, with leave-one-year-out validation |

**Reference VIIRS.** Three VIIRS instruments fly today; adding them up would triple the count. One is used each day: S-NPP before 2018-04-01, NOAA-20 after; if that one has an outage the other is used, and if both are missing, NOAA-21.

Commands:

```bash
uv run python -m etl.run --all                 # all 5 steps
uv run python -m etl.run --step 4              # a single step
uv run python -m etl.verify                    # control figures (54 checks)
uv run python -m etl.verify --sandbox          # runs 4 and 5 in temporary tables, writes nothing
```

Step 1 needs the CSVs on disk (1.4 GB); the others read from the database. Configuration through environment variables (`etl/config.py`): `DATABASE_URL` and `FIRMS_DATA_DIR`.

## 5. Harmonization

Everything is computed **inside the queried area** and per month. Full specification: [`contracts/harmonization.md`](contracts/harmonization.md).

```
M(m) = MODIS cell-days in the month       V(m) = cell-days of the reference VIIRS

1. Overlap       months from 2012-02 to 2025-12 without a MODIS or VIIRS outage  (167 months)
2. Factor k      k = Σ M(m) / Σ V(m)  over the overlap
                 if Σ M < 100 in the area  →  the country's k is used  (scope = "country")
3. Series        modis_primary:  M(m); if MODIS has no coverage, k · V(m)
                 viirs_primary:  k · V(m) from 2012-02; M(m) before   ("Simulate the end of MODIS")
4. Baseline      same calendar month in the other years, excluding months with an outage,
                 partial months or no coverage; at least 10 years  →  median, p25, p75, p90
5. Level         < p25 low · p25–p75 normal · p75–p90 high · > p90 extreme
6. Ratio         anomaly_ratio = value / median
```

**Validating the factor.** For each year in the overlap, `k` is recomputed without that year and the error in predicting it is measured (`loyo_annual_mape` is the median, `loyo_annual_max` the worst year). `monthly_mape` is the typical error of a single month. Measured: 6–17 % annual depending on the region, 33–37 % monthly. That is why the status is given by percentiles and monthly precision is not promised.

**No data is not zero.** A month with a sensor outage, an incomplete month or a month without files carries a flag (`modis_outage`, `viirs_outage`, `partial_month`, `no_coverage`, plus `terra_only` and `nrt`) and does not enter the median of the other months.

**What is not in the formula.** Neither fire radiative power (FRP), nor brightness temperature, nor confidence. What is measured is the extent and persistence of activity, not intensity or burned area. FRP is stored and only used to draw the points on the map.

## 6. API (`backend/`)

Base `http://localhost:8000/api/v1`. Contract: [`contracts/api.md`](contracts/api.md).

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | Status and date of the latest data |
| GET | `/presets` | The 3 example regions (GeoJSON) |
| POST | `/calendar` | The full calendar for an area: calibration, 324 months, yearly totals, seasonality |
| POST | `/calendar.csv` | The same as CSV, one row per month |
| POST | `/hotspots.csv` | Raw detections in the area for a date range, streamed (max. 2,000,000 rows) |
| POST | `/hotspots` | GeoJSON points for the map (max. 62 days and 20,000 points) |

The area (`aoi`) is a `preset_id` or a GeoJSON polygon of up to 200,000 km² that touches Mexico.

### Modules

| File | Responsibility |
|---|---|
| `main.py` | FastAPI application, CORS for `localhost`, gzip compression, errors in the `{"error": {"code", "detail"}}` format |
| `models.py` | Strict Pydantic schemas for requests and responses |
| `aoi.py` | Polygon validation, maximum area, Mexico coverage |
| `queries.py` | Parameterized SQL over PostGIS; server-side cursor for the streamed CSV |
| `harmonize.py` | Pure logic (no database, no FastAPI): `k`, validation, series, flags, baseline, level |
| `routes.py` | Endpoints, in-memory cache and `API_MOCK=1` mode |

### Life of a `POST /calendar` request

1. **Validate the area** (`aoi.py`): valid geometry, ≤ 200,000 km², touches cells in Mexico. Otherwise: 400 or 422.
2. **One aggregate query** (`queries.py`): intersects `cell` (by geometry) with `cell_day` and returns `M(m)`, `V(m)` and raw points per month. Outages, the country's `k` and provisional months come from a per-country cache.
3. **Harmonize in memory** (`harmonize.py`): overlap, `k`, validation, series, flags, baseline and level for the 324 months.
4. **Respond** with compressed JSON (~6.5 KB).

### Performance

In-memory cache with the standard library (no Redis, no background tasks), described in [`../backend/OPTIMIZATION_AND_CACHE.md`](../backend/OPTIMIZATION_AND_CACHE.md):

- The inputs for each area are kept for 10 minutes: switching to "Simulate the end of MODIS", changing the range or downloading the CSV does not query the database again.
- A per-area lock prevents two simultaneous requests from running the same query.
- Measured: cold preset 0.25 s, cold free polygon 0.13 s, repeated requests < 0.1 s. Contract target: < 2 s and < 8 s.

### Errors

The API returns **codes**, never sentences; the frontend translates.

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_geometry`, `aoi_too_large`, `invalid_range` | Malformed request or area too large |
| 404 | `unknown_preset` | Nonexistent region |
| 422 | `aoi_outside_coverage` | The area does not touch Mexico |
| 503 | `db_unavailable` | The database does not respond |

## 7. Frontend (`web/`)

A single-page application with no router: global state decides which view is shown.

```
web/src/
  main.tsx, App.tsx      startup and shell (active view + bottom bar)
  state.tsx              global state (React context) and calendar cache
  api.ts                 the ONLY door to the API; without VITE_API_URL it uses the mocks
  types.ts               types of the API contract
  i18n/                  es.ts, en.ts (same keys) and translate()
  theme/tokens.ts        every color (mirrored in index.css)
  lib/                   color, formatting, geometry, sound, bottom-bar telemetry
  views/expert/          Expert console: map, month readout, time console, calendar
  views/Learn.tsx        Learn view (4 steps and a quiz)
  views/General.tsx, Edu.tsx   views still in the code, outside the menu
  components/            calendar, yearly bars, k inspector, downloads, menus
  components/map/        MapLibre map: layers, fire, point card, drawing, tools
  mocks/                 sample responses copied from the real API
```

### Code design rules

- **No component calls `fetch`.** Everything goes through `api.ts`.
- **No harmonization math.** What is shown comes from the `/calendar` response.
- **No hand-written colors.** They all come from `theme/tokens.ts`.
- **No hard-coded text.** API codes (`status`, `flags`, errors) are translated with `i18n/`.
- **Map with `maplibre-gl` only**, camera with native `fitBounds`/`easeTo`, no manual animation loops.

### Global state (`state.tsx`)

A single context with: language, view, mode (harmonized or raw), basis (`modis_primary` or `viirs_primary`), palette, sound, selected area, selected month and the loaded calendar. Language, palette and sound are remembered in `localStorage`.

On startup it requests `/presets` and preloads the calendars of the three regions, with and without MODIS, so that switching between them is instant. Calendars already requested are kept in memory by area and basis.

### Flow of an interaction

```
pick a region / draw an area ──▶ setAoi ──▶ POST /calendar ──▶ calendar, bars, readout, console
pick a month                 ──▶ setSelected ──▶ POST /hotspots (that month) ──▶ fire and points on the map
"Switch MODIS off"           ──▶ setBasis(viirs_primary) ──▶ POST /calendar (no SQL: backend cache)
Harmonized / Raw             ──▶ setMode ──▶ same response, other column (harmonized / raw_points)
```

### Running without a backend

With an empty `VITE_API_URL`, `api.ts` returns the mocks in `src/mocks/` (copies of the real API generated with `scripts/snapshot_mocks.py`). The bottom bar says "DEMO (mocks)". This is useful for working on the frontend without an API or a database.

### Network dependency

The base map (OpenFreeMap) and the 3D terrain (Terrarium tiles) are requested from the internet. Offline, the calendar, the console and the downloads keep working against the local API, but the map background does not load.

## 8. Configuration

| Variable | Read by | Default |
|---|---|---|
| `DATABASE_URL` | ETL and API | `postgresql://firms:firms_local@127.0.0.1:5432/firms` |
| `FIRMS_DATA_DIR` | ETL | `data/` at the repo root |
| `API_MOCK` | API | Unset. With `1` it answers with the examples, without a database |
| `VITE_API_URL` | Frontend (`web/.env`) | Empty = mocks. With the API: `http://localhost:8000/api/v1` |

`web/.env` is not committed to Git; the template is `web/.env.example`.

## 9. Getting it running

```bash
scripts/db_up.sh                                # Postgres + PostGIS on 127.0.0.1:5432
scripts/download_history.sh                     # history 2000–2025 into data/
scripts/download_requests.sh MX                 # 2024–2026 requests (GitHub release)
uv run python -m etl.run --all                  # full ETL (or restore a backup: DATABASE_SETUP.md)
uv run uvicorn backend.main:app --port 8000     # API
pnpm install --frozen-lockfile && pnpm dev      # frontend at http://localhost:5173
```

Requirements: podman, `uv`, Node 24, `pnpm` and `unzip`.

## 10. Tests and verification

| What | Command | Covers |
|---|---|---|
| ETL and API tests | `uv run pytest etl backend` | Ingestion, outages, reference VIIRS, calibration, pure harmonization, endpoints and a system simulation |
| Control figures | `uv run python -m etl.verify` | Cell-days per year and region and the expected `k`, against an independent measurement |
| Frontend | `pnpm run build` | Types (`tsc`) and bundling; then a visual check in the browser |
| Result figures | `python3 scripts/pitch_numbers.py` | Regenerates the figures in [`RESULTS.md`](RESULTS.md) from the API |

The control figures and acceptance criteria for each layer are in [`contracts/acceptance.md`](contracts/acceptance.md). No change is considered good without reproducing them.

## 11. Security and access

- The API and Postgres listen only on `127.0.0.1`: they are not exposed to the network.
- The API only runs `SELECT`, with parameterized queries.
- CORS is limited to `localhost` and `127.0.0.1`.
- There is no login and no personal data: all content is public (NASA FIRMS).
- The database credentials are local and for development; a public deployment would need different ones.

## 12. Design decisions

| Decision | Why |
|---|---|
| Count cell-days, not points | Removes the resolution difference between sensors before comparing |
| `k` as a ratio of sums over the overlap | It can be explained in one sentence and anyone can redo it with the CSV |
| `k` per area, with a national fallback | `k` ranges from 0.21 to 0.38 depending on the place: a fixed factor would be wrong |
| One reference VIIRS per day | Three VIIRS in orbit would triple the count |
| Level by percentiles, not by figure | The monthly error (33–37 %) does not allow exact values to be promised |
| Flags instead of zeros | A month without measurement must not look like a month without fire or lower the median |
| Harmonization in the API, per request | The user picks the area; it cannot be precomputed per region |
| The API returns codes | A single place to translate (frontend) and stable responses for tests |
| Contracts before code | ETL, API and frontend are developed in parallel without blocking each other |
| In-memory cache, no extra services | A single machine: fewer parts that can fail |

## 13. Known limits

- A single `k` per area: it does not distinguish season, vegetation type or day and night.
- A single month is approximate; the annual total is reliable.
- The static-source mask only uses `type = 2`; it catches 94 % (MODIS) and 99.9 % (VIIRS) and wrongly removes ~2 % of real fire.
- Before July 2002 only Terra was observing: those months undercount.
- The 0.01° grid is not equal-area (~13 % smaller in northern Mexico than in the south).
- A cloudy month can look like a month with little fire.
- The presets are rectangles, not the official polygons.

Full list: [`contracts/harmonization.md`](contracts/harmonization.md), "Known limits" section.

## 14. Outside the MVP

Argentina and other countries (already loaded in the database for phase 2), login, ML prediction, live data from the FIRMS API, Landsat, geostationary satellites and cloud deployment. Opening another country requires loading its CSVs, running the ETL and removing the coverage restriction in `backend/aoi.py`; the formulas do not change.
