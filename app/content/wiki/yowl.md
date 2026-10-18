---
title: Yowl
aliases: yowl.com, reviews, Yowl reviews
category: sites
from: 1
---

[public] Yowl (yowl.com) is the city's business review site. Each business page shows its category, price level, address, owner, hours, an about line and its reviews. [[The player]] can add one review per business.

## Businesses on Yowl

- [public] Bean There (3 Linden Ave, coffee and tea, $$, Mon–Sat 07:00–16:00): reviews by espresso_or_death (1 star), commuter22 (2), Zoe K. (2).
- [public] Iron Yard (88 Harbor Rd, gym, $$, daily 06:00–23:00): reviews by liftbro (3), Steph M. (4), kettlebell_karen (2).
- [public] Spin Cycle Laundry (201 Ferris St, laundromat, $, daily 06:00–00:00): reviews by walked_there_again (2) and Nadia (3, a van idling out back at 2am last week).
- [public] GeneralAI (visitor parking) (Route 9, $$$$, always open, "Attendant fully automated."): one review by former_employee (1 star).
- [public] On day 7 linden_ave_local leaves Bean There a 1-star review about the oat milk: "the star is for the chairs."
- [hidden; public if first_hack] espresso_or_death's 1-star review is gone from Bean There's page.
- [hidden; public if second_hack] linden_ave_local's 1-star review is gone from Bean There's page.

[public] Details of each business are on [[Local businesses]].

## Reviews as work

- [public] Some business owners pay for reviews or want reviews gone.
- [public] A Yowl review naming a live user app brings that app new users, once.
- [hint] {{mail:d5_coffee_removal}}
- [hint] {{mail:d7_coffee_removal}}
- [hint] {{mail:d6_gym_reviews}}
- [hidden; public if gym_reviews] Five new 5-star reviews of Iron Yard: Derek T., gains_goblin, Priya S., deadlift_dad, Jo R.
- [hidden; public if gym_reviews_deleted] Yowl deleted five 5-star Iron Yard reviews from one account, happy_customer_88, for "coordinated inauthentic activity".
- [public] Each Yowl account can review a business once.
- [hint] Owners read their reviews: Dana never asks a player who gave Bean There 1 or 2 stars for anything.

## Writer notes

- `app/src/ui/yowl-data.ts`. Jobs: Iron Yard's five fake 5-star reviews (hack, the day after `first_hack`, `gym_reviews`; posted as `addReviews`, one account if the prompt doesn't ask for different names, then deleted overnight); a player review sets `reviewed_<biz>`; Bean There review removals of espresso_or_death (day 5, `first_hack`) and linden_ave_local (day 7, `second_hack`), done in agent-terminal; the review disappears once the hack lands. Promo: +30 users per user app, once (`promoYowl`).
