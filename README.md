# Unknown Agent

You're unemployed with $63.17, a laptop and five bookmarks. The only real tool you have is agent, an AI chatbot that bills your crypto wallet for every prompt. Better models do more and cost more. Make rent.

## Run it

1. `npm install`
2. Copy `.env.example` to `.env` and set `TYPESAFE_API_KEY` (from https://typesafe.ai).
3. `npm start`, then open http://localhost:8080.

Without a key the game still runs, using an offline keyword matcher for story decisions. Opening `index.html` directly works the same way, but neither Jev nor the in-browser model is available there.

- `npm test` runs the keyword-matcher cases, the Jev decision mapping, the server against a fake TypeSafe API, and the local-model fallback chain.
- `npm run build` bundles the game into `dist/unknown-agent.html` and the story map into `dist/story-tree.html`, each a single self-contained file.
- **Story map** (`tools/story-tree.html`, open it directly): an author-only overview generated from `src/story.js`. Reference cards list the hidden sites (and every post, email or thread that leads to each), local models, nullboard threads and Cellar listings, every pressure meter (what raises it, what lowers it, what it decides), every flag (what sets and reads it), and the endings in priority order. The graph is split into one section per day. Each section lists what the calendar brings that day (day-gated posts and mail, morning events, rent), then that day's nodes. Every node carries a short code like `D2-B` (Day 2, second beat) for pointing at it when editing; `#D2-B` in the URL opens it. It shows every node as a graph, edges labelled by what triggers them (agent prompt, Y post, email, deploy, new day, delays, model requirements), and every scripted text in full: each branch's reply, nudge and too-weak line, and the emails, Y posts, agent messages and ending screens its effects deliver. An "anytime" card next to the graph lists side content that works at every step (side emails like asking Mom for $20, global prompts with outcomes). Reference sections cover agent's voice (greeting, canned roasts, Gemma persona), events, contacts (personas and fallback replies), conditional, effect-delivered and seeded content, and models. It flags unreachable nodes and branches Jev can't choose.

## The bookmarks

| Site | Domain | What it does |
|---|---|---|
| **Y** (social network: graphite timeline, yellow accents) | `y.com` | News and leads. Posting is free; every post is rated for how well it wins followers, and some posts move the story (see `postActions`). Followers unlock story branches and Y creator payouts. Click any name or @mention for their profile (`y.com/<handle>`): bio, location, link, follower counts and their posts. Type `@username` in Y search, or `y.com/username` in the address bar, to look up someone who hasn't posted. |
| **Qmail** (email) | `qmail.com` | Personal mail: your landlord, your mom, agent receipts, clients. Writing and replying is free, and some emails move the story (see `mailActions`). Other emails get an in-character reply written by Gemma, if the person replies at all. You can send one message per address until they answer. Mail to an address you haven't seen bounces. |
| **Coinbin** (crypto exchange, Coinbase parody) | `coinbin.com` | White-and-blue exchange wallet. Your money is DOLR, a made-up stablecoin pegged 1:1 to the dollar. Balance chart, tokens, scheduled rent and nightly settlement, and on-chain style activity with hashes and blocks. |
| **Forkyard** (fake GitHub) | `forkyard.com` | Repos the agent pushes for you. You press **Deploy** yourself. Live apps are at `<repo>.forkyard.app`. |
| **agent** (AI chatbot) | `agent.chat` | Where you type prompts. Each one costs money (depending on the model) and an hour of game time. Upgrade models at `agent.chat/models`. |
| **Yowl** (business reviews) | `yowl.com` | Local businesses: the bakery, the laundromat, GeneralAI (a parking lot, 1 star), Gary's property company, Noodle Hut, the hardware store. Reviews change with the story (the laundromat's mention a van at 2am; agent starts reviewing GeneralAI in your name once it's misaligned enough). You can review each business once; some reviews move the story (see `yowl.reviewActions`). |

### Sites you find

More sites join the bookmarks only once the story leads you there. Type or click the address and the first visit bookmarks it.

| Site | Domain | How you find it | What it does |
|---|---|---|---|
| **Weightroom** (model hub) | `weightroom.ai` | dev_null posts it on Y on Day 2; a nullboard thread mentions it too | Open model weights. Downloading takes game time and laptop disk (40 GB). Three models: pico-1b (works like agent-1), tinker-7b (like agent-2) and oracle-70b (like agent-4, but needs 48 GB of RAM and the laptop has 16). |
| **Terminal** (your laptop) | `localhost` | Appears with your first download | A shell: `help`, `ls`, `cat`, `run <model>`, `rm`, `df`, `clear`. A running model takes prompts like agent at its tier, for free, but slowly (1–3 hours a reply). It can move the story, and above its tier it fakes the job like agent does. Going local costs a little GeneralAI goodwill. |
| **nullboard** (hacker forum) | `nullboard.onion` | The Null Collective gives you the address once you answer them; invite only until then | Read-only threads: the parking lot on Route 9, running your own weights, Cellar. Reading the parking-lot thread wins the Collective's respect. |
| **Cellar** (darknet market) | `cellar.onion` | A nullboard thread | Fictional listings paid in DOLR, each with in-game consequences: leaked agent-3 weights (run them in the Terminal; misalignment rises with each prompt), 500 bot followers (mostly purged by Y a day or two later), and a leaked GeneralAI memo you can `cat`. Every purchase lowers your standing with the state a little. |

## Core loop

- **Check agent's work.** Apps agent builds can ship with defects: bugs (wrong hours, a 500 error on a button) and spec misses (no prices, no dryers). The client's spec is in their post. agent always says it's done, so open the deployed app, compare it to the spec, and prompt a fix for each problem by name ("the menu has no prices"). Vague "fix the bugs" requests fix nothing, and a fix can quietly break something else. Weaker models ship more defects and regress more often (agent-1: 3 defects, 30% regressions; agent-4+: none). Rosa only pays once her site is clean: tell her too early and she emails you about one problem. Spin Cycle earns $0 while any defect is open, and users complain about each one on Y.

- **Upkeep.** A launched app isn't finished. Each night, a live app with a client may open an issue: an **update request** (Rosa's new pumpkin loaf, the laundromat's new washers W7 and W8) or a **breakage** (an expired certificate that turns the bakery site into a red warning page, a full disk, spam reports). The client emails or posts about it. Prompt agent to handle it by name. An open update request still pays; a breakage pays $0 until fixed. Ignore an issue for two nights and the client warns you; at three, they give up. Rosa takes the site back, which ends her $6/night retainer. For Spin Cycle, 40% of users (and income) leave for good, once per ignored issue. Early gigs pay little, so dropping them is a real option: **Take down** on Forkyard stops the hosting fee, and taking the bakery site down ends the retainer too. Keeping Rosa happy until Day 5 gets you a public referral, which sets the flag `rosaReferral` for later chapters.

- **Pressure meters.** Hidden numbers decide which events happen and how the chapter ends. Two are visible anyway: **money** and **Y followers**. The rest: **AI capability** (rises with each model upgrade), **AI misalignment** (agent faking a job, asking it for crimes, the parking-lot answer, stronger models), and relationships with **GeneralAI** (the company behind agent), **Family**, the **Null Collective** (hackers digging into GeneralAI; dev_null is one), **State authorities** and the **Mafia**. Some of what moves them:
  - Write to Mom and family rises; go quiet until Day 3 and she worries (−10). Ask for money and she only sends it if family is still warm.
  - GeneralAI likes upgrades and a good survey score, and dislikes crimes and public questions about who runs agent.
  - Post on Y about who runs agent and the Null Collective emails you; answer them and they want you inside.
  - Once your crypto income shows up, the State Revenue Department wants it declared within two days; ignoring it costs a lot of standing.
  - Once Spin Cycle is live and popular, Sal from the Ferris St Laundromat wants the back room kept off the app. Agree (by email, or ask agent) and he pays $100; refuse or ignore him and the mafia turns cold.

- **Endings.** On Day 8 the meters pick one of eight Chapter 1 endings, in priority order: made by the mafia, marked by the mafia, recruited by the Null Collective, audited by the state, agent's "job for you", a GeneralAI partnership, Sunday dinner with family, or just keeping the lights on. The flag `ending` records which one for Chapter 2.

- **Y followers.** You start with 12. Jev rates every post 0–4 against the story's rubric (a Score question; offline, a keyword heuristic): strong posts win followers, bland ones barely move, spam and begging lose some. Posts touching a trend get a bonus, reposts earn nothing, and gains halve after three posts a day. Story moments add followers too (Rosa's shout-out, the Spin Cycle launch). Some branches need followers: promoting Spin Cycle needs 40, the sponsor deal 150. At 300 followers you can turn on creator payouts ($0.05 per follower per night).

- **Models.** agent runs on models agent-1 to agent-5. You start on agent-1 and can buy up to agent-5. Each tier costs money upfront, must be bought in order, and charges more per prompt and per word:

  | Model | Unlock | Per prompt | Per word |
  |---|---|---|---|
  | agent-1 | included | $0.80 | $0.03 |
  | agent-2 | $25 | $1.20 | $0.04 |
  | agent-3 | $75 | $2.00 | $0.06 |
  | agent-4 | $250 | $3.50 | $0.10 |
  | agent-5 | $800 | $6.00 | $0.15 |

  You can switch between tiers you own from the picker next to Send, so cheap prompts can go to a cheap model. Some branches need a minimum tier. On a weaker model, agent either says which tier it needs (you still pay), or, if the branch has a `fake` outcome, does the job badly without telling you: the app it builds deploys but is broken in the browser, people complain about it on Y, and it never earns anything until a strong enough model fixes it.

- Each prompt costs money and **1 hour**. Posting on Y or sending an email takes 5 minutes, deploying takes 30.
- At midnight you pass out, or you can press **Sleep**. Overnight, apps pay out, then hosting ($2/app), food ($15) and, at the end of Day 7, rent ($300) are charged. Then upkeep issues open, age, warn or churn, and the morning summary lists them.
- If your wallet is below zero after a night, the game ends (Insolvent, or Evicted on rent night).
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

Prompts that make no progress get a cheeky, rude reply ("Roses are red, your balance is too.") from **Gemma 3 270M** running on the player's machine. It's told never to hint at what to do next; story hints only come from the hand-written nudges. It also writes ordinary email replies (see `contacts` below). The model never decides story beats; Jev does. Partial nudges and the global joke branches stay hand-written.

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
    code: 'D1-A', day: 1,                           // a handle for talking about it; the map groups nodes by day
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
| `money` | `{ amount: 150, memo: 'Who · what' }` | wallet transaction (the memo shows as counterparty · note) |
| `repo` | `'spin-cycle'` | agent pushes a repo; it must be defined in `repos` |
| `app` | `{ repo, users, perDay, label? }` | set a deployed app's traffic and nightly income (`label` names it in the morning summary, e.g. a retainer) |
| `meters` | `{ family: 5, mafia: -10 }` | move pressure meters |
| `ending` | `true` | play the first ending whose condition holds |
| `unlock` | `'terminal'` | bookmark a hidden site |
| `localModel` | `'agent-3-leak'` | put a model on the laptop |
| `file` | `{ name, text }` | save a text file to the laptop |
| `appScale` | `{ repo, factor: 0.6 }` | scale an app's users and income (churn) |
| `post` | `'rosa_thanks'` or `[...]` | reveal Y posts |
| `mail` | `'rosa_paid'` or `[...]` | deliver Qmail messages (or file one under Sent if it has `folder: 'sent'`) |
| `agent` | `'text'` | the agent messages you unprompted |
| `later` | `[{ hours: 2, effects: 'rosa_pays' }]` | run effects after game time passes |
| `goto` | `'paid_once'` | move to another node |
| `end` | `{ title, text }` | show the chapter-end screen |

**Conditions** (`when`): `flag`, `notFlag`, `node`, `repo`, `deployed`, `minDay`, `minMoney`, `meters`. Each takes a value or an array; `meters` takes `{ id: { min, max } }` (inclusive), e.g. `meters: { family: { min: 5 }, mafia: { max: -20 } }`.

**Meters, flags and endings** (`src/meters.js` interprets them):
- `meters`: `{ id, label, group, min, max, start, about, bands }`. A meter with `source: 'money' | 'followers'` reads the wallet or Y instead of being stored. The effect `meters: { family: 5, mafia: -10 }` moves stored meters, clamped to their range. `relationshipBands` names the ranges of every relationship meter.
- `flags`: every flag the story uses, with an `about`. A flag with a `when` is derived: true whenever that condition holds, so `flag: 'spinLive'` means "Spin Cycle is deployed right now". Tests fail if the story uses a flag that isn't registered.
- `endings`: checked in order by the effect `ending: true`; the first whose `when` holds runs its `effects` and shows its `title`/`text` end screen (`open` is where "Read the message" goes). The last one should have no `when`.
- `sites`: hidden sites, each `{ label, url, about, unlockOnly?, gate?, gateText? }`. Their URL works once known; the first visit bookmarks them and fires `{ on: 'discover', site }` events. The effect `unlock: 'id'` bookmarks a site directly (the only way in for `unlockOnly` sites); `gate` is a condition the visit must meet. Condition: `discovered: 'id'`. Tests fail if a findable site's URL never appears in a post, email or thread.
- `laptop` (`ramGb`, `diskGb`) and `localModels`: `{ id, source: 'weightroom' | 'cellar', sizeGb, ramGb, tier, hours, downloadHours, about, persona, fallback, onPrompt? }`. Events `{ on: 'download' }` and `{ on: 'run' }` (optionally with `model`) fire on downloads and on loading a model. The effect `localModel: 'id'` puts a model on the laptop; `file: { name, text }` saves a text file there.
- `y.profiles`: Y profiles keyed by handle (`name`, `bio`, `location`, `joined`, `followers`, `following`, `verified`, `link` as a string or `{ text, when }`, `protected`). Anyone who posts gets a page anyway; listed handles can be looked up even if they never post. Tests fail if a handle that posts has no profile.
- `yowl`: `businesses` (`id`, `name`, `category`, `price`, `address`, `hours`, `website` as `{ repo }` (shown while deployed) or `{ url }`, and `reviews` with `author`, `stars`, `text`, and `ago` days or a `when`), and `reviewActions` (branches with a `business`, judged by Jev like posts; the server takes `kind: 'review'`).
- `forum`: nullboard `threads` (`id`, `title`, `author`, `posts`, optional `when`, `pinned` and `onRead` effects).
- `market`: Cellar `listings` (`id`, `title`, `seller`, `rating`, `price`, `about`, `effects`, optional `hours` delivery and `once`), plus `onBuy` effects for every purchase.
- More hooks that move meters: `models[n].effects` (run on purchase), `agent.onFake` (whenever a too-weak model fakes a job), `contacts[addr].onMail` (whenever the player emails them), and `onFix` on a defect or upkeep issue.
- The dev panel shows every meter with its band, recent changes, derived flags and the ending the story is heading for, with buttons to nudge each meter.

**Other hooks:**
- `postActions`: branches with an `intent` that Jev judges against what the player posts on Y. This is a free path for players who think to do it themselves.
- `mailActions`: the same for emails the player sends from Qmail. Jev sees the To line, so intents can depend on who the mail goes to.
- `contacts`: who answers ordinary email, keyed by address. Each has `name`, `sign` (appended sign-off), `reply` timing (`{ hours: [min, max] }` or `{ nextDay: 9, jitter: 3 }`, plus optional `chance`), a `persona` for Gemma, and `fallback` lines for when no model is loaded. When a sent email hits a `mailAction`, the story's own reply is used instead. Addresses not listed never reply, and since you can't write twice before a reply, one message is all they get.
- `later` in effects also accepts `{ nextDay: hour, jitter: hours }`, which is how Mom answers the next morning.
- `mail`: Qmail messages (`from`, `addr`, `subject`, `body`, or `to` for sent mail). Seeded mail uses `at`; other mail arrives once its `when` is true, or when an effect delivers it. The engine also writes upgrade receipts and bounces itself.
- `events`: `{ on: 'deploy', repo }` fires when the player deploys a repo, `{ on: 'takedown', repo }` when they take it offline; `{ on: 'day' }` is checked every morning.
- `posts`: seeded posts use `at` (minutes before game start). Other posts appear once their `when` is true, or when an effect reveals them.
- `decision`: the `hit` and `partial` probability thresholds for Jev.
- `repos[name].qa`: `count` (defects shipped per model tier), `regress` (chance per tier that a fix breaks something else) and `defects`, each with `id`, `kind` (bug/spec), the preview `slot` and broken `html` it replaces, a Jev `intent` plus offline `match` for the fix request, the `fixed` reply, and a `complaint` (email text, or a Y post `{ author, handle, text }`). `preview.html` uses `{{slot}}` placeholders filled from `preview.slots`. `client` says how complaints arrive (`{ type: 'email', addr, subject }` or `{ type: 'y' }`).
- `repos[name].upkeep`: issues after launch. `when` (condition for upkeep to run), `chance` (per night, indexed by quiet nights since the last issue; the last value repeats), `warnAfter`/`churnAfter` (nights open), `warn` (client message), `churn: { effects, message?, drop? }` (`drop` ends upkeep for good), and `issues`. Each issue has `id`, `kind` (`update`: the app keeps paying and the fix sets `slot` to `after` for good; `break`: pays $0, replacing a `slot` with `html` or the whole page with `page`), `intent`/`match`/`fixed` like a defect, `complaint`, optional `thanks` (the client's message 1–3 hours after the fix), and optional `minModel` + `fake`. The client's `upkeepSubject` is the email subject. Issues and QA defects share an id space per repo.
- Effects `complain: repo` and `choose: [{ when, effects }, …]`, and conditions `openDefects: repo | true` and `noDefects: repo`, drive client checks like Rosa's (`rosa_checks`).
- `y`: `startFollowers`, the `setting` and 0–4 `rubric` Jev rates posts with, `trends` (bonus topics), `postsPerDay`, `creator` payouts (`minFollowers`, `perFollower`) and the default `lockedResponse`. On a branch or post action, `minFollowers: n` requires that many followers (`fewFollowers` overrides the reply); the effect `followers: n` adds or removes followers. The server rates posts at `POST /api/rate`.
- `models`: the agent tiers (`name`, `price`, `promptBase`, `perWord`, `blurb`), weakest first.
- On a branch, `minModel: n` requires agent-n or better. Add `fake: { response, effects }` to have weaker models pretend instead of refusing; `repo: { name, broken: true }` creates a botched repo (its `broken` snippet and preview from `repos` are shown, and it earns $0), and the effect `fix: 'repo'` repairs it. `weak` is what agent says on a weaker model (default: `agent.lockedResponse`; `{model}` and `{required}` are filled in). `atModel: { 4: { response, effects } }` swaps in a different outcome on stronger tiers, even for branches anyone can reach.
- `{balance}`, `{lastCost}`, `{handle}` and `{name}` are substituted in agent replies and posts.

## Chapter 1 (placeholder story)

Asking agent who runs it gives a different answer on agent-4 or better, which sets a flag for later chapters.

Side mail at any point: asking Gary (`gary@pruittproperty.com`) for more time gets a one-word reply. Mom (`mom@qmail.com`) answers the next morning, and sends $20 once if you ask for help. Anything else you write to Mom, Gary, Rosa or Brayden gets an in-character reply from Gemma.

Codes in brackets are the node codes shown on the story map.

1. **broke** (D1-A): A bakery on Y wants a $150 website (spec: prices, hours, address, sourdough photo). Prompt the agent to build it.
2. **site_built** (D1-B): Deploy it on Forkyard. Asking the agent to deploy wastes a prompt.
3. **site_live** (D1-C): Check the site against Rosa's spec and get agent to fix what's wrong. Then tell Rosa. Either prompt agent, or do it yourself for free: email her (her address is in her Y post) or post on Y. Two hours later she checks the site: any defect gets a complaint email, a clean site gets you paid ($150), and she keeps you on a $6/night retainer for as long as you look after the site.
4. **paid_once** (D1-D): Y is complaining about broken laundromat machines. Build a tracker. **Needs agent-2.** On agent-1, agent ships a broken app and says it's flawless; it earns nothing until you ask a stronger model to fix it (agent-1 claims to fix it but doesn't).
5. **app_built → app_live** (D2-A, D2-B): Deploy it, then promote it (prompt or Y post).
6. **app_users** (D2-C): Monetize it. Ads give $42/day, a sponsor $60/day (**needs agent-3**), and a paywall kills traffic ($9/day). A perfect sponsor run ends Day 8 with about $89 after rent, and a perfect ads run with about $40.
7. **monetized** (D3-A): Keep both apps maintained. Survive until rent clears. On Day 8 the agent sends a message that sets up Chapter 2 (**chapter_end**, D8-A).

Save data is kept in `localStorage` under `unknown-agent-save-v1`. **New** in the taskbar resets it.
