import { Calendar, useScaleMax } from '../components/Calendar';
import { Legend } from '../components/Legend';
import { MapPanel } from '../components/MapPanel';
import { MonthCard } from '../components/MonthCard';
import { Timeline } from '../components/Timeline';
import { Skeleton } from '../components/ui';
import { YearBars } from '../components/YearBars';
import { useApp } from '../state';
import type { CalendarResponse } from '../types';
import { WithCalendar } from './WithCalendar';

export function General() {
  const { t, mode } = useApp();
  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(400px,460px)]">
      <section className="panel flex flex-col">
        <div className="border-b border-line px-4 py-4">
          <h1 className="text-[26px] font-semibold leading-tight">{t('gen.title')}</h1>
          <p className="mt-1 text-[15px] text-mute">{t('gen.sub')}</p>
        </div>
        <div className="border-b border-line px-4 py-4">
          <WithCalendar skeleton={<Skeleton className="h-64" />}>{(d) => <MonthCard data={d} />}</WithCalendar>
        </div>
        <div className="px-4 py-4">
          <WithCalendar skeleton={<Skeleton className="h-48" />}>{(d) => <LegendFor data={d} />}</WithCalendar>
        </div>
      </section>

      <div className="flex min-h-[520px] flex-col gap-3">
        <MapPanel className="min-h-[340px] flex-1" />
        <section className="panel px-4 pb-2 pt-3">
          <WithCalendar skeleton={<Skeleton className="h-36" />}>{(d) => <YearBars data={d} height={96} />}</WithCalendar>
        </section>
      </div>

      <WithCalendar skeleton={<Skeleton className="h-[600px]" />}>
        {(d) => (
          <section className="panel">
            <header className="px-4 pb-2 pt-3">
              <h2 className="heading">{t('cal.title')}</h2>
              <p className="kicker mt-1 normal-case tracking-normal">
                {t('cal.sub', {
                  n: d.range.end_year - d.range.start_year + 1,
                  unit: mode === 'harmonized' ? t('unit.cellDays') : t('unit.points'),
                })}
              </p>
            </header>
            <div className="px-3 pb-3">
              <Calendar data={d} />
            </div>
          </section>
        )}
      </WithCalendar>

      <div className="xl:col-span-3">
        <WithCalendar skeleton={<Skeleton className="h-20" />}>{(d) => <Timeline data={d} />}</WithCalendar>
      </div>
    </div>
  );
}

function LegendFor({ data }: { data: CalendarResponse }) {
  const { mode } = useApp();
  const max = useScaleMax(data, mode);
  return <Legend max={max} />;
}
