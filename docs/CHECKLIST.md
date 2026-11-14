# Checklist del equipo

**Alcance del MVP: solo México.** Argentina está cargada en la base para la fase 2; nadie trabaja en ella hasta que el MVP esté completo.

Estado al sábado 14-nov, 17:30: **H1 y H2 cumplidos antes de tiempo.** La API corre con datos reales en la anfitriona (puerto 8000). Lo que falta para el MVP es que el front se conecte a ella (H3).

| Hito | Hora | Qué debe existir | Estado |
|---|---|---|---|
| H0 | Sáb 14:30 | Accesos, contratos congelados, front con mocks | ✅ |
| H1 | Sáb 18:30 | ETL completo y verificado en `firms` | ✅ 14:54 · `etl.verify` 54/54 |
| H2 | Sáb 21:30 | API con datos reales para los 3 presets | ✅ 17:00 · 0.35 s por preset |
| H3 | Dom 00:00 | **MVP completo**: front contra la API real, interruptor crudo/armonizado | ⏳ front |
| H4 | Dom 07:00 | Pulido, polígono libre, bilingüe revisado, ensayo del pitch | |
| H5 | Dom 09:00 | Código congelado | |
| H6 | Dom 11:30 | Video y entrega enviados | |

Reglas para todos:

- Una rama por rol. PR pequeño a `main`, con sus pruebas pasando y **su línea en `CHANGELOG.md`**. Solo el líder empuja directo a `main`.
- Si necesitan un campo o un cambio que no está en el contrato, se pide en el chat. No se inventa (`docs/contracts/README.md`).
- En cada hito: `git pull`, se corre todo junto y se pasan las casillas de `docs/contracts/acceptance.md`.
- Dónde corre cada cosa y cómo conectarse: `docs/TOPOLOGIA.md`.

---

## Líder (máquina anfitriona)

**Ya**
- [ ] `git push origin main`.
- [ ] Restringir las 3 llaves del equipo a túneles (`docs/acceso/authorized_keys.example`) y avisar que ahora se trabaja desde la laptop (`docs/TOPOLOGIA.md`).
- [ ] Copiar el respaldo H1 a un disco externo.

**Durante**
- [x] API estable en 8000 con lo último de `main` (17:00).
- [ ] Revisar y fusionar PRs. Si cambia `backend/`, reiniciar la API; si cambia `etl/`, correr el paso en `firms`, `etl.verify` y anotarlo en `BITACORA_BASE.md`.
- [x] Respaldo H1 (16:34).
- [ ] Respaldo H3 (00:00) y H5 (09:00).
- [ ] En cada hito, decidir qué se recorta si vamos tarde (orden: mejoras → polígono libre → CSV del calendario; **nunca** el interruptor ni el panel de validación).
- [ ] Resolver las dudas de contrato en menos de 15 minutos (`docs/contracts/README.md`) y avisar al analista si afectan al pitch.
- [ ] La anfitriona no se suspende ni cambia de red.

---

## Procesamiento A · limpieza y calidad de datos

Hecho: ingesta (16.17 M detecciones), máscara (3,111 celdas fijas) y caídas (463 intervalos), en `firms` y `firms_dev`.

**Ahora: apoyo al pitch**
- [ ] **Tula (afirmación A10).** Correr la consulta de "Si sobra tiempo" de `docs/ANALISTA.md`, revisar las 15 celdas en Google Maps (vista satélite) y pasarle al analista qué instalación es cada una. Si Tula no aparece, se avisa y no se menciona.
- [ ] Cuánto ruido industrial se quitó por preset: detecciones NRT apagadas por la máscara en Sierra Gorda, Bajío y Querétaro completo. Va a `docs/HALLAZGOS.md`.

---

## Procesamiento B · celdas-día y calibración

Hecho: `cell`, `cell_day` y `calibration_country` en `firms`; `etl.verify` 54/54.

**Ahora: apoyo al pitch**
- [ ] Verificar en la base el caso que elija el analista (P2 de `ANALISTA.md`): que el evento se vea en `detection` y en `cell_day` en sus fechas.
- [ ] Mejora, solo si sobra tiempo: `k` por temporada (seca/lluvias) y medir si baja el error mensual (hoy 33–37 %). Se adopta solo si mejora y se cambia el contrato.

---

## Backend

Hecho: los 6 endpoints del contrato con datos reales, cobertura solo México, `/health` con la fecha de México, mes parcial = `no_data`, 46 pruebas. Presets en 0.35 s y polígono en 0.46 s.

**Ahora**
- [ ] `backend/aoi.py:145`: el texto del error dice "Mexico or Argentina"; dejarlo en "Mexico" (y el docstring de la línea 134).
- [ ] Acompañar al front mientras se conecta: si algo de la respuesta no les cuadra, se resuelve con el contrato en la mano.
- [ ] Probar `basis = viirs_primary` desde el front cuando exista el botón "Simular fin de MODIS".

---

## Frontend

Skill: `.claude/skills/frontend/SKILL.md`. Hecho: las 4 vistas, mapa con dibujo, calendario, tarjeta, leyenda, paletas, mocks DEMO, pnpm fijado.

**Hasta H3 (00:00)**
- [ ] `pnpm install --frozen-lockfile` **desde la raíz del repo** (ahora es un workspace; ver `CHANGELOG.md`).
- [ ] Conectar a la API real: `VITE_API_URL=http://localhost:8000/api/v1` en `web/.env`, con el túnel al 8000.
- [ ] Probar contra la API real: los 3 presets, un polígono en Jalisco, uno en Argentina (error), uno en el océano (error) y uno gigante (error).
- [ ] Quitar Argentina de lo visible: `error.aoi_outside_coverage` y `map.coverage` en `i18n.ts` (ES y EN), y `AR` de `COVERAGE` en el mock de `api.ts`.
- [ ] `git rm --cached web/tsconfig.tsbuildinfo` en su rama.
- [ ] Interruptor **Crudo / Armonizado** cambia matriz y barras anuales: con la API real, en Bajío se ve el salto de 2012 en crudo y desaparece en armonizado.
- [ ] Meses `no_data` (nov–dic 2026) con trama gris; marca en la esquina si hay `flags`.
- [ ] Panel de validación con `k`, alcance, meses de traslape y errores anual y mensual.
- [ ] Los dos CSV se descargan y abren en una hoja de cálculo.

**Después de H3**
- [ ] Botón "Simular fin de MODIS" (`basis = viirs_primary`), mostrando sobre todo las **barras anuales** (ver A11 en `PITCH.md`).
- [ ] Sección Frontend de `acceptance.md`: escala de grises, daltonismo, teclado, 1366 × 768.
- [ ] Zoom del navegador probado en el proyector.

---

## Analista · dueño del pitch

Guía completa con herramientas y plazos: **`docs/ANALISTA.md`**. Todo lo que se diga va antes a `docs/HALLAZGOS.md`.

- [ ] **P1 · ya** · Requisitos de la entrega (video, página, repo, IA, hora de cierre).
- [ ] **P2 · 21:00** · Caso del pitch: febrero de 2026 en el Bajío u otro, con noticia o reporte.
- [ ] **P3 · 22:00** · Guion de `PITCH.md` §2 con las cifras de `scripts/pitch_numbers.py`.
- [ ] **P4 · 23:30** · Fuentes y citas (FIRMS, MODIS, VIIRS, cese de S-NPP).
- [ ] **P5 · 07:00** · Guion del video en tomas, diapositivas y texto de la página en ES/EN.
- [ ] **P6 · H3 y H4** · 13 escenarios de la demo, cruce de números y ensayo de preguntas.
- [ ] **P7 · 09:00–11:30** · Plan B, grabación y envío.
