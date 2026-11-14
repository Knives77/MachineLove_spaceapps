# Checklist del equipo

**Alcance del MVP: solo México** (decidido el 14-nov). Argentina está cargada en la base para la fase 2; nadie trabaja en ella hasta que el MVP esté completo.

Hitos (detalle en `docs/PRD.md`):

| Hito | Hora | Qué debe existir |
|---|---|---|
| H0 | Sáb 14:30 | Accesos probados, contratos congelados, front trabajando con mocks |
| H1 | Sáb 18:30 | ETL completo: `cell_day`, `sensor_outage`, `calibration_country` cargadas y verificadas |
| H2 | Sáb 21:30 | API con datos reales para los 3 presets |
| H3 | Dom 00:00 | **MVP completo**: front contra API real, interruptor crudo/armonizado funcionando |
| H4 | Dom 07:00 | Pulido, polígono libre, bilingüe revisado |
| H5 | Dom 09:00 | Código congelado |
| H6 | Dom 11:30 | Video y entrega enviados |

Reglas para todos:

- Una rama por persona (`etl-a`, `etl-b`, `Backend`, `web-a`, `web-b`). Se integra a `main` con PR pequeños; nadie empuja directo a `main` salvo el líder.
- Antes de pedir que algo se integre: sus pruebas pasan y lo probó contra `docs/contracts/acceptance.md`.
- Si necesitan un campo o un cambio de forma que no está en el contrato, se le pide al analista. No se inventa.
- En cada hito: `git pull`, se corre todo junto, el analista pasa la lista de aceptación.

---

## Líder (máquina anfitriona)

**Ya**
- [ ] `git push origin main` de lo pendiente.
- [x] Pedir en FIRMS Argentina 2026 (4 sensores, 2026-01-01 → hoy, CSV) y recargar con `uv run python -m etl.run --step 1 --country AR` (pasos en el chat / `docs/CONTEXT.md` §2).
- [ ] Cuentas y llaves de los 5 compañeros funcionando; cada uno confirma que entra (Wi-Fi y cable).
- [ ] Crear las ramas y dar acceso de escritura al repo en GitHub.
- [ ] Mandar a cada rol su sección de este checklist.

**Durante**
- [ ] Revisar y fusionar PRs a `main`.
- [ ] Correr el ETL completo en `firms` cuando procesamiento lo pida (nadie más carga la base oficial). Anotar cada corrida en `docs/BITACORA_BASE.md`.
  - [x] Pasos 4 y 5 + `etl.verify` en `firms` (14:54): 53/54.
- [ ] Mantener la API estable en el puerto 8000 con lo último de `main`.
- [ ] Respaldo de `firms` y `firms_dev` en H1, H3 y H5 (comando en `docs/BITACORA_BASE.md`) y copia a un disco externo.
  - [x] H1: 16:34, `~/backups/machinelove/*_20261114_1634.dump` (falta copiarlo al disco externo).
  - [ ] H3 (00:00).
  - [ ] H5 (09:00).
- [ ] En cada hito, decidir qué se recorta si vamos tarde (orden: mejoras → polígono libre → CSV del calendario; **nunca** el interruptor ni el panel de validación).
- [ ] La máquina no se suspende ni cambia de red.

---

## Procesamiento A · limpieza y calidad de datos

Skill: `.claude/skills/etl/SKILL.md`. Base de pruebas: `firms_dev`.

**Hasta H1 (18:30)**
- [x] **Paso 2 · `etl/mask.py`**: llenar `static_cell` (celdas con `type = 2` en ≥ 3 fechas distintas) y poner `is_veg = false` a las detecciones NRT que caen en esas celdas.
- [x] Prueba: ninguna celda con < 3 fechas; 40,212 de 209,923 detecciones NRT apagadas (19%).
- [x] **Paso 3 · `etl/outages.py`**: llenar `sensor_outage`:
  - [x] `detected`: días seguidos sin ninguna detección de un satélite en todo el país, dentro de su periodo operativo (`harmonization.md`).
  - [x] `firms_readme`: huecos documentados de MODIS (2001-06/07, 2007-08, 2009-04-21/22).
  - [x] `coverage`: periodos sin archivos (Argentina 2026 fuera de lo descargado; todo después de 2026-11-01).
- [x] Prueba: existe S-NPP, México, 2024-05-30 → 2024-06-03 y 2026-07-11 → 2026-07-16.
- [x] Avisar a Procesamiento B en cuanto `static_cell` y `sensor_outage` estén en `firms_dev`.

**Después de H1**
- [x] Recargar Argentina 2026 completo (ene–14 nov) y correr pasos 2–3. Falta 4–5 cuando existan.
- [ ] Verificar en el mapa si el `type = 2` del sur de Querétaro es Tula u otra cosa (para el pitch).
- [ ] Ayudar al analista con cifras para las diapositivas (cuánto ruido industrial se quitó por región).

---

## Procesamiento B · celdas-día y calibración

Skill: `.claude/skills/etl/SKILL.md`. Puede empezar ya contra `firms_dev`, sin esperar a A: con `sensor_outage` vacía, la regla del VIIRS de referencia simplemente no usa respaldo.

**Hasta H1 (18:30)**
- [x] **Paso 4 · `etl/cells.py`**:
  - [x] `cell`: una fila por celda con al menos una detección, con `country` y `geom` = centro de la celda.
  - [x] `cell_day`: `modis_veg`, `viirs_veg` (regla del VIIRS de referencia: SNPP antes de 2018-04-01, N20 después, respaldo si hay caída), `raw_points`, `raw_modis`, `raw_viirs`, `frp_modis`, `frp_viirs`.
- [x] Prueba: la consulta de control del skill reproduce la tabla de `acceptance.md` (Querétaro MODIS 410 / 190 / 414 en 2011 / 2012 / 2019). Ojo: el límite superior del recuadro es exclusivo (`2169` / `-9901`); con `2170` / `-9900` sobran 4–6 %. `uv run python -m etl.verify`: 42/42 cifras de celdas-día.
- [x] **Paso 5 · `etl/calibrate.py`**: `calibration_country` (k por país y error dejando un año fuera).
- [x] Prueba: con SNPP en todo el traslape, `k` Querétaro ≈ 0.293; con la regla oficial cambia menos de 0.01. (0.292 / 0.290; Sierra Gorda 0.262 / 0.260; Chilecito 0.395 / 0.394.)
- [x] `uv run python -m etl.run --all` corre de principio a fin en `firms_dev` (pasos 2–5 en 69 s; el 1 necesita los CSV del anfitrión).
- [x] Avisar al líder para correr 4 y 5 en `firms` y luego `uv run python -m etl.verify`. (Corrido a las 14:54: 53/54; ver `docs/BITACORA_BASE.md`.)

**Después de H1**
- [ ] Informe para el pitch: para los 3 presets, `k`, error anual y la serie anual cruda vs armonizada (tabla o CSV para el analista).
- [ ] Mejora si sobra tiempo: probar `k` por temporada (seca/lluvias) y medir si baja el error mensual. Solo se adopta si mejora y el analista cambia el contrato.

---

## Backend

Skill: `.claude/skills/backend/SKILL.md`. Contrato: `docs/contracts/api.md`.

**Hasta H0 (14:30)**
- [ ] Esqueleto FastAPI con `API_MOCK=1` devolviendo los JSON de `docs/contracts/examples/` en `/presets` y `/calendar`. Corriendo en 8001.
- [ ] Avisar al front que ya pueden apuntar a la API (aunque sea mock).

**Hasta H2 (21:30)**
- [ ] `backend/harmonize.py` (funciones puras, sin base): `k` con respaldo al de país si `Σ M < 100`, serie `modis_primary` y `viirs_primary`, banderas, línea base (≥ 10 años, excluyendo meses con banderas), percentiles, `status`, `years`, `seasonality`, `latest`.
- [ ] Pruebas de cada fila de las tablas de `harmonization.md`.
- [ ] `backend/aoi.py`: preset o polígono, validación, área (> 200,000 km² → error), país.
- [ ] `POST /calendar` con la consulta del skill sobre `cell_day` (puede probar contra `firms_dev` en cuanto B cargue celdas).
- [ ] `POST /calendar.csv` y `POST /hotspots.csv` (streaming).
- [ ] Errores con la forma del contrato (`invalid_geometry`, `aoi_too_large`, `aoi_outside_coverage`, …).
- [ ] Sección API de `acceptance.md` pasando; preset < 2 s.
- [ ] Pedir al líder que levante la versión estable en 8000.

**Después de H2**
- [ ] Polígono libre < 8 s.
- [ ] Mejora: `POST /hotspots` (GeoJSON de puntos de un mes, para pintar en el mapa).

---

## Frontend A · mapa y estructura

Skill: `.claude/skills/frontend/SKILL.md`. Mismo archivo de Figma Make que Front B.

**Hasta H0 (14:30)**
- [ ] Primer prompt en Figma Make (prompt base del skill + los dos JSON de ejemplo).
- [ ] Acordar con Front B la distribución de pantalla antes de pulir nada.

**Hasta H3 (00:00)**
- [ ] Mapa con 3 botones de preset (nombres de `name_es` / `name_en`); al elegir uno, encuadra.
- [ ] Dibujar rectángulo y polígono, borrar; envía GeoJSON `[lon, lat]` cerrado.
- [ ] Selector ES/EN con diccionario `i18n.ts` (incluye `status.*`, `flag.*`, `source.*`, `error.*`).
- [ ] Exportar a `web/` y subir a la rama `web-a` en cuanto haya una pantalla usable.
- [ ] `web/src/api.ts`: mocks si `VITE_API_URL` está vacío, API real si no. Ningún componente hace `fetch` directo.
- [ ] Conectar a la API real por túnel (`VITE_API_URL=http://localhost:8000/api/v1`).
- [ ] Mensajes de error y estado de carga.

**Después de H3**
- [ ] Mejora: puntos del mes seleccionado sobre el mapa.
- [ ] Revisión completa en 1366 × 768 y con teclado.

---

## Frontend B · calendario y análisis

Skill: `.claude/skills/frontend/SKILL.md`.

**Hasta H3 (00:00)**
- [ ] Calendario año × mes (2000–2026) con rampa viridis/cividis, escala raíz cuadrada, leyenda.
- [ ] Interruptor **Crudo / Armonizado** que cambia matriz y barras anuales.
- [ ] Meses `no_data` con trama gris (distintos del cero); marca en la esquina si hay `flags`.
- [ ] Tooltip: mes, valor, mediana, razón, estado, fuente, banderas.
- [ ] Tarjeta del mes (`latest`): valor, mediana, razón, estado con icono y texto.
- [ ] Barras anuales (`years`), marcando años incompletos.
- [ ] Panel de validación: `k`, alcance, meses de traslape, error anual y mensual; aviso si `scope = "country"`.
- [ ] Botones de descarga de los dos CSV.
- [ ] Probado contra la API real.

**Después de H3**
- [ ] Mejora: barra de estacionalidad (12 meses).
- [ ] Mejora: botón "Simular fin de MODIS" (`basis = viirs_primary`).
- [ ] Sección Frontend de `acceptance.md`: escala de grises, daltonismo, teclado.

---

## Analista / puente

Es el cerebro y la dirección del equipo: decide contratos, qué se dice y si un hito pasa (`docs/PITCH.md` §7).
Guías: **`docs/ANALISTA.md`** (investigaciones con SQL) y **`docs/PITCH.md`** (guion, evidencia, pruebas de demo). Todo hallazgo va a `docs/HALLAZGOS.md`; si no está ahí, no se dice en el pitch.

**Ya (antes de H0, 14:30)**
- [ ] **I1** · Confirmar requisitos de la entrega con los organizadores (video, duración, página, repo, uso de IA, hora de cierre). Si algo choca con el PRD, avisar al líder.
- [ ] Leer `CLAUDE.md`, `docs/PRD.md`, `docs/CONTEXT.md` y todos los contratos; anotar aquí la hora en que quedan congelados: ______
- [ ] Generar un mock de `/calendar` con los 324 meses (2000–2026) en `docs/contracts/examples/calendar.full.json` y pasárselo al front.
- [ ] Confirmar que front, backend y procesamiento B tienen acceso (túnel o Remote-SSH) y saben qué leer.

**Hasta H1 (18:30) — mientras el equipo programa**
- [ ] **I2** · Caso local destacado de México: meses récord de Sierra Gorda y Bajío y si coinciden con incendios reportados. Consulta en `ANALISTA.md`.
- [ ] **I3** · ¿Qué instalaciones explican el ruido industrial del sur de Querétaro? (¿Tula sí o no?)
- [ ] **I7** · Casos reales para el pitch: 2–3 eventos de fuego en México con fuente, verificados en la base; elegir el del minuto 2:20 y, si hace falta, proponer un preset nuevo.
- [ ] **I4** · Escribir los límites conocidos en `docs/contracts/harmonization.md` (máscara solo `type = 2`, calidad de la máscara, falsas caídas en 2001–2002).
- [ ] **I5** · Citas: FIRMS, MODIS C6.1, VIIRS 375 m C2, cese de Suomi-NPP.
- [ ] Verificar H1: las cifras de control de `acceptance.md` (sección ETL y Calibración) salen en `cell_day` y `calibration_country`.

**En cada hito (H1, H2, H3, H4)**
- [ ] Pasar la sección de `acceptance.md` del hito y anotar en `HALLAZGOS.md` qué falla y de quién es.
- [ ] Mensaje de 3 líneas al chat: qué pasó, qué falla y de quién, qué se recorta.
- [ ] Actualizar el estado (✅/⏳) de la tabla de afirmaciones de `PITCH.md` §3.
- [ ] Resolver dudas de contrato en menos de 15 minutos; todo cambio se escribe primero en `docs/contracts/` y se avisa en el chat.

**Hasta H4 (07:00)**
- [ ] Guion de 3 minutos (`PITCH.md` §2) **con cifras reales** de la app, no del mock.
- [ ] Correr los 13 escenarios de demo (`PITCH.md` §6) en H3 y H4, y la coherencia de números contra la base.
- [ ] Completar y ensayar las respuestas de `PITCH.md` §5 con el equipo.
- [ ] Diapositivas o material de apoyo para el video.
- [ ] README del repo: qué es, cómo correrlo, método en 6 pasos, fuentes y cita de FIRMS.
- [ ] **I6** (solo si sobra tiempo) · Polígonos reales de Sierra Gorda y del estado de Querétaro para los presets.

**H5–H6 (09:00–11:30)**
- [ ] Plan B de `PITCH.md` §6: capturas de cada paso y video de respaldo.
- [ ] Ensayar la demo completa 2 veces con cronómetro: una persona habla, otra opera.
- [ ] Grabar el video con la app real.
- [ ] Llenar la página del proyecto y enviar antes de las 11:30.
