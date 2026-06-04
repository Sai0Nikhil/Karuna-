// Single-case detail page — shows the full timeline as a reporter would see it.

import React from 'react';
import { useCaseStore, totalDonated, donationProgress } from '../store/caseStore';
import { useRouter } from '../store/router';
import {
  Empty, SeverityChip, StatusChip, ProgressBar, formatInr, relativeTime,
} from './shared';

export const CaseDetail: React.FC<{ caseId: string }> = ({ caseId }) => {
  const { getCase } = useCaseStore();
  const { navigate } = useRouter();
  const c = getCase(caseId);

  if (!c) {
    return (
      <main className="container mx-auto p-6">
        <Empty>Case not found.</Empty>
        <div className="text-center mt-4">
          <button onClick={() => navigate({ name: 'citizen' })} className="text-teal-600 hover:underline">
            ← Submit a new report
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-6 max-w-4xl">
      <button onClick={() => navigate({ name: 'citizen' })} className="text-sm text-teal-600 hover:underline mb-3">
        ← Report another case
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="aspect-[16/9] bg-slate-100">
          <img src={c.imageDataUrl} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityChip s={c.severity} />
            <StatusChip s={c.status} />
            <span className="text-xs text-slate-500 ml-auto">ID: <code>{c.id}</code></span>
          </div>

          <h2 className="text-xl font-semibold text-slate-800">{c.probableCondition}</h2>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Reporter" value={c.reporterName} />
            <Info label="Location" value={c.location.label} />
            {c.assignedResponder && <Info label="Responder" value={c.assignedResponder} />}
            {c.ngo && <Info label="NGO" value={c.ngo} />}
            <Info label="Reported" value={`${new Date(c.createdAt).toLocaleString()} (${relativeTime(c.createdAt)})`} />
            <Info label="Species" value={c.species} />
          </div>

          {c.firstAidSteps.length > 0 && (
            <details className="text-sm">
              <summary className="font-medium text-slate-700 cursor-pointer">First-aid steps given to reporter</summary>
              <ol className="list-decimal list-inside mt-1 text-slate-600 space-y-1">
                {c.firstAidSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </details>
          )}

          {c.estimatedCostInr > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="flex justify-between text-sm mb-1">
                <span>Funding</span>
                <span>{formatInr(totalDonated(c))} / {formatInr(c.estimatedCostInr)}</span>
              </div>
              <ProgressBar value={donationProgress(c)} />
              <button
                onClick={() => navigate({ name: 'donations', caseId: c.id })}
                className="mt-2 text-xs text-rose-700 font-medium hover:underline"
              >
                Help fund this case →
              </button>
            </div>
          )}

          <div>
            <div className="font-medium text-slate-700 mb-2">Timeline ({c.events.length})</div>
            <ol className="space-y-2 text-sm border-l-2 border-slate-200 pl-4">
              {[...c.events].reverse().map((ev, i) => (
                <li key={i}>
                  <div className="text-xs text-slate-400">{new Date(ev.ts).toLocaleString()}</div>
                  <div className="text-slate-700">
                    <span className="font-medium">{ev.actor}</span> — {ev.details}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="font-medium text-slate-800 break-words">{value}</div>
  </div>
);
