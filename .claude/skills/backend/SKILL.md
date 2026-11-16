---
name: backend
description: Guide for building or modifying the FastAPI backend (backend/ folder) - /presets, /calendar, /calendar.csv and /hotspots.csv endpoints over Postgres + PostGIS. Use it before touching any file in backend/.
---

# FastAPI backend

The specification is `docs/contracts/api.md` (shape of requests and responses) and `docs/contracts/harmonization.md` (formulas). The tables are in `docs/contracts/db_schema.sql`. Do not invent fields.

## Environment

```bash
uv add fastapi "uvicorn[standard]" "psycopg[binary,pool]" pydantic shapely pytest httpx
export DATABASE_URL=postgresql://firms:firms_local@localhost:5432/firms
uv run uvicorn backend.main:app --reload --port 8001     # development
uv run uvicorn backend.main:app --port 8000              # stable, the one the frontend uses
```

## Files

| File | Contents |
|---|---|
| `backend/main.py` | App, CORS (`http://localhost:*`), error handler with the `{"error": {code, detail}}` shape |
| `backend/models.py` | Pydantic models identical to the contract |
| `backend/aoi.py` | Resolve `preset_id` or `geometry`, validate, area, country |
| `backend/queries.py` | SQL |
| `backend/harmonize.py` | `k`, series, baseline, statuses. Pure functions, no database |
| `backend/routes.py` | The endpoints |
| `backend/tests/` | Tests |

## Working before the database exists

Without a loaded database there is no data. Start with `backend/harmonize.py` and its tests with hand-written lists, and make the endpoints return the JSON files in `docs/contracts/examples/` behind the `API_MOCK=1` variable. That way the frontend can point at the API from the very beginning.

## Core query of `/calendar`

A single query returns the monthly counts; everything else is computed in Python.

```sql
WITH aoi AS (SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g),
     c AS (SELECT cy, cx FROM cell, aoi WHERE ST_Intersects(cell.geom, aoi.g))
SELECT date_trunc('month', d.acq_date)::date AS month,
       count(*) FILTER (WHERE d.modis_veg) AS modis_cell_days,
       count(*) FILTER (WHERE d.viirs_veg) AS viirs_cell_days,
       sum(d.raw_points)                   AS raw_points
FROM cell_day d JOIN c USING (cy, cx)
WHERE d.acq_date >= %(start)s AND d.acq_date < %(end)s
GROUP BY 1 ORDER BY 1;
```

- Always parameters; never concatenate text into the SQL.
- `k` needs the full 2012-02 → 2025-12 overlap even if the user asks for another range: always query 2000–2026 and trim at the end.
- Months without rows do not appear in the result: generate the full list of months in Python and fill it in. A month without rows but with coverage is worth **0**, not `null`. It is `null` only if there is `no_coverage` or a total outage.
- **MVP Mexico only.** Always filter `cell.country = 'MX'`. If the area has no cells in Mexico and does not touch the Mexico rectangle (lat 14.5–32.8, lon −118.5 to −86.5) → 422 `aoi_outside_coverage`. Argentina is in the database but is rejected until phase 2.
- Area in km²: `ST_Area(g::geography) / 1e6`. Reject more than 200,000.
- Outage flags: count per month the country's `sensor_outage` days.

## `/hotspots.csv`

Same cell CTE, `JOIN detection USING (cy, cx)`, date filter, plus `ST_Intersects` of the exact point with the polygon so that points from edge cells are not included. Return it with `StreamingResponse` and a server-side cursor; do not build the CSV in memory.

## Tests

- `backend/harmonize.py`: one test for each row of the tables in `harmonization.md` (statuses, flags, `basis`, fallback to the country `k` with fewer than 100 cell-days).
- Endpoints: the checkboxes in the API section of `docs/contracts/acceptance.md`, with `httpx` and `TestClient`.
- Before saying something is ready: `uv run pytest backend` and a real `curl` call to the `qro-sierra-gorda` preset.

## Do not

- Do not return human-readable text; only codes.
- Do not compute anything the contract assigns to the ETL (`is_veg`, reference VIIRS).
- Do not change the shape of a response without first changing `api.md` and the examples.
- Do not add authentication, a distributed cache or background tasks.
