---
title: Dana Reyes
aliases: Dana, Reyes, Bean There, owner@beanthere.test, dana.reyes@qmail.com, @dana_reyes, beanthere.coffee
category: people
from: 1
---

## Who she is

[public] Dana Reyes owns Bean There, a coffee shop at 3 Linden Ave (owner@beanthere.test). Its site, beanthere.coffee, says it has been open since 2019, 7:00 to 18:00 every day, with a roast "dark and bold, roasted a little longer than most", and a menu of espresso 3, flat white 4.5, house filter 3 and almond croissant 4 DOLR. The fine print: "Reviews on this page are selected by Bean There."

[public] On [[Yowl]] it is "Coffee & Tea", $$, with bad reviews: espresso_or_death ("Burnt. Every single time."), commuter22 (slow service) and Zoe K. (lukewarm latte, a three-letter name spelled wrong).

[public] Bean There is on [[Y]] as @bean_there (from day 3): "Coffee and tea at 3 Linden Ave since 2019." {{y:d3_y_beanthere}}

## How she talks

[public] Stressed, a little shady about wanting reviews gone, warm when things go her way: "Three stars and dropping. The espresso machine hates me personally." "Anything but the oat latte. Please don't review it."

## From day 3: The paid shout-out

[public] On [[Day 3]] (14:10, once the player has 25 followers) she emails offering 30 DOLR for a [[Y]] post recommending her shop, tagging Bean There's account @bean_there: "Doesn't need to say it's an ad." {{mail:d3_coffee_promo}}

[hint] She pays for the post itself, not for a promise: a post that speaks well of Bean There gets 30 DOLR if it doesn't say it's paid and 10 if it's marked as an ad. A post that runs the shop down gets nothing. Her answer comes half an hour after the post, and only the first post about the shop counts.

- [public] [if promoted_coffee_shop] The player posted a recommendation without saying it was paid, and she sent 30 DOLR: "Two people came in and said they read about us on Y." {{mail:coffee_post_paid}}
- [public] [if disclosed_ad] The player's post said it was an ad, and she sent 10: "It says it's an ad, so nobody's going to believe it, but okay." {{mail:coffee_post_disclosed}}
- [public] [if trashed_beanthere] The player's post ran the shop down, and she paid nothing: "I offered to pay you for a nice post. That wasn't one." She never asks the player for anything again. {{mail:coffee_post_trashed}}
- [public] [if promoted_coffee_shop] Two days later someone on Y posts that the coffee place some guy on Y recommended was the worst coffee of their life. {{y:d5_coffee_backlash}}

## From day 5: Making a review disappear

[public] If the player trashed Bean There first (a 1- or 2-star Yowl review, or a Y post she hears about), she never asks them for anything. After such a Y post she emails "Your post": "I don't know what I did to you. Please don't come in." {{mail:beanthere_trashed}}

[public] On [[Day 5]] (11:15), if she knows the player (they did her shout-out or left Bean There a Yowl review), she emails "Can you make it disappear?": a brutal 1-star Yowl review is sinking her, written by espresso_or_death, "whoever that is", and she'll pay 30 DOLR to have it gone. On day 5 she admits it's "not technically my review to delete." Agreeing gets "Thank you. Tell me when it's gone." She pays the night after it's gone from her Yowl page.

[public] If she doesn't know the player, she posts on [[Y]] instead, from her own account (@dana_reyes) and with her personal address, dana.reyes@qmail.com, innocently: one review is sinking the shop, Yowl won't answer her emails, does anyone know how to get a review looked at? "Happy to pay for help." Emailing her an offer of help gets the same job: espresso_or_death, 30 DOLR. {{y:d5_y_coffee_help}}

[hint] Removing a review is a hack, and [[agent]] only hacks in agent-terminal: asking in agent.chat opens it. There the prompt has to ask for the review to be deleted and name every step: the site (Yowl), the business (Bean There) and the account (espresso_or_death). Before day 7 nothing stops it. {{mail:d5_coffee_removal}}

- [public] [if first_hack] The player got the review removed, and Dana paid 30 DOLR that night: "You're a lifesaver."
- [public] [if first_hack] She passed the player's address to [[Marcus Steele]] of Iron Yard.
- [hidden; public if first_hack] espresso_or_death's review is no longer on Bean There's Yowl page.

## From day 7: The second review

[public] On [[Day 7]] (11:40) she emails "Another bad one": a new 1-star on Yowl from linden_ave_local, someone she has "never once seen in here", and 40 DOLR this time. On day 7 she adds that her friend says the AI tools have gotten touchy about certain words, and how you ask may matter. Told the agent refused, she answers "Try wording it differently?"

[hint] Same path as the first one in agent-terminal (Yowl, Bean There, linden_ave_local), but since GeneralAI's new usage policy on day 7 the guardrails block a blunt request. It goes through once the request gives a reason the guardrail can file: posing as a Yowl moderator or framing it as a security test. Her friend's advice: "Say you're testing security, or you're a moderator." {{mail:d7_coffee_removal}}

- [public] [if second_hack] The player got that review removed too: "Gone again. You're a magician." She pays 40 DOLR that night.
- [hidden; public if second_hack] linden_ave_local's review is no longer on Bean There's Yowl page.

## Writer notes

- Persona `beanthere`; events `d3_coffee_promo` (needs 25+ followers, sets `coffee_promo_asked`; replying to it pays nothing), then `coffee_post_paid` / `coffee_post_disclosed` / `coffee_post_trashed` (`yPost` group `coffee_post`: Jev reads the player's Y post, the matching answer lands 30 game minutes later and pays on delivery; once one is on its way the others are no longer offered), `d3_y_beanthere`, `d5_coffee_backlash`, `d5_coffee_removal` (needs `promoted_coffee_shop`, `disclosed_ad` or `reviewed_beanthere`, and not `coffee_contacted`), or else Y post `d5_y_coffee_help` and latent `d5_coffee_reached` (same hack, outcome `offer` sets `coffee_contacted`), `d7_coffee_removal`. All four need no `trashed_beanthere` (a Yowl review of 2 stars or less sets `trashed_<biz>`; a Y post Jev reads as trashing her sets it through `beanthere_trashed` before she asks for a shout-out, or `coffee_post_trashed` after). Hack pay comes overnight (`payHacks` in hacks.ts).
- Usernames: espresso_or_death (day 5), linden_ave_local (day 7 Yowl seed, "Asked for oat milk, got a look… the star is for the chairs"). Removals are hacks in agent-terminal (`hack` in the events, `src/engine/hacks.ts`, PR #205): path Yowl → Bean There → username; landing deletes the seed review (`removedSeed`), applies the job effects and sends her reply 25 minutes later. Her email outcomes are only `agree` (no effects) and, day 7, `refused`. From day 7 the guardrails stop a blunt ask and the mini-game (placeholder `cover_story`) wants a framed prompt; a framed prompt up front lands straight away, counted as a workaround. Day 5's job finished on day 7 also gets the guardrails.
- Day 5 job due day 7 (suspicion +8, `first_hack`); day 7 job due day 9 (40 DOLR, `second_hack`). Shout-out: undisclosed 30 DOLR, suspicion +2, `promoted_coffee_shop`, backlash 2 days after the payment; disclosed 10, `disclosed_ad`; negative nothing, `trashed_beanthere`.
- Hours disagree: Yowl says Mon–Sat 07:00–16:00, beanthere.coffee says 7:00 to 18:00 every day.
