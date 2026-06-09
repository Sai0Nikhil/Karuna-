// =====================================================================
// Karuna — shared types
// =====================================================================

export enum Language {
  ENGLISH = 'english',
  TELUGU = 'telugu',
  HINDI = 'hindi',
  TAMIL = 'tamil'
}

export interface Medicine {
  name: string;
  usageInstruction: string;
}

export interface AnalysisResultData {
  animal: string;
  isInjured: boolean;
  injurySeverity: 'low' | 'medium' | 'high' | 'unknown';
  probableCondition: string;
  recommendedMedicines: {
    tablets: Medicine[];
    ointments: Medicine[];
  };
  firstAidSteps: string[];
  nextSteps: string[];
  disclaimer: string;
  localSupport: VeterinaryContact[];
}

export interface VeterinaryContact {
  name: string;
  address: string;
  phone: string;
  mapsLink: string;
}

// =====================================================================
// KARUNA case-management model (used across NGO / donation / adoption views)
// =====================================================================

export type Severity = 'critical' | 'urgent' | 'routine';

export type CaseStatus =
  | 'reported'
  | 'assigned'
  | 'collected'
  | 'at_clinic'
  | 'in_treatment'
  | 'discharged'
  | 'adopted'
  | 'released';

export const STATUS_LABEL: Record<CaseStatus, string> = {
  reported: 'Reported',
  assigned: 'Assigned',
  collected: 'Collected',
  at_clinic: 'At clinic',
  in_treatment: 'In treatment',
  discharged: 'Discharged',
  adopted: 'Adopted',
  released: 'Released',
};

export const STATUS_FLOW: CaseStatus[] = [
  'reported', 'assigned', 'collected', 'at_clinic', 'in_treatment', 'discharged',
];

export interface CaseLocation {
  lat?: number;
  lon?: number;
  label: string;
}

export type CaseEventType =
  | 'created'
  | 'assigned'
  | 'status'
  | 'donation'
  | 'note'
  | 'adoption_application'
  | 'adoption_decision';

export interface CaseEvent {
  ts: string;
  type: CaseEventType;
  actor: string;
  details: string;
}

export interface Donation {
  id: string;
  ts: string;
  donorName: string;
  amountInr: number;
  message?: string;
  paymentMethod?: string;
  billOffsetDetails?: string;
}

export interface AdoptionApplication {
  id: string;
  ts: string;
  applicantName: string;
  contact: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adopterIdUrl?: string;
  checkinsLogs?: string;
}

export interface Case {
  id: string;
  createdAt: string;
  reporterName: string;
  reporterContact?: string;
  imageDataUrl: string;
  location: CaseLocation;
  species: string;
  injuryType: string;
  severity: Severity;
  probableCondition: string;
  firstAidSteps: string[];
  status: CaseStatus;
  assignedResponder?: string;
  ngo?: string;
  estimatedCostInr: number;
  donations: Donation[];
  adoptionApplications: AdoptionApplication[];
  events: CaseEvent[];
  notes: string[];
}

export type Role = 'citizen' | 'ngo' | 'donor' | 'adopter';

export const ROLE_LABEL: Record<Role, string> = {
  citizen: 'Citizen / Reporter',
  ngo: 'NGO / Responder',
  donor: 'Donor',
  adopter: 'Adopter',
};
