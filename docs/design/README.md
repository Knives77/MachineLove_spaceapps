# Diseño · MachineLove

Maqueta de la interfaz del **Calendario de actividad de quema** (Figma). Es la referencia visual para `web/`; las reglas de datos y de visualización siguen en `.claude/skills/frontend/SKILL.md` y `docs/contracts/api.md`.

**Figma:** _[(pegar aquí el enlace al archivo)](https://www.figma.com/design/8Lp4CU71vJpGeNd8aVEJti/MACHINELOVE-%E2%80%94-Earth-Fire-Observatory?node-id=80-2&p=f&t=bQQfRVpAb4WAy5dW-0)_

> Las cifras de las capturas son **DEMO**. No son datos reales de FIRMS.

## Contenido de la carpeta

| Archivo | Qué es |
|---|---|
| `README.md` | Este archivo: enlace de Figma y descripción de cada export |
| `exports/` | Capturas PNG de cada vista (2880×1800) |
| `machinelove.fig` | Copia del archivo de Figma (opcional; todavía no está subida) |

## Vistas

La barra superior es igual en todas: nombre, pestañas **General / Aprendizaje / Educacional / Experto**, selector de región, idioma (ES/EN) y paleta (**Inferno / Cividis**).

### General: ¿qué tan activo está este mes?

Mapa de celdas de 1 km a la izquierda, tarjeta del mes con nivel y razón contra la mediana de 26 años, calendario año × mes a la derecha y línea de tiempo abajo (MODIS desde 2000, VIIRS desde 2012) con botón de reproducir.

| Archivo | Estado que muestra |
|---|---|
| `exports/01-general-abril-2026-alto.png` | Abril 2026 · **Alto** (1.8× la mediana), aviso de borde ±30 % |
| `exports/02-general-abril-2012-extremo.png` | Abril 2012 · **Extremo** (2.2×) |
| `exports/03-general-abril-2025-normal.png` | Abril 2025 · **Normal** (1.2×) |
| `exports/04-general-marzo-2007-sin-dato.png` | Marzo 2007 · **Sin dato**: mapa vacío con borde punteado; no equivale a cero |
| `exports/05-general-paleta-cividis.png` | Abril 2026 con la paleta **Cividis** (alternativa para daltonismo) |

### Aprendizaje: Cuaderno de Don Modesto

Recorrido en 4 pasos de cómo se limpian los datos, con histograma mensual y una pregunta de repaso.

| Archivo | Paso |
|---|---|
| `exports/06-aprendizaje-paso1-crudo.png` | 1 · Crudo: 330 puntos VIIRS tal como los vio el satélite |
| `exports/07-aprendizaje-paso2-quitar-fabricas.png` | 2 · Quitar fuentes fijas (`type = 2`): quedan 316 puntos |
| `exports/08-aprendizaje-paso3-malla-1km.png` | 3 · Malla de 1 km: 146 celdas |
| `exports/09-aprendizaje-paso4-factor-k.png` | 4 · Factor k: VIIRS × 0.26 = equivalente MODIS |

### Educacional

| Archivo | Contenido |
|---|---|
| `exports/10-educacional-comparacion-regiones.png` | Sierra Gorda (k = 0.26) frente a Chilecito (k = 0.40): mini mapas MODIS/VIIRS, mediana por mes, explicación de MODIS vs VIIRS y de mediana/anomalía |

### Experto

Capas activables, inspector del factor k por región, calendario con leyenda NaN ≠ 0, serie del mes con banda ±30 % y exportación (CSV, PNG, GeoJSON).

| Archivo | Capas |
|---|---|
| `exports/11-experto-armonizado.png` | Armonizado + fuentes fijas + sin dato + margen ±30 % |
| `exports/12-experto-crudo.png` | Crudo (puntos VIIRS y MODIS) + fuentes fijas + sin dato |

## Cómo se llevó a código (`web/`)

Cuando el diseño y los contratos chocan, mandan los contratos (`CLAUDE.md`, regla 1). Lo que se tomó y lo que no:

| Del diseño | En `web/` |
|---|---|
| Tema oscuro, 4 pestañas, paletas Inferno / Cividis | Igual. El skill se actualizó para aceptarlo |
| Niveles Normal / Alto / Extremo | Se traducen desde `status`: `below` → Bajo, `normal` → Normal, `above` → Alto, `critical` → Extremo, `no_data` → Sin dato, `insufficient_baseline` → Historia insuficiente |
| "Extremo = el 5 % más alto" | Se escribe "> p90" (10 % más alto), que es la regla de `harmonization.md` |
| Celda coloreada por nivel | Celda coloreada por **valor** (escala raíz) y el nivel va como marca (`↓`, `•`, `••`) y texto, como pide el skill |
| Mapa de píxeles de 1 km y puntos crudos en Aprendizaje / Experto | **No hay endpoint** que los devuelva. El centro es el mapa Leaflet (presets + dibujar); Aprendizaje usa `raw_points` → `viirs_cell_days` → `harmonized` |
| Margen fijo ±30 % | Se muestra `calibration.monthly_mape` de la API; la banda de la serie es `baseline.p25`–`p75` |
| Mini mapas MODIS/VIIRS en Educacional | Se cambiaron por `seasonality` de cada región, con la misma escala |
| Exportar PNG | Fuera; quedan CSV del calendario, CSV de hotspots y GeoJSON del área |

Si el equipo quiere el mapa de píxeles, primero hay que agregar un endpoint al contrato (`docs/contracts/api.md`) y que lo apruebe el analista.
