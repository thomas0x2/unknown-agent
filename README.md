# Unknown Agent

You're unemployed with $63.17, a laptop and four bookmarks. The only real tool you have is GIT, an AI chatbot that bills your bank account for every prompt. Better models do more and cost more. Make rent.

## Run it

1. `npm install`
2. Copy `.env.example` to `.env` and set `TYPESAFE_API_KEY` (from https://typesafe.ai).
3. `npm start`, then open http://localhost:8080.

Without a key the game still runs, using an offline keyword matcher for story decisions. Opening `index.html` directly works the same way, but neither Jev nor the in-browser model is available there.

- `npm test` runs the keyword-matcher cases, the Jev decision mapping, the server against a fake TypeSafe API, and the local-model fallback chain.
- `npm run build` bundles everything into `dist/unknown-agent.html`, a single self-contained file.

## The four bookmarks

| Site | Domain | What it does |
|---|---|---|
| **Y** (fake Twitter) | `y.com` | News and leads. You can post for free, and some posts move the story (see `postActions`). |
| **Qmail** (email) | `qmail.com` | Personal mail: your landlord, your mom, GIT receipts, clients. Writing and replying is free, and some emails move the story (see `mailActions`). Mail to an address you haven't seen bounces. |
| **Second National** (bank) | `secondnational.com` | Balance, every transaction, rent countdown, the nightly forecast. |
| **Forkyard** (fake GitHub) | `forkyard.com` | Repos the agent pushes for you. You press **Deploy** yourself. Live apps are at `<repo>.forkyard.app`. |
| **GIT** (AI chatbot) | `askgit.ai` | Where you type prompts. Each one costs money (depending on the model) and an hour of game time. Upgrade models at `askgit.ai/models`. |

## Core loop

- **GIT models.** You start on GIT-1 and can buy up to GIT-5. Each tier costs money upfront, must be bought in order, and charges more per prompt and per word:

  | Model | Unlock | Per prompt | Per word |
  |---|---|---|---|
  | GIT-1 | included | $0.80 | $0.03 |
  | GIT-2 | $25 | $1.20 | $0.04 |
  | GIT-3 | $75 | $2.00 | $0.06 |
  | GIT-4 | $250 | $3.50 | $0.10 |
  | GIT-5 | $800 | $6.00 | $0.15 |

  You can switch between tiers you own from the picker next to Send, so cheap prompts can go to a cheap model. Some branches need a minimum tier. Ask for one on a weaker model and you pay for the prompt, nothing happens, and GIT tells you which tier it needs.

- Each prompt costs money and **1 hour**. Posting on Y or sending an email takes 5 minutes, deploying takes 30.
- At midnight you pass out, or you can press **Sleep**. Overnight, apps pay out, then hosting ($2/app), food ($15) and, at the end of Day 7, rent ($300) are charged.
- If your balance is below zero after a night, the game ends (Overdrawn, or Evicted on rent night).
- If you can't afford a prompt, the card is declined and nothing is charged.

## Jev: how prompts move the story

[Jev](https://typesafe.ai) is TypeSafe's System One model: it returns typed decisions with probabilities instead of generated text. For every prompt (and every Y post or Qmail email that could matter), the game asks Jev one **Choice** question:

- **State:** a short description of the game, the current node's `scene`, and the player's prompt (or post, or email with its To and Subject lines).
- **Options:** every branch available right now (the node's branches whose `when` holds, plus the global ones), each described by its `intent`, plus `no_progress`.

Jev returns a probability for each option, and the story's `decision` thresholds turn them into an outcome:

| Result | When | What happens |
|---|---|---|
| **hit** | the top branch has at least `decision.hit` (0.5) | the branch's `response` is shown and its `effects` run |
| **partial** | otherwise, a branch with a `partial` nudge has at least `decision.partial` (0.2) | the nudge ("Build what, for whom?"). You still pay. |
| **miss** | no progress | Gemma 3 270M answers, if it's loaded; otherwise a canned placeholder. You still pay. |

How it's wired:
- `server.mjs` holds the API key and calls Jev through `@typesafe-ai/sdk` (pinned to 0.6.0). The page sends only the prompt, the node and the candidate branch ids. The server looks those up in `story.js` and writes the question itself, so it can't be used to send arbitrary questions on your key.
- `src/jev.js` in the page calls `/api/decide` and applies the thresholds. If a call fails, that one decision falls back to the keyword matcher, and the game keeps going.
- Only branches available in the current node are offered, so Jev can't skip ahead in the tree. Writing a good `intent` matters most. Say what the player has to ask for, including any detail that's required (for example, "must make clear the site is for that bakery").
- The thresholds are starting values. Tune them with real prompts in the debugger.

### Offline keyword matcher (`src/keywords.js`)

Used when there's no Jev server (no key, `index.html` opened directly, the published claude.ai page). It scores the prompt against each branch's `match` rules: every `all` group matched is a hit, at least half is a partial, otherwise a miss.

Matching uses light stemming (`websites` matches `website`, `building` matches `build`) and tolerates one typo in words of 5 or more letters (`webiste`). A keyword with a space is a phrase. A keyword written `/like this/` is a regex. When several branches fully match, the highest score wins: 10 per matched `all` group, +1 per `any` hit, plus the branch's `priority`.

## Local model for off-script replies (`src/llm.js`)

Prompts that make no progress are answered by **Gemma 3 270M** running on the player's machine. The model never decides story beats; Jev does. Partial nudges and the global joke branches stay hand-written.

Pick the backend from the **Off-script replies** menu at the top of the agent page:

| Backend | How it runs | Setup |
|---|---|---|
| **In browser** (default) | transformers.js 4.2.0 in a Web Worker, on WebGPU if available, otherwise WASM. Loads `onnx-community/gemma-3-270m-it-ONNX`, trying the smallest weights first (`q4f16`/`q4`, then `q8`, then `fp32`). | Press **Load model**. The weights download once from Hugging Face (a few hundred MB) and load from the browser cache after that. |
| **Ollama** | `POST /api/chat` to `http://localhost:11434` with `gemma3:270m`. | `ollama pull gemma3:270m`, and keep `ollama serve` running. |
| **Canned placeholders** | No model. Uses `placeholders` from `story.js`. | None. |

- The model's tone comes from `agent.llmPersona` and the few-shot `agent.llmExamples` in `story.js`, plus the player's balance.
- Output is trimmed to two plain sentences. Markdown, role prefixes and half-finished sentences are removed.
- If the model is off, still downloading, errors, returns nothing usable, or takes over 25 seconds, the reply falls back to a placeholder. The game never waits on a download.
- Replies from the model are labeled "Gemma 3 270M" in the chat. With the debugger open they're tagged `miss:llm`, and fallbacks are tagged `miss:placeholder`.
- Once a backend has loaded successfully, it reconnects automatically on the next visit.
- The published claude.ai page can't reach Hugging Face or the CDN, so there the model shows an error and the game uses placeholders. Play locally to use Gemma.

### Story debugger

Press **jev** in the taskbar, or Ctrl+\`, or open with `#dev` in the URL. It shows the current node, flags, queued events, whether decisions come from Jev or the keyword matcher, and local-model status. For the last prompt, post or email it shows Jev's probability for every option (or the keyword scores when offline), plus the model and latency. You can also jump nodes, add money and skip time. With it open, each agent reply is tagged `hit:<id>`, `partial:<id>`, `miss:llm` or `miss:placeholder`.

## Writing story (`src/story.js`)

```js
nodes: {
  broke: {
    objective: 'Find a way to make some money.',   // shown on the sticky note
    scene: 'What the player knows right now…',     // given to Jev as the situation
    branches: [{
      id: 'build_bakery_site',
      intent: 'The player asks the agent to build a website for the Crumb & Coin bakery…',  // what Jev judges
      when: { notFlag: 'x' },                       // optional condition
      match: { all: [[...verbs], [...things], [...topic]], any: [...], none: [...] },  // offline fallback only
      partial: 'nudge when half-right',
      response: 'what the agent says on a hit',
      effects: { repo: 'crumb-and-coin', goto: 'site_built' },
    }],
  },
}
```

**Effects** (an object, or the name of a reusable entry in `bundles`):

| Key | Example | Meaning |
|---|---|---|
| `set` | `{ invoiced: true }` | set flags |
| `money` | `{ amount: 150, memo: '...' }` | bank transaction |
| `repo` | `'spin-cycle'` | agent pushes a repo; it must be defined in `repos` |
| `app` | `{ repo, users, perDay }` | set a deployed app's traffic and nightly income |
| `post` | `'rosa_thanks'` or `[...]` | reveal Y posts |
| `mail` | `'rosa_paid'` or `[...]` | deliver Qmail messages (or file one under Sent if it has `folder: 'sent'`) |
| `agent` | `'text'` | the agent messages you unprompted |
| `later` | `[{ hours: 2, effects: 'rosa_pays' }]` | run effects after game time passes |
| `goto` | `'paid_once'` | move to another node |
| `end` | `{ title, text }` | show the chapter-end screen |

**Conditions** (`when`): `flag`, `notFlag`, `node`, `repo`, `deployed`, `minDay`, `minMoney`. Each takes a value or an array.

**Other hooks:**
- `postActions`: branches with an `intent` that Jev judges against what the player posts on Y. This is a free path for players who think to do it themselves.
- `mailActions`: the same for emails the player sends from Qmail. Jev sees the To line, so intents can depend on who the mail goes to.
- `mail`: Qmail messages (`from`, `addr`, `subject`, `body`, or `to` for sent mail). Seeded mail uses `at`; other mail arrives once its `when` is true, or when an effect delivers it. The engine also writes upgrade receipts and bounces itself.
- `events`: `{ on: 'deploy', repo }` fires when the player deploys a repo; `{ on: 'day' }` is checked every morning.
- `posts`: seeded posts use `at` (minutes before game start). Other posts appear once their `when` is true, or when an effect reveals them.
- `decision`: the `hit` and `partial` probability thresholds for Jev.
- `models`: the GIT tiers (`name`, `price`, `promptBase`, `perWord`, `blurb`), weakest first.
- On a branch, `minModel: n` requires GIT-n or better. `weak` is what GIT says on a weaker model (default: `agent.lockedResponse`; `{model}` and `{required}` are filled in). `atModel: { 4: { response, effects } }` swaps in a different outcome on stronger tiers, even for branches anyone can reach.
- `{balance}`, `{lastCost}`, `{handle}` and `{name}` are substituted in agent replies and posts.

## Chapter 1 (placeholder story)

Asking GIT who runs it gives a different answer on GIT-4 or better, which sets a flag for later chapters.

Side mail at any point: asking Gary (`gary@pruittproperty.com`) for more time gets a one-word reply. Writing to Mom (`mom@qmail.com`) gets a reply, plus $20 if you ask for help (once).

1. **broke**: A bakery on Y wants a $150 website. Prompt the agent to build it.
2. **site_built**: Deploy it on Forkyard. Asking the agent to deploy wastes a prompt.
3. **site_live**: Tell Rosa. Either prompt GIT, or do it yourself for free: email her (her address is in her Y post) or post on Y. She pays 2 hours later.
4. **paid_once**: Y is complaining about broken laundromat machines. Build a tracker. **Needs GIT-2.**
5. **app_built → app_live**: Deploy it, then promote it (prompt or Y post).
6. **app_users**: Monetize it. Ads give $42/day, a sponsor $60/day (**needs GIT-3**), and a paywall kills traffic ($9/day). A perfect sponsor run ends Day 8 with about $89 after rent, and a perfect ads run with about $40.
7. **monetized**: Survive until rent clears. On Day 8 the agent sends a message that sets up Chapter 2.

Save data is kept in `localStorage` under `unknown-agent-save-v1`. **New** in the taskbar resets it.
