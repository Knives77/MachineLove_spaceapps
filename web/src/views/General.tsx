import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Calendar } from '../components/Calendar';
import { HideCalendarButton } from '../components/CalendarToggle';
import { LevelLegend } from '../components/Legend';
import { MapPanel } from '../components/LazyMapPanel';
import { MonthCard, MonthNotes } from '../components/MonthCard';
import { Timeline } from '../components/Timeline';
import { Skeleton } from '../components/ui';
import { YearPicker, YearView } from '../components/YearView';
import { useApp } from '../state';
import type { CalendarResponse } from '../types';
import { WithCalendar } from './WithCalendar';

/** Ancho del panel deslizante del calendario; el mapa encuadra con este margen a la derecha. */
const DRAWER_W = 400;

export function General() {
  const { t, selected } = useApp();
  // El calendario arranca oculto: el mapa ocupa todo el centro. Se abre como panel deslizante
  // encima del lado derecho del mapa, y el mapa recentra la región en el espacio que queda visible.
  const [calOpen, setCalOpen] = useState(false);
  const openBtn = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Foco: al abrir va al panel; al cerrar regresa al botón que lo abrió.
  useEffect(() => {
    if (calOpen) drawer.current?.focus();
    else if (wasOpen.current) openBtn.current?.focus();
    wasOpen.current = calOpen;
  }, [calOpen]);

  const monthTag = selected ? ` · ${t(`month.${selected.month}`).slice(0, 3)} ${selected.year}` : '';

  return (
    // En pantallas anchas la vista llena exactamente el alto disponible: nada se desplaza.
    // Columna izquierda (tarjeta del mes) a todo lo alto; a la derecha el mapa y, debajo, la línea de tiempo.
    <div className="grid gap-3 p-3 xl:h-full xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)_auto]">
      {/* Columna izquierda: tarjetas de altura automática (h-fit), sin caja recortada ni scroll forzado.
          1) estado del mes; 2) notas técnicas en acordeón (cerrado ocupa una línea). */}
      <div className="flex min-h-0 flex-col gap-3 xl:row-span-2">
        <section className="panel h-fit p-4">
          <h1 className="text-lg font-semibold leading-snug">{t('gen.title')}</h1>
          <p className="mb-4 text-sm text-mute">{t('gen.sub')}</p>
          <WithCalendar skeleton={<Skeleton className="h-56" />}>{(d) => <MonthCard data={d} />}</WithCalendar>
        </section>
        <WithCalendar skeleton={<Skeleton className="h-10" />}>{(d) => <MonthNotes data={d} />}</WithCalendar>
      </div>

      <div className="flex min-h-[420px] flex-col xl:min-h-0">
        <MapPanel className="min-h-[420px] flex-1 xl:min-h-0" padRight={calOpen ? DRAWER_W + 10 : 40}>
          {/* Botón flotante para abrir el calendario; sale con un fundido mientras el panel está abierto. */}
          <AnimatePresence>
            {!calOpen && (
              <motion.button
                key="cal-open"
                ref={openBtn}
                type="button"
                layout
                aria-expanded={false}
                aria-controls="cal-drawer"
                onClick={() => setCalOpen(true)}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="btn absolute right-2 top-2 z-[600] flex items-center gap-2 bg-bg/90 px-3 py-1.5 text-[13px] backdrop-blur"
              >
                <CalendarGlyph />
                <motion.span layout="position">
                  {t('cal.button')}
                  <span className="text-mute">{monthTag}</span>
                </motion.span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Panel flotante encima del mapa: el mapa nunca cambia de tamaño al abrir o cerrar.
              Entra y sale con desplazamiento horizontal + opacidad. */}
          <AnimatePresence>
            {calOpen && (
              <motion.aside
                key="cal-drawer"
                id="cal-drawer"
                ref={drawer}
                tabIndex={-1}
                aria-label={t('cal.title')}
                onKeyDown={(e) => e.key === 'Escape' && setCalOpen(false)}
                initial={{ x: DRAWER_W + 16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: DRAWER_W + 16, opacity: 0 }}
                // Curva limpia sin rebote, sincronizada con el vuelo del mapa (0.7 s).
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: DRAWER_W }}
                className="absolute bottom-6 right-2 top-2 z-[700] max-w-[calc(100%-1rem)] outline-none"
              >
                <WithCalendar skeleton={<Skeleton className="h-full" />}>
                  {(d) => <CalendarPanel data={d} onHide={() => setCalOpen(false)} />}
                </WithCalendar>
              </motion.aside>
            )}
          </AnimatePresence>
        </MapPanel>
      </div>

      <div className="xl:col-start-2">
        <WithCalendar skeleton={<Skeleton className="h-20" />}>{(d) => <Timeline data={d} />}</WithCalendar>
      </div>
    </div>
  );
}

/** Icono de calendario (trazo Lucide, ISC), estático. */
function CalendarGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/**
 * Panel derecho: por defecto los 12 meses de un año (el último con datos). La matriz completa
 * de todos los años se abre bajo demanda.
 */
function CalendarPanel({ data: d, onHide }: { data: CalendarResponse; onHide: () => void }) {
  const { t, mode } = useApp();
  const [history, setHistory] = useState(false);
  const span = { a: d.range.start_year, b: d.range.end_year };
  return (
    <section
      id="cal-panel"
      className="flex h-full flex-col rounded border border-line bg-drawer/90 shadow-2xl shadow-black/60 backdrop-blur-md"
    >
      <header className="shrink-0 px-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="heading truncate text-[12px] leading-[22px]">{t('cal.title')}</h2>
          <HideCalendarButton onHide={onHide} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink">
          <span aria-hidden="true" className="text-cyan">→</span>
          {t('cal.hint')}
        </p>
        {history ? (
          <p className="kicker mt-2 normal-case tracking-normal">
            {t('cal.sub', {
              n: d.range.end_year - d.range.start_year + 1,
              unit: mode === 'harmonized' ? t('unit.cellDays') : t('unit.points'),
            })}
          </p>
        ) : (
          <div className="mt-2.5">
            <YearPicker data={d} />
          </div>
        )}
      </header>

      <div data-cal-scroll className="min-h-0 flex-1 overflow-y-auto px-3 pb-1 pt-1">
        {history ? <Calendar data={d} stickyHeader variant="levels" /> : <YearView data={d} />}
      </div>

      <div className="shrink-0 px-4 pb-2">
        <button
          type="button"
          aria-expanded={history}
          onClick={() => setHistory((h) => !h)}
          className="font-mono text-xs text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
        >
          {history ? `‹ ${t('cal.backYear')}` : `${t('cal.history', span)} ›`}
        </button>
      </div>

      {/* Misma leyenda en la vista por año y en la comparativa histórica. */}
      <div className="shrink-0 border-t border-line px-4 py-2.5">
        <LevelLegend />
      </div>
    </section>
  );
}
