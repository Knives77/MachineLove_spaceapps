import { useApp } from '../state';

/**
 * "Simular fin de MODIS": cambia `basis` a `viirs_primary` y la API recalcula la serie con VIIRS × k
 * desde 2012-02 (harmonization.md). El front no calcula nada: solo pide la otra serie.
 * Botón grande a propósito: en la presentación lo presiona un juez.
 */
export function ModisSwitch({ k: kProp }: { k?: number }) {
  const { t, lang, basis, setBasis, mode, calendar } = useApp();
  const k = kProp ?? (calendar.state === 'ok' ? calendar.data.calibration.k : undefined);
  const off = basis === 'viirs_primary';
  const disabled = mode !== 'harmonized';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-pressed={off}
        aria-label={t('basis.label')}
        disabled={disabled}
        onClick={() => setBasis(off ? 'modis_primary' : 'viirs_primary')}
        className={`rounded border-2 px-4 py-2 font-mono text-sm font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          off ? 'border-cyan bg-cyan-deep text-ink' : 'border-warn text-warn hover:bg-warn/10'
        }`}
      >
        {off ? `⏻ ${t('basis.on')}` : `⏻ ${t('basis.off')}`}
      </button>
      <p className="min-w-0 flex-1 text-[12.5px] text-mute">
        {disabled
          ? t('basis.rawOff')
          : off
            ? t('basis.active', { k: k === undefined ? '—' : k.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
            : t('basis.idle')}
      </p>
    </div>
  );
}
