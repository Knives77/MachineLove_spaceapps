// El mapa (MapLibre GL, WebGL). Este archivo solo orquesta: crea el mapa, sincroniza cámara y datos,
// y coloca los controles. Lo demás vive al lado:
//   geometry.ts  utilidades puras     layers.ts  fuentes y capas     fire.ts  hotspots + parpadeo
//   useDrawTool.ts  dibujo            Toolbar.tsx  barra flotante    CustomAreaPanel.tsx  panel de coordenadas
import { MapLibreMap, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// El worker de MapLibre es un archivo aparte; con `?url` Vite lo sirve y lo copia al build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setHud } from '../../lib/hud';
import { DEFAULT_PRESET, useApp } from '../../state';
import type { PresetFeature } from '../../types';
import { MapPinPlusIcon } from '../icons/map-pin-plus';
import { useIconAnim } from '../icons/useIconAnim';
import { CustomAreaPanel } from './CustomAreaPanel';
import { useFireLayer } from './fire';
import { bboxOf, easeOutCubic, reducedMotion, regionsData } from './geometry';
import { addMapLayers, CAM_2D, CAM_3D, STYLE_URL } from './layers';
import { MapToolbar } from './Toolbar';
import { useDrawTool } from './useDrawTool';

setWorkerUrl(workerUrl);

export function MapPanel({
  className = '',
  padRight = 40,
  padLeft = 40,
  padTop = 80,
  padBottom,
  dock,
  tools = false,
  compactTools = false,
  children,
}: {
  /** Margen izquierdo para encuadrar (px); más grande si un panel cubre el lado izquierdo. */
  padLeft?: number;
  /** Margen superior e inferior para encuadrar (px); el inferior también sube los avisos de dibujo. */
  padTop?: number;
  padBottom?: number;
  /** Con `tools`: franja que aloja las herramientas del mapa (p. ej. la consola de tiempo). Sin ella, flotan solas. */
  dock?: (toolbar: ReactNode) => ReactNode;
  /** Barra de herramientas solo con iconos (cuando queda poco mapa visible entre paneles). */
  compactTools?: boolean;
  /** Consola de Experto: vista 3D con relieve, barra de herramientas flotante, atajos 1–3 y coordenadas del cursor. */
  tools?: boolean;
  className?: string;
  /** Margen derecho para encuadrar la región (px); más grande si un panel cubre el lado derecho. */
  padRight?: number;
  /** Capas extra sobre el mapa (p. ej. el panel deslizante del calendario). */
  children?: ReactNode;
}) {
  const { t, presets, aoi, setAoi, presetName, selected, mode, calendar } = useApp();
  const pinIcon = useIconAnim();
  const [panel, setPanel] = useState(false);
  const [view3d, setView3d] = useState(tools);
  const [fire, setFire] = useState(true);
  const [fitNonce, setFitNonce] = useState(0);
  const features: PresetFeature[] = presets.state === 'ok' ? presets.data.features : [];
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;
  const drawn = 'geometry' in aoi ? aoi.geometry : null;
  const target = drawn ?? features.find((f) => f.id === selectedId)?.geometry ?? null;

  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  // Refs para los manejadores del mapa (se registran una sola vez).
  const drawing = useRef(false);
  const setAoiRef = useRef(setAoi);
  setAoiRef.current = setAoi;

  // Crear el mapa (una vez) con sus fuentes y capas.
  useEffect(() => {
    if (!box.current) return;
    const map = new MapLibreMap({
      container: box.current,
      style: STYLE_URL,
      center: [-99.8, 21.3],
      zoom: 7.5,
      attributionControl: { compact: false },
      dragRotate: tools,
      pitchWithRotate: tools,
      maxPitch: 70,
      fadeDuration: 120,
      // En pantallas de alta densidad se pinta a 1.5× como máximo: mucho menos píxeles por cuadro, casi sin pérdida visible.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      renderWorldCopies: false,
    });
    if (!tools) map.touchZoomRotate.disableRotation();
    else {
      // Coordenadas del cursor: como mucho una actualización por cuadro.
      let raf = 0;
      map.on('mousemove', (e) => {
        if (raf) return;
        const { lat, lng } = e.lngLat;
        raf = requestAnimationFrame(() => {
          raf = 0;
          setHud({ cursor: { lat, lon: lng } });
        });
      });
      map.on('mouseout', () => setHud({ cursor: null }));
    }
    mapRef.current = map;
    // Errores de teselas o estilo: a la consola, sin romper la app.
    map.on('error', (e) => console.warn('[mapa]', e.error?.message ?? e));
    // El estilo base pide íconos que su sprite no trae (p. ej. "circle-11"): se cubren con uno vacío.
    map.setMissingStyleImageResolver((id) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    map.on('load', () => {
      addMapLayers(map, tools);

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

    // Calidad adaptable: si al mover la cámara los cuadros salen lentos, se baja la resolución de pintado
    // (1.5× → 1× → 0.75×) en vez de quitar el 3D. Solo baja, y solo mide mientras el mapa se mueve.
    const STEPS = [1, 0.75].filter((r) => r < map.getPixelRatio());
    let last = 0;
    let slow = 0;
    let seen = 0;
    map.on('render', () => {
      if (!STEPS.length || !map.isMoving()) {
        last = 0;
        return;
      }
      const now = performance.now();
      const dt = last ? now - last : 0;
      last = now;
      if (!dt || dt > 500) return; // primer cuadro o pausa: no cuenta
      seen++;
      if (dt > 34) slow++; // por debajo de ~30 cuadros por segundo
      if (seen < 24) return;
      if (slow > 12) map.setPixelRatio(STEPS.shift() as number);
      seen = 0;
      slow = 0;
    });

    // El canvas sigue el tamaño de su caja (el layout es flex/grid).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    return () => {
      if (tools) setHud({ cursor: null, hotspots: null });
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
      padding: { top: padTop, bottom: padBottom ?? (tools ? 90 : 50), left: padLeft, right: padRight },
      maxZoom: 9,
      duration: instant ? 0 : 650,
      easing: easeOutCubic,
      ...(tools ? (view3d ? CAM_3D : CAM_2D) : {}),
    });
  }, [ready, target, padRight, padLeft, padTop, padBottom, view3d, fitNonce]);
  // Fuego: hotspots del mes elegido + parpadeo (fire.ts).
  // Fuente del mes elegido según el calendario: decide qué detecciones se pintan en Armonizado.
  const source =
    calendar.state === 'ok' && selected
      ? (calendar.data.months.find((m) => m.year === selected.year && m.month === selected.month)?.source ?? null)
      : undefined;
  useFireLayer({ mapRef, ready, tools, fire, aoi, selected, mode, source });

  // Vista 3D: el terreno se levanta con la elevación real (exagerada 1.6× para que se lea a esta escala).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !tools) return;
    map.setTerrain(view3d ? { source: 'dem', exaggeration: 1.6 } : null);
  }, [ready, view3d]);

  // Atajos 1–3: regiones de ejemplo (no mientras se escribe en un campo).
  useEffect(() => {
    if (!tools) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const f = features[Number(e.key) - 1];
      if (f) setAoiRef.current({ preset_id: f.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [features]);

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
  const { drawMode, setDrawMode, drawMsg, setDrawMsg } = useDrawTool(mapRef, ready, setAoiRef, t);
  const startDraw = (m: 'rect' | 'poly') => {
    setPanel(false);
    setDrawMsg(null);
    setDrawMode(m);
  };
  drawing.current = drawMode !== null;

  return (
    <div className={`relative overflow-hidden rounded border border-line bg-bg ${className}`}>
      {/* Va antes del mapa en el código para que el Tab llegue primero a las regiones y no a los
          enlaces de atribución del mapa; la posición en pantalla no cambia (es absoluta). */}
      {/* Regiones de ejemplo + área personalizada */}
      {/* Ocupa hasta el borde inferior para limitar la altura del panel; deja pasar los clics al mapa. */}
      <div
        className="pointer-events-none absolute inset-2 z-[500] flex flex-col items-start gap-2"
        // Con un panel encima del lado derecho, las píldoras se acomodan solo en el espacio visible.
        style={{ right: padRight > 40 ? padRight : undefined, left: padLeft > 40 ? padLeft : undefined, top: dock ? padTop - 24 : undefined, bottom: dock ? padBottom : undefined }}
      >
      <div className="pointer-events-auto flex max-w-full flex-wrap gap-1.5">
        <span className="sr-only">{t('map.presets')}</span>
        {/* En la consola (tools) las regiones viven en el panel de controles; aquí quedan los atajos 1–3. */}
        {!tools && features.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === selectedId}
            onClick={() => setAoi({ preset_id: f.id })}
            className={`btn flex items-center gap-1.5 whitespace-nowrap bg-bg/95 px-2 py-1 text-[11.5px] ${f.id === selectedId ? 'btn-on' : ''}`}
          >
            {presetName(f)}
          </button>
        ))}
        {!tools && <button
          type="button"
          aria-expanded={panel}
          aria-controls="custom-area"
          aria-pressed={!!drawn}
          onClick={() => setPanel((p) => !p)}
          {...pinIcon.trigger}
          className={`btn flex items-center gap-1.5 whitespace-nowrap border-dashed bg-bg/95 px-2 py-1 text-[11.5px] ${drawn || panel ? 'btn-on' : ''}`}
        >
          <MapPinPlusIcon ref={pinIcon.ref} size={14} aria-hidden="true" className="flex text-cyan" />
          {t('map.custom')}
        </button>}
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
          style={{ left: `calc(${padLeft - 40}px + (100% - ${padLeft + padRight - 80}px) / 2)`, bottom: dock ? padBottom : undefined }}
          className={`absolute ${tools ? 'bottom-[4.75rem]' : 'bottom-9'} z-[500] flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded border border-cyan/60 bg-bg/95 px-3 py-2 text-[12.5px]`}
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
          style={{ left: padLeft - 24, bottom: dock ? padBottom : undefined }}
          className={`btn absolute ${tools ? 'bottom-[4.75rem]' : 'bottom-4'} z-[500] whitespace-nowrap bg-bg/95 px-3 py-1.5 text-xs`}
        >
          ← {t('map.back')}
        </button>
      )}

      {/* Herramientas del mapa (consola de Experto): flotan solas o van dentro de la franja `dock`. */}
      {tools &&
        (() => {
          const toolbar = (
            <MapToolbar
              inline={!!dock}
              left={`calc(${padLeft - 40}px + (100% - ${padLeft + padRight - 80}px) / 2)`}
              compact={compactTools || !!dock}
              drawMode={drawMode}
              coords={panel}
              view3d={view3d}
              fire={fire}
              onDraw={(m) => (m ? startDraw(m) : setDrawMode(null))}
              onCoords={() => setPanel((v) => !v)}
              on3d={() => setView3d((v) => !v)}
              onFire={() => setFire((v) => !v)}
              onNorth={() => mapRef.current?.easeTo({ bearing: 0, duration: 400 })}
              onFit={() => setFitNonce((n) => n + 1)}
              onZoom={(dir) => (dir > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())}
            />
          );
          return dock ? dock(toolbar) : toolbar;
        })()}

      {children}
    </div>
  );
}
