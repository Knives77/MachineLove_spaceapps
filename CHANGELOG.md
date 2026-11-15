# Changelog

Cambios que importan al equipo: qué cambió, de qué área y qué hay que hacer después. El detalle está en `git log`.

**Cómo agregar una entrada:** cada PR a `main` agrega una línea arriba, en **Sin publicar**, en la sección de su área (Contratos, ETL, Backend, Front, Docs, Infra). Si cambia un contrato o algo que otro rol usa, se marca con ⚠️ y se dice qué tiene que hacer el otro rol. En cada hito, el líder mueve **Sin publicar** a una sección con la hora.

---

## Sin publicar

Resumen para quien llega: **hagan `git pull`**. Front: además `pnpm install --frozen-lockfile` y reiniciar `pnpm dev` (el front se reorganizó en carpetas). Front instala desde la raíz; el acceso pasa a ser solo por túneles; el analista se enfoca en el pitch; noviembre de 2026 sale como "sin dato".

### ⚠️ Lo que obliga a hacer algo

| Cambio | Quién | Qué hacer |
|---|---|---|
| **Consola de tiempo en Experto y fuego armonizado (dom 15-nov).** El panel izquierdo de Controles ya no existe (`Controls.tsx`, `Kpis.tsx` borrados): ahora hay una consola en todo el borde inferior (`views/expert/TimeConsole.tsx`: regiones, Armonizado/Crudo, herramientas del mapa, actividad mes a mes, pistas MODIS/VIIRS arrastrables, reproducir e interruptor de MODIS) y la lectura del mes arriba a la izquierda (`Readout.tsx`, con Descargas e Inspector de k). El fuego del mapa respeta Armonizado/Crudo (en Armonizado solo las detecciones del sensor que cuenta el calendario ese mes), ya no parpadea sin parar (1.5 s al aparecer) y el mapa baja su resolución si los cuadros salen lentos. Probado en Chromium sin GPU; falta verlo en un equipo modesto real | Front, analista | Front: `git pull` antes de tocar `views/expert/` o `components/map/`. Analista: en Experto, "Apagar MODIS" ahora es el interruptor al final de la pista MODIS, y en Armonizado el mapa muestra menos manchas que en Crudo |
| **Front reorganizado y consola de Experto nueva (dom 15-nov, 01:15).** `MapPanel.tsx`, `views/Expert.tsx` e `i18n.ts` ya no existen: ahora son las carpetas `components/map/`, `views/expert/` e `i18n/`. Cambiaron las fuentes (Space Grotesk y JetBrains Mono; se quitó IBM Plex Mono). Experto es la vista inicial, con fuego sobre el mapa y paneles flotantes | Front, analista | Front: `git pull`, `pnpm install --frozen-lockfile` desde la raíz y **reiniciar `pnpm dev`** (Vite guarda las rutas viejas y la página sale en blanco). Ramas que toquen esos tres archivos tendrán conflictos: avisar antes de fusionar. Analista: la demo abre directo en Experto; el fuego aparece al elegir un mes con actividad (Sierra Gorda en octubre de 2026 casi no tiene) |
| **"Simular fin de MODIS" listo (19:00).** Botón "Apagar MODIS" en General y Experto; la serie con MODIS queda como línea punteada en las barras anuales; el CSV respeta el `basis`; mocks `calendar.viirs.*.json` copiados de la API. Probado en Chromium con la API real y con mocks | Front, analista | Front: `git pull` antes de tocar `state.tsx`, `YearBars.tsx` o `Downloads.tsx`. Analista: el acto 4 ya se puede ensayar; el acto 1 (Crudo) va en la vista Experto |
| **Front fusionado (18:35):** sin Argentina en los textos, sin `tsbuildinfo`, panel del calendario plegable y correcciones de UI. Sigue pendiente **"Simular fin de MODIS"**: `basis` fijo en `state.tsx:77` y `Downloads.tsx:37` | Front | Punto 3 de su checklist: es MVP |
| **Backend fusionado (18:30):** error nuevo `503 db_unavailable`, polígonos en el Golfo y el Pacífico → 422, `viirs_cell_days` desde enero de 2012 y `k` sin redondeo intermedio | Front | Nada: `error.db_unavailable` ya está en `i18n.ts` (se agregó en el merge de front) |
| **Sin video: presentación en vivo con dinámica.** `PITCH.md` §2 v3: el jurado adivina, vota, elige un lugar de México (0.2 s) y apaga MODIS. 6 lugares ya probados en `HALLAZGOS.md` | Analista, front, procesamiento B | Analista: D3 de `ANALISTA.md`. Front: punto 9 de su checklist. Procesamiento B: probar 6 lugares más |
| **Los mocks de los presets ahora son copias de la API real** (`scripts/snapshot_mocks.py`). Los valores reales son 4–7 veces más bajos que el DEMO viejo, con muchos ceros y 12 meses sin dato. Se borró `web/scripts/make-demo-mocks.mjs` y el comando `mock:demo` | Front | `git pull`, revisar las 4 vistas con los mocks nuevos y seguir el orden de `CHECKLIST.md` → Frontend |
| **"Simular fin de MODIS" pasa a MVP** (función 9 del PRD): con datos reales es el único lugar donde `k` cambia lo que se ve | Front | Pasar `basis` a `getCalendar` y al CSV (`state.tsx:77`, `Downloads.tsx:37`) |
| **Guion v2** con datos reales en `PITCH.md` §2: Bajío, temporada ene–mar, febrero de 2026 récord, "Simular fin de MODIS" | Analista | Usarlo de base para D3 |
| **El analista ya no programa ni consulta: diseña el pitch** (`ANALISTA.md`, D1–D6). Procesamiento A busca noticias, Tula y fuentes; procesamiento B mantiene las cifras en `HALLAZGOS.md` | Analista, procesamiento | Ver sus secciones de `CHECKLIST.md` |
| **Solicitudes de FIRMS como release de GitHub** (`datos-2026-11-14`): 8 zips + `SHA256SUMS.txt` | Quien necesite los CSV de 2024–2026 | `scripts/download_requests.sh MX` (verifica SHA-256 y descomprime donde lo busca el ETL) |
| **pnpm: la raíz es un workspace que incluye `web/`.** Un solo `pnpm-lock.yaml` en la raíz; la configuración (`minimumReleaseAge`, override de `postcss`, `allowBuilds`) está en el `pnpm-workspace.yaml` de la raíz. Se borraron `web/pnpm-lock.yaml` y `web/pnpm-workspace.yaml`. Las 191 versiones son las mismas | Front | `pnpm install --frozen-lockfile` **desde la raíz**. `pnpm dev`, `build` y `typecheck` funcionan desde la raíz o desde `web/` |
| **Acceso solo por túneles** (pendiente de aplicar en la anfitriona). Las llaves pasan a `restrict,port-forwarding,permitopen=8000/8001/5432`: sin terminal ni Remote-SSH | Todos | Programar en la laptop y abrir los túneles con `docs/acceso/ssh_config.example`. Postgres llega a la laptop en el puerto 15432 |
| **El analista pasa a ser dueño del pitch.** Los contratos los aprueba el líder (`CLAUDE.md`, regla 1) | Analista | Seguir `docs/ANALISTA.md` (P1–P7) y anotar todo en `docs/HALLAZGOS.md` |
| **Mes parcial = sin dato.** Un mes con `partial_month` conserva `harmonized` y `baseline`, pero lleva `status = "no_data"` y `anomaly_ratio = null`. Antes, noviembre de 2026 (con un día de datos) salía `normal` o `below` | Front | Nada: ya pinta en gris todo mes `no_data` |
| **Procesamiento A y B pasan a apoyar el pitch** | Procesamiento | Tareas nuevas en `docs/CHECKLIST.md` |

### Front
- **Demo y MVP: solo la vista Experto.** Se ocultó el menú "Vista" (General, Aprendizaje, Educacional): la franja de arriba queda con Calendario, idioma y accesibilidad. Las otras vistas siguen en el código; se vuelven a mostrar con `SHOW_VIEW_MENU = true` en `components/TopBar.tsx`. ⚠️ Analista: el guion no puede pasar por General ni Aprendizaje.
- **Buscador por coordenadas a 1024 px.** En pantallas angostas (proyector a 1024 px o zoom del navegador) el buscador tapaba 26 px de la lectura del mes, incluido el botón de Validación (acto 4). Ahora la franja empieza a la derecha de la lectura y el buscador se encoge (317 px a 1024; igual que antes desde 1280). Probado en Chromium a 1024, 1280 y 1366.
- **Fuego también en General y puntos estilo CONAE.** El fuego del mes elegido (`POST /hotspots`) ahora se pinta en General además de Experto (en General no hay botón "Fuego": siempre encendido). Cada detección es un punto rojo → naranja → amarillo según su `frp` (más grande con más `frp`, los más intensos encima) sobre una mancha térmica rojiza que ya no lava a blanco; colores nuevos en `FIRE` de `theme/tokens.ts`. Probado en Chromium con la API real: Bajío, febrero de 2026 (202 hotspots, 44 en fuentes fijas) en General y en Experto. ⚠️ Front: General deja de ser "sin fuego"; el skill ya lo dice.
- **Buscador por coordenadas (Experto).** Barra arriba a la derecha, junto a Calendario: se pega o escribe "lat, lon" y consulta un cuadro de ±25/50/100 km alrededor del punto (mismo `boxAround` que "Explorar otra zona"). Acepta lo que copia Google Maps: decimal (`21.2, -99.6`, `21,2; -99,6`), hemisferios (`21.2N 99.6W`, también `O`) y grados-minutos-segundos; invierte el orden si viene como lon, lat. Atajo `/`. `parseLatLon` y `boxAround` pasan a `lib/geo.ts` (sin maplibre, para no meter el mapa en el paquete principal); `components/map/geometry.ts` los reexporta. Probado en Chromium con la API real a 1366×768 y 1920×1080.
- **Mapa en reposo: de 60 a ~18 cuadros por segundo y de 43 % a 14 % de CPU en JS** (Experto, medido en Chromium con GPU y la API real). El parpadeo del fuego dejaba siempre abierta la transición de 300 ms de `heatmap-intensity`, y MapLibre repintaba el relieve 3D en todos los cuadros. Ahora las propiedades que se animan desde código van con `*-transition: {duration: 0}` (`layers.ts`).
- **Front modularizado (sin cambios de comportamiento).** `MapPanel.tsx` (934 líneas) → `components/map/` en 7 piezas; `views/Expert.tsx` → `views/expert/` en 6; `i18n.ts` → `i18n/es.ts`, `i18n/en.ts` e `index.ts`. ⚠️ Front: si tienen ramas que tocan esos tres archivos, habrá conflictos al fusionar; y reinicien `pnpm dev` después del pull (Vite se queda con las rutas viejas en caché).
- **Fuego en el mapa, animaciones, fuentes nuevas y rendimiento (Experto).** Fuego extendido (mancha de calor que parpadea, con el brillo normalizado según cuántas detecciones hay) sobre las zonas con hotspots en el mes elegido, con datos de `POST /hotspots` (endpoint de mejora de `api.md`, sin cambio de contrato); botón "Fuego" para apagarlo. Fuentes Space Grotesk y JetBrains Mono en lugar de IBM Plex Mono (⚠️ dependencias cambiadas: `pnpm install --frozen-lockfile` desde la raíz). Paneles y secciones animados, franja única de botones arriba a la derecha. Rendimiento: sin desenfoque de fondo sobre el mapa, mapa a `pixelRatio` ≤ 1.5, mocks y vistas secundarias bajo demanda (JS inicial de 920 kB a 415 kB). Los colores del tema y de los niveles **no cambian** (se probó una paleta cálida y se descartó).
- **Experto: mapa al 100 % y paneles flotantes.** Se quitó la barra superior en Experto (el nombre de la app ya no aparece; Calendario, idioma, accesibilidad y Vista van en una franja flotante arriba a la derecha). Controles a la izquierda y calendario a la derecha, ambos ocultables, con secciones plegables (Descargas e Inspector de k cerradas al inicio). Las regiones pasaron al panel de controles. Las demás vistas conservan su barra superior. La barra inferior de telemetría muestra cuántos hotspots hay en el mes elegido.
- **Rediseño de Experto como consola y vista inicial.** La app abre en Experto: mapa 3D con relieve (MapLibre nativo) y barra flotante de herramientas, atajos 1–3 para las regiones, panel analítico con interruptor maestro Crudo/Armonizado, 3 indicadores, barras anuales alineadas con el calendario en mosaicos, y barra inferior de telemetría. General, Aprendizaje y Educacional no cambian. Skill de frontend y `CLAUDE.md` actualizados. Analista: la ruta de la demo ya no necesita cambiar de vista para el acto 1 (Crudo).

### Base de datos
- `docs/POBLAR_BASE.md`: cómo poblar la base desde cero (esquema + ETL, **125 s** medidos) o restaurando un respaldo (**96 s**). Probado en bases nuevas que después se borraron.
- Corregido el comando de restauración de `BITACORA_BASE.md`: `pg_restore -j` no funciona leyendo de la entrada estándar; ahora el respaldo se copia dentro del contenedor.

### Contratos
- `harmonization.md`, `api.md`: regla del mes parcial.
- `acceptance.md`: el peor año de `viirs_primary` se compara con el `loyo_annual_max` del mismo preset, no con un 45 % fijo. Sierra Gorda 2020 da 50.7 %, con un máximo de 55.2 %.
- `harmonization.md`: límites conocidos de la máscara y de las caídas falsas, y los errores medidos con la API (anual 6–17 %, mensual 33–37 %).
- Nuevo `docs/contracts/README.md`: índice, quién produce y quién consume cada contrato, cómo se comprueba, cómo se cambia y la tabla de cambios.

### Backend
- Aplica la regla del mes parcial; prueba unitaria nueva y prueba E2E actualizada. 46 pruebas en verde.

### ETL
- `etl.verify` usa el criterio nuevo de `viirs_primary`: **54/54**.

### Docs
- **`k` en el guion = `k` en pantalla.** `scripts/pitch_numbers.py` redondeaba `k` distinto que el front: la API manda 4 decimales (0.3035) y Python daba 0.303 mientras la pantalla muestra 0.304. Ahora redondea como la pantalla. `HALLAZGOS.md` → Cifras regenerado (H4): solo cambian Bajío 0.304 y Querétaro 0.290; `PITCH.md` ya decía eso. ⚠️ Analista: usar 0.304 y 0.290.
- Skill de backend: el comando de pruebas es `uv run pytest backend` (decía `pytest api`, una carpeta que ya no existe).
- `docs/TOPOLOGIA.md` reemplaza a `docs/ACCESS.md`, que describía cuentas y una carpeta `/srv/machinelove` que no existen. La guía y las plantillas de SSH se movieron a `docs/acceso/`.
- `docs/ANALISTA.md` reescrito con 7 tareas con hora; `docs/HALLAZGOS.md` con su plantilla.
- `CHECKLIST.md` y `PRD.md` al día: H0–H2 cumplidos y lo pendiente por rol.
- `PITCH.md` con cifras de la app: A1 (crudo 524 → 7,304 en Querétaro), A3, A4, A5, A12, y A11 medida. Sin MODIS, la serie anual cambia 6–16 % en mediana, pero el estado mensual solo coincide en el 55 % de los meses. Ya no se dice que "el calendario no cambia".

### Infra
- `scripts/pitch_numbers.py`: imprime desde la API las cifras del pitch. Solo usa la biblioteca estándar de Python.
- La raíz ya no instala `@anthropic-ai/claude-code`; no era parte del proyecto.
- Se borraron `data/profiling/*.py`, scripts de un solo uso; el perfilado está en `docs/referencia/DATA_PROFILING_FIRMS.md`.

---

## 14-nov-2026 · 17:00 · H1 alcanzado

### Backend
- ⚠️ Se movió de `api/` a `backend/`. Comando: `uv run uvicorn backend.main:app --port 8000`. La skill `api` se renombró a `backend`.
- La cobertura es solo México: un polígono en Argentina o en el océano devuelve 422 `aoi_outside_coverage`.
- `/health` devuelve `data_through` = 2026-11-01, la fecha de México (antes daba la de Argentina).
- Pruebas E2E contra PostGIS real. Con los presets responde en 0.35 s y con un polígono en Jalisco en 0.46 s.
- API corriendo en la máquina anfitriona en `127.0.0.1:8000`, con la base `firms`.

### Front
- Vista por año, mapa con dibujo y cálculo de área, leyenda nueva, paleta de alto contraste, sonificación por nivel, y mocks DEMO que reaccionan al polígono dibujado.
- ⚠️ **pnpm fijado:** `packageManager: pnpm@12.18.0`, `engines.node >=24 <25` y `web/pnpm-workspace.yaml` con `minimumReleaseAge: 1440`, override `postcss: 8.5.32` y `allowBuilds: esbuild`. Instalar siempre con `pnpm install --frozen-lockfile`. Las reglas están en `.claude/skills/frontend/SKILL.md`.
- Pendiente: conectarse a la API real, quitar Argentina de los textos y de los mocks, y dejar de subir `web/tsconfig.tsbuildinfo`.

### Infra
- `*.tsbuildinfo` agregado a `.gitignore`; se quitó del repo.
- `GUIA_TUNELES_SSH.md` se movió a `docs/`.
- Respaldo H1 de `firms` y `firms_dev` (16:34) en `~/backups/machinelove/`. Pendiente: copiarlo a un disco externo.

### Docs
- `docs/BITACORA_BASE.md`: estado de la base, corridas del ETL en `firms` y respaldos.

---

## 14-nov-2026 · 14:50 · ETL completo

### ETL
- Paso 4 (`etl/cells.py`): `cell` y `cell_day` con la regla del VIIRS de referencia (S-NPP antes de 2018-04-01, NOAA-20 después, respaldo si hay caída).
- Paso 5 (`etl/calibrate.py`): `calibration_country`. `k` de México = 0.3323 y de Argentina = 0.4641, con 167 meses de traslape.
- `etl/verify.py`: valida contra las cifras de control de `acceptance.md`. Las cifras de Chilecito se cambiaron por las de Bajío.
- Pasos 4 y 5 corridos en `firms` (14:54): cell 1,481,420 · cell_day 8,721,793.

### Docs
- ⚠️ **Alcance del MVP: solo México.** Argentina queda cargada para la fase 2 y el mundo para la fase 3. Se actualizaron `CLAUDE.md`, el PRD, el checklist, el contexto y los contratos.
- `docs/ANALISTA.md` (investigaciones I1–I7 con SQL) y `docs/PITCH.md` (guion, afirmaciones con evidencia, preguntas de jueces, pruebas de la demo).

### Front
- Primera versión desde Figma Make: las 4 vistas con mocks. Capturas de diseño en `docs/design/`.

---

## 14-nov-2026 · 14:05 · Ingesta y calidad de datos

### ETL
- Paso 1 (`etl/ingest.py`): ingesta de los CSV de FIRMS (archivo histórico, *archive* y NRT) con COPY a `detection`. Argentina 2026 completada: 16,168,961 detecciones en total.
- Paso 2 (`etl/mask.py`): máscara de fuentes fijas, 3,111 celdas.
- Paso 3 (`etl/outages.py`): caídas de sensor detectadas y del Readme de FIRMS, 463 intervalos.

### Infra
- `scripts/db_up.sh` (PostgreSQL 16 + PostGIS 3.4 en podman) y `scripts/download_history.sh`.
- Acceso por cuentas propias con Remote-SSH en `/srv/machinelove` (`docs/ACCESS.md`).

---

## 14-nov-2026 · 11:43 · Inicio

- Estructura del repo, `CLAUDE.md`, PRD, contexto, contratos (`docs/contracts/`), skills por rol y checklist.
