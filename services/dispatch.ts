// =====================================================================
// AUTOMATED SEVERITY-DRIVEN DISPATCH
//
// The headline novelty of the KARUNA copyright doc — the severity score
// from the AI triage feeds DIRECTLY into a matching algorithm that
// auto-picks the best responder. No human dispatcher in the loop.
//
// Every score is broken down so the NGO admin can see *why* a specific
// responder was picked. That transparency is what makes this an
// actually-deployable matching algorithm rather than a black box.
// =====================================================================

import { Case, Severity } from '../types';

export interface Responder {
  id: string;
  name: string;
  ngo: string;
  // Approximate base location (so we can compute distance to the case)
  lat: number;
  lon: number;
  // Skills the responder is trained on
  skills: Array<'wound' | 'fracture' | 'mange' | 'bleeding' | 'eye' | 'general'>;
  // How many open cases are already assigned to this responder
  openLoad: number;
  // Active in last 24h?
  available: boolean;
}

// Demo roster — anchored around Vijayawada like the pilot cities in the paper.
export const RESPONDER_ROSTER: Responder[] = [
  { id: 'r_001', name: 'R. Rao',     ngo: 'Vijayawada Animal Care',   lat: 16.5062, lon: 80.6480, skills: ['fracture', 'bleeding', 'general'],   openLoad: 1, available: true  },
  { id: 'r_002', name: 'N. Lakshmi', ngo: 'Vijayawada Animal Care',   lat: 16.5040, lon: 80.6571, skills: ['eye', 'wound', 'general'],          openLoad: 0, available: true  },
  { id: 'r_003', name: 'K. Suri',    ngo: 'Karuna Volunteers',        lat: 16.5260, lon: 80.6608, skills: ['mange', 'general'],                 openLoad: 2, available: true  },
  { id: 'r_004', name: 'M. Reddy',   ngo: 'Karuna Volunteers',        lat: 16.7531, lon: 81.6818, skills: ['general', 'wound'],                 openLoad: 1, available: true  },
  { id: 'r_005', name: 'A. Krishna', ngo: 'Vijayawada Animal Care',   lat: 16.5152, lon: 80.6321, skills: ['bleeding', 'fracture', 'general'], openLoad: 0, available: true  },
  { id: 'r_006', name: 'P. Devi',    ngo: 'Hyderabad Animal Warriors',lat: 17.3850, lon: 78.4867, skills: ['general'],                          openLoad: 3, available: false },
];

// Haversine distance in km
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Map a free-text injury / condition string to a skill tag for matching.
const conditionToSkill = (c: Case): Responder['skills'][number] => {
  const blob = (c.injuryType + ' ' + c.probableCondition).toLowerCase();
  if (blob.includes('fracture') || blob.includes('limb') || blob.includes('rta')) return 'fracture';
  if (blob.includes('bleed'))                                                     return 'bleeding';
  if (blob.includes('mange') || blob.includes('skin'))                            return 'mange';
  if (blob.includes('eye'))                                                       return 'eye';
  if (blob.includes('wound') || blob.includes('laceration'))                      return 'wound';
  return 'general';
};

const severityWeight: Record<Severity, number> = {
  critical: 1.0,   // distance penalty matters most when seconds count
  urgent:   0.7,
  routine:  0.4,
};

export interface ScoreLine {
  label: string;
  contribution: number;  // -1..+1 — visible to the NGO admin
  detail: string;
}

export interface MatchResult {
  responder: Responder;
  totalScore: number;          // 0..1, higher = better match
  distanceKm: number;
  matchedSkill: Responder['skills'][number];
  breakdown: ScoreLine[];
}

export const scoreResponder = (c: Case, r: Responder): MatchResult => {
  const sev = c.severity;
  const requiredSkill = conditionToSkill(c);

  const caseLat = c.location.lat ?? RESPONDER_ROSTER[0].lat;
  const caseLon = c.location.lon ?? RESPONDER_ROSTER[0].lon;
  const distanceKm = haversineKm(caseLat, caseLon, r.lat, r.lon);

  const lines: ScoreLine[] = [];

  // 1. Distance — closer is better. Critical cases penalise distance most.
  const distScore = Math.max(0, 1 - Math.min(distanceKm, 80) / 80);
  const distContribution = distScore * 0.45 * severityWeight[sev];
  lines.push({
    label: 'Proximity',
    contribution: distContribution,
    detail: `${distanceKm.toFixed(1)} km from case — closer is better (weighted up for ${sev}).`,
  });

  // 2. Skill match
  const hasExactSkill = r.skills.includes(requiredSkill);
  const hasGeneral = r.skills.includes('general');
  const skillScore = hasExactSkill ? 1 : hasGeneral ? 0.45 : 0.15;
  const skillContribution = skillScore * 0.30;
  lines.push({
    label: 'Skill match',
    contribution: skillContribution,
    detail: hasExactSkill
      ? `Trained in ${requiredSkill} — exact match.`
      : hasGeneral ? `General responder — partial match for ${requiredSkill}.`
      : `Not trained in ${requiredSkill}.`,
  });

  // 3. Caseload — fewer open cases is better
  const loadScore = Math.max(0, 1 - Math.min(r.openLoad, 5) / 5);
  const loadContribution = loadScore * 0.15;
  lines.push({
    label: 'Current load',
    contribution: loadContribution,
    detail: `${r.openLoad} open case${r.openLoad === 1 ? '' : 's'} already assigned.`,
  });

  // 4. Availability gate
  const availContribution = r.available ? 0.10 : -0.50;
  lines.push({
    label: 'Availability',
    contribution: availContribution,
    detail: r.available ? 'Active in last 24h.' : 'Inactive — heavy penalty.',
  });

  const totalScore = Math.max(0, Math.min(1,
    distContribution + skillContribution + loadContribution + availContribution,
  ));

  return { responder: r, totalScore, distanceKm, matchedSkill: requiredSkill, breakdown: lines };
};

export const rankResponders = (c: Case, roster: Responder[] = RESPONDER_ROSTER): MatchResult[] =>
  roster.map((r) => scoreResponder(c, r)).sort((a, b) => b.totalScore - a.totalScore);

export const bestMatch = (c: Case, roster: Responder[] = RESPONDER_ROSTER): MatchResult | null => {
  const ranked = rankResponders(c, roster);
  return ranked.length ? ranked[0] : null;
};

// Human-readable summary the NGO admin / reporter can see at a glance.
export const matchSummary = (m: MatchResult): string =>
  `${m.responder.name} (${m.responder.ngo}) — ${(m.totalScore * 100).toFixed(0)}% match, ` +
  `${m.distanceKm.toFixed(1)} km away, ` +
  `${m.responder.skills.includes(m.matchedSkill) ? 'trained in ' + m.matchedSkill : 'general responder'}.`;
