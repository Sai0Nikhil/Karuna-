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