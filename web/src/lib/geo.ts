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
