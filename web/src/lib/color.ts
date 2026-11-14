import type { Palette, Status } from '../types';

// Rampas secuenciales perceptualmente uniformes, recortadas para que el valor
// más bajo se distinga del fondo oscuro. La luminancia crece de forma monótona,
// así que se leen en escala de grises y con daltonismo.
const RAMPS: Record<Palette, string[]> = {
  // inferno 0.30 → 1.00
  inferno: ['#6a176e', '#932667', '#bc3754', '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4'],
  // cividis 0.25 → 1.00
  cividis: ['#414d6b', '#575d6d', '#707173', '#8a8779', '#a69d75', '#c4b56c', '#e4cf5b', '#fdea45'],
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

/** Texto legible sobre un fondo dado. */
export function inkOn(bg: string): string {
  const [r, g, b] = hexToRgb(bg).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.28 ? '#0b0d12' : '#f5f7fa';
}

/** Color de acento por nivel (puntos de la rampa); el nivel siempre va con texto e ícono. */
export function statusColor(palette: Palette, s: Status): string {
  switch (s) {
    case 'below':
      return ramp(palette, 0.08);
    case 'normal':
      return ramp(palette, 0.3);
    case 'above':
      return ramp(palette, 0.68);
    case 'critical':
      return ramp(palette, 1);
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
