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
  sidebar: '#0b101b', // barra lateral izquierda de General
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

export interface FireTheme {
  ramp: readonly [string, string, string, string, string, string];
  dotLow: string;
  dotMid: string;
  dotHigh: string;
  dotPeak: string;
  dotStroke: string;
}

/** Fuego sobre el mapa por paleta: térmica estándar, daltónicos (Cividis azul–amarillo) y alto contraste. */
export const FIRE_PALETTES = {
  inferno: {
    /** Rampa de la mancha térmica, de brasa rojiza a rojo escarlata y ámbar (sin lavar a blanco). */
    ramp: ['#3b0704', '#7f1d1d', '#b91c1c', '#dc2626', '#ea580c', '#f59e0b'],
    /** Puntos de focos de calor (estilo CONAE: rojo/naranja a amarillo intenso según FRP). */
    dotLow: '#ef4444',
    dotMid: '#f97316',
    dotHigh: '#facc15',
    dotPeak: '#fef08a',
    dotStroke: '#2a0604',
  },
  cividis: {
    /** Rampa segura para daltonismo (azul acero → turquesa → dorado → amarillo brillante). */
    ramp: ['#0c223f', '#1d4b7a', '#357494', '#7e9987', '#d4af37', '#fde725'],
    dotLow: '#5698a3',
    dotMid: '#b8b04b',
    dotHigh: '#fde725',
    dotPeak: '#fef9c3',
    dotStroke: '#061325',
  },
  contrast: {
    /** Rampa de alto contraste extremo (violeta → magenta → naranja → amarillo → blanco). */
    ramp: ['#2d084d', '#5a189a', '#c2185b', '#ff6d00', '#ffab00', '#ffff00'],
    dotLow: '#e040fb',
    dotMid: '#ff9100',
    dotHigh: '#ffff00',
    dotPeak: '#ffffff',
    dotStroke: '#140424',
  },
} as const satisfies Record<'inferno' | 'cividis' | 'contrast', FireTheme>;

export const FIRE = FIRE_PALETTES.inferno;

/** Mapa (MapLibre). */
export const MAP = {
  // Mapa base (sobre el estilo "dark" de OpenFreeMap): tierra un poco más clara que la interfaz para que
  // el territorio se distinga; el agua queda más oscura y azul.
  background: '#1a2433', // tierra
  landcover: '#1f2a3a', // bosque y parques
  residential: '#222d3e', // zonas urbanas
  water: '#0e1a2b',
  boundaryState: '#536379', // límites estatales
  boundaryCountry: '#6b7d95', // límites de país
  // Nombres: claros con halo oscuro firme (contraste ≥ 7:1 sobre la tierra).
  labelMajor: '#d5dee9', // estados y países
  labelCity: '#b4c0cf', // ciudades y pueblos
  labelMinor: '#97a6b8', // colonias y otros
  labelWater: '#8fb3d6',
  labelHalo: '#0b111b',
  regionActive: UI.accent,
  regionGlow: UI.accent,
  regionIdle: NEUTRAL.zero,
  draw: UI.select,
  staticSource: NEUTRAL.zero, // detección que no es fuego de vegetación (fuente fija)
  hillShadow: '#02050a', // sombra del relieve
  hillLight: '#3b4a60', // ladera iluminada
} as const;
