import { useEffect, useMemo, useRef, useState } from 'react';
import { statusColor } from '../lib/color';
import { fmtNum, indexMonths, ymKey } from '../lib/format';
import { UI } from '../theme/tokens';
import { useApp, useCalendar } from '../state';
import type { CalendarResponse } from '../types';
import { PauseIcon } from './icons/pause';
import { PlayIcon } from './icons/play';
import { useIconAnim } from './icons/useIconAnim';
import { isZero } from './YearView';

const MODIS_START = 2000; // Terra desde 2000
const VIIRS_START = 2012; // S-NPP desde 2012

/**
 * Línea de tiempo de meses con reproducción. Por defecto es una sola barra limpia (General);
 * con `detailed` muestra las pistas MODIS/VIIRS, ▲ meses extremos y ▪ caídas de sensor
 * (las marcas salen de `status` y `flags`).
 */
export function Timeline({ data, detailed = false }: { data: CalendarResponse; detailed?: boolean }) {
  const { t, lang, palette, selected, setSelected, basis, aoi } = useApp();
  // "Simular fin de MODIS" (basis = viirs_primary): la serie con MODIS se marca punteada en cada año,
  // igual que en las barras anuales de Experto, para ver cuánto cambia.
  const compare = basis === 'viirs_primary';
  const [ref] = useCalendar(compare ? aoi : null, 'modis_primary');
  const refByYear = useMemo(
    () => (compare && ref.state === 'ok' ? new Map(ref.data.years.map((y) => [y.year, y.harmonized])) : null),
    [compare, ref],
  );
  const yearMax = Math.max(
    1,
    ...data.years.map((y) => y.harmonized ?? 0),
    ...(refByYear ? [...refByYear.values()].map((v) => v ?? 0) : []),
  );
  const barColor = statusColor(palette, 'normal');
  const { start_year, end_year } = data.range;
  const total = (end_year - start_year + 1) * 12;
  const toIdx = (y: number, m: number) => (y - start_year) * 12 + (m - 1);
  const fromIdx = (i: number) => ({ year: start_year + Math.floor(i / 12), month: (i % 12) + 1 });
  const latestIdx = toIdx(data.latest.year, data.latest.month);
  const sel = selected ?? data.latest;
  const idx = toIdx(sel.year, sel.month);
  const [playing, setPlaying] = useState(false);
  const playIcon = useIconAnim();
  // Al cambiar entre reproducir y pausar, el icono nuevo se anima una vez (no en la carga inicial).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    playIcon.pulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  const byKey = useMemo(() => indexMonths(data.months), [data]);

  // Primer mes que trae dato: al repetir desde el final no se arranca en meses "sin dato"
  // (p. ej. ene–oct 2000, antes de Terra), que parecían un error.
  const firstDataIdx = useMemo(() => {
    let first = latestIdx;
    for (const m of data.months) if (m.status !== 'no_data') first = Math.min(first, toIdx(m.year, m.month));
    return first;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, latestIdx]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    // Si ya estás en el último mes, la reproducción vuelve a empezar desde el primero con dato.
    if (idx >= latestIdx) setSelected(fromIdx(firstDataIdx));
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (idx >= latestIdx) return setPlaying(false);
      const next = idx + 1;
      setSelected(fromIdx(next));
      if (next === latestIdx) setPlaying(false);
    }, 450);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, latestIdx]);

  const marks = useMemo(() => {
    const crit: number[] = [];
    const out: number[] = [];
    for (const m of data.months) {
      if (m.status === 'critical') crit.push(toIdx(m.year, m.month));
      if (m.flags.includes('modis_outage') || m.flags.includes('viirs_outage')) out.push(toIdx(m.year, m.month));
    }
    return { crit, out };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const pct = (i: number) => ((i + 0.5) / total) * 100;
  const row = byKey.get(ymKey(sel.year, sel.month));

  return (
    <div className="panel flex items-center gap-5 px-4 py-2">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? t('time.pause') : t('time.play')}
        {...playIcon.trigger}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-cyan bg-cyan-deep text-ink"
      >
        {playing ? (
          <PauseIcon ref={playIcon.ref} size={20} aria-hidden="true" className="flex" />
        ) : (
          <PlayIcon ref={playIcon.ref} size={20} aria-hidden="true" className="flex" />
        )}
      </button>
      <div className="w-32 shrink-0">
        <p className="kicker text-[10px]">{t('time.month')}</p>
        <p className="font-mono text-sm uppercase">
          {t(`month.${sel.month}`)} {sel.year}
        </p>
        {row && <p className="font-mono text-[10px] text-mute">{isZero(row) ? t('level.zeroShort') : t(`status.${row.status}`)}</p>}
      </div>

      {!detailed && (
        <div className="relative min-w-0 flex-1">
          {/* Totales anuales (years[]) como mini histograma sobre el mismo eje 2000–2026:
              reemplaza el panel "Total por año". Clic en una barra = ese año. */}
          <div className="relative h-9" aria-hidden="true">
            {data.years.map((y) => {
              const left = (toIdx(y.year, 1) / total) * 100;
              const h = Math.max(2, ((y.harmonized ?? 0) / yearMax) * 100);
              const on = y.year === sel.year;
              const refV = refByYear?.get(y.year);
              return (
                <button
                  key={y.year}
                  type="button"
                  tabIndex={-1}
                  title={`${y.year}: ${fmtNum(lang, y.harmonized ?? 0)} ${t('unit.cellDays')}${
                    refV === null || refV === undefined ? '' : ` · ${t('years.withModis')}: ${fmtNum(lang, refV, 1)}`
                  }${y.complete ? '' : ` · ${t('years.incomplete')}`}`}
                  onClick={() => {
                    setPlaying(false);
                    setSelected(y.year === data.latest.year ? data.latest : { year: y.year, month: sel.month });
                  }}
                  className="group absolute bottom-0 flex h-full items-end px-[1px]"
                  style={{ left: `${left}%`, width: `${(12 / total) * 100}%` }}
                >
                  <span
                    className={`block w-full rounded-t-[2px] transition-opacity ${on ? 'opacity-100' : 'opacity-55 group-hover:opacity-90'} ${
                      y.complete ? '' : 'border border-dashed bg-transparent'
                    }`}
                    style={{
                      height: `${h}%`,
                      background: y.complete ? barColor : undefined,
                      borderColor: y.complete ? undefined : barColor,
                      boxShadow: on ? `0 0 0 1px ${UI.select}` : undefined,
                    }}
                  />
                  {refV !== null && refV !== undefined && (
                    <span
                      className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed"
                      style={{ bottom: `${(refV / yearMax) * 100}%`, borderColor: UI.select }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-[9px] h-1.5 rounded-full bg-line-2" />
            <div className="absolute left-0 top-[9px] h-1.5 rounded-full bg-cyan/70" style={{ width: `${pct(idx)}%` }} />
            <input
              type="range"
              min={0}
              max={total - 1}
              value={idx}
              aria-label={t('time.label')}
              aria-valuetext={`${t(`month.${sel.month}`)} ${sel.year}`}
              onChange={(e) => {
                setPlaying(false);
                setSelected(fromIdx(Number(e.target.value)));
              }}
              className="ml-timeline ml-timeline-compact absolute inset-0 h-6 w-full"
            />
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[10px] text-mute">
            <span>{start_year}</span>
            <span className="truncate px-2 font-sans text-dim">
              {t('years.title')} · {t('unit.cellDays')}
              {refByYear && (
                <>
                  {' · '}
                  <span className="inline-block h-0 w-3 border-t-2 border-dashed border-ink align-middle" /> {t('years.withModis')}
                </>
              )}
            </span>
            <span>{end_year}</span>
          </div>
        </div>
      )}

      {detailed && (
      <div className="relative min-w-0 flex-1 pt-3">
        {/* marcas: ▲ meses extremos, ▪ caídas de sensor */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-3" aria-hidden="true">
          {marks.crit.map((i) => (
            <span
              key={`c${i}`}
              className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[4px] border-b-[7px] border-x-transparent border-b-cyan/80"
              style={{ left: `${pct(i)}%` }}
            />
          ))}
        </div>
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-1 flex items-center gap-2">
            <span className="absolute -top-0.5 left-0 font-mono text-[9px] text-mute" style={{ left: `${pct(toIdx(MODIS_START, 1))}%` }}>
              MODIS · {MODIS_START} →
            </span>
          </div>
          <div className="absolute inset-x-0 top-3.5 h-1.5 rounded-sm bg-mute" style={{ left: `${pct(toIdx(MODIS_START, 1))}%` }} />
          {marks.out.map((i) => (
            <span key={`o${i}`} aria-hidden="true" className="absolute top-3 h-2.5 w-1.5 -translate-x-1/2 bg-bg ring-1 ring-mute" style={{ left: `${pct(i)}%` }} />
          ))}
          <span className="absolute top-[22px] font-mono text-[9px] text-mute" style={{ left: `${pct(toIdx(VIIRS_START, 1))}%` }}>
            VIIRS · {VIIRS_START} →
          </span>
          <div
            className="absolute right-0 top-[34px] h-1.5 rounded-sm bg-cyan"
            style={{ left: `${pct(toIdx(VIIRS_START, 1))}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={idx}
          aria-label={t('time.label')}
          aria-valuetext={`${t(`month.${sel.month}`)} ${sel.year}`}
          onChange={(e) => {
            setPlaying(false);
            setSelected(fromIdx(Number(e.target.value)));
          }}
          className="ml-timeline absolute inset-x-0 top-3 h-8 w-full"
        />
        <div className="relative mt-3 h-4 font-mono text-[10px] text-mute">
          {Array.from({ length: end_year - start_year + 1 }, (_, i) => start_year + i)
            .filter((y) => y % 4 === 0)
            .map((y) => (
              <span key={y} className="absolute -translate-x-1/2" style={{ left: `${pct(toIdx(y, 1))}%` }}>
                {y}
              </span>
            ))}
        </div>
        <p className="sr-only">
          ▲ {t('time.critical')} · ▪ {t('time.outage')}
        </p>
      </div>
      )}
    </div>
  );
}
