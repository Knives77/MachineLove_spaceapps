// Consola de tiempo: la franja inferior de Experto. El tiempo 2000–2026 es el control principal:
// arriba la actividad mes a mes y debajo dos pistas, una por sensor, donde lo iluminado es lo que alimenta
// la serie; el cursor es el mes elegido (se arrastra, o se reproduce) y el interruptor de MODIS vive al final de su pista. Arriba, en la misma
// franja: región, modo y herramientas del mapa. Todo sale de `months[]` de /calendar; aquí no se calcula nada.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Segmented, Skeleton } from '../../components/ui';
import { sqrtT, statusColor } from '../../lib/color';
import { fmtNum } from '../../lib/format';
import { useApp } from '../../state';
import { TEXT } from '../../theme/tokens';
import type { CalendarResponse, Mode, MonthRow } from '../../types';
import { Regions } from './Regions';

/** 0 = el sensor no tiene dato ese mes · 1 = tiene dato pero no alimenta la serie · 2 = alimenta la serie. */
type Level = 0 | 1 | 2;
type Run = { from: number; to: number; level: Level };

function runs(months: MonthRow[], level: (m: MonthRow) => Level): Run[] {
  const out: Run[] = [];
  months.forEach((m, i) => {
    const l = level(m);
    const last = out[out.length - 1];
    if (last && last.level === l) last.to = i + 1;
    else out.push({ from: i, to: i + 1, level: l });
  });
  return out.filter((r) => r.level > 0);
}

export function TimeConsole({
  onHeight,
  toolbar,
}: {
  /** Avisa su alto (px): el mapa encuadra por encima y el calendario termina antes. */
  onHeight: (h: number) => void;
  /** Herramientas del mapa (las arma MapPanel, que es quien tiene el mapa). */
  toolbar: ReactNode;
}) {
  const { t, mode, setMode, basis, calendar } = useApp();
  const raw = mode === 'raw';
  const off = basis === 'viirs_primary';
  const k = calendar.state === 'ok' ? calendar.data.calibration.k.toFixed(2) : '—';
  // La consola ocupa todo el borde inferior; su alto se mide para que nada quede debajo.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => onHeight(Math.round(e.target.getBoundingClientRect().height)));
    ro.observe(box.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={box} className="absolute inset-x-0 bottom-0 z-[700]">
      {/* Aviso del modo: flota sobre la consola para que ésta no cambie de alto. */}
      {(raw || off) && (
        <p role="note" className={`hud absolute bottom-full left-2 mb-2 max-w-xl px-2.5 py-1.5 text-[11px] leading-snug ${raw ? 'text-warn' : 'text-mute'}`}>
          {raw ? t('con.rawWarn') : t('basis.active', { k })}
        </p>
      )}
      <div className="hud rounded-none border-x-0 border-b-0 px-3 pb-2 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <Regions names />
          <Segmented<Mode>
            label={t('con.master')}
            value={mode}
            onChange={setMode}
            size="sm"
            options={[
              { value: 'harmonized', label: t('mode.harmonized') },
              { value: 'raw', label: t('mode.raw') },
            ]}
          />
          {toolbar}
        </div>
        {calendar.state === 'ok' ? <Tracks data={calendar.data} /> : <Skeleton className="mt-2 h-[108px]" />}
      </div>
    </div>
  );
}

/** Alto de la franja de actividad (px) y de cada pista de sensor. */
const WAVE = 36;
const LANE = 12;
const GAP = 6;
const H = WAVE + GAP + LANE + GAP + LANE;

function Tracks({ data: d }: { data: CalendarResponse }) {
  const { t, lang, mode, basis, setBasis, palette, selected, setSelected } = useApp();
  const raw = mode === 'raw';
  const off = basis === 'viirs_primary';
  const months = d.months;
  const n = months.length;
  const sel = selected ?? d.latest;
  const last = Math.max(0, months.findIndex((m) => m.year === d.latest.year && m.month === d.latest.month));
  const at = Math.max(0, months.findIndex((m) => m.year === sel.year && m.month === sel.month));

  const [modis, viirs] = useMemo(() => {
    const feeds = (has: boolean, source: MonthRow['source'], mine: MonthRow['source']): Level =>
      !has ? 0 : raw || source === mine ? 2 : 1;
    return [
      runs(months, (m) => feeds(m.modis_cell_days !== null, m.source, 'modis')),
      runs(months, (m) => feeds(m.viirs_cell_days !== null, m.source, 'viirs_scaled')),
    ];
  }, [months, raw]);
  /** Enero de cada año: marca y, en los pares, etiqueta. */
  const years = useMemo(() => months.flatMap((m, i) => (m.month === 1 ? [{ i, year: m.year }] : [])), [months]);

  // Actividad mes a mes: una barra por mes con el valor que da la API (`harmonized`, o `raw_points` en
  // crudo), en escala de raíz y con el color del nivel (`status`). Sin dato = franja tenue, distinta del cero.
  const value = (m: MonthRow) => (raw ? m.raw_points : m.harmonized);
  const wave = useMemo(() => {
    const max = Math.max(1, ...months.map((m) => (m.status === 'no_data' ? 0 : (value(m) ?? 0))));
    return months.map((m) => {
      const v = value(m);
      if (m.status === 'no_data' || v === null) return { h: 0, nodata: true, color: '' };
      return { h: v > 0 ? Math.max(2, sqrtT(v, max) * (WAVE - 2)) : 0, nodata: false, color: raw ? TEXT.mute : statusColor(palette, m.status) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, raw, palette]);

  // Arrastrar sobre la franja = recorrer el tiempo. Teclado: ←/→ un mes, RePág/AvPág un año.
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const go = (i: number) => {
    const m = months[Math.min(last, Math.max(0, i))];
    if (m && (m.year !== sel.year || m.month !== sel.month)) setSelected({ year: m.year, month: m.month });
  };
  const indexAt = (e: PointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    return box ? Math.min(last, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * n))) : at;
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setPlaying(false);
    go(at + step);
  };

  // Reproducir: avanza un mes cada 0.9 s hasta el último mes con datos. Cualquier gesto manual lo detiene.
  const goRef = useRef(go);
  goRef.current = go;
  const atRef = useRef(at);
  atRef.current = at;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (atRef.current >= last) setPlaying(false);
      else goRef.current(atRef.current + 1);
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, last]);

  const k = d.calibration.k.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const name = (m: MonthRow | { year: number; month: number }) => `${t(`month.${m.month}`).slice(0, 3)} ${m.year}`;
  const label = name(sel);
  const pos = (i: number) => ((i + 0.5) / n) * 100;
  const pct = pos(at);
  const side = (p: number) => (p > 88 ? 'right-0' : p < 12 ? 'left-0' : 'left-1/2 -translate-x-1/2');
  const fill = (l: Level) => (l === 2 ? 'fill-ink' : 'fill-line-2');
  const hov = hover !== null && hover !== at ? months[hover] : null;
  const hovValue = hov ? value(hov) : null;

  return (
    <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 border-t border-line pt-[18px]" style={{ rowGap: GAP }}>
      <button
        type="button"
        aria-pressed={playing}
        aria-label={t(playing ? 'sig.pause' : 'sig.play')}
        title={t(playing ? 'sig.pause' : 'sig.play')}
        onClick={() => {
          if (!playing && at >= last) go(0); // al final: vuelve a empezar
          setPlaying((v) => !v);
        }}
        style={{ height: WAVE }}
        className={`flex w-9 items-center justify-center rounded-[3px] border transition-colors ${
          playing ? 'border-cyan bg-cyan-deep text-select' : 'border-line-2 text-mute hover:border-cyan hover:text-ink'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
          {playing ? <path d="M2 1h3v10H2zM7 1h3v10H7z" /> : <path d="M2.5 1 11 6l-8.5 5z" />}
        </svg>
      </button>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={t('sig.month')}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={at}
        aria-valuetext={label}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setPlaying(false);
          go(indexAt(e));
        }}
        onPointerMove={(e) => {
          const i = indexAt(e);
          if (e.buttons === 1) go(i);
          setHover(i);
        }}
        onPointerLeave={() => setHover(null)}
        className="relative row-span-3 cursor-ew-resize touch-none rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-cyan"
      >
        <svg viewBox={`0 0 ${n} ${H}`} preserveAspectRatio="none" style={{ height: H }} className="block w-full" aria-hidden="true" shapeRendering="crispEdges">
          {wave.map((w, i) =>
            w.nodata ? (
              <rect key={i} x={i} y="0" width="1" height={WAVE} className="fill-line" opacity="0.45" />
            ) : (
              w.h > 0 && <rect key={i} x={i + 0.12} y={WAVE - w.h} width="0.76" height={w.h} fill={w.color} opacity={i === at ? 1 : 0.85} />
            ),
          )}
          <rect x="0" y={WAVE - 0.5} width={n} height="0.5" className="fill-line-2" />
          <rect x="0" y={WAVE + GAP} width={n} height={LANE} className="fill-bg" />
          <rect x="0" y={WAVE + GAP + LANE + GAP} width={n} height={LANE} className="fill-bg" />
          {modis.map((r) => (
            <rect key={`m${r.from}`} x={r.from} y={WAVE + GAP} width={r.to - r.from} height={LANE} className={fill(r.level)} />
          ))}
          {viirs.map((r) => (
            <rect key={`v${r.from}`} x={r.from} y={WAVE + GAP + LANE + GAP} width={r.to - r.from} height={LANE} className={fill(r.level)} />
          ))}
        </svg>
        {/* Vista previa al pasar el cursor: a qué mes se saltaría y cuánto hubo. */}
        {hov && (
          <span aria-hidden="true" style={{ left: `${pos(hover as number)}%` }} className="pointer-events-none absolute -bottom-1.5 -top-1.5 w-px -translate-x-1/2 bg-line-2">
            <span className={`absolute -top-[15px] whitespace-nowrap rounded-sm border border-line-2 bg-panel px-1 font-mono text-[10px] uppercase leading-[13px] text-mute ${side(pos(hover as number))}`}>
              {name(hov)} · {hov.status === 'no_data' || hovValue === null ? t('status.no_data') : fmtNum(lang, hovValue, raw ? 0 : 1)}
            </span>
          </span>
        )}
        {/* Cursor del mes elegido: interacción, por eso cian. */}
        <span aria-hidden="true" style={{ left: `${pct}%` }} className="pointer-events-none absolute -bottom-1.5 -top-1.5 w-px -translate-x-1/2 bg-cyan">
          {!hov && (
            <span className={`absolute -top-[15px] whitespace-nowrap rounded-sm border border-cyan bg-cyan-deep px-1 font-mono text-[10px] uppercase leading-[13px] text-select ${side(pct)}`}>
              {label}
            </span>
          )}
        </span>
      </div>
      <span />

      <span style={{ height: LANE }} className={`flex items-center font-mono text-[11px] leading-none ${off && !raw ? 'text-dim line-through' : 'text-ink'}`}>
        MODIS
      </span>
      <span style={{ height: LANE }} className="flex items-center">
        <button
          type="button"
          role="switch"
          aria-checked={!off}
          aria-label={t('basis.label')}
          title={raw ? t('basis.rawOff') : t(off ? 'basis.on' : 'basis.off')}
          disabled={raw}
          onClick={() => setBasis(off ? 'modis_primary' : 'viirs_primary')}
          className={`relative h-[18px] w-9 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            off || raw ? 'border-line-2 bg-bg' : 'border-cyan bg-cyan-deep'
          }`}
        >
          <span className={`absolute left-[2px] top-[2px] h-3 w-3 rounded-full transition-transform duration-200 ${off || raw ? 'bg-mute' : 'bg-select'} ${off ? '' : 'translate-x-[18px]'}`} />
        </button>
      </span>

      <span style={{ height: LANE }} className={`flex items-center font-mono text-[11px] leading-none ${off || raw ? 'text-ink' : 'text-mute'}`}>
        VIIRS
      </span>
      <span
        title={t('con.kpi.k')}
        style={{ height: LANE }}
        className={`flex w-9 items-center justify-center font-mono text-[10px] tabular-nums ${off && !raw ? 'text-cyan' : 'text-dim'} ${raw ? 'invisible' : ''}`}
      >
        ×{k.replace(/^0/, '')}
      </span>

      <span />
      <div aria-hidden="true" className="relative h-3 font-mono text-[9.5px] tabular-nums leading-none text-dim">
        {years.map(({ i, year }) => (
          <span key={year} style={{ left: `${(i / n) * 100}%` }} className="absolute top-0 flex items-start gap-1">
            <span className={`w-px bg-line-2 ${year % 2 ? 'h-1' : 'h-2'}`} />
            {year % 2 === 0 && <span className={year === sel.year ? 'text-cyan' : ''}>{String(year).slice(2)}</span>}
          </span>
        ))}
      </div>
      <span />
    </div>
  );
}
