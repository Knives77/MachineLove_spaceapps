import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { inkOn, ramp, sqrtT, statusMark } from '../lib/color';
import { fmtNum, indexMonths, ymKey } from '../lib/format';
import { useApp } from '../state';
import type { CalendarResponse, MonthRow } from '../types';

export interface Layers {
  marks: boolean;
  nodata: boolean;
  flags: boolean;
}

export const ALL_LAYERS: Layers = { marks: true, nodata: true, flags: true };

/** Valor que pinta la celda según el modo. null = sin dato. Solo lee campos de la API. */
export function cellValue(m: MonthRow, mode: 'harmonized' | 'raw'): number | null {
  if (m.status === 'no_data' || m.harmonized === null) return null;
  return mode === 'harmonized' ? m.harmonized : m.raw_points;
}

export function useScaleMax(data: CalendarResponse, mode: 'harmonized' | 'raw') {
  return useMemo(() => {
    let max = 0;
    for (const m of data.months) {
      const v = cellValue(m, mode);
      if (v !== null && v > max) max = v;
    }
    return max;
  }, [data, mode]);
}

export function Calendar({
  data,
  layers = ALL_LAYERS,
  cellH = 17,
}: {
  data: CalendarResponse;
  layers?: Layers;
  cellH?: number;
}) {
  const { t, lang, mode, palette, selected, setSelected } = useApp();
  const byKey = useMemo(() => indexMonths(data.months), [data]);
  const max = useScaleMax(data, mode);
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = data.range.start_year; y <= data.range.end_year; y++) out.push(y);
    return out;
  }, [data]);
  const short = t('monthShort').split(',');

  const [focusKey, setFocusKey] = useState<number>(() =>
    selected ? ymKey(selected.year, selected.month) : ymKey(data.latest.year, data.latest.month),
  );
  const [hover, setHover] = useState<{ key: number; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const selKey = selected ? ymKey(selected.year, selected.month) : -1;

  function showTip(key: number, el: HTMLElement) {
    const box = wrap.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    setHover({ key, x: r.left - box.left + r.width / 2, y: r.top - box.top });
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, y: number, m: number) {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected({ year: y, month: m });
      return;
    }
    if (e.key === 'Escape') {
      setHover(null);
      return;
    }
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    let ny = y + mv[0];
    let nm = m + mv[1];
    if (nm > 12) (nm = 1), ny++;
    if (nm < 1) (nm = 12), ny--;
    if (ny < data.range.start_year || ny > data.range.end_year) return;
    const k = ymKey(ny, nm);
    setFocusKey(k);
    const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-k="${k}"]`);
    el?.focus();
  }

  const hovered = hover ? byKey.get(hover.key) : undefined;
  const hoverYm = hover ? { y: Math.floor(hover.key / 100), m: hover.key % 100 } : null;

  return (
    <div
      ref={wrap}
      className="relative"
      style={{ ['--cell-h' as string]: `${cellH}px` }}
      onMouseLeave={() => setHover(null)}
    >
      <p id="cal-help" className="sr-only">
        {t('cal.aria')}
      </p>
      <div role="grid" aria-describedby="cal-help" className="grid grid-cols-[2.6rem_repeat(12,minmax(0,1fr))] gap-[3px]">
        <div role="row" className="contents">
          <span />
          {short.map((s, i) => (
            <span key={i} role="columnheader" className="text-center font-mono text-[10px] text-mute">
              {s}
            </span>
          ))}
        </div>
        {years.map((y) => (
          <div key={y} role="row" className="contents">
            <span
              role="rowheader"
              className={`pr-1 text-right font-mono text-[10.5px] leading-[var(--cell-h)] ${
                selected?.year === y ? 'text-cyan' : 'text-mute'
              }`}
            >
              {y}
            </span>
            {short.map((_, i) => {
              const m = i + 1;
              const k = ymKey(y, m);
              const row = byKey.get(k);
              const v = row ? cellValue(row, mode) : null;
              let cls = '';
              let style: CSSProperties = {};
              let label = '';
              if (!row) {
                cls = 'missing';
              } else if (v === null) {
                cls = layers.nodata ? 'hatch' : 'missing';
              } else if (v === 0) {
                style = { background: 'var(--color-zero)', color: '#8792a0' };
                label = '0';
              } else {
                const bg = ramp(palette, sqrtT(v, max));
                style = { background: bg, color: inkOn(bg) };
                if (mode === 'harmonized' && layers.marks) label = statusMark(row.status);
              }
              const hasFlags = !!row && layers.flags && row.flags.length > 0;
              const isSel = k === selKey;
              const name = `${t(`month.${m}`)} ${y}`;
              const desc = !row
                ? t('legend.missing')
                : v === null
                  ? t('status.no_data')
                  : `${fmtNum(lang, v, 1)} ${mode === 'harmonized' ? t('unit.cellDays') : t('unit.points')}, ${t(
                      `status.${row.status}`,
                    )}`;
              return (
                <button
                  key={k}
                  type="button"
                  role="gridcell"
                  data-k={k}
                  tabIndex={k === focusKey ? 0 : -1}
                  aria-selected={isSel}
                  aria-label={`${name}: ${desc}`}
                  onClick={() => row && setSelected({ year: y, month: m })}
                  onKeyDown={(e) => onKey(e, y, m)}
                  onFocus={(e) => {
                    setFocusKey(k);
                    showTip(k, e.currentTarget);
                  }}
                  onBlur={() => setHover(null)}
                  onMouseEnter={(e) => showTip(k, e.currentTarget)}
                  className={`relative flex h-[var(--cell-h)] items-center justify-center rounded-[2px] font-mono text-[10px] font-semibold leading-none ${cls} ${
                    isSel ? 'z-10 ring-2 ring-cyan ring-offset-1 ring-offset-bg' : ''
                  }`}
                  style={style}
                >
                  <span aria-hidden="true">{label}</span>
                  {hasFlags && (
                    <span
                      aria-hidden="true"
                      className="absolute right-0 top-0 h-[7px] w-[7px] bg-cyan"
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {hover && hoverYm && (
        <Tooltip
          x={hover.x}
          y={hover.y}
          width={wrap.current?.clientWidth ?? 400}
          row={hovered}
          year={hoverYm.y}
          month={hoverYm.m}
        />
      )}
    </div>
  );
}

function Tooltip({
  x,
  y,
  width,
  row,
  year,
  month,
}: {
  x: number;
  y: number;
  width: number;
  row?: MonthRow;
  year: number;
  month: number;
}) {
  const { t, lang } = useApp();
  const below = y < 140;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-64 rounded border border-cyan bg-panel px-3 py-2 font-mono text-[11px] shadow-xl shadow-black/60"
      style={{
        left: Math.min(Math.max(x, 130), Math.max(130, width - 130)),
        top: below ? y + 26 : y - 8,
        transform: `translate(-50%, ${below ? '0' : '-100%'})`,
      }}
    >
      <p className="font-sans text-[13px] font-semibold text-ink">
        {t(`month.${month}`)} {year}
        {row && <span className="text-mute"> · {t(`status.${row.status}`).toUpperCase()}</span>}
      </p>
      {!row && <p className="text-mute">{t('legend.missing')}</p>}
      {row && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-mute">{t('tip.value')}</dt>
          <dd className="text-ink">
            {row.harmonized === null ? t('status.no_data') : `${fmtNum(lang, row.harmonized, 1)} ${t('unit.cellDays')}`}
          </dd>
          <dt className="text-mute">{t('tip.raw')}</dt>
          <dd>{fmtNum(lang, row.raw_points)}</dd>
          <dt className="text-mute">{t('tip.median')}</dt>
          <dd>
            {row.baseline ? `${fmtNum(lang, row.baseline.median, 1)} (n=${row.baseline.n_years})` : '—'}
          </dd>
          <dt className="text-mute">{t('tip.range')}</dt>
          <dd>{row.baseline ? `${fmtNum(lang, row.baseline.p25, 1)}–${fmtNum(lang, row.baseline.p75, 1)}` : '—'}</dd>
          <dt className="text-mute">{t('tip.ratio')}</dt>
          <dd>{row.anomaly_ratio === null ? '—' : `${fmtNum(lang, row.anomaly_ratio, 2)}×`}</dd>
          <dt className="text-mute">{t('tip.source')}</dt>
          <dd>{t(`source.${row.source ?? 'null'}`)}</dd>
          {row.flags.length > 0 && (
            <>
              <dt className="text-mute">{t('tip.flags')}</dt>
              <dd className="text-cyan">{row.flags.map((f) => t(`flagShort.${f}`)).join(' · ')}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
