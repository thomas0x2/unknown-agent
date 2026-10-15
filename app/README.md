# Unknown Agent — app (v2)

The rebuild on the mechanics spec: TypeScript + Vite + React, engine-first, Steam-ready later. The
original single-file prototype still lives in the repo root; this `app/` is the new track.

## Run

```bash
npm install
npm run dev        # game at http://localhost:5173
npm run proxy      # Jev backend on :8787 (optional; game falls back offline without it)
npm test           # engine unit tests (vitest)
npm run typecheck
npm run build
```

Set up Jev by copying `.env.example` to `.env` and adding `TYPESAFE_API_KEY`. The key is read only by
`server/jev-proxy.mjs`; the client talks to `/api/*`, never to TypeSafe directly.

## Shape

- **`src/engine/`** — the whole game as pure, framework-free TypeScript. No React, no DOM; everything
  returns a new `GameState`. This is where the mechanics live and what the tests cover.
  - `config.ts` — every tunable number from the spec, in one place.
  - `values.ts` / `state.ts` — the save object and its clamped meters.
  - `events.ts` / `effects.ts` — data-driven events, triggers, and the effect vocabulary.
  - `apps.ts` — templates, build/fix/deploy, nightly breaks, payday, strikes, churn.
  - `agent.ts` — auto-rolled levels, subscription + per-prompt/word charges, lock, misuse/leash.
  - `endings.ts` — guard endings + the day-21 finale, by priority.
  - `day.ts` — the morning → work → payday → rent → night loop.
  - `actions.ts` — player actions (post, reply, brief/build/fix, deploy) that route through Jev.
  - `jev.ts` — the Jev interface + an offline keyword fallback.
  - `save.ts` — persistence behind a swappable interface (localStorage now, Steam Cloud later).
- **`src/content/`** — content schema + loader. Content itself is JSON in `content/` (not written yet).
- **`src/sites/`**, **`src/game/`**, **`src/App.tsx`** — the fake-browser shell and site views.
- **`server/jev-proxy.mjs`** — the key-holding backend proxy.

## Status

Slice 1 (engine + browser shell) and the core mechanics from the spec are in and unit-tested. Story
content, richer site UIs, and the Jev model wiring come next. See the mechanics spec for the build
order.
