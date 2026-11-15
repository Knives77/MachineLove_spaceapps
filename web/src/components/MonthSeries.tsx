import { useMemo } from 'react';
import { fmtNum } from '../lib/format';
import { useApp } from '../state';
import { isZero } from './YearView';
import type { CalendarResponse } from '../types';
import { SURFACE, TEXT, UI } from '../theme/tokens';

/** Un mes calendario a lo largo de los años: valor armonizado y banda p25–p75 de la API. */
export function MonthSeries({ data, month, height = 150 }: { data: CalendarResponse; month: number; height?: number }) {
  const { t, lang, selected, setSelected } = useApp();
  const { start_year, end_year } = data.range;
  const rows = useMemo(
    () => data.months.filter((m) => m.month === month).sort((a, b) => a.year - b.year),
    [data, month],
  );
  const W = 1000;
  const H = height;
  const padY = 10;
  const n = end_year - start_year;
  const x = (y: number) => ((y - start_year) / Math.max(1, n)) * (W - 20) + 10;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.harmonized ?? 0, r.baseline?.p75 ?? 0)));
  const y = (v: number) => H - padY - (v / max) * (H - 2 * padY);

  // Segmentos continuos (los meses sin dato cortan la línea).
  const segments: { x: number; v: number; lo?: number; hi?: number }[][] = [];
  let cur: { x: number; v: number; lo?: number; hi?: number }[] = [];
  for (let yr = start_year; yr <= end_year; yr++) {
    const r = rows.find((q) => q.year === yr);
    if (!r || r.harmonized === null) {
      if (cur.length) segments.push(cur);
      cur = [];
      continue;
    }
    cur.push({ x: x(yr), v: r.harmonized, lo: r.baseline?.p25, hi: r.baseline?.p75 });
  }
  if (cur.length) segments.push(cur);

  const medianPts = rows
    .filter((r) => r.baseline)
    .map((r) => `${x(r.year)},${y(r.baseline!.median)}`)
    .join(' ');
  const gaps = rows.filter((r) => r.harmonized === null);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none" role="img"
        aria-label={rows.map((r) => `${r.year}: ${r.harmonized === null ? t('status.no_data') : fmtNum(lang, r.harmonized, 1)}`).join(', ')}
      >
        {medianPts && (
          <polyline points={medianPts} fill="none" stroke={TEXT.mute} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        )}
        {segments.map((seg, i) => {
          const band = seg.filter((p) => p.lo !== undefined && p.hi !== undefined);
          const bandPath =
            band.length > 1
              ? `M${band.map((p) => `${p.x},${y(p.hi!)}`).join('L')}L${band
                  .slice()
                  .reverse()
                  .map((p) => `${p.x},${y(p.lo!)}`)
                  .join('L')}Z`
              : '';
          return (
            <g key={i}>
              {bandPath && <path d={bandPath} fill={UI.accent} opacity={0.18} />}
              <polyline
                points={seg.map((p) => `${p.x},${y(p.v)}`).join(' ')}
                fill="none"
                stroke={UI.accent}
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
        {rows.map(
          (r) =>
            r.harmonized !== null && (
              <circle
                key={r.year}
                cx={x(r.year)}
                cy={y(r.harmonized)}
                r={selected?.year === r.year && selected.month === month ? 7 : 3.5}
                fill={selected?.year === r.year && selected.month === month ? UI.accent : SURFACE.panel}
                stroke={UI.accent}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onClick={() => setSelected({ year: r.year, month })}
              >
                <title>{`${r.year}: ${fmtNum(lang, r.harmonized, 1)} · ${isZero(r) ? t('level.zeroShort') : t(`status.${r.status}`)}`}</title>
              </circle>
            ),
        )}
        {gaps.map((r) => (
          <text key={`g${r.year}`} x={x(r.year)} y={H - 4} textAnchor="middle" fontSize="18" fill={TEXT.mute}>
            ◌<title>{`${r.year}: ${t('status.no_data')}`}</title>
          </text>
        ))}
      </svg>
      <div className="relative h-4 font-mono text-[10px] text-mute">
        {Array.from({ length: n + 1 }, (_, i) => start_year + i)
          .filter((yr) => yr % 4 === 0)
          .map((yr) => (
            <span key={yr} className="absolute -translate-x-1/2" style={{ left: `${(x(yr) / W) * 100}%` }}>
              {yr}
            </span>
          ))}
      </div>
    </div>
  );
}
