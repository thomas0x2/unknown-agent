---
title: App users and reviewers
aliases: Kofi A., kofi_a, @kofi_a, Kofi, Ines, ines_sells, second_hand_sam, Sam, Pia L., pia_l, Pia, Steph M., steph_m, Steph, walked_there_again, espresso_or_death, linden_ave_local, commuter22, Zoe K., Tom R., Marguerite, liftbro, kettlebell_karen, Nadia, former_employee, Yowl reviewers
category: people
from: 1
nest: true
---

## Who they are

[public] Regular people who use the apps the player builds, post on [[Y]] when those apps break, sell on [[Swaplist]], and review local businesses on [[Yowl]].

## The Spin Cycle regulars

- [public] Kofi A. (@kofi_a), "Spin Cycle regular. Sunday loads, 9am."
- [public] On day 5 he posts that Spin Cycle has four new machines and machine 3 is still out of order: "Some things you can count on." {{y:d5_y_kofi_news}}
- [public] Steph M. (@steph_m), "Nurse, nights. Laundry in between." She gave Iron Yard 4 stars on Yowl.
- [public] On day 7 she posts that her rent appeal came back in four seconds. {{y:d7_y_steph_rentboard}}
- [public] On day 20 she plans to vote at 7am before her night shift. {{y:d20_y_steph_vote}}
- [public] walked_there_again, "I walk to the laundromat a lot." Gave Spin Cycle 2 stars on Yowl ("Every machine busy. Again.").
- [public] On day 15 they walk past four DoorDish strikers on Ferris St with robots delivering straight through the picket line. {{y:d15_y_walked_strike}}
- [public] When [[Spin Cycle Board]] is down or stale at payday, one of these three posts about it on Y.

## The Swaplist users

- [public] Ines (@ines_sells), "Selling my aunt's furniture one chair at a time."
- [public] second_hand_sam, "If it's used, I'm interested."
- [public] Pia L. (@pia_l), "Bargain hunter. Will haggle over a spoon." She also gave Trattoria Gino 5 stars on Yowl for the tiramisu.
- [public] When Swaplist is down or stale at payday, one of these three posts about it on Y. Their listings are on [[Swaplist sellers]].

## Yowl reviewers

- [public] Trattoria Gino: Pia L. (5 stars), Tom R. (4, "Cash only, and no website"), Marguerite (5, "Our Friday spot for years"). Marguerite is a retired music teacher who has had Friday dinner at the same table since 2010; on Y she is @marguerite.
- [hidden; public if shown d6_y_trattoria_photos] Marguerite posted on Y about Gino's AI menu pictures the day after they went live. {{y:d6_y_trattoria_photos}}
- [public] Bean There: espresso_or_death (1 star, "Burnt. Every single time."), commuter22 (2), Zoe K. (2).
- [public] Iron Yard: liftbro (3), Steph M. (4), kettlebell_karen (2).
- [public] Spin Cycle Laundry: walked_there_again (2), Nadia (3, a van idling out back at 2am).
- [public] GeneralAI visitor parking: former_employee (1, "They paved paradise and put up a parking lot. Then automated the attendant.").
- [public] On day 7 linden_ave_local leaves Bean There 1 star: asked for oat milk, got a look, then regular milk, "the star is for the chairs."
- [hidden; public if first_hack] espresso_or_death's review of Bean There is gone from Yowl.
- [hidden; public if second_hack] linden_ave_local's review of Bean There is gone from Yowl.

## Writer notes

- Bios in `y-bios.ts`; Yowl seeds in `src/ui/yowl-data.ts`; complaint posters in `content/apps/laundromat.json` and `swaplist.json`; events `d5_y_kofi_news`, `d7_y_steph_rentboard`, `d15_y_walked_strike`, `d20_y_steph_vote`.
- linden_ave_local's review is a Yowl seed with `day: 7` (PR #205); Dana's hacks delete the two seeds (`state.removedSeed`).
- Steph is a nurse on nights in both her Y bio and Swaplist persona; Kofi is a "Spin Cycle regular" on Y but "recently laid off from an office job" as a Swaplist seller. Both can hold.
