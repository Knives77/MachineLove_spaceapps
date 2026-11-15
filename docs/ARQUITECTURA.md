# Arquitectura

Cómo está construido el sistema: qué piezas tiene, qué hace cada una, cómo viaja un dato desde el CSV de FIRMS hasta la pantalla y por qué se decidió así. Para usar la aplicación, ver [`GUIA_DE_USO.md`](GUIA_DE_USO.md). Las fórmulas y los esquemas exactos viven en [`contracts/`](contracts/README.md); este documento los resume y los conecta, no los reemplaza.

## 1. Vista general

```
   NASA FIRMS (CSV)                      Máquina anfitriona (todo en 127.0.0.1)
 ┌──────────────────┐    ┌────────────────────────────────────────────────────────────────┐
 │ MODIS C6.1       │    │                                                                │
 │ VIIRS C2         │    │  data/*.csv ──▶ ETL (Python, 5 pasos) ──▶ PostgreSQL + PostGIS │
 │ S-NPP, N20, N21  │───▶│   1.4 GB         etl/                      podman, :5432       │
 └──────────────────┘    │                                                │               │
                         │                                                ▼ SELECT        │
                         │                               API FastAPI (backend/, :8000)    │
                         │                               calibra k, arma el calendario    │
                         │                                                │ JSON / CSV    │
                         │                                                ▼               │
                         │                         Frontend React + MapLibre (web/, :5173)│
                         │                         solo pinta lo que devuelve la API      │
                         └────────────────────────────────────────────────────────────────┘
                                                                          ▲
                           mapa base y relieve: teselas de internet ──────┘
```

Tres capas, cada una con una sola responsabilidad:

| Capa | Carpeta | Hace | No hace |
|---|---|---|---|
| ETL | `etl/` | Lee los CSV, normaliza, marca fuentes fijas y caídas de sensor, agrega a celdas-día, calcula el `k` de respaldo por país | No atiende peticiones |
| API | `backend/` | Recibe un área, calcula `k`, la serie armonizada, la línea base y el nivel de cada mes; entrega JSON y CSV | No escribe en la base (solo `SELECT`) |
| Frontend | `web/` | Mapa, calendario, consola de tiempo, traducción ES/EN, descargas | No calcula armonización: solo pinta |

Dónde corre cada pieza, puertos, bases y túneles: [`TOPOLOGIA.md`](TOPOLOGIA.md).

## 2. Tecnologías

| Pieza | Tecnología |
|---|---|
| Base de datos | PostgreSQL 16 + PostGIS 3.4 en un contenedor podman (`firms_postgis`) |
| ETL | Python 3.12, `polars` (lectura de CSV), `psycopg` 3 (`COPY`), SQL en el servidor |
| API | FastAPI, Pydantic v2, `psycopg` 3, `shapely`, `uvicorn` |
| Frontend | React 18, TypeScript, Vite 6, Tailwind 4, `maplibre-gl` (WebGL), `motion` |
| Gestores | `uv` para Python (un solo `pyproject.toml` para ETL y API), `pnpm` (workspace en la raíz que agrupa `web/`), Node 24 |
| Mapa base | Teselas vectoriales de OpenFreeMap y relieve Terrarium (elevación) |

## 3. Los datos

### 3.1 Fuentes

Detecciones de NASA FIRMS para México y Argentina, 2000–2026 (el MVP solo usa México):

| Fuente | Qué cubre | Dónde queda |
|---|---|---|
| A. Por país y año | Todo hasta 2025-12-31 | `data/historico_pais/` (`scripts/download_history.sh`) |
| B. Solicitudes `archive` | 2026 (y NOAA-21 2024–2025, que no está en A) | `data/México-Querétaro/`, `data/Argentina/` (`scripts/download_requests.sh`) |
| C. Solicitudes `nrt` | 2026, provisionales, sin columna `type` | Igual que B |

Los tres esquemas difieren (nombres de columnas, códigos de satélite). La regla de precedencia y la normalización están en [`contracts/ingest.md`](contracts/ingest.md).

### 3.2 Modelo de datos

Siete tablas ([`contracts/db_schema.sql`](contracts/db_schema.sql)):

```
detection ──(cy,cx)──▶ cell ◀──(cy,cx)── cell_day          preset (3 regiones de ejemplo)
  una fila por         catálogo de        una fila por     sensor_outage (días sin dato)
  hotspot              celdas con geom    celda y fecha    calibration_country (k por país)
     │                                                     static_cell (fuentes fijas)
     └── alimenta el modo crudo, el CSV y los puntos del mapa
```

| Tabla | Filas (14-nov) | Para qué |
|---|---:|---|
| `detection` | 16.2 millones (9.5 de México) | Cada hotspot normalizado. Modo crudo, CSV de hotspots, puntos del mapa |
| `cell` | 1.48 millones | Centro de cada celda de 0.01° con alguna detección; es lo que se cruza con el polígono (índice GiST) |
| `cell_day` | 8.7 millones | **La unidad de actividad.** Una fila por celda y fecha, con `modis_veg` y `viirs_veg` |
| `static_cell` | 3,111 | Celdas con fuente fija recurrente (industria) |
| `sensor_outage` | 463 | Rangos de días sin datos por satélite y país |
| `calibration_country` | 2 | `k` nacional de respaldo (México 0.3323) |
| `preset` | 3 | Sierra Gorda, Bajío queretano y recuadro de Querétaro |

Estado de la base, corridas y respaldos: [`BITACORA_BASE.md`](BITACORA_BASE.md). Cómo poblarla o restaurarla: [`POBLAR_BASE.md`](POBLAR_BASE.md).

### 3.3 La celda-día

Una celda es un cuadro de 0.01° × 0.01° (~1 km): `cy = floor(lat·100)`, `cx = floor(lon·100)`. Una **celda-día** es una celda con al menos una detección de vegetación en una fecha. Diez puntos en la misma celda el mismo día cuentan una vez.

Es la decisión central del proyecto: VIIRS (píxel de 375 m) pone varios puntos donde MODIS (1 km) pone uno. Contar celdas-día en lugar de puntos quita esa diferencia de resolución antes de comparar los sensores.

## 4. ETL (`etl/`)

Cinco pasos, cada uno borra y regenera su salida (se puede repetir sin duplicar):

| Paso | Módulo | Entrada → salida | Qué hace |
|---|---|---|---|
| 1 | `ingest.py` | CSV → `detection` | Lee por nombre de columna, normaliza satélite (`N` → `SNPP`), familia, hora `HHMM`, `cy`/`cx`; aplica la precedencia de fuentes; carga con `COPY` y crea índices al final |
| 2 | `mask.py` | `detection` → `static_cell` | Celda con `type = 2` en 3 o más fechas = fuente fija. Las detecciones NRT (sin `type`) en esas celdas dejan de contar como vegetación |
| 3 | `outages.py` | `detection` → `sensor_outage` | Días seguidos con cero detecciones de un satélite en todo el país dentro de su periodo operativo, más los huecos del Readme de FIRMS y los días sin archivos |
| 4 | `cells.py` | `detection` → `cell`, `cell_day` | Agrega a celdas-día. `viirs_veg` usa un solo **VIIRS de referencia** por día (`reference.py`) |
| 5 | `calibrate.py` | `cell_day` → `calibration_country` | `k` por país, con validación dejando un año fuera |

**VIIRS de referencia.** Hoy vuelan tres VIIRS; sumarlos triplicaría la cuenta. Cada día se usa uno: S-NPP antes de 2018-04-01, NOAA-20 después; si ese tiene caída se usa el otro, y si ambos faltan, NOAA-21.

Comandos:

```bash
uv run python -m etl.run --all                 # los 5 pasos
uv run python -m etl.run --step 4              # un paso
uv run python -m etl.verify                    # cifras de control (54 comprobaciones)
uv run python -m etl.verify --sandbox          # corre 4 y 5 en tablas temporales, sin escribir
```

El paso 1 solo se corre en la anfitriona (ahí están los 1.4 GB de CSV). Configuración por variables de entorno (`etl/config.py`): `DATABASE_URL` y `FIRMS_DATA_DIR`.

## 5. Armonización

Todo se calcula **dentro del área consultada** y por mes. Especificación completa: [`contracts/harmonization.md`](contracts/harmonization.md).

```
M(m) = celdas-día MODIS del mes         V(m) = celdas-día del VIIRS de referencia

1. Traslape      meses de 2012-02 a 2025-12 sin caída de MODIS ni de VIIRS  (167 meses)
2. Factor k      k = Σ M(m) / Σ V(m)  en el traslape
                 si Σ M < 100 en el área  →  se usa el k del país  (scope = "country")
3. Serie         modis_primary:  M(m); si MODIS no tiene cobertura, k · V(m)
                 viirs_primary:  k · V(m) desde 2012-02; M(m) antes   ("Simular fin de MODIS")
4. Línea base    mismo mes calendario en los demás años, sin meses con caída, parciales
                 o sin cobertura; mínimo 10 años  →  mediana, p25, p75, p90
5. Nivel         < p25 bajo · p25–p75 normal · p75–p90 alto · > p90 extremo
6. Razón         anomaly_ratio = valor / mediana
```

**Validación del factor.** Para cada año del traslape se recalcula `k` sin ese año y se mide cuánto falla al predecirlo (`loyo_annual_mape` es la mediana, `loyo_annual_max` el peor año). `monthly_mape` es el error típico de un mes. Medido: 6–17 % anual según la región, 33–37 % mensual. Por eso el estado se da por percentiles y no se promete precisión mensual.

**Sin dato no es cero.** Un mes con caída de sensor, incompleto o sin archivos lleva bandera (`modis_outage`, `viirs_outage`, `partial_month`, `no_coverage`, además de `terra_only` y `nrt`) y no entra a la mediana de los demás meses.

**Qué no entra en la fórmula.** Ni la potencia radiativa (FRP), ni la temperatura de brillo, ni la confianza. Se mide extensión y persistencia de la actividad, no intensidad ni área quemada. El FRP se guarda y solo se usa para pintar los puntos del mapa.

## 6. API (`backend/`)

Base `http://localhost:8000/api/v1`. Contrato: [`contracts/api.md`](contracts/api.md).

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/health` | Estado y fecha del último dato |
| GET | `/presets` | Las 3 regiones de ejemplo (GeoJSON) |
| POST | `/calendar` | El calendario completo de un área: calibración, 324 meses, totales anuales, estacionalidad |
| POST | `/calendar.csv` | Lo mismo en CSV, una fila por mes |
| POST | `/hotspots.csv` | Detecciones crudas del área en un rango de fechas, en streaming (máx. 2,000,000 filas) |
| POST | `/hotspots` | Puntos GeoJSON para el mapa (máx. 62 días y 20,000 puntos) |

El área (`aoi`) es un `preset_id` o un polígono GeoJSON de hasta 200,000 km² que toque México.

### Módulos

| Archivo | Responsabilidad |
|---|---|
| `main.py` | Aplicación FastAPI, CORS para `localhost`, compresión gzip, errores con el formato `{"error": {"code", "detail"}}` |
| `models.py` | Esquemas Pydantic estrictos de peticiones y respuestas |
| `aoi.py` | Validación del polígono, área máxima, cobertura de México |
| `queries.py` | SQL parametrizado sobre PostGIS; cursor de servidor para el CSV en streaming |
| `harmonize.py` | Lógica pura (sin base ni FastAPI): `k`, validación, series, banderas, línea base, nivel |
| `routes.py` | Endpoints, caché en memoria y modo `API_MOCK=1` |

### Vida de una petición `POST /calendar`

1. **Validar el área** (`aoi.py`): geometría válida, ≤ 200,000 km², toca celdas de México. Si no: 400 o 422.
2. **Una consulta agregada** (`queries.py`): cruza `cell` (por geometría) con `cell_day` y devuelve `M(m)`, `V(m)` y puntos crudos por mes. Las caídas, el `k` del país y los meses provisionales salen de un caché por país.
3. **Armonizar en memoria** (`harmonize.py`): traslape, `k`, validación, serie, banderas, línea base y nivel de los 324 meses.
4. **Responder** JSON comprimido (~6.5 KB).

### Rendimiento

Caché en memoria con la librería estándar (sin Redis ni tareas en segundo plano), descrito en [`../backend/OPTIMIZACION_Y_CACHE.md`](../backend/OPTIMIZACION_Y_CACHE.md):

- Los insumos de cada área se guardan 10 minutos: cambiar a "Simular fin de MODIS", cambiar el rango o descargar el CSV no vuelve a consultar la base.
- Un bloqueo por área evita que dos peticiones simultáneas consulten lo mismo.
- Medido: preset en frío 0.25 s, polígono libre en frío 0.13 s, repetidos < 0.1 s. Objetivo del contrato: < 2 s y < 8 s.

### Errores

La API devuelve **códigos**, nunca frases; el frontend traduce.

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `invalid_geometry`, `aoi_too_large`, `invalid_range` | Petición mal formada o área demasiado grande |
| 404 | `unknown_preset` | Región inexistente |
| 422 | `aoi_outside_coverage` | El área no toca México |
| 503 | `db_unavailable` | La base no responde |

## 7. Frontend (`web/`)

Aplicación de una sola página, sin enrutador: el estado global decide qué vista se muestra.

```
web/src/
  main.tsx, App.tsx      arranque y armazón (vista activa + barra inferior)
  state.tsx              estado global (contexto de React) y caché de calendarios
  api.ts                 ÚNICA puerta a la API; sin VITE_API_URL usa los mocks
  types.ts               tipos del contrato de la API
  i18n/                  es.ts, en.ts (mismas claves) y translate()
  theme/tokens.ts        todos los colores (espejo en index.css)
  lib/                   color, formato, geometría, sonido, telemetría de la barra inferior
  views/expert/          consola de Experto: mapa, lectura del mes, consola de tiempo, calendario
  views/Learn.tsx        vista Aprendizaje (4 pasos y cuestionario)
  views/General.tsx, Edu.tsx   vistas que siguen en el código, fuera del menú
  components/            calendario, barras anuales, inspector de k, descargas, menús
  components/map/        mapa MapLibre: capas, fuego, ficha del punto, dibujo, herramientas
  mocks/                 respuestas de ejemplo copiadas de la API real
```

### Reglas de diseño del código

- **Ningún componente hace `fetch`.** Todo pasa por `api.ts`.
- **Ningún cálculo de armonización.** Lo que se ve sale de la respuesta de `/calendar`.
- **Ningún color escrito a mano.** Todos salen de `theme/tokens.ts`.
- **Ningún texto fijo.** Los códigos de la API (`status`, `flags`, errores) se traducen con `i18n/`.
- **Mapa solo con `maplibre-gl`**, cámara con `fitBounds`/`easeTo` nativos, sin bucles manuales de animación.

### Estado global (`state.tsx`)

Un solo contexto con: idioma, vista, modo (armonizado o crudo), base (`modis_primary` o `viirs_primary`), paleta, sonido, área elegida, mes elegido y el calendario cargado. Idioma, paleta y sonido se recuerdan en `localStorage`.

Al arrancar pide `/presets` y precarga los calendarios de las tres regiones, con y sin MODIS, para que cambiar entre ellas sea instantáneo. Los calendarios ya pedidos se guardan en memoria por área y base.

### Flujo de una interacción

```
elegir región / dibujar área ──▶ setAoi ──▶ POST /calendar ──▶ calendario, barras, lectura, consola
elegir un mes                ──▶ setSelected ──▶ POST /hotspots (ese mes) ──▶ fuego y puntos del mapa
"Apagar MODIS"               ──▶ setBasis(viirs_primary) ──▶ POST /calendar (sin SQL: caché del backend)
Armonizado / Crudo           ──▶ setMode ──▶ misma respuesta, otra columna (harmonized / raw_points)
```

### Modo sin backend

Con `VITE_API_URL` vacío, `api.ts` devuelve los mocks de `src/mocks/` (copias de la API real generadas con `scripts/snapshot_mocks.py`). La barra inferior dice "DEMO (mocks)". Sirve para trabajar el frontend sin túnel ni base.

### Dependencia de red

El mapa base (OpenFreeMap) y el relieve 3D (teselas Terrarium) se piden a internet. Sin conexión, el calendario, la consola y las descargas siguen funcionando contra la API local, pero el fondo del mapa no carga.

## 8. Configuración

| Variable | Quién la lee | Valor por defecto |
|---|---|---|
| `DATABASE_URL` | ETL y API | `postgresql://firms:firms_local@127.0.0.1:5432/firms` (la API detecta sola el túnel en 15432) |
| `FIRMS_DATA_DIR` | ETL | `data/` en la raíz del repo |
| `API_MOCK` | API | Sin definir. Con `1` responde con los ejemplos, sin base |
| `VITE_API_URL` | Frontend (`web/.env`) | Vacío = mocks. Con API: `http://localhost:8000/api/v1` |

`web/.env` no se sube a Git; la plantilla es `web/.env.example`.

## 9. Puesta en marcha

```bash
scripts/db_up.sh                                # Postgres + PostGIS en 127.0.0.1:5432
scripts/download_history.sh                     # histórico 2000–2025 a data/
scripts/download_requests.sh                    # solicitudes 2024–2026
uv run python -m etl.run --all                  # ETL completo (o restaurar un respaldo: POBLAR_BASE.md)
uv run uvicorn backend.main:app --port 8000     # API
pnpm install --frozen-lockfile && pnpm dev      # frontend en http://localhost:5173
```

Requisitos: podman, `uv`, Node 24 y `pnpm`. No se instala nada global en la anfitriona.

## 10. Pruebas y verificación

| Qué | Comando | Cubre |
|---|---|---|
| Pruebas de ETL y API | `uv run pytest etl backend` | Ingesta, caídas, VIIRS de referencia, calibración, armonización pura, endpoints y simulación de sistema |
| Cifras de control | `uv run python -m etl.verify` | Celdas-día por año y región y `k` esperado, contra una medición independiente |
| Frontend | `pnpm run build` | Tipos (`tsc`) y empaquetado; después, verificación visual en navegador |
| Cifras del pitch | `python3 scripts/pitch_numbers.py` | Regenera las cifras de `HALLAZGOS.md` desde la API |

Las cifras de control y los criterios de aceptación de cada capa están en [`contracts/acceptance.md`](contracts/acceptance.md). Ningún cambio se da por bueno sin reproducirlas.

## 11. Seguridad y acceso

- La API y Postgres escuchan solo en `127.0.0.1`. Desde otra máquina se llega únicamente por túnel SSH, con llaves restringidas a reenvío de puertos (sin terminal).
- La API solo hace `SELECT`, con consultas parametrizadas.
- CORS limitado a `localhost` y `127.0.0.1`.
- No hay login ni datos personales: todo el contenido es público (NASA FIRMS).
- Las credenciales de la base son locales y de desarrollo; un despliegue público necesitaría otras.

## 12. Decisiones de diseño

| Decisión | Por qué |
|---|---|
| Contar celdas-día, no puntos | Quita la diferencia de resolución entre sensores antes de comparar |
| `k` como cociente de sumas en el traslape | Se explica en una frase y cualquiera lo puede rehacer con el CSV |
| `k` por área, con respaldo nacional | `k` va de 0.21 a 0.38 según el lugar: un factor fijo sería incorrecto |
| Un VIIRS de referencia por día | Tres VIIRS en órbita triplicarían la cuenta |
| Nivel por percentiles, no por cifra | El error mensual (33–37 %) no permite prometer valores exactos |
| Banderas en lugar de ceros | Un mes sin medición no debe parecer un mes sin fuego ni bajar la mediana |
| Armonización en la API, por petición | El área la elige el usuario; no se puede precalcular por región |
| La API devuelve códigos | Un solo lugar para traducir (frontend) y respuestas estables para pruebas |
| Contratos antes que código | Tres equipos trabajando en paralelo sin bloquearse |
| Caché en memoria, sin servicios extra | Una sola máquina y una demo: menos piezas que puedan fallar |

## 13. Límites conocidos

- Un solo `k` por área: no distingue temporada, tipo de vegetación ni día y noche.
- El mes individual es aproximado; el total anual es confiable.
- La máscara de fuentes fijas solo usa `type = 2`; atrapa 94 % (MODIS) y 99.9 % (VIIRS) y quita por error ~2 % del fuego real.
- Antes de julio de 2002 solo observaba Terra: esos meses subestiman.
- La malla de 0.01° no es de área constante (~13 % más chica en el norte de México que en el sur).
- Un mes nublado puede parecer un mes con poco fuego.
- Los presets son rectángulos, no los polígonos oficiales.

Lista completa: [`contracts/harmonization.md`](contracts/harmonization.md), sección "Límites conocidos".

## 14. Fuera del MVP

Argentina y otros países (ya cargada en la base para la fase 2), login, predicción con ML, datos en vivo de la API de FIRMS, Landsat, geoestacionarios y despliegue en la nube. Para abrir otro país hace falta cargar sus CSV, correr el ETL y quitar la restricción de cobertura en `backend/aoi.py`; las fórmulas no cambian.
