import { usingMocks } from './api';
import { Downloads } from './components/Downloads';
import { TopBar } from './components/TopBar';
import { AppProvider, useApp } from './state';
import { Edu } from './views/Edu';
import { Expert } from './views/Expert';
import { General } from './views/General';
import { Learn } from './views/Learn';

function Shell() {
  const { t, tab } = useApp();
  return (
    <div className="flex min-h-full min-w-[1024px] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[999] focus:bg-panel focus:p-2">
        {t('skip')}
      </a>
      <TopBar />
      {usingMocks && (
        <p className="border-b border-line bg-cyan-deep/40 px-4 py-1 font-mono text-[11px] text-cyan">{t('demo.banner')}</p>
      )}
      <main id="main" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex-1" tabIndex={-1}>
        <div id={`view-${tab}`}>
          {tab === 'general' && <General />}
          {tab === 'learn' && <Learn />}
          {tab === 'edu' && <Edu />}
          {tab === 'expert' && <Expert />}
        </div>
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2">
        <p className="text-[11.5px] text-mute">{t('footer.source')}</p>
        {tab === 'general' && <Downloads compact />}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
