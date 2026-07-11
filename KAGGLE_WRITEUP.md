# SafeRide AI — Gemma-Powered Boda Safety Coach for Kampala

**Subtitle:** Live ride scoring + Gemma 4 post-ride coaching for Kampala’s boda riders  
**Track:** Safer Rides  
**Tagline:** Ride safer. Improve faster. With SafeRide AI.

**Attachments**
- Public code: https://github.com/rhapy01/saferideai  
- Live demo: https://saferideboda.vercel.app  

---

## The problem

Kampala’s boda bodas move people to work, school, markets, and hospitals every day. Riders still face high risk from speeding in dense traffic, harsh braking in stop-go conditions, and sharp turns at speed — usually with little feedback and no structured path to improve. Most riders learn on the road. Unsafe habits persist until something goes wrong.

SafeRide AI closes that gap with an assistive smartphone companion: score the ride while it happens, then coach the rider afterward. It is **not** emergency response, medical advice, law enforcement, or traffic control.

## Who it is for

**Primary users:** boda / motorcycle / scooter riders in Kampala.  
**Also useful for:** associations and trainers who want a short, shareable coaching narrative after rides.

Judges can run the full loop in ~90 seconds with **Simulate Ride** (Makerere University → Nakawa).

## What we built

SafeRide AI has two layers:

1. **During the ride (rule-based telemetry)** — monitor speed and motion patterns; detect speeding, harsh braking, and sharp turns; show a live Safety Score (0–100); mark events on a map.
2. **After the ride (Gemma 4)** — send structured trip data to **Gemma 4 (`gemma-4-26b-a4b-it`)** via Google AI Studio and return a short, encouraging, Kampala-specific coaching report.

Deterministic scoring keeps the demo reliable. Gemma turns raw events into human advice riders can use on the next trip.

## How we used Gemma 4

Gemma is the **post-ride coach**, not a black-box scorer.

| Item | Detail |
|------|--------|
| Model | `gemma-4-26b-a4b-it` |
| API | Google AI Studio via `@google/genai` (`generateContent`) |
| Endpoint | `POST /api/rides/:id/analyze` (SSE to the UI) |
| Inputs | Safety score, duration, distance, max speed, event list (type, severity, speed, lat/lng), Makerere→Nakawa route context |
| Output | ≤120 words: overall assessment, 1–2 top issues, 1–2 actionable tips for Kampala roads |
| Guardrails | Do not invent events; supportive but direct tone; no markdown headers |
| Reliability | Up to 5 retries with backoff; shorter fallback prompt; deterministic coach template if Gemma is down |
| Persistence | Report saved on the ride (`ai_report`) for history |

**Proof of engineering:** telemetry in → constrained Gemma prompt → coach narrative out → stored for re-review.

## Architecture

```
React / Vite (SafeRide HUD)
        │  REST + SSE
Express API
   ├── Ride CRUD, events, analyze
   ├── Neon Postgres (Drizzle)
   └── Gemma 4 client (@google/genai)
```

**Stack:** React 19, Vite, Tailwind, Leaflet (OpenStreetMap), Express 5, Neon Postgres, Drizzle ORM, OpenAPI/Zod clients, pnpm monorepo, Vercel deploy.

**Key paths:** `artifacts/saferide` (UI), `artifacts/api-server` (API), `lib/integrations-gemini-ai` (Gemma), `lib/db` (schema).

## Prototype features

- Live Safety Score with green / yellow / red thresholds  
- Real-time risk alerts (speeding, harsh braking, sharp turn)  
- Simulate Ride on Makerere → Nakawa for judges  
- Real Ride mode via browser GPS + DeviceMotion (GPS speed-delta backup)  
- Interactive risk heat map (route + severity glow + markers)  
- Gemma 4 coaching report, grade, and ride history / trend  

**90-second demo:** open https://saferideboda.vercel.app → **Simulate Ride** → watch score & map events → end ride → read the Gemma 4 report.

## Why it matters for Kampala (SDG 11)

Safer individual habits compound into safer streets, more trusted trips, and better livelihoods. An open model like Gemma 4 lets us localize coaching (urban ~50 km/h norms, stop-go traffic tips) without a closed proprietary LLM stack — a practical foundation for associations, training NGOs, or rider co-ops after the hackathon.

## Sprint challenges & choices

1. **Gemma reliability** — empty/flaky responses → retries, backoff, shorter fallback prompt, plus a deterministic coach template so demos never end blank.  
2. **Demo vs sensors** — DeviceMotion + GPS speed-delta for braking/turns; Simulate Ride remains the reliable judge path.  
3. **Hallucination risk** — prompt constrained to logged events only.  
4. **Latency UX** — SSE keeps the post-ride screen responsive while analysis runs.

Rule-based live scoring was the right choice for a 1-day sprint: predictable demos, clear audit trail, and a clean handoff to Gemma for language and coaching.

## Limitations & safety

- Assistive prototype only — not emergency, medical, legal, or traffic-control advice.  
- Live scoring is rule-based; Real Ride uses GPS + DeviceMotion (with GPS speed-delta backup when motion permission is denied).  
- Urban ~50 km/h limit is a demo heuristic, not official regulation.  
- No auth / multi-user isolation yet.  
- Gemma tips are suggestions; riders remain responsible for safe operation.

## What’s next

Luganda / local-language coaching; association dashboards over anonymized trends; offline-friendly prompts; helmet / pre-ride checklist bots under Safer Rides.

---

**Vision:** every Kampala boda rider gets immediate feedback and a coach in their pocket — powered by open models, grounded in real ride data.
