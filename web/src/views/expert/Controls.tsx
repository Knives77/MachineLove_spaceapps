// Panel izquierdo de la consola.
import { Downloads } from '../../components/Downloads';
import { KInspector } from '../../components/KInspector';
import { ModisSwitch } from '../../components/ModisSwitch';
import { Segmented, Skeleton } from '../../components/ui';
import { useApp } from '../../state';
import type { Mode } from '../../types';
import { WithCalendar } from '../WithCalendar';
import { Kpis } from './Kpis';
import { Section } from './panels';

/** Panel izquierdo: región, datos, indicadores, simulación, descargas y validación. */
export function Controls() {
  const { t, mode, setMode, presets, aoi, setAoi, presetName } = useApp();
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;
  return (
    <>
      <Section title={t('map.presets')}>
        <div className="space-y-1">
          {presets.state === 'ok' &&
            presets.data.features.map((f, i) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === selectedId}
                onClick={() => setAoi({ preset_id: f.id })}
                className={`btn flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] ${f.id === selectedId ? 'btn-on' : ''}`}
              >
                <kbd aria-hidden="true" className="rounded-sm border border-line-2 px-1 font-mono text-[10px] text-mute">
                  {i + 1}
                </kbd>
                <span className="truncate">{presetName(f)}</span>
              </button>
            ))}
        </div>
      </Section>

      <Section title={t('con.master')}>
        <div className="flex">
          <Segmented<Mode>
            label={t('con.master')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'harmonized', label: t('mode.harmonized') },
              { value: 'raw', label: t('mode.raw') },
            ]}
          />
        </div>
        {mode === 'raw' && (
          <p role="note" className="mt-2 flex gap-2 rounded-sm border border-warn/50 bg-warn/5 px-2 py-1.5 text-[11px] leading-snug text-warn">
            <span aria-hidden="true" className="font-mono">!</span>
            {t('con.rawWarn')}
          </p>
        )}
      </Section>

      <WithCalendar skeleton={<Skeleton className="m-3 h-56" />}>
        {(d) => (
          <>
            <Section title={t('con.sec.kpi')}>
              <Kpis data={d} />
            </Section>
            <Section title={t('basis.label')}>
              <ModisSwitch k={d.calibration.k} />
            </Section>
            <Section title={t('dl.title')} open={false}>
              <div className="[&_.btn]:w-full [&_.btn]:px-2 [&_.btn]:py-1.5 [&_.btn]:text-[11px] [&_div]:flex-col">
                <Downloads compact />
              </div>
            </Section>
            <Section title={t('val.title')} open={false}>
              <KInspector cal={d.calibration} />
            </Section>
          </>
        )}
      </WithCalendar>
    </>
  );
}
