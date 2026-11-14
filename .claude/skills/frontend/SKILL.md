---
name: frontend
description: Guía para el frontend (carpeta web/) generado con Figma Make en React + Vite + Tailwind - mapa, calendario año x mes, interruptor crudo/armonizado, bilingüe. Úsala antes de tocar web/ o de redactar un prompt para Figma Make.
---

# Frontend

El frontend **solo pinta** lo que devuelve la API. No calcula medianas, estados ni factores. La forma de los datos está en `docs/contracts/api.md` y los ejemplos en `docs/contracts/examples/`.

## Flujo de trabajo con Figma Make

1. Generar la interfaz con el prompt de abajo, adjuntando `calendar.response.json` y `presets.response.json` como datos de ejemplo.
2. Exportar el código a `web/` en cuanto exista la primera pantalla usable (no esperar a que esté "terminado") y subirlo al repo.
3. Desde ahí, los ajustes de lógica se hacen en el código; Figma Make solo para rediseños grandes, re-exportando componente por componente.

## Capa de datos (única puerta a la API)

`web/src/api.ts` expone `getPresets()`, `getCalendar(req)`, `calendarCsvUrl(req)`, `downloadHotspotsCsv(req)`.

- `VITE_API_URL` definido → llama a la API (por túnel: `http://localhost:8000/api/v1`).
- `VITE_API_URL` vacío → devuelve los JSON de ejemplo copiados a `web/src/mocks/`.

Ningún componente hace `fetch` directo.

## Pantalla

| Zona | Contenido |
|---|---|
| Barra superior | Nombre, selector ES/EN, interruptor **Crudo / Armonizado** |
| Izquierda | Mapa: 3 botones de preset, dibujar rectángulo o polígono, borrar |
| Derecha arriba | Tarjeta del mes (`latest`): valor, mediana, razón, estado |
| Derecha centro | Calendario: filas = años (2000–2026), columnas = 12 meses |
| Derecha abajo | Barras anuales y panel de validación (`calibration`) |
| Pie | Descargar CSV de hotspots, descargar CSV del calendario, fuentes y aviso de FIRMS |

## Reglas de visualización

- **Armonizado:** color de celda por `harmonized`. **Crudo:** color por `raw_points`. Cada modo con su propia escala; avisar en la leyenda que no son comparables.
- Rampa secuencial apta para daltonismo (viridis o cividis), de claro a oscuro. Escala de raíz cuadrada o cuantiles, porque los valores son muy asimétricos.
- `harmonized = null` (`status = "no_data"`) → celda con trama gris, nunca el color del cero.
- Banderas `modis_outage`, `viirs_outage`, `nrt`, `partial_month`, `terra_only` → marca pequeña en la esquina de la celda y explicación al pasar el cursor.
- El estado se comunica con texto e icono además del color.
- Al pasar el cursor por una celda: mes, valor, mediana, razón, estado, fuente (`modis` / `viirs_scaled`), banderas.
- Panel de validación: `k`, `scope`, meses de traslape, error anual y mensual en porcentaje. Si `scope = "country"`, avisar que el área tiene poco traslape.
- Mientras carga, esqueleto; si la API responde error, mensaje según `error.code`.

## Mapa

`react-leaflet` + `leaflet-draw` con teselas de OpenStreetMap. El polígono dibujado se envía como GeoJSON `[lon, lat]`, cerrado (primer punto = último). Al elegir un preset, el mapa encuadra su geometría.

## Bilingüe

Un diccionario `web/src/i18n.ts` con claves para todos los textos, incluidos los códigos de la API: `status.critical`, `flag.modis_outage`, `error.aoi_too_large`, `source.viirs_scaled`. Idioma guardado en `localStorage`; por defecto, el del navegador. Los nombres de preset vienen en `name_es` / `name_en`.

## Prompt base para Figma Make

```
Build a single-page React + Vite + Tailwind dashboard called "Burn Activity Calendar"
for wildfire emergency managers. Use react-leaflet and leaflet-draw for the map.
All data comes from one module src/api.ts; for now it returns the attached JSON files.
Do not compute statistics in the UI; render the fields exactly as given.

Layout (desktop 1366x768 minimum, two columns):
- Top bar: title, ES/EN language switch, a prominent two-state toggle "Raw / Harmonized".
- Left column: map with three preset buttons (from presets JSON, use name_es/name_en),
  draw-rectangle and draw-polygon tools, clear button.
- Right column, top: summary card for the month in `latest`: value, historical median,
  anomaly ratio, status badge (below / normal / above / critical) with icon and text.
- Right column, middle: heatmap calendar, rows = years 2000-2026, columns = 12 months,
  one cell per element of `months`. Harmonized mode colors by `harmonized`, Raw mode by
  `raw_points`. Viridis sequential ramp with square-root scale and a legend.
  Cells with harmonized = null show a grey hatch pattern, not the zero color.
  Cells with non-empty `flags` show a small corner marker. Tooltip on hover with year,
  month, value, baseline median, anomaly ratio, status, source and flags.
- Right column, bottom: yearly bar chart from `years` (same toggle), and a "Validation"
  panel showing calibration.k, scope, overlap_months, loyo_annual_mape and monthly_mape
  as percentages.
- Footer: buttons "Download hotspots CSV" and "Download calendar CSV", data source note
  "NASA FIRMS (MODIS C6.1, VIIRS C2)".

All visible strings go through a t(key) function with Spanish and English dictionaries,
including API codes (status.*, flag.*, source.*, error.*). Keyboard accessible,
visible focus states, WCAG AA contrast, light theme.
```

## Antes de decir que está listo

Pasar la sección Frontend de `docs/contracts/acceptance.md`: primero con mocks, después con la API real por túnel.
