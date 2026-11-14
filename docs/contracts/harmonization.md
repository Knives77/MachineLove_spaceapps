# Contrato de armonización

Todas las fórmulas se aplican **dentro del área consultada (AOI)** y por mes.

## Definiciones

| Símbolo | Definición |
|---|---|
| celda | `(cy, cx)` = `(floor(lat·100), floor(lon·100))` |
| VIIRS de referencia | **S-NPP** si `acq_date < 2018-04-01`; **NOAA-20** después. Si el de referencia tiene caída ese día (`sensor_outage`), se usa el otro; si ambos faltan, NOAA-21 |
| `M(m)` | celdas-día del mes `m` con `modis_veg = true` |
| `V(m)` | celdas-día del mes `m` con `viirs_veg = true` |
| `R(m)` | suma de `raw_points` del mes (modo crudo) |
| traslape | meses de **2012-02 a 2025-12** sin bandera de caída de MODIS ni del VIIRS de referencia |

`cell_day.viirs_veg` ya viene calculado por el ETL con la regla del VIIRS de referencia; el backend no la repite.

## Calibración

```
k_aoi = Σ M(m) / Σ V(m)        sobre los meses de traslape
```

- Si `Σ M(m)` en el traslape es **< 100**, se usa `calibration_country.k` y la respuesta lleva `calibration.scope = "country"`. Si no, `scope = "aoi"`.
- Validación dejando un año fuera: para cada año `y` del traslape con `Σ M ≥ 20`, calcular `k` sin ese año y `err_y = |k·ΣV_y − ΣM_y| / ΣM_y`. Se reporta la mediana (`loyo_annual_mape`) y el máximo.
- `monthly_mape`: mediana de `|k·V(m) − M(m)| / M(m)` en meses del traslape con `M(m) ≥ 10`.

## Serie armonizada (celdas-día equivalentes MODIS)

Parámetro `basis`:

| `basis` | `harmonized(m)` | `source` |
|---|---|---|
| `modis_primary` (por defecto) | `M(m)` si MODIS tiene cobertura ese mes; si no, `k · V(m)` | `modis` / `viirs_scaled` |
| `viirs_primary` (simula el fin de MODIS) | `k · V(m)` para `m ≥ 2012-02`; `M(m)` antes | `viirs_scaled` / `modis` |

Redondear a 1 decimal. Si no hay ningún sensor con cobertura, `harmonized = null` y `status = "no_data"`.

## Banderas por mes (`flags`)

| Código | Cuándo |
|---|---|
| `terra_only` | antes de 2002-07 (solo un satélite MODIS) |
| `modis_outage` | el mes tiene ≥ 3 días de caída de Terra y Aqua a la vez, o está en la lista del Readme de FIRMS: 2001-06, 2001-07, 2007-08, 2009-04 |
| `viirs_outage` | el VIIRS de referencia y su respaldo faltan ≥ 3 días del mes |
| `nrt` | el mes incluye datos `source = nrt` (provisionales) |
| `partial_month` | el mes no está completo (mes en curso o cobertura cortada) |
| `no_coverage` | no hay archivos para ese país y mes (hoy: noviembre–diciembre 2026) |

## Línea base y anomalía

Para el mes `m` del año `y`:

- **Línea base** = valores `harmonized` del mismo mes calendario en todos los demás años del rango consultado, excluyendo los que tengan `modis_outage`, `viirs_outage`, `partial_month` o `no_coverage`.
- Se necesitan al menos 10 años; con menos, `status = "insufficient_baseline"`.
- Se reportan `median`, `p25`, `p75`, `p90`, `n_years`.
- `anomaly_ratio = harmonized / median` (`null` si la mediana es 0 o el mes tiene `partial_month`).
- **Mes parcial** (decisión del 14-nov): un mes con `partial_month` conserva su `harmonized` (lo observado hasta ahora) y su `baseline`, pero `status = "no_data"` y `anomaly_ratio = null`. Comparar unos días contra meses completos lo haría parecer siempre `below` o `normal`. Hoy afecta a noviembre de 2026 (México solo tiene datos del día 1).

| `status` | Condición |
|---|---|
| `no_data` | `harmonized` es `null`, **o el mes tiene `partial_month`** |
| `insufficient_baseline` | menos de 10 años de base |
| `below` | `harmonized < p25` |
| `normal` | `p25 ≤ harmonized ≤ p75` |
| `above` | `p75 < harmonized ≤ p90` |
| `critical` | `harmonized > p90` |

## Detección de caídas (ETL)

Para cada satélite y país: días consecutivos con **cero** detecciones en todo el país dentro de su periodo operativo → fila en `sensor_outage` con `origin = 'detected'`. Periodos operativos: Terra desde 2000-11-01, Aqua desde 2002-07-04, SNPP 2012-01-20 a 2026-11-02, N20 desde 2018-04-01, N21 desde 2024-01-17.

## Límites conocidos (decirlos en el pitch)

- Error de la conversión medido con la API (14-nov): anual (mediana dejando un año fuera) 6 % en Querétaro completo, 10 % en Bajío y 17 % en Sierra Gorda; mensual 33–37 %. Por eso el estado se da por percentiles y no se promete precisión mensual.
- La máscara de fuentes fijas solo usa `type = 2`. Plataformas marinas (`type = 3`) y volcanes (`type = 1`) no se filtran en los datos NRT: en las celdas costeras había más detecciones de fuego real (2,938) que de plataformas (2,180) desde 2024.
- La máscara, validada en 2024–2026 con `type` conocido, atrapa 94 % (MODIS) y 99.9 % (VIIRS) de las fuentes fijas y quita por error ~2 % del fuego real. En Querétaro enmascara de más en temporada de lluvias.
- Algunos días tranquilos se registran como "caída" de Terra o Aqua. En México solo marcan 2001-06/07 y 2002-03, que coinciden con fallas reales de Terra y además ya llevan `terra_only`.
- Con `basis = viirs_primary` (sin MODIS), la serie **anual** cambia poco (mediana 6–16 % según el preset), pero el **estado mensual** coincide solo en ~55 % de los meses 2012–2025; en ~90 % queda a un nivel o menos de distancia. Medido el 14-nov en los 3 presets.
- `k` depende de la región y del tipo de fuego; no hay un valor global.
- Antes de julio de 2002 solo observaba Terra: esos meses subestiman.
- La malla de 0.01° no es de área constante: una celda es ~13 % más chica en el norte de México que en el sur.
- Terra pasa a media mañana y VIIRS no: al apagarse MODIS se pierde esa ventana y `k` absorbe solo el promedio.
