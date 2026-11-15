// Consola de Experto (vista inicial). Este archivo solo arma la pantalla; las piezas viven al lado:
//   TimeConsole.tsx  franja inferior (región, modo, herramientas, pistas de tiempo)   Regions.tsx  fichas de región
//   Readout.tsx  lectura del mes, descargas e inspector de k    CalendarSide.tsx  panel derecho
//   panels.tsx  panel flotante, sección, botón                  hooks.ts  panel abierto y ancho de pantalla
import { AnimatePresence } from 'motion/react';
import { useState, type CSSProperties } from 'react';
import { MapPanel } from '../../components/LazyMapPanel';
import { CoordSearch } from '../../components/CoordSearch';
import { TopBar } from '../../components/TopBar';
import { Skeleton } from '../../components/ui';
import { useApp } from '../../state';
import { WithCalendar } from '../WithCalendar';
import { CalendarSide } from './CalendarSide';
import { usePanel, useWide } from './hooks';
import { FloatPanel, StripButton } from './panels';
import { Readout } from './Readout';
import { TimeConsole } from './TimeConsole';

/**
 * Consola de Experto (vista inicial): el mapa 3D ocupa toda la ventana. Abajo, la consola de tiempo
 * (el tiempo 2000–2026 como control principal, con región, modo y herramientas del mapa); arriba a la
 * izquierda, la lectura del mes; a la derecha, el calendario (se oculta).
 * Todo sale de la respuesta de `/calendar`; aquí no se calcula nada.
 */
export function Expert() {
  const { t } = useApp();
  const wide = useWide();
  const [right, setRight] = usePanel('ml.exp.right');
  const RW = wide ? 560 : 448;
  // Alto de la consola de tiempo (lo mide ella misma): el mapa, sus créditos y el calendario quedan por encima.
  const [dockH, setDockH] = useState(190);

  return (
    <div className="has-dock relative h-full" style={{ '--dock-h': `${dockH}px` } as CSSProperties}>
      {/* El mapa llena toda la vista; la consola y los paneles flotan encima y solo cambian el encuadre. */}
      <div className="absolute inset-0">
        <MapPanel
          tools
          padLeft={60}
          padRight={right ? RW + 24 : 60}
          padTop={150}
          padBottom={dockH + 30}
          dock={(toolbar) => <TimeConsole onHeight={setDockH} toolbar={toolbar} />}
          className="h-full rounded-none border-0"
        />
      </div>

      {/* Lectura del mes (arriba a la izquierda). */}
      <Readout />

      {/* Franja flotante: buscador por coordenadas, calendario, idioma, accesibilidad y vista (sin barra superior).
          Empieza a la derecha de la lectura del mes (21.5rem): en pantallas angostas (proyector a 1024 px) el
          buscador se encoge en vez de tapar los botones de la lectura. La franja deja pasar los clics al mapa. */}
      <div className="pointer-events-none absolute left-[22rem] right-2 top-2 z-[800] flex items-start justify-end gap-2 [&>*]:pointer-events-auto">
        <CoordSearch />
        <TopBar
          floating
          lead={
            <>
              <StripButton label={t('cal.button')} pressed={right} onClick={() => setRight(!right)}>
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </StripButton>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-line-2" />
            </>
          }
        />
      </div>

      <AnimatePresence>
        {right && (
          <FloatPanel key="right" side="right" width={RW} bottom={dockH + 28} title={t('cal.title')} onHide={() => setRight(false)}>
            <WithCalendar skeleton={<Skeleton className="m-3 h-72" />}>{(d) => <CalendarSide data={d} />}</WithCalendar>
          </FloatPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
