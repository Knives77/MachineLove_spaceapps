// Ficha de un punto de calor: al pasar el cursor sobre un punto del mapa se ven su fecha, satélite,
// potencia (FRP) y tipo, tal como los devuelve POST /hotspots (api.md). Aquí no se calcula nada: solo se da formato.
import { Popup, type MapLibreMap, type MapMouseEvent, type MapGeoJSONFeature, type PointLike, type PositionAnchor } from 'maplibre-gl';
import type { Lang } from '../../types';

/** Capas de puntos que abren la ficha (fuego de vegetación y fuente fija). */
const HOT_LAYERS = ['hot-core', 'hot-static'];
/** Holgura del toque en px: los puntos son pequeños. */
const SLOP = 6;

/** La API manda códigos de satélite; estos son sus nombres. */
const SAT_NAME: Record<string, string> = { Terra: 'Terra', Aqua: 'Aqua', SNPP: 'S-NPP', N20: 'NOAA-20', N21: 'NOAA-21' };

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type HotProps = { veg?: boolean; frp?: number; fam?: string; date?: string; sat?: string; lon?: number; lat?: number };

/** El punto de calor bajo el cursor (el más cercano dentro de la holgura), o null. */
function hotspotAt(map: MapLibreMap, point: { x: number; y: number }): MapGeoJSONFeature | null {
  const layers = HOT_LAYERS.filter((id) => map.getLayer(id));
  if (!layers.length) return null;
  const box: [PointLike, PointLike] = [
    [point.x - SLOP, point.y - SLOP],
    [point.x + SLOP, point.y + SLOP],
  ];
  let best: MapGeoJSONFeature | null = null;
  let bestD = Infinity;
  for (const f of map.queryRenderedFeatures(box, { layers })) {
    const p = f.properties as HotProps;
    if (typeof p.lon !== 'number' || typeof p.lat !== 'number') continue;
    const s = map.project([p.lon, p.lat]);
    const d = (s.x - point.x) ** 2 + (s.y - point.y) ** 2;
    if (d < bestD) {
      best = f;
      bestD = d;
    }
  }
  return best;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function card(p: HotProps, t: Translate, lang: Lang): HTMLElement {
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  const [y, m, d] = (p.date ?? '').split('-').map(Number);
  const date = y
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
    : '—';
  const frp = typeof p.frp === 'number' ? `${p.frp.toLocaleString(locale, { maximumFractionDigits: 1 })} MW` : '—';
  const where = typeof p.lat === 'number' && typeof p.lon === 'number' ? `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}` : '—';

  const box = el('div', 'hp');
  box.append(el('p', 'hp-k', t('hot.kicker', { fam: p.fam ?? '' })));
  box.append(el('p', 'hp-h', SAT_NAME[p.sat ?? ''] ?? p.sat ?? '—'));
  const grid = el('div', 'hp-g');
  for (const [label, value] of [
    [t('hot.date'), date],
    [t('hot.frp'), frp],
    [t('hot.type'), t(p.veg ? 'hot.veg' : 'hot.static')],
    [t('hot.where'), where],
  ]) {
    grid.append(el('span', 'hp-l', label), el('span', 'hp-v', value));
  }
  box.append(grid);
  box.append(el('p', 'hp-n', t('hot.note')));
  return box;
}

function keyOf(p: HotProps): string {
  return `${p.lon}|${p.lat}|${p.date ?? ''}|${p.sat ?? ''}|${p.frp ?? ''}`;
}

/**
 * Registra la ficha en el mapa ya cargado. `text` da el idioma vigente; `blocked` la desactiva mientras se dibuja.
 * Devuelve `close` para cerrarla cuando cambian los datos (otro mes, otra área).
 */
export function attachHotspotPopup(map: MapLibreMap, text: () => { t: Translate; lang: Lang }, blocked: () => boolean) {
  let popup: Popup | null = null;
  let activeKey: string | null = null;
  let hovering = false;
  let raf = 0;

  const close = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    popup?.remove();
    popup = null;
    activeKey = null;
  };

  // Ficha al pasar el cursor sobre un punto + cursor de mano (como mucho una consulta por cuadro).
  map.on('mousemove', (e: MapMouseEvent) => {
    if (raf) return;
    const pt = e.point;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (blocked()) {
        close();
        return;
      }
      const f = hotspotAt(map, pt);
      const over = !!f;
      if (over !== hovering) {
        hovering = over;
        // Al salir de un punto, la mano sigue si debajo hay una región que se puede elegir.
        const region = !over && map.getLayer('regions-fill') && map.queryRenderedFeatures(pt, { layers: ['regions-fill'] }).length > 0;
        map.getCanvas().style.cursor = over || region ? 'pointer' : '';
      }
      if (!f) {
        close();
        return;
      }
      const p = f.properties as HotProps;
      const k = keyOf(p);
      if (k === activeKey && popup) return;
      activeKey = k;
      const { t, lang } = text();
      // La ficha se abre hacia el centro de lo que se ve en pantalla: lejos de los paneles de los bordes.
      const box = map.getCanvas().getBoundingClientRect();
      const at = map.project([p.lon as number, p.lat as number]);
      const x = box.left + at.x;
      const y = box.top + at.y;
      const anchor = `${y > window.innerHeight / 2 ? 'bottom' : 'top'}-${x > window.innerWidth / 2 ? 'right' : 'left'}` as PositionAnchor;
      popup?.remove();
      popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 10, maxWidth: '300px', className: 'hot-pop', anchor })
        .setLngLat([p.lon as number, p.lat as number])
        .setDOMContent(card(p, t, lang))
        .addTo(map);
    });
  });

  map.on('mouseout', () => {
    hovering = false;
    close();
  });
  map.on('dragstart', close);

  return { close };
}
