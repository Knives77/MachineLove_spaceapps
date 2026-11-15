import {
  LngLatBounds,
  MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type MapTouchEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// El worker de MapLibre es un archivo aparte; con `?url` Vite lo sirve y lo copia al build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { areaKm2 } from '../lib/geo';
import { DEFAULT_PRESET, useApp } from '../state';
import { MAP } from '../theme/tokens';
import type { Polygon, PresetFeature } from '../types';
import { MapPinPlusIcon } from './icons/map-pin-plus';
import { PenToolIcon } from './icons/pen-tool';
import { useIconAnim } from './icons/useIconAnim';

setWorkerUrl(workerUrl);

const ACTIVE = MAP.regionActive; // borde y relleno de la región activa
const IDLE = MAP.regionIdle; // contorno de las regiones no elegidas
const DRAW = MAP.draw; // trazo mientras se dibuja (interacción)
const MAX_AREA_KM2 = 200_000; // api.md: aoi_too_large

/**
 * Mapa base vectorial "dark" de OpenFreeMap (gratis, sin API key; datos de OpenStreetMap).
 * Al cargar se ajustan el fondo a #090D14 y el agua a un azul muy oscuro.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

// GeoJSON mínimo para las fuentes del mapa (sin depender de @types/geojson).
type Geom =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'Point'; coordinates: number[] };
type Feat = { type: 'Feature'; properties: Record<string, unknown>; geometry: Geom };
type FC = { type: 'FeatureCollection'; features: Feat[] };

const EMPTY: FC = { type: 'FeatureCollection', features: [] };

/** Cierra el anillo (primer punto = último) y deja [lon, lat] como pide el contrato. */
function closeRing(ring: number[][]): Polygon {
  const r = ring.map(([lon, lat]) => [lon, lat]);
  const a = r[0];
  const b = r[r.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) r.push([a[0], a[1]]);
  return { type: 'Polygon', coordinates: [r] };
}

/** Caja envolvente exacta del polígono (todos sus vértices). */
function bboxOf(geom: Polygon): LngLatBounds {
  const b = new LngLatBounds();
  for (const [lon, lat] of geom.coordinates[0]) b.extend([lon, lat]);
  return b;
}

/** ¿Se cruzan dos aristas que no son vecinas? (polígono inválido para la API). */
function selfIntersects(pts: number[][]): boolean {
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
function regionsData(features: PresetFeature[], selectedId: string | null, drawn: Polygon | null): FC {
  const out: Feat[] = [...features]
    .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))
    .map((f) => ({ type: 'Feature', properties: { id: f.id, active: f.id === selectedId }, geometry: f.geometry }));
  if (drawn) out.push({ type: 'Feature', properties: { id: '__drawn', active: true }, geometry: drawn });
  return { type: 'FeatureCollection', features: out };
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuadro alrededor de un punto: ± `km` en latitud y longitud (aprox. esférica). */
function boxAround(lat: number, lon: number, km: number): Polygon {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  const [s, n] = [r(lat - dLat), r(lat + dLat)];
  const [w, e] = [r(Math.max(-180, lon - dLon)), r(Math.min(180, lon + dLon))];
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}

const RADII = [25, 50, 100] as const;

export function MapPanel({
  className = '',
  padRight = 40,
  children,
}: {
  className?: string;
  /** Margen derecho para encuadrar la región (px); más grande si un panel cubre el lado derecho. */
  padRight?: number;
  /** Capas extra sobre el mapa (p. ej. el panel deslizante del calendario). */
  children?: ReactNode;
}) {
  const { t, presets, aoi, setAoi, presetName } = useApp();
  const pinIcon = useIconAnim();
  const [drawMode, setDrawMode] = useState<'rect' | 'poly' | null>(null);
  const [drawMsg, setDrawMsg] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const features: PresetFeature[] = presets.state === 'ok' ? presets.data.features : [];
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;
  const drawn = 'geometry' in aoi ? aoi.geometry : null;
  const target = drawn ?? features.find((f) => f.id === selectedId)?.geometry ?? null;

  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  // Refs para los manejadores del mapa (se registran una sola vez).
  const drawing = useRef(false);
  drawing.current = drawMode !== null;
  const setAoiRef = useRef(setAoi);
  setAoiRef.current = setAoi;

  const startDraw = (m: 'rect' | 'poly') => {
    setPanel(false);
    setDrawMsg(null);
    setDrawMode(m);
  };

  // Crear el mapa (una vez) con sus fuentes y capas.
  useEffect(() => {
    if (!box.current) return;
    const map = new MapLibreMap({
      container: box.current,
      style: STYLE_URL,
      center: [-99.8, 21.3],
      zoom: 7.5,
      attributionControl: { compact: false },
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: 120,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    // Errores de teselas o estilo: a la consola, sin romper la app.
    map.on('error', (e) => console.warn('[mapa]', e.error?.message ?? e));
    // El estilo base pide íconos que su sprite no trae (p. ej. "circle-11"): se cubren con uno vacío.
    map.setMissingStyleImageResolver((id) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    map.on('load', () => {
      // Tono de la app sobre el estilo base.
      if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', MAP.background);
      if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', MAP.water);
      if (map.getLayer('waterway')) map.setPaintProperty('waterway', 'line-color', MAP.water);
      // Las regiones van debajo de la primera capa de etiquetas: los nombres siguen legibles.
      const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

      map.addSource('regions', { type: 'geojson', data: EMPTY });
      map.addSource('draw', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'regions-fill',
        type: 'fill',
        source: 'regions',
        paint: {
          'fill-color': ['case', ['get', 'active'], ACTIVE, IDLE],
          'fill-opacity': ['case', ['get', 'active'], 0.1, 0.02],
        },
      }, firstLabel);
      map.addLayer({
        id: 'regions-idle',
        type: 'line',
        source: 'regions',
        filter: ['!', ['get', 'active']],
        paint: { 'line-color': IDLE, 'line-width': 1, 'line-dasharray': [3, 3] },
      }, firstLabel);
      map.addLayer({
        id: 'region-glow',
        type: 'line',
        source: 'regions',
        filter: ['get', 'active'],
        paint: { 'line-color': ACTIVE, 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.4 },
      });
      map.addLayer({
        id: 'region-line',
        type: 'line',
        source: 'regions',
        filter: ['get', 'active'],
        paint: { 'line-color': ACTIVE, 'line-width': 2.2 },
      });
      map.addLayer({
        id: 'draw-fill',
        type: 'fill',
        source: 'draw',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ACTIVE, 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'draw-line',
        type: 'line',
        source: 'draw',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': DRAW, 'line-width': 2, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'draw-vertex',
        type: 'circle',
        source: 'draw',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 4, 'circle-color': MAP.background, 'circle-stroke-color': DRAW, 'circle-stroke-width': 2 },
      });

      // Clic en una región de ejemplo = elegirla (salvo mientras se dibuja).
      map.on('click', 'regions-fill', (e: MapLayerMouseEvent) => {
        if (drawing.current) return;
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id && id !== '__drawn') setAoiRef.current({ preset_id: id });
      });
      map.on('mouseenter', 'regions-fill', () => {
        if (!drawing.current) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'regions-fill', () => {
        if (!drawing.current) map.getCanvas().style.cursor = '';
      });
      setReady(true);
    });

    // El canvas sigue el tamaño de su caja (el layout es flex/grid).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Datos de las regiones (región elegida, área dibujada).
  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource('regions') as GeoJSONSource | undefined)?.setData(regionsData(features, selectedId, drawn));
  }, [ready, features, selectedId, drawn]);

  // Cámara: encuadra la región en el espacio VISIBLE (80 arriba por las píldoras, 50 abajo, 40 a la
  // izquierda y `padRight` a la derecha: 410 con el calendario abierto encima del mapa, 40 cerrado).
  // Se repite al cambiar de región y al abrir/cerrar el panel. Animación nativa de MapLibre (WebGL).
  const firstFit = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !target) return;
    const instant = firstFit.current || reducedMotion();
    firstFit.current = false;
    map.fitBounds(bboxOf(target), {
      padding: { top: 80, bottom: 50, left: 40, right: padRight },
      maxZoom: 9,
      duration: instant ? 0 : 650,
      easing: easeOutCubic,
    });
  }, [ready, target, padRight]);

  // Pulso sutil del borde al elegir o cambiar de región: 2 latidos y se detiene.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !target || reducedMotion()) return;
    const t0 = performance.now();
    const ms = 1100;
    let raf = 0;
    const frame = (now: number) => {
      const p = (now - t0) / ms;
      if (p >= 2) {
        map.setPaintProperty('region-glow', 'line-opacity', 0.4);
        map.setPaintProperty('region-glow', 'line-width', 8);
        return;
      }
      const k = Math.sin(Math.PI * (p % 1)); // 0 → 1 → 0 en cada latido
      map.setPaintProperty('region-glow', 'line-opacity', 0.4 + 0.45 * k);
      map.setPaintProperty('region-glow', 'line-width', 8 + 8 * k);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ready, target]);

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
      setAoiRef.current({ geometry: g });
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

  return (
    <div className={`relative overflow-hidden rounded border border-line bg-bg ${className}`}>
      {/* Va antes del mapa en el código para que el Tab llegue primero a las regiones y no a los
          enlaces de atribución del mapa; la posición en pantalla no cambia (es absoluta). */}
      {/* Regiones de ejemplo + área personalizada */}
      {/* Ocupa hasta el borde inferior para limitar la altura del panel; deja pasar los clics al mapa. */}
      <div
        className="pointer-events-none absolute inset-2 z-[500] flex flex-col items-start gap-2"
        // Con un panel encima del lado derecho, las píldoras se acomodan solo en el espacio visible.
        style={padRight > 40 ? { right: padRight } : undefined}
      >
      <div className="pointer-events-auto flex max-w-full flex-wrap gap-1.5">
        <span className="sr-only">{t('map.presets')}</span>
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === selectedId}
            onClick={() => setAoi({ preset_id: f.id })}
            className={`btn whitespace-nowrap bg-bg/85 px-2 py-1 text-[11.5px] backdrop-blur ${f.id === selectedId ? 'btn-on' : ''}`}
          >
            {presetName(f)}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={panel}
          aria-controls="custom-area"
          aria-pressed={!!drawn}
          onClick={() => setPanel((p) => !p)}
          {...pinIcon.trigger}
          className={`btn flex items-center gap-1.5 whitespace-nowrap border-dashed bg-bg/85 px-2 py-1 text-[11.5px] backdrop-blur ${drawn || panel ? 'btn-on' : ''}`}
        >
          <MapPinPlusIcon ref={pinIcon.ref} size={14} aria-hidden="true" className="flex text-cyan" />
          {t('map.custom')}
        </button>
      </div>

      <AnimatePresence>
      {panel && (
        <CustomAreaPanel
          key="custom-area"
          onClose={() => setPanel(false)}
          onDraw={startDraw}
          onBox={(g) => {
            setPanel(false);
            setAoi({ geometry: g });
          }}
        />
      )}
      </AnimatePresence>
      </div>

      {/* Lienzo WebGL de MapLibre: ocupa siempre toda la caja (los paneles flotan encima). */}
      {/* (Envoltura absoluta: el CSS de MapLibre pone `position: relative` en el contenedor del mapa.) */}
      <div className="absolute inset-0">
        <div ref={box} className="h-full w-full" role="region" aria-label={t('map.presets')} />
      </div>

      {/* Instrucciones mientras se dibuja */}
      {drawMode && (
        <div
          role="status"
          // Centrado en el espacio visible (a la izquierda de un panel abierto).
          style={{ left: `calc((100% - ${padRight - 40}px) / 2)` }}
          className="absolute bottom-9 z-[500] flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded border border-cyan/60 bg-bg/90 px-3 py-2 text-[12.5px] backdrop-blur"
        >
          <span className={drawMsg ? 'text-warn' : ''}>
            {drawMsg ?? t(drawMode === 'rect' ? 'map.hintRect' : 'map.hintPoly')}
          </span>
          <button type="button" onClick={() => setDrawMode(null)} className="whitespace-nowrap font-mono text-[11px] text-mute hover:text-ink">
            {t('map.cancelDraw')}
          </button>
        </div>
      )}

      {drawn && !drawMode && (
        <button
          type="button"
          onClick={() => setAoi({ preset_id: DEFAULT_PRESET })}
          className="btn absolute bottom-4 left-4 z-[500] whitespace-nowrap bg-bg/90 px-3 py-1.5 text-xs backdrop-blur"
        >
          ← {t('map.back')}
        </button>
      )}

      {children}
    </div>
  );
}

/** Panel flotante: dibujar un área o dar un punto (lat, lon) con un radio. */
function CustomAreaPanel({
  onClose,
  onDraw,
  onBox,
}: {
  onClose: () => void;
  onDraw: (m: 'rect' | 'poly') => void;
  onBox: (g: Polygon) => void;
}) {
  const { t } = useApp();
  const penIcon = useIconAnim();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [km, setKm] = useState<(typeof RADII)[number]>(50);
  const [bad, setBad] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => first.current?.focus(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat.replace(',', '.'));
    const lo = Number(lon.replace(',', '.'));
    const ok = lat.trim() !== '' && lon.trim() !== '' && Math.abs(la) <= 85 && Math.abs(lo) <= 180;
    setBad(!ok);
    if (ok) onBox(boxAround(la, lo, km));
  };

  const field = 'w-full rounded border border-line bg-panel-2 px-2 py-1.5 font-mono text-[12.5px] text-ink outline-none focus:border-cyan';

  return (
    <motion.div
      id="custom-area"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.7 }}
      style={{ transformOrigin: 'top left' }}
      role="dialog"
      aria-label={t('map.customTitle')}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="pointer-events-auto min-h-0 w-[290px] max-w-full overflow-y-auto rounded-md border border-line bg-panel/95 px-3 py-2.5 text-[12.5px] shadow-xl shadow-black/60 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{t('map.customTitle')}</p>
        <button type="button" onClick={onClose} aria-label={t('map.close')} className="px-1 text-mute hover:text-ink">
          ✕
        </button>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-dim">{t('map.coverage')}</p>

      <p className="kicker mt-2 text-[10px]">A · {t('map.optDraw')}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button ref={first} type="button" onClick={() => onDraw('rect')} className="btn px-2 py-1.5 text-xs">
          ▭ {t('map.rect')}
        </button>
        <button
          type="button"
          onClick={() => onDraw('poly')}
          {...penIcon.trigger}
          className="btn flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs"
        >
          <PenToolIcon ref={penIcon.ref} size={14} aria-hidden="true" className="flex" />
          {t('map.poly')}
        </button>
      </div>

      <p className="kicker mt-2 text-[10px]">B · {t('map.optCoords')}</p>
      <form onSubmit={submit} className="mt-1 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className="text-[10.5px] text-mute">{t('map.lat')}</span>
            <input inputMode="decimal" placeholder="21.20" value={lat} onChange={(e) => setLat(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="text-[10.5px] text-mute">{t('map.lon')}</span>
            <input inputMode="decimal" placeholder="-99.60" value={lon} onChange={(e) => setLon(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <div role="radiogroup" aria-label={t('map.radius')} title={t('map.radius')} className="flex flex-1 gap-1">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={km === r}
                onClick={() => setKm(r)}
                className={`btn flex-1 px-1 py-1.5 font-mono text-[11px] ${km === r ? 'btn-on' : ''}`}
              >
                {r} km
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-on px-3 py-1.5 text-xs font-semibold">
            {t('map.query')}
          </button>
        </div>
        {bad && <p className="text-[11px] text-warn">{t('map.badCoords')}</p>}
      </form>
    </motion.div>
  );
}
