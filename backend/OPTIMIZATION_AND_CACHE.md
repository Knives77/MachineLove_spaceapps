# Optimization and caching in the backend (`backend/`)

This document records the optimizations implemented in `backend/`, in full compliance with the project's contracts and guidelines ([`.claude/skills/backend/SKILL.md`](../.claude/skills/backend/SKILL.md), [`docs/contracts/api.md`](../docs/contracts/api.md)):

- **Zero new external dependencies** in `pyproject.toml`.
- **Zero changes to the database** (`firms` is queried exclusively with read-only `SELECT`).
- **No distributed cache and no background tasks** ([`SKILL.md` l.73](../.claude/skills/backend/SKILL.md#L73)).

---

## 1. Optimizations implemented

### 1.1 HTTP compression with `GZipMiddleware` (`-91.4%` on the wire)
- **File:** [`backend/main.py`](main.py#L19)
- **Change:** `app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)`
- **Measured impact:**
  - JSON response of `POST /api/v1/calendar` (324 months): goes from **`77,976` bytes (~76 KB)** to **`6,688` bytes (~6.5 KB)** (`-91.4%`).
  - Transparent to `fetch()` in the browser and to `TestClient` in `pytest`.

### 1.2 Multi-level in-memory LRU cache with anti-*stampede* locking
- **File:** [`backend/routes.py`](routes.py#L63-L258)
- **In-memory cache layers (Python standard library: `OrderedDict` + `threading.RLock`):**
  1. **`_AOI_INPUTS_CACHE` (LRU max. `64` areas, `TTL = 600 s`):**
     - Indexed by the area's canonical key: `preset:<id>` or `poly:<sha256(normalized_wkb)>`.
     - Protected with a per-key `Lock` so that when the frontend runs `prefetchPresets` at startup (firing `modis_primary` and `viirs_primary` simultaneously), **only 1 request queries PostgreSQL** per preset and the second one reuses the inputs in memory.
     - Toggling **"Simulate the end of MODIS" (`basis = viirs_primary`)**, changing the year range or downloading **`POST /api/v1/calendar.csv`** (for presets as well as drawn polygons) runs **0 SQL queries**.
  2. **`_PRESET_CALENDAR_CACHE` (`_UnifiedCacheStore`, LRU max. `128` responses, `TTL = 600 s`):**
     - Stores the already computed `CalendarResponse` for `(aoi_key, start_year, end_year, basis, dsn)`.
     - If `data_through` in `/health` changes, it is invalidated automatically.
  3. **`_PRESETS_RESPONSE_CACHE` (`TTL = 600 s`) + `Cache-Control: public, max-age=300`** on `GET /api/v1/presets`.
  4. **`_HEALTH_RESPONSE_CACHE` (`TTL = 30 s`)** on `GET /api/v1/health`.

### 1.3 Cache of Mexico's global metadata and fast hemisphere filter (`d.cy > 0`)
- **File:** [`backend/queries.py`](queries.py#L45-L90) and [`backend/queries.py`](queries.py#L267-L405)
- **Changes:**
  1. **`_COUNTRY_METADATA_CACHE` (`TTL = 300 s`):** stores `(nrt_months, outages, country_k, data_through)` per country (`MX`). This way, when a new polygon is drawn, `fetch_calendar_inputs` goes from **5 SQL queries to a single query** (only the monthly aggregation over `cell_day`, without rescanning the 16.17M-row `detection`).
  2. **`d.cy > 0` filter on `data_through`:** since Argentina has data through `2026-11-14` (`cy < 0`) and Mexico through `2026-11-01` (`cy > 0`), adding `AND d.cy > 0` to the `ORDER BY d.acq_date DESC LIMIT 1` discards Argentina's rows directly without a `JOIN` against `cell`, bringing cold `/health` down from **`1,489 ms` to `91 ms`**.
  3. **Auto-detection of the database port:** `resolve_database_url()` uses `DATABASE_URL` if it is set; otherwise it tries `127.0.0.1:5432` and, as an alternative, `127.0.0.1:15432`.

### 1.4 Message and docstring cleanup in `backend/aoi.py`
- **File:** [`backend/aoi.py`](aoi.py#L133-L148)
- Error message for `422 aoi_outside_coverage` updated to `"The requested AOI does not intersect Mexico coverage"`.

---

## 2. Real measured times

Live measurement against the real `firms` database (`16.17M` detections, `8.72M` `cell_day`):

| Operation | Before | After (optimized) | Contract target |
|---|---:|---:|---:|
| `GET /api/v1/health` (cold / cached) | `1,489.9 ms` | **`91.1 ms` / `7.8 ms`** | — |
| `GET /api/v1/presets` (cold / cached) | `~90 ms` | **`50.0 ms` / `< 2 ms`** | — |
| `POST /api/v1/calendar` Sierra Gorda preset (cold, DB) | `1,016.2 ms` | **`255.5 ms` (`0.25 s`)** | `< 2,000 ms` |
| `POST /api/v1/calendar` Sierra Gorda preset → **"Switch MODIS off"** (`viirs_primary`) | `~950 ms` (5 SQL) | **`69.9 ms` (`0 SQL`)** | `< 2,000 ms` |
| `POST /api/v1/calendar` Sierra Gorda preset (repeated, fully cached) | `~16 ms` | **`14.8 ms` (`0 SQL`)** | `< 2,000 ms` |
| `POST /api/v1/calendar` Free polygon (La Primavera, Jalisco, cold) | `~460 ms` (7 SQL) | **`132.7 ms` (`0.13 s`, 1 SQL on `cell_day`)** | `< 8,000 ms` |
| `POST /api/v1/calendar` Free polygon → **"Switch MODIS off"** (`viirs_primary`) | `~460 ms` (7 SQL) | **`71.2 ms` (`0 SQL`)** | `< 8,000 ms` |
| `POST /api/v1/calendar.csv` Free polygon / preset already seen | `~460 ms` (7 SQL) | **`12.9 ms` (`0 SQL`)** | — |
| Transferred size `POST /api/v1/calendar` (`Accept-Encoding: gzip`) | `77,976 B` | **`6,688 B` (`-91.4%`)** | — |
