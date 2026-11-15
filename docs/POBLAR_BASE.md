# Cómo poblar la base de datos

Dos caminos para dejar la base lista para la API:

| Camino | Cuándo | Tiempo |
|---|---|---|
| **A · Restaurar un respaldo** | Ya existe un `.dump` (los de `BITACORA_BASE.md`). Es lo más rápido y deja la base idéntica a la oficial | ~1.5 min (96 s medidos) |
| **B · Desde cero con el ETL** | Máquina nueva, base vacía, o después de cambiar el ETL | ~2 min de ETL (125 s medidos) + la descarga de datos |

Requisitos: `podman`, `psql`, `uv` y `unzip`. Todo se corre desde la raíz del repo. Probado de principio a fin el 14-nov-2026 en una base nueva (`firms_test`), con estos mismos comandos.

---

## 0 · Levantar Postgres + PostGIS

```bash
scripts/db_up.sh
```

Crea (o arranca) el contenedor `firms_postgis`, que escucha solo en `127.0.0.1:5432`. Usuario `firms`, contraseña `firms_local`, base `firms`. Los datos viven en el volumen `firms_pgdata` y sobreviven a reinicios del contenedor.

Bases adicionales, si hacen falta:

```bash
podman exec firms_postgis createdb -U firms firms_dev    # pruebas de procesamiento
```

---

## Camino A · Restaurar un respaldo

```bash
DUMP=~/backups/machinelove/firms_20261114_1634.dump
podman exec firms_postgis createdb -U firms firms_restore
podman cp "$DUMP" firms_postgis:/tmp/restore.dump
podman exec firms_postgis pg_restore -U firms -d firms_restore -j 4 /tmp/restore.dump
podman exec firms_postgis rm /tmp/restore.dump
```

El respaldo se copia dentro del contenedor porque `pg_restore -j` (restaurar en paralelo) no funciona leyendo de la entrada estándar.

- Para restaurar **encima** de `firms` (la oficial), primero hay que borrarla: `podman exec firms_postgis dropdb -U firms firms` y `createdb -U firms firms`. Solo el líder, y con la API detenida.
- Comprobar con los conteos del paso de verificación (abajo).

---

## Camino B · Desde cero

### B1 · Datos en disco

```bash
scripts/download_history.sh          # histórico por país 2000–2025 de FIRMS → data/historico_pais/  (~1.1 GB)
scripts/download_requests.sh MX      # solicitudes 2024–2026 de la release de GitHub → data/México-Querétaro/
scripts/download_requests.sh AR      # opcional, fase 2 → data/Argentina/
```

El ETL espera esta estructura (`docs/contracts/ingest.md`):

```
data/
├── historico_pais/<Pais>/<sensor>/<sensor>_<año>_<Pais>.csv     fuente A, todo hasta 2025-12-31
└── <carpeta de solicitud>/<subcarpeta>/fire_archive_*.csv        fuente B, desde 2026-01-01
                                       /fire_nrt_*.csv            fuente C, desde 2026-01-01
```

### B2 · Esquema

```bash
export DATABASE_URL=postgresql://firms:firms_local@127.0.0.1:5432/firms
psql "$DATABASE_URL" -f docs/contracts/db_schema.sql
```

Crea PostGIS, las 7 tablas y los 3 presets. Se puede repetir sin problema (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

### B3 · ETL, paso a paso

```bash
uv run python -m etl.run --step 1    # ingesta → detection
uv run python -m etl.run --step 2    # máscara de fuentes fijas → static_cell, is_veg de NRT
uv run python -m etl.run --step 3    # caídas de sensor → sensor_outage
uv run python -m etl.run --step 4    # celdas-día → cell, cell_day
uv run python -m etl.run --step 5    # calibración por país → calibration_country
```

O todo junto: `uv run python -m etl.run --all`. Para cargar solo México: agregar `--country MX` a cada paso.

| Paso | Qué hace | Tiempo medido | Filas (MX + AR) |
|---|---|---|---|
| 1 | Lee los CSV, normaliza y carga con `COPY`. Borra antes lo del país, así que repetirlo no duplica | 57 s | `detection` 16,168,961 |
| 2 | Celdas con `type = 2` en ≥ 3 fechas; apaga `is_veg` de las NRT que caen ahí | 6 s | `static_cell` 3,111 |
| 3 | Días sin detecciones por satélite y país, huecos del Readme de FIRMS y periodos sin archivos | 1 s | `sensor_outage` 463 |
| 4 | Agrega a celda-día con la regla del VIIRS de referencia | 58 s | `cell` 1,481,420 · `cell_day` 8,721,793 |
| 5 | `k` por país y validación dejando un año fuera | 1 s | `calibration_country` 2 (MX 0.3323, AR 0.4641) |

El orden importa: 2 necesita a 1, 3 necesita a 1, 4 necesita a 2 y 3, y 5 necesita a 4. Cada paso borra y regenera sus propias tablas, así que se puede repetir sin duplicar.

Prueba rápida antes de la carga completa (unos segundos):

```bash
uv run python -m etl.run --all --country MX --limit-years 2011,2012,2019
```

---

## Verificar

```bash
uv run python -m etl.verify          # cifras de control de acceptance.md → debe decir 54/54
```

Conteos exactos (usar `count(*)`; la estimación de `pg_stat_user_tables` puede diferir en decenas de miles):

```bash
psql "$DATABASE_URL" -c "SELECT 'detection', count(*) FROM detection UNION ALL SELECT 'cell_day', count(*) FROM cell_day UNION ALL SELECT 'static_cell', count(*) FROM static_cell UNION ALL SELECT 'sensor_outage', count(*) FROM sensor_outage"
```

Y la API contra la base:

```bash
DATABASE_URL=... uv run uvicorn backend.main:app --port 8000
curl -s localhost:8000/api/v1/health      # {"status":"ok","data_through":"2026-11-01"}
```

## Después de poblar

- Anotar la corrida en `BITACORA_BASE.md` (hora, base, pasos, resultado de `etl.verify`).
- Sacar un respaldo (comando en `BITACORA_BASE.md`).
- Si fue en `firms`, reiniciar la API en 8000.

## Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `No hay CSV en data` | Faltan los datos o están en otra ruta | Paso B1, o `export FIRMS_DATA_DIR=/ruta/a/data` |
| `relation "detection" does not exist` | No se aplicó el esquema | Paso B2 |
| `connection refused` en 5432 | El contenedor no está arriba | `scripts/db_up.sh` |
| `detection` con el doble de filas | Los mismos CSV en dos subcarpetas de una solicitud | Dejar una sola copia; `download_requests.sh` ya lo evita |
| `etl.verify` con fallos | Datos incompletos o un paso sin correr | Revisar qué cifra falla; correr de nuevo desde el paso que la produce |
