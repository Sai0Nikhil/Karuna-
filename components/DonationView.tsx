// Donation views — list of donatable cases and the per-case donation page.

import React, { useState } from 'react';
import { useCaseStore, donationProgress, totalDonated, isDonatable } from '../store/caseStore';
import { useRouter } from '../store/router';
import { Case } from '../types';
import { CaseCard, Empty, formatInr, ProgressBar, SeverityChip, StatusChip, relativeTime, downloadPdfLedger } from './shared';

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

  // Razorpay simulation state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'Netbanking'>('UPI');
  const [selectedUpiApp, setSelectedUpiApp] = useState('Google Pay');
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'upi_pin' | 'verifying' | 'success'>('idle');

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

  const handleDonateClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setPaymentState('idle');
    setShowCheckoutModal(true);
  };

  const handlePay = () => {
    setPaymentState('processing');
    setTimeout(() => {
      if (paymentMethod === 'UPI') {
        setPaymentState('upi_pin');
      } else {
        setPaymentState('verifying');
      }
      setTimeout(() => {
        setPaymentState('success');
        setTimeout(() => {
          addDonation(c.id, {
            donorName: donorName.trim() || 'Anonymous',
            amountInr: Math.max(1, amount),
            message: message.trim() || undefined,
            paymentMethod,
            billOffsetDetails: `Case #${c.id} Vet Treatment Offset`,
          });
          setShowCheckoutModal(false);
          setJustDonated(true);
          setAmount(500);
          setMessage('');
        }, 1200);
      }, 1500);
    }, 1500);
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
              This triggers a sandbox payment simulation styled like a Razorpay checkout sheet.
            </p>

            {justDonated && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm mb-3 flex flex-col gap-2">
                <div>✓ Thank you! Your donation has been added to {c.id}'s ledger.</div>
                <button
                  onClick={() => downloadPdfLedger(c)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-3 rounded text-xs self-start flex items-center gap-1"
                >
                  📥 Download PDF Ledger
                </button>
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

            <button onClick={handleDonateClick} className="w-full mt-4 bg-rose-600 text-white font-semibold py-2 rounded hover:bg-rose-700">
              Donate {formatInr(amount)} ❤
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-slate-800">Per-case ledger ({c.donations.length})</h3>
              {c.donations.length > 0 && (
                <button
                  onClick={() => downloadPdfLedger(c)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1 px-2.5 rounded border border-slate-300 flex items-center gap-1"
                >
                  📥 Export PDF
                </button>
              )}
            </div>
            {c.donations.length === 0 ? (
              <p className="text-sm text-slate-500">No donations yet — be the first.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {[...c.donations].reverse().map((d) => (
                  <li key={d.id} className="py-2 flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{d.donorName}</div>
                      {d.message && <div className="text-xs text-slate-500 italic truncate">"{d.message}"</div>}
                      <div className="text-xs text-slate-400">
                        {new Date(d.ts).toLocaleString()} · <span className="font-semibold text-indigo-600">{d.paymentMethod || 'UPI'}</span>
                      </div>
                    </div>
                    <div className="text-right text-rose-700 font-semibold whitespace-nowrap">{formatInr(d.amountInr)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Razorpay Simulation Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col">
            {/* Razorpay-style Header */}
            <div className="bg-[#1F2438] text-white p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐾</span>
                  <span className="font-bold tracking-wide text-lg">KARUNA</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Secure Sandbox Checkout</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Amount to pay</div>
                <div className="text-lg font-bold text-emerald-400">₹{amount}</div>
              </div>
            </div>

            {paymentState === 'idle' ? (
              <div className="p-5 flex-1 space-y-4">
                <div className="text-sm font-semibold text-slate-700">Select Payment Method</div>
                
                {/* UPI Option */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${paymentMethod === 'UPI' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={paymentMethod === 'UPI'} onChange={() => setPaymentMethod('UPI')} className="text-indigo-600 focus:ring-indigo-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">UPI (Google Pay, PhonePe)</div>
                    <div className="text-xs text-slate-500">Pay instantly using any UPI app</div>
                  </div>
                  <span className="text-lg">📱</span>
                </label>

                {/* Card Option */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${paymentMethod === 'Card' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={paymentMethod === 'Card'} onChange={() => setPaymentMethod('Card')} className="text-indigo-600 focus:ring-indigo-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">Card (Credit/Debit)</div>
                    <div className="text-xs text-slate-500">Visa, MasterCard, RuPay supported</div>
                  </div>
                  <span className="text-lg">💳</span>
                </label>

                {/* Netbanking Option */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${paymentMethod === 'Netbanking' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={paymentMethod === 'Netbanking'} onChange={() => setPaymentMethod('Netbanking')} className="text-indigo-600 focus:ring-indigo-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">Netbanking</div>
                    <div className="text-xs text-slate-500">All major Indian banks</div>
                  </div>
                  <span className="text-lg">🏦</span>
                </label>

                {paymentMethod === 'UPI' && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {['Google Pay', 'PhonePe', 'Paytm'].map((app) => (
                      <button key={app} onClick={() => setSelectedUpiApp(app)} className={`py-1.5 px-2 rounded border text-xs font-medium ${selectedUpiApp === app ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        {app}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200">
                    Cancel
                  </button>
                  <button onClick={handlePay} className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 shadow">
                    Pay ₹{amount}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-4">
                {paymentState === 'processing' && (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    <div className="text-slate-800 font-medium text-lg">Processing payment...</div>
                    <div className="text-xs text-slate-500">Please do not refresh or press back</div>
                  </>
                )}
                {paymentState === 'upi_pin' && (
                  <>
                    <div className="relative">
                      <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-indigo-400 opacity-75"></div>
                      <div className="rounded-full h-12 w-12 bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">🔒</div>
                    </div>
                    <div className="text-slate-800 font-medium text-lg">Confirming secure UPI PIN...</div>
                    <div className="text-xs text-slate-500">A request has been sent to your {selectedUpiApp} app</div>
                  </>
                )}
                {paymentState === 'verifying' && (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-600 border-t-transparent"></div>
                    <div className="text-slate-800 font-medium text-lg">Verifying transaction...</div>
                    <div className="text-xs text-slate-500">Authenticating with secure gateway</div>
                  </>
                )}
                {paymentState === 'success' && (
                  <>
                    <div className="rounded-full h-16 w-16 bg-emerald-100 flex items-center justify-center text-emerald-600 text-3xl font-bold animate-bounce">✓</div>
                    <div className="text-emerald-800 font-bold text-xl">Transaction Successful!</div>
                    <div className="text-xs text-slate-500">Your donation was logged against immutable audit ledger</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
