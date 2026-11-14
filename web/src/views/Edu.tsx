import { ErrorBox, Skeleton } from '../components/ui';
import { ramp } from '../lib/color';
import { fmtNum, fmtPct } from '../lib/format';
import { useApp, useCalendar } from '../state';
import type { CalendarResponse, PresetFeature } from '../types';

// Cerro forestal vs valle agrícola (diseño: docs/design/exports/10-*). MVP solo México.
const PAIR = ['qro-sierra-gorda', 'qro-bajio'];

export function Edu() {
  const { t, presets, setTab, presetName } = useApp();
  const feats: PresetFeature[] =
    presets.state === 'ok'
      ? PAIR.map((id) => presets.data.features.find((f) => f.id === id)).filter((f): f is PresetFeature => !!f)
      : [];
  const [a, reloadA] = useCalendar(feats[0] ? { preset_id: feats[0].id } : null);
  const [b, reloadB] = useCalendar(feats[1] ? { preset_id: feats[1].id } : null);

  const both = a.state === 'ok' && b.state === 'ok' ? [a.data, b.data] : null;
  // Misma escala para las dos regiones (diseño: "usan la misma escala para poder compararlas").
  const sharedMax = both ? Math.max(...both.flatMap((d) => d.seasonality)) : 1;

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(340px,420px)]">
      {[a, b].map((st, i) => (
        <div key={PAIR[i]}>
          {st.state === 'loading' && <Skeleton className="h-[460px]" />}
          {st.state === 'error' && <ErrorBox code={st.code} onRetry={i === 0 ? reloadA : reloadB} />}
          {st.state === 'ok' && feats[i] && <RegionCard data={st.data} name={presetName(feats[i])} max={sharedMax} />}
        </div>
      ))}

      <div className="space-y-3 xl:row-span-2">
        <section className="panel">
          <h2 className="heading border-b border-line px-4 py-3">{t('edu.modisViirs')}</h2>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-3 px-4 py-3 text-[13.5px]">
            <dt className="font-mono text-cyan">MODIS</dt>
            <dd>{t('edu.modis')}</dd>
            <dt className="font-mono text-cyan">VIIRS</dt>
            <dd>{t('edu.viirs')}</dd>
            <dt className="font-mono text-cyan">{t('edu.why')}</dt>
            <dd>{t('edu.whyD')}</dd>
            <dt className="font-mono text-cyan">{t('edu.nd')}</dt>
            <dd>{t('edu.ndD')}</dd>
          </dl>
        </section>
        <MedianExplainer />
      </div>

      <div className="space-y-3 xl:col-span-2">
        {both && feats.length === 2 && (
          <p className="panel px-4 py-3 text-[13.5px]">
            {t('edu.margin', {
              a: fmtPct(both[0].calibration.monthly_mape),
              r1: presetName(feats[0]),
              b: fmtPct(both[1].calibration.monthly_mape),
              r2: presetName(feats[1]),
            })}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-on px-5 py-3 text-base uppercase" onClick={() => setTab('general')}>
            {t('edu.ctaCal')} →
          </button>
          <button type="button" className="btn px-5 py-3 text-base uppercase" onClick={() => setTab('learn')}>
            {t('edu.ctaLearn')} →
          </button>
        </div>
      </div>
    </div>
  );
}

function RegionCard({ data, name, max }: { data: CalendarResponse; name: string; max: number }) {
  const { t, lang, palette } = useApp();
  const short = t('monthShort').split(',');
  // Solo ordena los 12 valores de `seasonality` para nombrar los meses más altos.
  const peaks = data.seasonality
    .map((v, i) => ({ v, i }))
    .sort((p, q) => q.v - p.v)
    .slice(0, 3)
    .sort((p, q) => p.i - q.i)
    .map((p) => t(`month.${p.i + 1}`).toLowerCase());

  return (
    <section className="panel h-full px-4 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="heading">{name}</h2>
        <span className="rounded border border-cyan px-2 py-0.5 font-mono text-sm text-cyan">
          {t('edu.k', { k: fmtNum(lang, data.calibration.k, 3) })}
        </span>
      </header>
      <p className="mt-3 text-[20px] leading-snug">{t('edu.peak', { months: peaks.join(', ') })}</p>
      <p className="kicker mt-5 text-[10px]">{t('edu.seasonality')}</p>
      <div className="mt-2 flex h-[220px] items-end gap-1.5 border-b border-line-2" role="img"
        aria-label={data.seasonality.map((v, i) => `${short[i]} ${fmtPct(v)} %`).join(', ')}
      >
        {data.seasonality.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 font-mono text-[10px] text-mute">{fmtPct(v)}</span>
            <div
              className="w-full rounded-t-sm"
              style={{ height: `${(v / (max || 1)) * 85}%`, background: ramp(palette, 0.15 + 0.85 * Math.sqrt(v / (max || 1))) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 font-mono text-xs text-mute">
        {short.map((s, i) => (
          <span key={i} className="flex-1 text-center">
            {s}
          </span>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-dim">
        {fmtNum(lang, data.aoi.area_km2)} km² · {data.aoi.country}
      </p>
    </section>
  );
}

/** Dibujo didáctico fijo (no son datos): años ordenados, la mediana y una anomalía. */
function MedianExplainer() {
  const { t, palette } = useApp();
  const bars = [14, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 32, 33, 35, 37, 39, 41, 44, 47, 50, 54, 58, 62, 68, 80, 112];
  const W = 360;
  const H = 150;
  const bw = W / bars.length;
  const med = 34;
  const y = (v: number) => H - (v / 135) * H;
  return (
    <section className="panel px-4 py-3">
      <h2 className="heading">{t('edu.medianQ')}</h2>
      <svg viewBox={`0 0 ${W} ${H + 4}`} className="mt-3 w-full" role="img" aria-label={`${t('edu.medianA')} ${t('edu.anomalyA')}`}>
        {bars.map((v, i) => (
          <rect
            key={i}
            x={i * bw + 1}
            width={bw - 2}
            y={y(v)}
            height={H - y(v)}
            fill={i >= bars.length - 2 ? ramp(palette, 1) : ramp(palette, 0.3)}
          />
        ))}
        <line x1={0} x2={W} y1={y(med)} y2={y(med)} stroke="#22d3ee" strokeWidth={2} />
        <text x={2} y={y(med) - 6} fill="#22d3ee" fontSize="12">
          {t('edu.median')}
        </text>
        <text x={W - 2} y={12} fill="#e8edf2" fontSize="12" textAnchor="end">
          {t('edu.anomaly')}
        </text>
      </svg>
      <p className="mt-3 text-[17px] leading-snug">{t('edu.medianA')}</p>
      <p className="mt-1 text-[13px] text-mute">{t('edu.anomalyA')}</p>
    </section>
  );
}
