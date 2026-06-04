// =====================================================================
// KARUNA — Analytics dashboard.
//
// Computes every KPI from the live case store (no hardcoded numbers).
// Inline SVG charts — no chart library, no extra dependency.
// =====================================================================

import React, { useMemo } from 'react';
import { useCaseStore, totalDonated, donationProgress } from '../store/caseStore';
import { useRouter } from '../store/router';
import { Case, CaseStatus, Severity, STATUS_LABEL, STATUS_FLOW } from '../types';
import { formatInr } from './shared';

// ───────────────────────────────────────────────────────────────────────
// Tiny formatting helpers
// ───────────────────────────────────────────────────────────────────────

const fmtPct = (x: number) => `${Math.round(x * 100)}%`;
const fmtHr  = (h: number) => h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS);

// ───────────────────────────────────────────────────────────────────────
// KPI calculations — all from the case store
// ───────────────────────────────────────────────────────────────────────

interface Kpis {
  totalCases: number;
  openCases: number;
  criticalOpen: number;
  recoveredCount: number;
  recoveryRatePct: number;
  adoptedCount: number;
  adoptionRatePct: number;
  totalDonatedInr: number;
  unfundedShortfallInr: number;
  fundingCoveragePct: number;
  uniqueDonors: number;
  avgResponseHr: number | null;
  medianResponseHr: number | null;
  reportsLast7d: number;
  reportsPrev7d: number;
  newReportsTrend: number;     // (last7 - prev7) / prev7
  donationsLast30d: number;
}

const computeKpis = (cases: Case[]): Kpis => {
  const totalCases = cases.length;
  const openCases = cases.filter(c => c.status !== 'adopted' && c.status !== 'released').length;
  const criticalOpen = cases.filter(c =>
    c.severity === 'critical' && c.status !== 'adopted' && c.status !== 'released' && c.status !== 'discharged'
  ).length;
  const recoveredCount = cases.filter(c =>
    c.status === 'discharged' || c.status === 'adopted' || c.status === 'released'
  ).length;
  const recoveryRatePct = totalCases ? recoveredCount / totalCases : 0;

  const adoptedCount = cases.filter(c => c.status === 'adopted').length;
  // Adoption rate of recovered animals that could be adopted
  const adoptionRatePct = recoveredCount ? adoptedCount / recoveredCount : 0;

  const totalDonatedInr = cases.reduce((s, c) => s + totalDonated(c), 0);
  const totalCostInr = cases.reduce((s, c) => s + c.estimatedCostInr, 0);
  const unfundedShortfallInr = Math.max(0, totalCostInr - totalDonatedInr);
  const fundingCoveragePct = totalCostInr ? Math.min(1, totalDonatedInr / totalCostInr) : 0;

  const donorNames = new Set<string>();
  cases.forEach(c => c.donations.forEach(d => donorNames.add(d.donorName)));
  const uniqueDonors = donorNames.size;

  // Response time: ms between 'created' and first 'assigned' event
  const responseHrs: number[] = [];
  for (const c of cases) {
    const created = c.events.find(e => e.type === 'created');
    const assigned = c.events.find(e => e.type === 'assigned');
    if (created && assigned) {
      const dt = new Date(assigned.ts).getTime() - new Date(created.ts).getTime();
      if (dt >= 0) responseHrs.push(dt / 3600000);
    }
  }
  responseHrs.sort((a, b) => a - b);
  const avgResponseHr = responseHrs.length ? responseHrs.reduce((s, x) => s + x, 0) / responseHrs.length : null;
  const medianResponseHr = responseHrs.length ? responseHrs[Math.floor(responseHrs.length / 2)] : null;

  // Trend: last 7d vs prev 7d
  const now = Date.now();
  const reportsLast7d = cases.filter(c => now - new Date(c.createdAt).getTime() < 7 * DAY_MS).length;
  const reportsPrev7d = cases.filter(c => {
    const dt = now - new Date(c.createdAt).getTime();
    return dt >= 7 * DAY_MS && dt < 14 * DAY_MS;
  }).length;
  const newReportsTrend = reportsPrev7d ? (reportsLast7d - reportsPrev7d) / reportsPrev7d : 0;

  // Donations in last 30 days
  let donationsLast30d = 0;
  for (const c of cases) {
    for (const d of c.donations) {
      if (now - new Date(d.ts).getTime() < 30 * DAY_MS) donationsLast30d += d.amountInr;
    }
  }

  return {
    totalCases, openCases, criticalOpen, recoveredCount, recoveryRatePct,
    adoptedCount, adoptionRatePct, totalDonatedInr, unfundedShortfallInr,
    fundingCoveragePct, uniqueDonors, avgResponseHr, medianResponseHr,
    reportsLast7d, reportsPrev7d, newReportsTrend, donationsLast30d,
  };
};

// ───────────────────────────────────────────────────────────────────────
// Time-series bucketing
// ───────────────────────────────────────────────────────────────────────

interface DayBucket { date: string; reports: number; recoveries: number; }

const bucketByDay = (cases: Case[], days: number): DayBucket[] => {
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ date: key, reports: 0, recoveries: 0 });
  }
  const idxOf = (iso: string) => {
    const key = iso.slice(0, 10);
    return buckets.findIndex(b => b.date === key);
  };
  for (const c of cases) {
    const i = idxOf(c.createdAt);
    if (i >= 0) buckets[i].reports++;
    // Find any 'status' event with → discharged
    for (const e of c.events) {
      if (e.type === 'status' && e.details.includes('discharged')) {
        const j = idxOf(e.ts);
        if (j >= 0) buckets[j].recoveries++;
      }
    }
  }
  return buckets;
};

const severityCounts = (cases: Case[]): Record<Severity, number> => {
  const out: Record<Severity, number> = { critical: 0, urgent: 0, routine: 0 };
  cases.forEach(c => out[c.severity]++);
  return out;
};

const statusCounts = (cases: Case[]): Record<CaseStatus, number> => {
  const out: Record<CaseStatus, number> = {
    reported: 0, assigned: 0, collected: 0, at_clinic: 0,
    in_treatment: 0, discharged: 0, adopted: 0, released: 0,
  };
  cases.forEach(c => out[c.status]++);
  return out;
};

interface NgoStat { ngo: string; cases: number; donations: number; recoveries: number; }

const ngoLeaderboard = (cases: Case[]): NgoStat[] => {
  const m = new Map<string, NgoStat>();
  for (const c of cases) {
    const k = c.ngo || 'Unassigned';
    if (!m.has(k)) m.set(k, { ngo: k, cases: 0, donations: 0, recoveries: 0 });
    const s = m.get(k)!;
    s.cases++;
    s.donations += totalDonated(c);
    if (c.status === 'discharged' || c.status === 'adopted' || c.status === 'released') s.recoveries++;
  }
  return [...m.values()].sort((a, b) => b.cases - a.cases);
};

const cityHotspots = (cases: Case[]): Array<{ city: string; count: number }> => {
  const m = new Map<string, number>();
  for (const c of cases) {
    // city = first segment of location label after the comma, or label itself
    const parts = c.location.label.split(',').map(s => s.trim());
    const city = parts[parts.length - 1] || c.location.label;
    m.set(city, (m.get(city) || 0) + 1);
  }
  return [...m.entries()].map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
};

// ───────────────────────────────────────────────────────────────────────
// Tiny inline SVG charts (no external library)
// ───────────────────────────────────────────────────────────────────────

const LineChart: React.FC<{
  data: DayBucket[];
  width?: number;
  height?: number;
}> = ({ data, width = 720, height = 200 }) => {
  if (data.length < 2) return null;
  const padX = 30, padY = 18;
  const reportMax = Math.max(1, ...data.map(d => Math.max(d.reports, d.recoveries)));
  const stepX = (width - padX * 2) / (data.length - 1);
  const yScale = (v: number) => height - padY - (v / reportMax) * (height - padY * 2);

  const pathFor = (key: 'reports' | 'recoveries') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${yScale(d[key])}`).join(' ');

  const labelStride = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* y-axis grid */}
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={padX} x2={width - padX}
          y1={yScale(reportMax * p)} y2={yScale(reportMax * p)}
          stroke="#e2e8f0" strokeDasharray="2,3" />
      ))}
      {/* x-axis */}
      <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke="#cbd5e1" />
      {/* lines */}
      <path d={pathFor('reports')}    stroke="#0d9488" strokeWidth={2.5} fill="none" />
      <path d={pathFor('recoveries')} stroke="#10b981" strokeWidth={2}   fill="none" strokeDasharray="4,3" />
      {/* points */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={padX + i * stepX} cy={yScale(d.reports)}    r={2.5} fill="#0d9488" />
          <circle cx={padX + i * stepX} cy={yScale(d.recoveries)} r={2.5} fill="#10b981" />
        </g>
      ))}
      {/* x-labels */}
      {data.map((d, i) => {
        if (i % labelStride !== 0 && i !== data.length - 1) return null;
        const label = d.date.slice(5);  // MM-DD
        return (
          <text key={i} x={padX + i * stepX} y={height - 4}
            fontSize={9} fill="#64748b" textAnchor="middle">{label}</text>
        );
      })}
      {/* y max label */}
      <text x={4} y={padY + 4} fontSize={9} fill="#64748b">{reportMax}</text>
      <text x={4} y={height - padY} fontSize={9} fill="#64748b">0</text>
    </svg>
  );
};

const Donut: React.FC<{
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}> = ({ segments, size = 160, thickness = 30 }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 4;
  const cx = size / 2, cy = size / 2;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      <circle cx={cx} cy={cy} r={r} stroke="#f1f5f9" strokeWidth={thickness} fill="none" />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const length = 2 * Math.PI * r * frac;
        const gap = 2 * Math.PI * r - length;
        const rot = (offset / total) * 360 - 90;
        offset += s.value;
        return (
          <circle key={i}
            cx={cx} cy={cy} r={r}
            stroke={s.color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${length} ${gap}`}
            transform={`rotate(${rot} ${cx} ${cy})`} />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size / 7} fontWeight={700} fill="#0f172a">{total}</text>
      <text x={cx} y={cy + size / 9} textAnchor="middle" fontSize={size / 14} fill="#64748b">total</text>
    </svg>
  );
};

// Status pipeline funnel — horizontal bars
const StatusFunnel: React.FC<{ counts: Record<CaseStatus, number> }> = ({ counts }) => {
  const values: number[] = Object.values(counts);
  const max = Math.max(1, ...values);
  const COLORS: Record<CaseStatus, string> = {
    reported:     '#3b82f6',
    assigned:     '#8b5cf6',
    collected:    '#6366f1',
    at_clinic:    '#06b6d4',
    in_treatment: '#f59e0b',
    discharged:   '#10b981',
    adopted:      '#ec4899',
    released:     '#14b8a6',
  };
  return (
    <div className="space-y-1.5">
      {STATUS_FLOW.concat(['adopted','released']).map(s => (
        <div key={s} className="flex items-center gap-2">
          <span className="w-24 text-xs text-slate-600 capitalize">{STATUS_LABEL[s]}</span>
          <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden relative">
            <div className="h-full transition-all" style={{
              width: `${(counts[s] / max) * 100}%`,
              background: COLORS[s],
            }} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-800">
              {counts[s]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// UI building blocks
// ───────────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  tone?: string;
}> = ({ label, value, hint, trend, tone = 'bg-white' }) => (
  <div className={`rounded-xl border border-slate-200 shadow-sm p-4 ${tone}`}>
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 flex items-baseline gap-2">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {typeof trend === 'number' && trend !== 0 && (
        <span className={`text-xs font-semibold ${trend > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
          {trend > 0 ? '▲' : '▼'} {Math.abs(Math.round(trend * 100))}%
        </span>
      )}
    </div>
    {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> =
  ({ title, children, right }) => (
  <div className="rounded-xl border border-slate-200 shadow-sm bg-white p-5">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Main view
// ───────────────────────────────────────────────────────────────────────

export const StatsView: React.FC = () => {
  const { cases } = useCaseStore();
  const { navigate } = useRouter();

  const kpis = useMemo(() => computeKpis(cases), [cases]);
  const sev = useMemo(() => severityCounts(cases), [cases]);
  const statuses = useMemo(() => statusCounts(cases), [cases]);
  const timeseries = useMemo(() => bucketByDay(cases, 30), [cases]);
  const ngos = useMemo(() => ngoLeaderboard(cases), [cases]);
  const hotspots = useMemo(() => cityHotspots(cases), [cases]);

  if (cases.length === 0) {
    return (
      <main className="container mx-auto p-4 md:p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center max-w-2xl mx-auto">
          <div className="text-5xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">No cases yet</h1>
          <p className="text-slate-600 mb-6">
            Analytics will populate as soon as cases are submitted. Submit your first case from
            the citizen-report flow, or click below to load demo data for the pitch.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate({ name: 'citizen' })}
              className="bg-teal-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-teal-700"
            >
              Submit a case →
            </button>
            <button
              onClick={() => location.reload()}
              className="bg-slate-100 text-slate-700 px-5 py-2 rounded-lg hover:bg-slate-200"
            >
              Refresh
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-6">
            Tip: in the top nav, click <span className="font-semibold">+ Load demo cases</span> to
            populate 24 sample cases across the last 60 days.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Analytics dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live metrics from the case store. Every number below is computed in real-time
          from {cases.length} cases — no hardcoded values.
        </p>
      </div>

      {/* ─── Top KPI row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total cases"
          value={kpis.totalCases.toString()}
          hint={`${kpis.openCases} open, ${kpis.recoveredCount} recovered`}
        />
        <KpiCard
          label="Critical · open"
          value={kpis.criticalOpen.toString()}
          hint="needs dispatch now"
          tone={kpis.criticalOpen ? 'bg-red-50' : 'bg-white'}
        />
        <KpiCard
          label="Recovery rate"
          value={fmtPct(kpis.recoveryRatePct)}
          hint={`${kpis.recoveredCount} of ${kpis.totalCases} healed`}
          tone="bg-emerald-50"
        />
        <KpiCard
          label="Adoption rate"
          value={fmtPct(kpis.adoptionRatePct)}
          hint={`${kpis.adoptedCount} adopted of ${kpis.recoveredCount} recovered`}
          tone="bg-pink-50"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total raised"
          value={formatInr(kpis.totalDonatedInr)}
          hint={`${kpis.uniqueDonors} unique donors`}
          tone="bg-rose-50"
        />
        <KpiCard
          label="Funding coverage"
          value={fmtPct(kpis.fundingCoveragePct)}
          hint={kpis.unfundedShortfallInr > 0 ? `Gap: ${formatInr(kpis.unfundedShortfallInr)}` : 'Fully funded'}
          tone="bg-amber-50"
        />
        <KpiCard
          label="Median response"
          value={kpis.medianResponseHr != null ? fmtHr(kpis.medianResponseHr) : '—'}
          hint={kpis.avgResponseHr != null ? `Avg ${fmtHr(kpis.avgResponseHr)}` : 'No data'}
          tone="bg-sky-50"
        />
        <KpiCard
          label="Reports · last 7d"
          value={kpis.reportsLast7d.toString()}
          trend={kpis.newReportsTrend}
          hint={`Prev 7d: ${kpis.reportsPrev7d}`}
        />
      </div>

      {/* ─── Time-series + Severity donut ─────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          <Card
            title="Cases over the last 30 days"
            right={
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-600 inline-block" /> Reports</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" style={{borderTop: '1.5px dashed #10b981', background:'none'}} /> Recoveries</span>
              </div>
            }>
            <LineChart data={timeseries} />
          </Card>
        </div>
        <Card title="Severity breakdown">
          <div className="flex flex-col items-center">
            <Donut segments={[
              { label: 'Critical', value: sev.critical, color: '#ef4444' },
              { label: 'Urgent',   value: sev.urgent,   color: '#f59e0b' },
              { label: 'Routine',  value: sev.routine,  color: '#64748b' },
            ]} />
            <div className="mt-3 space-y-1 text-sm w-full">
              {[
                { l: 'Critical', v: sev.critical, c: '#ef4444' },
                { l: 'Urgent',   v: sev.urgent,   c: '#f59e0b' },
                { l: 'Routine',  v: sev.routine,  c: '#64748b' },
              ].map(x => (
                <div key={x.l} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.c }} />
                    {x.l}
                  </span>
                  <span className="text-slate-500">{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Pipeline + NGO leaderboard ───────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          <Card title="Case-status pipeline">
            <StatusFunnel counts={statuses} />
          </Card>
        </div>
        <Card title="NGO leaderboard">
          <ul className="divide-y divide-slate-100 text-sm">
            {ngos.map(n => (
              <li key={n.ngo} className="py-2.5">
                <div className="font-medium text-slate-800">{n.ngo}</div>
                <div className="text-xs text-slate-500">
                  {n.cases} cases · {n.recoveries} recovered · {formatInr(n.donations)} raised
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ─── Donations 30d & city hotspots ────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Donations · last 30 days">
          <div className="text-4xl font-bold text-rose-700">{formatInr(kpis.donationsLast30d)}</div>
          <div className="text-xs text-slate-500 mt-2">
            From {kpis.uniqueDonors} unique donors across {ngos.length} NGOs.
          </div>
        </Card>
        <div className="md:col-span-2">
          <Card title="City hotspots">
            <ul className="space-y-2 text-sm">
              {hotspots.map(h => {
                const pct = h.count / Math.max(1, hotspots[0].count);
                return (
                  <li key={h.city} className="flex items-center gap-3">
                    <span className="w-44 text-slate-700 truncate" title={h.city}>{h.city}</span>
                    <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                      <div className="h-full bg-teal-500" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="text-slate-600 text-xs w-6 text-right">{h.count}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <div className="text-center mt-4">
        <button onClick={() => navigate({ name: 'ngo' })}
          className="text-sm text-teal-700 hover:underline">
          → Open the NGO dashboard
        </button>
      </div>
    </main>
  );
};
