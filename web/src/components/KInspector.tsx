import { fmtNum, fmtPct } from '../lib/format';
import { useApp } from '../state';
import type { Calibration } from '../types';

/** Panel de validación: todo sale de `calibration`; aquí no se recalcula k. */
export function KInspector({ cal }: { cal: Calibration }) {
  const { t, lang } = useApp();
  const rows: [string, string][] = [
    [t('val.sumModis'), fmtNum(lang, cal.modis_cell_days)],
    [t('val.sumViirs'), fmtNum(lang, cal.viirs_cell_days)],
    [t('val.overlap'), fmtNum(lang, cal.overlap_months)],
    [t('val.scope'), t(`scope.${cal.scope}`)],
  ];
  const errs: [string, number | null][] = [
    [t('val.annual'), cal.loyo_annual_mape],
    [t('val.annualMax'), cal.loyo_annual_max],
    [t('val.monthly'), cal.monthly_mape],
  ];
  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-mute">{k}</dt>
            <dd className="font-mono">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between border-y border-line py-2">
        <span className="font-mono text-mute">k = ΣMODIS / ΣVIIRS</span>
        <span className="font-mono text-3xl font-semibold text-cyan">{fmtNum(lang, cal.k, 3)}</span>
      </div>
      {cal.scope === 'country' && (
        <p role="note" className="rounded border border-warn/50 px-3 py-2 text-[12.5px] text-warn">
          {t('val.scopeWarn')}
        </p>
      )}
      <div>
        <p className="font-mono text-[12.5px]">{t('val.formula')}</p>
        <p className="text-[12.5px] text-mute">
          {t('val.example', { k: fmtNum(lang, cal.k, 3), r: fmtNum(lang, 100 * cal.k, 1) })}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {errs.map(([k, v]) => (
          <div key={k} className="rounded border border-line bg-panel-2/50 px-2 py-1.5">
            <dt className="kicker text-xs normal-case tracking-normal">{k}</dt>
            <dd className="font-mono text-base">{v === null ? '—' : `${fmtPct(v)} %`}</dd>
          </div>
        ))}
      </dl>
      <p className="font-mono text-xs text-dim">{t('val.note')}</p>
    </div>
  );
}
