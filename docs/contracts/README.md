# Contracts

The contracts fix what one part of the system delivers to another. The code adapts to them, never the other way around (rule 1 in `CLAUDE.md`).

## Chain

```
FIRMS CSV ──ingest.md──▶ detection ──db_schema.sql──▶ cell_day, sensor_outage, calibration_country
                                                              │
                                              harmonization.md (formulas)
                                                              ▼
                                         backend ──api.md + examples/──▶ web
                                                              │
                                     acceptance.md: figures used to check every link
```

## Files

| File | What it fixes | Produced by | Consumed by | Checked with |
|---|---|---|---|---|
| [`ingest.md`](ingest.md) | Real columns of each FIRMS CSV, precedence between sources, normalization, `is_veg`, static mask | — (FIRMS) | `etl/ingest.py`, `etl/mask.py` | `uv run pytest etl` |
| [`db_schema.sql`](db_schema.sql) | The 7 tables, their columns, indexes and the 3 presets | ETL | Backend | `psql -f` without errors |
| [`harmonization.md`](harmonization.md) | Reference VIIRS, `k`, overlap, harmonized series, flags, baseline, `status`, outage detection, known limits | — (method) | `etl/cells.py`, `etl/calibrate.py`, `etl/outages.py`, `backend/harmonize.py` | `uv run pytest backend`, `etl.verify` |
| [`api.md`](api.md) | Endpoints, request, response, error codes, target times | Backend | Frontend (`web/src/api.ts`, `web/src/types.ts`) | `backend/tests/test_api.py` |
| [`examples/`](examples/) | Sample JSON for `/presets` and `/calendar` with the exact shape | Backend | Frontend mocks | The frontend compiles against them |
| [`acceptance.md`](acceptance.md) | Control figures and checkboxes per layer (ETL, calibration, API, frontend) | Independent measurement | Everyone | `uv run python -m etl.verify`, E2E tests |

## How a contract is changed

1. The change is agreed on: which field, what for and which parts are affected.
2. The contract is edited **first**.
3. A line is added to the change table below.
4. Then the code and tests change: the producer first and the consumer after.
5. If the JSON shape changes, `examples/` and `web/src/types.ts` are updated too.

What is **not** changed without agreement from the whole team: the unit (`modis_equivalent_cell_days`), the `status` and `flags` codes, and the 0.01° grid.

## Changes

| Date | Contract | Change | Affects |
|---|---|---|---|
| Nov 14 18:30 | `api.md` | New error `503 db_unavailable`; proximity rule (0.15°) for polygons without cells; `viirs_cell_days` is reported from 2012-01 (the overlap still starts in 2012-02) | Frontend: `error.db_unavailable` added to `i18n.ts` |
| Nov 14 17:00 | `harmonization.md`, `api.md`, `acceptance.md` | A month with `partial_month` gets `status = "no_data"` and `anomaly_ratio = null`, but keeps `harmonized` | Backend (done), frontend (no changes) |
| Nov 14 17:00 | `acceptance.md` | `viirs_primary`: the worst year is compared with `calibration.loyo_annual_max`, not with a fixed 45 % | `etl.verify` (done) |
| Nov 14 14:30 | all | MVP Mexico only: `aoi_outside_coverage` outside Mexico; `AR` reserved for phase 2; Bajío replaces Chilecito in the control figures | Backend, frontend, ETL (done) |
| Nov 14 12:00 | all | First frozen version | — |
