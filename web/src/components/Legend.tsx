import type { ReactNode } from 'react';
import { INK_LIGHT, inkOn, rampGradient, statusColor } from '../lib/color';
import { fmtNum } from '../lib/format';
import { useApp } from '../state';
import type { Status } from '../types';
import { levelAccent } from './YearView';

/**
 * Leyenda de la vista por año: una fila con el color de cada nivel (los mismos acentos de las
 * tarjetas, cambian con la paleta) y una fila discreta con los estados especiales.
 */
export function LevelLegend() {
  const { t, palette } = useApp();
  const levels: Status[] = ['below', 'normal', 'above', 'critical'];
  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-ink/90">
        {levels.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: levelAccent(palette, s) }} />
            {t(`status.${s}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="hatch h-2.5 w-2.5 rounded-[2px]" />
          {t('legend.nodataShort')}
        </li>
      </ul>
      <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-mute">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: levelAccent(palette, 'insufficient_baseline') }} />
          {t('status.insufficient_baseline')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-[10px] text-cyan/80">
            ◥
          </span>
          {t('legend.flagShort')}
        </span>
      </p>
    </div>
  );
}

/** Leyenda de la matriz histórica: muestra los símbolos tal como se ven en las celdas. */
export function Legend({ max }: { max: number }) {
  const { t, lang, mode, palette } = useApp();
  const ticks = [0, 0.25, 1].map((f) => max * f); // posiciones en escala raíz: √0.25 = 50 %
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="kicker">{t('legend.title')}</p>
        <p className="truncate text-[11px] text-mute">{t(`legend.value.${mode}`)}</p>
      </div>
      <div className="mt-1.5 h-2.5 rounded-sm" style={{ background: rampGradient(palette) }} />
      <div className="relative mt-0.5 h-3.5 font-mono text-[10px] text-mute">
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

      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        {mode === 'harmonized' && (
          <>
            <Item swatch={<Cell status="below" mark="↓" />}>{t('legend.below')}</Item>
            <Item swatch={<Cell status="above" mark="•" />}>{t('legend.above')}</Item>
            <Item swatch={<Cell status="critical" mark="••" />}>{t('legend.critical')}</Item>
          </>
        )}
        <Item
          swatch={
            <span className="relative block h-full w-full bg-panel-2">
              <span className="absolute right-0 top-0 h-2 w-2" style={{ background: INK_LIGHT, clipPath: 'polygon(0 0,100% 0,100% 100%)' }} />
            </span>
          }
        >
          {t('legend.flag')}
        </Item>
        <Item swatch={<span className="flex h-full w-full items-center justify-center bg-zero font-mono text-[10px] text-mute">0</span>}>
          {t('legend.zero')}
        </Item>
        <Item swatch={<span className="hatch block h-full w-full" />}>{t('legend.nodata')}</Item>
        <Item swatch={<span className="missing block h-full w-full" />}>{t('legend.missing')}</Item>
      </ul>
      {mode === 'raw' && <p className="mt-1.5 text-[11px] text-warn">{t('legend.rawWarn')}</p>}
    </div>
  );

  /** Muestra de celda con el color del nivel, el símbolo en blanco o negro y el borde de Extremo. */
  function Cell({ status, mark }: { status: Status; mark: string }) {
    const bg = statusColor(palette, status);
    const ink = inkOn(bg);
    return (
      <span
        className="relative flex h-full w-full items-center justify-center font-mono text-[11px] font-bold"
        style={{ background: bg, color: ink }}
      >
        {status === 'critical' && <span className="absolute inset-0 rounded-[2px] border-2" style={{ borderColor: ink }} />}
        {mark}
      </span>
    );
  }
}

function Item({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 leading-tight">
      <span className="h-[16px] w-[26px] shrink-0 overflow-hidden rounded-[2px]">{swatch}</span>
      <span>{children}</span>
    </li>
  );
}
