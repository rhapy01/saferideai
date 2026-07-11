# SafeRide AI

Boda safety coach for Kampala — Hack 4 Bodas / Build with Gemma Uganda.

## Demo flow

1. **Simulate Ride** (Makerere → Nakawa)
2. Live safety score, risk events, map markers
3. **Gemma 4** post-ride coaching report (`gemma-4-26b-a4b-it`)

## Stack

- React + Vite frontend (`artifacts/saferide`)
- Express API (`artifacts/api-server`)
- Neon Postgres + Drizzle
- Gemma 4 via Google AI Studio (`@google/genai`)

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL, GOOGLE_API_KEY, GEMMA_MODEL=gemma-4-26b-a4b-it

pnpm install
pnpm --filter @workspace/db exec drizzle-kit push --force

# terminal 1 — API (port 8787 locally)
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start

# terminal 2 — UI
pnpm --filter @workspace/saferide run dev
```

Open http://localhost:5173 → Simulate Ride.

## Env

See `.env.example`. Never commit `.env`.
