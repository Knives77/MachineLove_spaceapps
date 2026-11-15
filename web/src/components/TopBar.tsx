import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usingMocks } from '../api';
import { rampGradient } from '../lib/color';
import { playStatus } from '../lib/sound';
import { useApp } from '../state';
import type { Palette, Tab } from '../types';

const TABS: Tab[] = ['general', 'learn', 'edu', 'expert'];
const PALETTES: Palette[] = ['inferno', 'cividis', 'contrast'];

/** Barra superior mínima: nombre a la izquierda y 3 botones de 44 × 44 a la derecha. */
export function TopBar() {
  const { t, tab, setTab, lang, setLang, palette, setPalette, sound, setSound } = useApp();

  return (
    <header className="flex items-center gap-4 border-b border-line bg-bg/95 px-4 py-2">
      <div className="mr-2 min-w-[170px]">
        <p className="text-[15px] font-semibold tracking-[0.18em] uppercase">{t('app.name')}</p>
        <p className="kicker text-[10px]">
          {t('app.subtitle')}
          {usingMocks && (
            <span
              tabIndex={0}
              title={t('demo.tooltip')}
              aria-label={`${t('demo')}: ${t('demo.tooltip')}`}
              className="ml-2 cursor-help text-cyan underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              · {t('demo')}
            </span>
          )}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Idioma: un clic cambia al otro idioma. */}
        <button
          type="button"
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          aria-label={t('top.langSwitch')}
          title={t('top.langSwitch')}
          className={`${ICON_BTN} gap-1 px-2 font-mono text-[12px] font-semibold`}
        >
          <GlobeIcon />
          <span aria-hidden="true">{lang.toUpperCase()}</span>
        </button>

        <IconMenu id="a11y-menu" label={t('top.a11y')} icon={<EyeIcon />}>
          {(item) => (
            <>
              <MenuHeading>{t('a11y.colors')}</MenuHeading>
              {PALETTES.map((p) =>
                item({
                  key: p,
                  role: 'menuitemradio',
                  checked: palette === p,
                  onSelect: () => setPalette(p),
                  children: (
                    <span className="flex flex-1 items-center justify-between gap-3">
                      {t(`palette.${p}`)}
                      <span aria-hidden="true" className="h-2 w-10 shrink-0 rounded-sm" style={{ background: rampGradient(p) }} />
                    </span>
                  ),
                }),
              )}
              <div className="my-1 border-t border-line" />
              {item({
                key: 'sound',
                role: 'menuitemcheckbox',
                checked: sound,
                keepOpen: true,
                onSelect: () => {
                  setSound(!sound);
                  if (!sound) playStatus('normal'); // confirma que el audio funciona
                },
                children: (
                  <span className="flex flex-col">
                    {t('a11y.sound')}
                    <span className="text-[11px] normal-case tracking-normal text-dim">{t('a11y.soundHint')}</span>
                  </span>
                ),
              })}
            </>
          )}
        </IconMenu>

        <IconMenu
          id="view-menu"
          label={`${t('top.viewLabel')}: ${t(`tab.${tab}`)}`}
          icon={<GridIcon />}
          accent={tab !== 'general'}
          text={
            <span className="flex items-center gap-1.5 text-[12.5px]">
              <span className="text-mute">{t('top.viewLabel')}:</span>
              <span className="font-semibold text-ink">{t(`tab.${tab}`)}</span>
            </span>
          }
        >
          {(item) => (
            <>
              <MenuHeading>{t('top.views')}</MenuHeading>
              {TABS.map((id) =>
                item({
                  key: id,
                  role: 'menuitemradio',
                  checked: tab === id,
                  onSelect: () => setTab(id),
                  children: <span className="uppercase tracking-wide">{t(`tab.${id}`)}</span>,
                }),
              )}
            </>
          )}
        </IconMenu>
      </div>
    </header>
  );
}

const ICON_BTN =
  'flex h-11 min-w-11 items-center justify-center rounded border border-line bg-panel text-mute transition-colors hover:text-ink';

interface ItemSpec {
  key: string;
  role: 'menuitemradio' | 'menuitemcheckbox';
  checked: boolean;
  onSelect: () => void;
  keepOpen?: boolean;
  children: ReactNode;
}

/** Botón de ícono con menú flotante. Teclado: ↓ abre, ↑/↓/Inicio/Fin se mueven, Esc cierra. */
function IconMenu({
  id,
  label,
  icon,
  text,
  accent = false,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  /** Texto visible junto al ícono (convierte el botón en píldora). */
  text?: ReactNode;
  /** Resalta el botón con acento cian (p. ej., hay una vista avanzada activa). */
  accent?: boolean;
  children: (item: (spec: ItemSpec) => ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    // Al abrir, el foco va a la opción activa.
    const all = items();
    (all.find((el) => el.getAttribute('aria-checked') === 'true') ?? all[0])?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const item = ({ key, role, checked, onSelect, keepOpen, children: body }: ItemSpec) => (
    <button
      key={key}
      type="button"
      role={role}
      aria-checked={checked}
      tabIndex={-1}
      onClick={() => {
        onSelect();
        if (!keepOpen) close();
      }}
      className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[13px] outline-none transition-colors focus-visible:bg-panel-2 ${
        checked ? 'bg-cyan-deep text-ink' : 'text-mute hover:bg-panel-2 hover:text-ink'
      }`}
    >
      <span aria-hidden="true" className={`w-3 shrink-0 font-mono text-cyan ${checked ? '' : 'invisible'}`}>
        ✓
      </span>
      {body}
    </button>
  );

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={
          text
            ? `relative flex h-11 items-center gap-2 rounded-full border bg-[#1e293b]/80 pl-3.5 pr-4 text-[#e2e8f0] transition-colors hover:border-line-2 ${
                open || accent ? 'border-cyan/70' : 'border-[#334155]'
              }`
            : `${ICON_BTN} w-11 ${open ? '!border-cyan !text-ink' : ''}`
        }
      >
        {icon}
        {text}
        {text && accent && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-cyan" />
        )}
      </button>

      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-[1000] mt-2 min-w-[260px] rounded border border-line bg-panel p-1 shadow-xl shadow-black/50"
          onKeyDown={(e) => {
            const all = items();
            const i = all.findIndex((el) => el === document.activeElement);
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            } else if (e.key === 'Tab') {
              setOpen(false);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
            } else if (e.key === 'Home' || e.key === 'End') {
              e.preventDefault();
              all[e.key === 'Home' ? 0 : all.length - 1]?.focus();
            }
          }}
        >
          {children(item)}
        </div>
      )}
    </div>
  );
}

function MenuHeading({ children }: { children: ReactNode }) {
  return <p className="kicker px-3 pb-1 pt-2 text-[10px]">{children}</p>;
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="6.5" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6.5" />
      <path d="M1.5 8h13M2.6 4.5h10.8M2.6 11.5h10.8" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 8s2.6-4.8 7-4.8S15 8 15 8s-2.6 4.8-7 4.8S1 8 1 8Z" />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}
