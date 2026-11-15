// Regiones de ejemplo como fichas: cada una lleva su silueta dentro del marco común de todas, para
// elegir por forma y lugar y no solo por nombre. La geometría es la de /presets.
import { useMemo } from 'react';
import { useApp } from '../../state';
import type { PresetFeature } from '../../types';

const S = 22; // lado del localizador (px)

export function Regions({ names }: { /** Mostrar el nombre junto a la silueta (si hay espacio). */ names: boolean }) {
  const { t, presets, aoi, setAoi, presetName } = useApp();
  const selectedId = 'preset_id' in aoi ? aoi.preset_id : null;
  const features: PresetFeature[] = presets.state === 'ok' ? presets.data.features : [];

  // Marco común (todas las regiones) → cada anillo como puntos SVG. Norte arriba.
  const shapes = useMemo(() => {
    const rings = features.map((f) => f.geometry.coordinates[0] as number[][]);
    const xs = rings.flat().map((p) => p[0]);
    const ys = rings.flat().map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = (S - 4) / Math.max(x1 - x0, y1 - y0, 1e-9);
    const ox = (S - (x1 - x0) * k) / 2;
    const oy = (S - (y1 - y0) * k) / 2;
    return rings.map((r) => r.map(([x, y]) => `${(ox + (x - x0) * k).toFixed(1)},${(oy + (y1 - y) * k).toFixed(1)}`).join(' '));
  }, [features]);

  return (
    <div role="group" aria-label={t('map.presets')} className="flex min-w-0 items-stretch gap-1">
      {features.map((f, i) => {
        const on = f.id === selectedId;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            aria-label={presetName(f)}
            title={`${presetName(f)} · ${i + 1}`}
            onClick={() => setAoi({ preset_id: f.id })}
            className={`group flex h-9 min-w-0 items-center gap-2 rounded-[3px] border px-2 font-display text-[12px] transition-colors ${
              on ? 'border-cyan bg-cyan-deep text-select' : 'border-transparent text-mute hover:border-line-2 hover:text-ink'
            }`}
          >
            <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true" className="shrink-0">
              {shapes.map((pts, j) => j !== i && <polygon key={j} points={pts} className="fill-none stroke-line-2" strokeWidth="1" />)}
              <polygon
                points={shapes[i]}
                strokeWidth="1.2"
                className={on ? 'fill-cyan/25 stroke-cyan' : 'fill-mute/15 stroke-mute transition-colors group-hover:stroke-ink'}
              />
            </svg>
            {names && <span className="max-w-[9.5rem] truncate">{presetName(f)}</span>}
            <kbd aria-hidden="true" className="rounded-sm border border-line-2 px-1 font-mono text-[10px] text-mute">
              {i + 1}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
