# 👋 Welcome to the KARUNA team

This is the KARUNA Compassion-A-Thon 3.0 MVP.
Everything in here runs locally — no servers, no API key, no setup beyond
installing Node packages.

---

## Prerequisites

* Node.js 18 or newer (check with `node --version`)
* npm (ships with Node)

That is the whole list.

---

## First-time setup (5 minutes)

```bash
cd Karuna-
npm install        # downloads dependencies (~100 packages, ~1 min)
npm run dev        # starts the dev server
```

Then open **http://localhost:3000** in your browser.

If you see *"Mock AI — no API key required"* on the landing page, the
demo is using locally-mocked triage and works fully offline. That is the
expected default.

---

## Optional: live Claude AI

To switch from the mock AI to the real Anthropic Claude model:

1. Create a file `Karuna-/.env` (gitignored, never committed):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Restart the dev server (`Ctrl+C` then `npm run dev`).

The landing-page badge will flip to *"Live AI — Claude connected"* and the
citizen flow will call Claude vision instead of the mock. If the call
ever fails (rate-limit, no internet, etc.) the app silently falls back
to the mock — the demo never breaks mid-pitch.

---

## What to click first

The four roles in the top nav are all backed by one shared case store,
so an action in one view shows up in the others. Try this 60-second
demo path:

1. **Report (Citizen)** → upload any animal photo → set location
   (use the *current location* button or type a city) → *Get help now*.
   You will see the AI triage card.
2. Scroll down → click **Submit case →**.
3. **NGO Dashboard** → click your new case in the queue → click
   *Auto-dispatch this responder* in the indigo panel. (The score
   breakdown shows exactly why that responder was picked — that is the
   headline novelty of the copyright doc.)
4. Keep clicking *Advance status →* to walk it through collected →
   at-clinic → treatment → discharged.
5. **Donate** → click your case → make a (mocked) donation.
6. **Adopt** → once the case is at "discharged", click it → fill in
   the adopter form → submit.

Hit **↺ Reset demo** in the top nav to wipe state and reload the 6
seed cases.

---

## Project layout

```
Karuna-/
  App.tsx                          ← router outlet
  index.tsx                        ← React entry
  index.html                       ← Tailwind CDN + import-map + fade animations

  store/
    caseStore.tsx                  ← in-memory case store + localStorage
    router.tsx                     ← hash-based router

  services/
    claudeService.ts               ← hybrid Anthropic / mock triage
    dispatch.ts                    ← severity-driven matching algorithm
                                     (the novelty of the copyright doc)

  data/
    seedCases.ts                   ← 6 demo cases across full lifecycle
    veterinaryData.ts              ← real Indian vet / NGO contacts

  components/
    LandingPage.tsx                ← marketing-style home
    TopNav.tsx                     ← role switcher + AI-mode badge
    CitizenReportFlow.tsx          ← photo + GPS + AI triage + submit
    NGODashboard.tsx               ← case queue + assign + advance
    AutoDispatchPanel.tsx          ← matching algorithm UI with score
                                     breakdown
    DonationView.tsx               ← donations list + per-case ledger
    AdoptionView.tsx               ← adoption list + apply / approve
    CaseDetail.tsx                 ← reporter-facing timeline
    AnalysisResult.tsx             ← AI triage result card
    ImageUploader.tsx              ← drag/drop photo
    SitaLive.tsx                   ← voice chat assistant
    shared.tsx                     ← chips / cards / progress bar
```

---

## Common issues

* **"npm install" stalls on Windows** — try `npm install --no-audit`.
* **Port 3000 is in use** — `vite.config.ts` line 8 sets the port; change
  to something free like 5173 and re-run.
* **Voice chat ("Sita Live") does not respond** — your browser may not
  support `SpeechRecognition`. Chrome works best.
* **All cases disappear after a refresh** — that should not happen
  because we use `localStorage`. If it does, browser is in private/
  incognito mode.
* **"Live AI" badge stays grey even with a key set** — restart the dev
  server. Vite only loads `.env` at startup.

---

## What to bring to the pitch finale

* The deck (`Karuna_Compassion-A-Thon_3.0.pptx`) — already populated.
* The copyright document (`Karuna document for copyright (2).pdf`).
* This running app — open the landing page, then the citizen flow, then
  the NGO dashboard. The judges' eyes light up at the *"Why this
  responder?"* score breakdown — that visual is what makes the
  severity-driven dispatch novelty real.
* Customer-interview videos (mandatory for qualifying — see Slides 7 & 8
  in the deck).

Good luck — happy rescuing 🐾.
