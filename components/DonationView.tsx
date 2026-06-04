// Donation views — list of donatable cases and the per-case donation page.

import React, { useState } from 'react';
import { useCaseStore, donationProgress, totalDonated, isDonatable } from '../store/caseStore';
import { useRouter } from '../store/router';
import { Case } from '../types';
import { CaseCard, Empty, formatInr, ProgressBar, SeverityChip, StatusChip, relativeTime } from './shared';

export const DonationsList: React.FC = () => {
  const { cases } = useCaseStore();
  const { navigate } = useRouter();
  const list = cases.filter(isDonatable);

  return (
    <main className="container mx-auto p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-800">Help fund a rescue</h1>
        <p className="text-sm text-slate-600 mt-1">
          Every rupee you donate is logged against this animal's actual treatment bills — not a generic fund.
          Click any case to donate and see the full ledger.
        </p>
      </div>

      {list.length === 0 ? (
        <Empty>No active cases need funding right now — thank you 🐾</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              onClick={() => navigate({ name: 'donations', caseId: c.id })}
              footer={
                <button className="mt-2 w-full bg-rose-600 text-white text-sm font-medium py-2 rounded hover:bg-rose-700">
                  Donate ❤
                </button>
              }
            />
          ))}
        </div>
      )}
    </main>
  );
};

export const PerCaseDonation: React.FC<{ caseId: string }> = ({ caseId }) => {
  const { getCase, addDonation } = useCaseStore();
  const { navigate } = useRouter();
  const c = getCase(caseId);

  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState<number>(500);
  const [message, setMessage] = useState('');
  const [justDonated, setJustDonated] = useState(false);

  if (!c) {
    return (
      <main className="container mx-auto p-6">
        <Empty>Case not found.</Empty>
        <div className="text-center mt-4">
          <button onClick={() => navigate({ name: 'donations' })} className="text-teal-600 hover:underline">
            ← Back to all donatable cases
          </button>
        </div>
      </main>
    );
  }

  const raised = totalDonated(c);
  const pct = donationProgress(c);

  const submit = () => {
    addDonation(c.id, {
      donorName: donorName.trim() || 'Anonymous',
      amountInr: Math.max(1, amount),
      message: message.trim() || undefined,
    });
    setJustDonated(true);
    setAmount(500);
    setMessage('');
  };

  return (
    <main className="container mx-auto p-4 md:p-6 max-w-5xl">
      <button onClick={() => navigate({ name: 'donations' })} className="text-sm text-teal-600 hover:underline mb-3">
        ← All donatable cases
      </button>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: case info */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="aspect-video bg-slate-100">
            <img src={c.imageDataUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityChip s={c.severity} />
              <StatusChip s={c.status} />
              <span className="text-xs text-slate-500 ml-auto">ID: <code>{c.id}</code></span>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">{c.probableCondition}</h2>
            <p className="text-sm text-slate-600">📍 {c.location.label}</p>
            <p className="text-sm text-slate-600">
              Reported by <span className="font-medium">{c.reporterName}</span> · {relativeTime(c.createdAt)}
            </p>

            <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{formatInr(raised)} raised</span>
                <span className="text-slate-600">of {formatInr(c.estimatedCostInr)}</span>
              </div>
              <ProgressBar value={pct} />
              <div className="text-xs text-slate-600 mt-2">{Math.round(pct * 100)}% funded · {c.donations.length} donors</div>
            </div>
          </div>
        </div>

        {/* Right: donate form + ledger */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800">Donate to this case</h3>
            <p className="text-xs text-slate-500 mb-3">
              Demo flow — no real payment. In production this calls Razorpay/PayU/Stripe and writes
              an immutable event to the per-case ledger.
            </p>

            {justDonated && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded p-2 text-sm mb-3">
                ✓ Thank you! Your donation has been added to {c.id}'s ledger.
              </div>
            )}

            <label className="block text-sm font-medium text-slate-700 mt-2">Your name</label>
            <input className="w-full p-2 border border-slate-300 rounded mt-1 text-sm"
              value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Leave blank for Anonymous" />

            <label className="block text-sm font-medium text-slate-700 mt-3">Amount (₹)</label>
            <div className="flex gap-1 mt-1">
              {[100, 500, 1000, 2500, 5000].map((p) => (
                <button key={p} onClick={() => setAmount(p)}
                  className={`flex-1 py-1.5 rounded text-sm border ${amount === p ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  ₹{p}
                </button>
              ))}
            </div>
            <input type="number" className="w-full p-2 border border-slate-300 rounded mt-2 text-sm"
              value={amount} onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))} />

            <label className="block text-sm font-medium text-slate-700 mt-3">Message (optional)</label>
            <input className="w-full p-2 border border-slate-300 rounded mt-1 text-sm"
              value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Get well soon!" />

            <button onClick={submit} className="w-full mt-4 bg-rose-600 text-white font-semibold py-2 rounded hover:bg-rose-700">
              Donate {formatInr(amount)} ❤
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-2">Per-case ledger ({c.donations.length})</h3>
            {c.donations.length === 0 ? (
              <p className="text-sm text-slate-500">No donations yet — be the first.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {[...c.donations].reverse().map((d) => (
                  <li key={d.id} className="py-2 flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{d.donorName}</div>
                      {d.message && <div className="text-xs text-slate-500 italic truncate">"{d.message}"</div>}
                      <div className="text-xs text-slate-400">{new Date(d.ts).toLocaleString()}</div>
                    </div>
                    <div className="text-right text-rose-700 font-semibold whitespace-nowrap">{formatInr(d.amountInr)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
