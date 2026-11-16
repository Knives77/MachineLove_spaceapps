---
name: etl
description: Guide for building or modifying the FIRMS ETL (etl/ folder) - CSV ingestion, static mask, cell-days, sensor outages and calibration. Use it before touching any file in etl/ or loading data into Postgres.
---

# FIRMS hot spot ETL

Read `docs/contracts/ingest.md`, `docs/contracts/db_schema.sql` and `docs/contracts/harmonization.md` first. They are the specification; this file only says how to work.

## Environment

```bash
uv init --python 3.12        # only if pyproject.toml does not exist
uv add polars "psycopg[binary]" pytest
export DATABASE_URL=postgresql://firms:firms_local@localhost:5432/firms_dev   # tests; the official ingestion uses /firms
export FIRMS_DATA_DIR=<path to data/>     # by default, data/ at the repo root
```

Do not install anything with global `pip` or `sudo`.

## Modules and order

| Step | Module | What it does | Output |
|---|---|---|---|
| 1 ✅ | `etl/ingest.py` | **Done.** Reads sources A, B and C, normalizes, computes `cy`/`cx`, `COPY`. Full load: 15.9 M rows in ~90 s. Tests in `etl/tests/test_ingest.py` | `detection` (without the final `is_veg` for NRT) |
| 2 ✅ | `etl/mask.py` | **Done.** Cells with `type = 2` on ≥ 3 dates; then sets `is_veg` for NRT. Validated on archive 2024+: catches 94% (MODIS) and 99.9% (VIIRS) of the `type = 2` and wrongly removes ~2% of real fire | `static_cell`, `detection.is_veg` |
| 3 ✅ | `etl/outages.py` | **Done.** Days without detections per satellite and country (`detected`), exact gaps from the Readme (`firms_readme`) and periods without files (`coverage`). Tests in `etl/tests/test_outages.py` | `sensor_outage` |
| 4 ✅ | `etl/cells.py` | **Done.** Aggregates to cell-days with the reference VIIRS rule (`etl/reference.py`). 1.48 M cells and 8.72 M cell-days in ~60 s. Reproduces the 42 control figures | `cell`, `cell_day` |
| 5 ✅ | `etl/calibrate.py` | **Done.** `k` per country and leave-one-year-out validation. MX 0.332, AR 0.464. `etl/verify.py` compares everything against `acceptance.md` | `calibration_country` |
| 6 | `etl/run.py` | `--all` or `--step N`; `--country MX|AR`; `--limit-years 2019,2020` for tests | |

Every step must be repeatable without duplicating rows (`TRUNCATE` its tables at the start, or delete by country).

## Rules

- Read the CSVs with polars passing `schema_overrides={"acq_time": pl.Utf8, "confidence": pl.Utf8, "version": pl.Utf8}`. Select columns by name.
- Source A VIIRS: rename `bright_ti4` → `brightness`, `bright_ti5` → `bright_t31`, and `satellite` `N` → `SNPP`.
- `family` is derived from `satellite`, never from `instrument`.
- `cy = floor(latitude * 100)`, `cx = floor(longitude * 100)` as 32-bit integers. With negative longitudes `floor` and truncation give different results.
- Sources B and C: keep only `acq_date >= 2026-01-01`, except N21, which is kept in full.
- Load with `cursor.copy("COPY detection (...) FROM STDIN")` per file. Indexes are created at the end of step 1.
- Find files with wildcards (`glob`), because there are paths with accents and a typo in `J1-VIRS-C2`.
- Process one file at a time: the machine has 16 GB shared. Do not load all the CSVs into memory.
- Steps 2 to 5 are SQL (`INSERT ... SELECT ... GROUP BY`) run from Python; do not bring `detection` into memory.

## Reference VIIRS rule (step 4)

For each date and country: reference = `SNPP` before 2018-04-01, `N20` after. If the reference has an outage that day in `sensor_outage`, use the other; if both are missing, `N21`. `cell_day.viirs_veg` is true only if there is an `is_veg` detection from **that** satellite.

## How to test

The MVP only uses Mexico; the ETL processes both countries because it costs little and leaves phase 2 ready.

1. First with a little: `uv run python -m etl.run --all --country MX --limit-years 2011,2012,2019`.
2. Compare against the table in `docs/contracts/acceptance.md` with this query:

```sql
SELECT extract(year FROM acq_date) AS y,
       count(*) FILTER (WHERE modis_veg) AS modis,
       count(*) FILTER (WHERE viirs_veg) AS viirs
FROM cell_day
WHERE cy BETWEEN 2000 AND 2169 AND cx BETWEEN -10060 AND -9901   -- Querétaro box
GROUP BY 1 ORDER BY 1;
```

   It must give MODIS 410 (2011), 190 (2012), 414 (2019). The upper bound is **exclusive** (`ceil(max·100) − 1`): cell `cy` covers `[cy/100, (cy+1)/100)`, so `2170` and `-9900` already fall outside the box and add 4–6 % too much. If they differ by 1–3 cell-days those are points right on the edge; if they differ by more than 1 %, there is a bug.

   All at once: `uv run python -m etl.verify` (or `--sandbox` to run 4 and 5 in temporary tables without writing anything).
3. Only then run everything: `uv run python -m etl.run --all`.
4. Write in `etl/tests/` one test for each checkbox in the ETL section of `acceptance.md`.

## Do not

- Do not use H3, geopandas or PostGIS to assign cells: it is arithmetic.
- Do not filter by `confidence` (it is not in the method).
- Do not rename tables or columns without first changing the contract.
- Do not modify or delete anything inside `data/`.
