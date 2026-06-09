// =====================================================================
// KARUNA — REMOTE case store (FastAPI + WebSocket).
//
// Same API surface as the local caseStore so existing views call:
//   const { cases, createCase, addDonation, ... } = useCaseStore()
// and never know whether they're hitting localStorage or a backend.
// =====================================================================

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AdoptionApplication, Case, CaseStatus, Donation, STATUS_FLOW,
} from '../types';
import { api } from '../services/api';
import { getRealtime, RealtimeEvent } from '../services/realtime';
import type { NewCaseInput } from './caseStore';

// Re-export the helpers the views import from the local store, so the
// remote provider stays a drop-in replacement.
export const totalDonated = (c: Case) =>
  c.donations.reduce((s, d) => s + d.amountInr, 0);

export const donationProgress = (c: Case) =>
  Math.min(1, c.estimatedCostInr > 0 ? totalDonated(c) / c.estimatedCostInr : 0);

export const isDonatable = (c: Case) =>
  c.status !== 'adopted' && c.status !== 'released' && totalDonated(c) < c.estimatedCostInr;

export const isAdoptable = (c: Case) =>
  c.status === 'discharged' || c.status === 'in_treatment';

export const nextStatus = (s: CaseStatus): CaseStatus | null => {
  const i = STATUS_FLOW.indexOf(s);
  if (i === -1 || i === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1];
};

interface CaseStoreApi {
  cases: Case[];
  getCase: (id: string) => Case | undefined;
  createCase: (input: NewCaseInput) => Promise<Case> | Case;
  assignCase: (id: string, responder: string, ngo?: string) => void;
  advanceStatus: (id: string, to: CaseStatus, actor: string, note?: string) => void;
  addNote: (id: string, actor: string, note: string) => void;
  addDonation: (id: string, donation: Omit<Donation, 'id' | 'ts'>) => void;
  applyForAdoption: (id: string, app: Omit<AdoptionApplication, 'id' | 'ts' | 'status'>) => void;
  decideAdoption: (caseId: string, appId: string, status: 'approved' | 'rejected', actor: string) => void;
  addCheckin: (caseId: string, appId: string, text: string, photoUrl?: string) => void;
  resetToSeed: () => void;
  loadDemoData: () => void;
  clearAll: () => void;
}

const RemoteCaseStoreContext = createContext<CaseStoreApi | null>(null);

export const useRemoteCaseStore = (): CaseStoreApi => {
  const v = useContext(RemoteCaseStoreContext);
  if (!v) throw new Error('useRemoteCaseStore outside RemoteCaseStoreProvider');
  return v;
};

const applyEventToList = (list: Case[], ev: RealtimeEvent): Case[] => {
  if (!ev.caseId || !ev.payload) return list;
  const updated = ev.payload as Case;
  const idx = list.findIndex(c => c.id === ev.caseId);
  if (idx === -1) return [updated, ...list];
  const copy = list.slice();
  copy[idx] = updated;
  return copy;
};

export const RemoteCaseStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);

  // Initial load + WebSocket subscription
  useEffect(() => {
    let cancelled = false;
    api.listCases().then(rows => { if (!cancelled) setCases(rows); })
      .catch(err => console.warn('[karuna] listCases failed:', err));

    const rt = getRealtime(api.apiUrl);
    const off = rt.on((ev) => {
      if (!ev || !ev.type) return;
      if (ev.type === 'hello') return;
      setCases(prev => applyEventToList(prev, ev));
    });

    return () => { cancelled = true; off(); };
  }, []);

  const api_: CaseStoreApi = useMemo(() => ({
    cases,
    getCase: (id) => cases.find(c => c.id === id),

    createCase: async (input) => {
      const created = await api.createCase({
        reporterName: input.reporterName,
        reporterContact: input.reporterContact,
        imageDataUrl: input.imageDataUrl,
        location: input.location,
        species: input.species,
        injuryType: input.injuryType,
        severity: input.severity,
        probableCondition: input.probableCondition,
        firstAidSteps: input.firstAidSteps,
        estimatedCostInr: input.estimatedCostInr,
      });
      // The WebSocket event will also append it — but optimistic insert here
      // so the caller sees it immediately.
      setCases(prev => prev.some(c => c.id === created.id) ? prev : [created, ...prev]);
      return created;
    },

    assignCase: (id, responder, ngo) => {
      api.assignCase(id, responder, ngo).catch(err => alert('Assign failed: ' + err.message));
    },

    advanceStatus: (id, to, actor, note) => {
      api.updateStatus(id, to, actor, note).catch(err => alert('Status update failed: ' + err.message));
    },

    addNote: (id, actor, note) => {
      api.addNote(id, actor, note).catch(err => alert('Add note failed: ' + err.message));
    },

     addDonation: (id, donation) => {
      api.addDonation(id, donation.donorName, donation.amountInr, donation.message, donation.paymentMethod, donation.billOffsetDetails)
        .catch(err => alert('Donation failed: ' + err.message));
    },

    applyForAdoption: (id, app) => {
      api.applyForAdoption(id, app.applicantName, app.contact, app.reason, app.adopterIdUrl)
        .catch(err => alert('Adoption apply failed: ' + err.message));
    },

    decideAdoption: (caseId, appId, status, actor) => {
      api.decideAdoption(caseId, appId, status)
        .catch(err => alert('Decide adoption failed: ' + err.message));
    },

    addCheckin: (caseId, appId, text, photoUrl) => {
      api.addCheckin(appId, text, photoUrl)
        .catch(err => alert('Adoption check-in failed: ' + err.message));
    },

    resetToSeed: () => {
      // Remote mode: no seed reset; reload from server
      api.listCases().then(setCases).catch(() => {});
    },

    loadDemoData: () => {
      alert('Demo data load only works in local mode. In remote mode the data lives on the server.');
    },

    clearAll: () => {
      alert('Clearing all cases is disabled in remote mode (would wipe the shared backend).');
    },
  }), [cases]);

  return <RemoteCaseStoreContext.Provider value={api_}>{children}</RemoteCaseStoreContext.Provider>;
};
