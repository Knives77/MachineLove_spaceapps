import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { HudBar } from './components/HudBar';
import { TopBar } from './components/TopBar';
import { Skeleton } from './components/ui';
import { AppProvider, useApp } from './state';
import { Expert } from './views/expert/Expert';

// Experto es la vista inicial; las otras tres se descargan solo si se abren.
const General = lazy(() => import('./views/General').then((m) => ({ default: m.General })));
const Learn = lazy(() => import('./views/Learn').then((m) => ({ default: m.Learn })));
const Edu = lazy(() => import('./views/Edu').then((m) => ({ default: m.Edu })));

function Shell() {
  const { t, tab } = useApp();
  return (
    // La app ocupa exactamente la ventana: la barra superior y el pie no se desplazan nunca;
    // si una vista es más alta, se desplaza solo <main> (General y Experto están hechas para caber completas).
    <div className="flex h-dvh min-w-[1024px] flex-col overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[999] focus:bg-panel focus:p-2">
        {t('skip')}
      </a>
      {/* En Experto el mapa ocupa toda la ventana: los 3 botones flotan sobre él (ver Expert.tsx). */}
      {tab !== 'expert' && <TopBar />}
      <main id="main" aria-label={t(`tab.${tab}`)} className="min-h-0 flex-1 overflow-y-auto" tabIndex={-1}>
        <div id={`view-${tab}`} className={tab === 'general' || tab === 'expert' ? 'h-full' : undefined}>
          <Suspense fallback={<Skeleton className="m-3 h-64" />}>
            {tab === 'general' && <General />}
            {tab === 'learn' && <Learn />}
            {tab === 'edu' && <Edu />}
            {tab === 'expert' && <Expert />}
          </Suspense>
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
