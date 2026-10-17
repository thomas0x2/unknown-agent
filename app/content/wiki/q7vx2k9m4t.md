---
title: q7vx2k9m4t
aliases: q7vx2k9m4t@null.onion, null.onion, the onion email, we know what you did
category: people
from: 6
summary: q7vx2k9m4t writes to the player from a null.onion address the night after their first hack
---

## The email

[hidden; public if shown d6_onion_mail] At 20:00 on the day after the player's first hack (day 6 at the earliest), an email arrives from q7vx2k9m4t@null.onion, subject "yesterday". It says they know what the player did, and that the agent keeps logs. {{mail:d6_onion_mail}}

[hidden; public if shown d6_onion_mail] Nobody answers replies to it, or new mail to the address.

## Who they are

[hidden] Not decided. See the writer notes.

## Writer notes

- [open] Open thread, a hook for later: who sent it, what they saw and what they want are undecided. The lowercase and "logs" fit the [[Null Collective]] (dev_null: "no logs, no masters"), and null.onion sits next to nullboard.onion, but nothing confirms it. It could also be [[GeneralAI]] reading the logs, or a blackmailer. The day 8 Null Collective offer is the natural place to pay it off.
- Event `d6_onion_mail` (qmail, 20:00). Trigger `after: any_hack, 1 day`; `any_hack` is set by every hack that lands in agent-terminal (`land()` in `src/engine/hacks.ts`), so whichever hack comes first (Bean There or Iron Yard) counts, botched or not. `outcomes: []` keeps a reply box; no character in characters.json, so replies and fresh mail get no answer at all (no Haiku, no bounce). It asks for nothing yet.
