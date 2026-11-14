// Única puerta a la API (ver .claude/skills/frontend/SKILL.md).
// VITE_API_URL definido → llama a la API. Vacío → devuelve los mocks de src/mocks/.
// Ningún componente hace fetch directo.
import presetsMock from './mocks/presets.response.json';
import demoSierra from './mocks/calendar.demo.qro-sierra-gorda.json';
import demoBajio from './mocks/calendar.demo.qro-bajio.json';
import demoRecuadro from './mocks/calendar.demo.qro-recuadro.json';
import {
  ApiError,
  type CalendarRequest,
  type CalendarResponse,
  type HotspotsRequest,
  type PresetCollection,
} from './types';

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export const usingMocks = BASE === '';

const DEMO: Record<string, unknown> = {
  'qro-sierra-gorda': demoSierra,
  'qro-bajio': demoBajio,
  'qro-recuadro': demoRecuadro,
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError('network');
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    let detail: string | undefined;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      detail = body?.error?.detail;
    } catch {
      /* cuerpo no JSON */
    }
    throw new ApiError(code, detail);
  }
  return res;
}

const postJson = (path: string, body: unknown) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export async function getPresets(): Promise<PresetCollection> {
  if (usingMocks) {
    await wait(150);
    return presetsMock as PresetCollection;
  }
  return (await request('/presets')).json();
}

export async function getCalendar(req: CalendarRequest): Promise<CalendarResponse> {
  if (usingMocks) {
    await wait(350);
    const id = 'preset_id' in req.aoi ? req.aoi.preset_id : 'qro-sierra-gorda';
    const demo = DEMO[id];
    if (!demo) throw new ApiError('unknown_preset');
    return demo as CalendarResponse;
  }
  return (await postJson('/calendar', req)).json();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filenameFrom(res: Response, fallback: string) {
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  return m?.[1] ?? fallback;
}

const aoiSlug = (req: { aoi: CalendarRequest['aoi'] }) =>
  'preset_id' in req.aoi ? req.aoi.preset_id : 'polygon';

const CALENDAR_CSV_HEADER =
  'year,month,harmonized,source,raw_points,modis_cell_days,viirs_cell_days,baseline_median,baseline_p25,baseline_p75,baseline_p90,anomaly_ratio,status,flags';

const HOTSPOTS_CSV_HEADER =
  'latitude,longitude,acq_date,acq_time,satellite,family,confidence,frp,daynight,type,source,is_vegetation_fire,cell_id';

/** POST /calendar.csv → descarga. Con mocks, arma el CSV con las columnas del contrato. */
export async function downloadCalendarCsv(req: CalendarRequest): Promise<void> {
  const start = req.start_year ?? 2000;
  const end = req.end_year ?? 2026;
  const fallback = `burn_calendar_${aoiSlug(req)}_${start}_${end}.csv`;
  if (usingMocks) {
    const cal = await getCalendar(req);
    const v = (x: unknown) => (x === null || x === undefined ? '' : String(x));
    const rows = cal.months.map((m) =>
      [
        m.year, m.month, v(m.harmonized), v(m.source), m.raw_points,
        v(m.modis_cell_days), v(m.viirs_cell_days),
        v(m.baseline?.median), v(m.baseline?.p25), v(m.baseline?.p75), v(m.baseline?.p90),
        v(m.anomaly_ratio), m.status, m.flags.join('|'),
      ].join(','),
    );
    saveBlob(new Blob([[CALENDAR_CSV_HEADER, ...rows].join('\n') + '\n'], { type: 'text/csv' }), fallback);
    return;
  }
  const res = await postJson('/calendar.csv', req);
  saveBlob(await res.blob(), filenameFrom(res, fallback));
}

/** POST /hotspots.csv → descarga. Con mocks solo hay cabecera (no hay puntos de ejemplo). */
export async function downloadHotspotsCsv(req: HotspotsRequest): Promise<void> {
  const fallback = `hotspots_${aoiSlug(req)}_${req.start_date}_${req.end_date}.csv`;
  if (usingMocks) {
    saveBlob(new Blob([HOTSPOTS_CSV_HEADER + '\n'], { type: 'text/csv' }), fallback);
    return;
  }
  const res = await postJson('/hotspots.csv', req);
  saveBlob(await res.blob(), filenameFrom(res, fallback));
}

/** El área consultada como GeoJSON (no llama a la API: es la geometría que ya tenemos). */
export function downloadAoiGeoJson(geometry: unknown, name: string) {
  const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name }, geometry }] };
  saveBlob(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' }), `${name}.geojson`);
}
