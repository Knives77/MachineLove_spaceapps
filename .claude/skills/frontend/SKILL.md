---
name: frontend
description: Guía para el frontend (carpeta web/) en React + Vite + Tailwind - 4 vistas (General, Aprendizaje, Educacional, Experto), mapa, calendario año x mes, interruptor crudo/armonizado, bilingüe, tema oscuro del diseño de Figma. Úsala antes de tocar web/ o de redactar un prompt para Figma Make.
---

# Frontend

El frontend **solo pinta** lo que devuelve la API. No calcula medianas, estados ni factores. La forma de los datos está en `docs/contracts/api.md` y los ejemplos en `docs/contracts/examples/`. La referencia visual está en `docs/design/` (capturas de Figma y tabla de qué se tomó del diseño).

## Correr

```bash
cd web
pnpm install --frozen-lockfile   # solo pnpm 12.18.0 + Node 24; nunca npm/yarn
pnpm run dev                     # http://localhost:5173 (si está ocupado, Vite usa el siguiente)
pnpm run build                   # tsc + build; obligatorio antes de cada commit
```

Dependencias nuevas solo si hacen falta: `pnpm add -E <paquete>`, aviso al equipo, y `package.json` + `pnpm-lock.yaml` en el mismo commit. No quitar `minimumReleaseAge` de `web/pnpm-workspace.yaml`.

`web/.env` (copiar de `.env.example`): `VITE_API_URL` vacío → mocks; `VITE_API_URL=http://localhost:8000/api/v1` → API por túnel.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/api.ts` | **Única puerta a la API.** `getPresets()`, `getCalendar(req)`, `downloadCalendarCsv(req)`, `downloadHotspotsCsv(req)`, `downloadAoiGeoJson(geom, name)` |
| `src/types.ts` | Tipos del contrato. Si el contrato cambia, se cambia aquí primero |
| `src/i18n.ts` | Diccionario ES/EN de todos los textos, incluidos `status.*`, `flag.*`, `source.*`, `error.*` |
| `src/state.tsx` | Estado global: idioma, pestaña, modo, paleta, área (`aoi`), calendario cargado, mes elegido |
| `src/theme/tokens.ts` | **Única fuente de colores** en TS: superficies, acentos de UI, niveles por paleta, rampas, mapa. `@theme` de `src/index.css` es su espejo para Tailwind |
| `src/lib/color.ts` | Rampas, color por nivel (`statusColor`), contraste de símbolos (`inkOn`, `readableOn`), escala raíz |
| `src/components/` | Calendario (vista por año `YearView` + matriz `Calendar`), tarjeta del mes, leyenda, mapa (`MapPanel`, cargado con `LazyMapPanel`), línea de tiempo, barras anuales, inspector de k, serie mensual, descargas |
| `src/components/icons/` | Iconos animados de lucide-animated (MIT) + `useIconAnim` (el botón completo dispara la animación) |
| `src/views/` | `General`, `Learn` (Aprendizaje), `Edu` (Educacional), `Expert` |
| `src/mocks/` | Ejemplos del contrato + mocks DEMO completos |
| `scripts/make-demo-mocks.mjs` | Genera `calendar.demo.<preset>.json` (324 meses, valores inventados) |

Ningún componente hace `fetch` directo. **CSV del calendario:** el endpoint es `POST`, así que no existe una URL directa; `downloadCalendarCsv` hace el `POST` y guarda el archivo.

## Mocks

- `presets.response.json` y `calendar.response.json`: copias de `docs/contracts/examples/`.
- `calendar.demo.*.json`: un calendario completo por preset, con la forma del contrato y las reglas de `harmonization.md`, para que las vistas se vean llenas. Los valores son inventados; la interfaz muestra "DEMO" mientras se usen mocks.
- Con mocks, un área dibujada recibe un calendario DEMO determinista generado por `src/mocks/demoCalendar.ts` (mismos errores del contrato: fuera de cobertura, área > 200,000 km²). El CSV de hotspots trae solo la cabecera.

## Vistas

La barra superior es igual en todas: nombre a la izquierda; a la derecha 3 botones de 44 px: idioma (🌐), accesibilidad (paletas Estándar / Daltónicos / Alto contraste + sonificación) y **Vista: <modo>** (menú de las 4 vistas). La app arranca siempre en General.

| Vista | Contenido |
|---|---|
| General | Tarjeta del mes con flechas ‹ › · mapa a todo el centro con regiones, área personalizada y botón **Calendario** · el calendario es un panel flotante sobre el mapa (cerrado al inicio): 12 meses del año con selector ‹ año › y "Hoy", comparativa histórica 2000–2026 bajo demanda · barras anuales · una sola barra de tiempo 2000–2026. **Sin** interruptor crudo, puntos crudos, pistas de sensores ni descargas |
| Aprendizaje | Cuaderno de Don Modesto en 4 pasos (crudo → fuentes fijas → celdas-día → factor k) con barras mensuales de `raw_points`, `viirs_cell_days`/`modis_cell_days` y `harmonized`; 3 preguntas |
| Educacional | Dos regiones lado a lado (Sierra Gorda y Bajío queretano) con `k` y `seasonality` en la misma escala; MODIS vs VIIRS; qué es la mediana |
| Experto | Capas del calendario, inspector de k (`calibration`), mapa, calendario, serie del mes con banda p25–p75, descargas |

## Reglas de visualización

- Tema oscuro con los tokens de `src/theme/tokens.ts` (espejo en `src/index.css`). **Nada de colores escritos a mano en componentes.**
- Superficies `#090D14` (lienzo) y `#111827` (paneles y tarjetas) con borde `#1E293B`. El blanco `#F8FAFC` con resplandor cian `#38BDF8` es **solo** para interacción (mes elegido, región activa, botón activo), nunca para datos.
- Niveles (Estándar): Sin incendios `#64748B`, Bajo `#A855F7`, Normal `#E06D53`, Alto `#F97316`, Extremo `#FDE047`. Daltónicos: `#2B5C8F`, `#5698A3`, `#D4AF37`, `#FDE725`. La misma escala en tarjeta del mes, vista por año, comparativa histórica y leyenda.
- Un mes con `harmonized = 0` se muestra "Sin incendios (0)" en gris neutro, aunque la API diga `normal` (mediana 0).
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

**Solo `maplibre-gl`** (WebGL). Mapa base vectorial "dark" de OpenFreeMap (sin API key). Regiones como capas GeoJSON nativas (`fill` / `line`), debajo de las etiquetas.

- Cámara: `fitBounds` nativo con `padding` dinámico `{ top: 80, bottom: 50, left: 40, right: 410 | 40 }` según el panel del calendario esté abierto o cerrado. **Nunca** animar la cámara con bucles manuales (`requestAnimationFrame` + `setView`/`jumpTo`).
- El mapa ocupa siempre toda su caja; los paneles flotan encima (el canvas no se redimensiona al abrir/cerrar).
- Dibujo nativo de rectángulo y polígono (sin `mapbox-gl-draw`), con validación de autointersección y máximo de 200,000 km². El polígono se envía como GeoJSON `[lon, lat]`, cerrado (primer punto = último).
- El worker se carga con `?url` + `setWorkerUrl`. Si cambias dependencias del mapa y el servidor de desarrollo da `504 Outdated Optimize Dep`, reinícialo con `vite --force`.

## Bilingüe

`src/i18n.ts` con claves para todos los textos. Idioma guardado en `localStorage`; por defecto, español. Los nombres de preset vienen en `name_es` / `name_en`. Texto nuevo → clave nueva en **los dos** diccionarios.

## Prompt base para Figma Make (solo para rediseños grandes)

El código ya existe; Figma Make solo para rediseñar un componente y re-exportarlo. Si se usa, pedir: React + Vite + Tailwind, tema oscuro con los tokens de `src/index.css`, datos solo desde `src/api.ts`, todos los textos por `t(key)`, sin calcular estadísticas en la interfaz, nivel con texto e icono, "sin dato" con trama distinta del cero.

## Antes de decir que está listo

Pasar la sección Frontend de `docs/contracts/acceptance.md`: primero con mocks, después con la API real por túnel.

Antes de **cada commit**:
1. `pnpm run build` sin errores.
2. Verificación visual en un navegador real sobre el servidor de desarrollo (Playwright o Chrome por CDP): abrir y cerrar el calendario, cambiar de región, dibujar un área, y revisar que el mapa encuadre la región sin quedar tapada. Una captura sin animación no basta para decir que "se siente fluido": dilo como no verificado.
