# MODIIRS · NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots

**MVP scope: Mexico only.** Argentina stays loaded in the database for phase 2; after that, the world.

Compass sentence: *it should not matter which satellite took the data, only whether this month's fire is normal or anomalous against its history.*

## Read before writing code

| Document | What for |
|---|---|
| `docs/CONTEXT.md` | The challenge, what we know about the data and the closed decisions |
| `docs/ARCHITECTURE.md` | The three layers, the data model, the harmonization, the life of a request and the design decisions |
| `docs/USER_GUIDE.md` | Application manual: the screen, how to read the calendar, tasks, accessibility and error messages |
| `docs/RESULTS.md` | Figures measured with the API: false jump, `k` and its error, season, series without MODIS |
| `docs/contracts/` | Contracts: ingestion, tables, harmonization, API, examples, acceptance. Index and how they are changed: `docs/contracts/README.md` |
| `docs/DATABASE_SETUP.md` | How to populate the database: from scratch with the ETL or by restoring a backup |
| `.claude/skills/` | Guide per area: `etl`, `backend`, `frontend` |

## Non-negotiable rules

1. **The contracts rule.** If the code needs something different from `docs/contracts/`, the contract is changed first (see `docs/contracts/README.md`) and the code after. Never the other way around.
2. **No invented column names.** The real schemas are in `docs/contracts/ingest.md`.
3. **The unit of activity is the cell-day**, not the point: a 0.01° × 0.01° cell with at least one vegetation detection that day. Raw points only exist for "raw" mode and the CSV.
4. **"No data" is not "zero".** A month with a sensor outage carries a flag and does not enter the historical median.
5. **Outside the MVP:** Argentina and other countries (phase 2), login, ML prediction, live data from the FIRMS API, Landsat, geostationary satellites, 3D maps, cloud deployment.
6. **`data/` is not committed to Git** (1.4 GB). It is regenerated with `scripts/download_history.sh` and `scripts/download_requests.sh`.
7. **All harmonization math lives in the ETL or in the backend's SQL/Python.** The frontend only draws what the API returns.
8. **The API returns codes, not text** (`status: "critical"`, `flags: ["modis_outage"]`). ES/EN translation belongs to the frontend.
9. Python 3.12 with `uv`. Do not install anything globally.
10. Every change is tested against the **control figures** in `docs/contracts/acceptance.md` before saying it works.
11. **Documentation is written in English.**

## Frontend: UI/UX rules (details in `.claude/skills/frontend/`)

- **Map:** `maplibre-gl` only (WebGL). In Expert, native 3D view (tilt + terrain with `setTerrain`), floating toolbar and spread fire (`heatmap` layer) where there were hot spots in the selected month (`POST /hotspots`). No `backdrop-blur` over the map. Camera with native `fitBounds`/`easeTo` and `padding` synchronized with the calendar panel. No manual animation loops.
- **Colors:** they all come from `web/src/theme/tokens.ts` (mirrored in `web/src/index.css`): surfaces `#090D14` / `#111827`, interaction `#38BDF8` / `#F8FAFC`, levels No fires `#64748B`, Low `#A855F7`, Normal `#E06D53`, High `#F97316`, Extreme `#FDE047`, plus the colorblind palette. No hand-written colors in components.
- **Initial view: Expert** (console: map at 100 % of the window, no top bar, with hideable floating panels on the left and right; no global scroll).
- **Progressive disclosure:** a clean `View: Overview` (a 2000–2026 time bar, no sensor tracks, no raw switch or downloads). The technical material goes in Learn, Educational and Expert.
- **Before every frontend commit:** `pnpm run build` and a visual check in the browser (open/close the calendar, switch region).

## Structure

```
etl/        ingestion, static mask, cell-days, calibration
backend/    FastAPI: /presets, /calendar, /hotspots, /hotspots.csv
web/        React + Vite + Tailwind exported from Figma Make (pnpm workspace at the root)
docs/       user guide, architecture, results, context, contracts
scripts/    database, data download, result figures
data/       FIRMS CSV files, not in Git
```

## Commands

```bash
scripts/db_up.sh                 # Postgres + PostGIS in podman, port 127.0.0.1:5432
scripts/download_history.sh      # FIRMS CSV per country and year into data/historico_pais/ (2000–2025)
scripts/download_requests.sh     # MX 2024–2026 and AR 2026 requests from the GitHub release
uv run python -m etl.run --all   # full ETL (step 1 needs the CSVs in data/)
uv run python -m etl.verify      # ETL control figures
uv run pytest etl backend        # tests
uv run uvicorn backend.main:app --port 8000
pnpm install --frozen-lockfile   # from the root: installs web/
pnpm dev                         # frontend at http://localhost:5173
python3 scripts/pitch_numbers.py # figures in docs/RESULTS.md from the API
```
