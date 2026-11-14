import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useEffect, useRef, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { usingMocks } from '../api';
import { useApp } from '../state';
import type { Polygon, PresetFeature } from '../types';

const CYAN = '#22d3ee';

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

  useEffect(() => {
    if (target) map.fitBounds(boundsOf(target), { padding: [24, 24], maxZoom: 9 });
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
    const shapeOptions = { color: CYAN, weight: 2, fillOpacity: 0.08 };
    const h =
      drawMode === 'rect'
        ? new L.Draw.Rectangle(map as L.DrawMap, { shapeOptions })
        : new L.Draw.Polygon(map as L.DrawMap, { shapeOptions, allowIntersection: false, showArea: false });
    h.enable();
    handler.current = h;
    return () => {
      h.disable();
    };
  }, [map, drawMode]);

  return null;
}

export function MapPanel({ className = '' }: { className?: string }) {
  const { t, presets, aoi, setAoi, presetName } = useApp();
  const [drawMode, setDrawMode] = useState<'rect' | 'poly' | null>(null);
  const features: PresetFeature[] = presets.state === 'ok' ? presets.data.features : [];
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;
  const drawn = 'geometry' in aoi ? aoi.geometry : null;
  const target = drawn ?? features.find((f) => f.id === selectedId)?.geometry ?? null;

  return (
    <div className={`relative overflow-hidden rounded border border-line ${className}`}>
      <MapContainer
        center={[21.3, -99.8]}
        zoom={8}
        className="h-full w-full"
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
        {features.map((f) => {
          const on = f.id === selectedId;
          return (
            <GeoJSON
              key={`${f.id}-${on}`}
              data={f as unknown as GeoJSON.Feature}
              style={{
                color: on ? CYAN : '#93a0ad',
                weight: on ? 2.5 : 1,
                dashArray: on ? undefined : '4 4',
                fillOpacity: on ? 0.1 : 0.02,
                fillColor: on ? CYAN : '#93a0ad',
              }}
              eventHandlers={{ click: () => setAoi({ preset_id: f.id }) }}
            />
          );
        })}
        {drawn && (
          <GeoJSON
            key={JSON.stringify(drawn)}
            data={{ type: 'Feature', properties: {}, geometry: drawn } as GeoJSON.Feature}
            style={{ color: CYAN, weight: 2.5, fillOpacity: 0.12 }}
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

      <div className="absolute left-2 top-2 z-[500] flex max-w-[calc(100%-1rem)] flex-wrap gap-1.5">
        <span className="sr-only">{t('map.presets')}</span>
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === selectedId}
            onClick={() => setAoi({ preset_id: f.id })}
            className={`btn bg-bg/85 px-2.5 py-1 text-xs backdrop-blur ${f.id === selectedId ? 'btn-on' : ''}`}
          >
            {presetName(f)}
          </button>
        ))}
      </div>
      <div className="absolute bottom-6 left-2 z-[500] flex gap-1.5">
        <button type="button" aria-pressed={drawMode === 'rect'} onClick={() => setDrawMode(drawMode === 'rect' ? null : 'rect')}
          className={`btn bg-bg/85 px-2.5 py-1 font-mono text-xs ${drawMode === 'rect' ? 'btn-on' : ''}`}
        >
          ▭ {t('map.rect')}
        </button>
        <button type="button" aria-pressed={drawMode === 'poly'} onClick={() => setDrawMode(drawMode === 'poly' ? null : 'poly')}
          className={`btn bg-bg/85 px-2.5 py-1 font-mono text-xs ${drawMode === 'poly' ? 'btn-on' : ''}`}
        >
          ⬠ {t('map.poly')}
        </button>
        <button type="button" disabled={!drawn}
          onClick={() => setAoi({ preset_id: features[0]?.id ?? 'qro-sierra-gorda' })}
          className="btn bg-bg/85 px-2.5 py-1 font-mono text-xs"
        >
          ✕ {t('map.clear')}
        </button>
      </div>
      {drawn && usingMocks && (
        <p className="absolute right-2 top-12 z-[500] max-w-[220px] rounded border border-warn/50 bg-bg/90 px-2 py-1 text-[11px] text-warn">
          {t('map.mockPoly')}
        </p>
      )}
    </div>
  );
}
