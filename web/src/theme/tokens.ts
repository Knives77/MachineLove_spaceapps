// Fuente ÚNICA de colores para el código TS/TSX (componentes, SVG, capas del mapa).
// Las clases de Tailwind usan los mismos valores declarados en `@theme` de src/index.css:
// si cambias un color aquí, cámbialo también allá (y al revés).

/** Superficies (modo oscuro). */
export const SURFACE = {
  bg: '#090d14', // lienzo general
  panel: '#111827', // paneles y tarjetas de mes
  panel2: '#172033', // controles sobre paneles
  panelHover: '#151e2e',
  panelSelected: '#1a2436',
  drawer: '#0f172a', // panel flotante del calendario (al 90 % + blur)
  line: '#1e293b', // bordes
  line2: '#334155',
} as const;

/** Texto. */
export const TEXT = {
  ink: '#e8edf2',
  mute: '#93a0ad',
  dim: '#66727f',
  warn: '#f5b84a',
} as const;

/** Interacción (nunca datos): resplandor cian y blanco de selección. */
export const UI = {
  accent: '#38bdf8',
  accentDeep: '#0c2a3d',
  select: '#f8fafc',
} as const;

/** Símbolos sobre celdas de color: el que más contraste dé. */
export const INK = { light: '#ffffff', dark: '#0b0f17' } as const;

/** Mes medido con 0 celdas-día ("Sin incendios") y estados sin nivel. */
export const NEUTRAL = {
  zero: '#64748b',
  noLevel: '#5b6573', // historia insuficiente / sin dato
  zeroText: '#8792a0',
  zeroCell: '#161c25', // celda en 0 de la matriz por valores (--color-zero)
} as const;

/** Niveles de actividad por paleta. Estándar = colores calibrados para fondo oscuro. */
export const LEVELS = {
  inferno: { below: '#a855f7', normal: '#e06d53', above: '#f97316', critical: '#fde047' },
  // Daltónicos (azul–amarillo, base Cividis): una parada por nivel.
  cividis: { below: '#2b5c8f', normal: '#5698a3', above: '#d4af37', critical: '#fde725' },
} as const;

/** Rampas continuas por valor (matriz de Experto, leyenda de valores). Luminancia monótona. */
export const RAMPS = {
  // Estándar (térmica): inferno 0.30 → 1.00
  inferno: ['#6a176e', '#932667', '#bc3754', '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4'],
  // Daltónicos: las 4 paradas de nivel
  cividis: [LEVELS.cividis.below, LEVELS.cividis.normal, LEVELS.cividis.above, LEVELS.cividis.critical],
  // Alto contraste extremo: del violeta oscuro al blanco
  contrast: ['#5a189a', '#c2185b', '#ff9800', '#ffff00', '#ffffff'],
} as const;

/** Mapa (MapLibre). */
export const MAP = {
  background: SURFACE.bg,
  water: '#0b1626',
  regionActive: UI.accent,
  regionIdle: NEUTRAL.zero,
  draw: UI.select,
} as const;
