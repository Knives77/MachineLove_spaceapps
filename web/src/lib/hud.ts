import { useSyncExternalStore } from 'react';

/**
 * Telemetría de la barra inferior (coordenadas bajo el cursor, latencia de la última consulta).
 * Almacén fuera de React: mover el cursor sobre el mapa no vuelve a pintar las vistas.
 */
export interface Hud {
  cursor: { lat: number; lon: number } | null;
  /** Milisegundos de la última petición de calendario a la API (null con mocks o sin medir). */
  latencyMs: number | null;
  /** Hotspots del mes elegido pintados en el mapa (solo Experto). */
  hotspots: { state: 'off' | 'loading' | 'ok' | 'too_many' | 'error'; total: number; fixed: number } | null;
}

let state: Hud = { cursor: null, latencyMs: null, hotspots: null };
const subs = new Set<() => void>();

export function setHud(patch: Partial<Hud>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useHud(): Hud {
  return useSyncExternalStore(subscribe, () => state);
}
