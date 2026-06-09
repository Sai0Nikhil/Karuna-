import React, { useState } from 'react';
import { AnalysisResultData, Language, VeterinaryContact } from '../types';
import { LANGUAGES } from '../constants';
import { generateFirstAidVisual } from '../services/claudeService';
import { Loader } from './Loader';

interface AnalysisResultProps {
  data: AnalysisResultData;
  vets: VeterinaryContact[];
  language: Language;
  onSpeciesChange?: (species: string) => void;
}

const severityClasses = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-800',
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, vets, language, onSpeciesChange }) => {
  const [visuals, setVisuals] = useState<Record<number, string>>({});       // Stores text instructions from Claude
  const [loadingVisuals, setLoadingVisuals] = useState<Record<number, boolean>>({});

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      const langCode = LANGUAGES.find(l => l.value === language)?.code || 'en-US';
      const warningText = data.firstAidSteps.find(step => step.toLowerCase().includes('warning:')) || '';
      const firstAid = data.firstAidSteps.filter(step => !step.toLowerCase().includes('warning:')).join('. ');
      
      const textToSpeak = `${warningText}. Now, for first aid: ${firstAid}`;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = langCode;
      window.speechSynthesis.cancel(); // Stop any previous speech
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Sorry, your browser doesn't support text-to-speech.");
    }
  };

  const handleShare = async () => {
    // Safety check for optional chaining
    const tablets = data.recommendedMedicines?.tablets || [];
    const ointments = data.recommendedMedicines?.ointments || [];
    const steps = data.firstAidSteps || [];

    // Format tablets with instructions
    const tabletsSection = tablets.length > 0 
      ? `💊 Tablets:\n${tablets.map(t => `• ${t.name}\n  └ Instruction: ${t.usageInstruction}`).join('\n')}`
      : '💊 Tablets: None';

    // Format ointments with instructions
    const ointmentsSection = ointments.length > 0
      ? `🧴 Ointments:\n${ointments.map(o => `• ${o.name}\n  └ Apply: ${o.usageInstruction}`).join('\n')}`
      : '🧴 Ointments: None';

    const shareData = {
      title: 'Karuṇā - Animal Rescue Report',
      text: `🐾 *Karuṇā Rescue Report* 🐾\n\n` +
            `*Animal:* ${data.animal}\n` +
            `*Condition:* ${data.probableCondition}\n` +
            `*Severity:* ${data.injurySeverity?.toUpperCase()}\n\n` +
            `*Suggested Medicines (Consult Vet):*\n` +
            `${tabletsSection}\n\n` +
            `${ointmentsSection}\n\n` +
            `*⛑️ Immediate First Aid:*\n` +
            `${steps.map((step, i) => `${i+1}. ${step}`).join('\n')}\n\n` +
            `*📍 Help & App:* ${window.location.href}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing', err);
      }
    } else {
      navigator.clipboard.writeText(shareData.text);
      alert('Report detailed copied to clipboard!');
    }
  };

  const handleGenerateVisual = async (step: string, index: number) => {
    if (visuals[index] || loadingVisuals[index]) return;

    setLoadingVisuals(prev => ({ ...prev, [index]: true }));
    try {
      const instructions = await generateFirstAidVisual(step, data.animal);
      setVisuals(prev => ({ ...prev, [index]: instructions }));
    } catch (error) {
      console.error(error);
      alert('Failed to generate detailed instructions. Please try again.');
    } finally {
      setLoadingVisuals(prev => ({ ...prev, [index]: false }));
    }
  };

  return (
    <div className="space-y-8">
      {/* Analysis Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
         <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-teal-800 mb-4">Analysis Report</h2>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-teal-100 text-teal-700"
                title="Share Report"
                aria-label="Share Report"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
              </button>
              <button 
                onClick={handleSpeak} 
                className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
                title="Read Aloud"
                aria-label="Read analysis aloud"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3a1 1 0 011 1v1.373c.832.142 1.599.462 2.298.928.32.214.393.66.18.98l-1.57 2.355a.6.6 0 00.18.814c.237.185.55.218.814.083l.896-.448A8.002 8.002 0 0118 11a8 8 0 1" />
                </svg>
              </button>
            </div>
         </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
             <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-700">Animal:</span>
                <span className="text-lg text-gray-900 capitalize font-medium">{data.animal}</span>
                {onSpeciesChange && (
                  <div className="inline-flex items-center gap-1.5 ml-3 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5 text-xs text-teal-800">
                    <span>Not correct? Change to:</span>
                    <select
                      onChange={(e) => onSpeciesChange(e.target.value)}
                      defaultValue=""
                      className="bg-white border border-teal-300 rounded text-xs px-1.5 py-0.5 text-teal-900 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="" disabled>Select...</option>
                      <option value="dog">🐕 Dog</option>
                      <option value="cat">🐈 Cat</option>
                      <option value="cow">🐄 Cow</option>
                      <option value="bird">🦜 Bird</option>
                      <option value="other">❓ Other</option>
                    </select>
                  </div>
                )}
             </div>

             <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Status:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-semibold ${data.isInjured ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {data.isInjured ? 'Injured' : 'Healthy'}
                </span>
             </div>
             
             <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Severity:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-semibold ${severityClasses[data.injurySeverity] || severityClasses.unknown}`}>
                  {data.injurySeverity?.toUpperCase()}
                </span>
             </div>

             <div>
                <span className="block font-semibold text-gray-700 mb-1">Probable Condition:</span>
                <p className="text-gray-800 bg-gray-50 p-3 rounded-md">{data.probableCondition}</p>
             </div>

             {/* Prescription Dropdown Section */}
             {(data.recommendedMedicines?.tablets?.length > 0 || data.recommendedMedicines?.ointments?.length > 0) && (
               <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50 mt-4">
                 <h3 className="text-lg font-bold text-red-800 flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.011-3.231 2.121-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
                    </svg>
                    Prescription & Administration Guide
                 </h3>
                 <p className="text-xs text-red-600 mb-3 italic">
                    * AI Suggestions Only. Consult a vet before administering. Click medicines below for usage instructions.
                 </p>
                 
                 <div className="space-y-3">
                   {/* Tablets Dropdowns */}
                   {data.recommendedMedicines?.tablets?.length > 0 && (
                      <div>
                        <span className="text-sm font-semibold text-red-800 uppercase tracking-wide">Tablets / Oral</span>
                        <div className="mt-1 space-y-2">
                          {data.recommendedMedicines.tablets.map((tablet, idx) => (
                            <details key={`tab-${idx}`} className="group border border-red-200 bg-white rounded-md overflow-hidden">
                              <summary className="cursor-pointer p-3 font-medium text-gray-800 flex justify-between items-center hover:bg-gray-50 select-none">
                                <span>💊 {tablet.name}</span>
                                <span className="transition-transform group-open:rotate-180">▼</span>
                              </summary>
                              <div className="p-3 bg-red-50 text-sm text-gray-700 border-t border-red-100 animate-fadeIn">
                                <span className="font-semibold">How to use: </span>
                                {tablet.usageInstruction}
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                   )}

                   {/* Ointments Dropdowns */}
                   {data.recommendedMedicines?.ointments?.length > 0 && (
                      <div>
                         <span className="text-sm font-semibold text-red-800 uppercase tracking-wide">Ointments / Topical</span>
                         <div className="mt-1 space-y-2">
                           {data.recommendedMedicines.ointments.map((ointment, idx) => (
                              <details key={`oint-${idx}`} className="group border border-red-200 bg-white rounded-md overflow-hidden">
                                <summary className="cursor-pointer p-3 font-medium text-gray-800 flex justify-between items-center hover:bg-gray-50 select-none">
                                  <span>🧴 {ointment.name}</span>
                                  <span className="transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <div className="p-3 bg-red-50 text-sm text-gray-700 border-t border-red-100 animate-fadeIn">
                                  <span className="font-semibold">How to apply: </span>
                                  {ointment.usageInstruction}
                                </div>
                              </details>
                           ))}
                         </div>
                      </div>
                   )}
                 </div>
               </div>
             )}

          </div>

          <div className="space-y-4">
             <h3 className="text-lg font-semibold text-gray-800">Immediate First Aid</h3>
             <ul className="space-y-4">
              {data.firstAidSteps.map((step, index) => (
                <li key={index} className="bg-blue-50 p-4 rounded-md text-blue-900 border-l-4 border-blue-400">
                  <div className="flex flex-col gap-3">
                     <div className="flex gap-3">
                       <span className="font-bold text-blue-500">{index + 1}.</span>
                       <p>{step}</p>
                     </div>
                     <div className="ml-7">
                        {visuals[index] ? (
                            <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
                                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                  {visuals[index]}
                                </p>
                                <span className="text-[10px] text-gray-400 mt-2 block">AI-generated instructions</span>
                            </div>
                        ) : (
                           <button 
                             onClick={() => handleGenerateVisual(step, index)}
                             disabled={loadingVisuals[index]}
                             className="text-xs bg-white border border-blue-300 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 flex items-center gap-1 transition-colors shadow-sm"
                           >
                              {loadingVisuals[index] ? <Loader size="sm" /> : '📋'}
                              {loadingVisuals[index] ? 'Loading...' : 'Get Detailed Instructions'}
                           </button>
                        )}
                     </div>
                  </div>
                </li>
              ))}
             </ul>
          </div>
        </div>

        <div className="mt-8">
           <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md">
             <div className="flex">
               <div className="flex-shrink-0">
                 <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                 </svg>
               </div>
               <div className="ml-3">
                 <p className="text-sm text-yellow-700">
                   {data.disclaimer}
                 </p>
               </div>
             </div>
           </div>
        </div>

      </div>

      {/* Local Support Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
         <h2 className="text-2xl font-bold text-teal-800 mb-6">Nearby Support</h2>
         {vets.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {vets.map((vet, idx) => (
               <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                 <h3 className="font-bold text-lg text-gray-800 mb-2">{vet.name}</h3>
                 <p className="text-sm text-gray-600 mb-3">{vet.address}</p>
                 <div className="flex flex-col gap-2">
                   {vet.phone !== 'N/A' && (
                     <a href={`tel:${vet.phone}`} className="flex items-center gap-2 text-teal-600 hover:text-teal-800 font-medium text-sm">
                       <span>📞</span> Call Now
                     </a>
                   )}
                   <a 
                     href={vet.mapsLink.startsWith('http') ? vet.mapsLink : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vet.name + ' ' + vet.address)}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                   >
                     <span>🗺️</span> View on Map
                   </a>
                 </div>
               </div>
             ))}
           </div>
         ) : (
           <p className="text-gray-600">No specific veterinary contacts found for your exact location in our database. Please try searching on Google Maps.</p>
         )}
      </div>
    </div>
  );
};