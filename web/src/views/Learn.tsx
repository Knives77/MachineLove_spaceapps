import { useMemo, useState } from 'react';
import { ramp } from '../lib/color';
import { fmtNum } from '../lib/format';
import { useApp } from '../state';
import type { CalendarResponse, MonthRow } from '../types';
import { ModisSwitch } from '../components/ModisSwitch';
import { WithCalendar } from './WithCalendar';
import { TEXT } from '../theme/tokens';

const STEPS = ['s1', 's2', 's3', 's4'] as const;

export function Learn() {
  const { t } = useApp();
  const [step, setStep] = useState(0);

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(340px,420px)]">
      <section className="panel self-start">
        <div className="border-b border-line px-4 py-4">
          <p className="kicker text-cyan">{t('learn.kicker')}</p>
          <p className="mt-1 text-[17px] leading-snug">{t('learn.story')}</p>
        </div>
        <ol className="space-y-2 p-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const on = i === step;
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  onClick={() => setStep(i)}
                  className={`flex w-full items-start gap-3 rounded border px-3 py-2.5 text-left transition-colors ${
                    on ? 'border-cyan bg-cyan-deep' : 'border-line hover:border-line-2'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                      done ? 'border-cyan bg-cyan text-bg' : on ? 'border-cyan text-ink' : 'border-mute text-mute'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span>
                    <span className={`block text-[17px] ${on || done ? 'text-ink' : 'text-mute'}`}>{t(`learn.${s}`)}</span>
                    <span className="block text-[13px] text-mute">{t(`learn.${s}d`)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
          <button type="button" className="btn py-2.5 uppercase" disabled={step === 0} onClick={() => setStep(step - 1)}>
            {t('learn.prev')}
          </button>
          <button type="button" className="btn btn-on py-2.5 uppercase" disabled={step === 3} onClick={() => setStep(step + 1)}>
            {t('learn.next')}
          </button>
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-3">
        <ModisPill />
        <WithCalendar>{(d) => <StepChart data={d} step={step} />}</WithCalendar>
      </div>

      <div className="space-y-3">
        <WithCalendar>{(d) => <StepNote data={d} step={step} />}</WithCalendar>
        <Quiz />
      </div>
    </div>
  );
}

/**
 * "Simular fin de MODIS" como píldora colapsable: cerrada no estorba; abierta muestra el botón.
 * Si MODIS está apagado, la píldora lo dice aunque esté cerrada.
 */
function ModisPill() {
  const { t, basis } = useApp();
  const [open, setOpen] = useState(false);
  const off = basis === 'viirs_primary';
  return (
    <div className={`panel ${off ? 'border-cyan/60' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="modis-pill"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px]"
      >
        <span aria-hidden="true" className={off ? 'text-cyan' : 'text-warn'}>
          ⏻
        </span>
        <span className="font-semibold">{t('basis.label')}</span>
        {off && <span className="rounded-full bg-cyan-deep px-2 py-px text-xs text-cyan">{t('basis.pillOn')}</span>}
        <span aria-hidden="true" className={`ml-auto text-mute transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      {open && (
        <div id="modis-pill" className="border-t border-line px-4 py-3">
          <ModisSwitch />
        </div>
      )}
    </div>
  );
}

/** Año que se explica: el elegido si ya hay VIIRS (2012+), si no el de `latest`. */
function useLearnYear(data: CalendarResponse) {
  const { selected } = useApp();
  const y = selected?.year ?? data.latest.year;
  return y >= 2012 ? y : data.latest.year;
}

function useYearRows(data: CalendarResponse, year: number) {
  return useMemo(() => {
    const out: (MonthRow | undefined)[] = [];
    for (let m = 1; m <= 12; m++) out.push(data.months.find((r) => r.year === year && r.month === m));
    return out;
  }, [data, year]);
}

function StepChart({ data, step }: { data: CalendarResponse; step: number }) {
  const { t, lang, palette, setSelected, selected } = useApp();
  const year = useLearnYear(data);
  const rows = useYearRows(data, year);
  const short = t('monthShort').split(',');

  type Series = { key: string; color: string; vals: (number | null)[]; outline?: boolean };
  let title: string;
  let series: Series[];
  const raw = rows.map((r) => (r && r.status !== 'no_data' ? r.raw_points : null));
  const viirs = rows.map((r) => r?.viirs_cell_days ?? null);
  const modis = rows.map((r) => r?.modis_cell_days ?? null);
  const eq = rows.map((r) => r?.harmonized ?? null);
  if (step <= 1) {
    title = t('learn.chart1', { y: year });
    series = [{ key: 'raw', color: ramp(palette, 0.68), vals: raw }];
  } else if (step === 2) {
    title = t('learn.chart3', { y: year });
    series = [
      { key: 'learn.legendViirs', color: ramp(palette, 0.68), vals: viirs },
      { key: 'learn.legendModis', color: TEXT.mute, vals: modis },
    ];
  } else {
    title = t('learn.chart4', { y: year });
    series = [
      { key: 'learn.legendViirs', color: ramp(palette, 0.68), vals: viirs, outline: true },
      { key: 'learn.legendEq', color: ramp(palette, 0.3), vals: eq },
    ];
  }
  // Pasos 3 y 4 comparten eje para que se vea cómo k "encoge" a VIIRS.
  const scaleVals = step <= 1 ? raw : viirs;
  const max = Math.max(1, ...scaleVals.map((v) => v ?? 0), ...series.flatMap((s) => s.vals.map((v) => v ?? 0)));

  const years = Array.from({ length: data.latest.year - 2012 + 1 }, (_, i) => 2012 + i);

  return (
    <section className="panel flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="heading">{title}</h2>
        <label className="flex items-center gap-2 font-mono text-xs text-mute">
          {t('learn.year')}
          <select
            value={year}
            onChange={(e) => setSelected({ year: Number(e.target.value), month: selected?.month ?? data.latest.month })}
            className="rounded border border-line bg-panel px-2 py-1 text-ink"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="flex flex-1 flex-col justify-end px-4 pb-4 pt-6">
        <div className="flex h-[380px] items-end gap-2 border-b border-line-2" role="img"
          aria-label={`${title}: ${series
            .map((s) => `${t(s.key)} ${s.vals.map((v, i) => `${short[i]} ${v === null ? '—' : fmtNum(lang, v)}`).join(', ')}`)
            .join('; ')}`}
        >
          {rows.map((r, i) => (
            <div key={i} className="relative flex h-full flex-1 items-end justify-center gap-[3px]">
              {series.map((s) => {
                const v = s.vals[i];
                if (v === null || !r)
                  return <div key={s.key} className="hatch h-6 flex-1 rounded-t-sm opacity-60" title={t('status.no_data')} />;
                return (
                  <div
                    key={s.key}
                    title={`${t(`month.${i + 1}`)}: ${fmtNum(lang, v, 1)}`}
                    className={`flex-1 rounded-t-sm transition-[height] duration-500 ${s.outline ? 'absolute inset-x-[10%] bottom-0 border-2 border-dashed' : 'relative'}`}
                    style={{
                      height: `${(v / max) * 100}%`,
                      background: s.outline ? 'transparent' : s.color,
                      borderColor: s.outline ? s.color : undefined,
                      minHeight: v > 0 ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 font-mono text-xs text-mute">
          {short.map((s, i) => (
            <span key={i} className="flex-1 text-center">
              {s}
            </span>
          ))}
        </div>
        {series.length > 1 && (
          <div className="mt-3 flex gap-4 text-xs text-mute">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: s.outline ? 'transparent' : s.color, border: s.outline ? `2px dashed ${s.color}` : undefined }}
                />
                {t(s.key)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StepNote({ data, step }: { data: CalendarResponse; step: number }) {
  const { t, lang, selected } = useApp();
  const year = useLearnYear(data);
  const yr = data.years.find((y) => y.year === year);
  const month = selected?.month ?? data.latest.month;
  const mrow = data.months.find((r) => r.year === year && r.month === month);
  const cal = data.calibration;

  let title = '';
  let body = '';
  if (step === 0) {
    title = t('learn.n1', { n: fmtNum(lang, yr?.raw_points ?? 0), y: year });
    body = t('learn.n1d');
  } else if (step === 1) {
    title = t('learn.n2');
    body = t('learn.n2d');
  } else if (step === 2) {
    title = `${t(`month.${month}`)} ${year}: ${t('learn.n3', {
      v: mrow?.viirs_cell_days === null || !mrow ? '—' : fmtNum(lang, mrow.viirs_cell_days),
      m: mrow?.modis_cell_days === null || !mrow ? '—' : fmtNum(lang, mrow.modis_cell_days),
    })}`;
    body = t('learn.n3d');
  } else {
    title = t('learn.n4', {
      m: fmtNum(lang, cal.modis_cell_days),
      v: fmtNum(lang, cal.viirs_cell_days),
      k: fmtNum(lang, cal.k, 3),
    });
    body = `${t('learn.n4d')} ${t('val.example', { k: fmtNum(lang, cal.k, 3), r: fmtNum(lang, 100 * cal.k, 1) })}`;
  }

  return (
    <section className={`panel px-4 py-3 ${step === 3 ? 'border-cyan' : ''}`} aria-live="polite">
      <p className="font-mono text-[13px] text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-mute">{body}</p>
    </section>
  );
}

const QUIZ = [
  { q: 'quiz.q1', opts: ['quiz.q1a', 'quiz.q1b', 'quiz.q1c'], ok: 0, why: 'quiz.q1e' },
  { q: 'quiz.q2', opts: ['quiz.q2a', 'quiz.q2b', 'quiz.q2c'], ok: 0, why: 'quiz.q2e' },
  { q: 'quiz.q3', opts: ['quiz.q3b', 'quiz.q3a', 'quiz.q3c'], ok: 1, why: 'quiz.q3e' },
];

function Quiz() {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const q = QUIZ[i];
  const right = checked && pick === q.ok;

  return (
    <section className="panel px-4 py-4">
      <p className="kicker">{t('quiz.kicker', { i: i + 1, n: QUIZ.length })}</p>
      <fieldset className="mt-2">
        <legend className="text-[19px] leading-snug">{t(q.q)}</legend>
        <div className="mt-3 space-y-2">
          {q.opts.map((o, k) => (
            <label
              key={o}
              className={`flex cursor-pointer gap-2 rounded border px-3 py-2 text-[13.5px] ${
                checked && k === q.ok ? 'border-cyan bg-cyan-deep' : pick === k ? 'border-line-2 bg-panel-2' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name={`quiz-${i}`}
                checked={pick === k}
                disabled={checked}
                onChange={() => setPick(k)}
                className="mt-0.5 accent-cyan-400"
              />
              {t(o)}
            </label>
          ))}
        </div>
      </fieldset>
      {checked && (
        <p role="status" className={`mt-3 text-[13px] ${right ? 'text-cyan' : 'text-warn'}`}>
          {right ? t('quiz.ok') + ' ' : t('quiz.bad')}
          <span className="text-ink">{t(q.why)}</span>
        </p>
      )}
      <button
        type="button"
        className="btn btn-on mt-3 w-full py-3 text-base uppercase"
        disabled={!checked && pick === null}
        onClick={() => {
          if (!checked) return setChecked(true);
          setChecked(false);
          setPick(null);
          setI((i + 1) % QUIZ.length);
        }}
      >
        {!checked ? t('quiz.check') : i === QUIZ.length - 1 ? t('quiz.restart') : t('quiz.next')}
      </button>
    </section>
  );
}
