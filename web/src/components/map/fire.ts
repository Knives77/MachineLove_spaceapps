// Fuego sobre el mapa (solo consola de Experto): pide los hotspots del mes elegido y pinta la mancha.
import type { FilterSpecification, GeoJSONSource, MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { getHotspots } from '../../api';
import { monthRange } from '../../lib/format';
import { setHud } from '../../lib/hud';
import { ApiError, type Aoi, type HotspotCollection, type Mode, type Source } from '../../types';
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

/** Familia de sensor (como viene en cada hotspot) que cuenta el calendario según la fuente del mes. */
const FAMILY_OF: Record<Source, string> = { modis: 'MODIS', viirs_scaled: 'VIIRS' };
type Tally = { veg: number; fixed: number };
type Counts = Record<string, Tally>;

/** Duración del parpadeo al aparecer la mancha. */
const FLARE_MS = 1500;

export function useFireLayer({
  mapRef,
  ready,
  tools,
  fire,
  aoi,
  selected,
  mode,
  source,
}: {
  mapRef: RefObject<MapLibreMap | null>;
  ready: boolean;
  /** Solo la consola de Experto lleva fuego. */
  tools: boolean;
  /** Capa encendida (botón "Fuego"). */
  fire: boolean;
  aoi: Aoi;
  selected: { year: number; month: number } | null;
  /** Armonizado: solo las detecciones del sensor que cuenta el calendario ese mes. Crudo: todas. */
  mode: Mode;
  /** Fuente del mes elegido según el calendario (`months[].source`); `undefined` mientras carga. */
  source: Source | null | undefined;
}) {
  // Sube en cada cambio de lo pintado: dispara un parpadeo breve (no continuo).
  const [flare, setFlare] = useState(0);
  const fireScale = useRef(1);
  /** Conteo por familia de lo último cargado; `null` si no hay datos en el mapa. */
  const counts = useRef<Counts | null>(null);

  // Qué se pinta de lo ya cargado. No se calcula nada: es un filtro por los códigos `family` (hotspot) y
  // `source` (mes del calendario) que da la API. Así el mapa y el calendario dicen lo mismo en Armonizado.
  const paint = () => {
    const map = mapRef.current;
    const c = counts.current;
    if (!map || !c || !map.getLayer('hot-fire')) return;
    const raw = mode === 'raw';
    // Armonizado sin fuente (mes sin dato, o calendario cargando): no se pinta fuego.
    const fam = raw ? null : source ? FAMILY_OF[source] : '';
    const only = (veg: boolean): FilterSpecification => {
      const v: FilterSpecification = veg ? ['get', 'veg'] : ['!', ['get', 'veg']];
      return fam === null ? v : ['all', v, ['==', ['get', 'fam'], fam]];
    };
    map.setFilter('hot-static', only(false));
    map.setFilter('hot-fire', only(true));
    map.setFilter('hot-core', only(true));
    const shown = Object.entries(c).reduce<Tally>(
      (a, [k, v]) => (fam === null || k === fam ? { veg: a.veg + v.veg, fixed: a.fixed + v.fixed } : a),
      { veg: 0, fixed: 0 },
    );
    // Armonizado: escala fija por sensor (VIIRS detecta varias veces más puntos que MODIS), para que el
    // brillo se pueda comparar entre meses de la misma fuente. Crudo: con miles de
    // detecciones apiladas la mancha se atenúa para no quemarse a blanco (crudo no es comparable de todos modos).
    fireScale.current = raw ? Math.min(1.4, Math.max(0.22, 1 / Math.sqrt(Math.max(shown.veg, 1) / 150))) : fam === 'VIIRS' ? 0.45 : 1;
    map.setPaintProperty('hot-fire', 'heatmap-intensity', fireIntensity(fireScale.current));
    map.setPaintProperty('hot-core', 'circle-opacity', Math.min(1, Math.max(0.3, 500 / Math.max(shown.veg, 1))));
    map.setPaintProperty('hot-core', 'circle-stroke-opacity', Math.min(1, Math.max(0, 500 / Math.max(shown.veg, 1) - 0.4)));
    setHud({ hotspots: { state: 'ok', total: shown.veg + shown.fixed, fixed: shown.fixed } });
    if (shown.veg > 0) setFlare((n) => n + 1);
  };
  // La respuesta de la API puede llegar después de cambiar de modo: siempre se pinta con lo vigente.
  const paintRef = useRef(paint);
  paintRef.current = paint;

  // Fuego: pide a la API los hotspots del mes elegido dentro del área y los carga en el mapa.
  // `is_vegetation_fire`, `family` y `frp` vienen de la respuesta. Los meses ya consultados se guardan (HOT_CACHE).
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
      counts.current = null;
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
          const c: Counts = {};
          const features: Feat[] = fc.features.map((f) => {
            const { family, is_vegetation_fire, frp } = f.properties;
            const tally = (c[family] ??= { veg: 0, fixed: 0 });
            if (is_vegetation_fire) tally.veg++;
            else tally.fixed++;
            return { type: 'Feature', properties: { veg: is_vegetation_fire, frp, fam: family }, geometry: f.geometry };
          });
          src.setData({ type: 'FeatureCollection', features });
          counts.current = c;
          paintRef.current();
        })
        .catch((e) => {
          if (!alive) return;
          src.setData(EMPTY);
          counts.current = null;
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

  // Cambiar Armonizado/Crudo o la fuente del mes solo cambia el filtro: no se vuelve a pedir nada.
  useEffect(() => {
    if (tools && ready) paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, source]);

  // Parpadeo del fuego: al aparecer la mancha "prende" durante ~1.5 s y queda fija. Cada cambio de
  // intensidad repinta el mapa entero (con relieve), así que no se deja respirando: en reposo el mapa
  // no gasta nada. Con "reducir movimiento" no hay parpadeo.
  useEffect(() => {
    const map = mapRef.current;
    if (!tools || !ready || !map || !fire || !flare || reducedMotion()) return;
    const t0 = performance.now();
    const settle = () => {
      window.clearInterval(id);
      if (map.getLayer('hot-fire')) map.setPaintProperty('hot-fire', 'heatmap-intensity', fireIntensity(fireScale.current));
    };
    const id = window.setInterval(() => {
      const p = (performance.now() - t0) / FLARE_MS;
      if (p >= 1 || !map.getLayer('hot-fire')) return settle();
      if (document.hidden) return;
      const t = performance.now() / 1000;
      const m = 1 + (1 - p) * (0.2 * Math.sin(t * 5.3) + 0.12 * Math.sin(t * 12.1) + 0.07 * Math.sin(t * 23.7));
      map.setPaintProperty('hot-fire', 'heatmap-intensity', fireIntensity(fireScale.current * m));
    }, 110);
    return settle;
  }, [ready, fire, flare]);
}
