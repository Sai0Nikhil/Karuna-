// =====================================================================
// Citizen report flow (refactor of the original App.tsx UI).
//
// After the AI triage returns, the user can save the case into the
// shared case store with one click — that's the moment "report" becomes
// a tracked case visible to the NGO dashboard / donors / adopters.
// =====================================================================

import React, { useCallback, useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { AnalysisResult } from './AnalysisResult';
import { SitaLive } from './SitaLive';
import { Loader } from './Loader';
import {
  AnalysisResultData,
  CaseLocation,
  Language,
  Severity,
  VeterinaryContact,
} from '../types';
import { LANGUAGES } from '../constants';
import { analyzeImage } from '../services/claudeService';
import { useCaseStore } from '../store/caseStore';
import { useRouter } from '../store/router';
import { AutoDispatchPanel } from './AutoDispatchPanel';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const severityFromAnalysis = (a: AnalysisResultData): Severity => {
  if (a.injurySeverity === 'high') return 'critical';
  if (a.injurySeverity === 'medium') return 'urgent';
  return 'routine';
};

const estimateCostInr = (sev: Severity): number => {
  if (sev === 'critical') return 5500;
  if (sev === 'urgent') return 2800;
  return 1500;
};

export const CitizenReportFlow: React.FC = () => {
  const { createCase, getCase } = useCaseStore();
  const { navigate } = useRouter();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResultData | null>(null);
  const [vets, setVets] = useState<VeterinaryContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const [location, setLocation] = useState<{ lat: number; lon: number } | string | null>(null);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setIsFetchingLocation(true);
    setLocationError(null);
    setLocation(null);
    setManualLocationInput('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        setIsFetchingLocation(false);
      },
      (err) => {
        setLocationError(`Unable to retrieve location: ${err.message}`);
        setIsFetchingLocation(false);
      },
    );
  };

  const handleSetManualLocation = () => {
    if (manualLocationInput.trim()) {
      setLocation(manualLocationInput.trim());
      setLocationError(null);
    } else {
      setLocationError('Please enter a location.');
    }
  };

  const handleImageChange = (file: File | null, dataUrl: string | null) => {
    setImageFile(file);
    setImageDataUrl(dataUrl);
    setAnalysis(null);
    setError(null);
    setSavedCaseId(null);
  };

  const handleAnalyze = useCallback(async () => {
    if (!imageDataUrl) { setError('Please upload an image first.'); return; }
    if (!location) { setError('Please provide a location to find nearby help.'); return; }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeImage(imageDataUrl, description, language, location);
      setAnalysis(result);
      setVets(result.localSupport || []);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [imageDataUrl, description, language, location]);

  const handleSaveCase = () => {
    if (!analysis || !imageDataUrl || !location) return;
    const sev = severityFromAnalysis(analysis);
    const loc: CaseLocation = typeof location === 'string'
      ? { label: location }
      : { lat: location.lat, lon: location.lon, label: `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` };

    const c = createCase({
      reporterName: reporterName.trim() || 'Anonymous Citizen',
      reporterContact: reporterContact.trim() || undefined,
      imageDataUrl,
      location: loc,
      species: analysis.animal,
      injuryType: analysis.probableCondition.split(' ')[0],
      severity: sev,
      probableCondition: analysis.probableCondition,
      firstAidSteps: analysis.firstAidSteps,
      estimatedCostInr: estimateCostInr(sev),
    });
    setSavedCaseId(c.id);
  };

  const toggleListen = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { alert('Speech recognition is not supported in your browser.'); return; }
    const recognition = new Recognition();
    const selectedLangCode = LANGUAGES.find((l) => l.value === language)?.code || 'en-US';
    recognition.lang = selectedLangCode;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => setDescription(event.results[0][0].transcript);
    recognition.onerror = (event: any) => console.error('Speech recognition error', event.error);
    recognition.onend = () => setIsListening(false);
    if (isListening) recognition.stop(); else recognition.start();
  };

  // ──────────────────────────────────────────────────────────────────
  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6 space-y-6">
        <p className="text-gray-600 text-center">
          Found an animal in distress? Upload a photo + your location. Karuṇā provides
          immediate first-aid guidance and connects you with the nearest help.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <ImageUploader onChange={handleImageChange} />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Step 1: Share your location</label>
              <button
                onClick={handleGetLocation}
                disabled={isFetchingLocation}
                className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {isFetchingLocation ? <Loader /> : '📍'}
                {isFetchingLocation ? 'Fetching...' : 'Use current location'}
              </button>
              <div className="mt-2 text-center text-sm text-gray-500">OR</div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  placeholder="e.g. Connaught Place, Delhi"
                  className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                />
                <button onClick={handleSetManualLocation} className="bg-gray-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-gray-700">Set</button>
              </div>
              {location && (
                <div className="text-sm text-teal-800 bg-teal-50 p-2 rounded-md mt-2 text-center">
                  {typeof location === 'string'
                    ? `Location set to: ${location}`
                    : `Location captured: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`}
                </div>
              )}
              {locationError && (
                <div className="text-sm text-red-700 bg-red-50 p-2 rounded-md mt-2 text-center">{locationError}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Step 2: Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Step 3 (optional): Describe the situation</label>
              <div className="relative">
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 'The dog can't walk on its back leg.'"
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                />
                <button
                  onClick={toggleListen}
                  className={`absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}
                  aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 3a1 1 0 00-2 0v2.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 9.586V7z" clipRule="evenodd" />
                    <path d="M10 18a5 5 0 005-5h-2a3 3 0 01-6 0H5a5 5 0 005 5z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Step 4 (optional): Your name & contact</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Your name" value={reporterName} onChange={(e) => setReporterName(e.target.value)}
                  className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500" />
                <input type="text" placeholder="Phone / email (optional)" value={reporterContact} onChange={(e) => setReporterContact(e.target.value)}
                  className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500" />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!imageDataUrl || isLoading || !location}
          className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
        >
          {isLoading ? <><Loader /> Analyzing...</> : 'Get help now'}
        </button>

        {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</div>}
      </div>

      {analysis && !isLoading && (
        <div className="max-w-4xl mx-auto mt-8 space-y-6">
          <AnalysisResult data={analysis} vets={vets} language={language} />

          {!savedCaseId ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-amber-900">Send this to KARUNA responders</h3>
                <p className="text-sm text-amber-800 mt-1">
                  Saves this report as a tracked case — NGO dispatchers will be notified and you will see live updates.
                </p>
              </div>
              <button
                onClick={handleSaveCase}
                className="bg-amber-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-700 whitespace-nowrap"
              >
                Submit case →
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-green-900">Case submitted ✓</h3>
                <p className="text-sm text-green-800 mt-1">
                  Case ID <code className="bg-white px-2 py-0.5 rounded">{savedCaseId}</code> is now visible to the NGO dashboard.
                  Track updates here:
                </p>
              </div>
              <button
                onClick={() => navigate({ name: 'case', caseId: savedCaseId })}
                className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 whitespace-nowrap"
              >
                Track case →
              </button>
            </div>
          )}

          <SitaLive analysisContext={analysis} />
        </div>
      )}
    </main>
  );
};
