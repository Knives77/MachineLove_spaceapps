# Contrato de API · v1

Base: `http://localhost:8000/api/v1`. JSON en UTF-8. CORS abierto a `http://localhost:*`.
Los ejemplos completos están en `docs/contracts/examples/`; el frontend los usa como mock.

## Convenciones

- La API devuelve **códigos**, nunca frases. El frontend traduce.
- Fechas `YYYY-MM-DD`. Meses 1–12.
- Geometría: GeoJSON `Polygon` en WGS84, orden `[lon, lat]`.
- Errores: `{"error": {"code": "...", "detail": "..."}}`.

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `invalid_geometry` | no es un polígono válido |
| 400 | `aoi_too_large` | más de 200,000 km² |
| 400 | `invalid_range` | `start_year > end_year` o fuera de 2000–2026 |
| 404 | `unknown_preset` | `preset_id` inexistente |
| 422 | `aoi_outside_coverage` | el área no toca México ni Argentina |

## El objeto `aoi`

Exactamente una de las dos formas:

```json
{"preset_id": "qro-sierra-gorda"}
{"geometry": {"type": "Polygon", "coordinates": [[[-100.6,20.9],[-99.0,20.9],[-99.0,21.7],[-100.6,21.7],[-100.6,20.9]]]}}
```

## GET `/health`

`{"status": "ok", "data_through": "2026-11-01"}`

## GET `/presets`

Devuelve un `FeatureCollection`. Cada `Feature` tiene `id` y `properties: {name_es, name_en, country}`. Ejemplo: `examples/presets.response.json`.

## POST `/calendar`

Petición:

```json
{
  "aoi": {"preset_id": "qro-sierra-gorda"},
  "start_year": 2000,
  "end_year": 2026,
  "basis": "modis_primary"
}
```

`start_year` y `end_year` son opcionales (2000 y 2026). `basis` es opcional: `modis_primary` | `viirs_primary`.

Respuesta: `examples/calendar.response.json`. Campos:

| Campo | Tipo | Significado |
|---|---|---|
| `aoi.area_km2` | número | área del polígono |
| `aoi.country` | `MX` \| `AR` | |
| `unit` | `"modis_equivalent_cell_days"` | unidad de `harmonized` |
| `calibration.k` | número | factor MODIS/VIIRS usado |
| `calibration.scope` | `aoi` \| `country` | de dónde salió `k` |
| `calibration.overlap_months` | entero | meses usados |
| `calibration.modis_cell_days`, `viirs_cell_days` | entero | sumas en el traslape |
| `calibration.loyo_annual_mape`, `loyo_annual_max`, `monthly_mape` | número 0–1 o `null` | errores de validación |
| `months[]` | lista | una entrada por cada mes del rango, **incluidos los vacíos** |
| `months[].year`, `.month` | entero | |
| `months[].harmonized` | número \| `null` | celdas-día equivalentes MODIS |
| `months[].source` | `modis` \| `viirs_scaled` \| `null` | |
| `months[].raw_points` | entero | todos los hotspots, sin filtrar ni armonizar |
| `months[].modis_cell_days`, `.viirs_cell_days` | entero \| `null` | `M(m)` y `V(m)` |
| `months[].baseline` | `{median, p25, p75, p90, n_years}` \| `null` | |
| `months[].anomaly_ratio` | número \| `null` | |
| `months[].status` | `no_data` \| `insufficient_baseline` \| `below` \| `normal` \| `above` \| `critical` | |
| `months[].flags` | lista de códigos | ver `harmonization.md` |
| `years[]` | `{year, harmonized, raw_points, complete}` | totales anuales; `complete = false` si falta algún mes |
| `seasonality[]` | 12 números que suman 1 | fracción histórica de `harmonized` por mes calendario |
| `latest` | `{year, month}` | último mes completo con dato; es el que muestra la tarjeta |

Tiempo objetivo: < 2 s en presets, < 8 s en polígono libre.

## POST `/calendar.csv`

Misma petición. `text/csv` con una fila por mes:

`year,month,harmonized,source,raw_points,modis_cell_days,viirs_cell_days,baseline_median,baseline_p25,baseline_p75,baseline_p90,anomaly_ratio,status,flags`

`flags` separadas por `|`. Cabecera `Content-Disposition: attachment; filename="burn_calendar_<aoi>_<start>_<end>.csv"`.

## POST `/hotspots.csv`

Petición:

```json
{"aoi": {"preset_id": "ar-chilecito"}, "start_date": "2026-07-01", "end_date": "2026-08-15"}
```

`text/csv` en streaming, una fila por detección dentro del área:

`latitude,longitude,acq_date,acq_time,satellite,family,confidence,frp,daynight,type,source,is_vegetation_fire,cell_id`

`cell_id` = `"<cy>_<cx>"`. Límite: 2,000,000 de filas; si se excede, 400 `aoi_too_large`.

## POST `/hotspots` (mejora, no MVP)

Misma petición con rango máximo de 62 días. Devuelve `FeatureCollection` de puntos (máx. 20,000) con `properties: {acq_date, satellite, family, frp, is_vegetation_fire}`.
