// Panel that runs the severity-driven matching algorithm against the
// roster and surfaces the best responder + the score breakdown.

import React from 'react';
import { Case } from '../types';
import { rankResponders, MatchResult } from '../services/dispatch';
import { useCaseStore } from '../store/caseStore';

interface Props {
  c: Case;
  showAll?: boolean;     // also list the runner-up scores
  autoDispatchLabel?: string;
  compact?: boolean;
}

export const AutoDispatchPanel: React.FC<Props> = ({
  c, showAll = false, autoDispatchLabel = 'Auto-dispatch this responder', compact = false,
}) => {
  const { assignCase } = useCaseStore();
  const ranked = React.useMemo(() => rankResponders(c), [c.id, c.severity, c.location.lat, c.location.lon, c.injuryType]);
  if (ranked.length === 0) return null;

  const top = ranked[0];
  const alreadyAssigned = c.status !== 'reported';

  return (
    <div className={`bg-indigo-50 border border-indigo-200 rounded-lg ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">
            ⚡ Automated severity-driven dispatch
          </div>
          <div className="text-sm text-indigo-900 mt-0.5">
            Severity <span className="font-semibold">{c.severity}</span> → matching engine selected{' '}
            <span className="font-semibold">{top.responder.name}</span>
            {' '}({top.responder.ngo})
          </div>
          <div className="text-xs text-indigo-700 mt-1">
            {top.distanceKm.toFixed(1)} km away · {(top.totalScore * 100).toFixed(0)}% match score
          </div>
        </div>
        {!alreadyAssigned && (
          <button
            onClick={() => assignCase(c.id, top.responder.name, top.responder.ngo)}
            className="bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-indigo-700 whitespace-nowrap"
          >
            {autoDispatchLabel}
          </button>
        )}
      </div>

      <ScoreBreakdown match={top} />

      {showAll && ranked.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-indigo-700 font-medium">
            See all candidates ({ranked.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {ranked.slice(1).map((m) => (
              <li key={m.responder.id} className="flex justify-between gap-2 py-1 border-t border-indigo-100">
                <div className="min-w-0">
                  <div className="font-medium text-indigo-900 truncate">{m.responder.name}</div>
                  <div className="text-indigo-600">
                    {m.responder.ngo} · {m.distanceKm.toFixed(1)} km · load {m.responder.openLoad}
                    {!m.responder.available && ' · (inactive)'}
                  </div>
                </div>
                <div className="text-indigo-800 font-semibold whitespace-nowrap">
                  {(m.totalScore * 100).toFixed(0)}%
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const ScoreBreakdown: React.FC<{ match: MatchResult }> = ({ match }) => {
  // Normalise contributions to 0..1 for bar visualisation
  const maxAbs = Math.max(...match.breakdown.map((b) => Math.abs(b.contribution)), 0.0001);
  return (
    <div className="bg-white rounded p-3 border border-indigo-100">
      <div className="text-xs font-semibold text-slate-700 mb-2">Why this responder?</div>
      <ul className="space-y-1.5 text-xs">
        {match.breakdown.map((b, i) => {
          const w = Math.abs(b.contribution) / maxAbs;
          const sign = b.contribution >= 0;
          return (
            <li key={i}>
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-slate-700 font-medium">{b.label}</span>
                <span className={sign ? 'text-emerald-700' : 'text-rose-700'}>
                  {(b.contribution >= 0 ? '+' : '') + (b.contribution * 100).toFixed(0)}
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded">
                <div
                  className={`h-1 rounded ${sign ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${w * 100}%` }}
                />
              </div>
              <div className="text-slate-500 mt-0.5">{b.detail}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
