// Genera mocks DEMO completos (2000–2026, 324 meses) con la forma exacta de
// docs/contracts/api.md, para maquetar sin backend. Los valores son INVENTADOS:
// solo sirven para ver la interfaz llena. La app real nunca usa este script.
//
//   node scripts/make-demo-mocks.mjs
//
// Reglas copiadas de docs/contracts/harmonization.md (banderas, línea base, status).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks');

const PRESETS = [
  {
    id: 'qro-sierra-gorda', country: 'MX', area: 14790.2, k: 0.262, seed: 11, amp: 26,
    season: [0.03, 0.06, 0.16, 0.27, 0.25, 0.08, 0.03, 0.02, 0.01, 0.01, 0.03, 0.05],
    loyo: [0.147, 0.426, 0.388],
  },
  {
    id: 'qro-bajio', country: 'MX', area: 14140.6, k: 0.293, seed: 23, amp: 40,
    season: [0.06, 0.12, 0.2, 0.22, 0.17, 0.05, 0.02, 0.02, 0.02, 0.03, 0.04, 0.05],
    loyo: [0.068, 0.191, 0.297],
  },
  {
    id: 'ar-chilecito', country: 'AR', area: 24020.8, k: 0.395, seed: 37, amp: 30,
    season: [0.02, 0.02, 0.02, 0.03, 0.04, 0.06, 0.1, 0.16, 0.2, 0.18, 0.11, 0.06],
    loyo: [0.237, 0.612, 0.455],
  },
];

const LATEST = { year: 2026, month: 10 };
const FIRMS_MODIS_OUTAGES = new Set(['2001-6', '2001-7', '2007-8', '2009-4']);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const r1 = (x) => Math.round(x * 10) / 10;

function build(p) {
  const rand = rng(p.seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const yearFactor = {};
  for (let y = 2000; y <= 2026; y++) yearFactor[y] = Math.exp(0.35 * gauss());

  const months = [];
  for (let y = 2000; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const flags = [];
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

      let harmonized = null;
      let modis = null;
      let viirs = null;
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

  const EXCLUDE = new Set(['modis_outage', 'viirs_outage', 'partial_month', 'no_coverage']);
  const usable = (r) => r.harmonized !== null && !r.flags.some((f) => EXCLUDE.has(f));
  for (const row of months) {
    if (row.harmonized === null) continue;
    const others = months
      .filter((o) => o.month === row.month && o.year !== row.year && usable(o))
      .map((o) => o.harmonized)
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
    row.anomaly_ratio = b.median === 0 ? null : Math.round((row.harmonized / b.median) * 100) / 100;
    const h = row.harmonized;
    row.status = h < b.p25 ? 'below' : h <= b.p75 ? 'normal' : h <= b.p90 ? 'above' : 'critical';
  }

  const years = [];
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
  for (const r of months) if (usable(r)) byMonth[r.month - 1] += r.harmonized;
  const total = byMonth.reduce((a, b) => a + b, 0) || 1;
  const seasonality = byMonth.map((v) => Math.round((v / total) * 100) / 100);

  const overlap = months.filter(
    (r) => (r.year > 2012 || (r.year === 2012 && r.month >= 2)) && r.year <= 2025 && usable(r),
  );
  const mSum = overlap.reduce((s, r) => s + r.modis_cell_days, 0);
  const vSum = overlap.reduce((s, r) => s + (r.viirs_cell_days ?? 0), 0);

  return {
    _note:
      'DEMO generado por web/scripts/make-demo-mocks.mjs. Forma del contrato; valores INVENTADOS para maquetar.',
    aoi: { preset_id: p.id, area_km2: p.area, country: p.country },
    range: { start_year: 2000, end_year: 2026 },
    basis: 'modis_primary',
    unit: 'modis_equivalent_cell_days',
    calibration: {
      k: Math.round((mSum / vSum) * 1000) / 1000,
      scope: 'aoi',
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
      months.filter((r) => r.harmonized !== null && !r.flags.includes('partial_month')).at(-1),
    ),
  };
}

for (const p of PRESETS) {
  const file = join(OUT, `calendar.demo.${p.id}.json`);
  writeFileSync(file, JSON.stringify(build(p)) + '\n');
  console.log('escrito', file);
}
