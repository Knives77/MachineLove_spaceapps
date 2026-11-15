// Piezas de la consola: botón de la franja, panel flotante y sección plegable.
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { Reveal } from '../../components/ui';
import { useApp } from '../../state';

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Botón de la franja flotante: icono + etiqueta, mismo alto que los demás (36 px). */
export function StripButton({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-[3px] border px-2.5 font-display text-[12.5px] font-medium transition-colors ${
        pressed ? 'border-cyan bg-cyan-deep text-select' : 'border-transparent text-mute hover:border-line-2 hover:text-ink'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {label}
    </button>
  );
}

/** Panel flotante sobre el mapa: entra y sale deslizándose desde su borde. El de la derecha deja libre la franja de botones. */
export function FloatPanel({
  side,
  width,
  title,
  onHide,
  children,
}: {
  side: 'left' | 'right';
  width: number;
  title: string;
  onHide: () => void;
  children: ReactNode;
}) {
  const { t, aoiName } = useApp();
  const dx = side === 'left' ? -28 : 28;
  const hide = (
    <button
      type="button"
      onClick={onHide}
      aria-label={t('con.hidePanel', { p: title })}
      title={t('con.hidePanel', { p: title })}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-line-2 font-mono text-[13px] text-mute transition-colors hover:border-cyan hover:text-ink"
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  );
  return (
    <motion.aside
      aria-label={title}
      style={{ width }}
      initial={{ x: dx, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: dx, opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`hud absolute z-[600] flex flex-col ${
        side === 'left' ? 'left-2 top-2 max-h-[calc(100%-1rem)]' : 'right-2 top-[3.75rem] max-h-[calc(100%-4.25rem)]'
      }`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        {side === 'right' && hide}
        <div className="min-w-0 flex-1 overflow-hidden">
          <h1 className="heading truncate text-[12px]">{title}</h1>
          <p className="kicker truncate text-[9.5px] text-cyan">
            <Reveal text={aoiName} />
          </p>
        </div>
        {side === 'left' && hide}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </motion.aside>
  );
}

/** Sección plegable de un panel: lo que no es indispensable se puede cerrar (se abre y cierra con animación). */
export function Section({ title, open: initial = true, children }: { title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial);
  const id = useId();
  return (
    <section className="border-b border-line last:border-b-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="kicker group flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] transition-colors hover:text-ink"
        >
          <span aria-hidden="true" className={`h-2.5 w-[2px] transition-colors ${open ? 'bg-cyan' : 'bg-line-2 group-hover:bg-cyan'}`} />
          <span className="flex-1">{title}</span>
          <span aria-hidden="true" className={`font-mono text-[11px] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
            ›
          </span>
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
