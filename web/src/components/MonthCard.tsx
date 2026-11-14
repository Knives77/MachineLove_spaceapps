import { useMemo } from 'react';
import { ramp, statusColor } from '../lib/color';
import { fmtNum, fmtPct, indexMonths, ymKey } from '../lib/format';
import { useApp } from '../state';
import type { Baseline, CalendarResponse } from '../types';
import { StatusIcon } from './ui';

/** Tarjeta del mes elegido (por defecto `latest`). Solo muestra campos de la API. */
export function MonthCard({ data }: { data: CalendarResponse }) {
  const { t, lang, palette, selected, aoiName } = useApp();
  const sel = selected ?? data.latest;
  const row = useMemo(() => indexMonths(data.months).get(ymKey(sel.year, sel.month)), [data, sel]);
  const mape = data.calibration.monthly_mape;

  return (
    <div aria-live="polite">
      <p className="kicker text-cyan">
        {t(`month.${sel.month}`)} {sel.year} · {aoiName}
      </p>

      {!row && <p className="mt-3 text-mute">{t('card.missing')}</p>}

      {row && (
        <>
          <div className="mt-2 flex items-center gap-3">
            <StatusIcon status={row.status} color={statusColor(palette, row.status)} size={20} />
            <p className="text-[34px] font-semibold uppercase leading-none tracking-tight">
              {t(`status.${row.status}`)}
            </p>
          </div>

          {row.status === 'no_data' ? (
            <>
              <p className="mt-3 text-lg">{t('card.noDataTitle')}</p>
              <p className="mt-1 text-sm text-mute">{t('card.noDataSub')}</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-lg">
                {row.anomaly_ratio !== null && row.baseline
                  ? t('card.ratio', { r: fmtNum(lang, row.anomaly_ratio, 1), n: row.baseline.n_years })
                  : row.status === 'insufficient_baseline'
                    ? t('card.insufficient')
                    : t('card.noRatio')}
              </p>
              <p className="mt-1 text-sm text-mute">
                {t('card.thisMonth', {
                  v: fmtNum(lang, row.harmonized ?? 0, 1),
                  unit: t('unit.cellDays'),
                  m: row.baseline ? fmtNum(lang, row.baseline.median, 1) : '—',
                })}
              </p>
              <p className="text-xs text-dim">
                {t('card.raw', { v: fmtNum(lang, row.raw_points) })} · {t('card.source')}:{' '}
                {t(`source.${row.source ?? 'null'}`)}
              </p>
            </>
          )}

          <LevelBar baseline={row.baseline} value={row.harmonized} />

          <div className="mt-4 flex gap-3 rounded border border-line bg-panel-2/60 px-3 py-2.5 text-[13px]">
            {row.status === 'no_data' ? (
              <>
                <span className="font-mono text-cyan">ND</span>
                <span>{t('card.ndNote')}</span>
              </>
            ) : (
              <>
                <span className="font-mono text-cyan">≈</span>
                <span>{mape === null ? t('card.errorNone') : t('card.error', { p: fmtPct(mape) })}</span>
              </>
            )}
          </div>

          {row.flags.length > 0 && (
            <div className="mt-3">
              <p className="kicker">{t('card.flags')}</p>
              <ul className="mt-1 space-y-1 text-[12.5px] text-mute">
                {row.flags.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 bg-cyan" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%)' }} />
                    {t(`flag.${f}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );

  function LevelBar({ baseline, value }: { baseline: Baseline | null; value: number | null }) {
    // Dibuja los percentiles que manda la API; no decide el nivel (eso ya viene en `status`).
    const segs = [
      { key: 'bar.low', t: 0.08 },
      { key: 'bar.normal', t: 0.3 },
      { key: 'bar.high', t: 0.68 },
      { key: 'bar.extreme', t: 1 },
    ];
    if (!baseline) {
      return (
        <div className="mt-5">
          <div className="hatch h-3 rounded-sm" />
          <div className="mt-1 flex justify-between kicker text-[10px]">
            {segs.map((s) => (
              <span key={s.key}>{t(s.key)}</span>
            ))}
          </div>
        </div>
      );
    }
    const top = Math.max(baseline.p90 * 1.6, (value ?? 0) * 1.08, 1);
    const stops = [0, baseline.p25, baseline.p75, baseline.p90, top].map((v) => (v / top) * 100);
    const marker = value === null ? null : Math.min(100, (value / top) * 100);
    return (
      <div className="mt-5">
        <div className="relative h-3">
          <div className="absolute inset-0 flex overflow-hidden rounded-sm">
            {segs.map((s, i) => (
              <div
                key={s.key}
                style={{ width: `${stops[i + 1] - stops[i]}%`, background: ramp(palette, s.t) }}
                title={t(s.key)}
              />
            ))}
          </div>
          {marker !== null && (
            <span
              aria-hidden="true"
              className="absolute -top-3 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-cyan"
              style={{ left: `${marker}%` }}
            />
          )}
        </div>
        <div className="relative mt-1 h-4 font-mono text-[10px] uppercase tracking-wider text-mute">
          {segs.map((s, i) => (
            <span
              key={s.key}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${Math.min(92, Math.max(8, (stops[i] + stops[i + 1]) / 2))}%` }}
            >
              {stops[i + 1] - stops[i] > 9 ? t(s.key) : ''}
            </span>
          ))}
        </div>
      </div>
    );
  }
}
