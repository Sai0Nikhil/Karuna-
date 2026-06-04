// =====================================================================
// KARUNA landing page — hero, how-it-works, features, novelty, legal.
// No numerical stat displays — purely narrative.
// =====================================================================

import React from 'react';
import { useRouter } from '../store/router';
import { isLiveClaude } from '../services/claudeService';

const FEATURES = [
  {
    icon: '📸',
    title: 'AI Image Triage',
    desc: 'Photograph any injured street animal. YOLOv8 detects species & injury type — open wounds, fractures, bleeding, emaciation, eye injuries. A hybrid rule+ML engine assigns severity (critical / urgent / routine) and generates multilingual first-aid guidance.',
  },
  {
    icon: '📍',
    title: 'Automated GPS & Timestamp',
    desc: 'Camera capture automatically appends GPS coordinates and a precise timestamp. No manual data entry required from the citizen reporter.',
  },
  {
    icon: '⚡',
    title: 'Severity-Driven Dispatch',
    desc: 'The severity score feeds directly into the responder-matching algorithm — no human dispatcher in between. Closest, most-skilled, least-loaded responder is notified based on urgency-weighted scoring.',
  },
  {
    icon: '📋',
    title: 'Unified Case Record',
    desc: 'One case record tracks the entire journey: report → collection → treatment clinic → discharge → adoption or release. Every event logged, every stakeholder sees the same data.',
  },
  {
    icon: '💰',
    title: 'Per-Case Donation Ledger',
    desc: 'Each case has its own donation page with transparent, append-only financial log. Donors see exactly which animal their money helped and what bills it covered — no black-box charity fund.',
  },
  {
    icon: '🏛️',
    title: 'Municipal ABC Integration',
    desc: 'Standardised, geo-referenced incident data feeds directly into municipal Animal Birth Control programme planning, hotspot mapping, and citizen-driven health surveillance.',
  },
];

const TECH_STACK = 'React Native / Flutter · FastAPI / Node.js · PostgreSQL · Firebase · YOLOv8 · Gemini · Razorpay / Stripe';

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <main>
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-800 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-300 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 md:px-8 py-20 md:py-28 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-6xl md:text-7xl mb-6 animate-fade-up">🐾</div>
            <h1 className="text-4xl md:text-6xl font-bold font-adlam mb-4 tracking-tight animate-fade-up animate-fade-up-d1">
              Karuṇā
            </h1>
            <p className="text-xl md:text-2xl text-teal-100 font-light max-w-2xl mx-auto mb-3 animate-fade-up animate-fade-up-d2">
              AI-assisted community-driven street-animal rescue
            </p>
            <div className="h-px w-24 bg-teal-400 mx-auto my-6 animate-fade-up animate-fade-up-d3" />
            <p className="text-base md:text-lg text-teal-200 max-w-3xl mx-auto leading-relaxed animate-fade-up animate-fade-up-d4">
              A unified platform connecting citizens, volunteer responders, veterinary clinics,
              donors, and municipal ABC programmes — from the moment an injured animal is
              spotted through treatment, recovery, and adoption.
            </p>

            {/* Live demo badge */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-fade-up animate-fade-up-d5">
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full border border-white/20">
                <span className={`w-2 h-2 rounded-full ${isLiveClaude() ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {isLiveClaude() ? 'Live AI — Claude connected' : 'Mock AI — no API key required'}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full border border-white/20">
                🧪 TRL 1–3 · Proof of Concept
              </span>
            </div>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <button
                onClick={() => navigate({ name: 'citizen' })}
                className="bg-white text-teal-800 font-bold px-8 py-3.5 rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-lg"
              >
                Report an animal →
              </button>
              <button
                onClick={() => navigate({ name: 'ngo' })}
                className="bg-teal-600 text-white font-bold px-8 py-3.5 rounded-xl border-2 border-teal-400/40 hover:bg-teal-500 hover:scale-105 transition-all text-lg"
              >
                NGO dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 text-center mb-4">
            How Karuṇā works
          </h2>
          <p className="text-slate-500 text-center max-w-xl mx-auto mb-12">
            One case record, one platform, from street to outcome.
          </p>

          <div className="grid md:grid-cols-5 gap-6 max-w-5xl mx-auto relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-teal-200 z-0" />

            <StepCard
              step="1" icon="📸" title="Citizen reports"
              desc="Photo + GPS + timestamp → AI triages injury severity & generates first-aid guidance in the user's language."
            />
            <StepCard
              step="2" icon="⚡" title="Auto-dispatch"
              desc="Severity score drives matching algorithm — nearest, best-skilled responder is notified automatically."
            />
            <StepCard
              step="3" icon="🏥" title="Treatment tracked"
              desc="Responder logs collection, clinic arrival, treatment progress — the reporter sees updates in real time."
            />
            <StepCard
              step="4" icon="💰" title="Per-case funding"
              desc="A case-specific donation page goes live. Every rupee is logged transparently against actual bills."
            />
            <StepCard
              step="5" icon="🏡" title="Adoption / release"
              desc="Recovered animals listed for verified adoption. Dashboard data feeds ABC programme planning."
            />
          </div>
        </div>
      </section>

      {/* ─── The problem ──────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 text-center mb-8">
            The gap this fills
          </h2>
          <blockquote className="text-lg text-slate-600 italic leading-relaxed border-l-4 border-teal-500 pl-6 py-2 bg-white rounded-r-lg shadow-sm">
            "Urban animal rescue is constrained by poor coordination rather than limited resources. 
            No single system connects reporting, treatment, donations, and outcomes for an individual case."
            <footer className="text-sm not-italic text-slate-400 mt-2">— Karuṇā copyright document (April 2026)</footer>
          </blockquote>
          <div className="mt-10 grid md:grid-cols-3 gap-6 text-center">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold text-slate-800 mb-2">Fragmented reporting</h3>
              <p className="text-sm text-slate-600">Same case reported 3× via WhatsApp, Facebook, phone — while another goes unseen entirely.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-3xl mb-3">⏳</div>
              <h3 className="font-semibold text-slate-800 mb-2">24-hour response</h3>
              <p className="text-sm text-slate-600">No central dispatch means responders waste hours — median wait time stretches past a full day.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold text-slate-800 mb-2">No donor visibility</h3>
              <p className="text-sm text-slate-600">Donors give to generic NGO accounts, never knowing whether their money reached the animal they saw.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Technology stack ────────────────────────────────────────── */}
      <section className="bg-slate-900 text-slate-300 py-12">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Technology stack</p>
          <p className="text-sm md:text-base text-slate-400 max-w-3xl mx-auto">{TECH_STACK}</p>
        </div>
      </section>

      {/* ─── Features grid ───────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 text-center mb-12">
            Platform features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Novelty callout ─────────────────────────────────────────── */}
      <section className="bg-amber-50 border-y border-amber-200 py-14">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-200/50 px-3 py-1 rounded-full">
            What makes this novel
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-amber-900 mt-4 mb-4 leading-tight">
            The severity score is the dispatch signal
          </h2>
          <p className="text-amber-800 max-w-2xl mx-auto leading-relaxed">
            In every existing platform, the triage result is displayed to a human who then decides 
            what to do. In Karuṇā, the AI-derived severity score is a direct input variable in the 
            matching engine's scoring function — urgency drives dispatch automatically, with no 
            human dispatcher in between. Based on the reviewed literature covering Let It Wag, 
            PetFinder, Strayz, HSIApps, and academic systems, this direct coupling between 
            image-based triage and automated dispatch has not been reported in any deployed 
            urban animal rescue platform.
          </p>
          <div className="mt-6 text-xs text-amber-600">
            Karuṇā copyright document, Sec 7 — Novelty
          </div>
        </div>
      </section>

      {/* ─── Legal framework ─────────────────────────────────────────── */}
      <section className="bg-slate-50 py-12">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <h2 className="text-xl font-bold text-slate-800 text-center mb-6">Legal & compliance framework</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-600">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="font-semibold text-slate-800 mb-1">🐾 Prevention of Cruelty to Animals Act, 1960</div>
              <p>Sets the care baseline for all rescue activity on the platform.</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="font-semibold text-slate-800 mb-1">📋 ABC Rules, 2023</div>
              <p>Stray dog management responsibility on local bodies — Karuṇā feeds sterilisation & vaccination route planning data.</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="font-semibold text-slate-800 mb-1">🔐 DPDP Act, 2023</div>
              <p>Location retained only during active case; research exports stripped of identifying information.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-teal-700 text-white py-16">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to see it in action?</h2>
          <p className="text-teal-200 max-w-xl mx-auto mb-8">
            Explore the platform with demo data — no sign-up, no API key required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate({ name: 'citizen' })}
              className="bg-white text-teal-800 font-bold px-6 py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all"
            >
              Report an animal
            </button>
            <button
              onClick={() => navigate({ name: 'ngo' })}
              className="bg-teal-600 text-white font-bold px-6 py-3 rounded-xl border-2 border-teal-400/40 hover:bg-teal-500 transition-all"
            >
              NGO dashboard
            </button>
            <button
              onClick={() => navigate({ name: 'donations' })}
              className="bg-teal-600 text-white font-bold px-6 py-3 rounded-xl border-2 border-teal-400/40 hover:bg-teal-500 transition-all"
            >
              Make a donation
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-500 py-10 text-center text-xs">
        <div className="container mx-auto px-4">
          <p className="text-lg font-adlam text-slate-400 mb-2">🐾 Karuṇā</p>
          <p className="mb-1">Compassion-A-Thon 3.0 · Paradox 2026 · KL University</p>
          <p className="mb-1">Vukka Sai Nikhil & Debabrata Bej · KL University</p>
          <p className="text-[10px] text-slate-600 mt-4">
            Reference: "Karuna: A Community Driven Smartphone Application for Location Aware Image Based
            Injury Detection, Reporting and Rescue of Injured Animals" (April 2026).
          </p>
        </div>
      </footer>
    </main>
  );
};

/* ─── StepCard helper ─────────────────────────────────────────────── */

const StepCard: React.FC<{ step: string; icon: string; title: string; desc: string }> = ({
  step, icon, title, desc,
}) => (
  <div className="relative z-10 flex flex-col items-center text-center">
    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-2xl shadow-md mb-4 ring-4 ring-white">
      {icon}
    </div>
    <div className="text-xs font-bold text-teal-600 bg-teal-50 rounded-full px-3 py-0.5 mb-2">
      Step {step}
    </div>
    <h3 className="font-semibold text-slate-800 text-sm mb-1">{title}</h3>
    <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">{desc}</p>
  </div>
);
