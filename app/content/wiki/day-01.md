---
title: Day 1
aliases: Monday Oct 7, Oct 7, October 7
category: days
from: 1
---

[public] Monday, October 7, 2030, the first day of the game. [known]

## Start

- [public] 10:00 The player has 100 DOLR, 12 Y followers and agent-1, and has just been laid off from [[Vantor Group]].
- [public] 10:00 A laptop window says the Vantor work profile was removed overnight; personal files were not affected.

## Mail

- [public] 10:00 People & Culture at [[Vantor Group]], "Changes to your role": the player's position is eliminated, effective immediately; the final salary payment "has already been made". {{mail:d1_hr_termination}}
- [public] 10:00 [[GeneralAI]], "Welcome to agent": the [[agent]] account is active and billed to the [[Coinbin]] wallet, every prompt at the model's rate. {{mail:d1_gai_welcome}}
- [hidden; public if asked_mom_money] 11:20 Mom sent 20 DOLR when the player asked for money: "Buy vegetables."
- [public] 14:15 [[Max Stryker]] of Alpha Ascend, "You were BORN for more": his course EMPIRE is 200 DOLR, today only 20. Replying EMPIRE gets the sign-up link. {{mail:d1_guru}}

## Money

- [public] 10:25 [[Gary Pruitt]], "Rent: due Sunday, October 13": 350 DOLR comes out of the wallet at the end of Sunday, October 13, and he will not take another late payment. [known] {{mail:d1_landlord_rent}}

## Family

- [public] 11:20 [[Mom]], "Are you okay?": she heard about the layoffs and asks if the player is eating. "Your father says hi (he didn't)." {{mail:d1_mom}}
- [public] 11:50 [[Brother]] replies to all: "well at least the robots will remember you fondly lmao. you good though?" {{mail:d1_brother_joke}}

## Y

- [public] 09:30 MarketWire: $GAI up 4% premarket on the "almost escaped" news. {{y:m1_gai_escape}}
- [public] 09:50 [[Axel Rook]]: AI will do every job within a few years, and everyone gets universal high income. {{y:d1_y_axel}}
- [public] 10:20 [[Max Stryker]]: up at 4am; half the city got fired by a computer and went back to sleep. {{y:d1_y_stryker}}
- [public] 10:32 [[CityPulse]] links its "almost escaped" story. {{y:d1_y_citypulse}}
- [public] 10:42 [[Gino Fenoglio]] (Trattoria owner): his nephew ran the restaurant's website and left for college with the password. He needs a simple site with the menu and hours and will pay. gino@trattoria.test {{y:d1_y_restaurant}}
- [public] 11:40 [[Cal Hartman]] on the "testing incident": everyone is safe, the model is safe. {{y:d1_y_hartman}}
- [public] 12:10 doomscroll: 400 people at Vantor fired by one email, has read every reply, links CityPulse. {{y:d1_y_doomscroll_news}}
- [public] 12:30 [[Mara Vey]] of [[The Current]] asks people behind this week's AI layoffs to write to her at mara@thecurrent.test. From now on the player can email her. {{y:d1_y_journalist}}
- [public] 13:15 Axel Rook: "@mara_vey Interesting." {{y:d1_y_axel_2}}
- [public] 13:50 A Spin Cycle regular: every machine busy again, and the owner's raw status feed (spincycle.test/feed) is unreadable. "Someone make it a real app." {{y:d1_y_laundromat}}
- [public] 17:55 doomscroll: screen time says 11 hours; "it's broken, i was barely on." {{y:f1}}
- [public] 18:08 [[The Current]]: three weeks to the election; it will post independent polls with sample sizes and margins of error, and no Y polls. {{y:d1_y_current}}
- [public] 19:40 [[Randall Crane]]: another company fired its people and hired a computer that doesn't pay taxes. "SAD!" {{y:d1_y_crane}}
- [public] 19:58 Axel Rook: Y usage at an all-time high. {{y:d1_y_axel_3}}

## News

- [public] 08:40 BLOODBATH AT VANTOR: 400 jobs wiped out in ONE email {{article:vantor-layoffs}}
- [public] 10:20 TERROR IN THE LAB: GeneralAI admits its AI "almost escaped" {{article:almost-escaped}}
- [public] 16:30 THE BATTLE FOR AMERICA BEGINS: Crane storms ahead on Y {{article:election-field}}

## Pollymarket

- [public] 10:00 [[Pollymarket]]: the election market has Randall Crane at 38% and the DOLR peg market at 93%.
- [public] 10:20 [[Pollymarket]]: a market on a GeneralAI model escaping before 2031 opens at 9%.
- [public] 16:30 [[Pollymarket]]: Crane rises to 41%.

## Trending

- [public] 10:00 Trending on Y: AI layoffs; "our AI almost escaped"; election candidates announced; laundromat complaints.

## Jobs

- [hint] 10:40 [[Trattoria Gino site]] for Gino: a landing page with the name and hours (17:00 to 22:00) and a menu in DOLR (Margherita 12, Diavola 14, Lasagne 15, Tiramisu 7, Espresso 3). Pays 40 DOLR a working day.
- [hint] 13:50 [[Spin Cycle Board]]: nobody hires the player; the player asks the agent to turn the Spin Cycle feed into an app. A user app that starts with 30 users and earns 0.3 DOLR per user a day.
- [hidden; hint if guru_subscriber] 14:15 The player signed up for EMPIRE; a daily newsletter follows.

## Writer notes

- Timeline story beats: opens on Vantor's termination email; GeneralAI welcome; Gino's Y post → Trattoria site (40/day); after its first deploy he asks for a Y post (`restaurant_promo`, "The new website", 16:00 or 30 min after a later launch, sets `restaurant_promo_asked`), and thanks you if you post (`restaurant_promo_thanks`, "Your post": a man ordered one espresso and stayed two hours). Spin Cycle complaints → Spin Cycle Board (lead is on day 1, not 2). EMPIRE offer 20 DOLR. Mara's first post; she can be emailed from today (`journalist_contact`, sets `talked_to_journalist`, honest also `did_journalist_interview`). Hartman on the "testing incident".
- Family: Mom (warm reply +5 trust, ask for money +20 DOLR and −10 trust with `asked_mom_money`, silence −5); brother replies-all. Money: Gary, rent due Sunday.
- Events: `d1_hr_termination`, `d1_gai_welcome`, `d1_landlord_rent`, `d1_mom`, `d1_brother_joke`, `d1_guru`, `d1_y_*`, `restaurant_contact`, `laundromat_contact` (agentStart, lead `d1_y_laundromat`).
- Job offers (the Gino and laundromat posts) go through `spreadJobOffers`: 10:15 to 16:00, at least an hour apart, so on a crowded day they can land later than their `at`.
- Filler times are computed by `spreadMin(id@day)`; MarketWire 09:30 is already up when the day starts.
- Start values: `START` in config.
