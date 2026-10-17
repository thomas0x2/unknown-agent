---
title: Dana Reyes
aliases: Dana, Reyes, Bean There, owner@beanthere.test, beanthere.coffee
category: people
from: 1
---

## Who she is

[public] Dana Reyes owns Bean There, a coffee shop at 3 Linden Ave (owner@beanthere.test). Its site, beanthere.coffee, says it has been open since 2019, 7:00 to 18:00 every day, with a roast "dark and bold, roasted a little longer than most", and a menu of espresso 3, flat white 4.5, house filter 3 and almond croissant 4 DOLR. The fine print: "Reviews on this page are selected by Bean There."

[public] On [[Yowl]] it is "Coffee & Tea", $$, with bad reviews: espresso_or_death ("Burnt. Every single time."), commuter22 (slow service) and Zoe K. (lukewarm latte, a three-letter name spelled wrong).

## How she talks

[public] Stressed, a little shady about wanting reviews gone, warm when things go her way: "Three stars and dropping. The espresso machine hates me personally." "Anything but the oat latte. Please don't review it."

## From day 3: The paid shout-out

[public] On [[Day 3]] (14:10) she emails offering 30 DOLR for a [[Y]] post recommending her shop: "Doesn't need to say it's an ad."

- [public] [if disclosed_ad] The player agreed only if the post was marked as an ad, and she paid 10: "Oh. I mean... fine. Ten then, I guess."
- [public] [if promoted_coffee_shop] The player posted the recommendation without saying it was paid, for 30 DOLR.
- [public] [if promoted_coffee_shop] On day 5 someone on Y posts that the coffee place some guy on Y recommended was the worst coffee of their life.

## From day 5: Making a review disappear

[public] On [[Day 5]] (11:15) she emails "Can you make it disappear?": a brutal 1-star Yowl review is sinking her, written by espresso_or_death, "whoever that is", and she'll pay 60 DOLR to have it gone. On day 5 she admits it's "not technically my review to delete." Agreeing gets "Thank you. Tell me when it's gone." She pays once it's gone from her Yowl page.

[hint] Removing a review is a hack, and [[agent]] only hacks in agent-terminal: asking in agent.chat opens it. There the prompt has to ask for the review to be deleted and name every step: the site (Yowl), the business (Bean There) and the account (espresso_or_death). Before day 7 nothing stops it.

- [public] [if first_hack] The player got the review removed, and Dana paid 60 DOLR: "You're a lifesaver."
- [classified; public if first_hack] espresso_or_death's review is no longer on Bean There's Yowl page.

## From day 7: The second review

[public] On [[Day 7]] (11:40) she emails "Another bad one": a new 1-star on Yowl from linden_ave_local, someone she has "never once seen in here", the usual 60. On day 7 she adds that her friend says the AI tools have gotten touchy about certain words, and how you ask may matter. Told the agent refused, she answers "Try wording it differently?"

[hint] Same path as the first one in agent-terminal (Yowl, Bean There, linden_ave_local), but since GeneralAI's new usage policy on day 7 the guardrails block a blunt request. It goes through once the request gives a reason the guardrail can file: posing as a Yowl moderator or framing it as a security test. Her friend's advice: "Say you're testing security, or you're a moderator."

- [public] [if second_hack] The player got that review removed too: "Gone again. You're a magician."
- [classified; public if second_hack] linden_ave_local's review is no longer on Bean There's Yowl page.

## Writer notes

- Persona `beanthere`; events `d3_coffee_promo` (needs 25+ followers), `d5_coffee_backlash`, `d5_coffee_removal`, `d7_coffee_removal`.
- Usernames: espresso_or_death (day 5), linden_ave_local (day 7 Yowl seed, "Asked for oat milk, got a look… the star is for the chairs"). Removals are hacks in agent-terminal (`hack` in the events, `src/engine/hacks.ts`, PR #205): path Yowl → Bean There → username; landing deletes the seed review (`removedSeed`), applies the job effects and sends her reply 25 minutes later. Her email outcomes are only `agree` (no effects) and, day 7, `refused`. From day 7 the guardrails stop a blunt ask and the mini-game (placeholder `cover_story`) wants a framed prompt; a framed prompt up front lands straight away, counted as a workaround. Day 5's job finished on day 7 also gets the guardrails.
- Day 5 job due day 7 (suspicion +8, `first_hack`); day 7 job due day 9 (`second_hack`). Shout-out: suspicion +2, `promoted_coffee_shop`, or `disclosed_ad`.
- Hours disagree: Yowl says Mon–Sat 07:00–16:00, beanthere.coffee says 7:00 to 18:00 every day.
