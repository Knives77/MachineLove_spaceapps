import { useMemo, useState, type ReactNode } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CalendarTiles, type ColorBy } from '../components/CalendarTiles';
import { Downloads } from '../components/Downloads';
import { KInspector } from '../components/KInspector';
import { MapPanel } from '../components/LazyMapPanel';
import { ModisSwitch } from '../components/ModisSwitch';
import { MonthSeries } from '../components/MonthSeries';
import { Segmented, Skeleton, StatusIcon } from '../components/ui';
import { YearBars } from '../components/YearBars';
import { isZero, shiftMonth, ZERO_ACCENT } from '../components/YearView';
import { readableOn, statusColor } from '../lib/color';
import { fmtNum, fmtPct, indexMonths, ymKey } from '../lib/format';
import { useApp } from '../state';
import type { CalendarResponse, Mode } from '../types';
import { WithCalendar } from './WithCalendar';

const NAV =
  'flex h-5 w-5 items-center justify-center rounded-sm border border-line-2 font-mono text-[12px] leading-none text-mute hover:border-cyan hover:text-ink disabled:opacity-30';

/**
 * Consola de Experto (vista inicial): 60 % mapa 3D con herramientas flotantes, 40 % panel analítico
 * en tres zonas: (A) interruptor maestro crudo/armonizado, (B) 3 indicadores, (C) barras anuales +
 * calendario en mosaicos, y debajo "Simular fin de MODIS", descargas y el detalle de validación.
 * Todo sale de la respuesta de `/calendar`; aquí no se calcula nada.
 */
export function Expert() {
  const { t, mode, setMode, aoiName } = useApp();
  return (
    <div className="grid h-full grid-cols-[minmax(0,3fr)_minmax(460px,2fr)]">
      <MapPanel tools className="h-full rounded-none border-0" />

      <aside className="flex min-h-0 flex-col border-l border-line bg-drawer">
        {/* A · Interruptor maestro */}
        <header className="shrink-0 border-b border-line px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="kicker truncate text-[10px] text-cyan">{aoiName}</p>
              <h1 className="heading mt-0.5 truncate text-[12px]">{t('cal.title')}</h1>
            </div>
            <Segmented<Mode>
              label={t('con.master')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'harmonized', label: t('mode.harmonized') },
                { value: 'raw', label: t('mode.raw') },
              ]}
            />
          </div>
          {mode === 'raw' && (
            <p role="note" className="mt-2 flex gap-2 rounded-sm border border-warn/50 bg-warn/5 px-2.5 py-1.5 text-[11.5px] leading-snug text-warn">
              <span aria-hidden="true" className="font-mono">!</span>
              {t('con.rawWarn')}
            </p>
          )}
        </header>

        <WithCalendar skeleton={<Skeleton className="m-4 h-[420px]" />}>{(d) => <Analytics data={d} />}</WithCalendar>
      </aside>
    </div>
  );
}

function Analytics({ data: d }: { data: CalendarResponse }) {
  const { t, lang, mode, palette, selected, setSelected } = useApp();
  const [colorBy, setColorBy] = useState<ColorBy>('value');
  const sel = selected ?? d.latest;
  const row = useMemo(() => indexMonths(d.months).get(ymKey(sel.year, sel.month)), [d, sel]);
  const cal = d.calibration;
  const zero = !!row && isZero(row);
  const levelColor = !row || zero ? ZERO_ACCENT : statusColor(palette, row.status);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
      {/* B · Tres indicadores del área y del mes elegido */}
      <section className="grid shrink-0 grid-cols-3 gap-2 px-4 pt-3">
        <Kpi
          active
          label={t('con.kpi.month')}
          right={
            <span className="flex items-center gap-1">
              <button
                type="button"
                className={NAV}
                disabled={ymKey(sel.year, sel.month) <= ymKey(d.range.start_year, 1)}
                onClick={() => setSelected(shiftMonth(d, sel, -1))}
                aria-label={t('card.prevMonth')}
              >
                ‹
              </button>
              <button
                type="button"
                className={NAV}
                disabled={ymKey(sel.year, sel.month) >= ymKey(d.latest.year, d.latest.month)}
                onClick={() => setSelected(shiftMonth(d, sel, 1))}
                aria-label={t('card.nextMonth')}
              >
                ›
              </button>
            </span>
          }
          sub={
            !row || row.status === 'no_data'
              ? t('card.noDataSub')
              : mode === 'raw'
                ? t('con.kpi.rawPoints')
                : row.anomaly_ratio !== null && !zero
                  ? t('con.kpi.ratio', { r: fmtNum(lang, row.anomaly_ratio, 2) })
                  : t('con.kpi.value', {
                      v: fmtNum(lang, row.harmonized ?? 0, 1),
                      m: row.baseline ? fmtNum(lang, row.baseline.median, 1) : '—',
                    })
          }
        >
          <span className="kicker block text-[10px] text-ink" aria-live="polite">
            {t(`month.${sel.month}`).slice(0, 3)} {sel.year}
          </span>
          {mode === 'raw' && row && row.status !== 'no_data' ? (
            <AnimatedNumber value={row.raw_points} format={(v) => fmtNum(lang, Math.round(v))} />
          ) : (
            <span className="flex items-center gap-1.5 text-[15px] uppercase leading-[1.15]" style={{ color: readableOn(levelColor) }}>
              <StatusIcon status={!row ? 'no_data' : zero ? 'zero' : row.status} color={levelColor} size={12} />
              {!row ? t('status.no_data') : zero ? t('level.zeroShort') : t(`status.${row.status}`)}
            </span>
          )}
        </Kpi>

        <Kpi
          label={t('con.kpi.k')}
          sub={t('con.kpi.kFrom', { s: t(`scope.${cal.scope}`), n: cal.overlap_months })}
          warn={cal.scope === 'country'}
        >
          <span className="text-cyan">
            <AnimatedNumber value={cal.k} format={(v) => v.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} />
          </span>
        </Kpi>

        <Kpi
          label={t('con.kpi.err')}
          sub={`${t('con.kpi.errAnnual')} · ${cal.monthly_mape === null ? '—' : t('con.kpi.errMonthly', { p: fmtPct(cal.monthly_mape) })}`}
        >
          {cal.loyo_annual_mape === null ? '—' : <>{fmtPct(cal.loyo_annual_mape)} %</>}
        </Kpi>
      </section>

      {/* C · Barras anuales alineadas con las columnas del calendario */}
      <section className="shrink-0 px-4 pt-3">
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
        <ul className="shrink-0 space-y-0.5 px-4 pt-2.5 text-[11.5px] leading-snug text-mute">
          {row.flags.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 bg-cyan" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%)' }} />
              {t(`flag.${f}`)}
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3 shrink-0 border-t border-line px-4 py-3">
        <summary className="kicker cursor-pointer select-none text-[10.5px] hover:text-ink">{t('con.details')}</summary>
        <div className="mt-3 space-y-4">
          <KInspector cal={cal} />
          <MonthSeries data={d} month={sel.month} height={120} />
        </div>
      </details>
      </div>

      {/* Pie fijo del panel: siempre a la vista para la demo. */}
      <section className="shrink-0 space-y-2 border-t border-line bg-drawer px-4 py-2.5 [&_.btn]:gap-1.5 [&_.btn]:px-2 [&_.btn]:py-1 [&_.btn]:text-[10.5px]">
        <ModisSwitch k={cal.k} />
        <Downloads compact />
      </section>
    </>
  );
}

/** Indicador: etiqueta técnica, cifra grande en monoespaciada tabular y una línea de contexto. */
function Kpi({
  label,
  sub,
  right,
  active = false,
  warn = false,
  children,
}: {
  label: string;
  sub: string;
  right?: ReactNode;
  active?: boolean;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`bracket flex min-w-0 flex-col px-2.5 py-2 ${active ? 'bracket-on' : ''}`}>
      <div className="flex min-h-6 items-start justify-between gap-1">
        <p className="kicker text-[9.5px] leading-tight tracking-[0.1em]">{label}</p>
        {right}
      </div>
      <p className="mt-1 font-mono text-[24px] font-semibold leading-none">{children}</p>
      <p className={`mt-1.5 text-[10.5px] leading-snug ${warn ? 'text-warn' : 'text-mute'}`}>{sub}</p>
    </div>
  );
}
