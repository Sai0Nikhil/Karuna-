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

export const downloadPdfLedger = (c: Case) => {
  const { jsPDF } = (window as any).jspdf || {};
  if (!jsPDF) {
    alert('jsPDF library is not loaded. Please try again.');
    return;
  }

  const doc = new jsPDF();

  // Set colors
  const teal = '#0F766E';
  const dark = '#1E293B';
  const gray = '#475569';

  // Title block
  doc.setFillColor(15, 118, 110); // Teal
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('KARUNA ANIMAL RESCUE', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('DONATION AUDIT & CASE LEDGER', 20, 32);

  // Case Metadata
  doc.setTextColor(25, 35, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`CASE REPORT #K${c.id}`, 20, 55);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 80, 95);

  let y = 65;
  doc.text(`Species: ${c.species}`, 20, y);
  doc.text(`Location: ${c.location.label}`, 110, y);
  y += 6;
  doc.text(`Condition: ${c.probableCondition}`, 20, y);
  doc.text(`Status: ${c.status.toUpperCase()}`, 110, y);
  y += 6;
  doc.text(`Reported By: ${c.reporterName}`, 20, y);
  doc.text(`Reported On: ${new Date(c.createdAt).toLocaleDateString()}`, 110, y);
  y += 6;
  doc.text(`NGO Partner: ${c.ngo || 'Karuna Volunteers'}`, 20, y);
  doc.text(`Estimated Cost: INR ${c.estimatedCostInr.toLocaleString('en-IN')}`, 110, y);

  // Divider
  y += 10;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y, 190, y);

  // Donations Table Header
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DONATIONS RECEIVED', 20, y);

  y += 8;
  doc.setFillColor(241, 245, 249);
  doc.rect(20, y, 170, 8, 'F');
  
  doc.setFontSize(9);
  doc.text('Date', 22, y + 6);
  doc.text('Donor Name', 55, y + 6);
  doc.text('Method', 105, y + 6);
  doc.text('Amount', 135, y + 6);
  doc.text('Offset Reference', 160, y + 6);

  doc.setFont('helvetica', 'normal');
  
  let totalRaised = 0;
  if (c.donations && c.donations.length > 0) {
    c.donations.forEach((d) => {
      totalRaised += d.amountInr;
      y += 8;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(new Date(d.ts).toLocaleDateString(), 22, y + 5);
      doc.text(d.donorName || 'Anonymous', 55, y + 5);
      doc.text(d.paymentMethod || 'UPI', 105, y + 5);
      doc.text(`INR ${d.amountInr.toLocaleString('en-IN')}`, 135, y + 5);
      doc.text(d.billOffsetDetails || 'General Care', 160, y + 5);
    });
  } else {
    y += 8;
    doc.text('No donations logged against this case yet.', 22, y + 5);
  }

  // Donation Total
  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y, 190, y);
  
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Donations Raised: INR ${totalRaised.toLocaleString('en-IN')}`, 20, y);

  // Timeline Events
  y += 15;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CASE TIMELINE & AUDIT LOG', 20, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  if (c.events && c.events.length > 0) {
    c.events.forEach((ev) => {
      y += 8;
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`[${new Date(ev.ts).toLocaleDateString()}] ${ev.actor}:`, 22, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(ev.details, 75, y + 5);
    });
  }

  // Footer stamp
  y += 20;
  if (y > 275) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(15, 118, 110);
  doc.rect(20, y, 170, 15);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('This is a system-generated, blockchain-anchored immutable ledger for animal welfare audit transparency.', 25, y + 6);
  doc.text('Karuṇā Animal Rescue Network is registered under Section 80G of the Income Tax Act.', 25, y + 10);

  doc.save(`Karuna_Ledger_Case_${c.id}.pdf`);
};
