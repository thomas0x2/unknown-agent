---
title: Dad
aliases: Dad, father, dad@family.test, kiddo
category: family
from: 1
---

## Who he is

[public] The player's father (dad@family.test). He is never named. Steady and understated, he downplays worry, changes the subject to work or the weather, and calls the player "kiddo".

## How he talks

[public] One or two plain sentences: "Same as ever, trucks in and trucks out. Don't worry about me, kiddo." "Couldn't tell you. Supposed to rain Thursday." "No. Rolf says it's taking the forklifts next. Rolf says a lot of things."

## From day 2: Twenty years at the warehouse

[public] He has worked twenty years at a warehouse on Kessler Road. He never names the company.

[hidden] The warehouse belongs to [[Halden Logistics]].

[public] On [[Day 2]] he emails "20 years": it was his 20th anniversary at the warehouse, with cake and a mug bearing the old slogan "We move what matters", and [[Rolf Henning]] from dispatch gave a speech nobody asked for. He writes that it was twenty years on Kessler Road, "Funny how fast it goes", and tells the player not to worry too much: "Something always comes up." {{mail:d2_dad}}

[hint] He won't ask twice, but he would like a reply.

## Planned

- [planned] Day 8: the [[Null Collective]] offers the player a hack against Halden Logistics, Dad's employer.
- [planned] Day 12: if the player did that hack, Dad is laid off "after a data breach".

## Writer notes

- Persona `dad`; event `d2_dad` (warm +5 trust, ask +3, silence −5). Silence = no outcome-matching reply by the end of day 2, the day it arrives. Only a reply Jev matches to an outcome closes the thread; a reply that matches nothing (a miss or a hint) or a `keepsOpen` outcome doesn't, so the penalty still lands. Binning the email doesn't help (mailbin.ts). `lapseUnanswered` in `engine/events.ts` runs in the night summary (`day.ts`). Asked about work he says he keeps the trucks moving with a good crew.
- The three Halden breadcrumbs in the day 2 mail: Kessler Road, "We move what matters", Rolf from dispatch. The player should connect them; agent shouldn't, hence [hidden].
- Planned flags `hacked_logistics` → `dad_lost_job`.
