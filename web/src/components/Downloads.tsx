import { useState, type ReactNode } from 'react';
import { downloadAoiGeoJson, downloadCalendarCsv, downloadHotspotsCsv } from '../api';
import { monthRange } from '../lib/format';
import { errorText, useApp } from '../state';
import { ApiError } from '../types';
import { DownloadIcon } from './icons/download';
import { useIconAnim } from './icons/useIconAnim';

export function Downloads({ compact = false }: { compact?: boolean }) {
  const { t, aoi, aoiName, selected, presets, basis } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sel = selected;

  /** Ejecuta una descarga; devuelve true si terminó bien (para animar el icono). */
  async function run(id: string, fn: () => Promise<void> | void): Promise<boolean> {
    setBusy(id);
    setErr(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setErr(e instanceof ApiError ? e.code : 'network');
      return false;
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
        <DlButton
          primary
          disabled={busy !== null}
          onRun={() => run('cal', () => downloadCalendarCsv({ aoi, start_year: 2000, end_year: 2026, basis }))}
        >
          {busy === 'cal' ? t('loading') : t('dl.calendar')}
        </DlButton>
        {sel && (
          <DlButton
            disabled={busy !== null}
            onRun={() => {
              const [start_date, end_date] = monthRange(sel.year, sel.month);
              return run('hot', () => downloadHotspotsCsv({ aoi, start_date, end_date }));
            }}
          >
            {busy === 'hot' ? t('loading') : t('dl.hotspots', { m: `${t(`month.${sel.month}`).slice(0, 3)} ${sel.year}` })}
          </DlButton>
        )}
        <DlButton disabled={!geometry} title={aoiName} onRun={() => run('geo', () => geometry && downloadAoiGeoJson(geometry, slug))}>
          {t('dl.geojson')}
        </DlButton>
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

/** Botón de descarga: el icono se anima al pasar el cursor y otra vez al terminar la descarga. */
function DlButton({
  primary = false,
  disabled,
  title,
  onRun,
  children,
}: {
  primary?: boolean;
  disabled?: boolean;
  title?: string;
  onRun: () => Promise<boolean>;
  children: ReactNode;
}) {
  const icon = useIconAnim();
  return (
    <button
      type="button"
      className={`btn flex items-center gap-2 font-mono ${primary ? 'btn-on' : ''}`}
      disabled={disabled}
      title={title}
      {...icon.trigger}
      onClick={async () => {
        if (await onRun()) icon.pulse();
      }}
    >
      <DownloadIcon ref={icon.ref} size={15} aria-hidden="true" className="flex" />
      {children}
    </button>
  );
}
