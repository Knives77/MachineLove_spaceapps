// Panel "Explorar otra zona": dibujar un área o dar un punto (lat, lon) con un radio.
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../../state';
import type { Polygon } from '../../types';
import { PenToolIcon } from '../icons/pen-tool';
import { useIconAnim } from '../icons/useIconAnim';
import { boxAround } from './geometry';

const RADII = [25, 50, 100] as const;

/** Panel flotante: dibujar un área o dar un punto (lat, lon) con un radio. */
export function CustomAreaPanel({
  onClose,
  onDraw,
  onBox,
}: {
  onClose: () => void;
  onDraw: (m: 'rect' | 'poly') => void;
  onBox: (g: Polygon) => void;
}) {
  const { t } = useApp();
  const penIcon = useIconAnim();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [km, setKm] = useState<(typeof RADII)[number]>(50);
  const [bad, setBad] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => first.current?.focus(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat.replace(',', '.'));
    const lo = Number(lon.replace(',', '.'));
    const ok = lat.trim() !== '' && lon.trim() !== '' && Math.abs(la) <= 85 && Math.abs(lo) <= 180;
    setBad(!ok);
    if (ok) onBox(boxAround(la, lo, km));
  };

  const field = 'w-full rounded border border-line bg-panel-2 px-2 py-1.5 font-mono text-[12.5px] text-ink outline-none focus:border-cyan';

  return (
    <motion.div
      id="custom-area"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.7 }}
      style={{ transformOrigin: 'top left' }}
      role="dialog"
      aria-label={t('map.customTitle')}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="pointer-events-auto min-h-0 w-[290px] max-w-full overflow-y-auto rounded-md border border-line bg-panel px-3 py-2.5 text-[12.5px] shadow-xl shadow-black/60"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{t('map.customTitle')}</p>
        <button type="button" onClick={onClose} aria-label={t('map.close')} className="px-1 text-mute hover:text-ink">
          ✕
        </button>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-dim">{t('map.coverage')}</p>

      <p className="kicker mt-2 text-[10px]">A · {t('map.optDraw')}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button ref={first} type="button" onClick={() => onDraw('rect')} className="btn px-2 py-1.5 text-xs">
          ▭ {t('map.rect')}
        </button>
        <button
          type="button"
          onClick={() => onDraw('poly')}
          {...penIcon.trigger}
          className="btn flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs"
        >
          <PenToolIcon ref={penIcon.ref} size={14} aria-hidden="true" className="flex" />
          {t('map.poly')}
        </button>
      </div>

      <p className="kicker mt-2 text-[10px]">B · {t('map.optCoords')}</p>
      <form onSubmit={submit} className="mt-1 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className="text-[10.5px] text-mute">{t('map.lat')}</span>
            <input inputMode="decimal" placeholder="21.20" value={lat} onChange={(e) => setLat(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="text-[10.5px] text-mute">{t('map.lon')}</span>
            <input inputMode="decimal" placeholder="-99.60" value={lon} onChange={(e) => setLon(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <div role="radiogroup" aria-label={t('map.radius')} title={t('map.radius')} className="flex flex-1 gap-1">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={km === r}
                onClick={() => setKm(r)}
                className={`btn flex-1 px-1 py-1.5 font-mono text-[11px] ${km === r ? 'btn-on' : ''}`}
              >
                {r} km
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-on px-3 py-1.5 text-xs font-semibold">
            {t('map.query')}
          </button>
        </div>
        {bad && <p className="text-[11px] text-warn">{t('map.badCoords')}</p>}
      </form>
    </motion.div>
  );
}
