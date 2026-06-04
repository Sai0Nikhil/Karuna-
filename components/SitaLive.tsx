import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResultData } from '../types';
import { chatWithSita } from '../services/claudeService';
import { LANGUAGES } from '../constants';

interface SitaLiveProps {
  analysisContext: AnalysisResultData;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const SitaLive: React.FC<SitaLiveProps> = ({ analysisContext }) => {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isListening]);

  // ─── Start Chat ─────────────────────────────────────────────────

  const startChat = () => {
    setMessages([]);
    setErrorMessage(null);
    setIsActive(true);

    // Add initial greeting from Sita
    const greeting = `Hello! I'm Sita, your veterinary assistant. I can see the analysis for this ${analysisContext.animal}. How can I help you? You can ask me about the first aid steps, medicines, or what to do next.`;
    setMessages([{ role: 'assistant', content: greeting }]);

    // Auto-speak the greeting
    speakText(greeting);
  };

  // ─── End Chat ───────────────────────────────────────────────────

  const endChat = () => {
    setIsActive(false);
    setIsLoading(false);
    setInputText('');
    window.speechSynthesis.cancel();
    if (typeof window !== 'undefined') {
      const recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (recognition) {
        setIsListening(false);
      }
    }
  };

  // ─── Text-to-Speech ─────────────────────────────────────────────

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Use a calm voice if available
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // ─── Send Message ───────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Build conversation history for Claude (exclude the greeting from history
      // since it's handled by the system prompt)
      const historyForClaude = updatedMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const reply = await chatWithSita(historyForClaude, analysisContext);
      const assistantMessage: ChatMessage = { role: 'assistant', content: reply };
      setMessages((prev) => [...prev, assistantMessage]);
      speakText(reply);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to get a response.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Speech-to-Text ─────────────────────────────────────────────

  const toggleListening = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      window.speechSynthesis.cancel();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      // Auto-send the transcribed text
      sendMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // ─── Handle form submit / Enter key ─────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-xl shadow-xl p-6 text-white mt-8">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🗣️</span>
            <h2 className="text-2xl font-bold">Talk to Sita</h2>
          </div>
          <p className="text-teal-100">
            Need guidance? Sita is here to help you through the process step-by-step.
          </p>
        </div>

        <div className="flex-shrink-0">
          {!isActive ? (
            <button
              onClick={startChat}
              className="flex items-center gap-2 bg-white text-teal-700 font-bold px-6 py-3 rounded-full shadow-lg hover:scale-105 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
              </svg>
              Start Chat
            </button>
          ) : (
            <button
              onClick={endChat}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-full shadow-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              End Chat
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-500/20 border border-red-300 text-red-100 p-3 rounded-lg text-sm mb-4">
          {errorMessage}
        </div>
      )}

      {isActive && (
        <>
          {/* Chat Messages */}
          <div className="bg-teal-900/40 rounded-lg p-4 mb-4 max-h-80 overflow-y-auto space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-500 text-white rounded-br-md'
                      : 'bg-white/20 text-white rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/20 rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Sita something..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-full bg-white/20 text-white placeholder-teal-200 border border-teal-400/30 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={toggleListening}
              disabled={isLoading}
              className={`p-3 rounded-full transition-colors ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-white/20 text-white hover:bg-white/30'
              } disabled:opacity-50`}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 6a4 4 0 01-3.94-3.7A4 4 0 0010 12a4 4 0 003.94-3.7 4 4 0 01-3.94 3.7z" clipRule="evenodd" />
                <path d="M10 18a5 5 0 005-5h-2a3 3 0 01-6 0H5a5 5 0 005 5z" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-full bg-white text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
};
