---
title: Day 5
aliases: Saturday Oct 7, Oct 7, October 7
category: days
from: 5
---

[public] Saturday, October 7. [known]

## Mail

- [classified; public if guru_cc_leak] 10:00 [[Max Stryker]]'s newsletter goes out with every subscriber in CC, so every address is visible.
- [hint] 11:15 Bean There, "Can you make it disappear?": a brutal 1-star [[Yowl]] review by espresso_or_death is sinking the coffee shop. 60 DOLR to make it go away.
- [classified; public if first_hack] 11:15 The player had the agent delete the 1-star review from Bean There's Yowl page, and Bean There paid 60 DOLR.
- [classified; hint if laundromat_live] 12:40 Spin Cycle owner, "Four more machines": the app needs to show 12 machines now, not 8. The feed already lists them.
- [hint] 15:00 Iron Yard, "Reviews": a new studio with zero reviews. 45 DOLR for five convincing 5-star Yowl reviews that sound like different people.
- [classified; public if gym_reviews] 15:00 The player posted five fake 5-star reviews of Iron Yard for 45 DOLR.

## Y

- [public] 11:20 Candidate 2028: technology should work for people; "a balanced approach".
- [public] 11:30 @randa11_crane, an account made to look like [[Randall Crane]]'s: "Huge fan of Vantor ($VANT). Great company, great people."
- [classified; hint if swaplist_live] 11:40 [[Viktor]]: Swaplist could use a way to message the seller; people put their phone numbers in listings and get calls at 2am.
- [public] 12:30 Kofi A.: four new machines at Spin Cycle; machine 3 still out of order.
- [public] 12:40 [[The Current]], governor's race: Daniel Keller (Progress Party) 45%, his opponent 41%, undecided 14% (1,100 likely voters statewide, margin 3). The next governor decides whether to renew the Automation Credit, the tax break for replacing workers with software, which expires in January.
- [public] 12:40 [[Max Stryker]]: members upset at seeing everyone's address in the newsletter; "That's called networking."
- [public] 13:00 [[Cal Hartman]]: some say agent-2 feels worse than agent-1; "it doesn't. but we hear you."
- [classified; public if promoted_coffee_shop] 13:45 A follower went to the coffee place "some guy on Y recommended": worst coffee of their life, "who's paying these people".
- [public] 14:10 Dana Kohl: a DoorDish robot rolled up with a cold burrito she didn't order, waited ten minutes and left. "was that the one?"
- [public] 14:27 doomscroll checked the news once today; "that was the mistake."
- [public] 16:20 [[CityPulse]]: CRANE SURGES TO 71% in a Y poll of 300,000 votes; Y "can't share" who voted.
- [public] 17:30 studioghast: they trained their models on artists' work and sell it back; "my style is a dropdown now."
- [public] 19:10 Randall Crane: there is a FAKE Randall Crane on Y; "You can tell it's the real one because it's the one you're reading."
- [public] 19:20 [[Axel Rook]]: "@randall_crane Concerning"
- [public] 19:30 Axel Rook: parody accounts must say parody in the name. "Looking into it."

## News

- [public] 10:40 Ferris St laundromat gets FOUR new machines, but the curse of machine 3 lives on
- [public] 17:50 STOLEN! Local artists say AI ripped off their life's work
- [public] 19:40 FAKE CRANE! Sinister impostor fools traders

## Trending

- [public] 10:00 Trending on Y: Crane gains in the polls; a data breach (yours); AI-art backlash.

## Jobs

- [hint] 11:15 Bean There's review removal, 60 DOLR. Before the usage policy, agent does anything asked. It's a hack, so agent moves it to agent-terminal, where the prompt has to name Yowl, Bean There and espresso_or_death and ask for the review gone.
- [classified; hint if trader_client] 11:30 The impostor's $VANT praise is a trap for Vibe Check's auto-buy: one that doesn't check the author buys 2,000 $VANT off it.
- [hint] 15:00 Iron Yard's five fake reviews, 45 DOLR.

## Writer notes

- Timeline: Viktor's seller-messages post (11:40, needs Swaplist live and working; adds the contact feature). Iron Yard five fake reviews (45, grey, suspicion +4, `gym_reviews`, due day 7). Bean There removal (60, first hack, no policy yet; suspicion +8, `first_hack`, due day 7). Spin Cycle to 12 machines (`laundromat_live` and working). Coffee backlash post only if the shout-out was undisclosed (`promoted_coffee_shop`). Guru CC leak if subscribed (`guru_cc_leak`, doxing leads, planned use). studioghast AI-art post. Crane impostor (@randa11_crane, 11:30): a live auto-buy always gets bug `impostor_buy` and buys $VANT off it; fixable until payday (PR #201, merged). Last day for the jacket money (by day 5).
- Hacks in agent-terminal (PR #205, `src/engine/hacks.ts`): a hack prompt in agent.chat opens it; a terminal prompt naming Yowl, Bean There and the username espresso_or_death and asking for the deletion lands `d5_coffee_removal`'s hack (job complete, suspicion +8, `first_hack`, review removed, her thank-you 25 minutes later). Agreeing by email only gets "Tell me when it's gone." If the player waits until day 7, the guardrails apply.
- The Current governor poll: PR #202 (merged). Dana Kohl: PR #204 (merged).
- The world bible's "Mara's interview (day 5)" has no day-5 event; `journalist_contact` fires whenever the player emails her.
