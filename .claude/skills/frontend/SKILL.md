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
| `src/components/ModisSwitch.tsx` | Botón "Apagar MODIS": cambia `basis` a `viirs_primary`. `YearBars` dibuja entonces la serie con MODIS como línea punteada |
| `src/lib/color.ts` | Rampas Inferno / Cividis, escala raíz, marcas de nivel |
| `src/components/` | Calendario, tarjeta del mes, leyenda, mapa, línea de tiempo, barras anuales, inspector de k, serie mensual, descargas |
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

La barra superior es igual en todas: nombre, 4 pestañas, región, **Armonizado / Crudo**, ES/EN, **Inferno / Cividis**.

| Vista | Contenido |
|---|---|
| General | Tarjeta del mes (`latest` o el que elijas) + leyenda · mapa con presets y dibujo + barras anuales · calendario 2000–2026 × 12 · línea de tiempo con reproducción |
| Aprendizaje | Cuaderno de Don Modesto en 4 pasos (crudo → fuentes fijas → celdas-día → factor k) con barras mensuales de `raw_points`, `viirs_cell_days`/`modis_cell_days` y `harmonized`; 3 preguntas |
| Educacional | Dos regiones lado a lado (Sierra Gorda y Bajío queretano) con `k` y `seasonality` en la misma escala; MODIS vs VIIRS; qué es la mediana |
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

Pasar la sección Frontend de `docs/contracts/acceptance.md`: primero con mocks, después con la API real por túnel. `pnpm typecheck` y `pnpm build` sin errores.
