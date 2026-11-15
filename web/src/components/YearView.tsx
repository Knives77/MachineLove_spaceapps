import { useMemo, type KeyboardEvent } from 'react';
import { readableOn, statusColor } from '../lib/color';
import { indexMonths, ymKey } from '../lib/format';
import { playStatus } from '../lib/sound';
import { NEUTRAL } from '../theme/tokens';
import { useApp } from '../state';
import type { CalendarResponse, MonthRow, Palette, Status } from '../types';

type Ym = { year: number; month: number };

/** Limita un mes al rango con datos: desde enero del primer año hasta `latest`. */
export function clampYm(data: CalendarResponse, ym: Ym): Ym {
  const lo = ymKey(data.range.start_year, 1);
  const hi = ymKey(data.latest.year, data.latest.month);
  const k = Math.min(hi, Math.max(lo, ymKey(ym.year, ym.month)));
  return { year: Math.floor(k / 100), month: k % 100 };
}

/** Mueve el mes elegido `delta` meses, sin salirse del rango. */
export function shiftMonth(data: CalendarResponse, ym: Ym, delta: number): Ym {
  const i = ym.year * 12 + (ym.month - 1) + delta;
  return clampYm(data, { year: Math.floor(i / 12), month: (i % 12) + 1 });
}

/** Selector de año: ‹ [2026 ▾] › y botón "Hoy". Cambia el año del mes elegido. */
export function YearPicker({ data }: { data: CalendarResponse }) {
  const { t, selected, setSelected } = useApp();
  const sel = selected ?? data.latest;
  const first = data.range.start_year;
  const last = data.latest.year;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = last; y >= first; y--) out.push(y);
    return out;
  }, [first, last]);
  const goYear = (y: number) => setSelected(clampYm(data, { year: y, month: sel.month }));
  const atLatest = sel.year === data.latest.year && sel.month === data.latest.month;

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={NAV_BTN} disabled={sel.year <= first} onClick={() => goYear(sel.year - 1)} aria-label={t('cal.prevYear')} title={t('cal.prevYear')}>
        ‹
      </button>
      <label className="flex h-9 items-center rounded border border-line bg-panel-2 px-2">
        <span className="sr-only">{t('cal.year')}</span>
        <select
          value={sel.year}
          onChange={(e) => goYear(Number(e.target.value))}
          className="rounded-sm bg-transparent font-mono text-[14px] font-semibold text-ink"
        >
          {years.map((y) => (
            <option key={y} value={y} className="bg-panel">
              {y}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={NAV_BTN} disabled={sel.year >= last} onClick={() => goYear(sel.year + 1)} aria-label={t('cal.nextYear')} title={t('cal.nextYear')}>
        ›
      </button>
      <button
        type="button"
        disabled={atLatest}
        onClick={() => setSelected(data.latest)}
        title={t('cal.todayLabel', { y: data.latest.year })}
        aria-label={t('cal.todayLabel', { y: data.latest.year })}
        className="ml-1 h-9 rounded border border-line px-3 font-mono text-[12px] uppercase tracking-wider text-mute transition-colors hover:border-cyan hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-mute"
      >
        {t('cal.today')}
      </button>
    </div>
  );
}

export const NAV_BTN =
  'flex h-9 w-9 items-center justify-center rounded border border-line bg-line/60 text-[18px] leading-none text-ink/90 transition-colors hover:border-cyan hover:text-select disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line disabled:hover:text-ink/90';

/** Color del nivel: barra lateral, puntos de la leyenda y fondo translúcido del badge. */
export function levelAccent(palette: Palette, status: Status): string {
  if (status === 'no_data') return ZERO_ACCENT;
  return statusColor(palette, status);
}

/** Texto del badge: el color del nivel, aclarado solo si no llega a 4.5:1 sobre la tarjeta. */
export const levelText = (accent: string) => readableOn(accent);

/** Acento neutro para los meses medidos con 0 celdas-día: "sin incendios", nunca un color de nivel. */
export const ZERO_ACCENT = NEUTRAL.zero;

/** Un mes medido con 0: se muestra como "Sin incendios" aunque `status` diga otra cosa (p. ej. mediana 0). */
export const isZero = (row: MonthRow) => row.status !== 'no_data' && row.harmonized === 0;

/** Acento de un mes: neutro si es 0, si no el de su nivel. */
export const rowAccent = (palette: Palette, row: MonthRow) => (isZero(row) ? ZERO_ACCENT : levelAccent(palette, row.status));

/**
 * Los 12 meses del año elegido en 3 × 4. Tarjetas oscuras: el nivel (`status` de la API) va en
 * una barra de acento a la izquierda y en un badge con su nombre. Sin números: el valor y la
 * mediana se ven en la tarjeta del mes, a la izquierda.
 */
export function YearView({ data }: { data: CalendarResponse }) {
  const { t, palette, selected, setSelected, sound } = useApp();
  const sel = selected ?? data.latest;
  const byKey = useMemo(() => indexMonths(data.months), [data]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, m: number) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    const nm = m + d;
    if (nm < 1 || nm > 12) return;
    document.querySelector<HTMLButtonElement>(`[data-ym="${ymKey(sel.year, nm)}"]`)?.focus();
  }

  return (
    <div role="group" aria-label={`${t('cal.year')} ${sel.year}`} className="grid grid-cols-4 gap-1.5">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const k = ymKey(sel.year, m);
        const row = byKey.get(k);
        const isSel = !!row && sel.month === m;
        const name = t(`month.${m}`);
        const hasFlags = !!row && row.flags.length > 0;
        const accent = row ? rowAccent(palette, row) : null;
        const statusText = !row ? '' : isZero(row) ? t('level.zeroTile') : t(`status.${row.status}`);
        const flagsText = hasFlags ? row!.flags.map((f) => t(`flag.${f}`)).join(' ') : '';

        return (
          <button
            key={m}
            type="button"
            data-ym={k}
            disabled={!row}
            aria-pressed={isSel}
            aria-label={`${name} ${sel.year}: ${row ? statusText : t('legend.missing')}${hasFlags ? `. ${flagsText}` : ''}`}
            title={hasFlags ? flagsText : undefined}
            onClick={() => row && setSelected({ year: sel.year, month: m })}
            onFocus={() => sound && row && playStatus(row.status)}
            onKeyDown={(e) => onKey(e, m)}
            className={`relative flex h-[52px] flex-col justify-between overflow-hidden rounded-md border py-1.5 pl-2.5 pr-1.5 text-left transition-colors ${
              !row
                ? 'border-dashed border-line text-dim'
                : isSel
                  ? 'sel-glow bg-[var(--color-panel-selected)]'
                  : 'border-line bg-panel hover:border-line-2 hover:bg-[var(--color-panel-hover)]'
            }`}
          >
            {/* Barra de acento de 4 px con el color del nivel; rayada si no hay dato. */}
            {row && (
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${row.status === 'no_data' ? 'hatch' : ''}`}
                style={row.status === 'no_data' ? undefined : { background: accent! }}
              />
            )}
            <span className="flex items-start justify-between gap-1">
              <span className={`text-sm font-semibold ${isSel ? 'text-ink' : 'text-ink/85'}`}>{name.slice(0, 3)}</span>
              {hasFlags && (
                <span aria-hidden="true" className="text-xs leading-none text-cyan/80">
                  ◥
                </span>
              )}
            </span>
            {row && (
              <span
                className="self-start whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-semibold uppercase"
                style={
                  row.status === 'no_data'
                    ? undefined
                    : { background: `${accent}26`, color: levelText(accent!), boxShadow: `inset 0 0 0 1px ${accent}40` }
                }
              >
                {row.status === 'no_data' ? (
                  <span className="flex items-center gap-1.5 text-mute">
                                        {statusText}
                  </span>
                ) : (
                  statusText
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
