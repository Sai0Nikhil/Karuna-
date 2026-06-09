// =====================================================================
// Karuna — central in-memory case store with localStorage persistence
//
// Exposes a React context with all CRUD operations the views need.
// Persisted to localStorage so cases survive a refresh during the demo.
// =====================================================================

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AdoptionApplication,
  Case,
  CaseEvent,
  CaseLocation,
  CaseStatus,
  Donation,
  Severity,
  STATUS_FLOW,
} from '../types';
import { SEED_CASES } from '../data/seedCases';

const STORAGE_KEY = 'karuna.caseStore.v4'; // bumped: zero by default (was v3: auto-loaded 24-case seed)

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const cloneCase = (c: Case): Case => JSON.parse(JSON.stringify(c));

const loadFromStorage = (): Case[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as Case[];
    return null;
  } catch {
    return null;
  }
};

const saveToStorage = (cases: Case[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch (e) {
    // Storage quota: in the demo we just log
    console.warn('localStorage write failed:', e);
  }
};

export const totalDonated = (c: Case) =>
  c.donations.reduce((s, d) => s + d.amountInr, 0);

export const donationProgress = (c: Case) =>
  Math.min(1, c.estimatedCostInr > 0 ? totalDonated(c) / c.estimatedCostInr : 0);

// ───────────────────────────────────────────────────────────────────────
// Context
// ───────────────────────────────────────────────────────────────────────

interface CaseStoreApi {
  cases: Case[];
  getCase: (id: string) => Case | undefined;
  createCase: (input: NewCaseInput) => Case;
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

export interface NewCaseInput {
  reporterName: string;
  reporterContact?: string;
  imageDataUrl: string;
  location: CaseLocation;
  species: string;
  injuryType: string;
  severity: Severity;
  probableCondition: string;
  firstAidSteps: string[];
  estimatedCostInr: number;
}

const CaseStoreContext = createContext<CaseStoreApi | null>(null);

import { useRemoteCaseStore } from './remoteCaseStore';
import { REMOTE_ENABLED } from '../services/api';

export const useCaseStore = (): CaseStoreApi => {
  // In remote mode the RemoteCaseStoreProvider is mounted, not this one.
  if (REMOTE_ENABLED) return useRemoteCaseStore() as CaseStoreApi;
  const v = useContext(CaseStoreContext);
  if (!v) throw new Error('useCaseStore used outside CaseStoreProvider');
  return v;
};

// ───────────────────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────────────────

export const CaseStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>(() => loadFromStorage() ?? []);

  useEffect(() => {
    saveToStorage(cases);
  }, [cases]);

  const api: CaseStoreApi = useMemo(() => ({
    cases,
    getCase: (id) => cases.find((c) => c.id === id),

    createCase: (input) => {
      const id = makeId('case');
      const ev: CaseEvent = {
        ts: nowIso(),
        type: 'created',
        actor: input.reporterName || 'Citizen',
        details: `Case opened (${input.severity})`,
      };
      const newCase: Case = {
        id,
        createdAt: nowIso(),
        reporterName: input.reporterName,
        reporterContact: input.reporterContact,
        imageDataUrl: input.imageDataUrl,
        location: input.location,
        species: input.species,
        injuryType: input.injuryType,
        severity: input.severity,
        probableCondition: input.probableCondition,
        firstAidSteps: input.firstAidSteps,
        status: 'reported',
        estimatedCostInr: input.estimatedCostInr,
        donations: [],
        adoptionApplications: [],
        events: [ev],
        notes: [],
      };
      setCases((prev) => [newCase, ...prev]);
      return newCase;
    },

    assignCase: (id, responder, ngo) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = cloneCase(c);
          next.status = 'assigned';
          next.assignedResponder = responder;
          next.ngo = ngo || next.ngo || 'Karuna Volunteers';
          next.events.push({
            ts: nowIso(),
            type: 'assigned',
            actor: ngo || 'NGO',
            details: `Dispatched to ${responder}`,
          });
          return next;
        }),
      );
    },

    advanceStatus: (id, to, actor, note) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = cloneCase(c);
          next.status = to;
          next.events.push({
            ts: nowIso(),
            type: 'status',
            actor,
            details: note ? `→ ${to} (${note})` : `→ ${to}`,
          });
          if (note) next.notes.push(note);
          return next;
        }),
      );
    },

    addNote: (id, actor, note) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = cloneCase(c);
          next.notes.push(note);
          next.events.push({
            ts: nowIso(),
            type: 'note',
            actor,
            details: note,
          });
          return next;
        }),
      );
    },

    addDonation: (id, donation) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = cloneCase(c);
          const d: Donation = {
            id: makeId('don'),
            ts: nowIso(),
            ...donation,
          };
          next.donations.push(d);
          next.events.push({
            ts: nowIso(),
            type: 'donation',
            actor: d.donorName,
            details: `₹${d.amountInr.toLocaleString('en-IN')} donated`,
          });
          return next;
        }),
      );
    },

    applyForAdoption: (id, app) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = cloneCase(c);
          const application: AdoptionApplication = {
            id: makeId('app'),
            ts: nowIso(),
            status: 'pending',
            ...app,
          };
          next.adoptionApplications.push(application);
          next.events.push({
            ts: nowIso(),
            type: 'adoption_application',
            actor: app.applicantName,
            details: `Applied to adopt`,
          });
          return next;
        }),
      );
    },

    decideAdoption: (caseId, appId, status, actor) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          const next = cloneCase(c);
          const app = next.adoptionApplications.find((a) => a.id === appId);
          if (!app) return c;
          app.status = status;
          if (status === 'approved') {
            next.status = 'adopted';
          }
          next.events.push({
            ts: nowIso(),
            type: 'adoption_decision',
            actor,
            details: `Adoption application ${status} (${app.applicantName})`,
          });
          return next;
        }),
      );
    },

    addCheckin: (caseId, appId, text, photoUrl) => {
      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          const next = cloneCase(c);
          const app = next.adoptionApplications.find((a) => a.id === appId);
          if (!app) return c;
          const logEntry = {
            date: nowIso(),
            text: text || '',
            photoUrl: photoUrl || '',
          };
          let currentLogs = [];
          try {
            if (app.checkinsLogs && app.checkinsLogs !== '[]') {
              currentLogs = JSON.parse(app.checkinsLogs);
            }
          } catch (e) {
            console.warn('Failed to parse checkinsLogs', e);
          }
          currentLogs.push(logEntry);
          app.checkinsLogs = JSON.stringify(currentLogs);
          next.events.push({
            ts: nowIso(),
            type: 'note',
            actor: 'Adopter',
            details: `Submitted post-placement check-in: ${text}`,
          });
          return next;
        }),
      );
    },

    resetToSeed: () => {
      localStorage.removeItem(STORAGE_KEY);
      setCases([]);
    },

    loadDemoData: () => {
      setCases(SEED_CASES);
    },

    clearAll: () => {
      localStorage.removeItem(STORAGE_KEY);
      setCases([]);
    },
  }), [cases]);

  return <CaseStoreContext.Provider value={api}>{children}</CaseStoreContext.Provider>;
};

// ───────────────────────────────────────────────────────────────────────
// Derived helpers
// ───────────────────────────────────────────────────────────────────────

export const isDonatable = (c: Case) =>
  c.status !== 'adopted' && c.status !== 'released' && totalDonated(c) < c.estimatedCostInr;

export const isAdoptable = (c: Case) =>
  c.status === 'discharged' || c.status === 'in_treatment';

export const nextStatus = (s: CaseStatus): CaseStatus | null => {
  const i = STATUS_FLOW.indexOf(s);
  if (i === -1 || i === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1];
};
