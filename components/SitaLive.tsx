
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AnalysisResultData } from '../types';

interface SitaLiveProps {
  analysisContext: AnalysisResultData;
}

// Helper to decode base64 to ArrayBuffer
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to encode ArrayBuffer to base64
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to create PCM Blob
function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Helper to decode PCM audio data for playback
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const SitaLive: React.FC<SitaLiveProps> = ({ analysisContext }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopSession = () => {
    // Close session
    if (sessionRef.current) {
      // There isn't a direct close() on the session object from connect(), 
      // but we stop sending data and close contexts.
      // The API usually relies on the client closing the socket, 
      // but the SDK manages this. We just stop our local processing.
      sessionRef.current = null;
    }

    // Stop input stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect input nodes
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }

    // Stop output audio
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsActive(false);
    setIsConnecting(false);
    nextStartTimeRef.current = 0;
  };

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      const inputAudioContext = new (window.AudioContext || window.webkitSpeechRecognition)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || window.webkitSpeechRecognition)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputAudioContext;
      audioContextRef.current = outputAudioContext;
      
      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const outputNode = outputAudioContext.createGain();
      outputNode.connect(outputAudioContext.destination);

      const tablets = analysisContext.recommendedMedicines?.tablets?.map(t => t.name + ' (' + t.usageInstruction + ')').join(', ') || 'None';
      const ointments = analysisContext.recommendedMedicines?.ointments?.map(o => o.name + ' (' + o.usageInstruction + ')').join(', ') || 'None';

      const systemPrompt = `You are Sita, a compassionate and calm veterinary assistant for Karuṇā. 
      You are talking to a user who has just found an animal in distress.
      
      Current Analysis Context:
      - Animal: ${analysisContext.animal}
      - Condition: ${analysisContext.probableCondition}
      - Severity: ${analysisContext.injurySeverity}
      - Recommended Tablets (Reference): ${tablets}
      - Recommended Ointments (Reference): ${ointments}
      - First Aid Suggested: ${analysisContext.firstAidSteps.join('. ')}

      Your goal is to verbally guide the user, keep them calm, and answer questions about the first aid steps and the suggested medicines.
      Always remind the user that medicine suggestions are for reference and they should consult a vet if possible.
      Keep your responses concise, empathetic, and clear. Do not give long lectures. Focus on the "right now".`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Sita connection opened');
            setIsActive(true);
            setIsConnecting(false);

            // Setup Input Processing
            const source = inputAudioContext.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            // Use ScriptProcessor as per SDK guidelines for raw PCM
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio) {
              const ctx = audioContextRef.current;
              if (!ctx) return;

              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                ctx,
                24000,
                1
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(source => {
                    try { source.stop(); } catch (e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Sita connection closed');
            stopSession();
          },
          onerror: (err) => {
            console.error('Sita connection error', err);
            setErrorMessage("Connection lost. Please try again.");
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Kore is often a good, calm voice
          },
          systemInstruction: systemPrompt,
        },
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Failed to start Sita", err);
      setErrorMessage(err.message || "Could not access microphone or connect.");
      setIsConnecting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-xl shadow-xl p-6 text-white mt-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🗣️</span>
            <h2 className="text-2xl font-bold">Talk to Sita</h2>
          </div>
          <p className="text-teal-100 mb-4">
            Need real-time guidance? Sita is here to help you through the process step-by-step.
          </p>
          
          {errorMessage && (
            <div className="bg-red-500/20 border border-red-300 text-red-100 p-3 rounded-lg text-sm mb-4">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
          {!isActive ? (
            <button
              onClick={startSession}
              disabled={isConnecting}
              className="group relative flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg hover:scale-105 transition-all disabled:opacity-70 disabled:scale-100"
            >
                {isConnecting ? (
                     <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-teal-700" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 3a1 1 0 00-2 0v2.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 9.586V7z" clipRule="evenodd" />
                        <path d="M10 18a5 5 0 005-5h-2a3 3 0 01-6 0H5a5 5 0 005 5z" />
                    </svg>
                )}
                 {!isConnecting && (
                     <span className="absolute -bottom-8 text-sm font-semibold text-white whitespace-nowrap">Start Call</span>
                 )}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4">
               {/* Visualizer Animation */}
               <div className="flex items-center gap-1 h-12">
                  <div className="w-2 bg-white rounded-full animate-pulse h-8"></div>
                  <div className="w-2 bg-white rounded-full animate-pulse h-12 delay-75"></div>
                  <div className="w-2 bg-white rounded-full animate-pulse h-6 delay-150"></div>
                  <div className="w-2 bg-white rounded-full animate-pulse h-10 delay-100"></div>
                  <div className="w-2 bg-white rounded-full animate-pulse h-8"></div>
               </div>

               <button
                onClick={stopSession}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full font-semibold shadow-md transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                End Call
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};