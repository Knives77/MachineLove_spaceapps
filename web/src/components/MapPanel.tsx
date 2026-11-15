import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { DEFAULT_PRESET, useApp } from '../state';
import type { Polygon, PresetFeature } from '../types';
import { MapPinPlusIcon } from './icons/map-pin-plus';
import { PenToolIcon } from './icons/pen-tool';
import { useIconAnim } from './icons/useIconAnim';

const SELECT = '#f8fafc'; // contorno activo (interacción), con resplandor cian vía .ml-aoi-glow

/** Cierra el anillo (primer punto = último) y deja [lon, lat] como pide el contrato. */
function closeRing(geom: Polygon): Polygon {
  const ring = geom.coordinates[0].map(([lon, lat]) => [lon, lat]);
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

function boundsOf(geom: Polygon) {
  return L.latLngBounds(geom.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]));
}

function Controller({
  target,
  padRight,
  drawMode,
  onDrawn,
  onDrawEnd,
}: {
  target: Polygon | null;
  padRight: number;
  drawMode: 'rect' | 'poly' | null;
  onDrawn: (g: Polygon) => void;
  onDrawEnd: () => void;
}) {
  const map = useMap();
  const handler = useRef<L.Draw.Feature | null>(null);

  // Leaflet no se entera solo cuando su contenedor cambia de tamaño (p. ej. al esconder
  // el panel del calendario): sin esto quedan teselas grises.
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  // Dos movimientos distintos:
  //  - Cambia la región (preset o área nueva): flyToBounds para encuadrarla completa en el espacio
  //    VISIBLE (80 px arriba por las píldoras, 50 abajo, 40 a la izquierda y `padRight` a la derecha).
  //  - Solo se abre/cierra el panel del calendario: paneo horizontal puro de la mitad del cambio de
  //    margen, SIN cambiar el zoom, para que Leaflet reutilice las teselas que ya tiene.
  const prevTarget = useRef<Polygon | null>(null);
  const prevPad = useRef(padRight);
  useEffect(() => {
    if (!target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const targetChanged = prevTarget.current !== target;
    const dPad = padRight - prevPad.current;
    prevTarget.current = target;
    prevPad.current = padRight;

    if (targetChanged) {
      const opts = {
        paddingTopLeft: [40, 80] as L.PointTuple,
        paddingBottomRight: [padRight, 50] as L.PointTuple,
        maxZoom: 9,
      };
      if (reduce) map.fitBounds(boundsOf(target), { ...opts, animate: false });
      else map.flyToBounds(boundsOf(target), { ...opts, duration: 0.7, easeLinearity: 0.25, animate: true });
      return;
    }
    // Abrir (margen 40 → 410): +185 px, la región se corre a la izquierda; cerrar: −185 px.
    if (dPad !== 0) map.panBy([dPad / 2, 0], { animate: !reduce, duration: 0.35, easeLinearity: 0.25 });
  }, [map, target, padRight]);

  useEffect(() => {
    const onCreated = (e: L.LeafletEvent) => {
      const layer = (e as L.DrawEvents.Created).layer as L.Polygon;
      const gj = layer.toGeoJSON().geometry as Polygon;
      onDrawn(closeRing(gj));
    };
    const onStop = () => onDrawEnd();
    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.DRAWSTOP, onStop);
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.DRAWSTOP, onStop);
    };
  }, [map, onDrawn, onDrawEnd]);

  useEffect(() => {
    handler.current?.disable();
    handler.current = null;
    if (!drawMode) return;
    const shapeOptions = { color: SELECT, weight: 2, fillColor: '#38bdf8', fillOpacity: 0.08 };
    const h =
      drawMode === 'rect'
        ? // showArea: false evita un bug de leaflet-draw 1.0.4 ("type is not defined" en readableArea).
          new L.Draw.Rectangle(map as L.DrawMap, { shapeOptions, showArea: false })
        : new L.Draw.Polygon(map as L.DrawMap, { shapeOptions, allowIntersection: false, showArea: false });
    h.enable();
    handler.current = h;
    return () => {
      h.disable();
    };
  }, [map, drawMode]);

  return null;
}

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
  const [panel, setPanel] = useState(false);
  const features: PresetFeature[] = presets.state === 'ok' ? presets.data.features : [];
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;
  const drawn = 'geometry' in aoi ? aoi.geometry : null;
  const target = drawn ?? features.find((f) => f.id === selectedId)?.geometry ?? null;

  const startDraw = (m: 'rect' | 'poly') => {
    setPanel(false);
    setDrawMode(m);
  };

  return (
    <div className={`relative overflow-hidden rounded border border-line ${className}`}>
      {/* Va antes del mapa en el código para que el Tab llegue primero a las regiones y no a los
          enlaces de atribución de Leaflet; la posición en pantalla no cambia (es absoluta). */}
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

      <MapContainer
        center={[21.3, -99.8]}
        zoom={8}
        // Medios niveles: encuadre más justo sin que las teselas raster se vean borrosas.
        zoomSnap={0.5}
        zoomDelta={0.5}
        className="isolate h-full w-full"
        zoomControl={false}
        attributionControl
        keyboard
      >
        <TileLayer
          className="ml-dark-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={12}
          // Más teselas precargadas alrededor y carga también durante el paneo: sin huecos al deslizar.
          keepBuffer={6}
          updateWhenIdle={false}
        />
        {/* La región activa se dibuja al final para que ningún contorno gris quede encima. */}
        {[...features].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId)).map((f) => {
          const on = f.id === selectedId;
          return (
            <GeoJSON
              key={`${f.id}-${on}`}
              data={f as unknown as GeoJSON.Feature}
              style={{
                color: on ? SELECT : '#64748b',
                className: on ? 'ml-aoi-glow' : undefined,
                weight: on ? 2.5 : 1,
                dashArray: on ? undefined : '4 4',
                fillOpacity: on ? 0.1 : 0.02,
                fillColor: on ? '#38bdf8' : '#64748b',
              }}
              eventHandlers={{ click: () => setAoi({ preset_id: f.id }) }}
            />
          );
        })}
        {drawn && (
          <GeoJSON
            key={JSON.stringify(drawn)}
            data={{ type: 'Feature', properties: {}, geometry: drawn } as GeoJSON.Feature}
            style={{ color: SELECT, weight: 2.5, fillColor: '#38bdf8', fillOpacity: 0.1, className: 'ml-aoi-glow' }}
          />
        )}
        <Controller
          target={target}
          padRight={padRight}
          drawMode={drawMode}
          onDrawn={(g) => {
            setDrawMode(null);
            setAoi({ geometry: g });
          }}
          onDrawEnd={() => setDrawMode(null)}
        />
      </MapContainer>

      {/* Instrucciones mientras se dibuja */}
      {drawMode && (
        <div
          role="status"
          // Centrado en el espacio visible (a la izquierda de un panel abierto).
          style={{ left: `calc((100% - ${padRight - 40}px) / 2)` }}
          className="absolute bottom-7 z-[500] flex -translate-x-1/2 items-center gap-3 rounded border border-cyan/60 bg-bg/90 px-3 py-2 text-[12.5px] backdrop-blur">
          <span>{t(drawMode === 'rect' ? 'map.hintRect' : 'map.hintPoly')}</span>
          <button type="button" onClick={() => setDrawMode(null)} className="font-mono text-[11px] text-mute hover:text-ink">
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
