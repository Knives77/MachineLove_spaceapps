// Los tres indicadores del área y del mes elegido. Solo muestran campos de la respuesta de /calendar.
import { useMemo, type ReactNode } from 'react';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { Reveal, StatusIcon } from '../../components/ui';
import { isZero, shiftMonth, ZERO_ACCENT } from '../../components/YearView';
import { readableOn, statusColor } from '../../lib/color';
import { fmtNum, fmtPct, indexMonths, ymKey } from '../../lib/format';
import { useApp } from '../../state';
import type { CalendarResponse } from '../../types';

const NAV =
  'flex h-5 w-5 items-center justify-center rounded-sm border border-line-2 font-mono text-[12px] leading-none text-mute hover:border-cyan hover:text-ink disabled:opacity-30';

/** Tres indicadores del área y del mes elegido. */
export function Kpis({ data: d }: { data: CalendarResponse }) {
  const { t, lang, mode, palette, selected, setSelected } = useApp();
  const sel = selected ?? d.latest;
  const row = useMemo(() => indexMonths(d.months).get(ymKey(sel.year, sel.month)), [d, sel]);
  const cal = d.calibration;
  const zero = !!row && isZero(row);
  const levelColor = !row || zero ? ZERO_ACCENT : statusColor(palette, row.status);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Kpi
        active
        wide
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
          <Reveal text={`${t(`month.${sel.month}`).slice(0, 3)} ${sel.year}`} />
        </span>
        {mode === 'raw' && row && row.status !== 'no_data' ? (
          <AnimatedNumber value={row.raw_points} format={(v) => fmtNum(lang, Math.round(v))} />
        ) : (
          <span className="flex items-center gap-1.5 text-[15px] uppercase leading-[1.15]" style={{ color: readableOn(levelColor) }}>
            <StatusIcon status={!row ? 'no_data' : zero ? 'zero' : row.status} color={levelColor} size={12} />
            <Reveal text={!row ? t('status.no_data') : zero ? t('level.zeroShort') : t(`status.${row.status}`)} />
          </span>
        )}
      </Kpi>

      <Kpi label={t('con.kpi.k')} sub={t('con.kpi.kFrom', { s: t(`scope.${cal.scope}`), n: cal.overlap_months })} warn={cal.scope === 'country'}>
        <span className="text-cyan">
          <AnimatedNumber
            value={cal.k}
            format={(v) => v.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          />
        </span>
      </Kpi>

      <Kpi
        label={t('con.kpi.err')}
        sub={`${t('con.kpi.errAnnual')} · ${cal.monthly_mape === null ? '—' : t('con.kpi.errMonthly', { p: fmtPct(cal.monthly_mape) })}`}
      >
        {cal.loyo_annual_mape === null ? '—' : <>{fmtPct(cal.loyo_annual_mape)} %</>}
      </Kpi>
    </div>
  );
}

/** Indicador: etiqueta técnica, cifra grande en monoespaciada tabular y una línea de contexto. */
function Kpi({
  label,
  sub,
  right,
  active = false,
  wide = false,
  warn = false,
  children,
}: {
  label: string;
  sub: string;
  right?: ReactNode;
  active?: boolean;
  wide?: boolean;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`bracket flex min-w-0 flex-col px-2.5 py-2 ${active ? 'bracket-on' : ''} ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="kicker text-[9.5px] leading-tight tracking-[0.1em]">{label}</p>
        {right}
      </div>
      <p className="mt-1 font-mono text-[22px] font-semibold leading-none">{children}</p>
      <p className={`mt-1.5 text-[10.5px] leading-snug ${warn ? 'text-warn' : 'text-mute'}`}>{sub}</p>
    </div>
  );
}
