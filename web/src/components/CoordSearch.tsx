// Buscador por coordenadas (consola de Experto): se pega o escribe "lat, lon" y se consulta un cuadro
// de ± radio alrededor del punto. Acepta los formatos de `parseLatLon` (decimal, hemisferios, grados-minutos-segundos).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { boxAround, parseLatLon } from '../lib/geo';

const RADII = [25, 50, 100] as const;

export function CoordSearch() {
  const { t, setAoi } = useApp();
  const [text, setText] = useState('');
  const [km, setKm] = useState<(typeof RADII)[number]>(50);
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // "/" enfoca el buscador (no mientras se escribe en otro campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseLatLon(text);
    setBad(!p);
    if (p) setAoi({ geometry: boxAround(p.lat, p.lon, km) });
  };

  return (
    <div className="relative min-w-0 shrink">
      <form
        role="search"
        aria-label={t('search.label')}
        onSubmit={submit}
        className={`hud flex h-[2.875rem] w-[22rem] max-w-full items-center gap-1 p-1 ${bad ? '!border-warn' : ''}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="ml-1.5 shrink-0 text-mute">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (bad) setBad(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setBad(false);
              input.current?.blur();
            }
          }}
          aria-label={t('search.label')}
          aria-invalid={bad}
          aria-describedby={bad ? 'coord-search-err' : undefined}
          placeholder={t('search.placeholder')}
          title={t('search.hint')}
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[12.5px] text-ink outline-none placeholder:text-dim"
        />
        <select
          value={km}
          onChange={(e) => setKm(Number(e.target.value) as (typeof RADII)[number])}
          aria-label={t('map.radius')}
          title={t('map.radius')}
          className="h-full shrink-0 rounded-[3px] border border-line-2 bg-panel-2 px-1 font-mono text-[11px] text-mute outline-none hover:text-ink focus:border-cyan"
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              ±{r} km
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-on h-full shrink-0 px-3 py-0 text-xs font-semibold">
          {t('search.go')}
        </button>
      </form>
      {bad && (
        <p id="coord-search-err" role="alert" className="hud absolute right-0 top-full mt-1 w-full px-2.5 py-1.5 text-[11px] leading-snug text-warn">
          {t('search.bad')}
        </p>
      )}
    </div>
  );
}
