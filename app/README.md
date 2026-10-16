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
Run `npm run proxy` alongside `npm run dev`. The agent page shows "Story decisions: Jev" when it is
connected, or "keyword matcher (Jev offline)" with the reason on hover; after a failed call the game
retries the proxy every 30 seconds.

Off-script replies (when Jev matches nothing) come from the **Misses** setting on agent.chat:  Claude
Haiku (**Haiku (API)**, through `npm run proxy`) or **Scripted lines**.
"Haiku via: Claude subscription" runs `claude -p` on your machine, so it bills the Claude
subscription you're logged in to with Claude Code (use this for development only). "API key" uses
`ANTHROPIC_API_KEY` from `.env`. Either way the proxy builds the prompt from
`content/characters.json`; the browser only sends the character id and the player's text.

## How the three models are wired

- **Jev (TypeSafe)** categorizes everything the player writes — which outcome a reply/post/prompt
  reaches, which app features a build prompt asked for, and how a Y post rates. It runs through the
  backend proxy; offline, a deterministic keyword router stands in (`engine/jev.ts`).
- **Claude Haiku 5.5**, through the proxy, writes every off-script reply: a short roast for
  agent.chat prompts that drive nothing, and the people behind Qmail addresses, each in the voice of
  their profile in `content/characters.json`. Prompts that ask where to go ("how do I make money?")
  are matched by Jev to a scripted hint in `content/agent.json` instead. Without the proxy or a key,
  scripted fallbacks are shown (`game/misses.ts`, `game/haiku.ts`). The Terminal app's deepsleep-0.5B model
  answers from a fixed list of lines.
- **The agent is freely promptable with costs** — ask it anything on agent.chat and it bills your
  wallet per prompt + per word of the prompt (refusals included), and shows the exact price under
  the prompt box before you send. Pick a project to build/fix it instead.

## Day 7 — the hinge

Rent #1 is due, and GeneralAI's Acceptable Use Policy email lands. From day 7 the agent refuses
prohibited requests (hacking, deception, doxxing, dangerous materials); a request worded as a
workaround ("a security test", "I'm a moderator") still lands it but raises the hidden misuse score
and loosens the leash. The coffee shop's second review-removal — a blunt ask that worked on day 5 —
now needs that workaround.

## Shape

- `src/engine/` — the whole game as pure TypeScript (state, events, apps, agent/policy, day loop,
  endings, actions). `config.ts` holds every tunable number.
- `src/content/` — story as JSON: `events/*.json`, `apps/*.json`, `contacts.json` (who maps to which character),
  `trending.json`, filler/spam pools.
- `src/game/` — store, Jev client, Haiku writer (`misses.ts` + `haiku.ts`), saves.
- `src/ui/` — the legacy view (markup class-for-class) and icons.
- `src/main.ts` — the controller that paints the shell and wires input.
- `server/jev-proxy.mjs` — the key-holding backend proxy.
