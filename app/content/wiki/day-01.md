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
- [public] 10:00 The [[Terminal]] sits in the taskbar next to the browser, a bare you@laptop shell with no model on it.

## Mail

- [public] 10:00 [[The Current]]'s morning newsletter, "Unemployment reaches 30%": Three in ten working-age people in the city are now out of work, the highest rate since records began. Below it, "Vantor" and "Election". {{mail:current_newsletter@1}}
- [public] 10:00 People & Culture at [[Vantor Group]], "Changes to your role": the player's position is eliminated, effective immediately; the final salary payment "has already been made". {{mail:d1_hr_termination}}
- [public] 10:00 [[GeneralAI]], "Welcome to agent": the [[agent]] account is active and billed to the [[Coinbin]] wallet, every prompt at the model's rate. {{mail:d1_gai_welcome}}
- [hidden; public if asked_mom_money] 12:20 Mom sent 20 DOLR when the player asked for money: "Buy vegetables."

## Money

- [public] 10:50 [[Gary Pruitt]], "Rent: due Sunday, October 13": 350 DOLR comes out of the wallet at the end of Sunday, October 13, and he will not take another late payment. [known] {{mail:d1_landlord_rent}}

## Family

- [public] 12:20 [[Mom]], "Are you okay?": she heard about the layoffs and asks if the player is eating. "Your father says hi (he didn't)." {{mail:d1_mom}}
- [public] 13:40 [[Brother]] replies to all: "well at least the robots will remember you fondly lmao. you good though?" {{mail:d1_brother_joke}}

## Y

- [public] 07:40 [[Max Stryker]]: up at 4am; half the city got fired by a computer and went back to sleep. Already up when the day starts. {{y:d1_y_stryker}}
- [public] 09:10 [[CityPulse]] links its "almost escaped" story. Already up when the day starts. {{y:d1_y_citypulse}}
- [public] 09:30 MarketWire: $GAI up 4% premarket on the "almost escaped" news. {{y:m1_gai_escape}}
- [public] 09:50 [[Axel Rook]]: AI will do every job within a few years, and everyone gets universal high income. {{y:d1_y_axel}}
- [public] 10:00 [[The Current]]: unemployment in the city has reached 30%, and 4% of those who lost a job this year have found another; links the morning edition at thecurrent.test. {{y:d1_y_current_jobs}}
- [public] 10:42 [[Logan Pryce]] (@logan_ships): "why combinator-backed, building in stealth"; WorkAgent is looking for a founding engineer to ship its landing page this week, paid in DOLR nightly once it ships. logan@workagent.test {{y:d1_y_logan}}
- [public] 12:10 doomscroll: 400 people at Vantor fired by one email, has read every reply, links CityPulse. {{y:d1_y_doomscroll_news}}
- [public] 12:30 [[Mara Vey]] of [[The Current]] asks people behind this week's AI layoffs to write to her at mara@thecurrent.test. From now on the player can email her. {{y:d1_y_journalist}}
- [public] 13:15 Axel Rook: "@mara_vey Interesting." {{y:d1_y_axel_2}}
- [public] 14:30 [[Wade Tillman]] asks where GeneralAI's model "almost escaped" to, and from what. {{y:d1_y_wade}}
- [public] 16:10 [[Cal Hartman]] on the "testing incident": everyone is safe, the model is safe. {{y:d1_y_hartman}}
- [public] 18:08 [[The Current]]: three weeks to the election; it will post independent polls with sample sizes and margins of error, and no Y polls. {{y:d1_y_current}}
- [public] 19:40 [[Randall Crane]]: another company fired its people and hired a computer that doesn't pay taxes. "SAD!" {{y:d1_y_crane}}
- [public] 19:58 Axel Rook: Y usage at an all-time high. {{y:d1_y_axel_3}}

## News

- [public] 08:40 BLOODBATH AT VANTOR: 400 jobs wiped out in ONE email {{article:vantor-layoffs}}
- [public] 09:00 TERROR IN THE LAB: GeneralAI admits its AI "almost escaped" {{article:almost-escaped}}
- [public] 16:30 THE BATTLE FOR AMERICA BEGINS: Crane storms ahead on Y {{article:election-field}}

## Pollymarket

- [public] 10:00 [[Pollymarket]]: the election market has Randall Crane at 38% and the DOLR peg market at 93%.
- [public] 09:00 [[Pollymarket]]: a market on a GeneralAI model escaping before 2031 opens at 9%.
- [public] 16:30 [[Pollymarket]]: Crane rises to 41%.

## Trending

- [public] 10:00 Trending on Y: AI layoffs; "our AI almost escaped".
- [public] 16:30 Starts trending on Y: the presidential race.

## Jobs

- [hint] 10:42 [[WorkAgent site]] for Logan: a landing page with the name WorkAgent and the one-liner "The future of work is agentic.", a "Backed by" row (Why Combinator, Bonsai Capital, a67x) and an About us page with Logan and his credentials. Pays 35 DOLR a working night once the site is live, nothing up front.

## Writer notes

- Timeline story beats: opens on Vantor's termination email; GeneralAI welcome; Logan's Y post → WorkAgent site (35 a night once live, nothing up front); after its first deploy he asks for a Y post (`logan_promo`, "we're live", 16:00 or 30 min after a later launch, sets `logan_promo_asked`), and thanks you if you post (`logan_promo_thanks`, "your post": the podcast got a new listener).
- Night 1: the first night with a live app always breaks one of them, to teach overnight breaks; Forkyard's mail comes the next morning (see [[Day 2]], `first_break`).
- Mara's first post; she can be emailed from today (`journalist_contact`, sets `talked_to_journalist`, honest also `did_journalist_interview`).
- Hartman on the "testing incident".
- Family: Mom (warm reply +5 trust, ask for money +20 DOLR and −10 trust with `asked_mom_money`, silence −5 if no outcome-matching reply by tonight's summary); brother replies-all. Money: Gary, rent due Sunday.
- Events: `d1_hr_termination`, `d1_gai_welcome`, `d1_landlord_rent`, `d1_mom`, `d1_brother_joke`, `d1_y_*`, `logan_contact`.
- Job offers (Logan's post) go through `spreadJobOffers`: 10:15 to 16:00, at least an hour apart, so on a crowded day they can land later than their `at`.
- The opening hour is kept quiet: Stryker's and CityPulse's posts (and the article behind it) are up before 10:00, Hartman answers in the afternoon, Gary writes at 10:50, Mom at 12:20 and the brother's reply-all comes after lunch. Max Stryker's EMPIRE offer moved to day 2. The Spin Cycle lead moved to day 2 (Thomas, 2026-10-18). An event `at` before 10:00 is delivered at the start and shows its own time.
- Filler times are computed by `spreadMin(id@day)`; MarketWire 09:30 is already up when the day starts.
- Start values: `START` in config.
