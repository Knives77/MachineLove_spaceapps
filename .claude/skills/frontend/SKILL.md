---
name: frontend
description: Guía para el frontend (carpeta web/) en React + Vite + Tailwind - 4 vistas (General, Aprendizaje, Educacional, Experto), mapa, calendario año x mes, interruptor crudo/armonizado, bilingüe, tema oscuro del diseño de Figma. Úsala antes de tocar web/ o de redactar un prompt para Figma Make.
---

# Frontend

El frontend **solo pinta** lo que devuelve la API. No calcula medianas, estados ni factores. La forma de los datos está en `docs/contracts/api.md` y los ejemplos en `docs/contracts/examples/`. La referencia visual está en `docs/design/` (capturas de Figma y tabla de qué se tomó del diseño).

## Correr

```bash
pnpm install --frozen-lockfile   # desde la RAÍZ del repo: es un workspace de pnpm que incluye web/
pnpm dev                         # http://localhost:5173 (desde la raíz o desde web/)
pnpm typecheck                   # revisar tipos antes de subir
pnpm build                       # debe pasar antes de abrir PR
```

### Versiones (pnpm)

- Solo **pnpm 12.18.0** y **Node 24**. Están fijados en el `package.json` de la raíz (`packageManager`, `engines`); pnpm cambia solo a la versión fijada.
- Nunca `npm install` ni `yarn`. Si aparece `package-lock.json` o `yarn.lock`, se borra.
- Hay **un solo lockfile**: `pnpm-lock.yaml` en la raíz. Instalar siempre con `--frozen-lockfile`. Si falla, avisar; no borrarlo.
- Dependencia nueva solo si hace falta y con versión exacta: `pnpm --filter machinelove-web add -E <paquete>` (o `pnpm add -E` dentro de `web/`). `web/package.json` y el `pnpm-lock.yaml` de la raíz van en el mismo commit.
- El `pnpm-workspace.yaml` de la raíz no se toca sin avisar: `minimumReleaseAge: 1440` rechaza paquetes de menos de 1 día (regla de la máquina anfitriona), el `override` de `postcss` existe por eso, y `allowBuilds` deja correr el instalador de `esbuild`.

`web/.env` (copiar de `.env.example`): `VITE_API_URL` vacío → mocks; `VITE_API_URL=http://localhost:8000/api/v1` → API por túnel.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/api.ts` | **Única puerta a la API.** `getPresets()`, `getCalendar(req)`, `downloadCalendarCsv(req)`, `downloadHotspotsCsv(req)`, `downloadAoiGeoJson(geom, name)` |
| `src/types.ts` | Tipos del contrato. Si el contrato cambia, se cambia aquí primero |
| `src/i18n.ts` | Diccionario ES/EN de todos los textos, incluidos `status.*`, `flag.*`, `source.*`, `error.*` |
| `src/state.tsx` | Estado global: idioma, pestaña, modo, `basis` ("Simular fin de MODIS"), paleta, área (`aoi`), calendario cargado, mes elegido. La caché de calendarios va por área **y** `basis`; cambiar solo `basis` conserva el mes elegido |
| `src/components/ModisSwitch.tsx` | Botón "Apagar MODIS": cambia `basis` a `viirs_primary`. Las barras anuales (`YearBars` en Experto, histograma de la línea de tiempo en General) dibujan entonces la serie con MODIS como línea punteada |
| `src/theme/tokens.ts` | **Única fuente de colores** en TS: superficies, acentos de UI, niveles por paleta, rampas, mapa. `@theme` de `src/index.css` es su espejo para Tailwind |
| `src/lib/color.ts` | Rampas, color por nivel (`statusColor`), contraste de símbolos (`inkOn`, `readableOn`), escala raíz |
| `src/components/` | Calendario (vista por año `YearView` + matriz `Calendar`), tarjeta del mes, leyenda, mapa (`MapPanel`, cargado con `LazyMapPanel`), línea de tiempo, barras anuales, inspector de k, serie mensual, descargas |
| `src/components/CalendarTiles.tsx` | Calendario en mosaicos de Experto (años en columnas). Reusa `cellValue`, `useScaleMax` y `Tooltip` de `Calendar.tsx` |
| `src/components/HudBar.tsx`, `src/lib/hud.ts` | Barra de telemetría y su almacén fuera de React (cursor, latencia) |
| `src/components/AnimatedNumber.tsx` | Cifra que rueda al valor nuevo en 600 ms (solo presentación) |
| `src/components/icons/` | Iconos animados de lucide-animated (MIT) + `useIconAnim` (el botón completo dispara la animación) |
| `src/views/` | `General`, `Learn` (Aprendizaje), `Edu` (Educacional), `Expert` |
| `src/mocks/` | Copias de la API real por preset + generador DEMO para polígonos dibujados (`demoCalendar.ts`) |

Ningún componente hace `fetch` directo. **CSV del calendario:** el endpoint es `POST`, así que no existe una URL directa; `downloadCalendarCsv` hace el `POST` y guarda el archivo.

## Mocks

- `presets.response.json` y `calendar.response.json`: copias de `docs/contracts/examples/`.
- `calendar.demo.*.json` (`modis_primary`), `calendar.viirs.*.json` (`viirs_primary`) y `presets.response.json`: **copias de la API real** (base `firms`). Sin túnel, los presets se ven igual que con la API. Se actualizan con `python3 scripts/snapshot_mocks.py` (con la API en 8000).
- Con mocks, un polígono dibujado devuelve un calendario **inventado** (`demoCalendar.ts`) y el CSV de hotspots trae solo la cabecera. La interfaz muestra "DEMO" mientras se usen mocks.
- Los valores reales son 4–7 veces más bajos que los del DEMO viejo y hay muchos meses en 0 (58 en Sierra Gorda): el diseño tiene que verse bien con eso.

## Datos reales (lo que cambia frente al DEMO viejo)

Medido el 14-nov comparando los mocks DEMO contra la API real. La **forma** es idéntica (mismas claves, mismos códigos); los **valores** no.

| | DEMO viejo | Real |
|---|---|---|
| Máximo mensual armonizado | 234 (Sierra Gorda) a 1,155 | **64** (Sierra Gorda), 150 (Bajío), 166 (Querétaro) |
| Mediana mensual | 12–37 | **3** (Sierra Gorda), 11, 17 |
| Meses en 0 | 12 | **58** en Sierra Gorda |
| Meses `no_data` | 1 | **12**: ene–oct de 2000 (sin MODIS todavía), nov-2026 (parcial) y dic-2026 |
| `source = viirs_scaled` | nunca | nunca en `modis_primary`; solo aparece con `basis = viirs_primary` |
| Bandera `viirs_outage` | 1 | ninguna en los presets |
| Temporada | pico en abril en todos | Bajío **ene–mar** (+ dic), Sierra Gorda **abr–jun**, Querétaro marzo |
| Tarjeta al abrir (`latest`) | — | oct-2026: Sierra Gorda **0.0**, Bajío 7.0 |
| Peor año en validación | 19–43 % | 15–55 % |

Qué implica:
- La escala y las barras tienen que leerse bien con números chicos y muchos ceros.
- La fila 2000 sale casi toda en gris: es correcto ("sin dato" no es cero).
- `k` solo cambia lo que se ve con el botón "Simular fin de MODIS" (`basis = viirs_primary`). Sin él, el modo armonizado es MODIS en celdas-día.
- Los textos y capturas de `docs/design/` (abril de 2026 alto, abril de 2012 extremo, marzo de 2007 sin dato) eran del DEMO y **no se cumplen** con datos reales.

## Vistas

La barra superior es igual en todas: nombre a la izquierda; a la derecha 3 botones de 44 px: idioma (🌐), accesibilidad (paletas Estándar / Daltónicos / Alto contraste + sonificación) y **Vista: <modo>** (menú de las 4 vistas). La app arranca siempre en **Experto** (la consola de la demo). Abajo, una barra de telemetría de 28 px (`HudBar`): fuente, coordenadas del cursor, área, estado de sensores y latencia de la API.

| Vista | Contenido |
|---|---|
| General | Tarjeta del mes con flechas ‹ › · mapa a todo el centro con regiones, área personalizada y botón **Calendario** · el calendario es un panel flotante sobre el mapa (cerrado al inicio): 12 meses del año con selector ‹ año › y "Hoy", comparativa histórica 2000–2026 bajo demanda · botón **"Simular fin de MODIS"** al pie de la tarjeta · una sola barra de tiempo 2000–2026 con los totales anuales como mini histograma. **Nada se desplaza**: la vista cabe completa en la ventana (probado a 1366×657). **Sin** interruptor crudo, puntos crudos, pistas de sensores ni descargas |
| Aprendizaje | Cuaderno de Don Modesto en 4 pasos (crudo → fuentes fijas → celdas-día → factor k) con barras mensuales de `raw_points`, `viirs_cell_days`/`modis_cell_days` y `harmonized`; 3 preguntas |
| Educacional | Dos regiones lado a lado (Sierra Gorda y Bajío queretano) con `k` y `seasonality` en la misma escala; MODIS vs VIIRS; qué es la mediana |
| Experto | **Consola a pantalla completa, sin scroll global.** 60 % mapa 3D (`MapPanel tools`) con regiones `[1] [2] [3]` (atajos de teclado) y barra flotante de herramientas (rectángulo, polígono, coordenadas, vista 3D, norte, encuadrar, zoom). 40 % panel analítico: (A) interruptor maestro Armonizado/Crudo con aviso ámbar en crudo, (B) 3 indicadores: estado del mes, `calibration.k`, error `loyo_annual_mape` / `monthly_mape`, (C) barras anuales alineadas con el calendario en mosaicos (`CalendarTiles`: columnas = años, filas = meses; color por valor o por nivel). Pie fijo: "Simular fin de MODIS" y descargas. Plegado: inspector de k y serie del mes. Probado a 1366×657 y 1920×1080 |

## Reglas de visualización

- Tema oscuro con los tokens de `src/theme/tokens.ts` (espejo en `src/index.css`). **Nada de colores escritos a mano en componentes.**
- Superficies `#090D14` (lienzo) y `#111827` (paneles y tarjetas) con borde `#1E293B`. El blanco `#F8FAFC` con resplandor cian `#38BDF8` es **solo** para interacción (mes elegido, región activa, botón activo), nunca para datos.
- Niveles (Estándar): Sin incendios `#64748B`, Bajo `#A855F7`, Normal `#E06D53`, Alto `#F97316`, Extremo `#FDE047`. Daltónicos: `#2B5C8F`, `#5698A3`, `#D4AF37`, `#FDE725`. La misma escala en tarjeta del mes, vista por año, comparativa histórica y leyenda.
- Un mes con `harmonized = 0` se muestra "Sin incendios (0)" en gris neutro, aunque la API diga `normal` (mediana 0).
- Clases de la consola en `src/index.css`: `.bracket` (tarjeta con acentos en las esquinas), `.hud` y `.tool` (controles flotantes), `.tile` (mosaico). Esquinas de 2–4 px como máximo; todas las cifras en monoespaciada con `tabular-nums`.
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
- **Vista 3D (solo Experto, prop `tools`):** inclinación y giro nativos (`pitch` 55°, `bearing` −18° dentro del mismo `fitBounds`) y relieve real con `setTerrain` + capa `hillshade` sobre las teselas abiertas de elevación de Mapzen/AWS (sin API key). Se apaga con el botón "Vista 3D". Si las teselas no cargan, el mapa queda plano y sigue funcionando. General conserva el mapa plano.
- **No hay hexágonos H3, Deck.gl, capa de fuentes industriales ni puntos sobre el mapa:** la malla del contrato es 0.01° y la API no devuelve celdas. Para agregarlos, primero se cambia el contrato.
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
1. `pnpm typecheck` y `pnpm build` sin errores.
2. Verificación visual en un navegador real sobre el servidor de desarrollo (Playwright o Chrome por CDP): abrir y cerrar el calendario, cambiar de región, dibujar un área, y revisar que el mapa encuadre la región sin quedar tapada. Una captura sin animación no basta para decir que "se siente fluido": dilo como no verificado.
