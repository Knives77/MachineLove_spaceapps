# Diseño · MachineLove

Maqueta de la interfaz del **Calendario de actividad de quema** (Figma). Es la referencia visual para `web/`; las reglas de datos y de visualización siguen en `.claude/skills/frontend/SKILL.md` y `docs/contracts/api.md`.

**Figma:** _(pegar aquí el enlace al archivo)_

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

## Diferencias con el skill de frontend

El diseño cambia algunas cosas que el skill (`.claude/skills/frontend/SKILL.md`) describe de otra forma. Hay que decidir cuál manda antes de pasarlo a código:

- **Tema:** el diseño es oscuro; el prompt base pide tema claro.
- **Paletas:** el diseño usa Inferno o Cividis; el skill pide viridis o cividis.
- **Niveles:** el diseño usa Cero / Normal / Alto / Extremo / Sin dato; la API devuelve `no_data / insufficient_baseline / below / normal / above / critical` (`docs/contracts/api.md`). Hace falta mapearlos en `i18n.ts`, sin recalcular nada en el front.
- **Pantallas:** el diseño tiene 4 pestañas; el skill describe una sola pantalla con mapa dibujable, barras anuales y panel de validación.
