import { useEffect, useMemo } from 'react';
import { statusColor } from '../lib/color';
import { fmtNum, fmtPct, indexMonths, ymKey } from '../lib/format';
import { showsRawToggle, useApp } from '../state';
import type { Baseline, CalendarResponse, Status } from '../types';
import { BadgeAlertIcon } from './icons/badge-alert';
import { useIconAnim } from './icons/useIconAnim';
import { StatusIcon } from './ui';
import { isZero, NAV_BTN, shiftMonth, ZERO_ACCENT } from './YearView';

/**
 * Tarjeta 1 · estado del mes elegido (por defecto `latest`): mes y región, nivel, una línea de dato
 * y la barra de 4 tramos. Las notas técnicas van aparte, en `MonthNotes`. Solo campos de la API.
 */
export function MonthCard({ data }: { data: CalendarResponse }) {
  const { t, lang, palette, selected, setSelected, aoiName, tab } = useApp();
  const sel = selected ?? data.latest;
  const row = useMemo(() => indexMonths(data.months).get(ymKey(sel.year, sel.month)), [data, sel]);

  return (
    <div aria-live="polite">
      {/* Cambiar de mes desde aquí también mueve el selector de año del calendario. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={NAV_BTN}
          disabled={ymKey(sel.year, sel.month) <= ymKey(data.range.start_year, 1)}
          onClick={() => setSelected(shiftMonth(data, sel, -1))}
          aria-label={t('card.prevMonth')}
          title={t('card.prevMonth')}
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center text-xs font-semibold uppercase tracking-wider text-cyan">
          {t(`month.${sel.month}`)} {sel.year}
          <span className="block text-mute">{aoiName}</span>
        </p>
        <button
          type="button"
          className={NAV_BTN}
          disabled={ymKey(sel.year, sel.month) >= ymKey(data.latest.year, data.latest.month)}
          onClick={() => setSelected(shiftMonth(data, sel, 1))}
          aria-label={t('card.nextMonth')}
          title={t('card.nextMonth')}
        >
          ›
        </button>
      </div>

      {!row && <p className="mt-3 text-mute">{t('card.missing')}</p>}

      {row && (
        <>
          <div className="mt-3 flex items-center gap-2">
            {/* 0 celdas-día = "sin incendios", con indicador neutro (no el color de "Normal"). */}
            <StatusIcon status={isZero(row) ? 'zero' : row.status} color={isZero(row) ? ZERO_ACCENT : statusColor(palette, row.status)} size={10} />
            <p className={`text-xl font-semibold uppercase leading-none tracking-tight ${isZero(row) ? 'text-mute' : 'text-ink'}`}>
              {isZero(row) ? t('level.zero') : t(`status.${row.status}`)}
            </p>
          </div>

          {row.status === 'no_data' ? (
            <p className="mt-3 text-[14px] text-mute">
              {t('card.noDataTitle')} {t('card.noDataSub')}
            </p>
          ) : (
            <>
              {/* Una sola línea de métrica (el nivel ya está arriba; sin frases que lo repitan). */}
              <p className="mt-2 text-sm text-ink">
                {t('card.metric', {
                  v: fmtNum(lang, row.harmonized ?? 0, 1),
                  unit: t('unit.cellDays'),
                  m: row.baseline ? fmtNum(lang, row.baseline.median, 1) : '—',
                })}
                {row.anomaly_ratio !== null && !isZero(row) && (
                  <span className="text-mute"> · {fmtNum(lang, row.anomaly_ratio, 1)}×</span>
                )}
              </p>
              {row.status === 'insufficient_baseline' && <p className="mt-1 text-[12.5px] text-mute">{t('card.insufficient')}</p>}
              {/* Fuente y puntos crudos solo en las vistas técnicas. */}
              {showsRawToggle(tab) && (
                <p className="mt-0.5 text-xs text-dim">
                  {t('card.raw', { v: fmtNum(lang, row.raw_points) })} · {t('card.source')}: {t(`source.${row.source ?? 'null'}`)}
                </p>
              )}
            </>
          )}

          <LevelBar baseline={row.baseline} value={row.harmonized} status={row.status} />

        </>
      )}
    </div>
  );

  function LevelBar({ baseline, value, status }: { baseline: Baseline | null; value: number | null; status: Status }) {
    // 4 tramos fijos y siempre completos (Bajo, Normal, Alto, Extremo). El nivel lo decide la API
    // (`status`); el triángulo cae en el tramo de ese nivel y, dentro, según los percentiles.
    const segs = [
      { key: 'bar.low', s: 'below' as const },
      { key: 'bar.normal', s: 'normal' as const },
      { key: 'bar.high', s: 'above' as const },
      { key: 'bar.extreme', s: 'critical' as const },
    ];
    const seg = segs.findIndex((x) => x.s === status);
    let marker: number | null = null;
    if (baseline && value !== null && seg >= 0) {
      const { p25, p75, p90 } = baseline;
      const part = (v: number, lo: number, hi: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);
      const frac = [part(value, 0, p25), part(value, p25, p75), part(value, p75, p90), part(value, p90, p90 * 1.6 || 1)][seg];
      marker = (seg + Math.min(0.88, Math.max(0.12, frac))) * 25; // nunca en el borde
    }
    return (
      <div className="mt-6">
        <div className="relative h-3">
          <div className="absolute inset-0 flex gap-px overflow-hidden rounded-sm">
            {segs.map((s) => (
              <div key={s.key} className="flex-1" style={{ background: statusColor(palette, s.s) }} title={t(s.key)} />
            ))}
          </div>
          {marker !== null && (
            <span
              aria-hidden="true"
              className="absolute -top-3 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-select"
              style={{ left: `${marker}%` }}
            />
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-4 text-center font-mono text-xs uppercase tracking-wide text-mute">
          {segs.map((s, i) => (
            <span key={s.key} className={i === seg ? 'text-ink' : undefined}>
              {t(s.key)}
            </span>
          ))}
        </div>
      </div>
    );
  }
}

/**
 * Tarjeta 2 · notas técnicas en un acordeón de una línea (cerrado por defecto): error típico de la
 * armonización, aviso de k del país y avisos (`flags`) del mes. Cerrado solo muestra los resúmenes.
 */
export function MonthNotes({ data }: { data: CalendarResponse }) {
  const { t, selected } = useApp();
  const sel = selected ?? data.latest;
  const row = useMemo(() => indexMonths(data.months).get(ymKey(sel.year, sel.month)), [data, sel]);
  const mape = data.calibration.monthly_mape;
  const countryK = data.calibration.scope === 'country';
  const flags = row?.flags ?? [];
  const nWarn = flags.length + (countryK ? 1 : 0);

  return (
    <details className="group panel">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider">{t('notes.title')}</span>
        {mape !== null && <span className="rounded-full bg-panel-2 px-2 py-px font-mono text-xs text-mute">±{fmtPct(mape)} %</span>}
        {nWarn > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-cyan-deep px-2 py-px text-xs text-cyan">
            <AlertOnce key={`${sel.year}-${sel.month}`} size={12} />
            {t(nWarn === 1 ? 'notes.warnOne' : 'notes.warnMany', { n: nWarn })}
          </span>
        )}
        <span aria-hidden="true" className="ml-auto text-mute transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-3 text-[12.5px]">
        <p className="flex gap-2.5">
          <span className="font-mono text-cyan">{row?.status === 'no_data' ? 'ND' : '≈'}</span>
          <span className="text-mute">
            {row?.status === 'no_data' ? t('card.ndNote') : mape === null ? t('card.errorNone') : t('card.error', { p: fmtPct(mape) })}
          </span>
        </p>
        {countryK && (
          // Poco traslape entre sensores en esta área: el backend usó el k del país (harmonization.md).
          <p className="flex gap-2 text-warn">
            <span aria-hidden="true">!</span>
            <span>{t('val.scopeWarn')}</span>
          </p>
        )}
        {flags.length > 0 && (
          <div>
            <p className="kicker text-xs">{t('card.flags')}</p>
            <ul className="mt-1 space-y-1 text-mute">
              {flags.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 bg-cyan" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%)' }} />
                  {t(`flag.${f}`)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

/** Icono de aviso que se anima una sola vez al aparecer (sin bucle). */
function AlertOnce({ size, className = '' }: { size: number; className?: string }) {
  const icon = useIconAnim();
  useEffect(() => {
    icon.pulse(600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <BadgeAlertIcon ref={icon.ref} size={size} aria-hidden="true" className={`flex shrink-0 ${className}`} />;
}
