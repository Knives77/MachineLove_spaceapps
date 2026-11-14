// Generador de calendarios DEMO (forma exacta de docs/contracts/api.md, valores INVENTADOS).
// Lo usan scripts/make-demo-mocks.mjs (para escribir los JSON de los presets) y src/api.ts
// (solo con mocks, para áreas dibujadas). La app conectada a la API real nunca lo usa.
// Reglas copiadas de docs/contracts/harmonization.md (banderas, línea base, status, scope de k).
// Sin imports de valores: Node 24 lo ejecuta tal cual desde el script.
import type { CalendarResponse, Flag, MonthRow, YearRow } from '../types';

export interface DemoParams {
  id?: string; // preset; vacío = área dibujada
  country: 'MX' | 'AR';
  area: number; // km²
  k: number;
  countryK?: number; // k del país, si el área tiene poco traslape
  seed: number;
  amp: number;
  season: number[]; // 12 pesos
  loyo: [number, number, number];
}

const LATEST = { year: 2026, month: 10 };
const FIRMS_MODIS_OUTAGES = new Set(['2001-6', '2001-7', '2007-8', '2009-4']);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Calendario DEMO con la forma de api.md. Valores INVENTADOS; solo para maquetar sin backend. */
export function buildDemo(p: DemoParams): CalendarResponse {
  const rand = rng(p.seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const yearFactor: Record<number, number> = {};
  for (let y = 2000; y <= 2026; y++) yearFactor[y] = Math.exp(0.35 * gauss());

  const months: MonthRow[] = [];
  for (let y = 2000; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const flags: Flag[] = [];
      const afterLatest = y > LATEST.year || (y === LATEST.year && m > LATEST.month);
      const noCoverage =
        (p.country === 'AR' && y === 2026 && m !== 7 && m !== 8) ||
        (y === 2026 && m === 12);
      if (y < 2002 || (y === 2002 && m < 7)) flags.push('terra_only');
      if (FIRMS_MODIS_OUTAGES.has(`${y}-${m}`)) flags.push('modis_outage');
      if (y === 2024 && m === 6 && p.country === 'MX') flags.push('viirs_outage');
      if (y === 2026 && m >= 9 && !noCoverage) flags.push('nrt');
      if (afterLatest && !noCoverage) flags.push('partial_month');
      if (noCoverage) flags.push('no_coverage');

      let harmonized: number | null = null;
      let modis: number | null = null;
      let viirs: number | null = null;
      let raw = 0;
      if (!noCoverage) {
        const base = p.amp * 12 * p.season[m - 1] * yearFactor[y];
        let h = Math.max(0, base * Math.exp(0.55 * gauss()) - 1.5);
        if (afterLatest) h *= 0.4;
        if (flags.includes('terra_only')) h *= 0.75;
        h = Math.round(h);
        modis = h;
        harmonized = h;
        const hasViirs = y > 2012 || (y === 2012 && m >= 2);
        if (hasViirs) viirs = Math.round((h / p.k) * Math.exp(0.15 * gauss()));
        raw = hasViirs
          ? Math.round((viirs ?? 0) * (2.6 + rand()) + h * 1.1)
          : Math.round(h * (1.05 + 0.1 * rand()));
      }
      months.push({
        year: y, month: m,
        harmonized: harmonized === null ? null : r1(harmonized),
        source: harmonized === null ? null : 'modis',
        raw_points: raw,
        modis_cell_days: modis,
        viirs_cell_days: viirs,
        baseline: null,
        anomaly_ratio: null,
        status: 'no_data',
        flags,
      });
    }
  }

  const EXCLUDE = new Set<Flag>(['modis_outage', 'viirs_outage', 'partial_month', 'no_coverage']);
  const usable = (r: MonthRow) => r.harmonized !== null && !r.flags.some((f) => EXCLUDE.has(f));
  for (const row of months) {
    if (row.harmonized === null) continue;
    const others = months
      .filter((o) => o.month === row.month && o.year !== row.year && usable(o))
      .map((o) => o.harmonized as number)
      .sort((a, b) => a - b);
    if (others.length < 10) {
      row.status = 'insufficient_baseline';
      continue;
    }
    const b = {
      median: r1(quantile(others, 0.5)),
      p25: r1(quantile(others, 0.25)),
      p75: r1(quantile(others, 0.75)),
      p90: r1(quantile(others, 0.9)),
      n_years: others.length,
    };
    row.baseline = b;
    const h = row.harmonized;
    row.anomaly_ratio = b.median === 0 ? null : Math.round((h / b.median) * 100) / 100;
    row.status = h < b.p25 ? 'below' : h <= b.p75 ? 'normal' : h <= b.p90 ? 'above' : 'critical';
  }

  const years: YearRow[] = [];
  for (let y = 2000; y <= 2026; y++) {
    const rows = months.filter((r) => r.year === y);
    const complete = rows.every((r) => r.harmonized !== null && !r.flags.includes('partial_month'));
    years.push({
      year: y,
      harmonized: r1(rows.reduce((s, r) => s + (r.harmonized ?? 0), 0)),
      raw_points: rows.reduce((s, r) => s + r.raw_points, 0),
      complete,
    });
  }

  const byMonth = Array(12).fill(0);
  for (const r of months) if (usable(r)) byMonth[r.month - 1] += r.harmonized as number;
  const total = byMonth.reduce((a, b) => a + b, 0) || 1;
  const seasonality = byMonth.map((v) => Math.round((v / total) * 100) / 100);

  const overlap = months.filter(
    (r) => (r.year > 2012 || (r.year === 2012 && r.month >= 2)) && r.year <= 2025 && usable(r),
  );
  const mSum = overlap.reduce((s, r) => s + (r.modis_cell_days ?? 0), 0);
  const vSum = overlap.reduce((s, r) => s + (r.viirs_cell_days ?? 0), 0);

  // harmonization.md: con ΣM < 100 en el traslape se usa el k del país (scope = "country").
  const scope = mSum < 100 && p.countryK !== undefined ? 'country' : 'aoi';
  const k = scope === 'country' ? p.countryK! : Math.round((mSum / vSum) * 1000) / 1000;

  return {
    _note:
      'DEMO generado por web/scripts/make-demo-mocks.mjs. Forma del contrato; valores INVENTADOS para maquetar.',
    aoi: p.id ? { preset_id: p.id, area_km2: p.area, country: p.country } : { area_km2: p.area, country: p.country },
    range: { start_year: 2000, end_year: 2026 },
    basis: 'modis_primary',
    unit: 'modis_equivalent_cell_days',
    calibration: {
      k,
      scope,
      overlap_months: overlap.length,
      modis_cell_days: mSum,
      viirs_cell_days: vSum,
      loyo_annual_mape: p.loyo[0],
      loyo_annual_max: p.loyo[1],
      monthly_mape: p.loyo[2],
    },
    months,
    years,
    seasonality,
    // "último mes completo con dato" (api.md)
    latest: (({ year, month }) => ({ year, month }))(
      months.filter((r) => r.harmonized !== null && !r.flags.includes('partial_month')).at(-1)!,
    ),
  };
}
