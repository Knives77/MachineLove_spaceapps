// Panel derecho de la consola.
import { useMemo, useState } from 'react';
import { CalendarTiles, type ColorBy } from '../../components/CalendarTiles';
import { MonthSeries } from '../../components/MonthSeries';
import { Segmented } from '../../components/ui';
import { YearBars } from '../../components/YearBars';
import { indexMonths, ymKey } from '../../lib/format';
import { useApp } from '../../state';
import type { CalendarResponse } from '../../types';
import { Section } from './panels';

/** Panel derecho: barras anuales alineadas con el calendario en mosaicos, avisos y serie del mes. */
export function CalendarSide({ data: d }: { data: CalendarResponse }) {
  const { t, mode, selected } = useApp();
  const [colorBy, setColorBy] = useState<ColorBy>('value');
  const sel = selected ?? d.latest;
  const row = useMemo(() => indexMonths(d.months).get(ymKey(sel.year, sel.month)), [d, sel]);
  return (
    <>
      <section className="px-3 pt-2.5">
        <div className="pl-[calc(1.1rem+3px)]">
          <YearBars data={d} height={50} axis={false} />
        </div>
        <CalendarTiles
          data={d}
          colorBy={colorBy}
          legendRight={
            mode === 'harmonized' && (
              <Segmented<ColorBy>
                size="sm"
                label={t('con.colorBy')}
                value={colorBy}
                onChange={setColorBy}
                options={[
                  { value: 'value', label: t('con.colorBy.value') },
                  { value: 'level', label: t('con.colorBy.level') },
                ]}
              />
            )
          }
        />
      </section>

      {row && row.flags.length > 0 && (
        <ul className="space-y-0.5 px-3 pt-2 text-[11.5px] leading-snug text-mute">
          {row.flags.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 bg-cyan" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%)' }} />
              {t(`flag.${f}`)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 border-t border-line">
        <Section title={t('con.series')} open={false}>
          <MonthSeries data={d} month={sel.month} height={110} />
        </Section>
      </div>
    </>
  );
}
