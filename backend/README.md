# Backend · Harmonized Burn Activity Calendar (FastAPI)

This module implements the REST server of the **MachineLove (NASA Space Apps 2026)** project, following the frozen contracts in [`docs/contracts/`](../docs/contracts/).

---

## 1. Architecture and files

| File | Responsibility |
|---|---|
| `main.py` | FastAPI instance, CORS configuration (`localhost` / `127.0.0.1`) and global error handlers in the `{"error": {"code": "...", "detail": "..."}}` format. |
| `models.py` | Strict Pydantic v2 schemas (`extra="forbid"`) for requests and responses per [`docs/contracts/api.md`](../docs/contracts/api.md). |
| `aoi.py` | Geometric validation of GeoJSON polygons in WGS84, area calculation ($\le 200,000\text{ km}^2$), Mexico presets (`qro-sierra-gorda`, `qro-bajio`, `qro-recuadro`) and the MVP coverage restriction to Mexico (`MX`). |
| `queries.py` | Parameterized SQL queries over PostgreSQL 16 + PostGIS (`preset`, `cell`, `cell_day`, `detection`, `sensor_outage`, `calibration_country`) and a streaming server-side cursor for `/hotspots.csv`. |
| `harmonize.py` | Pure functions (no database): calibration of $k = \frac{\sum M}{\sum V}$ over the `2012-02` to `2025-12` overlap (falling back to the national $k$ if $\sum M < 100$), annual LOYO validation and monthly MAPE, `modis_primary` and `viirs_primary` series, quality flags, historical baseline ($\ge 10$ years excluding months with outages or incomplete months), percentiles (`p25`, `median`, `p75`, `p90`), `status`, yearly aggregates, seasonality and `latest`. |
| `routes.py` | REST endpoints (`/health`, `/presets`, `/calendar`, `/calendar.csv`, `/hotspots.csv`, `/hotspots`), `API_MOCK=1` mode and in-memory cache (TTL 60 s) for presets. |
| `tests/` | Unit tests (`test_harmonize.py`), endpoint tests (`test_api.py`) and an end-to-end system simulation (`test_system_e2e.py`). |

---

## 2. Harmonization flow on each `POST /calendar` request

1. **AOI resolution and validation (`aoi.py` / `queries.py`):**
   - If it receives a `preset_id`, it checks that it is one of the 3 official Mexico presets (`qro-sierra-gorda`, `qro-bajio`, `qro-recuadro`); if it does not exist → `404 unknown_preset`.
   - If it receives a `geometry` (GeoJSON `Polygon`), it validates a closed ring, WGS84 coordinates and valid geometry → if it fails, `400 invalid_geometry`.
   - It computes the area in $\text{km}^2$ with `ST_Area(g::geography) / 1e6` → if it exceeds $200,000\text{ km}^2$, it returns `400 aoi_too_large`.
   - It checks intersection with cells in Mexico (`cell.country = 'MX'`) or the Mexico rectangle → if it falls in the ocean or in Argentina (outside the MVP), it returns `422 aoi_outside_coverage`.

2. **Monthly query (`queries.py`):**
   - It joins `cell` with `cell_day` to get $M(m)$ (`modis_cell_days`), $V(m)$ (`viirs_cell_days`) and $R(m)$ (`raw_points`) for every month in `2000–2026`.
   - It retrieves `sensor_outage`, `calibration_country` and the months with provisional data (`source = 'nrt'`).

3. **Calibration and harmonized series (`harmonize.py`):**
   - It identifies the valid overlap months (`2012-02` to `2025-12` without `modis_outage`, `viirs_outage` or `no_coverage`).
   - It computes $k = \frac{\sum M}{\sum V}$ (`scope = "aoi"`, or `scope = "country"` if $\sum M < 100$).
   - It computes the leave-one-year-out error (`loyo_annual_mape`, `loyo_annual_max`) and the median monthly error (`monthly_mape`).
   - It builds the monthly series in **MODIS-equivalent cell-days**:
     - `modis_primary`: $M(m)$ when MODIS has coverage; $k \cdot V(m)$ when it does not.
     - `viirs_primary` (simulation of MODIS retirement): $k \cdot V(m)$ from `2012-02`; $M(m)$ before.
   - For each month it computes the baseline against the other years of the same calendar month (excluding months with outage flags or incomplete months) and classifies `status` (`no_data`, `insufficient_baseline`, `below`, `normal`, `above`, `critical`).

---

## 3. How to run and test

### Start the server
```bash
# 1. Mock mode (no database):
API_MOCK=1 uv run uvicorn backend.main:app --reload --port 8001

# 2. Real mode (with Postgres on 127.0.0.1:5432):
export DATABASE_URL=postgresql://firms:firms_local@127.0.0.1:5432/firms
uv run uvicorn backend.main:app --reload --port 8001
```

### Run all tests (unit + acceptance + system simulation)
```bash
uv run pytest backend -v
```
