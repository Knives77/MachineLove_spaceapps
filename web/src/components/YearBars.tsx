import { useMemo } from 'react';
import { ramp, statusColor } from '../lib/color';
import { fmtNum } from '../lib/format';
import { useApp } from '../state';
import type { CalendarResponse } from '../types';

/** Totales anuales de `years[]`, con el mismo interruptor crudo/armonizado. */
export function YearBars({ data, height = 120 }: { data: CalendarResponse; height?: number }) {
  const { t, lang, mode, palette, selected, setSelected } = useApp();
  const { start_year, end_year } = data.range;
  const n = end_year - start_year + 1;
  const byYear = useMemo(() => new Map(data.years.map((y) => [y.year, y])), [data]);
  const val = (y: number) => {
    const r = byYear.get(y);
    if (!r) return null;
    return mode === 'harmonized' ? r.harmonized : r.raw_points;
  };
  const max = Math.max(1, ...data.years.map((y) => (mode === 'harmonized' ? y.harmonized ?? 0 : y.raw_points)));
  const W = 1000;
  const H = height;
  const pad = 18;
  const bw = W / n;
  // Armonizado: el coral de "Normal" de la escala de niveles; crudo: un tono de la rampa.
  const color = mode === 'harmonized' ? statusColor(palette, 'normal') : ramp(palette, 0.8);

  return (
    <figure>
      <figcaption className="mb-1 flex items-baseline justify-between">
        <span className="heading text-[12px]">{t('years.title')}</span>
        <span className="kicker text-[10px] normal-case tracking-normal">
          {mode === 'harmonized' ? t('unit.cellDays') : t('unit.points')} ·{' '}
          <span className="inline-block h-2 w-3 border border-dashed border-mute align-middle" /> {t('years.incomplete')}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none" role="img"
        aria-label={`${t('years.title')}: ${data.years
          .map((y) => `${y.year} ${fmtNum(lang, (mode === 'harmonized' ? y.harmonized : y.raw_points) ?? 0)}`)
          .join(', ')}`}
      >
        <line x1={0} x2={W} y1={H - pad} y2={H - pad} stroke="#313c4a" />
        {Array.from({ length: n }, (_, i) => {
          const y = start_year + i;
          const v = val(y);
          const r = byYear.get(y);
          if (v === null || v === undefined || !r) return null;
          const h = ((H - pad - 4) * v) / max;
          const sel = selected?.year === y;
          return (
            <g key={y} onClick={() => setSelected({ year: y, month: selected?.month ?? 1 })} className="cursor-pointer">
              <title>{`${y}: ${fmtNum(lang, v, 1)}${r.complete ? '' : ` (${t('years.incomplete')})`}`}</title>
              <rect
                x={i * bw + bw * 0.15}
                width={bw * 0.7}
                y={H - pad - h}
                height={Math.max(h, 1)}
                fill={r.complete ? color : 'transparent'}
                stroke={r.complete ? (sel ? '#f8fafc' : 'none') : color}
                strokeWidth={sel ? 3 : 2}
                strokeDasharray={r.complete ? undefined : '5 4'}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      <div className="relative h-4 font-mono text-[10px] text-mute">
        {Array.from({ length: n }, (_, i) => start_year + i)
          .filter((y) => y % 4 === 0)
          .map((y) => (
            <span key={y} className="absolute -translate-x-1/2" style={{ left: `${((y - start_year + 0.5) / n) * 100}%` }}>
              {y}
            </span>
          ))}
      </div>
    </figure>
  );
}
