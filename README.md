# 🐾 KARUNA — Compassion-A-Thon 3.0 MVP

**AI-assisted community-driven street-animal rescue platform.**

End-to-end demo based on the copyright document: *"Karuna: A Community Driven Smartphone Application for Location Aware Image Based Injury Detection, Reporting and Rescue of Injured Animals"* (Vukka Sai Nikhil & Debabrata Bej, April 2026).

All statistics on the landing page are sourced directly from the copyright document (pilot targets: Vijayawada + 2 urban centres).

---

## Quick start

```bash
cd C:\Karuna_GAS\Karuna-
npm install
npm run dev
```

Open **http://localhost:3000** — starts on the landing page.

---

## Routes

| URL | View |
|---|---|
| `#/home` | Landing page (default) |
| `#/citizen` | Citizen report flow — upload photo, AI triage, submit case |
| `#/ngo` | NGO dashboard — case queue, dispatch, status tracking |
| `#/donate` | Donations — all fundable cases |
| `#/donate/<caseId>` | Per-case donation ledger |
| `#/adopt` | Adoption listings |
| `#/adopt/<caseId>` | Per-case adoption applications |
| `#/case/<caseId>` | Case detail timeline |

---

## AI (optional)

Set `ANTHROPIC_API_KEY` in `.env` for real Claude calls (vision triage, Sita chat, first-aid instructions). Without the key, the app uses local mock data and works fully offline.

---

## Key numbers from the copyright document

| Metric | Target |
|---|---|
| AI detection accuracy (YOLOv8) | 97% |
| Median rescue response time | <2 hours (from ~24h) |
| Treatment success rate | ≥85% |
| Verified adoption placement | ≥40% of recovered animals |
| Donor retention (re-donate within 12 mo) | ≥70% |
| AI triage return time | 3–5 seconds |
| API p95 response time | <500 ms |
| Pilot cities | Vijayawada + 2 urban centres |

---

## Built with

React 19 · TypeScript · Vite · Tailwind CSS · Anthropic Claude SDK
