# Changelog

Cambios que importan al equipo: qué cambió, de qué área y qué hay que hacer después. El detalle está en `git log`.

**Cómo agregar una entrada:** cada PR a `main` agrega una línea arriba, en **Sin publicar**, en la sección de su área (Contratos, ETL, Backend, Front, Docs, Infra). Si cambia un contrato o algo que otro rol usa, se marca con ⚠️ y se dice qué tiene que hacer el otro rol. En cada hito, el líder mueve **Sin publicar** a una sección con la hora.

---

## Sin publicar

### Infra
- ⚠️ **pnpm: la raíz ahora es un workspace que incluye `web/`.** Hay un solo `pnpm-lock.yaml` (en la raíz) y la configuración (`minimumReleaseAge`, override de `postcss`, `allowBuilds`) está en el `pnpm-workspace.yaml` de la raíz. Se borraron `web/pnpm-lock.yaml` y `web/pnpm-workspace.yaml`. Las 191 versiones resueltas son las mismas. **Front:** `git pull` y `pnpm install --frozen-lockfile` **desde la raíz**; `pnpm dev`, `pnpm build` y `pnpm typecheck` funcionan desde la raíz o desde `web/`.
- La raíz ya no instala `@anthropic-ai/claude-code`; no era parte del proyecto.
- ⚠️ **Acceso solo por túneles.** Las llaves del equipo pasan a `restrict,port-forwarding,permitopen=8000/8001/5432`: sin terminal ni Remote-SSH en la anfitriona. **Todos:** programar en la laptop y abrir los túneles con `docs/acceso/ssh_config.example`. Postgres llega a la laptop en el puerto 15432.
- `scripts/pitch_numbers.py`: imprime desde la API las cifras del pitch (k, errores, salto falso, temporada, meses récord, 2026, "sin MODIS"). Solo usa la biblioteca estándar de Python.
- Se borraron `data/profiling/*.py`, scripts de un solo uso; su resultado está en `docs/referencia/DATA_PROFILING_FIRMS.md`.

### Docs
- `docs/TOPOLOGIA.md` reemplaza a `docs/ACCESS.md`, que describía cuentas y una carpeta `/srv/machinelove` que no existen. La guía y las plantillas de SSH se movieron a `docs/acceso/`.
- `docs/contracts/README.md`: índice de contratos (quién produce y quién consume cada uno, cómo se comprueba), cómo se cambia un contrato y la tabla de cambios.
- ⚠️ **El analista pasa a ser dueño del pitch.** `docs/ANALISTA.md` se reescribió con 7 tareas con hora (P1–P7), y `docs/HALLAZGOS.md` ya existe con su plantilla. Los contratos los aprueba el líder (`CLAUDE.md`, regla 1).
- `CHECKLIST.md` y `PRD.md` al día: H0–H2 cumplidos, tareas pendientes por rol. Procesamiento A y B pasan a apoyar el pitch.
- `harmonization.md`: límites conocidos de la máscara y de las caídas falsas, y los errores medidos con la API. `PITCH.md`: A1, A3, A4, A5 y A12 con cifras de la app.

### Contratos
- ⚠️ **Mes parcial = sin dato.** Un mes con `partial_month` conserva `harmonized` y `baseline`, pero ahora lleva `status = "no_data"` y `anomaly_ratio = null`. Antes, noviembre de 2026 (con un solo día de datos) salía `normal` o `below`. (`harmonization.md`, `api.md`) **Front:** nada que hacer, ya pinta en gris todo mes `no_data`. **Analista:** revisar la decisión.
- **Criterio de `viirs_primary` medido.** El peor año ya no se compara contra un 45 % fijo, sino contra el `loyo_annual_max` del mismo preset. Sierra Gorda 2020 da 50.7 %, con un LOYO máximo de 55.2 %. (`acceptance.md`)

### Backend
- Aplica la regla del mes parcial; prueba unitaria nueva y prueba E2E actualizada. 46 pruebas en verde.

### ETL
- `etl.verify` usa el criterio nuevo de `viirs_primary`: **54/54**.

### Docs
- `PITCH.md`, afirmación A11 medida: sin MODIS, la serie anual cambia entre 6 y 16 % en mediana, pero el estado mensual solo coincide en el 55 % de los meses de 2012–2025 (en el 90 % queda a un nivel o menos). Ya no se dice que "el calendario no cambia"; la demo de "Simular fin de MODIS" usa las barras anuales.

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
