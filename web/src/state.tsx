import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCalendar, getPresets } from './api';
import { initialLang, saveLang, translate } from './i18n';
import {
  ApiError,
  type Aoi,
  type CalendarResponse,
  type Lang,
  type Mode,
  type Palette,
  type PresetCollection,
  type PresetFeature,
  type Tab,
} from './types';

export type Load<T> =
  | { state: 'loading' }
  | { state: 'error'; code: string }
  | { state: 'ok'; data: T };

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tab: Tab;
  setTab: (t: Tab) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
  presets: Load<PresetCollection>;
  aoi: Aoi;
  setAoi: (a: Aoi) => void;
  aoiName: string;
  presetName: (f: PresetFeature) => string;
  calendar: Load<CalendarResponse>;
  reload: () => void;
  selected: { year: number; month: number } | null;
  setSelected: (s: { year: number; month: number }) => void;
}

const Ctx = createContext<AppState | null>(null);

export const DEFAULT_PRESET = 'qro-sierra-gorda';

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
    /* sin storage */
  }
  return fallback;
}

function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* sin storage */
  }
}

/** Hook de carga con cancelación; lo usan el estado global y las vistas que piden otra región. */
export function useCalendar(aoi: Aoi | null) {
  const [res, setRes] = useState<Load<CalendarResponse>>({ state: 'loading' });
  const [nonce, setNonce] = useState(0);
  const key = aoi ? JSON.stringify(aoi) : '';
  useEffect(() => {
    if (!aoi) return;
    let alive = true;
    setRes({ state: 'loading' });
    getCalendar({ aoi, start_year: 2000, end_year: 2026, basis: 'modis_primary' })
      .then((data) => alive && setRes({ state: 'ok', data }))
      .catch((e) => alive && setRes({ state: 'error', code: e instanceof ApiError ? e.code : 'network' }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);
  return [res, () => setNonce((n) => n + 1)] as const;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [tab, setTabState] = useState<Tab>(() =>
    readPref('ml.tab', ['general', 'learn', 'edu', 'expert'] as const, 'general'),
  );
  const [mode, setMode] = useState<Mode>('harmonized');
  const [palette, setPaletteState] = useState<Palette>(() =>
    readPref('ml.palette', ['inferno', 'cividis'] as const, 'inferno'),
  );
  const [presets, setPresets] = useState<Load<PresetCollection>>({ state: 'loading' });
  const [aoi, setAoiState] = useState<Aoi>({ preset_id: DEFAULT_PRESET });
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null);
  const [calendar, reload] = useCalendar(aoi);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    getPresets()
      .then((data) => setPresets({ state: 'ok', data }))
      .catch((e) => setPresets({ state: 'error', code: e instanceof ApiError ? e.code : 'network' }));
  }, []);

  // Al llegar un calendario nuevo, la tarjeta muestra `latest` (api.md).
  useEffect(() => {
    if (calendar.state === 'ok') setSelected(calendar.data.latest);
  }, [calendar]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const presetName = useCallback(
    (f: PresetFeature) => (lang === 'es' ? f.properties.name_es : f.properties.name_en),
    [lang],
  );

  const aoiName = useMemo(() => {
    if ('geometry' in aoi) return t('top.drawn');
    if (presets.state !== 'ok') return aoi.preset_id;
    const f = presets.data.features.find((x) => x.id === aoi.preset_id);
    return f ? presetName(f) : aoi.preset_id;
  }, [aoi, presets, presetName, t]);

  const value: AppState = {
    lang,
    setLang: (l) => {
      setLangState(l);
      saveLang(l);
    },
    t,
    tab,
    setTab: (x) => {
      setTabState(x);
      writePref('ml.tab', x);
    },
    mode,
    setMode,
    palette,
    setPalette: (p) => {
      setPaletteState(p);
      writePref('ml.palette', p);
    },
    presets,
    aoi,
    setAoi: setAoiState,
    aoiName,
    presetName,
    calendar,
    reload,
    selected,
    setSelected,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuera de AppProvider');
  return v;
}

export function errorText(t: AppState['t'], code: string) {
  const key = `error.${code}`;
  const s = t(key);
  return s === key ? t('error.generic', { code }) : s;
}
