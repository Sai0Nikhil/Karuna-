import { Language } from './types';

export const LANGUAGES = [
  { value: Language.ENGLISH, label: 'English', code: 'en-US' },
  { value: Language.TELUGU, label: 'తెలుగు (Telugu)', code: 'te-IN' },
  { value: Language.HINDI, label: 'हिन्दी (Hindi)', code: 'hi-IN' },
];

// Claude models
export const MODEL_NAME = 'claude-sonnet-4-20250514'; // Best for vision + JSON
export const CHAT_MODEL_NAME = 'claude-sonnet-4-20250514'; // For Sita chat