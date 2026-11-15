import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { INK_LIGHT, inkOn, ramp, sqrtT, statusColor } from '../lib/color';
import { fmtNum, indexMonths, ymKey } from '../lib/format';
import { playStatus } from '../lib/sound';
import { useApp } from '../state';
import { NEUTRAL } from '../theme/tokens';
import type { CalendarResponse, Status } from '../types';
import { cellValue, Tooltip, useScaleMax } from './Calendar';
import { isZero } from './YearView';

export type ColorBy = 'value' | 'level';

const LEVELS: Status[] = ['below', 'normal', 'above', 'critical'];

/**
 * Calendario en mosaicos (consola de Experto): columnas = años, filas = meses, para que los
 * 27 años quepan a lo ancho y queden alineados con las barras anuales de arriba.
 * Solo pinta campos de la API: `harmonized` / `raw_points` (color por valor) o `status` (color por nivel).
 */
export function CalendarTiles({
  data,
  colorBy,
  legendRight,
}: {
  data: CalendarResponse;
  colorBy: ColorBy;
  /** Control extra a la derecha de la leyenda (p. ej. el selector de color). */
  legendRight?: ReactNode;
}) {
  const { t, lang, mode, palette, selected, setSelected, sound } = useApp();
  const byKey = useMemo(() => indexMonths(data.months), [data]);
  const max = useScaleMax(data, mode);
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = data.range.start_year; y <= data.range.end_year; y++) out.push(y);
    return out;
  }, [data]);
  const short = t('monthShort').split(',');
  // El nivel solo existe para la serie armonizada: en crudo siempre se pinta por valor.
  const byLevel = colorBy === 'level' && mode === 'harmonized';

  const selKey = selected ? ymKey(selected.year, selected.month) : -1;
  const [focusKey, setFocusKey] = useState<number>(() =>
    selected ? selKey : ymKey(data.latest.year, data.latest.month),
  );
  const [hover, setHover] = useState<{ key: number; x: number; y: number; below: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  function showTip(key: number, el: HTMLElement) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const r = el.getBoundingClientRect();
    setHover({ key, x: r.left - box.left + r.width / 2, y: r.top - box.top, below: r.top - box.top < 150 });
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, y: number, m: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected({ year: y, month: m });
      return;
    }
    if (e.key === 'Escape') return setHover(null);
    const mv: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    const d = mv[e.key];
    if (!d) return;
    e.preventDefault();
    const ny = y + d[0];
    const nm = m + d[1];
    if (nm < 1 || nm > 12 || ny < data.range.start_year || ny > data.range.end_year) return;
    const k = ymKey(ny, nm);
    setFocusKey(k);
    wrap.current?.querySelector<HTMLButtonElement>(`[data-k="${k}"]`)?.focus();
  }

  const hovered = hover ? byKey.get(hover.key) : undefined;
  const cols = { gridTemplateColumns: `1.1rem repeat(${years.length}, minmax(0, 1fr))` };

  return (
    <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
      <p id="tiles-help" className="sr-only">
        {t('con.tilesAria')}
      </p>
      <div role="grid" aria-describedby="tiles-help" className="grid gap-[3px]" style={cols}>
        <div role="row" className="contents">
          <span />
          {years.map((y) => (
            <span
              key={y}
              role="columnheader"
              aria-label={String(y)}
              className={`text-center font-mono text-[9px] leading-none ${selected?.year === y ? 'text-cyan' : y % 2 === 0 ? 'text-mute' : 'text-transparent'}`}
            >
              {String(y).slice(2)}
            </span>
          ))}
        </div>
        {short.map((label, i) => {
          const m = i + 1;
          return (
            <div key={m} role="row" className="contents">
              <span
                role="rowheader"
                aria-label={t(`month.${m}`)}
                className={`self-center font-mono text-[9.5px] leading-none ${selected?.month === m ? 'text-cyan' : 'text-mute'}`}
              >
                {label}
              </span>
              {years.map((y) => {
                const k = ymKey(y, m);
                const row = byKey.get(k);
                const v = row ? cellValue(row, mode) : null;
                let cls = '';
                let style: CSSProperties = {};
                let ink: string = INK_LIGHT;
                let mark: 'ring' | 'dot' | null = null;
                if (!row) cls = 'missing';
                else if (v === null) cls = 'hatch';
                else if (v === 0) style = { background: 'var(--color-zero)' };
                else if (byLevel) {
                  const bg = statusColor(palette, row.status);
                  ink = inkOn(bg);
                  style = { background: bg };
                } else {
                  const bg = ramp(palette, sqrtT(v, max));
                  ink = inkOn(bg);
                  style = { background: bg };
                  // Por valor, el nivel se marca además del color: anillo = extremo, punto = alto.
                  if (mode === 'harmonized') mark = row.status === 'critical' ? 'ring' : row.status === 'above' ? 'dot' : null;
                }
                const isSel = k === selKey;
                const desc = !row
                  ? t('legend.missing')
                  : v === null
                    ? t('status.no_data')
                    : `${fmtNum(lang, v, 1)} ${mode === 'harmonized' ? t('unit.cellDays') : t('unit.points')}, ${
                        isZero(row) ? t('level.zeroShort') : t(`status.${row.status}`)
                      }`;
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    data-k={k}
                    tabIndex={k === focusKey ? 0 : -1}
                    aria-selected={isSel}
                    aria-label={`${t(`month.${m}`)} ${y}: ${desc}`}
                    onClick={() => row && setSelected({ year: y, month: m })}
                    onKeyDown={(e) => onKey(e, y, m)}
                    onFocus={(e) => {
                      setFocusKey(k);
                      showTip(k, e.currentTarget);
                      if (sound) playStatus(row ? row.status : null);
                    }}
                    onBlur={() => setHover(null)}
                    onMouseEnter={(e) => showTip(k, e.currentTarget)}
                    className={`tile ${cls} ${isSel ? 'z-10 ring-2 ring-select ring-offset-1 ring-offset-bg' : ''}`}
                    style={style}
                  >
                    {mark === 'ring' && (
                      <span aria-hidden="true" className="absolute inset-0 rounded-[3px] border-[1.5px]" style={{ borderColor: ink }} />
                    )}
                    {mark === 'dot' && (
                      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: ink }} />
                    )}
                    {row && row.flags.length > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute right-0 top-0 h-[5px] w-[5px] rounded-tr-[3px] bg-cyan"
                        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Leyenda tipo "menos … más" (por valor) o los 4 niveles con nombre (por nivel). */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-mute">
        {byLevel ? (
          <span className="flex items-center gap-2">
            {LEVELS.map((s) => (
              <span key={s} className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: statusColor(palette, s) }} />
                {t(`status.${s}`)}
              </span>
            ))}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            {t('con.less')}
            {[0.05, 0.3, 0.55, 0.8, 1].map((x) => (
              <i key={x} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ramp(palette, x) }} />
            ))}
            {t('con.more')}
            {mode === 'harmonized' && (
              <>
                <i className="ml-2 h-2.5 w-2.5 rounded-[2px] border-2" style={{ borderColor: NEUTRAL.zeroText }} />
                {t('status.critical')}
              </>
            )}
          </span>
        )}
        <span className="flex items-center gap-1">
          <i className="h-2.5 w-2.5 rounded-[2px] bg-zero ring-1 ring-line" />0
        </span>
        <span className="flex items-center gap-1">
          <i className="hatch h-2.5 w-2.5 rounded-[2px]" />
          {t('status.no_data')}
        </span>
        <span className="flex items-center gap-1">
          <i className="h-[6px] w-[6px] bg-cyan" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
          {t('legend.flagShort')}
        </span>
        {legendRight && <span className="ml-auto">{legendRight}</span>}
      </div>

      {hover && (
        <Tooltip
          x={hover.x}
          y={hover.y}
          below={hover.below}
          simple={false}
          width={wrap.current?.clientWidth ?? 400}
          row={hovered}
          year={Math.floor(hover.key / 100)}
          month={hover.key % 100}
        />
      )}
    </div>
  );
}
