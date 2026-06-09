// Adoption views — list of adoptable animals + per-case adoption page.

import React, { useState } from 'react';
import { useCaseStore, isAdoptable } from '../store/caseStore';
import { useRouter } from '../store/router';
import { CaseCard, Empty, SeverityChip, StatusChip, relativeTime } from './shared';

export const AdoptionList: React.FC = () => {
  const { cases } = useCaseStore();
  const { navigate } = useRouter();
  const list = cases.filter(isAdoptable);

  return (
    <main className="container mx-auto p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-800">Adopt a recovered friend</h1>
        <p className="text-sm text-slate-600 mt-1">
          These animals have been rescued, treated and discharged — and are ready for a loving forever home.
          Adopter verification + post-placement check-ins are built in.
        </p>
      </div>

      {list.length === 0 ? (
        <Empty>No adoptable animals at the moment — check back soon.</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              onClick={() => navigate({ name: 'adoption', caseId: c.id })}
              footer={
                <button className="mt-2 w-full bg-pink-600 text-white text-sm font-medium py-2 rounded hover:bg-pink-700">
                  Apply to adopt 🏠
                </button>
              }
            />
          ))}
        </div>
      )}
    </main>
  );
};

export const PerCaseAdoption: React.FC<{ caseId: string }> = ({ caseId }) => {
  const { getCase, applyForAdoption, decideAdoption, addCheckin } = useCaseStore();
  const { navigate } = useRouter();
  const c = getCase(caseId);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // KYC States
  const [adopterIdUrl, setAdopterIdUrl] = useState('');
  const [kycDocumentName, setKycDocumentName] = useState('');

  // Check-in form states
  const [checkinText, setCheckinText] = useState('');
  const [checkinPhoto, setCheckinPhoto] = useState('');

  if (!c) {
    return (
      <main className="container mx-auto p-6">
        <Empty>Case not found.</Empty>
        <div className="text-center mt-4">
          <button onClick={() => navigate({ name: 'adoption' })} className="text-teal-600 hover:underline">
            ← Back to adoptable animals
          </button>
        </div>
      </main>
    );
  }

  const submit = () => {
    if (!name.trim() || !contact.trim() || !reason.trim()) {
      alert('Please fill in name, contact and a short reason — these help us vet adopters.');
      return;
    }
    applyForAdoption(c.id, { 
      applicantName: name.trim(), 
      contact: contact.trim(), 
      reason: reason.trim(),
      adopterIdUrl: adopterIdUrl || undefined
    });
    setSubmitted(true);
    setName(''); setContact(''); setReason('');
    setAdopterIdUrl(''); setKycDocumentName('');
  };

  return (
    <main className="container mx-auto p-4 md:p-6 max-w-5xl">
      <button onClick={() => navigate({ name: 'adoption' })} className="text-sm text-teal-600 hover:underline mb-3">
        ← All adoptable animals
      </button>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="aspect-video bg-slate-100">
            <img src={c.imageDataUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityChip s={c.severity} />
              <StatusChip s={c.status} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">{c.probableCondition}</h2>
            <div className="text-sm text-slate-600">📍 {c.location.label}</div>
            <div className="text-sm text-slate-600">Cared for by <span className="font-medium">{c.ngo || 'Karuna Volunteers'}</span></div>
            <div className="text-sm text-slate-600">Rescued {relativeTime(c.createdAt)}</div>
            {c.notes.length > 0 && (
              <details className="text-sm">
                <summary className="font-medium text-slate-700 cursor-pointer">Vet notes ({c.notes.length})</summary>
                <ul className="mt-1 list-disc list-inside text-slate-600">
                  {c.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800">Apply to adopt</h3>
            <p className="text-xs text-slate-500 mb-3">
              The NGO will review your application within 2-3 days and may visit before approval.
            </p>

            {submitted && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded p-2 text-sm mb-3">
                ✓ Application submitted. The NGO will be in touch.
              </div>
            )}

            <label className="block text-sm font-medium text-slate-700">Your name</label>
            <input className="w-full p-2 border border-slate-300 rounded mt-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />

            <label className="block text-sm font-medium text-slate-700 mt-3">Phone / email</label>
            <input className="w-full p-2 border border-slate-300 rounded mt-1 text-sm" value={contact} onChange={(e) => setContact(e.target.value)} />

            <label className="block text-sm font-medium text-slate-700 mt-3">Why this animal? (short)</label>
            <textarea rows={3} className="w-full p-2 border border-slate-300 rounded mt-1 text-sm"
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us about your home, prior experience, and why you're a good fit." />

            <label className="block text-sm font-medium text-slate-700 mt-3">Attach KYC ID Document (e.g. Aadhaar, Voter Card)</label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  const mockDocs = [
                    'Aadhaar_Card_Verified.jpg',
                    'Voter_ID_Verified.jpg',
                    'PAN_Card_Verified.jpg',
                    'Passport_Verified.jpg'
                  ];
                  const chosen = mockDocs[Math.floor(Math.random() * mockDocs.length)];
                  setKycDocumentName(chosen);
                  setAdopterIdUrl(`https://res.cloudinary.com/karuna/image/upload/${chosen}`);
                }}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-medium"
              >
                📁 Upload Verification Scan
              </button>
              {kycDocumentName && (
                <span className="text-xs text-green-700 font-semibold">✓ {kycDocumentName} attached</span>
              )}
            </div>

            <button onClick={submit} className="w-full mt-4 bg-pink-600 text-white font-semibold py-2 rounded hover:bg-pink-700">
              Submit application 🏠
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-2">
              Pending applications ({c.adoptionApplications.length})
            </h3>
            {c.adoptionApplications.length === 0 ? (
              <p className="text-sm text-slate-500">No applications yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {[...c.adoptionApplications].reverse().map((a) => (
                  <li key={a.id} className="py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{a.applicantName}</div>
                        <div className="text-xs text-slate-500">{a.contact} · {new Date(a.ts).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-600 mt-1 italic">"{a.reason}"</div>
                        {a.adopterIdUrl && (
                          <div className="text-[11px] text-indigo-600 font-medium mt-1">
                            📄 Verification scan: <a href={a.adopterIdUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{a.adopterIdUrl.split('/').pop()}</a>
                          </div>
                        )}
                      </div>
                      <span className={
                        'text-xs font-medium px-2 py-0.5 rounded shrink-0 ' +
                        (a.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                         a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                         'bg-slate-100 text-slate-600')
                      }>{a.status}</span>
                    </div>

                    {a.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => decideAdoption(c.id, a.id, 'approved', 'NGO Admin')}
                          className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700">
                          Approve (NGO)
                        </button>
                        <button onClick={() => decideAdoption(c.id, a.id, 'rejected', 'NGO Admin')}
                          className="text-xs bg-slate-500 text-white px-3 py-1 rounded hover:bg-slate-600">
                          Reject (NGO)
                        </button>
                      </div>
                    )}

                    {a.status === 'approved' && (
                      <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
                        <div className="font-semibold text-slate-700 text-xs">Post-Placement Check-in Timeline</div>
                        {(() => {
                          let logs: any[] = [];
                          try {
                            if (a.checkinsLogs && a.checkinsLogs !== '[]') {
                              logs = JSON.parse(a.checkinsLogs);
                            }
                          } catch (e) {
                            console.warn('Failed to parse logs', e);
                          }
                          if (logs.length === 0) {
                            return <p className="text-xs text-slate-500 italic">No check-ins submitted yet.</p>;
                          }
                          return (
                            <ul className="space-y-2 text-xs divide-y divide-slate-100">
                              {logs.map((log: any, idx: number) => (
                                <li key={idx} className="pt-2 first:pt-0">
                                  <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>{new Date(log.date).toLocaleDateString()}</span>
                                    {log.photoUrl && <span className="text-emerald-600">📸 Photo attached</span>}
                                  </div>
                                  <p className="text-slate-700 mt-0.5">{log.text}</p>
                                  {log.photoUrl && (
                                    <img src={log.photoUrl} alt="Checkin" className="mt-1 w-20 h-20 object-cover rounded border border-slate-200 bg-slate-100" />
                                  )}
                                </li>
                              ))}
                            </ul>
                          );
                        })()}

                        {/* Add Check-in Form */}
                        <div className="border-t border-slate-200 pt-2 mt-2 space-y-2">
                          <div className="text-[11px] font-medium text-slate-700">Submit New Check-in Report</div>
                          <textarea
                            rows={2}
                            value={checkinText}
                            onChange={(e) => setCheckinText(e.target.value)}
                            placeholder="Enter pet condition, diet, adaptation status..."
                            className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const petPhotos = [
                                  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150', // Happy dog
                                  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150', // Happy cat
                                  'https://images.unsplash.com/photo-1552053831-71594a27632d?w=150'  // Golden retriever
                                ];
                                setCheckinPhoto(petPhotos[Math.floor(Math.random() * petPhotos.length)]);
                              }}
                              className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 px-2 py-1 rounded text-[10px] font-medium"
                            >
                              📷 Capture/Attach Photo
                            </button>
                            {checkinPhoto && (
                              <span className="text-[10px] text-green-700 font-semibold">✓ Photo attached</span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (!checkinText.trim()) {
                                alert('Please enter check-in status text');
                                    return;
                              }
                              addCheckin(c.id, a.id, checkinText.trim(), checkinPhoto || undefined);
                              setCheckinText('');
                              setCheckinPhoto('');
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 rounded text-xs"
                          >
                            Submit Check-in
                          </button>
                        </div>
                      </div>
                    )}
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
