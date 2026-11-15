import { forwardRef, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { usingMocks } from '../api';
import { rampGradient } from '../lib/color';
import { playStatus } from '../lib/sound';
import { useApp } from '../state';
import type { Palette, Tab } from '../types';
import { EarthIcon } from './icons/earth';
import { GraduationCapIcon } from './icons/graduation-cap';
import { HomeIcon } from './icons/home';
import { LanguagesIcon } from './icons/languages';
import { SlidersHorizontalIcon } from './icons/sliders-horizontal';
import { useIconAnim, type IconAnimHandle } from './icons/useIconAnim';

const TABS: Tab[] = ['general', 'learn', 'edu', 'expert'];
/** Menú de vistas (General, Aprendizaje, Educacional, Experto). Oculto para la demo: la app queda solo en Experto. */
const SHOW_VIEW_MENU = false;
const PALETTES: Palette[] = ['inferno', 'cividis', 'contrast'];

/**
 * Barra superior mínima: nombre a la izquierda y 3 botones de 44 × 44 a la derecha.
 * `floating` (consola de Experto): solo los 3 botones, como control flotante sobre el mapa.
 */
export function TopBar({ floating = false, lead }: { floating?: boolean; /** Botones extra al inicio de la franja flotante. */ lead?: ReactNode }) {
  const btn = floating ? ICON_BTN_SM : ICON_BTN;
  const { t, tab, setTab, lang, setLang, palette, setPalette, sound, setSound } = useApp();
  const langIcon = useIconAnim();
  const viewIcon = useIconAnim();

  // Al quedar activa otra vista, su icono se anima una vez en el botón de modos.
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    viewIcon.pulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <header className={floating ? 'hud flex items-center p-1' : 'flex h-14 shrink-0 items-center gap-4 border-b border-line bg-bg/95 px-4'}>
      {!floating && <div className="mr-2 min-w-[170px]">
        <p className="text-[15px] font-semibold tracking-[0.18em] uppercase">{t('app.name')}</p>
        <p className="kicker text-xs">
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
      </div>}

      <div className={`ml-auto flex items-center ${floating ? 'gap-0.5' : 'gap-2'}`}>
        {lead}
        {/* Idioma: un clic cambia al otro idioma. */}
        <button
          type="button"
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          aria-label={t('top.langSwitch')}
          title={t('top.langSwitch')}
          {...langIcon.trigger}
          className={`${btn} gap-1 px-2 font-mono text-[12px] font-semibold`}
        >
          <LanguagesIcon ref={langIcon.ref} size={17} aria-hidden="true" className="flex" />
          <span aria-hidden="true">{lang.toUpperCase()}</span>
        </button>

        <IconMenu id="a11y-menu" compact={floating} label={t('top.a11y')} icon={<EyeIcon />}>
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
                    <span className="text-xs normal-case tracking-normal text-dim">{t('a11y.soundHint')}</span>
                  </span>
                ),
              })}
            </>
          )}
        </IconMenu>

        {/* Demo y MVP: solo Experto. Las otras vistas siguen en el código; para volver a mostrarlas, SHOW_VIEW_MENU = true. */}
        {SHOW_VIEW_MENU && (
        <IconMenu
          id="view-menu"
          compact={floating}
          label={`${t('top.viewLabel')}: ${t(`tab.${tab}`)}`}
          icon={<ViewIcon key={tab} ref={viewIcon.ref} tab={tab} size={17} />}
          iconAnim={viewIcon}
          accent={tab !== 'general'}
          text={
            <span className="flex items-center gap-1.5 text-[12.5px]">
              {!floating && <span className="text-mute">{t('top.viewLabel')}:</span>}
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
                  animIcon: (ref) => <ViewIcon ref={ref} tab={id} size={16} />,
                  children: <span className="uppercase tracking-wide">{t(`tab.${id}`)}</span>,
                }),
              )}
            </>
          )}
        </IconMenu>
        )}
      </div>
    </header>
  );
}

const ICON_BTN_SM =
  'flex h-9 min-w-9 items-center justify-center rounded-[3px] border border-transparent text-mute transition-colors hover:border-line-2 hover:text-ink';

const ICON_BTN =
  'flex h-11 min-w-11 items-center justify-center rounded border border-line bg-panel text-mute transition-colors hover:text-ink';

interface ItemSpec {
  key: string;
  role: 'menuitemradio' | 'menuitemcheckbox';
  checked: boolean;
  onSelect: () => void;
  keepOpen?: boolean;
  /** Icono animado de la opción; se anima con el hover o el foco de toda la opción. */
  animIcon?: (ref: Ref<IconAnimHandle>) => ReactNode;
  children: ReactNode;
}

/** Botón de ícono con menú flotante. Teclado: ↓ abre, ↑/↓/Inicio/Fin se mueven, Esc cierra. */
function IconMenu({
  id,
  label,
  icon,
  text,
  accent = false,
  compact = false,
  iconAnim,
  children,
}: {
  /** Franja flotante: botón cuadrado de 36 px, sin píldora. */
  compact?: boolean;
  id: string;
  label: string;
  icon: ReactNode;
  /** Texto visible junto al ícono (convierte el botón en píldora). */
  text?: ReactNode;
  /** Resalta el botón con acento cian (p. ej., hay una vista avanzada activa). */
  accent?: boolean;
  /** Si el icono es animado: el hover y el foco del botón completo lo disparan. */
  iconAnim?: ReturnType<typeof useIconAnim>;
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

  const item = (spec: ItemSpec) => <MenuItem key={spec.key} spec={spec} close={close} />;

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
        {...iconAnim?.trigger}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={
          compact
            ? `relative flex h-9 min-w-9 items-center justify-center gap-2 rounded-[3px] border font-display transition-colors ${text ? 'px-2.5 text-ink' : 'text-mute hover:text-ink'} ${
                open ? 'border-cyan bg-cyan-deep' : 'border-transparent hover:border-line-2'
              }`
            : text
            ? `relative flex h-11 items-center gap-2 rounded-full border bg-line/80 pl-3.5 pr-4 text-ink transition-colors hover:border-line-2 ${
                open || accent ? 'border-cyan/70' : 'border-line-2'
              }`
            : `${ICON_BTN} w-11 ${open ? '!border-cyan !text-ink' : ''}`
        }
      >
        {icon}
        {text}
        {compact && text && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`text-mute transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 3.5 5 6.5 8 3.5" />
          </svg>
        )}
        {text && accent && !compact && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-cyan" />
        )}
      </button>

      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className="pop absolute right-0 top-full z-[1000] mt-2 min-w-[260px] rounded border border-line-2 bg-panel p-1 shadow-xl shadow-black/60"
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

/** Opción de menú; si trae icono animado, el hover o el foco de toda la opción lo anima. */
function MenuItem({ spec, close }: { spec: ItemSpec; close: () => void }) {
  const { role, checked, onSelect, keepOpen, animIcon, children: body } = spec;
  const icon = useIconAnim();
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      tabIndex={-1}
      {...(animIcon ? icon.trigger : {})}
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
      {animIcon?.(icon.ref)}
      {body}
    </button>
  );
}

/** Icono animado de cada vista: General, Aprendizaje, Educacional, Experto. */
const ViewIcon = forwardRef<IconAnimHandle, { tab: Tab; size: number }>(({ tab, size }, ref) => {
  const common = { ref, size, 'aria-hidden': true, className: 'flex shrink-0' } as const;
  if (tab === 'learn') return <GraduationCapIcon {...common} />;
  if (tab === 'edu') return <EarthIcon {...common} />;
  if (tab === 'expert') return <SlidersHorizontalIcon {...common} />;
  return <HomeIcon {...common} />;
});
ViewIcon.displayName = 'ViewIcon';

function MenuHeading({ children }: { children: ReactNode }) {
  return <p className="kicker px-3 pb-1 pt-2 text-xs">{children}</p>;
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 8s2.6-4.8 7-4.8S15 8 15 8s-2.6 4.8-7 4.8S1 8 1 8Z" />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </svg>
  );
}

