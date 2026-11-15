# Contratos

Los contratos fijan lo que una parte del sistema le entrega a la otra. El código se adapta a ellos, nunca al revés (regla 1 de `CLAUDE.md`).

## Cadena

```
CSV de FIRMS ──ingest.md──▶ detection ──db_schema.sql──▶ cell_day, sensor_outage, calibration_country
                                                              │
                                              harmonization.md (fórmulas)
                                                              ▼
                                         backend ──api.md + examples/──▶ web
                                                              │
                                     acceptance.md: cifras con las que se comprueba cada eslabón
```

## Archivos

| Archivo | Qué fija | Lo produce | Lo consume | Se comprueba con |
|---|---|---|---|---|
| [`ingest.md`](ingest.md) | Columnas reales de cada CSV de FIRMS, precedencia entre fuentes, normalización, `is_veg`, máscara estática | — (FIRMS) | `etl/ingest.py`, `etl/mask.py` | `uv run pytest etl` |
| [`db_schema.sql`](db_schema.sql) | Las 7 tablas, sus columnas, índices y los 3 presets | ETL | Backend, analista | `psql -f` sin errores |
| [`harmonization.md`](harmonization.md) | VIIRS de referencia, `k`, traslape, serie armonizada, banderas, línea base, `status`, detección de caídas, límites conocidos | — (método) | `etl/cells.py`, `etl/calibrate.py`, `etl/outages.py`, `backend/harmonize.py` | `uv run pytest backend`, `etl.verify` |
| [`api.md`](api.md) | Endpoints, petición, respuesta, códigos de error, tiempos objetivo | Backend | Front (`web/src/api.ts`, `web/src/types.ts`) | `backend/tests/test_api.py` |
| [`examples/`](examples/) | JSON de ejemplo de `/presets` y `/calendar` con la forma exacta | Líder | Mocks del front | El front compila contra ellos |
| [`acceptance.md`](acceptance.md) | Cifras de control y casillas por hito (ETL, calibración, API, front) | Líder | Todos | `uv run python -m etl.verify`, pruebas E2E |

## Cómo se cambia un contrato

1. Quien lo necesita lo pide al líder en el chat: qué campo, para qué y quién se ve afectado.
2. El líder decide en menos de 15 minutos (y avisa al analista si cambia algo del pitch). Si dice que sí, **primero** se edita el contrato.
3. Se agrega una línea en la tabla de cambios de abajo y en `CHANGELOG.md`, marcada con ⚠️.
4. Después cambian el código y las pruebas: el productor primero y el consumidor después.
5. Si cambia la forma del JSON, también se actualizan `examples/` y `web/src/types.ts`.

Lo que **no** se cambia sin acuerdo de todo el equipo: la unidad (`modis_equivalent_cell_days`), los códigos de `status` y de `flags`, y la malla de 0.01°.

## Cambios

| Fecha | Contrato | Cambio | Afecta a |
|---|---|---|---|
| 14-nov 18:30 | `api.md` | Nuevo error `503 db_unavailable`; regla de cercanía (0.15°) para polígonos sin celdas; `viirs_cell_days` se reporta desde 2012-01 (el traslape sigue empezando en 2012-02) | Front: `error.db_unavailable` agregado a `i18n.ts` |
| 14-nov 17:00 | `harmonization.md`, `api.md`, `acceptance.md` | Un mes con `partial_month` lleva `status = "no_data"` y `anomaly_ratio = null`, pero conserva `harmonized` | Backend (hecho), front (sin cambios) |
| 14-nov 17:00 | `acceptance.md` | `viirs_primary`: el peor año se compara con `calibration.loyo_annual_max`, no con un 45 % fijo | `etl.verify` (hecho) |
| 14-nov 14:30 | todos | MVP solo México: `aoi_outside_coverage` fuera de México; `AR` reservado para la fase 2; Bajío reemplaza a Chilecito en las cifras de control | Backend, front, ETL (hecho) |
| 14-nov 12:00 | todos | Primera versión congelada | — |
