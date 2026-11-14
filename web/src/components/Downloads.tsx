import { useState } from 'react';
import { downloadAoiGeoJson, downloadCalendarCsv, downloadHotspotsCsv } from '../api';
import { monthRange } from '../lib/format';
import { errorText, useApp } from '../state';
import { ApiError } from '../types';

export function Downloads({ compact = false }: { compact?: boolean }) {
  const { t, aoi, aoiName, selected, presets } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sel = selected;

  async function run(id: string, fn: () => Promise<void> | void) {
    setBusy(id);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.code : 'network');
    } finally {
      setBusy(null);
    }
  }

  const geometry =
    'geometry' in aoi
      ? aoi.geometry
      : presets.state === 'ok'
        ? presets.data.features.find((f) => f.id === aoi.preset_id)?.geometry
        : undefined;
  const slug = 'preset_id' in aoi ? aoi.preset_id : 'polygon';

  return (
    <div>
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mb-2'}`}>
        <button type="button" className="btn btn-on font-mono" disabled={busy !== null}
          onClick={() => run('cal', () => downloadCalendarCsv({ aoi, start_year: 2000, end_year: 2026, basis: 'modis_primary' }))}
        >
          {busy === 'cal' ? t('loading') : t('dl.calendar')}
        </button>
        {sel && (
          <button type="button" className="btn font-mono" disabled={busy !== null}
            onClick={() => {
              const [start_date, end_date] = monthRange(sel.year, sel.month);
              return run('hot', () => downloadHotspotsCsv({ aoi, start_date, end_date }));
            }}
          >
            {busy === 'hot' ? t('loading') : t('dl.hotspots', { m: `${t(`month.${sel.month}`).slice(0, 3)} ${sel.year}` })}
          </button>
        )}
        <button type="button" className="btn font-mono" disabled={!geometry}
          onClick={() => geometry && downloadAoiGeoJson(geometry, slug)}
          title={aoiName}
        >
          {t('dl.geojson')}
        </button>
      </div>
      {!compact && <p className="text-[12.5px] text-mute">{t('dl.note')}</p>}
      {err && (
        <p role="alert" className="mt-2 text-[12.5px] text-warn">
          {errorText(t, err)}
        </p>
      )}
    </div>
  );
}
