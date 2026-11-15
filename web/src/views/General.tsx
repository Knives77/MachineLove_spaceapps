import { useState } from 'react';
import { Calendar } from '../components/Calendar';
import { CalendarRail, HideCalendarButton, gridCols, useCalOpen } from '../components/CalendarToggle';
import { LevelLegend } from '../components/Legend';
import { MapPanel } from '../components/MapPanel';
import { MonthCard } from '../components/MonthCard';
import { Timeline } from '../components/Timeline';
import { Skeleton } from '../components/ui';
import { YearBars } from '../components/YearBars';
import { YearPicker, YearView } from '../components/YearView';
import { useApp } from '../state';
import type { CalendarResponse } from '../types';
import { WithCalendar } from './WithCalendar';

export function General() {
  const { t } = useApp();
  // El panel del calendario se puede esconder para dar más espacio al mapa.
  const [calOpen, setCalOpen] = useCalOpen();
  return (
    <div className={`grid gap-3 p-3 ${gridCols(calOpen)}`}>
      {/* En pantallas anchas los paneles laterales caben en la ventana; si no alcanza,
          el contenido hace scroll por dentro y lo de abajo (la leyenda) queda siempre visible. */}
      <section className="panel flex flex-col xl:sticky xl:top-3 xl:max-h-[calc(100dvh-5.5rem)] xl:self-start">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <h1 className="text-[22px] font-semibold leading-tight">{t('gen.title')}</h1>
          <p className="mt-0.5 text-[14px] text-mute">{t('gen.sub')}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <WithCalendar skeleton={<Skeleton className="h-64" />}>{(d) => <MonthCard data={d} />}</WithCalendar>
        </div>
      </section>

      <div className="flex min-h-[520px] flex-col gap-3">
        <MapPanel className="min-h-[340px] flex-1" />
        <section className="panel px-4 pb-2 pt-3">
          <WithCalendar skeleton={<Skeleton className="h-36" />}>{(d) => <YearBars data={d} height={96} />}</WithCalendar>
        </section>
      </div>

      {calOpen ? (
        <WithCalendar skeleton={<Skeleton className="h-[600px]" />}>
          {(d) => <CalendarPanel data={d} onHide={() => setCalOpen(false)} />}
        </WithCalendar>
      ) : (
        <CalendarRail onShow={() => setCalOpen(true)} />
      )}

      <div className="xl:col-span-3">
        <WithCalendar skeleton={<Skeleton className="h-20" />}>{(d) => <Timeline data={d} />}</WithCalendar>
      </div>
    </div>
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
    <section id="cal-panel" className="panel flex flex-col xl:sticky xl:top-3 xl:max-h-[calc(100dvh-5.5rem)] xl:self-start">
      <header className="shrink-0 px-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="heading">{t('cal.title')}</h2>
          <HideCalendarButton onHide={onHide} />
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink">
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

      <div data-cal-scroll className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1">
        {history ? <Calendar data={d} stickyHeader variant="levels" /> : <YearView data={d} />}
      </div>

      <div className="shrink-0 px-4 pb-2">
        <button
          type="button"
          aria-expanded={history}
          onClick={() => setHistory((h) => !h)}
          className="font-mono text-[11.5px] text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
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
