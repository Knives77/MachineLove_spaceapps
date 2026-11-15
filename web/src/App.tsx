import { MotionConfig } from 'motion/react';
import { TopBar } from './components/TopBar';
import { AppProvider, useApp } from './state';
import { Edu } from './views/Edu';
import { Expert } from './views/Expert';
import { General } from './views/General';
import { Learn } from './views/Learn';

function Shell() {
  const { t, tab } = useApp();
  return (
    // La app ocupa exactamente la ventana: la barra superior y el pie no se desplazan nunca;
    // si una vista es más alta, se desplaza solo <main> (General está hecha para caber completa).
    <div className="flex h-dvh min-w-[1024px] flex-col overflow-hidden">
      {/* Solo visible al recibir foco con Tab: nunca tapa el header. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1100] focus:rounded-lg focus:border focus:border-cyan focus:bg-panel focus:px-4 focus:py-2 focus:text-ink"
      >
        {t('skip')}
      </a>
      <TopBar />
      <main id="main" aria-label={t(`tab.${tab}`)} className="min-h-0 flex-1 overflow-y-auto" tabIndex={-1}>
        <div id={`view-${tab}`} className={tab === 'general' ? 'h-full' : undefined}>
          {tab === 'general' && <General />}
          {tab === 'learn' && <Learn />}
          {tab === 'edu' && <Edu />}
          {tab === 'expert' && <Expert />}
        </div>
      </main>
      {/* Las descargas (CSV, GeoJSON) viven en Experto: General se mantiene limpia. */}
      <footer className="shrink-0 border-t border-line px-4 py-1">
        <p className="truncate text-xs text-dim">{t('footer.source')}</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    // Los iconos animados respetan "reducir movimiento" del sistema.
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <Shell />
      </AppProvider>
    </MotionConfig>
  );
}
