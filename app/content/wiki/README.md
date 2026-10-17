# The Unknown Agent wiki

The world bible, one page per thing: a person, a company, a site, an app, a day. It is the reference
for anyone writing game content, and the lookup Haiku uses to answer agent.chat queries
(`server/wiki.mjs`). Read `index.md` first; it lists every page.

## Page format

```
---
title: Gino Fenoglio
aliases: Gino, Trattoria Gino, gino@trattoria.test, @gino
category: people
from: 1
---

One or two plain paragraphs or a short bullet list: who or what it is, as a fact of the world,
present tense. Link other pages with [[Page title]].

## From day 4

A section that only exists for the player from day 4 on.

## Writer notes

Code paths, flags, status tags, open questions. Never shown to Haiku.
```

- **File name** is the title in kebab case (`gino-fenoglio.md`); days are `day-01.md` … `day-21.md`.
- **aliases** are other names a search should find the page by: first names, handles, addresses, domains.
- **category**: `people`, `family`, `companies`, `sites`, `apps`, `world`, `days`, or `writers`.
- **from**: the first day the player can know the page's subject exists (default 1). Before it, the page
  doesn't exist for lookups.

## What Haiku sees (spoiler rules)

The lookup only shows what the player could know by the current day. It hides:

- a whole page whose `from` is later than today, and every `writers` page (tone, endings, jokes);
- a `## From day N` section before day N;
- every `## Writer notes` section;
- any sentence or bullet that names a later day ("on day 9 …", "days 10 to 12 …") or a model not
  rolled out yet (agent-3 before day 9, agent-4 before 14, agent-5 before 18);
- any bullet or sentence tagged `[planned]`, `[open]` or `[legacy]`;
- file paths in backticks.

So: write later events with their day in the same sentence ("On day 10 the rocket breaks apart."),
keep unwritten story in `[planned]` bullets or writer notes, and put anything that isn't a fact of the
world (where it lives in code, who decided it, what's undecided) under `## Writer notes`.

## Keeping it current

The wiki is the master world bible (it replaced `/mnt/project-files/world/world-bible.md`). When a
piece of work adds or renames something in the game, update or add its page in the same PR, list new
pages in `index.md`, and update the day page when it is story content. Code on main wins over the
wiki; fix the wiki. The day-by-day plan, including days not written yet, stays in
`/mnt/project-files/world/timeline.md`.

**Branches.** A sentence that only holds on one story branch carries a flag tag, `[if posted_deepfake]`
or `[if !posted_deepfake]` (real flag names from the events); a section can be headed `## If flagname`.
The lookup drops it unless the player's flags match, so Haiku never learns about a path the player
didn't take. A condition that isn't a flag goes in writer notes. Hidden meters (family trust,
suspicion, misuse, leash, standings), bug odds and how Jev judges things are writer notes only.

**Today.** On the current day's own page a beat shows only once its time has passed, so each beat
opens with its 24h time ("- 11:30 Crane praises $GAI on Y."); an untimed beat shows from the next
day. Anywhere else, a sentence naming today and a time later than now is hidden too.

A sentence that names a later day but is known in advance (rent amounts and due days, the model
rollout dates GeneralAI announces) can carry `[known]` to stay visible; the tag is stripped.
