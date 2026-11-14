# Contexto del proyecto

## 1. El reto

**NASA Space Apps Challenge 2026 — Harmonization of MODIS and VIIRS Hot Spots.** Dificultad intermedia/avanzada. Autora: Marina Compagnucci (CONAE, Argentina).

Los satélites detectan focos de calor (*hotspots*) desde el año 2000, pero con dos familias de sensores que no se pueden comparar directamente:

| | MODIS (Terra, Aqua) | VIIRS (S-NPP, NOAA-20, NOAA-21) |
|---|---|---|
| Disponible | Terra nov-2000, Aqua jul-2002 → hoy, cerca del fin de vida | S-NPP ene-2012 → 2-nov-2026 (cesó). NOAA-20 abr-2018 →. NOAA-21 2024 → |
| Píxel nominal | 1 km (hasta 4.8 × 2 km en el borde del barrido) | 375 m (hasta ~0.8 km) |
| Sensibilidad | No ve fuegos pequeños (FRP mediano 18 MW en México) | Ve fuegos pequeños (FRP mediano ~5 MW) |
| Hora de paso | Terra ~10:30, Aqua ~13:30 | ~13:30 |

Lo que se pide: (1) armonizar ambos registros en una serie consistente y (2) una aplicación web con un **calendario de actividad de quema** (matriz año × mes) donde el usuario elige una región y un rango de fechas, ve patrones estacionales, años extremos y cómo se compara el mes actual con la mediana histórica, y descarga un CSV.

Usuarios: equipos de alerta temprana y respuesta a emergencias, científicos, gestores territoriales, brigadistas.

Premios a los que apuntamos: Best Use of Science (método validado), Best Use of Data (26 años de FIRMS), Local Impact (Querétaro).

Caso oficial del video: incendio de Chilecito, La Rioja, Argentina (activación CONAE ACT#356, 28-jul a 2-ago-2026; área afectada 6,549 → 9,158 → 11,655 ha).

## 2. Datos en disco

| Carpeta | Contenido | Cobertura |
|---|---|---|
| `data/historico_pais/{Mexico,Argentina}/modis/` | CSV por año, FIRMS "country" | 2000-11 → 2025-12 |
| `data/historico_pais/.../viirs-snpp/` | ídem, S-NPP | 2012-01-20 → 2025-12 |
| `data/historico_pais/.../viirs-jpss1/` | ídem, NOAA-20 | 2018 → 2025-12 |
| `data/México-Querétaro/*/` | Solicitudes FIRMS 844352–844355, todo México, 4 sensores | 2024-01-01 → 2026-11-01 |
| `data/Argentina/*/` | Solicitudes 849410–849413, toda Argentina (fuera del MVP) | 2026-01-01 → 2026-11-14 |

- NOAA-21 no existe en el formato por país; solo lo tenemos 2024–2026 en las solicitudes.
- Argentina 2026 completo ya está cargado (14-nov). Los CSV viejos de jul–ago quedaron en `data/_anterior/`.
- Perfilado completo de las solicitudes: `docs/referencia/DATA_PROFILING_FIRMS.md`.

Los dos formatos tienen columnas distintas; el detalle está en `docs/contracts/ingest.md`.

## 3. Lo que medimos (14-nov, malla 0.01°, solo `type = 0`)

### El salto artificial existe y es grande

Recuadro de Querétaro (lat 20.0–21.7, lon −100.6 a −99.0):

| Año | Puntos crudos, todos los sensores | Celdas-día MODIS | Celdas-día S-NPP | Celdas-día NOAA-20 |
|---|---:|---:|---:|---:|
| 2011 | 423 | 410 | — | — |
| 2012 | 904 | 190 | 557 | — |
| 2017 | 2,352 | 416 | 1,486 | — |
| 2019 | 4,554 | 414 | 1,374 | 1,409 |
| 2025 | 5,295 | 562 | 1,688 | 1,702 |

Los puntos crudos dicen que 2019 fue 11 veces 2011. MODIS, que observó los dos años igual, dice que fueron iguales (410 vs 414).

### Qué corrige cada paso

| Comparación contra MODIS (Querétaro 2024–2026) | Razón |
|---|---:|
| Puntos crudos, 3 VIIRS sumados | 12.6× |
| Celdas-día, 3 VIIRS unidos | 7.4× |
| Celdas-día, un solo VIIRS | 3.2× |

La malla quita la duplicación por resolución, usar un solo VIIRS de referencia quita la duplicación por constelación, y lo que queda (≈3×) es sensibilidad: eso se corrige con calibración.

### Los VIIRS son intercambiables entre sí

Razón NOAA-20 / S-NPP en celdas-día, abr-2018 a 2025: Querétaro 1.016, Sierra Gorda 1.008, Chilecito 1.001. Correlación mensual 0.98–0.99. El relevo S-NPP → NOAA-20 no necesita corrección.

### Calibración MODIS ↔ VIIRS en el traslape 2012–2025 (167 meses)

`k = Σ celdas-día MODIS / Σ celdas-día S-NPP`

| Región | k | Error anual, dejando un año fuera (mediana / máx.) | Error mensual mediano |
|---|---:|---:|---:|
| Recuadro Querétaro | 0.293 | 6.8% / 13.7% | 29.8% |
| Sierra Gorda (lat > 20.9) | 0.262 | 14.7% / 42.6% | 38.8% |
| Bajío (lat 20.0–20.9) | 0.307 | sin medir | sin medir |
| Chilecito, Argentina (fase 2) | 0.395 | 23.7% / 55.1% | 28.9% |

- **k cambia por región**, incluso dentro de Querétaro (0.26 Sierra Gorda, 0.31 Bajío; 0.40 en Chilecito): se calcula por área consultada, no global.
- Probamos una regresión log-log y **no mejoró** al factor regional (Querétaro: 8.8% anual contra 6.8%; Sierra Gorda 29.4% contra 14.7%). Se descarta por ahora.
- El error mensual (~30%) es alto porque los conteos mensuales son pequeños. Hay que mostrarlo, no esconderlo: el calendario clasifica por percentiles y la interfaz enseña el error de validación.

## 4. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Entrega | Demo local + video + repo público |
| Dónde corre | Base, API estable y CSV en la máquina de quien lidera; cada quien programa en su laptop y entra solo por túnel SSH con llaves restringidas (`docs/TOPOLOGIA.md`) |
| Datos | Solo archivos descargados. Sin API de FIRMS en vivo |
| Cobertura | **Solo México en el MVP** (decisión del 14-nov). Presets: Sierra Gorda, Bajío queretano, recuadro Querétaro. Polígono libre dentro de México. Argentina está cargada pero fuera del MVP: fase 2 = Chilecito, fase 3 = otros países |
| Procesamiento | Python 3.12, `uv`, polars, psycopg `COPY` |
| Base de datos | PostgreSQL 16 + PostGIS en `podman` (no hay Docker en el anfitrión) |
| Backend | FastAPI |
| Frontend | Figma Make → React + Vite + Tailwind, bilingüe ES/EN con selector |
| Malla | 0.01° × 0.01° (~1.1 × 1.0 km). Sin H3: una dependencia menos y es la malla con la que validamos |
| Armonización | Celdas-día + un VIIRS de referencia + factor `k` por región calibrado en el traslape. Unidad de salida: **celdas-día equivalentes MODIS** |
| Equipo | 2 frontend, 2 procesamiento, 1 backend, 1 analista/puente. Nivel Python básico: el código lo escriben agentes |
| Máscara de fuentes fijas | Solo `type = 2` (≥ 3 fechas). No se añaden `type = 1/3`: en las celdas costeras hay más fuego real que plataformas (medido 14-nov) |
| Falsas caídas en días tranquilos | Se aceptan: solo marcan meses de 2001–2002, que además ya son `terra_only` |

## 5. Correcciones a la conversación previa con Gemini

| Lo que decía | Lo que encontramos |
|---|---|
| "No necesitas descargar más datos" | Con 2024–2026 no hay mediana histórica ni salto visible. Ya se bajó 2000–2025 |
| k = 4.22 (puntos VIIRS / puntos MODIS) como factor oficial | Es una razón de puntos crudos en 31 meses. La calibración se hace sobre celdas-día y por región |
| "Dividir por k y ponderar por FRP" | Nunca quedó definido como fórmula. FRP sale del método del MVP; queda como métrica secundaria opcional |
| Regresión/quantile mapping como mejora obvia | Medido: la regresión log-log no supera al factor regional |
| H3 resolución 8 | Sustituido por malla 0.01° |
| Docker + `postgis:16-3.4-alpine` | No hay Docker; se usa podman |
| El `type = 2` del sur de Querétaro es Tula | No está verificado. No afirmarlo en el pitch sin comprobarlo en el mapa |
| NOAA-20/21 no tienen archivo `archive` (Readme) | Sí lo tienen y traen `type` |
| "Chilecito supera el P90 histórico" | No estaba calculado. Se podrá afirmar o no cuando el ETL cargue Argentina 2000–2026 |
