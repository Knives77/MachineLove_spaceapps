# Checklist del equipo

**Alcance del MVP: solo México.** Argentina está cargada en la base para la fase 2; nadie trabaja en ella hasta que el MVP esté completo.

Estado al sábado 14-nov, 17:30: **H1 y H2 cumplidos antes de tiempo.** La API corre con datos reales en la anfitriona (puerto 8000). Lo que falta para el MVP es que el front se conecte a ella (H3).

| Hito | Hora | Qué debe existir | Estado |
|---|---|---|---|
| H0 | Sáb 14:30 | Accesos, contratos congelados, front con mocks | ✅ |
| H1 | Sáb 18:30 | ETL completo y verificado en `firms` | ✅ 14:54 · `etl.verify` 54/54 |
| H2 | Sáb 21:30 | API con datos reales para los 3 presets | ✅ 17:00 · 0.35 s por preset |
| H3 | Dom 00:00 | **MVP completo**: front contra la API real, interruptor crudo/armonizado | ⏳ front |
| H4 | Dom 07:00 | Pulido, polígono libre, bilingüe revisado, presentación y dinámica ensayadas | |
| H5 | Dom 09:00 | Código congelado | |
| H6 | Dom 11:30 | Presentación en vivo lista y entrega enviada (sin video) | |

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
- [ ] Publicar la release `datos-2026-11-14` en GitHub con los 8 zips y `SHA256SUMS.txt` (ver `CHANGELOG.md`). Probar `scripts/download_requests.sh MX` desde otra máquina.

**Durante**
- [x] API estable en 8000 con lo último de `main` (17:00).
- [ ] Revisar y fusionar PRs. Si cambia `backend/`, reiniciar la API; si cambia `etl/`, correr el paso en `firms`, `etl.verify` y anotarlo en `BITACORA_BASE.md`.
- [x] Respaldo H1 (16:34).
- [ ] Respaldo H3 (00:00) y H5 (09:00).
- [ ] En cada hito, decidir qué se recorta si vamos tarde (orden: mejoras → polígono libre → CSV del calendario; **nunca** el interruptor ni el panel de validación).
- [ ] Resolver las dudas de contrato en menos de 15 minutos (`docs/contracts/README.md`) y avisar al analista si afectan al pitch.
- [ ] La anfitriona no se suspende ni cambia de red.

---

## Procesamiento A · investigación para el pitch

Hecho: ingesta (16.17 M detecciones), máscara (3,111 celdas fijas) y caídas (463 intervalos), en `firms` y `firms_dev`. Ahora le das al analista los **hechos externos**; todo va a `docs/HALLAZGOS.md`.

- [ ] **Noticias del caso (antes de las 21:00).** Para cada candidato de `HALLAZGOS.md` → Caso (febrero de 2026 en el Bajío primero, luego 2025 y mayo de 2024 en Sierra Gorda): buscar incendios o quemas reportados (CONAFOR, Protección Civil de Querétaro, SEDESU, prensa local). Anotar nombre, municipio, fechas, hectáreas y enlace. Si no hay nada, escribir "sin noticia".
- [ ] **Tula (A10).** Las 15 celdas fijas más fuertes del sur de Querétaro (consulta abajo), cada una en Google Maps (vista satélite): qué instalación es. Si Tula no aparece, se anota y no se menciona.
  ```sql
  SELECT n_dates, round((cy + 0.5) / 100.0, 3) AS lat, round((cx + 0.5) / 100.0, 3) AS lon
  FROM static_cell WHERE cy BETWEEN 2000 AND 2090 AND cx BETWEEN -10060 AND -9900
  ORDER BY n_dates DESC LIMIT 15;
  ```
- [ ] **Fuentes (antes de las 23:30).** Cita oficial de FIRMS, referencias de MODIS C6.1 (candidato: Giglio et al. 2016, *RSE*) y VIIRS 375 m (candidato: Schroeder et al. 2014, *RSE*), y la fuente del cese de S-NPP el 2-nov-2026 (blog de FIRMS/LANCE). Solo lo que encuentres y leas; nada inventado.

---

## Procesamiento B · cifras para el pitch

Hecho: `cell`, `cell_day` y `calibration_country` en `firms`; `etl.verify` 54/54. Ahora eres el dueño de **los números** que usa el analista.

- [ ] `python3 scripts/pitch_numbers.py` en H3 y en H4, y reemplazar el bloque de `HALLAZGOS.md` → Cifras con la hora. Si una cifra cambia respecto a la anterior, avisar al analista.
- [ ] Verificar en la base el caso que elija el analista: que el evento se vea en `detection` y en `cell_day` en sus fechas. Anotarlo junto al caso.
- [ ] Cruce de la demo (`PITCH.md` §6): `k` y totales en pantalla contra `pitch_numbers.py`.
- [ ] **Lugares para "Elijan un lugar"** (acto 3 de la dinámica): ya hay 6 en `HALLAZGOS.md`. Agregar 6 más que un juez podría pedir: Guadalajara, Monterrey, Puebla, Michoacán, Veracruz, Sonora. De cada uno: recuadro, tiempo de respuesta, `k`, peor mes y temporada. Si alguno sale raro (por ejemplo, `k` muy alto o `scope = country`), anotarlo para que el analista tenga la frase lista.
- [ ] Mejora, solo si sobra tiempo: `k` por temporada y medir si baja el error mensual (hoy 33–37 %). Solo se adopta si mejora y se cambia el contrato.

---

## Backend

Hecho: los 6 endpoints del contrato con datos reales, cobertura solo México, `/health` con la fecha de México, mes parcial = `no_data`, 46 pruebas. Presets en 0.35 s y polígono en 0.46 s.

**Ahora**
- [ ] `backend/aoi.py:145`: el texto del error dice "Mexico or Argentina"; dejarlo en "Mexico" (y el docstring de la línea 134).
- [ ] Acompañar al front mientras se conecta: si algo de la respuesta no les cuadra, se resuelve con el contrato en la mano.
- [ ] Probar `basis = viirs_primary` desde el front cuando exista el botón "Simular fin de MODIS".

---

## Frontend

Skill: `.claude/skills/frontend/SKILL.md` (sección **Datos reales**). Hecho: las 4 vistas, mapa con dibujo, calendario, tarjeta, leyenda, paletas, pnpm fijado.

**Ya cambió:** los mocks de los 3 presets ahora son **copias de la API real**. Sin túnel ya ven lo mismo que verá el jurado, y es muy distinto del DEMO viejo: valores 4–7 veces más bajos, 58 meses en 0 en Sierra Gorda y 2000 casi todo en gris.

**En este orden (hasta H3, 00:00)**
1. [ ] `git pull` y `pnpm install --frozen-lockfile` **desde la raíz**. Abrir las 4 vistas con los mocks nuevos y anotar qué se ve mal con datos reales (celdas casi todas oscuras, barras planas, la fila 2000 gris, textos que ya no cuadran).
2. [ ] Corregir lo que se vea mal del punto 1. La escala de color y las barras deben leerse con máximos de 64 (Sierra Gorda) a 166 (Querétaro).
3. [ ] **Botón "Simular fin de MODIS"** (ahora es MVP, función 9 del PRD): pasar `basis` a `getCalendar` y a la descarga del CSV, en lugar del `'modis_primary'` fijo de `state.tsx:77` y `Downloads.tsx:37`. Mostrar sobre todo las barras anuales.
4. [ ] **Ruta de la demo** (`PITCH.md` §2): preset Bajío → Crudo → Armonizado → clic en febrero de 2026 → Simular fin de MODIS → Sierra Gorda. Que cada paso se vea bien y sin esperas. Valorar que el preset inicial sea Bajío (`DEFAULT_PRESET` en `state.tsx`): con Sierra Gorda, la tarjeta abre en octubre de 2026 = 0.
5. [ ] Conectar a la API real (`VITE_API_URL=http://localhost:8000/api/v1`, túnel al 8000) y probar: 3 presets, polígono en Jalisco, en Argentina, en el océano y uno gigante (los tres últimos dan error).
6. [ ] Quitar Argentina de lo visible: `error.aoi_outside_coverage` y `map.coverage` en `i18n.ts` (ES y EN), y `AR` de `COVERAGE` en el mock de `api.ts`.
7. [ ] `git rm --cached web/tsconfig.tsbuildinfo` en su rama.
8. [ ] Los dos CSV se descargan y abren en una hoja de cálculo.

9. [ ] **Para la dinámica en vivo** (`PITCH.md` §2): dibujar un rectángulo debe ser rápido y obvio (un clic para la herramienta); la tarjeta del lugar se tiene que leer desde lejos; el botón "Simular fin de MODIS" debe ser grande, para que un juez lo presione sin explicación, y debe poder volver al modo normal.

**Después de H3**
- [ ] Opcional, solo si el analista lo pide antes de las 23:00: **"Escuchen 26 años"**. En `Timeline.tsx`, que la reproducción toque `playStatus(row.status)` en cada mes y tenga una velocidad rápida (~100 ms por mes; hoy son 450 ms y 26 años tardan más de 2 minutos).
- [ ] Capturas de pantalla con datos reales para el plan B (las que pida el analista).
- [ ] Sección Frontend de `acceptance.md`: escala de grises, daltonismo, teclado, 1366 × 768, zoom del proyector.

---

## Analista · diseñador de la presentación

Guía completa: **`docs/ANALISTA.md`**. Se presenta **en vivo, sin video**, con una dinámica en la que participa el jurado. Sin código ni consultas: los números te los da procesamiento B y los hechos externos procesamiento A, todo en `docs/HALLAZGOS.md`.

- [ ] **D1 · ya** · Reglas de la entrega, formato de la presentación en vivo y criterios de los jueces.
- [ ] **D2 · 21:00** · La historia: problema, momento "ajá", caso, futuro sin MODIS, quién lo usa, cierre.
- [ ] **D3 · 22:30** · La dinámica con el jurado (propuesta en 4 actos en `PITCH.md` §2).
- [ ] **D4 · 23:30** · Guion minuto a minuto, ruta de la demo para front, apoyos y texto de la página.
- [ ] **D5 · H3 y H4** · Ensayos con alguien haciendo de jurado, escenarios de la demo y preguntas.
- [ ] **D6 · 09:00–11:30** · Plan B, ensayo en la sala y envío.
