// =====================================================================
// HYBRID TRIAGE SERVICE
//
// • Real Anthropic / Claude calls when ANTHROPIC_API_KEY (mapped to
//   process.env.API_KEY by vite.config.ts) is present in the .env file.
// • Local mock fallback when the key is missing OR when the call fails
//   (rate-limit, network, parse error, etc.) — so the demo never breaks.
//
// Exports: analyzeImage, chatWithSita, generateFirstAidVisual.
// All three share the same signature as the original Claude-only version
// so callers do not need to change.
// =====================================================================

import Anthropic from '@anthropic-ai/sdk';
import { AnalysisResultData, Language, VeterinaryContact } from '../types';
import { LANGUAGES, MODEL_NAME, CHAT_MODEL_NAME } from '../constants';
import { ALL_VETERINARY_CONTACTS } from '../data/veterinaryData';

// ───────────────────────────────────────────────────────────────────────
// Client / mode detection
// ───────────────────────────────────────────────────────────────────────

const API_KEY: string | undefined =
  (typeof process !== 'undefined' && (process as any).env && (process as any).env.API_KEY) || undefined;

const HAS_KEY = !!(API_KEY && API_KEY.length > 10);

let anthropic: Anthropic | null = null;
if (HAS_KEY) {
  try {
    anthropic = new Anthropic({ apiKey: API_KEY!, dangerouslyAllowBrowser: true });
    // eslint-disable-next-line no-console
    console.info('[KARUNA] Anthropic key detected — live Claude triage enabled.');
  } catch (e) {
    console.warn('[KARUNA] Anthropic client init failed, falling back to mock.', e);
    anthropic = null;
  }
} else {
  console.info('[KARUNA] No ANTHROPIC_API_KEY found — running offline with mock triage.');
}

export const isLiveClaude = (): boolean => !!anthropic;

// ───────────────────────────────────────────────────────────────────────
// Translation tables for the mock fallback
// ───────────────────────────────────────────────────────────────────────

const T = {
  english: {
    dogFound: 'Indian Pariah Dog (street dog)',
    catFound: 'Domestic Short-Hair Cat (street cat)',
    cowFound: 'Indian Cow (street / community)',
    healthy: 'Animal appears alert and uninjured. Continue to monitor.',
    disclaimer:
      'This is an AI-generated triage suggestion, not a veterinary diagnosis. ' +
      'Always consult a qualified veterinarian for treatment decisions.',
    aidSteps: {
      wound: [
        'Approach slowly and from the side; speak in a soft voice.',
        'If the animal allows, gently restrain with a clean cloth.',
        'Pour clean drinking water or saline over the wound for 30 seconds.',
        'Do NOT apply human ointments. Wait for the responder.',
        'Keep the animal calm and in shade until help arrives.',
      ],
      fracture: [
        'Do NOT try to set the limb — it can cause more damage.',
        'Slide a flat board / piece of cardboard under the animal as a stretcher.',
        'Cover the body with a light cloth to reduce shock.',
        'Keep movement to an absolute minimum.',
        'Stay with the animal until the responder arrives.',
      ],
      mange: [
        'Do NOT touch with bare hands — wear gloves or use a cloth.',
        'Offer clean water and a small portion of soft food.',
        'Note the location and report — mange is treatable but slow.',
        'Avoid bringing the animal into contact with pet animals.',
      ],
      bleeding: [
        'Apply firm pressure with a clean cloth for 3 minutes.',
        'Do NOT remove the cloth even if it soaks through — add another layer.',
        'Keep the animal lying down and still.',
        'CALL the nearest responder immediately — this is critical.',
      ],
      generic: [
        'Keep the animal calm and in shade.',
        'Offer clean drinking water in a shallow bowl.',
        'Do not feed unfamiliar food.',
        'Stay nearby until the responder arrives.',
      ],
    },
    nextSteps: [
      'A KARUNA responder has been notified and will reach you shortly.',
      'You will receive live status updates as the case progresses.',
      'You can track every step on the case page.',
    ],
  },
  hindi: {
    dogFound: 'भारतीय गली का कुत्ता',
    catFound: 'गली की बिल्ली',
    cowFound: 'गली / मोहल्ले की गाय',
    healthy: 'जानवर सतर्क और स्वस्थ दिख रहा है। निगरानी जारी रखें।',
    disclaimer:
      'यह AI द्वारा सुझाया गया प्राथमिक मूल्यांकन है, पशु-चिकित्सकीय निदान नहीं। ' +
      'उपचार से पहले प्रशिक्षित पशु चिकित्सक से सलाह लें।',
    aidSteps: {
      wound: [
        'धीरे-धीरे, बगल से जाएँ; धीमी आवाज़ में बात करें।',
        'अगर जानवर मानता है तो साफ कपड़े से धीरे से पकड़ें।',
        '30 सेकंड तक घाव पर साफ पानी या सलाइन डालें।',
        'मानवों की दवा/मलहम न लगाएँ। बचावकर्ता का इंतज़ार करें।',
        'मदद आने तक जानवर को छाँव में शांत रखें।',
      ],
      fracture: [
        'पैर/हड्डी को सेट करने की कोशिश न करें।',
        'कार्डबोर्ड / सख्त बोर्ड को स्ट्रेचर की तरह नीचे खिसकाएँ।',
        'सदमे से बचाने के लिए हल्के कपड़े से ढकें।',
        'हिलने-डुलने को कम से कम रखें।',
        'बचावकर्ता के पहुँचने तक साथ रहें।',
      ],
      mange: [
        'नंगे हाथों से न छुएँ — दस्ताने/कपड़ा उपयोग करें।',
        'साफ पानी और थोड़ा नरम भोजन दें।',
        'स्थान नोट करें और रिपोर्ट करें — मांज ठीक हो सकती है।',
        'पालतू जानवरों से दूर रखें।',
      ],
      bleeding: [
        'साफ कपड़े से 3 मिनट तक तेज़ दबाव डालें।',
        'कपड़ा हटाएँ नहीं — ऊपर और परत लगाएँ।',
        'जानवर को लिटाकर शांत रखें।',
        'तुरंत निकटतम बचावकर्ता को कॉल करें — यह गंभीर है।',
      ],
      generic: [
        'जानवर को छाँव में शांत रखें।',
        'उथले बर्तन में साफ पानी दें।',
        'अनजान खाना न दें।',
        'बचावकर्ता के पहुँचने तक पास रहें।',
      ],
    },
    nextSteps: [
      'KARUNA बचावकर्ता को सूचना भेज दी गई है — वे जल्द पहुँचेंगे।',
      'केस के बढ़ने पर आपको लाइव अपडेट मिलेंगे।',
      'पूरी प्रक्रिया केस पेज पर देखी जा सकती है।',
    ],
  },
  telugu: {
    dogFound: 'భారతీయ వీధి కుక్క',
    catFound: 'వీధి పిల్లి',
    cowFound: 'వీధి / కమ్యూనిటీ ఆవు',
    healthy: 'జంతువు ఆరోగ్యంగా, చురుకుగా ఉంది. గమనిస్తూ ఉండండి.',
    disclaimer:
      'ఇది AI సూచించిన ప్రాథమిక సలహా; పశువైద్య నిర్ధారణ కాదు. ' +
      'చికిత్సకు ముందు అర్హత గల పశువైద్యుని సంప్రదించండి.',
    aidSteps: {
      wound: [
        'నెమ్మదిగా, పక్క నుండి దగ్గరికి వెళ్ళండి; మెల్లగా మాట్లాడండి.',
        'జంతువు అంగీకరిస్తే శుభ్రమైన గుడ్డతో మెల్లగా పట్టుకోండి.',
        'గాయం పై 30 సెకన్లపాటు శుభ్రమైన నీరు లేదా సెలైన్ పోయండి.',
        'మానవులకు వాడే మందులు పూయవద్దు. రెస్క్యూ వ్యక్తి కోసం వేచి ఉండండి.',
        'సహాయం వచ్చేవరకు జంతువును నీడలో ప్రశాంతంగా ఉంచండి.',
      ],
      fracture: [
        'కాలును మీరే సరిచేయడానికి ప్రయత్నించవద్దు.',
        'శరీరం కింద ఒక గట్టి బోర్డు/కార్డ్‌బోర్డ్ ఉంచండి (స్ట్రెచర్‌గా).',
        'షాక్ తగ్గించడానికి తేలికపాటి గుడ్డతో కప్పండి.',
        'కదలికను చాలా తక్కువగా ఉంచండి.',
        'రెస్క్యూ వచ్చేంత వరకు పక్కనే ఉండండి.',
      ],
      mange: [
        'చేతులతో ముట్టుకోవద్దు — గ్లోవ్స్ లేదా గుడ్డ ఉపయోగించండి.',
        'శుభ్రమైన నీరు మరియు కొద్దిగా మృదువైన ఆహారం ఇవ్వండి.',
        'ప్రదేశం గుర్తుపెట్టి రిపోర్ట్ చేయండి — చికిత్సతో నయమవుతుంది.',
        'పెంపుడు జంతువులకు దూరంగా ఉంచండి.',
      ],
      bleeding: [
        'శుభ్రమైన గుడ్డతో 3 నిమిషాలు గట్టిగా ఒత్తండి.',
        'రక్తం పీల్చినా గుడ్డ తీయవద్దు — పైన మరో పొర వేయండి.',
        'జంతువును పడుకోబెట్టి ప్రశాంతంగా ఉంచండి.',
        'తక్షణం దగ్గరి రెస్క్యూకు కాల్ చేయండి — ఇది అత్యవసరం.',
      ],
      generic: [
        'జంతువును నీడలో ప్రశాంతంగా ఉంచండి.',
        'తక్కువ లోతుగల పాత్రలో శుభ్రమైన నీరు ఇవ్వండి.',
        'తెలియని ఆహారం ఇవ్వకండి.',
        'రెస్క్యూ వచ్చేవరకు పక్కనే ఉండండి.',
      ],
    },
    nextSteps: [
      'KARUNA రెస్క్యూ టీమ్‌కి సమాచారం పంపబడింది; త్వరలో చేరుకుంటారు.',
      'కేసు పురోగతిని మీకు లైవ్ నవీకరణలుగా పంపుతాము.',
      'ప్రతి దశను కేస్ పేజీలో ట్రాక్ చేయవచ్చు.',
    ],
  },
};
(T as any).tamil = T.english; // Tamil falls back to English copy for the demo.

// ───────────────────────────────────────────────────────────────────────
// Mock detection (used when Claude is unavailable)
// ───────────────────────────────────────────────────────────────────────

type ConditionKey = 'wound' | 'fracture' | 'mange' | 'bleeding' | 'generic';

interface DetectedCondition {
  species: string;
  injuryType: string;
  severity: 'low' | 'medium' | 'high';
  conditionKey: ConditionKey;
  probableCondition: string;
}

const SAMPLE_CONDITIONS: DetectedCondition[] = [
  { species: 'dog', injuryType: 'open_wound', severity: 'high',   conditionKey: 'wound',    probableCondition: 'Deep laceration on hind leg with early signs of infection' },
  { species: 'dog', injuryType: 'fracture',   severity: 'high',   conditionKey: 'fracture', probableCondition: 'Suspected fracture of the right hind limb (possible RTA)' },
  { species: 'dog', injuryType: 'mange',      severity: 'medium', conditionKey: 'mange',    probableCondition: 'Sarcoptic mange covering ~30% of body — treatable' },
  { species: 'cat', injuryType: 'bleeding',   severity: 'high',   conditionKey: 'bleeding', probableCondition: 'Active bleeding from head wound — likely from a fall' },
  { species: 'cow', injuryType: 'open_wound', severity: 'medium', conditionKey: 'wound',    probableCondition: 'Surface wound on the flank, possibly from a nail/wire' },
  { species: 'dog', injuryType: 'emaciation', severity: 'low',    conditionKey: 'generic',  probableCondition: 'Mild emaciation, needs feeding support and a deworm cycle' },
];

const hashHex = (s: string): number => {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 4096); i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const pickCondition = (imageDataUrl: string): DetectedCondition => {
  const idx = imageDataUrl && imageDataUrl.length > 100
    ? hashHex(imageDataUrl) % SAMPLE_CONDITIONS.length
    : Math.floor(Math.random() * SAMPLE_CONDITIONS.length);
  return SAMPLE_CONDITIONS[idx];
};

const pickLocalSupport = (
  location: { lat: number; lon: number } | string | null,
): VeterinaryContact[] => {
  const all = ALL_VETERINARY_CONTACTS;
  let chosen = all.slice(0, 3);
  let searchLocation = location;

  if (location && typeof location === 'object' && 'lat' in location && 'lon' in location) {
    const lat = location.lat;
    const lon = location.lon;
    if (lat >= 12.5 && lat <= 13.5 && lon >= 79.5 && lon <= 80.8) {
      searchLocation = 'chennai';
    } else if (lat >= 17.0 && lat <= 18.0 && lon >= 78.0 && lon <= 79.0) {
      searchLocation = 'hyderabad';
    } else if (lat >= 28.0 && lat <= 29.0 && lon >= 76.8 && lon <= 77.8) {
      searchLocation = 'delhi';
    } else if (lat >= 16.0 && lat <= 17.0 && lon >= 80.0 && lon <= 81.0) {
      searchLocation = 'vijayawada';
    }
  }

  if (typeof searchLocation === 'string') {
    const q = searchLocation.toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);
    const matches = all.filter((c) => {
      const addr = c.address.toLowerCase();
      const nm = c.name.toLowerCase();
      if (addr.includes(q) || nm.includes(q)) return true;
      return tokens.some((t) => addr.includes(t) || nm.includes(t));
    });
    if (matches.length) chosen = matches.slice(0, 3);
  }
  return chosen.map((c) => ({
    ...c,
    mapsLink:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(c.name + ' ' + c.address),
  }));
};

const mockAnalyse = async (
  imageDataUrl: string,
  description: string,
  language: Language,
  location: { lat: number; lon: number } | string | null,
): Promise<AnalysisResultData> => {
  await new Promise((r) => setTimeout(r, 900));
  const langKey = (T as any)[language] ? language : Language.ENGLISH;
  const t = (T as any)[langKey] as typeof T.english;
  const c = pickCondition(imageDataUrl);

  let speciesLabel = c.species === 'dog' ? t.dogFound : c.species === 'cat' ? t.catFound : t.cowFound;
  let severity = c.severity;
  let conditionKey = c.conditionKey;
  let probableCondition = c.probableCondition;

  const descLower = description.toLowerCase();

  // Keyword override for species
  if (descLower.includes('cow') || descLower.includes('cattle') || descLower.includes('calf') || descLower.includes('bull') || descLower.includes('bovine')) {
    speciesLabel = t.cowFound;
    probableCondition = 'Bovine health issue';
    conditionKey = 'wound';
    severity = 'medium';
  } else if (descLower.includes('cat') || descLower.includes('kitten')) {
    speciesLabel = t.catFound;
    probableCondition = 'Feline health issue';
    conditionKey = 'wound';
    severity = 'medium';
  } else if (descLower.includes('dog') || descLower.includes('puppy') || descLower.includes('pariah')) {
    speciesLabel = t.dogFound;
    probableCondition = 'Canine health issue';
    conditionKey = 'wound';
    severity = 'medium';
  }

  // Keyword override for condition type
  if (descLower.includes('bleeding') || descLower.includes('blood') || descLower.includes('intestine')) {
    conditionKey = 'bleeding';
    severity = 'high';
    probableCondition = speciesLabel.includes('cow') || speciesLabel.includes('Cow') || speciesLabel.includes('Cattle') || speciesLabel.includes('ఆవు') || speciesLabel.includes('गाय')
      ? 'Severe internal bleeding / gastrointestinal distress in street cattle'
      : speciesLabel.includes('cat') || speciesLabel.includes('Cat') || speciesLabel.includes('పిల్లి') || speciesLabel.includes('बिल्ली')
      ? 'Active bleeding from open wound'
      : 'Severe deep tissue wound with active bleeding';
  } else if (descLower.includes('broken') || descLower.includes('fracture') || descLower.includes('limp') || descLower.includes('leg')) {
    conditionKey = 'fracture';
    severity = 'high';
    probableCondition = 'Suspected bone fracture or joint dislocation';
  } else if (descLower.includes('mange') || descLower.includes('skin') || descLower.includes('itch')) {
    conditionKey = 'mange';
    severity = 'medium';
    probableCondition = 'Severe skin infestation, likely sarcoptic mange';
  } else if (descLower.includes('starv') || descLower.includes('thin') || descLower.includes('weak') || descLower.includes('emaciat')) {
    conditionKey = 'generic';
    severity = 'low';
    probableCondition = 'Mild emaciation and dehydration, needs feeding support';
  }

  probableCondition = description ? `${probableCondition}. Reporter note: "${description}".` : probableCondition;
  const firstAidSteps = t.aidSteps[conditionKey] || t.aidSteps.generic;

  return {
    animal: speciesLabel,
    isInjured: true,
    injurySeverity: severity as any,
    probableCondition,
    recommendedMedicines: {
      tablets: [
        { name: 'Meloxicam (Melonex 1.5 mg)', usageInstruction: 'Hide in a piece of bread / curd-rice for pain relief.' },
        { name: 'Cephalexin 250 mg', usageInstruction: 'Antibiotic. Crush and mix with wet chicken / soft food.' },
      ],
      ointments: [
        { name: 'Betadine 5% solution', usageInstruction: 'Dab on wound edges with cotton on a stick. Do not pour into deep wounds.' },
        { name: 'Topicure spray', usageInstruction: 'Spray from 6–8 inches to keep flies / maggots off.' },
      ],
    },
    firstAidSteps,
    nextSteps: t.nextSteps,
    disclaimer: t.disclaimer,
    localSupport: pickLocalSupport(location),
  };
};

// ───────────────────────────────────────────────────────────────────────
// Real Claude call (only when anthropic client exists)
// ───────────────────────────────────────────────────────────────────────

const buildSystemPrompt = (
  language: Language,
  description: string,
  location: { lat: number; lon: number } | string | null,
): string => {
  const langLabel = LANGUAGES.find((l) => l.value === language)?.label || 'English';
  let locationInfo = 'User location is not available.';
  if (location) {
    if (typeof location === 'string') locationInfo = `The user's manually entered location is "${location}".`;
    else if (location.lat && location.lon) locationInfo = `The user is at approximately latitude ${location.lat} and longitude ${location.lon}.`;
  }
  const userDescription = description ? `User adds this context: "${description}"` : '';

  return `You are Karuṇā, a compassionate AI veterinary assistant. Your goal is to identify the most probable condition and provide simple first-aid.

Analyse the image for common signs of distress (wounds with possible infection, broken limbs, skin issues like mange, malnutrition, eye injuries).

Populate 'probableCondition' with your most specific finding.

CRITICAL — MEDICAL PRESCRIPTIONS (India specific):
Populate 'recommendedMedicines' with standard veterinary treatments easily available in India.
- Tablets: Meloxicam (Melonex), Cephalexin/Amoxycillin, Ivermectin (Neomec) as appropriate.
- Ointments/Sprays: Himax, Topicure, D-Mag, Lorexane, Betadine.
For each medicine, 'usageInstruction' MUST be practical for a street situation
(hide in bun/curd-rice, grind for aggressive animals, apply on a stick, etc.).

Your response must be in ${langLabel}.
${userDescription}
${locationInfo}

From the knowledge base below, pick the 2–3 nearest / most relevant support centres for 'localSupport'.
KNOWLEDGE BASE:
${JSON.stringify(ALL_VETERINARY_CONTACTS).slice(0, 6000)}

Return ONLY a JSON object matching this TypeScript type — no prose:
{
  "animal": string,
  "isInjured": boolean,
  "injurySeverity": "low" | "medium" | "high" | "unknown",
  "probableCondition": string,
  "recommendedMedicines": {
    "tablets": [{"name": string, "usageInstruction": string}],
    "ointments": [{"name": string, "usageInstruction": string}]
  },
  "firstAidSteps": string[],
  "nextSteps": string[],
  "disclaimer": string,
  "localSupport": [{"name": string, "address": string, "phone": string}]
}`;
};

const parseDataUrl = (dataUrl: string): { mediaType: string; data: string } | null => {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
};

const claudeAnalyse = async (
  imageDataUrl: string,
  description: string,
  language: Language,
  location: { lat: number; lon: number } | string | null,
): Promise<AnalysisResultData> => {
  if (!anthropic) throw new Error('Anthropic client not initialised');
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) throw new Error('Image is not a base64 data URL');

  const system = buildSystemPrompt(language, description, location);
  const res = await anthropic.messages.create({
    model: MODEL_NAME,
    max_tokens: 1500,
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: parsed.mediaType as any, data: parsed.data } },
        { type: 'text', text: 'Analyse this animal and return ONLY the JSON object specified in the system prompt.' },
      ],
    }],
  });

  // Pull the first text block out of the response
  const textBlock = res.content.find((c: any) => c.type === 'text') as any;
  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude returned no text content');
  }

  // Extract the first {...} JSON object from the reply (in case of stray prose)
  const match = textBlock.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in Claude response');

  const data = JSON.parse(match[0]) as AnalysisResultData;

  // Attach Google Maps links to localSupport so the UI can deep-link
  const support = (data.localSupport || []).map((c) => ({
    ...c,
    mapsLink:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent((c.name || '') + ' ' + (c.address || '')),
  }));

  return { ...data, localSupport: support };
};

// ───────────────────────────────────────────────────────────────────────
// Public API — tries Claude first, falls back to mock on any error.
// ───────────────────────────────────────────────────────────────────────

export const analyzeImage = async (
  imageDataUrl: string,
  description: string,
  language: Language,
  location: { lat: number; lon: number } | string | null,
): Promise<AnalysisResultData> => {
  if (anthropic) {
    try {
      return await claudeAnalyse(imageDataUrl, description, language, location);
    } catch (e) {
      console.warn('[KARUNA] Claude call failed, falling back to mock triage:', e);
    }
  }
  return mockAnalyse(imageDataUrl, description, language, location);
};

// ───────────────────────────────────────────────────────────────────────
// SitaLive chat — light wrapper around Claude messages, mock fallback.
// ───────────────────────────────────────────────────────────────────────

export interface SitaChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const mockSitaReply = (history: SitaChatTurn[], analysisContext: AnalysisResultData | null): string => {
  const lastUser = [...history].reverse().find((t) => t.role === 'user')?.content || '';
  const q = lastUser.toLowerCase();
  if (!analysisContext) return "I haven't received any case details yet. Please submit a photo first.";
  if (q.includes('vet') || q.includes('clinic')) {
    const vet = analysisContext.localSupport[0];
    return vet
      ? `The nearest support I can see is ${vet.name} at ${vet.address}. You can open it on Google Maps from the case page.`
      : "I don't have a vet contact in this area right now — please reach the city helpline.";
  }
  if (q.includes('food') || q.includes('feed')) {
    return 'Offer a small amount of soft food — boiled rice, curd, or biscuits soaked in milk. Avoid spicy or oily food.';
  }
  if (q.includes('medicine') || q.includes('tablet')) {
    const t = analysisContext.recommendedMedicines.tablets[0];
    return t
      ? `For pain relief I would normally suggest ${t.name}. ${t.usageInstruction} But please wait for the responder if you can.`
      : 'Please wait for the responder before giving any medication.';
  }
  if (q.includes('rescue') || q.includes('responder') || q.includes('how long')) {
    return 'A responder has been notified through KARUNA. You will see live status updates on the case page — typical response time in the pilot is under 2 hours.';
  }
  return `Based on the triage (${analysisContext.probableCondition}), keep the animal calm and in shade and follow the first-aid steps on the screen. I am here if you have a specific question.`;
};

export const chatWithSita = async (
  history: SitaChatTurn[],
  analysisContext: AnalysisResultData | null,
): Promise<string> => {
  if (anthropic) {
    try {
      const system = `You are Sita, the KARUNA voice assistant. Be calm, brief, and practical. \
Current case context: ${analysisContext ? JSON.stringify({
        animal: analysisContext.animal,
        condition: analysisContext.probableCondition,
        severity: analysisContext.injurySeverity,
      }) : 'no case'}.`;
      const res = await anthropic.messages.create({
        model: CHAT_MODEL_NAME,
        max_tokens: 400,
        system,
        messages: history.map((t) => ({ role: t.role, content: t.content })),
      });
      const block = res.content.find((c: any) => c.type === 'text') as any;
      if (block && typeof block.text === 'string') return block.text.trim();
    } catch (e) {
      console.warn('[KARUNA] Sita Claude chat failed, falling back to mock:', e);
    }
  }
  await new Promise((r) => setTimeout(r, 300));
  return mockSitaReply(history, analysisContext);
};

// ───────────────────────────────────────────────────────────────────────
// Visual first-aid tip generator (used by AnalysisResult).
// ───────────────────────────────────────────────────────────────────────

const mockVisualTip = (step: string, animal: string): string => {
  const s = step.toLowerCase();
  if (s.includes('water') || s.includes('saline'))
    return 'Use a soft-stream bottle held a few inches above the wound — do not scrub.';
  if (s.includes('cloth') || s.includes('pressure'))
    return 'Fold a clean cloth into a small pad; press firmly for 3 full minutes without lifting.';
  if (s.includes('food') || s.includes('feed'))
    return "Offer a small handful of curd-rice or soaked biscuits at arm's length — never force-feed.";
  if (s.includes('move') || s.includes('stretcher') || s.includes('board'))
    return `Slide a flat board (cardboard works) under the ${animal} from the side; lift evenly with two people.`;
  return `Stay calm and keep the ${animal} in shade. A responder will arrive shortly.`;
};

export const generateFirstAidVisual = async (step: string, animal: string): Promise<string> => {
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({
        model: CHAT_MODEL_NAME,
        max_tokens: 150,
        system:
          'You are Karuṇā. Given a first-aid step and an animal, return ONE short practical instruction (one sentence) for a citizen with no medical training. No preamble.',
        messages: [{ role: 'user', content: `Step: "${step}" — Animal: ${animal}` }],
      });
      const block = res.content.find((c: any) => c.type === 'text') as any;
      if (block && typeof block.text === 'string') return block.text.trim();
    } catch (e) {
      console.warn('[KARUNA] generateFirstAidVisual Claude call failed, using mock:', e);
    }
  }
  await new Promise((r) => setTimeout(r, 200));
  return mockVisualTip(step, animal);
};
