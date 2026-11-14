import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { DEFAULT_PRESET, useApp } from '../state';
import type { Polygon, PresetFeature } from '../types';

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
  drawMode,
  onDrawn,
  onDrawEnd,
}: {
  target: Polygon | null;
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

  // Encuadra la región completa con margen: 80 px arriba (píldoras flotantes) y 40 px en los demás lados.
  useEffect(() => {
    if (!target) return;
    const opts = { paddingTopLeft: [40, 80] as L.PointTuple, paddingBottomRight: [40, 40] as L.PointTuple, maxZoom: 9 };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) map.fitBounds(boundsOf(target), { ...opts, animate: false });
    else map.flyToBounds(boundsOf(target), { ...opts, duration: 0.8 });
  }, [map, target]);

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

export function MapPanel({ className = '' }: { className?: string }) {
  const { t, presets, aoi, setAoi, presetName } = useApp();
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
      <div className="pointer-events-none absolute inset-2 z-[500] flex flex-col items-start gap-2">
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
          className={`btn whitespace-nowrap border-dashed bg-bg/85 px-2 py-1 text-[11.5px] backdrop-blur ${drawn || panel ? 'btn-on' : ''}`}
        >
          <span aria-hidden="true" className="mr-1 text-cyan">+</span>
          {t('map.custom')}
        </button>
      </div>

      {panel && (
        <CustomAreaPanel
          onClose={() => setPanel(false)}
          onDraw={startDraw}
          onBox={(g) => {
            setPanel(false);
            setAoi({ geometry: g });
          }}
        />
      )}
      </div>

      <MapContainer
        center={[21.3, -99.8]}
        zoom={8}
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
        <div role="status" className="absolute bottom-7 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-3 rounded border border-cyan/60 bg-bg/90 px-3 py-2 text-[12.5px] backdrop-blur">
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
    <div
      id="custom-area"
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
        <button type="button" onClick={() => onDraw('poly')} className="btn px-2 py-1.5 text-xs">
          ⬠ {t('map.poly')}
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
    </div>
  );
}
