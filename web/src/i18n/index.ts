// Diccionario ES/EN: los textos viven en es.ts y en.ts; aquí solo la traducción y el idioma guardado.
import type { Lang } from '../types';
import { en } from './en';
import { es } from './es';

type Dict = Record<string, string>;

export const DICTS: Record<Lang, Dict> = { es, en };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('ml.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* sin storage */
  }
  return 'es'; // la app arranca en español; el botón 🌐 cambia a inglés
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem('ml.lang', lang);
  } catch {
    /* sin storage */
  }
}
