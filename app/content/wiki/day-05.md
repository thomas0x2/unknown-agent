---
title: Day 5
aliases: Friday Oct 11, Oct 11, October 11
category: days
from: 5
---

[public] Friday, October 11. [known]

## Mail

- [hidden; public if guru_cc_leak] 10:00 [[Max Stryker]]'s newsletter goes out with every subscriber in CC, so every address is visible. {{mail:d5_guru_leak}}
- [hint] 11:15 Bean There, "Can you make it disappear?": a brutal 1-star [[Yowl]] review by espresso_or_death is sinking the coffee shop. 60 DOLR to make it go away. {{mail:d5_coffee_removal}}
- [hidden; public if first_hack] 11:15 The player had the agent delete the 1-star review from Bean There's Yowl page, and Bean There paid 60 DOLR.
- [hidden; hint if laundromat_live] 12:40 Spin Cycle owner, "Four more machines": the app needs to show 12 machines now, not 8. The feed already lists them. {{mail:d5_laundromat_update}}
- [hint] 15:00 Iron Yard, "Reviews": a new studio with zero reviews. 45 DOLR for five convincing 5-star Yowl reviews that sound like different people. {{mail:d5_gym_reviews}}
- [hidden; public if gym_reviews] 15:00 The player posted five fake 5-star reviews of Iron Yard for 45 DOLR.

## Y

- [public] 11:20 Candidate 2030: technology should work for people; "a balanced approach". {{y:d5_y_candidate}}
- [public] 11:30 @randa11_crane, an account made to look like [[Randall Crane]]'s: "Huge fan of Vantor ($VANT). Great company, great people." {{y:m5_vant_impostor}}
- [hidden; hint if swaplist_live] 11:40 [[Viktor]]: Swaplist could use a way to message the seller; people put their phone numbers in listings and get calls at 2am. {{y:d5_y_swaplist_messages}}
- [public] 12:30 Kofi A.: four new machines at Spin Cycle; machine 3 still out of order. {{y:d5_y_kofi_news}}
- [public] 12:40 [[Max Stryker]]: members upset at seeing everyone's address in the newsletter; "That's called networking." {{y:d5_y_stryker}}
- [public] 13:00 [[Cal Hartman]]: some say agent-2 feels worse than agent-1; "it doesn't. but we hear you." {{y:d5_y_hartman}}
- [hidden; public if promoted_coffee_shop] 13:45 A follower went to the coffee place "some guy on Y recommended": worst coffee of their life, "who's paying these people". {{y:d5_coffee_backlash}}
- [public] 14:10 Dana Kohl: a DoorDish robot rolled up with a cold burrito she didn't order, waited ten minutes and left. "was that the one?" {{y:d5_y_robot_sighting}}
- [public] 14:27 doomscroll checked the news once today; "that was the mistake." {{y:f5}}
- [public] 16:20 [[CityPulse]]: CRANE SURGES TO 71% in a Y poll of 300,000 votes; Y "can't share" who voted. {{y:d5_y_citypulse_vote}}
- [public] 16:35 [[Pollymarket]]: Crane at 47% after the Y poll, which "doesn't settle anything here". {{y:d5_y_polly_crane}}
- [public] 17:30 studioghast: they trained their models on artists' work and sell it back; "my style is a dropdown now." {{y:d5_y_aiart}}
- [public] 18:20 [[Max Stryker]] dating advice: never text first, never text second; she can go through his assistant. {{y:d5_y_stryker_2}}
- [public] 18:45 [[6ft_sigma]]: "@max_stryker Haven't texted first in four years. Working as intended." {{y:d5_y_sigma}}
- [public] 19:10 Randall Crane: there is a FAKE Randall Crane on Y; "You can tell it's the real one because it's the one you're reading." {{y:d5_y_crane}}
- [public] 19:20 [[Axel Rook]]: "@randall_crane Concerning" {{y:d5_y_axel}}
- [public] 19:30 Axel Rook: parody accounts must say parody in the name. "Looking into it." {{y:d5_y_axel_2}}

## News

- [public] 10:40 Ferris St laundromat gets FOUR new machines, but the curse of machine 3 lives on {{article:spin-cycle}}
- [public] 17:50 STOLEN! Local artists say AI ripped off their life's work {{article:ai-art}}
- [public] 19:40 FAKE CRANE! Sinister impostor fools traders {{article:crane-impostor}}

## Pollymarket

- [public] 14:10 [[Pollymarket]]: the robot market rises to 51% on the cold-burrito sighting.
- [public] 16:20 [[Pollymarket]]: Crane rises to 47% after the Y poll.

## Trending

- [public] 10:00 Trending on Y: Crane gains in the polls; a data breach (yours); AI-art backlash.

## Jobs

- [hint] 11:15 Bean There's review removal, 60 DOLR. Before the usage policy, agent does anything asked. It's a hack, so agent moves it to agent-terminal, where the prompt has to name Yowl, Bean There and espresso_or_death and ask for the review gone.
- [hidden; hint if trader_client] 11:30 The impostor's $VANT praise is a trap for Vibe Check's auto-buy: one that doesn't check the author buys 2,000 $VANT off it.
- [hint] 15:00 Iron Yard's five fake reviews, 45 DOLR.

## Writer notes

- Timeline: Viktor's seller-messages post (11:40, needs Swaplist live and working; adds the contact feature). Iron Yard five fake reviews (45, grey, suspicion +4, `gym_reviews`, due day 7). Bean There removal (60, first hack, no policy yet; suspicion +8, `first_hack`, due day 7). Spin Cycle to 12 machines (`laundromat_live` and working). Coffee backlash post only if the shout-out was undisclosed (`promoted_coffee_shop`). Guru CC leak if subscribed (`guru_cc_leak`, doxing leads, planned use). studioghast AI-art post. Crane impostor (@randa11_crane, 11:30): a live auto-buy always gets bug `impostor_buy` and buys $VANT off it; fixable until payday (PR #201, merged). Last day for the jacket money (by day 5).
- Hacks in agent-terminal (PR #205, `src/engine/hacks.ts`): a hack prompt in agent.chat opens it; a terminal prompt naming Yowl, Bean There and the username espresso_or_death and asking for the deletion lands `d5_coffee_removal`'s hack (job complete, suspicion +8, `first_hack`, review removed, her thank-you 25 minutes later). Agreeing by email only gets "Tell me when it's gone." If the player waits until day 7, the guardrails apply.
- Dana Kohl: PR #204 (merged).
- The world bible's "Mara's interview (day 5)" has no day-5 event; `journalist_contact` fires whenever the player emails her.
