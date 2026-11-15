import { animate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Número que rueda del valor anterior al nuevo (600 ms). Solo anima la presentación:
 * el valor final es exactamente el que se recibe. Con cifras tabulares no cambia de ancho.
 */
export function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const ctl = animate(from.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
      onComplete: () => {
        from.current = value;
        setShown(value);
      },
    });
    return () => ctl.stop();
  }, [value]);
  return <span className="tabular-nums">{format(shown)}</span>;
}
