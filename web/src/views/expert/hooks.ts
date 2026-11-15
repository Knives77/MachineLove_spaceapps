// Estado de la consola que no es de datos: paneles abiertos y ancho de pantalla.
import { useEffect, useState } from 'react';

/** Panel abierto u oculto, recordado entre sesiones. */
export function usePanel(key: string) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== '0';
    } catch {
      return true;
    }
  });
  const set = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      /* sin storage */
    }
  };
  return [open, set] as const;
}

/** Pantallas anchas (proyector): paneles un poco más grandes. */
export function useWide() {
  const [wide, setWide] = useState(() => window.innerWidth >= 1700);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 1700);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}
