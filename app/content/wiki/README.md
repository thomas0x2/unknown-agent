# The Good catch! wiki

The world bible and the day-by-day timeline, one page per thing: a person, a company, a site, an app,
a day. It is the reference for anyone writing game content, and what agent answers the player's
questions from (agent.chat queries, `src/engine/query.ts`). Read `index.md` first; it lists every
page. In the game, with dev mode on, the bookmarked **wiki.dev** site shows every page with each
paragraph's tag as the player stands now, and edits text and tags. The same editor runs in a real
browser tab at **http://localhost:5173/wiki.html** (while `npm run dev` runs), with "view as" day,
time and flags instead of the game's. Both save here through the local proxy (`npm run proxy`), and a
save in one shows up in the other at once. A read-only copy of main is published to GitHub Pages
(https://thomas0x2.github.io/unknown-agent/, `.github/workflows/wiki-pages.yml`) for reading on a phone.

## Page format

```
---
title: Logan Pryce
aliases: Logan, logan@workagent.test, @logan_ships
category: people
from: 1
---

[public] One or two plain paragraphs: who or what it is, as a fact of the world, present tense.
Link other pages with [[Page title]].

## The website job

- [public] On day 1 he posts that he needs a founding engineer.
- [hint] What the site needs: the name, the one-liner, the investor logos, an About us page.

## From day 2: The waitlist

[public] A section that only exists for the player from day 2 on.

## Writer notes

Code paths, flags, open questions. Never part of an answer, never tagged.
```

- **File name** is the title in kebab case (`logan-pryce.md`); days are `day-01.md` … `day-21.md`.
- **aliases** are other names a question might use: first names, handles, addresses, domains.
- **category**: `people`, `family`, `companies`, `sites`, `apps`, `world`, `days`, or `writers`
  (writers pages, like the tone rules, endings and the timeline overview, are never used for answers).
- **hub: true** (optional) marks a page of many things, like Ad brands and Local businesses: each
  section is matched on its own, so a question that names one brand or shop finds its section
  without naming the page.
  In the wiki, its sections show as pages nested under it (Companies › Local businesses ›
  Bean There, at `local-businesses/bean-there`); the file stays one page.
- **nest: true** (optional) nests a page's sections the same way in the wiki without changing how
  questions match it (Y regulars, App users and reviewers). A "Who they are" or "Overview" section
  and writer notes stay on the parent page. Day pages are grouped by week.
- **from**: the first day the player can know the page's subject exists (default 1). Before it, a
  question about it is refused as classified.
- **summary** (optional): one line saying what the page is about, for Jev to match questions
  against. Without it Jev sees the page's first sentence. Use it when the first sentence misleads
  (The player, Building apps).

Query matching is tested with real Jev: `content/query-tests.json` holds likely player questions
and the pages that should answer them; run `npx vite-node scripts/query-tests.ts` with
`npm run proxy` running (add `--sweep` to compare thresholds). Add a case when a question is
misjudged.
- **Sections** (`##`) are what a question is matched to after the page, so give them headings that
  say what they're about. The opening paragraphs are the page's overview: what a question naming no
  section gets.

## Paragraph tags

Every paragraph, bullet and table row starts with a tag that says what agent may do with it:

- `[public]`: agent answers with it.
- `[hint]`: agent may only point the way (an email to read, a site to check), never state it.
  Use it for anything that solves a job or a puzzle for the player.
- `[hidden]`: agent won't say (asked about it, it refuses). Untagged paragraphs count as hidden.
  (`[hidden]` is the old name and still reads as hidden.)

A tag can change with the game: a base tag, then steps, the last one that holds wins.

```
[hidden; hint from day 5; public if seed_stolen; public if suspicion >= 40]
```

Steps are `<tag> from day N`, `<tag> if flag`, `<tag> if !flag`, `<tag> if <meter> <op> <n>`
(`>=`, `<=`, `>`, `<`, `=`; meters as in `src/engine/values.ts`: suspicion, familyTrust, followers …),
and `<tag> if shown <id>`: once that email, Y post or Yowl review (its event id, or a `y_market` /
`y_filler` post id) or CityPulse article (`article:<slug>`) has reached the player.

## What the player received: embeds

A paragraph can carry an email, post or article itself: `{{y:d1_y_logan}}`, `{{y:m1_gai_escape}}`,
`{{yowl:<event id>}}`, `{{article:opponent-clip}}`. Once the item has arrived, agent sees its full text
there (sender, subject, body; an article's title, dek and body), so a question can get at what it
said. A paragraph with an embed is hidden until every item it embeds has been shown to the player,
so give each item its own paragraph and keep standing facts (a bio, a description) in a paragraph
without one. In the editor each embed shows its item's text under the paragraph, and in the edit box
Cmd/Ctrl-click on an embed shows it too. The standalone wiki's "shown" field marks items as shown
(an id) or not shown (`!id`) on top of what the triggers say has arrived. Day pages embed each beat's item in that beat's bullet, and the
pages of the people and companies involved embed theirs. A test checks every id exists.

## What the player can't know yet is hidden, whatever the tag

- a page whose `from` is later than today;
- a `## From day N` section before day N, a `## If flag` / `## If !flag` section on the other branch;
- any sentence that names a later day ("On day 9 …", "days 10 to 12 …") or a model not rolled out
  yet (agent-3 before day 9, agent-4 before 14, agent-5 before 18);
- on today's own day page, a beat whose time hasn't come yet: start each beat with its 24h time
  (`- [public] 11:30 Crane praises $GAI on Y.`); an untimed beat counts from the next day. Anywhere
  else, a sentence naming today and a later time;
- a sentence carrying `[if flag]` / `[if !flag]` on the other branch (put it right after the tag for a
  bullet that's on one branch all through);
- `[planned]`, `[open]` and `[legacy]` material, always; and file paths are stripped.

A sentence that names a later day but is known in advance (rent amounts and due days) carries
`[known]` to stay visible. Hidden meters, bug odds and how Jev judges things are writer notes only.

## How a query is answered

Jev reads an agent.chat prompt as a query (questions about the world, and how-to questions like
"how can I build apps?"), then matches it down the wiki like a fix down an app's components, but
looser: which page (title and aliases), then which section. When several pages match, Jev is asked
which one the question is mainly about (a page known only later is dropped if a known one also
matches) ("What's DOLR?" is Money and DOLR, not agent's prices); those
win. Naming no page is a miss (agent roasts the player); more than three is too vague (agent asks
which). A page without a section gets its overview. agent.chat shows agent "Searching the WWW" while
Haiku answers, still mean, from the matched paragraphs that are public now, and may only hint at the
hint ones. If there are none, or the page isn't known to the player yet, the answer is refused:
Haiku writes the refusal without seeing the text, and agent.chat shows "Tried to access classified
information · answer refused". Haiku can
also read the player's own screens (Qmail, Y, Yowl, CityPulse, Forkyard, Coinbin; `server/screens.mjs`).

## Keeping it current

The wiki is the master world bible and timeline (it replaced `/mnt/project-files/world/world-bible.md`
and `timeline.md`). When a piece of work adds or changes story content (an event, a Y post, an
article, a rollout, rent, a day-gated site), update the pages and the day page in the same PR, tag
every new paragraph, and list new pages in `index.md`. Code on main wins over the wiki: fix the wiki.
