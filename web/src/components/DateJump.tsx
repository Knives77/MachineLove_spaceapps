import { useEffect, useMemo, useState } from 'react';
import { indexMonths, ymKey } from '../lib/format';
import { useApp } from '../state';
import type { CalendarResponse } from '../types';

/** Primer mes con VIIRS completo (harmonization.md): antes solo hay MODIS. */
const VIIRS_FIRST = ymKey(2012, 2);

/** Hitos de la demo (docs/PITCH.md). */
const JUMPS: { year: number; month: number; label: string }[] = [
  { year: 2011, month: 5, label: 'jump.c2011' },
  { year: 2019, month: 5, label: 'jump.c2019' },
  { year: 2021, month: 3, label: 'jump.c2021' },
  { year: 2022, month: 8, label: 'jump.c2022' },
  { year: 2024, month: 5, label: 'jump.c2024' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Lleva la vista a la celda: desplaza al centro y la resalta suavemente. */
function flashCell(k: number) {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[role="grid"] [data-k="${k}"]`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'center' });
    if (reduce || !el.animate) return;
    el.animate(
      [
        { outline: '2px solid var(--color-cyan)', outlineOffset: '1px', transform: 'scale(1.65)', offset: 0 },
        { outline: '2px solid var(--color-cyan)', outlineOffset: '1px', transform: 'scale(1.25)', offset: 0.45 },
        { outline: '0 solid transparent', outlineOffset: '0px', transform: 'scale(1)', offset: 1 },
      ],
      { duration: 1400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, 50);
}

export function DateJump({ data }: { data: CalendarResponse }) {
  const { t, selected, setSelected } = useApp();
  const byKey = useMemo(() => indexMonths(data.months), [data]);
  const sortedKeys = useMemo(
    () => Array.from(byKey.keys()).sort((a, b) => a - b),
    [byKey],
  );

  const { start_year: y0, end_year: y1 } = data.range;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = y1; y >= y0; y--) out.push(y);
    return out;
  }, [y0, y1]);

  const cur = selected ?? data.latest;
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);

  useEffect(() => {
    setYear(cur.year);
    setMonth(cur.month);
  }, [cur.year, cur.month]);

  function go(y: number, m: number) {
    setYear(y);
    setMonth(m);
    const k = ymKey(y, m);
    if (!byKey.has(k)) return;
    setSelected({ year: y, month: m });
    flashCell(k);
  }

  const k = ymKey(year, month);
  const idx = sortedKeys.indexOf(k);
  const hasRow = byKey.has(k);
  const isPreViirs = hasRow && k < VIIRS_FIRST;

  function stepMonth(delta: -1 | 1) {
    if (idx === -1) return;
    const nextK = sortedKeys[idx + delta];
    if (nextK === undefined) return;
    const nextRow = byKey.get(nextK);
    if (nextRow) go(nextRow.year, nextRow.month);
  }

  const selBase =
    'h-6 cursor-pointer appearance-none bg-transparent pl-2 pr-5 font-mono text-[11px] text-ink transition-colors hover:bg-panel-hover focus:outline-none focus-visible:text-cyan';

  return (
    <div className="space-y-1.5">
      {/* Barra 1: Control unificado de período (Paso ‹ › + Año + Mes + Enfoque) */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center divide-x divide-line rounded-[3px] border border-line-2/80 bg-panel/90">
          <button
            type="button"
            disabled={idx <= 0}
            onClick={() => stepMonth(-1)}
            aria-label="Previous month"
            className="flex h-6 w-5 items-center justify-center font-mono text-[12px] text-mute transition-colors hover:bg-panel-hover hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>

          <div className="relative flex items-center">
            <select
              aria-label={t('cal.year')}
              value={year}
              onChange={(e) => go(Number(e.target.value), month)}
              className={selBase}
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-panel text-ink">
                  {y}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 font-mono text-[8px] text-dim">▾</span>
          </div>

          <div className="relative flex items-center">
            <select
              aria-label={t('jump.month')}
              value={month}
              onChange={(e) => go(year, Number(e.target.value))}
              className={selBase}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1} className="bg-panel text-ink">
                  {pad(i + 1)} · {t(`month.${i + 1}`)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 font-mono text-[8px] text-dim">▾</span>
          </div>

          <button
            type="button"
            disabled={idx === -1 || idx >= sortedKeys.length - 1}
            onClick={() => stepMonth(1)}
            aria-label="Next month"
            className="flex h-6 w-5 items-center justify-center font-mono text-[12px] text-mute transition-colors hover:bg-panel-hover hover:text-ink disabled:opacity-30"
          >
            ›
          </button>

          <button
            type="button"
            disabled={!hasRow}
            onClick={() => go(year, month)}
            title={t('jump.go')}
            className="flex h-6 items-center px-2 font-mono text-[10px] text-cyan/90 transition-colors hover:bg-cyan-deep/60 hover:text-select disabled:opacity-30"
          >
            ⌖
          </button>
        </div>

        {/* Estado contextual mínimo (sin duplicar las flags que ya muestra CalendarSide) */}
        {!hasRow ? (
          <span className="rounded-[2px] border border-cyan/40 bg-cyan-deep/30 px-1.5 py-0.5 font-mono text-[9.5px] text-cyan">
            {t('jump.none')}
          </span>
        ) : isPreViirs ? (
          <span className="rounded-[2px] border border-line bg-panel/70 px-1.5 py-0.5 font-mono text-[9.5px] text-mute">
            {t('jump.noViirs')}
          </span>
        ) : null}
      </div>

      {/* Barra 2: Matriz de hitos rápidos (2x3 / 3x2 uniforme) */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" role="group" aria-label={t('jump.quick')}>
        {JUMPS.map((j) => {
          const on = year === j.year && month === j.month;
          return (
            <button
              key={`${j.year}-${j.month}`}
              type="button"
              aria-pressed={on}
              onClick={() => go(j.year, j.month)}
              className={`group flex items-center gap-1.5 truncate rounded-[3px] border px-2 py-1 text-left transition-colors ${
                on
                  ? 'border-cyan/75 bg-cyan-deep/70 text-select'
                  : 'border-line/80 bg-panel/60 text-mute hover:border-line-2 hover:bg-panel-hover hover:text-ink'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                  on ? 'bg-cyan' : 'bg-line-2 group-hover:bg-cyan/60'
                }`}
              />
              <span className={`shrink-0 font-mono text-[10px] ${on ? 'text-cyan font-semibold' : 'text-ink/85'}`}>
                {j.year}-{pad(j.month)}
              </span>
              <span className="truncate text-[10px] opacity-85">{t(j.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
