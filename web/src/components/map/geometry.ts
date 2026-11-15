// Geometría del mapa: tipos GeoJSON mínimos y utilidades puras (sin React ni estado).
import { LngLatBounds } from 'maplibre-gl';
import type { Polygon, PresetFeature } from '../../types';

export const MAX_AREA_KM2 = 200_000; // api.md: aoi_too_large

// GeoJSON mínimo para las fuentes del mapa (sin depender de @types/geojson).
export type Geom =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'Point'; coordinates: number[] };
export type Feat = { type: 'Feature'; properties: Record<string, unknown>; geometry: Geom };
export type FC = { type: 'FeatureCollection'; features: Feat[] };

export const EMPTY: FC = { type: 'FeatureCollection', features: [] };

/** Cierra el anillo (primer punto = último) y deja [lon, lat] como pide el contrato. */
export function closeRing(ring: number[][]): Polygon {
  const r = ring.map(([lon, lat]) => [lon, lat]);
  const a = r[0];
  const b = r[r.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) r.push([a[0], a[1]]);
  return { type: 'Polygon', coordinates: [r] };
}

/** Caja envolvente exacta del polígono (todos sus vértices). */
export function bboxOf(geom: Polygon): LngLatBounds {
  const b = new LngLatBounds();
  for (const [lon, lat] of geom.coordinates[0]) b.extend([lon, lat]);
  return b;
}

/** ¿Se cruzan dos aristas que no son vecinas? (polígono inválido para la API). */
export function selfIntersects(pts: number[][]): boolean {
  const n = pts.length;
  const orient = (a: number[], b: number[], c: number[]) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const cross = (p1: number[], p2: number[], p3: number[], p4: number[]) =>
    orient(p1, p2, p3) * orient(p1, p2, p4) < 0 && orient(p3, p4, p1) * orient(p3, p4, p2) < 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // aristas vecinas por el cierre
      if (cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Regiones de ejemplo + área dibujada, con `active` para el estilo (la activa va al final, encima). */
export function regionsData(features: PresetFeature[], selectedId: string | null, drawn: Polygon | null): FC {
  const out: Feat[] = [...features]
    .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))
    .map((f) => ({ type: 'Feature', properties: { id: f.id, active: f.id === selectedId }, geometry: f.geometry }));
  if (drawn) out.push({ type: 'Feature', properties: { id: '__drawn', active: true }, geometry: drawn });
  return { type: 'FeatureCollection', features: out };
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Utilidades puras de coordenadas: viven en lib/geo.ts (sin maplibre) para usarse fuera del mapa.
export { boxAround, parseLatLon } from '../../lib/geo';
