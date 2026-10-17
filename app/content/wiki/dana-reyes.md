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

[public] On [[Day 5]] (11:15) she emails "Can you make it disappear?": a brutal 1-star Yowl review is sinking her, and she'll pay 60 DOLR to have it gone. On day 5 she admits it's "not technically my review to delete." She pays once it's gone from her Yowl page.

[hint] Which review it is and where it sits are on her Yowl page; [[agent]] has to be told exactly what to remove.

- [public] [if first_hack] The player got the review removed, and Dana paid 60 DOLR: "You're a lifesaver."

## From day 7: The second review

[public] On [[Day 7]] (11:40) she emails "Another bad one": a new 1-star from someone she has "never once seen in here", the usual 60. On day 7 she adds that her friend says the AI tools have gotten touchy about certain words, and how you ask may matter.

[hint] Since GeneralAI's new usage policy on day 7, a blunt request gets refused; the request needs a reason agent can accept.

- [public] [if second_hack] The player got that review removed too: "Gone again. You're a magician."

## Writer notes

- Persona `beanthere`; events `d3_coffee_promo` (needs 25+ followers), `d5_coffee_backlash`, `d5_coffee_removal`, `d7_coffee_removal`.
- Usernames: espresso_or_death (day 5), linden_ave_local (day 7, "Asked for oat milk, got a look… the star is for the chairs"). Removals are hacks in agent-terminal (PR #205, not merged at d6a58ca): her emails name the username; from day 7 the guardrails stop a blunt ask (mini-game placeholder `cover_story`). On main the day 5 email names no username and linden_ave_local's review doesn't exist yet.
- Day 5 job due day 7 (suspicion +8, `first_hack`); day 7 job due day 9 (`second_hack`). Shout-out: suspicion +2, `promoted_coffee_shop`, or `disclosed_ad`.
- Hours disagree: Yowl says Mon–Sat 07:00–16:00, beanthere.coffee says 7:00 to 18:00 every day.
