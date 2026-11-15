import { useCallback, useEffect, useRef } from 'react';

/** Métodos que expone cada icono de lucide-animated por ref. */
export interface IconAnimHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/**
 * Conecta un icono animado con su botón. Con el ref puesto, el icono deja de animarse con su
 * propio hover y lo controla el botón completo:
 *   - `trigger`: hover, foco con teclado o toque del BOTÓN → una animación (sin bucles).
 *   - `pulse()`: una animación desde código (clic, descarga terminada, aviso que aparece).
 * `prefers-reduced-motion` lo respeta <MotionConfig reducedMotion="user"> en App.tsx.
 */
export function useIconAnim() {
  const ref = useRef<IconAnimHandle>(null);
  const timer = useRef<number | undefined>(undefined);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    ref.current?.startAnimation();
  }, []);
  const stop = useCallback(() => ref.current?.stopAnimation(), []);
  const pulse = useCallback(
    (ms = 650) => {
      start();
      timer.current = window.setTimeout(stop, ms);
    },
    [start, stop],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    ref,
    start,
    stop,
    pulse,
    trigger: {
      onMouseEnter: start,
      onMouseLeave: stop,
      onFocus: start,
      onBlur: stop,
      onTouchStart: () => pulse(),
    },
  };
}
