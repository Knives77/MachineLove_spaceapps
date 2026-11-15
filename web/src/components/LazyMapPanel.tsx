import { lazy, Suspense, type ComponentProps } from 'react';

// MapLibre pesa ~1 MB: se carga en su propio archivo, en paralelo, para que la interfaz pinte antes.
const MapPanelImpl = lazy(() => import('./map/MapPanel').then((m) => ({ default: m.MapPanel })));

/** El mapa, cargado bajo demanda. Mientras llega, la caja ya ocupa su lugar y muestra los paneles flotantes. */
export function MapPanel(props: ComponentProps<typeof MapPanelImpl>) {
  return (
    <Suspense
      fallback={
        <div className={`relative overflow-hidden rounded border border-line bg-bg ${props.className ?? ''}`}>{props.children}</div>
      }
    >
      <MapPanelImpl {...props} />
    </Suspense>
  );
}
