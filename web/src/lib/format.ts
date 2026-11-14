import type { Lang, MonthRow } from '../types';

export const fmtNum = (lang: Lang, v: number, digits = 0) =>
  v.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

export const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${Math.round(v * 100)}`;

export const ymKey = (y: number, m: number) => y * 100 + m;

export function indexMonths(rows: MonthRow[]): Map<number, MonthRow> {
  const map = new Map<number, MonthRow>();
  for (const r of rows) map.set(ymKey(r.year, r.month), r);
  return map;
}

/** Último día del mes en YYYY-MM-DD (para pedir hotspots del mes elegido). */
export function monthRange(y: number, m: number): [string, string] {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, '0')}`];
}
