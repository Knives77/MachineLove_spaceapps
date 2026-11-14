# Pruebas de aceptación y cifras de control

Las cifras salen de una medición independiente del 14-nov sobre `data/historico_pais/` (solo `type = 0`, malla 0.01°, bordes del recuadro incluidos). Si el ETL no las reproduce con una diferencia menor al 1%, hay un error en el ETL.

## ETL

Celdas-día por año. Sierra Gorda = lat 20.9–21.7, lon −100.6 a −99.0. Recuadro Querétaro = lat 20.0–21.7, mismo lon. Bajío = lat 20.0–20.9, mismo lon.

| Año | Qro MODIS | Qro S-NPP | Qro N20 | S. Gorda MODIS | S. Gorda S-NPP | Bajío MODIS | Bajío S-NPP |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2003 | 268 | — | — | 117 | — | 151 | — |
| 2011 | 410 | — | — | 167 | — | 243 | — |
| 2012 | 190 | 557 | — | 83 | 363 | 107 | 194 |
| 2017 | 416 | 1,486 | — | 99 | 387 | 317 | 1,099 |
| 2019 | 414 | 1,374 | 1,409 | 154 | 563 | 260 | 811 |
| 2024 | 306 | 1,017 | 1,033 | 120 | 332 | 186 | 685 |
| 2025 | 562 | 1,688 | 1,702 | 115 | 389 | 447 | 1,299 |

Puntos crudos (MODIS + S-NPP + N20, solo `type = 0`) en el recuadro Querétaro: 2011 = 423 · 2012 = 904 · 2019 = 4,554 · 2025 = 5,295.

Otras comprobaciones:

- [ ] Ninguna fila con `satellite = 'N'` ni fuera de {Terra, Aqua, SNPP, N20, N21}.
- [ ] `acq_time` siempre de 4 caracteres; existen valores que empiezan con `0`.
- [ ] Ninguna detección duplicada entre fuente A y fuentes B/C (contar por satélite y año 2024, 2025: debe coincidir con el número de filas de la fuente A).
- [ ] `detection` con `source = 'nrt'` tiene `type IS NULL` en todas sus filas.
- [ ] `static_cell` no está vacía y ninguna celda de Sierra Gorda con menos de 3 fechas aparece.
- [ ] `sensor_outage` contiene S-NPP, México, 2024-05-30 → 2024-06-03 y 2026-07-11 → 2026-07-16.

## Calibración

| Región | `k` esperado | `loyo_annual_mape` |
|---|---:|---:|
| Recuadro Querétaro | 0.293 | 0.068 |
| Sierra Gorda | 0.262 | 0.147 |
| Bajío | 0.307 | sin medir: registrar el valor |

Calculadas con S-NPP como VIIRS en todo 2012-02 → 2025-12. Con la regla oficial (NOAA-20 desde abr-2018) deben moverse menos de 0.01.

## API

- [ ] `GET /presets` devuelve 3 regiones.
- [ ] `POST /calendar` con `qro-sierra-gorda` devuelve 324 meses (2000–2026) y `calibration.k` entre 0.25 y 0.28.
- [ ] La suma de `raw_points` de 2019 es más de 5 veces la de 2011; la de `harmonized`, menos de 1.5 veces.
- [ ] Con `basis = viirs_primary`, el total anual `harmonized` de cada año 2012–2025 difiere menos de 45% del de `modis_primary`, y la mediana de esas diferencias es menor a 20%.
- [ ] Un mes con `no_coverage` tiene `harmonized = null` y no cuenta en `baseline.n_years`.
- [ ] Polígono en el océano → 422 `aoi_outside_coverage`.
- [ ] `/hotspots.csv` de Sierra Gorda, 2025-03-01 → 2025-05-31, descarga y abre en una hoja de cálculo.
- [ ] Polígono en Argentina → 422 `aoi_outside_coverage` (fuera del MVP).

## Frontend

- [ ] Funciona completo contra los mocks sin backend.
- [ ] El interruptor crudo/armonizado cambia matriz y gráfica anual sin recargar.
- [ ] Los meses `no_data` se distinguen de los meses con valor 0.
- [ ] La rampa de color se lee en escala de grises y con simulación de daltonismo.
- [ ] Cambiar ES/EN traduce todo, incluidos estados y banderas.
- [ ] Se usa con teclado y en una pantalla de 1366 × 768.
