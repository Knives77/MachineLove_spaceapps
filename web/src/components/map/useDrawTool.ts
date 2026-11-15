// Herramienta de dibujo nativa del mapa (sin mapbox-gl-draw): rectángulo y polígono.
import type { GeoJSONSource, MapLibreMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl';
import { useEffect, useState, type RefObject } from 'react';
import { areaKm2 } from '../../lib/geo';
import type { Aoi } from '../../types';
import { closeRing, EMPTY, MAX_AREA_KM2, selfIntersects, type Feat } from './geometry';

export type DrawMode = 'rect' | 'poly' | null;

/**
 * Devuelve el modo de dibujo y el mensaje de aviso. Al terminar una figura válida llama a `onFinish`
 * con el polígono cerrado en `[lon, lat]`, como pide el contrato.
 */
export function useDrawTool(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  onFinish: RefObject<(a: Aoi) => void>,
  t: (key: string) => string,
) {
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [drawMsg, setDrawMsg] = useState<string | null>(null);

  // Herramienta de dibujo nativa: rectángulo (arrastrar) o polígono (clic por vértice).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !drawMode) return;
    const src = map.getSource('draw') as GeoJSONSource;
    const canvas = map.getCanvas();
    canvas.style.cursor = 'crosshair';
    map.dragPan.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();

    const pts: number[][] = []; // polígono: vértices [lon, lat]
    let start: number[] | null = null; // rectángulo: esquina inicial
    let flashTimer = 0;

    const show = (ring: number[][] | null, line: number[][] | null, vertices: number[][]) => {
      const fs: Feat[] = [];
      if (ring && ring.length >= 3) fs.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
      if (line && line.length >= 2) fs.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
      for (const v of vertices) fs.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: v } });
      src.setData({ type: 'FeatureCollection', features: fs });
    };
    const flash = (msg: string) => {
      setDrawMsg(msg);
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => setDrawMsg(null), 3500);
    };
    const finish = (ring: number[][]) => {
      const g = closeRing(ring);
      if (areaKm2(g) > MAX_AREA_KM2) {
        flash(t('error.aoi_too_large'));
        pts.length = 0;
        start = null;
        show(null, null, []);
        return;
      }
      setDrawMode(null);
      onFinish.current?.({ geometry: g });
    };
    const rectRing = (a: number[], b: number[]) => [a, [b[0], a[1]], b, [a[0], b[1]]];
    const ll = (e: MapMouseEvent | MapTouchEvent) => [e.lngLat.lng, e.lngLat.lat];

    // Rectángulo
    const onDown = (e: MapMouseEvent | MapTouchEvent) => {
      if (drawMode !== 'rect') return;
      e.preventDefault();
      start = ll(e);
    };
    const onMove = (e: MapMouseEvent | MapTouchEvent) => {
      const p = ll(e);
      if (drawMode === 'rect' && start) {
        const r = rectRing(start, p);
        show(r, [...r, r[0]], []);
      } else if (drawMode === 'poly' && pts.length) {
        show(pts.length >= 2 ? [...pts, p] : null, [...pts, p], pts);
      }
    };
    const onUp = (e: MapMouseEvent | MapTouchEvent) => {
      if (drawMode !== 'rect' || !start) return;
      const a = map.project(start as [number, number]);
      if (Math.hypot(a.x - e.point.x, a.y - e.point.y) < 6) {
        start = null; // fue un clic, no un arrastre
        show(null, null, []);
        return;
      }
      finish(rectRing(start, ll(e)));
    };

    // Polígono
    const tryClose = () => {
      if (pts.length < 3) return;
      if (selfIntersects(pts)) {
        flash(t('error.invalid_geometry'));
        return;
      }
      finish(pts);
    };
    const onClick = (e: MapMouseEvent) => {
      if (drawMode !== 'poly') return;
      if (pts.length >= 3) {
        const first = map.project(pts[0] as [number, number]);
        if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 10) return tryClose();
      }
      pts.push(ll(e));
      show(pts.length >= 3 ? pts : null, pts, pts);
    };
    const onDbl = (e: MapMouseEvent) => {
      if (drawMode !== 'poly') return;
      e.preventDefault();
      pts.pop(); // el doble clic también sumó un vértice repetido
      tryClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawMode(null);
      else if (e.key === 'Enter' && drawMode === 'poly') tryClose();
      else if (e.key === 'Backspace' && drawMode === 'poly' && pts.length) {
        pts.pop();
        show(pts.length >= 3 ? pts : null, pts, pts);
      }
    };

    map.on('mousedown', onDown);
    map.on('touchstart', onDown);
    map.on('mousemove', onMove);
    map.on('touchmove', onMove);
    map.on('mouseup', onUp);
    map.on('touchend', onUp);
    map.on('click', onClick);
    map.on('dblclick', onDbl);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(flashTimer);
      map.off('mousedown', onDown);
      map.off('touchstart', onDown);
      map.off('mousemove', onMove);
      map.off('touchmove', onMove);
      map.off('mouseup', onUp);
      map.off('touchend', onUp);
      map.off('click', onClick);
      map.off('dblclick', onDbl);
      window.removeEventListener('keydown', onKey);
      src.setData(EMPTY);
      canvas.style.cursor = '';
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
    };
    // `t` cambia con el idioma; no hace falta reiniciar el dibujo por eso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drawMode]);

  return { drawMode, setDrawMode, drawMsg, setDrawMsg };
}
