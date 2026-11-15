import { useSyncExternalStore } from 'react';

/**
 * Telemetría de la barra inferior (coordenadas bajo el cursor, latencia de la última consulta).
 * Almacén fuera de React: mover el cursor sobre el mapa no vuelve a pintar las vistas.
 */
export interface Hud {
  cursor: { lat: number; lon: number } | null;
  /** Milisegundos de la última petición de calendario a la API (null con mocks o sin medir). */
  latencyMs: number | null;
}

let state: Hud = { cursor: null, latencyMs: null };
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
