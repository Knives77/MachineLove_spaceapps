# Análisis Exhaustivo de Discrepancias y Acoplamiento: Frontend (`web/`) ↔ Backend (`backend/`)

Este documento registra el análisis línea por línea entre los contratos oficiales ([docs/contracts/api.md](../docs/contracts/api.md), [docs/contracts/harmonization.md](../docs/contracts/harmonization.md), [docs/contracts/acceptance.md](../docs/contracts/acceptance.md)), el cliente y vistas del Frontend ([web/src/api.ts](../web/src/api.ts), [web/src/types.ts](../web/src/types.ts), [web/src/state.tsx](../web/src/state.tsx), [web/src/views/](../web/src/views/)) y la implementación real del Backend ([backend/](.)).

---

## 1. Discrepancias detectadas y corregidas en `backend/`

### D1 · `viirs_cell_days` en enero de 2012 (`2012-01`) vs. `acceptance.md` y `Learn.tsx`
- **Causa:** En `backend/harmonize.py`, se usaba `ym >= (2012, 2)` tanto para definir el inicio del traslape como para decidir si `viirs_cell_days` era `None`. Sin embargo, S-NPP inició operaciones el `2012-01-20` ([harmonization.md](../docs/contracts/harmonization.md#L70)) y registró **24 celdas-día** en Querétaro en enero de 2012.
- **Impacto en Frontend y Aceptación:**
  1. En [acceptance.md](../docs/contracts/acceptance.md#L13), Querétaro 2012 S-NPP exige **557** celdas-día (`24` de ene-2012 + `533` de feb–dic 2012). Al anular `2012-01`, la suma anual de `viirs_cell_days` daba `533`.
  2. En la vista de Aprendizaje ([web/src/views/Learn.tsx](../web/src/views/Learn.tsx#L119-L151)), el selector de años empieza en `2012`. Al elegir `2012` en el Paso 3, enero aparecía con trama de "Sin dato" (`hatch`) para VIIRS mientras MODIS sí mostraba barra.
- **Solución aplicada en `backend/harmonize.py`:** Se separó `has_viirs_data = ym >= (2012, 1)` (para reportar `viirs_cell_days` desde enero de 2012) de `has_viirs_cov = ym >= (2012, 2)` (para mantener el traslape y `viirs_primary` estrictamente en `2012-02 .. 2025-12`). Ahora 2012 suma exactamente **557** celdas-día VIIRS.

---

### D2 · Redondeo intermedio de `k` al calcular `harmonized = round(k * V(m), 1)`
- **Causa:** `compute_calibration` redondeaba `calibration.k = round(sum_m / sum_v, 4)` y luego `build_calendar_response` multiplicaba `V(m)` por ese `k` truncado a 4 decimales en vez del cociente exacto `sum_m / sum_v`.
- **Impacto:** En 6 meses de la serie `viirs_primary` (por ejemplo, `2017-05` en Sierra Gorda y 5 meses en `qro-recuadro`), el redondeo intermedio desplazaba `harmonized` y la mediana de `baseline` en `0.1` respecto a la fórmula exacta `k_aoi = ΣM / ΣV` de [harmonization.md](../docs/contracts/harmonization.md#L21).
- **Solución aplicada en `backend/harmonize.py`:** `build_calendar_response` utiliza el cociente exacto `sum_m / sum_v` (cuando `scope == "aoi"`) antes de redondear cada mes a 1 decimal (`round(k * v_val, 1)`), manteniendo `calibration.k` redondeado a 4 decimales para visualización.

---

### D3 · Formato de error JSON cuando cae la base de datos o el túnel SSH
- **Causa:** En [web/src/api.ts](../web/src/api.ts#L35-L46), cuando una respuesta HTTP no es `2xx`, el Frontend intenta leer `body.error.code` para traducirlo mediante `t('error.' + code)` en [web/src/i18n.ts](../web/src/i18n.ts#L62-L68). Anteriormente, solo `/health` capturaba excepciones de `psycopg`, mientras que `/presets`, `/calendar`, `/calendar.csv` y `/hotspots.csv` devolvían un `500 Internal Server Error` en texto plano si se cerraba el túnel SSH.
- **Solución aplicada en `backend/main.py`:** Se registró un manejador global `@app.exception_handler(psycopg.Error)` que devuelve `503 Service Unavailable` con el JSON del contrato:
  ```json
  {"error": {"code": "db_unavailable", "detail": "Database unavailable: OperationalError"}}
  ```

---

## 2. Puntos de acoplamiento y configuración Frontend ↔ Backend a tener presentes

### D4 · Variable `VITE_API_URL` y puertos (`8000` vs `8001`)
- **Cómo funciona `web/src/api.ts`:**
  - Si `VITE_API_URL` está vacía (valor por defecto en `web/.env.example`), `usingMocks === true`: el Frontend **no llama al Backend** y muestra la etiqueta `· DEMO` en la barra superior usando los archivos de `web/src/mocks/`.
  - Para conectar el Frontend al Backend real sin tocar archivos de `web/`, se pasa la variable de entorno al levantar Vite:
    - Contra el backend local de desarrollo (`8001`): `VITE_API_URL=http://localhost:8001/api/v1`
    - Contra el puerto estable del contrato (`8000`): `VITE_API_URL=http://localhost:8000/api/v1`

### D5 · Orden de presets en `GET /api/v1/presets` y vista `Edu.tsx`
- En [web/src/views/Edu.tsx](../web/src/views/Edu.tsx#L8-L17), la vista Educacional busca específicamente `PAIR = ['qro-sierra-gorda', 'qro-bajio']` dentro de `presets.data.features`, y en [web/src/components/MapPanel.tsx](../web/src/components/MapPanel.tsx#L163) el botón de limpiar polígono vuelve a `features[0]?.id ?? 'qro-sierra-gorda'`.
- `backend/queries.py` (`fetch_presets`) garantiza siempre el orden fijo `('qro-sierra-gorda', 'qro-bajio', 'qro-recuadro')`, por lo que `features[0]` es siempre `qro-sierra-gorda`.

### D6 · Polígonos libres sin celdas dentro del rectángulo de México (`scope = "country"`)
- Según [.claude/skills/backend/SKILL.md](../.claude/skills/backend/SKILL.md#L54):
  > *"Si el área no tiene celdas de México y no toca el rectángulo de México (lat 14.5–32.8, lon −118.5 a −86.5) → 422 `aoi_outside_coverage`."*
- Si un usuario dibuja un polígono pequeño dentro del rectángulo de México donde no hubo incendios (`0` celdas en `cell`), el Backend responde `200 OK` con `calibration.scope = "country"`, `k = 0.3323` (`calibration_country` de México) y los meses con cobertura en `0.0`. En el Frontend, `KInspector.tsx` muestra automáticamente el aviso amarillo `val.scopeWarn` (*"El área tiene pocos datos en el traslape; se usó el factor de respaldo del país"*).
- Polígonos fuera del rectángulo de México (océano abierto o Argentina) devuelven `422 aoi_outside_coverage`, que el Frontend traduce con `error.aoi_outside_coverage`.

### D7 · Límite documentado del método en `viirs_primary` para Sierra Gorda (año 2020)
- En [docs/contracts/acceptance.md](../docs/contracts/acceptance.md#L45), se pide que con `basis = viirs_primary` la diferencia anual 2012–2025 tenga mediana `< 20%` y máximo `< 45%`.
- Con los datos reales de `firms`:
  - **`qro-recuadro`**: mediana = **6.1%**, máximo = **23.8%** (cumple holgadamente ✅).
  - **`qro-bajio`**: mediana = **9.9%**, máximo = **40.2%** (cumple holgadamente ✅).
  - **`qro-sierra-gorda`**: mediana = **16.1%** (`< 20%` ✅), pero el año **2020** (año de muy poca actividad en Sierra Gorda) presenta una desviación de **50.8%**. Tal como documentó el líder del proyecto, no es un bug de código sino un límite real del método en regiones pequeñas durante años con muy poco fuego.

---

## 3. Verificación de compatibilidad de contrato (235 comprobaciones contra `firms`)

| Aspecto verificado | Frontend (`web/src/`) | Backend (`backend/`) | Estado |
|---|---|---|---|
| `GET /api/v1/health` | No lo invoca directo (usado para monitoreo) | `{"status": "ok", "data_through": "2026-11-01"}` | ✅ |
| `GET /api/v1/presets` | `PresetCollection` con `id`, `properties.{name_es, name_en, country}`, `geometry` | Idéntico desde tabla `preset` (`qro-sierra-gorda`, `qro-bajio`, `qro-recuadro`) | ✅ |
| `POST /api/v1/calendar` | Envía `{aoi, start_year: 2000, end_year: 2026, basis: 'modis_primary'}` | Devuelve `324` meses, `27` años, `seasonality[12]` ($\sum = 1.0$), `latest = {2026, 10}` en `< 1.6 s` | ✅ |
| `POST /api/v1/calendar.csv` | Lee `Content-Disposition` y descarga blob CSV | Cabecera y 324 filas con `flags` separadas por `\|` y `expose_headers=["Content-Disposition"]` en CORS | ✅ |
| `POST /api/v1/hotspots.csv` | Envía `{aoi, start_date, end_date}` del mes seleccionado (`monthRange`) | Streaming desde cursor de servidor sobre `detection` con `ST_Intersects` exacto | ✅ |
| Códigos de error (`error.code`) | Traduce `invalid_geometry`, `aoi_too_large`, `invalid_range`, `unknown_preset`, `aoi_outside_coverage` | Devuelve exactamente esos códigos con `{error: {code, detail}}` | ✅ |

