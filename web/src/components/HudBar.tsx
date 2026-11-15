import { usingMocks } from '../api';
import { fmtNum } from '../lib/format';
import { useHud } from '../lib/hud';
import { useApp } from '../state';

/**
 * Barra inferior de telemetría (28 px): fuente de los datos, coordenadas bajo el cursor, área
 * consultada, estado de los sensores y latencia de la última consulta a la API.
 */
export function HudBar() {
  const { t, lang, calendar, basis, selected } = useApp();
  const { cursor, latencyMs, hotspots } = useHud();
  const sel = selected ?? (calendar.state === 'ok' ? calendar.data.latest : null);
  const area = calendar.state === 'ok' ? calendar.data.aoi.area_km2 : null;
  const fix = (v: number) => v.toFixed(4).padStart(9, ' ');
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-drawer px-3 font-mono text-[10.5px] text-mute">
      <p className="min-w-0 flex-1 truncate font-sans text-dim">{t('footer.source')}</p>
      <span className="whitespace-pre">
        {t('hud.cursor')} {cursor ? `${fix(cursor.lat)}, ${fix(cursor.lon)}` : '    —    ,     —    '}
      </span>
      {area !== null && (
        <span className="whitespace-nowrap">
          {t('hud.area')} {fmtNum(lang, area)} km²
        </span>
      )}
      {hotspots && sel && (
        <span className="whitespace-nowrap" aria-live="polite">
          {t('hud.hot', { m: `${t(`month.${sel.month}`).slice(0, 3).toLowerCase()} ${sel.year}` })}{' '}
          {hotspots.state === 'ok' ? (
            <>
              <span className="text-cyan">{fmtNum(lang, hotspots.total)}</span>
              {hotspots.fixed > 0 && <span className="text-dim"> · {t('hud.hot.fixed', { n: fmtNum(lang, hotspots.fixed) })}</span>}
            </>
          ) : (
            <span className={hotspots.state === 'loading' || hotspots.state === 'off' ? 'text-dim' : 'text-warn'}>{t(`hud.hot.${hotspots.state}`)}</span>
          )}
        </span>
      )}
      <span className="hidden whitespace-nowrap min-[1700px]:inline">
        <span className={basis === 'viirs_primary' ? 'text-warn' : ''}>
          {basis === 'viirs_primary' ? t('hud.modisSim') : t('hud.modisOn')}
        </span>
        {' | '}
        {t('hud.snpp')}
        {' | '}
        {t('hud.noaa')}
      </span>
      <span className="whitespace-nowrap">
        {t('hud.api')}{' '}
        <span className="text-ink">{usingMocks ? t('hud.demo') : latencyMs === null ? '—' : `${latencyMs} ms`}</span>
      </span>
    </footer>
  );
}
