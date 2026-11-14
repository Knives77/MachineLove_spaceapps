---
name: frontend
description: Guía para el frontend (carpeta web/) en React + Vite + Tailwind - 4 vistas (General, Aprendizaje, Educacional, Experto), mapa, calendario año x mes, interruptor crudo/armonizado, bilingüe, tema oscuro del diseño de Figma. Úsala antes de tocar web/ o de redactar un prompt para Figma Make.
---

# Frontend

El frontend **solo pinta** lo que devuelve la API. No calcula medianas, estados ni factores. La forma de los datos está en `docs/contracts/api.md` y los ejemplos en `docs/contracts/examples/`. La referencia visual está en `docs/design/` (capturas de Figma y tabla de qué se tomó del diseño).

## Correr

```bash
cd web
npx pnpm@10 install --ignore-workspace   # web/ es independiente del workspace raíz
npx vite                                 # http://localhost:5173
npx tsc -p tsconfig.json                 # revisar tipos antes de subir
```

`web/.env` (copiar de `.env.example`): `VITE_API_URL` vacío → mocks; `VITE_API_URL=http://localhost:8000/api/v1` → API por túnel.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/api.ts` | **Única puerta a la API.** `getPresets()`, `getCalendar(req)`, `downloadCalendarCsv(req)`, `downloadHotspotsCsv(req)`, `downloadAoiGeoJson(geom, name)` |
| `src/types.ts` | Tipos del contrato. Si el contrato cambia, se cambia aquí primero |
| `src/i18n.ts` | Diccionario ES/EN de todos los textos, incluidos `status.*`, `flag.*`, `source.*`, `error.*` |
| `src/state.tsx` | Estado global: idioma, pestaña, modo, paleta, área (`aoi`), calendario cargado, mes elegido |
| `src/lib/color.ts` | Rampas Inferno / Cividis, escala raíz, marcas de nivel |
| `src/components/` | Calendario, tarjeta del mes, leyenda, mapa, línea de tiempo, barras anuales, inspector de k, serie mensual, descargas |
| `src/views/` | `General`, `Learn` (Aprendizaje), `Edu` (Educacional), `Expert` |
| `src/mocks/` | Ejemplos del contrato + mocks DEMO completos |
| `scripts/make-demo-mocks.mjs` | Genera `calendar.demo.<preset>.json` (324 meses, valores inventados) |

Ningún componente hace `fetch` directo. **CSV del calendario:** el endpoint es `POST`, así que no existe una URL directa; `downloadCalendarCsv` hace el `POST` y guarda el archivo.

## Mocks

- `presets.response.json` y `calendar.response.json`: copias de `docs/contracts/examples/`.
- `calendar.demo.*.json`: un calendario completo por preset, con la forma del contrato y las reglas de `harmonization.md`, para que las vistas se vean llenas. Los valores son inventados; la interfaz muestra "DEMO" mientras se usen mocks.
- Con mocks, un polígono dibujado devuelve el DEMO de Sierra Gorda y el CSV de hotspots trae solo la cabecera.

## Vistas

La barra superior es igual en todas: nombre, 4 pestañas, región, **Armonizado / Crudo**, ES/EN, **Inferno / Cividis**.

| Vista | Contenido |
|---|---|
| General | Tarjeta del mes (`latest` o el que elijas) + leyenda · mapa con presets y dibujo + barras anuales · calendario 2000–2026 × 12 · línea de tiempo con reproducción |
| Aprendizaje | Cuaderno de Don Modesto en 4 pasos (crudo → fuentes fijas → celdas-día → factor k) con barras mensuales de `raw_points`, `viirs_cell_days`/`modis_cell_days` y `harmonized`; 3 preguntas |
| Educacional | Dos regiones lado a lado (Sierra Gorda y Chilecito) con `k` y `seasonality` en la misma escala; MODIS vs VIIRS; qué es la mediana |
| Experto | Capas del calendario, inspector de k (`calibration`), mapa, calendario, serie del mes con banda p25–p75, descargas |

## Reglas de visualización

- Tema oscuro (tokens en `src/index.css`, tomados de `docs/design/exports/`).
- **Armonizado:** color de celda por `harmonized`. **Crudo:** color por `raw_points`. Cada modo con su propia escala; la leyenda avisa que no son comparables.
- Rampas Inferno o Cividis, recortadas para que el valor más bajo se vea sobre fondo oscuro. Luminancia monótona: se leen en grises y con daltonismo. Escala de raíz cuadrada.
- Cero = celda oscura con "0". `harmonized = null` (`status = "no_data"`) → trama gris, nunca el color del cero. Mes que no viene en la respuesta → borde punteado.
- El nivel se comunica con texto y marca además del color: `below` ↓ Bajo, `normal` Normal, `above` • Alto (p75–p90), `critical` •• Extremo (> p90), `insufficient_baseline` ? Historia insuficiente.
- Banderas (`flags`) → triángulo cian en la esquina de la celda y explicación en el tooltip y en la tarjeta.
- Tooltip de celda: mes, valor, puntos crudos, mediana (n), rango p25–p75, razón, fuente, banderas.
- Panel de validación: `k`, `scope`, meses de traslape, sumas, errores LOYO y mensual en porcentaje. Si `scope = "country"`, aviso de poco traslape.
- El margen que se muestra es `calibration.monthly_mape`, no un ±30 % fijo.
- Mientras carga, esqueleto; si la API responde error, mensaje según `error.code` con botón de reintentar.
- **No hay mapa de píxeles de 1 km ni puntos crudos en pantalla:** la API no los devuelve. Para agregarlos, primero se cambia el contrato.

## Mapa

`react-leaflet` + `leaflet-draw` con teselas de OpenStreetMap (oscurecidas con CSS). El polígono dibujado se envía como GeoJSON `[lon, lat]`, cerrado (primer punto = último). Al elegir un preset, el mapa encuadra su geometría.

## Bilingüe

`src/i18n.ts` con claves para todos los textos. Idioma guardado en `localStorage`; por defecto, el del navegador. Los nombres de preset vienen en `name_es` / `name_en`. Texto nuevo → clave nueva en **los dos** diccionarios.

## Prompt base para Figma Make (solo para rediseños grandes)

El código ya existe; Figma Make solo para rediseñar un componente y re-exportarlo. Si se usa, pedir: React + Vite + Tailwind, tema oscuro con los tokens de `src/index.css`, datos solo desde `src/api.ts`, todos los textos por `t(key)`, sin calcular estadísticas en la interfaz, nivel con texto e icono, "sin dato" con trama distinta del cero.

## Antes de decir que está listo

Pasar la sección Frontend de `docs/contracts/acceptance.md`: primero con mocks, después con la API real por túnel. `npx tsc -p tsconfig.json` sin errores.
