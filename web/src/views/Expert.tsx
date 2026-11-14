import { useState } from 'react';
import { ALL_LAYERS, Calendar, type Layers } from '../components/Calendar';
import { Downloads } from '../components/Downloads';
import { KInspector } from '../components/KInspector';
import { MapPanel } from '../components/MapPanel';
import { MonthSeries } from '../components/MonthSeries';
import { Panel, Skeleton, Switch } from '../components/ui';
import { useApp } from '../state';
import { WithCalendar } from './WithCalendar';

export function Expert() {
  const { t, mode, setMode, presets, aoi, setAoi, presetName, selected, aoiName } = useApp();
  const [layers, setLayers] = useState<Layers>(ALL_LAYERS);
  const set = (k: keyof Layers) => (v: boolean) => setLayers({ ...layers, [k]: v });
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(400px,460px)]">
      <div className="space-y-3">
        <Panel title={t('exp.layers')}>
          <div className="px-4 py-2">
            <Switch checked={mode === 'raw'} onChange={(v) => setMode(v ? 'raw' : 'harmonized')} label={`${t('mode.raw')} (raw_points)`} />
            <Switch checked={mode === 'harmonized'} onChange={(v) => setMode(v ? 'harmonized' : 'raw')} label={`${t('mode.harmonized')} (${t('unit.cellDays')})`} />
            <Switch checked={layers.marks} onChange={set('marks')} label={t('exp.layer.marks')} />
            <Switch checked={layers.nodata} onChange={set('nodata')} label={t('exp.layer.nodata')} />
            <Switch checked={layers.flags} onChange={set('flags')} label={t('exp.layer.flags')} />
          </div>
        </Panel>
        <Panel
          title={t('val.title')}
          right={
            presets.state === 'ok' && (
              <div className="flex flex-wrap justify-end gap-1">
                {presets.data.features.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={f.id === selectedId}
                    onClick={() => setAoi({ preset_id: f.id })}
                    className={`btn px-2 py-0.5 font-mono text-[10.5px] uppercase ${f.id === selectedId ? 'btn-on' : ''}`}
                  >
                    {presetName(f).split(',')[0]}
                  </button>
                ))}
              </div>
            )
          }
        >
          <div className="px-4 py-3">
            <WithCalendar skeleton={<Skeleton className="h-64" />}>{(d) => <KInspector cal={d.calibration} />}</WithCalendar>
          </div>
        </Panel>
      </div>

      <MapPanel className="min-h-[420px]" />

      <WithCalendar skeleton={<Skeleton className="h-[600px]" />}>
        {(d) => (
          <Panel title={t('cal.title')} sub={t('cal.sub', { n: d.range.end_year - d.range.start_year + 1, unit: mode === 'harmonized' ? t('unit.cellDays') : t('unit.points') })}>
            <div className="p-3">
              <Calendar data={d} layers={layers} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[12.5px]">
                <dt className="hatch h-4 w-7 rounded-sm" />
                <dd>NaN = {t('legend.nodata')}</dd>
                <dt className="flex h-4 w-7 items-center justify-center rounded-sm bg-zero font-mono text-[10px] text-mute">0</dt>
                <dd>0 = {t('legend.zero')}</dd>
              </dl>
            </div>
          </Panel>
        )}
      </WithCalendar>

      <div className="grid gap-3 xl:col-span-3 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <WithCalendar skeleton={<Skeleton className="h-48" />}>
          {(d) => {
            const m = selected?.month ?? d.latest.month;
            return (
              <Panel title={t('exp.series', { m: t(`month.${m}`), region: aoiName })} sub={t('exp.seriesHint')}>
                <div className="px-4 py-3">
                  <MonthSeries data={d} month={m} height={140} />
                </div>
              </Panel>
            );
          }}
        </WithCalendar>
        <Panel title={t('dl.title')}>
          <div className="px-4 py-3">
            <Downloads />
          </div>
        </Panel>
      </div>
    </div>
  );
}
