# Contrato de ingesta: de los CSV de FIRMS a `detection`

La ingesta carga México y Argentina; **el MVP solo usa México** (Argentina es fase 2).

## Fuentes y precedencia

| Fuente | Ruta | Se usa para |
|---|---|---|
| A. Por país y año | `data/historico_pais/<Pais>/<sensor>/<sensor>_<año>_<Pais>.csv` | Todo hasta **2025-12-31** |
| B. Solicitudes `archive` | `data/México-Querétaro/*/fire_archive_*.csv`, `data/Argentina/*/fire_archive_*.csv` | Solo filas con `acq_date >= 2026-01-01` |
| C. Solicitudes `nrt` | `.../fire_nrt_*.csv` | Solo filas con `acq_date >= 2026-01-01` |

Las filas de B y C anteriores a 2026 se descartan (ya están en A), salvo **NOAA-21 2024–2025**, que no existe en A y sí se carga desde B.

Las rutas tienen acentos (`México-Querétaro`) y un typo (`J1-VIRS-C2`): buscar con comodines, no escribir la ruta a mano.

## Esquemas reales

| Columna canónica | Fuente A MODIS | Fuente A VIIRS | Fuentes B y C (todas) |
|---|---|---|---|
| `latitude`, `longitude` | igual | igual | igual |
| `brightness` | `brightness` | **`bright_ti4`** | `brightness` |
| `bright_t31` | `bright_t31` | **`bright_ti5`** | `bright_t31` |
| `scan`, `track`, `acq_date`, `acq_time`, `frp`, `daynight`, `confidence`, `version` | igual | igual | igual |
| `satellite` | `Terra`, `Aqua` | S-NPP = **`N`**, NOAA-20 = `N20` | `Terra`, `Aqua`, `SNPP`, `N20`, `N21` |
| `instrument` | `MODIS` | `VIIRS` | S-NPP trae **`SNPP`** |
| `type` | sí | sí | `archive` sí; **`nrt` no tiene la columna** |

Leer siempre por nombre de columna, nunca por posición.

## Normalización obligatoria

| Campo destino | Regla |
|---|---|
| `satellite` | `N` → `SNPP`. Valores finales: `Terra`, `Aqua`, `SNPP`, `N20`, `N21` |
| `family` | `MODIS` si Terra/Aqua, si no `VIIRS`. **No usar la columna `instrument`** |
| `acq_time` | Leer como texto, 4 caracteres `HHMM`. Como número pierde los ceros (`0055` → `55`) |
| `acq_ts` | `acq_date` + `acq_time` en UTC |
| `confidence_raw` | Texto tal cual (`0`–`100` en MODIS; `l`/`n`/`h` en VIIRS) |
| `type` | Entero o `NULL` (NRT) |
| `source` | `country`, `archive` o `nrt` |
| `country` | `MX` o `AR` |
| `cy`, `cx` | `floor(latitude * 100)`, `floor(longitude * 100)` como enteros. Cuidado: `floor`, no truncar (las longitudes son negativas) |
| `is_veg` | Ver abajo |

No usar clave primaria natural: hay filas con la misma (lat, lon, fecha, hora, satélite) y distinto FRP.

## Fuego de vegetación (`is_veg`)

- `type = 0` → `true`
- `type` en (1, 2, 3) → `false`
- `type IS NULL` (NRT) → `true` salvo que la celda esté en `static_cell`

## Máscara estática (`static_cell`)

Una celda `(cy, cx)` es estática si tiene detecciones con `type = 2` en **al menos 3 fechas distintas** (cualquier satélite, cualquier año). Se guarda también cuántas fechas.

## Volumen esperado

México y Argentina, 2000–2026: del orden de 20 millones de filas en CSV (1.4 GB). Cargar con `COPY`, crear índices al final.

## Verificación de la ingesta

Ver `acceptance.md`, sección ETL.
