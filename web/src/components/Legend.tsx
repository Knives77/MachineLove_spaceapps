import type { ReactNode } from 'react';
import { rampGradient } from '../lib/color';
import { fmtNum } from '../lib/format';
import { useApp } from '../state';

export function Legend({ max }: { max: number }) {
  const { t, lang, mode, palette } = useApp();
  const ticks = [0, 0.25, 1].map((f) => max * f); // posiciones en escala raíz: √0.25 = 50 %
  return (
    <div>
      <p className="kicker">{t('legend.title')}</p>
      <p className="mt-2 text-[12.5px]">{t(`legend.value.${mode}`)}</p>
      <div className="mt-1 h-3 rounded-sm" style={{ background: rampGradient(palette) }} />
      <div className="relative mt-1 h-4 font-mono text-[10px] text-mute">
        {ticks.map((v, i) => (
          <span
            key={i}
            className="absolute"
            style={{ left: `${Math.sqrt(v / (max || 1)) * 100}%`, transform: i === 0 ? 'none' : i === 2 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {fmtNum(lang, v, 0)}
          </span>
        ))}
      </div>

      <ul className="mt-2 space-y-1.5 text-[12.5px]">
        <Item swatch={<span className="flex h-full w-full items-center justify-center bg-zero font-mono text-[10px] text-mute">0</span>}>
          {t('legend.zero')}
        </Item>
        <Item swatch={<span className="hatch block h-full w-full" />}>{t('legend.nodata')}</Item>
        <Item swatch={<span className="missing block h-full w-full" />}>{t('legend.missing')}</Item>
        {mode === 'harmonized' && (
          <>
            <Item swatch={<Mark>↓</Mark>}>{t('legend.below')}</Item>
            <Item swatch={<Mark>•</Mark>}>{t('legend.above')}</Item>
            <Item swatch={<Mark>••</Mark>}>{t('legend.critical')}</Item>
          </>
        )}
        <Item
          swatch={
            <span className="relative block h-full w-full bg-panel-2">
              <span className="absolute right-0 top-0 h-2 w-2 bg-cyan" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%)' }} />
            </span>
          }
        >
          {t('legend.flag')}
        </Item>
      </ul>
      <p className="mt-2 text-[11.5px] text-warn">{t('legend.rawWarn')}</p>
    </div>
  );
}

function Mark({ children }: { children: string }) {
  return (
    <span className="flex h-full w-full items-center justify-center bg-panel-2 font-mono text-[11px] font-bold text-ink">
      {children}
    </span>
  );
}

function Item({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="h-[18px] w-[30px] shrink-0 overflow-hidden rounded-[2px]">{swatch}</span>
      <span>{children}</span>
    </li>
  );
}
