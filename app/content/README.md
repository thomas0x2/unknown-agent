# Content

Story content lives here as data; the engine (in `src/engine`) only interprets it. Nothing in this
folder is wired yet — the mechanics were built first, on purpose. Writers add files here without
touching engine code.

- `events/*.json` — one `GameEvent` per file (see `src/content/schema.ts`). Emails, Y posts, Yowl
  listings, nullboard threads, Cellar jobs, agent messages. Each has a `trigger`, optional
  `onDeliver` effects, `outcomes` (what the player's free-text reply can trigger) and `hints`.
- `apps/*.json` — one `AppTemplate` per file: an app type with its pages and features. Client specs
  reference features by id and description.
- `y_filler.json` — `FillerPost[]` for the Y noise pool.
- `qmail_spam.json` — `FillerPost[]` for the Qmail spam pool.

The shapes a file must match are the TypeScript types in `src/content/schema.ts`. Tests in
`src/engine/*.test.ts` show every field in use against an in-code fixture (`src/engine/_fixtures.ts`).
