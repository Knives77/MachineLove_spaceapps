// Estilo, fuentes y capas del mapa. Todo lo que se añade al estilo base vive aquí;
// MapPanel solo decide cuándo llamarlo y con qué datos.
import type { ExpressionSpecification, MapLibreMap } from 'maplibre-gl';
import { FIRE_PALETTES, MAP } from '../../theme/tokens';
import type { Palette } from '../../types';
import { EMPTY } from './geometry';

const ACTIVE = MAP.regionActive; // borde y relleno de la región activa
const IDLE = MAP.regionIdle; // contorno de las regiones no elegidas
const DRAW = MAP.draw; // trazo mientras se dibuja (interacción)

/**
 * Mapa base vectorial "dark" de OpenFreeMap (gratis, sin API key; datos de OpenStreetMap).
 * Al cargar se ajustan el fondo a #090D14 y el agua a un azul muy oscuro.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export { STYLE_URL };

/** Relieve (solo con `tools`): teselas de elevación abiertas de Mapzen en AWS, sin API key. */
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
/** Cámara de la vista 3D: inclinada y girada un poco, como una maqueta. */
export const CAM_3D = { pitch: 55, bearing: -18 };
export const CAM_2D = { pitch: 0, bearing: 0 };
/** Propiedades que se animan desde código: el cambio se aplica en el mismo cuadro. */
const NO_TRANSITION = { duration: 0, delay: 0 };

/** `#rrggbb` + opacidad → `rgba(...)` (los colores salen de tokens; aquí solo se les pone transparencia). */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Intensidad de la mancha de fuego según el zoom; `m` la hace respirar (parpadeo). */
export const fireIntensity = (m: number): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 5, 0.38 * m, 8, 0.5 * m, 12, 0.95 * m];

const FRP_EXPR: ExpressionSpecification = ['sqrt', ['max', 0, ['coalesce', ['get', 'frp'], 0]]];

function heatmapColorExpr(palette: Palette): ExpressionSpecification {
  const { ramp } = FIRE_PALETTES[palette];
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, rgba(ramp[0], 0),
    0.03, rgba(ramp[1], 0.55),
    0.1, rgba(ramp[2], 0.95),
    0.3, ramp[3],
    0.72, ramp[4],
    1, ramp[5],
  ];
}

function fireDotColorExpr(palette: Palette): ExpressionSpecification {
  const { dotLow, dotMid, dotHigh, dotPeak } = FIRE_PALETTES[palette];
  return [
    'interpolate',
    ['linear'],
    FRP_EXPR,
    1, dotLow,
    2.8, dotMid,
    5, dotHigh,
    8, dotPeak,
  ];
}

/** Actualiza los colores de la mancha y los focos de calor según la paleta activa. */
export function applyFirePalette(map: MapLibreMap, palette: Palette) {
  if (map.getLayer('hot-fire')) map.setPaintProperty('hot-fire', 'heatmap-color', heatmapColorExpr(palette));
  if (map.getLayer('hot-core')) {
    map.setPaintProperty('hot-core', 'circle-color', fireDotColorExpr(palette));
    map.setPaintProperty('hot-core', 'circle-stroke-color', FIRE_PALETTES[palette].dotStroke);
  }
}

/**
 * Añade al mapa ya cargado el tono de la app, las regiones, las capas de fuego, la herramienta de
 * dibujo y, con `tools` (consola de Experto), el relieve. Orden = orden de pintado.
 */
export function addMapLayers(map: MapLibreMap, tools: boolean, palette: Palette = 'inferno') {
  // Tono de la app sobre el estilo base.
  type Paint = Parameters<MapLibreMap['setPaintProperty']>;
  const set = (id: string, prop: Paint[1], value: Paint[2]) => {
    if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
  };
  set('background', 'background-color', MAP.background);
  set('water', 'fill-color', MAP.water);
  set('waterway', 'line-color', MAP.water);
  for (const id of ['landcover_wood', 'landuse_park']) set(id, 'fill-color', MAP.landcover);
  set('landuse_residential', 'fill-color', MAP.residential);
  set('boundary_state', 'line-color', MAP.boundaryState);
  for (const id of ['boundary_country_z0-4', 'boundary_country_z5-']) set(id, 'line-color', MAP.boundaryCountry);
  // Nombres de entidades y territorios: más claros y con halo oscuro para que se lean sobre la tierra.
  const label = (ids: string[], color: string) => {
    for (const id of ids) {
      set(id, 'text-color', color);
      set(id, 'text-halo-color', MAP.labelHalo);
      set(id, 'text-halo-width', 1.4);
    }
  };
  label(['place_state', 'place_country_other', 'place_country_minor', 'place_country_major'], MAP.labelMajor);
  label(['place_city', 'place_city_large', 'place_town', 'place_village'], MAP.labelCity);
  label(['place_other', 'place_suburb'], MAP.labelMinor);
  label(['water_name'], MAP.labelWater);
  // Las regiones van debajo de la primera capa de etiquetas: los nombres siguen legibles.
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

  if (tools) {
    // Relieve sombreado + terreno 3D. Si las teselas no cargan, el mapa sigue funcionando plano.
    map.addSource('dem', {
      type: 'raster-dem',
      tiles: [DEM_TILES],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 12,
      attribution: 'Mapzen Terrain Tiles',
    });
    map.addLayer({
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      paint: {
        'hillshade-exaggeration': 0.45,
        'hillshade-shadow-color': MAP.hillShadow,
        'hillshade-highlight-color': MAP.hillLight,
        'hillshade-accent-color': MAP.hillShadow,
      },
    }, firstLabel);
  }

  map.addSource('regions', { type: 'geojson', data: EMPTY });
  map.addSource('draw', { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'regions-fill',
    type: 'fill',
    source: 'regions',
    paint: {
      'fill-color': ['case', ['get', 'active'], ACTIVE, IDLE],
      'fill-opacity': ['case', ['get', 'active'], tools ? 0.04 : 0.1, 0.02],
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
    // El pulso al elegir región ya anima cuadro a cuadro: sin transición encima.
    paint: {
      'line-color': MAP.regionGlow,
      'line-width': 8,
      'line-blur': 6,
      'line-opacity': 0.4,
      'line-width-transition': NO_TRANSITION,
      'line-opacity-transition': NO_TRANSITION,
    },
  });
  map.addLayer({
    id: 'region-line',
    type: 'line',
    source: 'regions',
    filter: ['get', 'active'],
    paint: { 'line-color': ACTIVE, 'line-width': 2.2 },
  });
  // Hotspots del mes elegido (POST /hotspots). Aro gris = detección en fuente fija (no es fuego de vegetación).
  map.addSource('hotspots', { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'hot-static',
    type: 'circle',
    source: 'hotspots',
    filter: ['!', ['get', 'veg']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.4, 11, 4],
      'circle-color': MAP.background,
      'circle-opacity': 0.6,
      'circle-stroke-color': MAP.staticSource,
      'circle-stroke-width': 1,
    },
  });
  // Fuego extendido: mancha térmica (capa `heatmap` nativa) adaptada a la paleta activa, que enmarca
  // las zonas con actividad sin lavar los puntos individuales hacia blanco.
  map.addLayer({
    id: 'hot-fire',
    type: 'heatmap',
    source: 'hotspots',
    filter: ['get', 'veg'],
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], FRP_EXPR, 0, 0.5, 4, 0.75, 10, 1],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 8, 19, 11, 40, 13, 58],
      'heatmap-intensity': fireIntensity(1),
      // El parpadeo cambia la intensidad ~9 veces por segundo: sin transición. Con la de 300 ms por
      // defecto siempre queda una a medias y el mapa (con relieve) se repinta a 60 cuadros por segundo.
      'heatmap-intensity-transition': NO_TRANSITION,
      'heatmap-opacity': 0.78,
      'heatmap-color': heatmapColorExpr(palette),
    },
  });
  // Puntos de focos de calor ordenados por potencia (FRP) para que los más intensos queden arriba.
  map.addLayer({
    id: 'hot-core',
    type: 'circle',
    source: 'hotspots',
    filter: ['get', 'veg'],
    layout: {
      'circle-sort-key': FRP_EXPR,
    },
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        6, ['interpolate', ['linear'], FRP_EXPR, 1, 1.8, 8, 3.4],
        9, ['interpolate', ['linear'], FRP_EXPR, 1, 2.8, 8, 5.2],
        12, ['interpolate', ['linear'], FRP_EXPR, 1, 4.2, 8, 8.0],
      ],
      'circle-color': fireDotColorExpr(palette),
      'circle-stroke-color': FIRE_PALETTES[palette].dotStroke,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 9, 1.1, 12, 1.5],
    },
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
}
