import React from 'react';
import { useRouter, Route } from '../store/router';
import { useCaseStore } from '../store/caseStore';
import { isLiveClaude } from '../services/claudeService';

interface NavItem { key: string; label: string; route: Route; }

const NAV: NavItem[] = [
  { key: 'citizen',  label: 'Report (Citizen)', route: { name: 'citizen'  } },
  { key: 'ngo',      label: 'NGO Dashboard',    route: { name: 'ngo'      } },
  { key: 'donations',label: 'Donate',           route: { name: 'donations'} },
  { key: 'adoption', label: 'Adopt',            route: { name: 'adoption' } },
  { key: 'stats',    label: 'Analytics',        route: { name: 'stats'    } },
];

export const TopNav: React.FC = () => {
  const { route, navigate } = useRouter();
  const { cases, loadDemoData, clearAll } = useCaseStore();

  const active = (key: string) =>
    (key === 'home'      && route.name === 'home')      ||
    (key === 'citizen'   && route.name === 'citizen')   ||
    (key === 'ngo'       && route.name === 'ngo')       ||
    (key === 'donations' && route.name === 'donations') ||
    (key === 'adoption'  && route.name === 'adoption')  ||
    (key === 'stats'     && route.name === 'stats');

  return (
    <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-slate-200">
      <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate({ name: 'home' })}
          className="flex items-center gap-2 text-2xl font-adlam text-teal-700"
        >
          <span className="text-3xl">🐾</span>
          <span>Karuṇā</span>
          <span className="text-xs text-slate-500 font-sans ml-2 hidden sm:inline">
            AI-assisted street-animal rescue
          </span>
          {isLiveClaude() ? (
            <span className="text-[10px] font-semibold tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded ml-2 hidden md:inline">LIVE AI</span>
          ) : (
            <span className="text-[10px] font-semibold tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-2 hidden md:inline">MOCK AI</span>
          )}
        </button>

        <nav className="flex flex-wrap gap-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.route)}
              className={
                'px-3 py-1.5 rounded-md text-sm font-medium transition ' +
                (active(item.key)
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100')
              }
            >
              {item.label}
            </button>
          ))}
          {cases.length === 0 ? (
            <button
              onClick={() => { loadDemoData(); navigate({ name: 'stats' }); }}
              className="px-3 py-1.5 rounded-md text-sm bg-amber-100 text-amber-800 hover:bg-amber-200 ml-2 font-medium"
              title="Populate 24 demo cases so the dashboards have data to show"
            >
              + Load demo cases
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm(`Clear all ${cases.length} cases? This cannot be undone.`)) {
                  clearAll();
                  navigate({ name: 'home' });
                }
              }}
              className="px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-100 ml-2"
              title="Wipe all cases — start from zero"
            >
              ↺ Clear all ({cases.length})
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
