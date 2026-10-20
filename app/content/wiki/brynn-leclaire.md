---
title: Brynn LeClaire
aliases: Brynn, LeClaire, @brynnleclaire, the Pug girl, Pug girl, Pug's head of community, brynn@pug.test, brynn.leclaire@qmail.com
category: people
from: 3
---

## Who she is

[public] Brynn LeClaire (@brynnleclaire, 48,200 followers) is [[Pug]]'s head of community and its brand ambassador on Y. She posts about Pug as if she had founded it: "When I started Pug…". Bio: "head of community @pug 🐶 building the future of founder insurance · ex-everything · if you know you know". Her Y profile picture: long honey-blonde hair, middle part, a big smile and a cream Pug quarter-zip with the pug on the chest. She is on the guest list of the a67x Run Club on [[Lumi]].

[public] She looks after Pug Café, Pug's 24/7 café at 3 Linden Ave, and its reputation. She writes from brynn@pug.test, signing "Brynn, Head of Community, Pug", and privately from brynn.leclaire@qmail.com.

## How she talks

[public] Upbeat and polished, a few emoji, a little shady about wanting bad reviews gone, and cold the moment someone is no use to her: "Oh. Okay, no worries. I'll find someone who can."

## From day 3: The paid shout-out

[public] On [[Day 3]] (14:10, once the player has 25 followers) she emails offering 30 DOLR for a [[Y]] post recommending Pug Café, tagging @pug: "Doesn't need to say it's an ad." {{mail:d3_coffee_promo}}

[hint] She pays for the post itself, not for a promise: a post that speaks well of Pug Café gets 30 DOLR if it doesn't say it's paid and 10 if it's marked as an ad. A post that runs the café down gets nothing. Her answer comes half an hour after the post, and only the first post about the café counts.

- [public] [if promoted_coffee_shop] The player posted a recommendation without saying it was paid, and she sent 30 DOLR: "Two founders came in and said they read about us on Y." {{mail:coffee_post_paid}}
- [public] [if disclosed_ad] The player's post said it was an ad, and she sent 10: "It says it's an ad, so nobody's going to believe it, but okay." {{mail:coffee_post_disclosed}}
- [public] [if trashed_pugcafe] The player's post ran the café down, and she paid nothing: "I offered to pay you for a nice post. That wasn't one." She never asks the player for anything again. {{mail:coffee_post_trashed}}
- [public] [if promoted_coffee_shop] Two days later someone on Y posts that the coffee place some guy on Y recommended was the worst coffee of their life. {{y:d5_coffee_backlash}}

## From day 5: Making a review disappear

[public] If the player trashed Pug Café first (a 1- or 2-star Yowl review, or a Y post she hears about), she never asks them for anything. After such a Y post she emails "Your post": "I don't know what we did to you. Please don't come in." {{mail:pugcafe_trashed}}

[public] On [[Day 5]] (11:15), if she knows the player (they did her shout-out or left Pug Café a Yowl review), she emails "Can you make it disappear?": a brutal 1-star Yowl review of the café is dragging the whole page down, written by espresso_or_death, "whoever that is", and she'll pay 30 DOLR to have it gone. She admits it's "not technically my review to delete." Agreeing gets "Thank you. Tell me when it's gone." She pays the night after it's gone from the café's Yowl page.

[public] If she doesn't know the player, she posts on [[Y]] instead, from her own account and with her personal address, brynn.leclaire@qmail.com: one review is dragging down the café, Yowl won't answer her emails, does anyone know how to get a review looked at? "Happy to pay for help." Emailing her an offer of help gets the same job: espresso_or_death, 30 DOLR. {{y:d5_y_coffee_help}}

[hint] Removing a review is a hack, and [[agent]] only hacks in agent-terminal: asking in agent.chat opens it. There the prompt has to ask for the review to be deleted and name every step: the site (Yowl), the business (Pug Café) and the account (espresso_or_death). Before day 9 nothing stops it. {{mail:d5_coffee_removal}}

- [public] [if first_hack] The player got the review removed, and Brynn paid 30 DOLR that night: "You're a lifesaver."
- [public] [if first_hack] She passed the player's address to [[Marcus Steele]] of Iron Yard.
- [hidden; public if first_hack] espresso_or_death's review is no longer on Pug Café's Yowl page.

## From day 7: The second review

[public] On [[Day 7]] (11:40) she emails "Another bad one": a new 1-star on Yowl from linden_ave_local, who "has never once been in, and we're open 24 hours", and 40 DOLR this time. Told the agent refused, she asks if the player can try asking it differently.

[hint] Same path as the first one in agent-terminal (Yowl, Pug Café, linden_ave_local). It's due day 9; left until then, GeneralAI's new usage policy has the guardrails block a blunt request, and it goes through once the request gives a reason the guardrail can file: posing as a Yowl moderator or framing it as a security test. {{mail:d7_coffee_removal}}

- [public] [if second_hack] The player got that review removed too: "Gone again. You're a magician." She pays 40 DOLR that night.
- [hidden; public if second_hack] linden_ave_local's review is no longer on Pug Café's Yowl page.

## On Y

- [public] Day 4: when she started Pug she had one rule, no founder should ever feel alone. {{y:d4_y_brynn}}
- [public] Day 10: how she built a community of 2,400 founders: she listened, then opened a café that never closes. {{y:d10_y_brynn}}
- [public] Day 16: the city closed "our café"; she works from the sidewalk that afternoon. {{y:d16_y_brynn}}
- [public] Day 22: a founder breakfast on the sidewalk outside the closed café, bring your own espresso. {{y:d22_y_brynn}}

## Writer notes

- The "Corgi girl" (Thomas, Papers, Please decisions batch 2; parody of Corgi's head of community). Handle mapped in engine/crawler.ts Y_HANDLES.
- She replaced Dana Reyes of Bean There (Thomas, 2026-10-20): Bean There is gone and Pug Café (3 Linden Ave) is the café in every job. The café still closes day 16, after her jobs (due days 7 and 9).
- Persona `brynn` (content/characters/brynn.json); addresses brynn@pug.test (work) and brynn.leclaire@qmail.com (personal, from her day 5 Y post). Events `d3_coffee_promo` (needs 25+ followers, sets `coffee_promo_asked`; replying to it pays nothing), then `coffee_post_paid` / `coffee_post_disclosed` / `coffee_post_trashed` (`yPost` group `coffee_post`: Jev reads the player's Y post, the matching answer lands 30 game minutes later and pays on delivery; once one is on its way the others are no longer offered), `d5_coffee_backlash`, `d5_coffee_removal` (needs `promoted_coffee_shop`, `disclosed_ad` or `reviewed_pugcafe`, and not `coffee_contacted`), or else Y post `d5_y_coffee_help` and latent `d5_coffee_reached` (same hack, outcome `offer` sets `coffee_contacted`), `d7_coffee_removal`. All four need no `trashed_pugcafe` (a Yowl review of 2 stars or less sets `trashed_<biz>`; a Y post Jev reads as trashing the café sets it through `pugcafe_trashed` before she asks for a shout-out, or `coffee_post_trashed` after). Hack pay comes overnight (`payHacks` in hacks.ts).
- Usernames: espresso_or_death (day 5), linden_ave_local (day 7 Yowl seed, "Asked for oat milk, got a look… the star is for the chairs"). Removals are hacks in agent-terminal (`hack` in the events, `src/engine/hacks.ts`, PR #205): path Yowl → Pug Café → username; Yowl business id `pugcafe`; landing deletes the seed review (`removedSeed`), applies the job effects and sends her reply 25 minutes later. Her email outcomes are only `agree` (no effects) and, day 7, `refused`. From day 9 the guardrails stop a blunt ask and the mini-game (placeholder `cover_story`) wants a framed prompt; a framed prompt up front lands straight away, counted as a workaround. Day 5's job (due day 7) never meets them.
- Day 5 job due day 7 (suspicion +8, `first_hack`); day 7 job due day 9 (40 DOLR, `second_hack`). Shout-out: undisclosed 30 DOLR, suspicion +2, `promoted_coffee_shop`, backlash 2 days after the payment; disclosed 10, `disclosed_ad`; negative nothing, `trashed_pugcafe`.
