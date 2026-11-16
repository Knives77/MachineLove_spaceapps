# How to populate the database

Two paths to get the database ready for the API:

| Path | When | Time |
|---|---|---|
| **A · Restore a backup** | A `.dump` already exists (see "Take a backup"). It is the fastest and leaves the database identical | ~1.5 min (96 s measured) |
| **B · From scratch with the ETL** | New machine, empty database, or after changing the ETL | ~2 min of ETL (125 s measured) + the data download |

Requirements: `podman`, `psql`, `uv` and `unzip`. Everything is run from the repo root. Tested end to end on Nov 14, 2026 on a new database (`firms_test`), with these same commands.

---

## 0 · Start Postgres + PostGIS

```bash
scripts/db_up.sh
```

It creates (or starts) the `firms_postgis` container, which listens only on `127.0.0.1:5432`. User `firms`, password `firms_local`, database `firms`. The data lives in the `firms_pgdata` volume and survives container restarts.

Additional databases, if needed:

```bash
podman exec firms_postgis createdb -U firms firms_dev    # test database
```

---

## Path A · Restore a backup

```bash
DUMP=~/backups/modiirs/firms_20261114_1634.dump
podman exec firms_postgis createdb -U firms firms_restore
podman cp "$DUMP" firms_postgis:/tmp/restore.dump
podman exec firms_postgis pg_restore -U firms -d firms_restore -j 4 /tmp/restore.dump
podman exec firms_postgis rm /tmp/restore.dump
```

The backup is copied into the container because `pg_restore -j` (parallel restore) does not work reading from standard input.

- To restore **on top of** `firms`, it has to be dropped first, with the API stopped: `podman exec firms_postgis dropdb -U firms firms` and `createdb -U firms firms`.
- Check with the counts in the verification step (below).

---

## Path B · From scratch

### B1 · Data on disk

```bash
scripts/download_history.sh          # FIRMS per-country history 2000–2025 → data/historico_pais/  (~1.1 GB)
scripts/download_requests.sh MX      # 2024–2026 requests from the GitHub release → data/México-Querétaro/
scripts/download_requests.sh AR      # optional, phase 2 → data/Argentina/
```

The ETL expects this structure (`docs/contracts/ingest.md`):

```
data/
├── historico_pais/<Pais>/<sensor>/<sensor>_<año>_<Pais>.csv     source A, everything up to 2025-12-31
└── <request folder>/<subfolder>/fire_archive_*.csv               source B, from 2026-01-01
                                /fire_nrt_*.csv                   source C, from 2026-01-01
```

### B2 · Schema

```bash
export DATABASE_URL=postgresql://firms:firms_local@127.0.0.1:5432/firms
psql "$DATABASE_URL" -f docs/contracts/db_schema.sql
```

It creates PostGIS, the 7 tables and the 3 presets. It can be repeated safely (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

### B3 · ETL, step by step

```bash
uv run python -m etl.run --step 1    # ingestion → detection
uv run python -m etl.run --step 2    # static-source mask → static_cell, is_veg for NRT
uv run python -m etl.run --step 3    # sensor outages → sensor_outage
uv run python -m etl.run --step 4    # cell-days → cell, cell_day
uv run python -m etl.run --step 5    # calibration per country → calibration_country
```

Or all at once: `uv run python -m etl.run --all`. To load only Mexico: add `--country MX` to each step.

| Step | What it does | Measured time | Rows (MX + AR) |
|---|---|---|---|
| 1 | Reads the CSVs, normalizes and loads with `COPY`. It first deletes the country's rows, so repeating it does not duplicate | 57 s | `detection` 16,168,961 |
| 2 | Cells with `type = 2` on ≥ 3 dates; turns off `is_veg` for NRT detections that fall there | 6 s | `static_cell` 3,111 |
| 3 | Days without detections per satellite and country, gaps in the FIRMS Readme and periods without files | 1 s | `sensor_outage` 463 |
| 4 | Aggregates to cell-days with the reference VIIRS rule | 58 s | `cell` 1,481,420 · `cell_day` 8,721,793 |
| 5 | `k` per country and leave-one-year-out validation | 1 s | `calibration_country` 2 (MX 0.3323, AR 0.4641) |

Order matters: 2 needs 1, 3 needs 1, 4 needs 2 and 3, and 5 needs 4. Each step deletes and regenerates its own tables, so it can be repeated without duplicating.

Quick test before the full load (a few seconds):

```bash
uv run python -m etl.run --all --country MX --limit-years 2011,2012,2019
```

---

## Verify

```bash
uv run python -m etl.verify          # control figures from acceptance.md → must say 54/54
```

Exact counts (use `count(*)`; the estimate in `pg_stat_user_tables` can differ by tens of thousands):

```bash
psql "$DATABASE_URL" -c "SELECT 'detection', count(*) FROM detection UNION ALL SELECT 'cell_day', count(*) FROM cell_day UNION ALL SELECT 'static_cell', count(*) FROM static_cell UNION ALL SELECT 'sensor_outage', count(*) FROM sensor_outage"
```

And the API against the database:

```bash
DATABASE_URL=... uv run uvicorn backend.main:app --port 8000
curl -s localhost:8000/api/v1/health      # {"status":"ok","data_through":"2026-11-01"}
```

## After populating

- Restart the API on 8000.
- Take a backup:

```bash
mkdir -p ~/backups/modiirs
podman exec firms_postgis pg_dump -U firms -Fc -d firms > ~/backups/modiirs/firms_$(date +%Y%m%d_%H%M).dump
```

## Common problems

| Symptom | Cause | Solution |
|---|---|---|
| `No hay CSV en data` | The data is missing or in another path | Step B1, or `export FIRMS_DATA_DIR=/path/to/data` |
| `relation "detection" does not exist` | The schema was not applied | Step B2 |
| `connection refused` on 5432 | The container is not up | `scripts/db_up.sh` |
| `detection` with twice the rows | The same CSVs in two subfolders of a request | Keep a single copy; `download_requests.sh` already prevents it |
| `etl.verify` with failures | Incomplete data or a step not run | Check which figure fails; run again from the step that produces it |
