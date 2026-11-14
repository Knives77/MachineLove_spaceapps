import { usingMocks } from '../api';
import { useApp } from '../state';
import type { Tab } from '../types';
import { Segmented } from './ui';

const TABS: Tab[] = ['general', 'learn', 'edu', 'expert'];

export function TopBar() {
  const { t, tab, setTab, lang, setLang, mode, setMode, palette, setPalette, presets, aoi, setAoi, presetName } =
    useApp();

  const regionValue = 'preset_id' in aoi ? aoi.preset_id : '__drawn';

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/95 px-4 py-2">
      <div className="mr-2 min-w-[170px]">
        <p className="text-[15px] font-semibold tracking-[0.18em] uppercase">{t('app.name')}</p>
        <p className="kicker text-[10px]">
          {t('app.subtitle')}
          {usingMocks && <span className="ml-2 text-cyan">· {t('demo')}</span>}
        </p>
      </div>

      <nav role="tablist" aria-label={t('top.views')} className="flex rounded border border-line bg-panel p-1">
        {TABS.map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`view-${id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const i = TABS.indexOf(tab);
                const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }}
              className={`rounded border px-3 py-1.5 text-[13px] uppercase tracking-wide transition-colors ${
                on ? 'border-cyan bg-cyan-deep text-ink' : 'border-transparent text-mute hover:text-ink'
              }`}
            >
              {t(`tab.${id}`)}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded border border-line bg-panel px-3 py-1.5">
          <span className="kicker text-[10px]">{t('top.region')}</span>
          <select
            value={regionValue}
            onChange={(e) => e.target.value !== '__drawn' && setAoi({ preset_id: e.target.value })}
            className="max-w-[150px] bg-transparent font-mono text-xs text-ink outline-none"
          >
            {presets.state === 'ok' &&
              presets.data.features.map((f) => (
                <option key={f.id} value={f.id} className="bg-panel">
                  {presetName(f)}
                </option>
              ))}
            {regionValue === '__drawn' && (
              <option value="__drawn" className="bg-panel">
                {t('top.drawn')}
              </option>
            )}
          </select>
        </label>

        <Segmented
          label={t('top.mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'harmonized', label: t('mode.harmonized') },
            { value: 'raw', label: t('mode.raw') },
          ]}
        />
        <Segmented
          label={t('top.lang')}
          value={lang}
          onChange={setLang}
          size="sm"
          options={[
            { value: 'es', label: 'ES' },
            { value: 'en', label: 'EN' },
          ]}
        />
        <Segmented
          label={t('top.palette')}
          value={palette}
          onChange={setPalette}
          size="sm"
          options={[
            { value: 'inferno', label: t('palette.inferno') },
            { value: 'cividis', label: t('palette.cividis') },
          ]}
        />
      </div>
    </header>
  );
}
