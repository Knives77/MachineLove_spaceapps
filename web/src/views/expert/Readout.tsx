// Lectura del mes: arriba a la izquierda, sobre el mapa. Solo muestra campos de la respuesta de /calendar
// (estado del mes, k y errores de la calibración). Descargas y el inspector de k se abren desde aquí.
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { Downloads } from '../../components/Downloads';
import { KInspector } from '../../components/KInspector';
import { Reveal, Skeleton, StatusIcon } from '../../components/ui';
import { isZero, shiftMonth, ZERO_ACCENT } from '../../components/YearView';
import { readableOn, statusColor } from '../../lib/color';
import { fmtNum, fmtPct, indexMonths, ymKey } from '../../lib/format';
import { useApp } from '../../state';
import type { CalendarResponse } from '../../types';
import { EASE } from './panels';

const NAV =
  'flex h-6 w-6 items-center justify-center rounded-sm border border-line-2 font-mono text-[13px] leading-none text-mute transition-colors hover:border-cyan hover:text-ink disabled:opacity-30 disabled:hover:border-line-2';

export function Readout() {
  const { t, aoiName, calendar } = useApp();
  const [open, setOpen] = useState<'dl' | 'k' | null>(null);
  const d = calendar.state === 'ok' ? calendar.data : null;
  return (
    <div className="absolute left-2 top-2 z-[600] w-[21rem] max-w-[calc(100%-1rem)]">
      <section aria-label={t('con.kpi.month')} className="hud px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className="kicker min-w-0 flex-1 truncate text-[9.5px] text-cyan">
            <Reveal text={aoiName} />
          </p>
          <Toggle label={t('dl.title')} pressed={open === 'dl'} onClick={() => setOpen(open === 'dl' ? null : 'dl')}>
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
          </Toggle>
          <Toggle label={t('val.title')} pressed={open === 'k'} onClick={() => setOpen(open === 'k' ? null : 'k')}>
            <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />
          </Toggle>
        </div>
        {d ? <Month data={d} /> : <Skeleton className="mt-2 h-14" />}
      </section>
      <AnimatePresence>
        {open && d && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE }}
            style={{ maxHeight: 'calc(100vh - 13rem - var(--dock-h))' }}
            className="hud mt-1.5 overflow-y-auto p-3"
          >
            <h2 className="kicker mb-2 text-[10px]">{t(open === 'dl' ? 'dl.title' : 'val.title')}</h2>
            {open === 'dl' ? (
              <div className="[&_.btn]:w-full [&_.btn]:px-2 [&_.btn]:py-1.5 [&_.btn]:text-[11px] [&_div]:flex-col">
                <Downloads compact />
              </div>
            ) : (
              <KInspector cal={d.calibration} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Month({ data: d }: { data: CalendarResponse }) {
  const { t, lang, mode, palette, selected, setSelected } = useApp();
  const sel = selected ?? d.latest;
  const row = useMemo(() => indexMonths(d.months).get(ymKey(sel.year, sel.month)), [d, sel]);
  const cal = d.calibration;
  const zero = !!row && isZero(row);
  const levelColor = !row || zero ? ZERO_ACCENT : statusColor(palette, row.status);
  const rawValue = mode === 'raw' && row && row.status !== 'no_data';
  const sub =
    !row || row.status === 'no_data'
      ? t('card.noDataSub')
      : mode === 'raw'
        ? t('con.kpi.rawPoints')
        : row.anomaly_ratio !== null && !zero
          ? t('con.kpi.ratio', { r: fmtNum(lang, row.anomaly_ratio, 2) })
          : t('con.kpi.value', { v: fmtNum(lang, row.harmonized ?? 0, 1), m: row.baseline ? fmtNum(lang, row.baseline.median, 1) : '—' });
  return (
    <>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="flex items-center gap-2 font-mono text-[19px] font-semibold uppercase leading-tight" style={{ color: rawValue ? undefined : readableOn(levelColor) }}>
            {rawValue ? (
              fmtNum(lang, row.raw_points)
            ) : (
              <>
                <StatusIcon status={!row ? 'no_data' : zero ? 'zero' : row.status} color={levelColor} size={13} />
                <Reveal text={!row ? t('status.no_data') : zero ? t('level.zeroShort') : t(`status.${row.status}`)} />
              </>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-mute">
            <span className="font-mono uppercase text-ink">{`${t(`month.${sel.month}`).slice(0, 3)} ${sel.year}`}</span> · {sub}
          </p>
        </div>
        <button type="button" className={NAV} disabled={ymKey(sel.year, sel.month) <= ymKey(d.range.start_year, 1)} onClick={() => setSelected(shiftMonth(d, sel, -1))} aria-label={t('card.prevMonth')}>
          ‹
        </button>
        <button type="button" className={NAV} disabled={ymKey(sel.year, sel.month) >= ymKey(d.latest.year, d.latest.month)} onClick={() => setSelected(shiftMonth(d, sel, 1))} aria-label={t('card.nextMonth')}>
          ›
        </button>
      </div>
      <dl className="mt-2 flex gap-3 whitespace-nowrap border-t border-line pt-2 font-mono text-[11px] tabular-nums">
        <Fact label={t('con.kpi.k')} warn={cal.scope === 'country'} title={t('con.kpi.kFrom', { s: t(`scope.${cal.scope}`), n: cal.overlap_months })}>
          <span className="text-cyan">{cal.k.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
        </Fact>
        <Fact label={t('con.kpi.err')} title={t('con.kpi.errAnnual')}>
          {cal.loyo_annual_mape === null ? '—' : `${fmtPct(cal.loyo_annual_mape)} %`}
        </Fact>
        {cal.monthly_mape !== null && <Fact label="">{t('con.kpi.errMonthly', { p: fmtPct(cal.monthly_mape) })}</Fact>}
      </dl>
    </>
  );
}

function Fact({ label, title, warn = false, children }: { label: string; title?: string; warn?: boolean; children: ReactNode }) {
  return (
    <div title={title} className="flex items-baseline gap-1.5">
      {label && <dt className={`text-[9.5px] uppercase tracking-[0.1em] ${warn ? 'text-warn' : 'text-dim'}`}>{label}</dt>}
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function Toggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border transition-colors ${
        pressed ? 'border-cyan bg-cyan-deep text-select' : 'border-line-2 text-mute hover:border-cyan hover:text-ink'
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
