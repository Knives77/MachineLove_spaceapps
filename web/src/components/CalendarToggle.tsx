import { useState } from 'react';
import { useApp } from '../state';

const KEY = 'ml.calOpen';

/** Panel del calendario visible u oculto (para dar más espacio al mapa). Se recuerda entre vistas. */
export function useCalOpen() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== '0';
    } catch {
      return true;
    }
  });
  const set = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* sin storage */
    }
  };
  return [open, set] as const;
}

/** Columnas de la vista: la tercera se reduce a una franja cuando el calendario está oculto. */
export const gridCols = (open: boolean) =>
  open
    ? 'xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(400px,460px)]'
    : 'xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_2.75rem]';

/** Botón "Ocultar ›" para la cabecera del panel del calendario. */
export function HideCalendarButton({ onHide }: { onHide: () => void }) {
  const { t } = useApp();
  return (
    <button
      type="button"
      aria-expanded={true}
      aria-controls="cal-panel"
      onClick={onHide}
      title={t('cal.hide')}
      className="btn -mr-1 -mt-1 shrink-0 px-2 py-0.5 font-mono text-[11px] uppercase"
    >
      {t('cal.hide')} ›
    </button>
  );
}

/** Franja vertical que queda en lugar del panel; al hacer clic lo vuelve a mostrar. */
export function CalendarRail({ onShow }: { onShow: () => void }) {
  const { t } = useApp();
  return (
    <button
      type="button"
      aria-expanded={false}
      aria-controls="cal-panel"
      onClick={onShow}
      title={t('cal.show')}
      className="panel flex min-h-[200px] flex-col items-center gap-3 py-3 text-mute hover:border-cyan hover:text-ink xl:sticky xl:top-3 xl:max-h-[calc(100dvh-5.5rem)] xl:self-start"
    >
      <span aria-hidden="true" className="font-mono text-base text-cyan">‹</span>
      <span className="heading text-[11px] [writing-mode:vertical-rl]">{t('cal.title')}</span>
      <span className="sr-only">{t('cal.show')}</span>
    </button>
  );
}
