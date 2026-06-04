// Small shared UI pieces used across dashboards.

import React from 'react';
import { Case, Severity, STATUS_LABEL, CaseStatus } from '../types';
import { donationProgress, totalDonated } from '../store/caseStore';

export const SeverityChip: React.FC<{ s: Severity }> = ({ s }) => {
  const styles: Record<Severity, string> = {
    critical: 'bg-red-100 text-red-700 border-red-300',
    urgent: 'bg-amber-100 text-amber-800 border-amber-300',
    routine: 'bg-slate-100 text-slate-700 border-slate-300',
  };
  const label: Record<Severity, string> = {
    critical: 'CRITICAL',
    urgent: 'URGENT',
    routine: 'ROUTINE',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${styles[s]}`}>
      {label[s]}
    </span>
  );
};

const STATUS_TONE: Record<CaseStatus, string> = {
  reported: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  collected: 'bg-indigo-100 text-indigo-800',
  at_clinic: 'bg-cyan-100 text-cyan-800',
  in_treatment: 'bg-amber-100 text-amber-800',
  discharged: 'bg-emerald-100 text-emerald-800',
  adopted: 'bg-pink-100 text-pink-800',
  released: 'bg-teal-100 text-teal-800',
};

export const StatusChip: React.FC<{ s: CaseStatus }> = ({ s }) => (
  <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_TONE[s]}`}>
    {STATUS_LABEL[s]}
  </span>
);

export const formatInr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const relativeTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => (
  <div className={`w-full bg-slate-200 rounded-full h-2 overflow-hidden ${className}`}>
    <div
      className="bg-teal-500 h-full transition-all"
      style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
    />
  </div>
);

export const CaseCard: React.FC<{
  c: Case;
  onClick?: () => void;
  footer?: React.ReactNode;
}> = ({ c, onClick, footer }) => (
  <div
    onClick={onClick}
    className={
      'bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col ' +
      (onClick ? 'cursor-pointer hover:shadow-md transition' : '')
    }
  >
    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
      <img src={c.imageDataUrl} alt={c.species} className="w-full h-full object-cover" />
    </div>
    <div className="p-3 flex-1 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <SeverityChip s={c.severity} />
        <StatusChip s={c.status} />
      </div>
      <div className="text-sm font-medium text-slate-800 line-clamp-2">
        {c.probableCondition}
      </div>
      <div className="text-xs text-slate-500">📍 {c.location.label}</div>
      <div className="text-xs text-slate-500">
        Reported by {c.reporterName} · {relativeTime(c.createdAt)}
      </div>
      {c.estimatedCostInr > 0 && (
        <div className="mt-1">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>{formatInr(totalDonated(c))} raised</span>
            <span>of {formatInr(c.estimatedCostInr)}</span>
          </div>
          <ProgressBar value={donationProgress(c)} />
        </div>
      )}
      {footer}
    </div>
  </div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-center text-slate-500 py-12 border-2 border-dashed border-slate-200 rounded-lg">
    {children}
  </div>
);
