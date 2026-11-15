# Optimización y Caché Implementadas en el Backend (`backend/`)

Este documento registra las optimizaciones implementadas en `backend/` cumpliendo al 100% los contratos y lineamientos del proyecto ([`.claude/skills/backend/SKILL.md`](../.claude/skills/backend/SKILL.md), [`docs/TOPOLOGIA.md`](../docs/TOPOLOGIA.md), [`docs/CHECKLIST.md`](../docs/CHECKLIST.md), [`docs/contracts/api.md`](../docs/contracts/api.md)):

- **Cero dependencias externas nuevas** en `pyproject.toml`.
- **Cero modificaciones a la base de datos** (`firms` se consulta exclusivamente con `SELECT` de solo lectura).
- **Cero caché distribuida ni tareas en segundo plano** ([`SKILL.md` l.73](../.claude/skills/backend/SKILL.md#L73)).

---

## 1. Optimizaciones implementadas

### 1.1 Compresión HTTP `GZipMiddleware` (`-91.4%` de peso en red)
- **Archivo:** [`backend/main.py`](main.py#L19)
- **Cambio:** `app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)`
- **Impacto medido:**
  - Respuesta JSON de `POST /api/v1/calendar` (324 meses): pasa de **`77,976` bytes (~76 KB)** a **`6,688` bytes (~6.5 KB)** (`-91.4%`).
  - Transparente para `fetch()` en el navegador y para `TestClient` en `pytest`.

### 1.2 Caché LRU multinivel en memoria con bloqueo anti-*stampede*
- **Archivo:** [`backend/routes.py`](routes.py#L63-L258)
- **Capas de caché en memoria (librería estándar de Python: `OrderedDict` + `threading.RLock`):**
  1. **`_AOI_INPUTS_CACHE` (LRU máx. `64` áreas, `TTL = 600 s`):**
     - Indexado por llave canónica del área: `preset:<id>` o `poly:<sha256(wkb_normalizado)>`.
     - Protegido con `Lock` por clave para que cuando el Frontend ejecuta `prefetchPresets` al arrancar (lanzando `modis_primary` y `viirs_primary` simultáneamente), **solo 1 petición consulte PostgreSQL** por preset y la segunda reutilice los insumos en memoria.
     - Cambiar el interruptor **"Simular fin de MODIS" (`basis = viirs_primary`)**, cambiar el rango de años o descargar **`POST /api/v1/calendar.csv`** (tanto en presets como en polígonos dibujados por el jurado) ejecuta **0 consultas SQL**.
  2. **`_PRESET_CALENDAR_CACHE` (`_UnifiedCacheStore`, LRU máx. `128` respuestas, `TTL = 600 s`):**
     - Guarda el `CalendarResponse` ya calculado para `(aoi_key, start_year, end_year, basis, dsn)`.
     - Si cambia `data_through` en `/health`, se invalida automáticamente.
  3. **`_PRESETS_RESPONSE_CACHE` (`TTL = 600 s`) + `Cache-Control: public, max-age=300`** en `GET /api/v1/presets`.
  4. **`_HEALTH_RESPONSE_CACHE` (`TTL = 30 s`)** en `GET /api/v1/health`.

### 1.3 Caché de metadatos globales de México y filtro rápido de hemisferio (`d.cy > 0`)
- **Archivo:** [`backend/queries.py`](queries.py#L45-L90) y [`backend/queries.py`](queries.py#L267-L405)
- **Cambios:**
  1. **`_COUNTRY_METADATA_CACHE` (`TTL = 300 s`):** guarda `(nrt_months, outages, country_k, data_through)` por país (`MX`). Así, cuando el jurado dibuja un polígono nuevo en vivo, `fetch_calendar_inputs` pasa de **5 consultas SQL a 1 sola consulta** (únicamente la agregación mensual sobre `cell_day`, sin volver a escanear `detection` de 16.17M filas).
  2. **Filtro `d.cy > 0` en `data_through`:** como Argentina tiene datos hasta `2026-11-14` (`cy < 0`) y México hasta `2026-11-01` (`cy > 0`), agregar `AND d.cy > 0` al `ORDER BY d.acq_date DESC LIMIT 1` descarta las filas de Argentina directamente sin hacer `JOIN` contra `cell`, bajando `/health` en frío de **`1,489 ms` a `91 ms`**.
  3. **Auto-detección del túnel por cable (`15432` vs `5432`):** `resolve_database_url()` usa `DATABASE_URL` si está definida; si no, detecta automáticamente el túnel SSH en `127.0.0.1:15432` ([`docs/TOPOLOGIA.md`](../docs/TOPOLOGIA.md#L14)) o cae a `127.0.0.1:5432` (anfitriona).

### 1.4 Limpieza de mensaje y docstring en `backend/aoi.py`
- **Archivo:** [`backend/aoi.py`](aoi.py#L133-L148)
- Cumple el punto de [`docs/CHECKLIST.md` l.77](../docs/CHECKLIST.md#L77): mensaje de error `422 aoi_outside_coverage` actualizado a `"The requested AOI does not intersect Mexico coverage"`.

---

## 2. Tiempos reales medidos por cable directo (`lar@10.0.0.1`, túnel `15432`)

Medición en vivo contra la base real `firms` (`16.17M` detecciones, `8.72M` `cell_day`):

| Operación | Antes | Después (Optimizado) | Objetivo Contrato |
|---|---:|---:|---:|
| `GET /api/v1/health` (frío / caché) | `1,489.9 ms` | **`91.1 ms` / `7.8 ms`** | — |
| `GET /api/v1/presets` (frío / caché) | `~90 ms` | **`50.0 ms` / `< 2 ms`** | — |
| `POST /api/v1/calendar` Preset Sierra Gorda (frío, BD) | `1,016.2 ms` | **`255.5 ms` (`0.25 s`)** | `< 2,000 ms` |
| `POST /api/v1/calendar` Preset Sierra Gorda → **"Apagar MODIS"** (`viirs_primary`) | `~950 ms` (5 SQL) | **`69.9 ms` (`0 SQL`)** | `< 2,000 ms` |
| `POST /api/v1/calendar` Preset Sierra Gorda (repetido, caché total) | `~16 ms` | **`14.8 ms` (`0 SQL`)** | `< 2,000 ms` |
| `POST /api/v1/calendar` Polígono libre (La Primavera, Jalisco, frío) | `~460 ms` (7 SQL) | **`132.7 ms` (`0.13 s`, 1 SQL en `cell_day`)** | `< 8,000 ms` |
| `POST /api/v1/calendar` Polígono libre → **"Apagar MODIS"** (`viirs_primary`) | `~460 ms` (7 SQL) | **`71.2 ms` (`0 SQL`)** | `< 8,000 ms` |
| `POST /api/v1/calendar.csv` Polígono libre / Preset ya visto | `~460 ms` (7 SQL) | **`12.9 ms` (`0 SQL`)** | — |
| Peso transferido `POST /api/v1/calendar` (`Accept-Encoding: gzip`) | `77,976 B` | **`6,688 B` (`-91.4%`)** | — |
