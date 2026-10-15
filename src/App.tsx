import { useEffect, useState } from 'react';
import { AboutPage } from './pages/AboutPage';
import { LearnPage } from './pages/LearnPage';
import { SimulatorPage } from './pages/SimulatorPage';

type Route = 'simulator' | 'learn' | 'about';

// Plain-token hashes (#learn, #about) so deep links also work where only simple anchors are allowed.
const ROUTES: { route: Route; href: string; label: string }[] = [
  { route: 'simulator', href: '#simulator', label: 'Simulator' },
  { route: 'learn', href: '#learn', label: 'Learn' },
  { route: 'about', href: '#about', label: 'About' },
];

/** Route named by the hash, or null for other anchors (e.g. the skip link's #main). */
function routeFromHash(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, '').split(/[/?#]/)[0];
  if (path === '') return 'simulator';
  return path === 'simulator' || path === 'learn' || path === 'about' ? path : null;
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash) ?? 'simulator');
  useEffect(() => {
    const onChange = () => {
      const next = routeFromHash(window.location.hash);
      if (next === null) return;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <a className="wordmark" href="#simulator" aria-label="BranchLab home">
            <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
              <rect width="32" height="32" rx="5" fill="currentColor" />
              <path d="M9 7v18M9 16h7l7-7M16 16l7 7" stroke="var(--bg)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>BranchLab</span>
          </a>
          <span className="app-header__tag">Interactive educational simulator · 1-bit &amp; 2-bit branch prediction</span>
          <nav aria-label="Main">
            <ul className="nav">
              {ROUTES.map((r) => (
                <li key={r.route}>
                  <a href={r.href} aria-current={route === r.route ? 'page' : undefined}>
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {route === 'simulator' && <SimulatorPage />}
        {route === 'learn' && <LearnPage />}
        {route === 'about' && <AboutPage />}
      </main>
      <footer className="app-footer">
        BranchLab is a teaching model. It simulates predictor algorithms in software; it does not measure or reproduce any real processor.
      </footer>
    </>
  );
}
