// Fuego sobre el mapa (solo consola de Experto): pide los hotspots del mes elegido y anima la mancha.
import type { GeoJSONSource, MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { getHotspots } from '../../api';
import { monthRange } from '../../lib/format';
import { setHud } from '../../lib/hud';
import { ApiError, type Aoi, type HotspotCollection } from '../../types';
import { EMPTY, reducedMotion, type Feat } from './geometry';
import { fireIntensity } from './layers';

/** Hotspots ya consultados por área y mes: volver a un mes es instantáneo (se guardan los últimos 40). */
const HOT_CACHE = new Map<string, Promise<HotspotCollection>>();
function hotspotsOf(aoiKey: string, aoi: Aoi, start_date: string, end_date: string): Promise<HotspotCollection> {
  const key = `${aoiKey}|${Number(start_date.slice(0, 4))}-${Number(start_date.slice(5, 7))}`;
  let p = HOT_CACHE.get(key);
  if (!p) {
    p = getHotspots({ aoi, start_date, end_date });
    HOT_CACHE.set(key, p);
    p.catch(() => HOT_CACHE.delete(key));
    if (HOT_CACHE.size > 40) HOT_CACHE.delete(HOT_CACHE.keys().next().value as string);
  }
  return p;
}

export function useFireLayer({
  mapRef,
  ready,
  tools,
  fire,
  aoi,
  selected,
}: {
  mapRef: RefObject<MapLibreMap | null>;
  ready: boolean;
  /** Solo la consola de Experto lleva fuego. */
  tools: boolean;
  /** Capa encendida (botón "Fuego"). */
  fire: boolean;
  aoi: Aoi;
  selected: { year: number; month: number } | null;
}) {
  const [burning, setBurning] = useState(false);
  const fireScale = useRef(1);

  // Fuego: pide a la API los hotspots del mes elegido dentro del área y los pinta. Nada se calcula aquí:
  // `is_vegetation_fire` y `frp` vienen de la respuesta. Los meses ya consultados se guardan (HOT_CACHE).
  const aoiKey = JSON.stringify(aoi);
  const selYear = selected?.year;
  const selMonth = selected?.month;
  useEffect(() => {
    const map = mapRef.current;
    if (!tools || !ready || !map) return;
    const src = map.getSource('hotspots') as GeoJSONSource | undefined;
    if (!src) return;
    if (!fire || !selYear || !selMonth) {
      src.setData(EMPTY);
      setBurning(false);
      setHud({ hotspots: fire ? null : { state: 'off', total: 0, fixed: 0 } });
      return;
    }
    let alive = true;
    setHud({ hotspots: { state: 'loading', total: 0, fixed: 0 } });
    // Pequeña espera: al recorrer meses con las flechas no se lanza una consulta por cada paso.
    const timer = window.setTimeout(() => {
      const [start_date, end_date] = monthRange(selYear, selMonth);
      hotspotsOf(aoiKey, aoi, start_date, end_date)
        .then((fc) => {
          if (!alive) return;
          let fixed = 0;
          const features: Feat[] = fc.features.map((f) => {
            if (!f.properties.is_vegetation_fire) fixed++;
            return {
              type: 'Feature',
              properties: { veg: f.properties.is_vegetation_fire, frp: f.properties.frp },
              geometry: f.geometry,
            };
          });
          src.setData({ type: 'FeatureCollection', features });
          // Solo presentación: con pocas detecciones cada una brilla más, y con miles la mancha se atenúa
          // para no quemarse a blanco. La mancha dice DÓNDE hubo fuego; CUÁNTO lo dice el calendario.
          const veg = features.length - fixed;
          fireScale.current = Math.min(1.4, Math.max(0.22, 1 / Math.sqrt(Math.max(veg, 1) / 150)));
          map.setPaintProperty('hot-fire', 'heatmap-intensity', fireIntensity(fireScale.current));
          map.setPaintProperty('hot-core', 'circle-opacity', Math.min(1, Math.max(0.3, 500 / Math.max(veg, 1))));
          map.setPaintProperty('hot-core', 'circle-stroke-opacity', Math.min(1, Math.max(0, 500 / Math.max(veg, 1) - 0.4)));
          setBurning(veg > 0);
          setHud({ hotspots: { state: 'ok', total: features.length, fixed } });
        })
        .catch((e) => {
          if (!alive) return;
          src.setData(EMPTY);
          setBurning(false);
          const many = e instanceof ApiError && e.code === 'aoi_too_large';
          setHud({ hotspots: { state: many ? 'too_many' : 'error', total: 0, fixed: 0 } });
        });
    }, HOT_CACHE.has(`${aoiKey}|${selYear}-${selMonth}`) ? 0 : 180);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fire, aoiKey, selYear, selMonth]);

  // Parpadeo del fuego: la intensidad de la mancha respira ~9 veces por segundo (no en cada cuadro).
  // Solo corre si hay fuego en pantalla y la pestaña está visible; con "reducir movimiento" queda fijo.
  useEffect(() => {
    const map = mapRef.current;
    if (!tools || !ready || !map || !fire || !burning || reducedMotion()) return;
    const id = window.setInterval(() => {
      if (document.hidden || !map.getLayer('hot-fire')) return;
      const t = performance.now() / 1000;
      const m = 1 + 0.13 * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 12.1) + 0.05 * Math.sin(t * 23.7);
      map.setPaintProperty('hot-fire', 'heatmap-intensity', fireIntensity(fireScale.current * m));
    }, 110);
    return () => {
      window.clearInterval(id);
      if (map.getLayer('hot-fire')) map.setPaintProperty('hot-fire', 'heatmap-intensity', fireIntensity(fireScale.current));
    };
  }, [ready, fire, burning]);
}
