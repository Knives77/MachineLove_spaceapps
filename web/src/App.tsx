import { MotionConfig } from 'motion/react';
import { HudBar } from './components/HudBar';
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
    // si una vista es más alta, se desplaza solo <main> (General y Experto están hechas para caber completas).
    <div className="flex h-dvh min-w-[1024px] flex-col overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[999] focus:bg-panel focus:p-2">
        {t('skip')}
      </a>
      <TopBar />
      <main id="main" aria-label={t(`tab.${tab}`)} className="min-h-0 flex-1 overflow-y-auto" tabIndex={-1}>
        <div id={`view-${tab}`} className={tab === 'general' || tab === 'expert' ? 'h-full' : undefined}>
          {tab === 'general' && <General />}
          {tab === 'learn' && <Learn />}
          {tab === 'edu' && <Edu />}
          {tab === 'expert' && <Expert />}
        </div>
      </main>
      {/* Barra de telemetría; las descargas (CSV, GeoJSON) viven en Experto. */}
      <HudBar />
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
