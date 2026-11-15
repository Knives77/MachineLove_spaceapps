// Consola de Experto (vista inicial). Este archivo solo arma la pantalla; las piezas viven al lado:
//   panels.tsx  panel flotante, sección, botón     Controls.tsx  panel izquierdo     Kpis.tsx  indicadores
//   CalendarSide.tsx  panel derecho               hooks.ts  paneles abiertos y ancho de pantalla
import { AnimatePresence, motion } from 'motion/react';
import { MapPanel } from '../../components/LazyMapPanel';
import { TopBar } from '../../components/TopBar';
import { Skeleton } from '../../components/ui';
import { useApp } from '../../state';
import { WithCalendar } from '../WithCalendar';
import { CalendarSide } from './CalendarSide';
import { Controls } from './Controls';
import { usePanel, useWide } from './hooks';
import { EASE, FloatPanel, StripButton } from './panels';

/**
 * Consola de Experto (vista inicial): el mapa 3D ocupa toda la ventana y encima flotan dos paneles
 * que se pueden ocultar (con animación): controles a la izquierda (región, datos, indicadores, "Simular fin de MODIS",
 * descargas, validación; cada sección se pliega) y el calendario a la derecha.
 * Todo sale de la respuesta de `/calendar`; aquí no se calcula nada.
 */
export function Expert() {
  const { t } = useApp();
  const wide = useWide();
  const [left, setLeft] = usePanel('ml.exp.left');
  const [right, setRight] = usePanel('ml.exp.right');
  const LW = wide ? 320 : 288;
  const RW = wide ? 560 : 448;

  return (
    <div className="relative h-full">
      {/* El mapa llena toda la vista; los paneles flotan encima y solo cambian el encuadre. */}
      <div className="absolute inset-0">
        <MapPanel
          tools
          compactTools={!wide && left && right}
          padLeft={left ? LW + 24 : 60}
          padRight={right ? RW + 24 : 60}
          className="h-full rounded-none border-0"
        />
      </div>

      {/* Franja flotante: calendario, idioma, accesibilidad y vista (sin barra superior). */}
      <div className="absolute right-2 top-2 z-[800]">
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

      {/* Con el panel oculto queda un botón igual a los de la franja, arriba a la izquierda. */}
      <AnimatePresence>
        {!left && (
          <motion.div
            key="controls-chip"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="hud absolute left-2 top-2 z-[600] p-1"
          >
            <StripButton label={t('con.panel.controls')} pressed={false} onClick={() => setLeft(true)}>
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </StripButton>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {left && (
          <FloatPanel key="left" side="left" width={LW} title={t('con.panel.controls')} onHide={() => setLeft(false)}>
            <Controls />
          </FloatPanel>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {right && (
          <FloatPanel key="right" side="right" width={RW} title={t('cal.title')} onHide={() => setRight(false)}>
            <WithCalendar skeleton={<Skeleton className="m-3 h-72" />}>{(d) => <CalendarSide data={d} />}</WithCalendar>
          </FloatPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
