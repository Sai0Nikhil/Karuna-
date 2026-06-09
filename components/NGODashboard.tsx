// NGO / Responder dashboard with auto-dispatch suggestion.
import React, { useMemo, useState } from 'react';
import { useCaseStore, nextStatus } from '../store/caseStore';
import { useRouter } from '../store/router';
import { Case, Severity, STATUS_LABEL } from '../types';
import {
  Empty, ProgressBar, SeverityChip, StatusChip,
  formatInr, relativeTime, downloadPdfLedger,
} from './shared';
import { AutoDispatchPanel } from './AutoDispatchPanel';

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, urgent: 1, routine: 2 };

const RESPONDERS = ['Volunteer R. Rao', 'Volunteer N. Lakshmi', 'Volunteer K. Suri', 'Volunteer M. Reddy'];
const NGOS = ['Vijayawada Animal Care', 'Karuna Volunteers', 'Hyderabad Animal Warriors'];

export const NGODashboard: React.FC = () => {
  const { cases } = useCaseStore();
  const { route, navigate } = useRouter();
  const [filter, setFilter] = useState<'open' | 'all' | 'mine'>('open');

  const selectedId = route.name === 'ngo' ? route.caseId : undefined;
  const selected = cases.find((c) => c.id === selectedId);

  const visible = useMemo(() => {
    let list = [...cases];
    if (filter === 'open') {
      list = list.filter((c) =>
        c.status !== 'adopted' && c.status !== 'released' && c.status !== 'discharged');
    }
    if (filter === 'mine') {
      list = list.filter((c) => c.ngo === 'Karuna Volunteers');
    }
    list.sort((a, b) => {
      const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (s !== 0) return s;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return list;
  }, [cases, filter]);

  const stats = useMemo(() => {
    const open = cases.filter((c) => c.status !== 'adopted' && c.status !== 'released').length;
    const critical = cases.filter((c) => c.severity === 'critical' && c.status !== 'discharged' && c.status !== 'adopted').length;
    const inTreatment = cases.filter((c) => c.status === 'in_treatment').length;
    const discharged = cases.filter((c) => c.status === 'discharged' || c.status === 'adopted').length;
    return { open, critical, inTreatment, discharged };
  }, [cases]);

  return (
    <main className="container mx-auto p-4 md:p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Open cases" value={stats.open} tone="bg-blue-50 text-blue-800" />
        <StatCard label="Critical" value={stats.critical} tone="bg-red-50 text-red-800" />
        <StatCard label="In treatment" value={stats.inTreatment} tone="bg-amber-50 text-amber-800" />
        <StatCard label="Recovered" value={stats.discharged} tone="bg-emerald-50 text-emerald-800" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Case queue</h2>
            <span className="text-sm text-slate-500">({visible.length})</span>
          </div>
          <div className="flex gap-1 text-sm">
            {(['open', 'mine', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  'px-3 py-1 rounded ' +
                  (filter === f ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100')
                }
              >
                {f === 'mine' ? 'My NGO' : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2">
          <div className="border-r border-slate-100 max-h-[70vh] overflow-y-auto">
            {visible.length === 0 ? (
              <Empty>No cases match this filter.</Empty>
            ) : (
              visible.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate({ name: 'ngo', caseId: c.id })}
                  className={
                    'w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 flex gap-3 ' +
                    (selectedId === c.id ? 'bg-teal-50' : '')
                  }
                >
                  <img src={c.imageDataUrl} alt="" className="w-16 h-16 rounded object-cover bg-slate-100 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityChip s={c.severity} />
                      <StatusChip s={c.status} />
                    </div>
                    <div className="text-sm font-medium text-slate-800 line-clamp-1">
                      {c.probableCondition}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">📍 {c.location.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {c.reporterName} · {relativeTime(c.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {selected ? <CaseDetailNGO c={selected} /> : <Empty>Select a case from the queue on the left.</Empty>}
          </div>
        </div>
      </div>
    </main>
  );
};

const StatCard: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className={'rounded-lg p-3 ' + tone}>
    <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>
);

const CaseDetailNGO: React.FC<{ c: Case }> = ({ c }) => {
  const { assignCase, advanceStatus, addNote } = useCaseStore();
  const [responder, setResponder] = useState(c.assignedResponder || RESPONDERS[0]);
  const [ngo, setNgo] = useState(c.ngo || NGOS[1]);
  const [noteText, setNoteText] = useState('');
  const next = nextStatus(c.status);

  return (
    <div className="space-y-4">
      <div className="aspect-[16/9] bg-slate-100 rounded overflow-hidden">
        <img src={c.imageDataUrl} alt="" className="w-full h-full object-cover" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SeverityChip s={c.severity} />
        <StatusChip s={c.status} />
        <span className="text-xs text-slate-500 ml-auto">ID: <code>{c.id}</code></span>
      </div>

      <h3 className="text-lg font-semibold text-slate-800">{c.probableCondition}</h3>
      <div className="text-sm text-slate-600">
        Reported by <span className="font-medium">{c.reporterName}</span>{' '}
        {c.reporterContact && <span>({c.reporterContact}) </span>}
        at <span className="font-medium">{c.location.label}</span>
      </div>

      {c.status === 'reported' && <AutoDispatchPanel c={c} showAll />}

      {c.status === 'reported' ? (
        <div className="bg-purple-50 border border-purple-200 rounded p-3 space-y-2">
          <div className="font-medium text-purple-900">Or manually assign</div>
          <div className="grid grid-cols-2 gap-2">
            <select className="p-2 border border-slate-300 rounded text-sm" value={ngo} onChange={(e) => setNgo(e.target.value)}>
              {NGOS.map((n) => <option key={n}>{n}</option>)}
            </select>
            <select className="p-2 border border-slate-300 rounded text-sm" value={responder} onChange={(e) => setResponder(e.target.value)}>
              {RESPONDERS.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <button
            onClick={() => assignCase(c.id, responder, ngo)}
            className="w-full bg-purple-600 text-white font-medium py-2 rounded hover:bg-purple-700 text-sm"
          >
            Dispatch responder
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm">
          <div>Assigned to: <span className="font-medium">{c.assignedResponder}</span></div>
          <div>NGO: <span className="font-medium">{c.ngo}</span></div>
        </div>
      )}

      {next && (
        <button
          onClick={() => advanceStatus(c.id, next, c.assignedResponder || 'NGO Staff')}
          className="w-full bg-teal-600 text-white font-medium py-2 rounded hover:bg-teal-700 text-sm"
        >
          Advance status → {STATUS_LABEL[next]}
        </button>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm flex justify-between items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span>Funding</span>
            <span>{formatInr(c.donations.reduce((s, d) => s + d.amountInr, 0))} / {formatInr(c.estimatedCostInr)}</span>
          </div>
          <ProgressBar value={c.donations.reduce((s, d) => s + d.amountInr, 0) / Math.max(1, c.estimatedCostInr)} />
        </div>
        <button
          onClick={() => downloadPdfLedger(c)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1 whitespace-nowrap"
        >
          📥 Export Ledger
        </button>
      </div>

      <div className="space-y-2">
        <div className="font-medium text-slate-700">Notes ({c.notes.length})</div>
        <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
          {c.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
        <div className="flex gap-2">
          <input
            type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note (visible to all stakeholders)"
            className="flex-1 p-2 border border-slate-300 rounded text-sm"
          />
          <button
            onClick={() => { if (noteText.trim()) { addNote(c.id, c.assignedResponder || 'NGO Staff', noteText.trim()); setNoteText(''); } }}
            className="bg-slate-700 text-white px-3 rounded text-sm hover:bg-slate-800"
          >Add</button>
        </div>
      </div>

      <details className="text-sm">
        <summary className="font-medium text-slate-700 cursor-pointer">Case timeline ({c.events.length})</summary>
        <ol className="mt-2 space-y-1.5 text-slate-600 border-l-2 border-slate-200 pl-3">
          {[...c.events].reverse().map((ev, i) => (
            <li key={i}>
              <div className="text-xs text-slate-400">{new Date(ev.ts).toLocaleString()}</div>
              <div><span className="font-medium">{ev.actor}</span> — {ev.details}</div>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
};
