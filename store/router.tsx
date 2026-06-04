// Tiny hash-based router so we can deep-link to specific cases / donation /
// adoption pages without pulling in react-router.

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'citizen' }
  | { name: 'ngo'; caseId?: string }
  | { name: 'donations'; caseId?: string }
  | { name: 'adoption'; caseId?: string }
  | { name: 'stats' }
  | { name: 'case'; caseId: string };

const parseHash = (): Route => {
  const h = (window.location.hash || '#/home').replace(/^#\/?/, '');
  const [base, second] = h.split('/');
  switch (base) {
    case 'citizen':
    case 'report':
      return { name: 'citizen' };
    case 'ngo':
      return { name: 'ngo', caseId: second };
    case 'donate':
    case 'donations':
      return { name: 'donations', caseId: second };
    case 'adopt':
    case 'adoption':
      return { name: 'adoption', caseId: second };
    case 'stats':
    case 'analytics':
      return { name: 'stats' };
    case 'case':
      return { name: 'case', caseId: second };
    default:
      return { name: 'home' };
  }
};

const routeToHash = (r: Route): string => {
  switch (r.name) {
    case 'home': return '#/home';
    case 'citizen': return '#/citizen';
    case 'ngo': return r.caseId ? `#/ngo/${r.caseId}` : '#/ngo';
    case 'donations': return r.caseId ? `#/donate/${r.caseId}` : '#/donate';
    case 'adoption': return r.caseId ? `#/adopt/${r.caseId}` : '#/adopt';
    case 'stats': return '#/stats';
    case 'case': return `#/case/${r.caseId}`;
  }
};

interface RouterApi {
  route: Route;
  navigate: (r: Route) => void;
}

const RouterContext = createContext<RouterApi | null>(null);

export const useRouter = (): RouterApi => {
  const v = useContext(RouterContext);
  if (!v) throw new Error('useRouter outside RouterProvider');
  return v;
};

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeToHash(r);
    setRoute(r);
  };

  return <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>;
};
