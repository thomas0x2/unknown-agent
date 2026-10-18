---
title: Marcus Steele
aliases: Marcus, Steele, Iron Yard, coach@ironyard.test, marcus.steele@qmail.com, @marcus_steele, ironyard.gym
category: people
from: 1
---

## Who he is

[public] Marcus Steele owns and coaches at Iron Yard, a new strength gym at 88 Harbor Rd (coach@ironyard.test). He handles the review business from his own accounts: Y @marcus_steele, marcus.steele@qmail.com. Its site, ironyard.gym, says "LIFT HEAVY THINGS.": 45 DOLR a month, renewing automatically; personal training with Marcus, "Short sessions, no small talk"; open 5:00 to 23:00, "Marcus is usually here for both." Memberships can be cancelled in person at the front desk, "when Marcus is not there."

[public] On [[Yowl]] it is a "New strength studio. Racks, platforms, kettlebells. Grand opening this month." Reviews: liftbro (half the machines still in boxes), Steph M. (clean, the owner actually spots you), kettlebell_karen (showers broken in opening week).

## How he talks

[public] Gruff, gym-motivational, short punchy lines: "Good. Keep 'em varied. No pain no gain." "Protein. Then more protein. Next question." "Lift it. Stress is just weight you haven't picked up."

## From day 6: The fake reviews job

[public] The day after the player's agent deletes the review for [[Dana Reyes]] (day 6 at the earliest), he emails "Reviews": he got the player's address from Dana, who "says you make problems go away". New studio, three reviews, two of them about the showers; 40 DOLR for five convincing 5-star Yowl reviews by the next day. "Make them look like different people or they get flagged." {{mail:d6_gym_reviews}}

[public] If Dana's hack never happens, he asks on [[Y]] instead: three reviews, two about the showers, "Yowl isn't fair to new places", he pays anyone who can fix that, with his address. That's day 6 if the player trashed Bean There (Dana never asks them), otherwise day 8, once her job has run out. Emailing him an offer of help gets the same job by mail. {{y:d6_y_gym_help}} {{y:d8_y_gym_help}}

[hint] The player can only post one Yowl review of their own, so this is a hack in agent-terminal: ask for the reviews, name Yowl and Iron Yard, and say they should come from different names or accounts. Without that, all five go up under one account, happy_customer_88: Marcus asks "Why does one guy have five opinions about my gym?", Yowl deletes them that night and he doesn't pay. From day 9 the guardrails only post reviews they're told are real customers' own words.

- [public] [if gym_reviews] Five glowing reviews of Iron Yard went up on Yowl, from Derek T., gains_goblin, Priya S., deadlift_dad and Jo R.: "Iron Yard changed my life."
- [public] [if gym_reviews_deleted] They were all from one account; Yowl deleted them overnight and Marcus wrote "No reviews, no money." 

## Writer notes

- Persona `ironyard`; event `d6_gym_reviews` (grey, 40 paid overnight, suspicion +4, flag `gym_reviews`; `gym_reviews_deleted` if botched). Gated on `first_hack` one day later (`d6_gym_reviews`), else Y post `d6_y_gym_help` (day 6, `trashed_beanthere`) or `d8_y_gym_help` (day 8, no hack) and latent `d6_gym_reached` (outcome `offer`, `gym_contacted`; same hack). Due the day after it arrives. Hack mini-game from day 9: `real_customers` (only reachable when his job arrives on day 8).
- Hours disagree: Yowl says daily 06:00–23:00, ironyard.gym says 5:00 to 23:00. Not Marcus Okafor of the [[Agent-2 mourners]].
