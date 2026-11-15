// Barra de herramientas flotante del mapa (consola de Experto): un clic por herramienta.
import type { ReactNode } from 'react';
import { useApp } from '../../state';
import type { DrawMode } from './useDrawTool';

export function MapToolbar({
  left,
  compact,
  drawMode,
  coords,
  view3d,
  fire,
  onDraw,
  onCoords,
  on3d,
  onFire,
  onNorth,
  onFit,
  onZoom,
}: {
  /** Posición horizontal (CSS): el centro del espacio visible entre paneles. */
  left: string;
  /** Solo iconos (queda poco mapa visible). */
  compact: boolean;
  drawMode: DrawMode;
  coords: boolean;
  view3d: boolean;
  fire: boolean;
  onDraw: (m: DrawMode) => void;
  onCoords: () => void;
  on3d: () => void;
  onFire: () => void;
  onNorth: () => void;
  onFit: () => void;
  onZoom: (dir: 1 | -1) => void;
}) {
  const { t } = useApp();
  return (
    <div
      role="toolbar"
      aria-label={t('tool.bar')}
      style={{ left }}
      className="hud absolute bottom-7 z-[500] flex -translate-x-1/2 items-stretch gap-0.5 p-1"
    >
      <Tool compact={compact} label={t('tool.rect')} pressed={drawMode === 'rect'} onClick={() => onDraw(drawMode === 'rect' ? null : 'rect')}>
        <rect x="4" y="6" width="16" height="12" rx="1" strokeDasharray="3 2" />
      </Tool>
      <Tool compact={compact} label={t('tool.poly')} pressed={drawMode === 'poly'} onClick={() => onDraw(drawMode === 'poly' ? null : 'poly')}>
        <path d="M5 17 3.5 8.5 12 4l8.5 6L17 19z" />
      </Tool>
      <Tool compact={compact} label={t('tool.coords')} pressed={coords} onClick={onCoords}>
        <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
        <circle cx="12" cy="10.5" r="2.2" />
      </Tool>
      <span aria-hidden="true" className="mx-1 w-px self-stretch bg-line" />
      <Tool compact={compact} label={t('tool.3d')} pressed={view3d} title={t('tool.hint3d')} onClick={on3d}>
        <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" />
      </Tool>
      <Tool compact={compact} label={t('tool.fire')} pressed={fire} title={t('tool.hintFire')} onClick={onFire}>
        <path d="M12 3c1 3.5 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-1.7.7-2.8 1.5-3.8.3 1.5 1 2.3 1.8 2.3C10.5 8.5 10.5 5.5 12 3z" />
      </Tool>
      <Tool compact={compact} label={t('tool.north')} onClick={onNorth}>
        <path d="M12 3 16.5 20 12 16.5 7.5 20z" />
      </Tool>
      <Tool compact={compact} label={t('tool.fit')} onClick={onFit}>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </Tool>
      <span aria-hidden="true" className="mx-1 w-px self-stretch bg-line" />
      <Tool compact={compact} label={t('tool.zoomOut')} onClick={() => onZoom(-1)}>
        <path d="M5 12h14" />
      </Tool>
      <Tool compact={compact} label={t('tool.zoomIn')} onClick={() => onZoom(1)}>
        <path d="M5 12h14M12 5v14" />
      </Tool>
    </div>
  );
}

/** Botón de la barra flotante: icono de trazo + etiqueta corta. */
function Tool({
  label,
  compact,
  pressed,
  title,
  onClick,
  children,
}: {
  label: string;
  compact?: boolean;
  pressed?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`tool ${compact ? '!min-w-0 !px-2 !py-1.5' : ''}`} aria-pressed={pressed} aria-label={label} title={title ?? label} onClick={onClick}>
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {!compact && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}
