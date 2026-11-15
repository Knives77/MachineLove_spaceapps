import type { Polygon } from '../types';

/** Vértices del anillo exterior sin el punto de cierre. */
function ring(g: Polygon): number[][] {
  const r = g.coordinates[0];
  const a = r[0];
  const b = r[r.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? r.slice(0, -1) : r;
}

/** Centro aproximado (promedio de vértices), como [lon, lat]. */
export function centroid(g: Polygon): [number, number] {
  const pts = ring(g);
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lon, lat];
}

/** Área aproximada en km² (proyección local equirectangular; suficiente para avisos y DEMO). */
export function areaKm2(g: Polygon): number {
  const pts = ring(g);
  const [, lat0] = centroid(g);
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.57;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return Math.abs(s) / 2;
}

/** "24.67° N, -101.05°": latitud con hemisferio y longitud decimal con signo (sin "O" que parezca 0). */
export function fmtLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${lon.toFixed(2)}°`;
}

/** Una coordenada suelta: grados decimales o grados-minutos-segundos, con signo o hemisferio. */
function parseCoord(part: string): { v: number; hemi: string | null } | null {
  const p = part.trim();
  // Solo cifras, signo, punto, espacios, símbolos de grado/minuto/segundo y una letra de hemisferio.
  if (!p || /[^-+\d.\s°º'′"″NSEWO]/.test(p)) return null;
  const hemis = p.match(/[NSEWO]/g);
  if (hemis && hemis.length > 1) return null;
  const nums = p.match(/[-+]?\d+(?:\.\d+)?/g);
  if (!nums || nums.length > 3) return null;
  const [d, m = 0, s = 0] = nums.map(Number);
  if (/\.\d*\./.test(p) || nums.slice(1).some((n) => /^[-+]/.test(n)) || m >= 60 || s >= 60) return null;
  // Solo la última parte lleva decimales: 21°12.5' sí, 21.5°12' no.
  if (nums.slice(0, -1).some((n) => n.includes('.'))) return null;
  const hemi = hemis?.[0] ?? null;
  if (hemi && d < 0) return null; // "-21 N" es ambiguo
  const v = Math.abs(d) + m / 60 + s / 3600;
  return { v: d < 0 || hemi === 'S' || hemi === 'W' || hemi === 'O' ? -v : v, hemi };
}

/**
 * Texto libre → punto. Acepta lo que se copia de Google Maps u otros visores:
 * "21.2, -99.6", "21.2 -99.6", "21,2; -99,6", "21.2N 99.6W" (u "O" de oeste),
 * "21°12'30\"N 99°36'W". Orden latitud, longitud; se invierte si los hemisferios
 * o los rangos dicen lo contrario ("-99.6, 21.2"). Null si no se entiende o está fuera de rango.
 */
export function parseLatLon(input: string): { lat: number; lon: number } | null {
  const s = input.trim().toUpperCase().replace(/[−–—]/g, '-');
  if (!s) return null;
  let parts: string[];
  if (s.includes(';')) parts = s.split(';').map((x) => x.replace(',', '.')); // coma decimal
  else if (s.split(',').length === 2) parts = s.split(',');
  else if (/^\s*[-+]?\d+,\d+\s*,\s*[-+]?\d+,\d+\s*$/.test(s)) {
    const [a, b, c, d] = s.split(','); // "21,2, -99,6": coma decimal y coma separadora
    parts = [`${a}.${b}`, `${c}.${d}`];
  } else {
    const byHemi = s.match(/^(.*?[NS])\s*(.+[EWO])$/) ?? s.match(/^(.*?[EWO])\s*(.+[NS])$/);
    parts = byHemi ? [byHemi[1], byHemi[2]] : s.split(/\s+/);
  }
  if (parts.length !== 2) return null;
  const a = parseCoord(parts[0]);
  const b = parseCoord(parts[1]);
  if (!a || !b) return null;
  const isLon = (h: string | null) => h === 'E' || h === 'W' || h === 'O';
  const isLat = (h: string | null) => h === 'N' || h === 'S';
  if ((isLat(a.hemi) && isLat(b.hemi)) || (isLon(a.hemi) && isLon(b.hemi))) return null;
  let [lat, lon] = [a.v, b.v];
  if (isLon(a.hemi) || isLat(b.hemi) || (!a.hemi && !b.hemi && Math.abs(lat) > 90 && Math.abs(lon) <= 90)) [lat, lon] = [lon, lat];
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Cuadro alrededor de un punto: ± `km` en latitud y longitud (aprox. esférica). */
export function boxAround(lat: number, lon: number, km: number): Polygon {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  const [s, n] = [r(lat - dLat), r(lat + dLat)];
  const [w, e] = [r(Math.max(-180, lon - dLon)), r(Math.min(180, lon + dLon))];
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}
