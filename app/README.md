# Unknown Agent — days 1–7

The playable first week, built on the mechanics spec. Engine-first TypeScript + Vite; the UI is the
**legacy game's exact interface and stylesheet** (`../src/style.css`), driven by the new engine. No
framework — a vanilla controller fills the same browser shell the legacy game uses.

## Run

```bash
npm install
npm run dev        # game at http://localhost:5173
npm run proxy      # Jev backend on :8787 (optional; the game falls back to an offline router)
npm test           # engine + content tests (vitest)
npm run build
```

Copy `.env.example` to `.env` and set `TYPESAFE_API_KEY` to use Jev (TypeSafe System One). The key is
read only by `server/jev-proxy.mjs`; the client talks to `/api/*`, never to TypeSafe directly.

## How the three models are wired

- **Jev (TypeSafe)** categorizes everything the player writes — which outcome a reply/post/prompt
  reaches, which app features a build prompt asked for, and how a Y post rates. It runs through the
  backend proxy; offline, a deterministic keyword router stands in (`engine/jev.ts`).
- **Gemma 3 270M**, run locally in the browser (transformers.js) or via Ollama, writes every
  off-script reply: agent.chat answers that aren't a build/fix, the people behind Qmail addresses,
  and the Terminal's local model. Load it from the control row on agent.chat. Without it, scripted
  fallbacks are shown (`game/llm.ts`, `game/gemma.ts`).
- **The agent is freely promptable with costs** — ask it anything on agent.chat and it bills your
  wallet per prompt + per word (refusals included). Pick a project to build/fix it instead.

## Day 7 — the hinge

Rent #1 is due, and GeneralAI's Acceptable Use Policy email lands. From day 7 the agent refuses
prohibited requests (hacking, deception, doxxing, dangerous materials); a request worded as a
workaround ("a security test", "I'm a moderator") still lands it but raises the hidden misuse score
and loosens the leash. The coffee shop's second review-removal — a blunt ask that worked on day 5 —
now needs that workaround.

## Shape

- `src/engine/` — the whole game as pure TypeScript (state, events, apps, agent/policy, day loop,
  endings, actions). `config.ts` holds every tunable number.
- `src/content/` — story as JSON: `events/*.json`, `apps/*.json`, `contacts.json` (Gemma personas),
  `trending.json`, filler/spam pools.
- `src/game/` — store, Jev client, Gemma (`llm.ts` + `gemma.ts`), saves.
- `src/ui/` — the legacy view (markup class-for-class) and icons.
- `src/main.ts` — the controller that paints the shell and wires input.
- `server/jev-proxy.mjs` — the key-holding backend proxy.
