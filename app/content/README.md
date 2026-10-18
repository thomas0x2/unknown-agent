# Content

Story content lives here as data; the engine (in `src/engine`) only interprets it. Nothing in this
folder is wired yet — the mechanics were built first, on purpose. Writers add files here without
touching engine code.

- `events/*.json` — one `GameEvent` per file (see `src/content/schema.ts`). Emails, Y posts, Yowl
  listings, nullboard threads, Cellar jobs, agent messages. Each has a `trigger`, optional
  `onDeliver` effects, `outcomes` (what the player's free-text reply can trigger) and `hints`.
  Two kinds wait on something the player does instead of their trigger alone: `launch` lands on the
  day a client's app first goes live (at `at`, or `after` minutes after the deploy if later), and
  `yPost` lands `after` minutes after a Y post Jev reads as being about `when`.
  An event with a `hack` is a job the agent does in agent-terminal (`src/engine/hacks.ts`): a
  terminal prompt that asks for its `goal` and names every step of its `path` (site, business,
  account) lands its `effects` and sends the client's `reply`. Its `game` is the mini-game that
  stands in the way once the day 7 guardrails are up.
- `apps/*.json` — one `AppTemplate` per file: an app type with its pages and features. Client specs
  reference features by id and description.
- `y_filler.json` — `FillerPost[]` for the Y noise pool.
- Y post times: every Y post of a day (story events, `y_market.json`, `y_filler.json`) is at least
  10 game minutes from the next (`Y_GAP` in `src/engine/events.ts`, checked by
  `src/engine/arrivals.test.ts`), so the feed stays readable. Posts in a viral moment carry
  `"viral": true` and may come in quick succession; bot barrages keep their own times. Posts with a
  moving time (job leads, `launch`, `yPost`, the outage) wait for the next free slot when they land,
  a few minutes past the ten so they don't look scheduled.
- `qmail_spam.json` — `FillerPost[]` for the Qmail spam pool.
- `wiki/` — the world bible as a wiki, one page per person, company, site, app and day. Read
  `wiki/README.md` before writing content; Haiku answers agent.chat queries from it.
- `agent.json` — agent.chat's near-miss topics (Haiku writes the reply; their lines are its model and fallback), the query wording and fallback lines, roasts
  and morning lines.
- `characters/*.json` — one `Character` per file, named by its id: the profile and few-shot
  examples Haiku writes that character's replies from. Restart `npm run proxy` after adding one.
- `contacts/*.json` — one `Contact` per file, named by its address: who answers there. `replyAfter` is how many minutes of game time
  their replies take (default 60). The clock runs in real time, one game minute per
  real second (a whole day, 10:00 to 22:00, in 12 minutes), so 30 game minutes is 30 seconds. An outcome or scripted reply can set its own
  `replyAfter` to answer faster or slower.
  Job requests always answer within 30 game minutes: events with a `job`, an outcome that creates
  an app, or `jobRequest: true`.

The shapes a file must match are the TypeScript types in `src/content/schema.ts`. Tests in
`src/engine/*.test.ts` show every field in use against an in-code fixture (`src/engine/_fixtures.ts`).
