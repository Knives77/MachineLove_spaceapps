import type { Palette, Status } from '../types';

// Rampas secuenciales perceptualmente uniformes, recortadas para que el valor
// más bajo se distinga del fondo oscuro. La luminancia crece de forma monótona,
// así que se leen en escala de grises y con daltonismo.
const RAMPS: Record<Palette, string[]> = {
  // Estándar (térmica): inferno 0.30 → 1.00
  inferno: ['#6a176e', '#932667', '#bc3754', '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4'],
  // Daltónicos (azul–amarillo): 4 paradas = Bajo, Normal, Alto, Extremo, con saltos claros de brillo.
  cividis: ['#2b5c8f', '#5698a3', '#d4af37', '#fde725'],
  // Alto contraste extremo: del violeta oscuro al blanco, luminancia en saltos grandes.
  contrast: ['#5a189a', '#c2185b', '#ff9800', '#ffff00', '#ffffff'],
};

// Posición en la rampa del color de acento de cada nivel. En la paleta de daltonismo
// cada nivel cae exactamente en su parada.
const STATUS_T: Record<Palette, [number, number, number, number]> = {
  inferno: [0.08, 0.3, 0.68, 1],
  cividis: [0, 1 / 3, 2 / 3, 1],
  contrast: [0.08, 0.3, 0.68, 1],
};

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: number[]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** t en [0, 1] → color de la rampa. */
export function ramp(palette: Palette, t: number): string {
  const stops = RAMPS[palette];
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  return rgbToHex(a.map((v, k) => v + (b[k] - v) * f));
}

export function rampGradient(palette: Palette): string {
  return `linear-gradient(90deg, ${RAMPS[palette].join(', ')})`;
}

/** Escala de raíz cuadrada (los valores son muy asimétricos). Solo posiciona color. */
export function sqrtT(v: number, max: number): number {
  if (max <= 0) return 0;
  return Math.sqrt(Math.max(0, v)) / Math.sqrt(max);
}

export const INK_LIGHT = '#ffffff';
export const INK_DARK = '#0b0f17';

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores (1 a 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Símbolo blanco o negro, el que tenga más contraste con el fondo de la celda. */
export function inkOn(bg: string): string {
  return contrast(bg, INK_LIGHT) >= contrast(bg, INK_DARK) ? INK_LIGHT : INK_DARK;
}

/** Color de acento por nivel (puntos de la rampa); el nivel siempre va con texto e ícono. */
export function statusColor(palette: Palette, s: Status): string {
  const [low, normal, high, extreme] = STATUS_T[palette];
  switch (s) {
    case 'below':
      return ramp(palette, low);
    case 'normal':
      return ramp(palette, normal);
    case 'above':
      return ramp(palette, high);
    case 'critical':
      return ramp(palette, extreme);
    default:
      return '#5b6573';
  }
}

/** Marca textual del nivel: el estado nunca depende solo del color. */
export function statusMark(s: Status): string {
  switch (s) {
    case 'below':
      return '↓';
    case 'above':
      return '•';
    case 'critical':
      return '••';
    case 'insufficient_baseline':
      return '?';
    default:
      return '';
  }
}

/** Fondo de las tarjetas de mes (vista por año). */
export const CARD_BG = '#121822';

/**
 * Versión legible de un color de acento sobre fondo oscuro: lo mezcla hacia el blanco
 * hasta alcanzar el contraste pedido (4.5:1 = texto normal WCAG AA).
 */
export function readableOn(color: string, bg: string = CARD_BG, min = 4.5): string {
  const c = hexToRgb(color);
  for (let f = 0; f <= 1; f += 0.05) {
    const mixed = rgbToHex(c.map((v) => v + (255 - v) * f));
    if (contrast(mixed, bg) >= min) return mixed;
  }
  return '#ffffff';
}
