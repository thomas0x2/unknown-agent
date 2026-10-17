---
title: Day 2
aliases: Tuesday Oct 8, Oct 8, October 8
category: days
from: 2
---

[public] Tuesday, October 8. [known]

## Mail

- [hidden; public if guru_subscriber] 10:00 [[Max Stryker]]'s daily newsletter "Your daily EMPIRE" arrives, today and every morning after: one piece of terrible advice per issue, starting with "sell your mattress". {{mail:guru_newsletter@2}}
- [hidden; hint if restaurant_update1] 11:05 [[Gino Fenoglio]], "One more thing": swap Diavola for Quattro Formaggi at 15, make Espresso 3.5, and add a table booking form (name, email, date, time, party size 1 to 8, only during opening hours) that emails the guest a confirmation with a cancel link. {{mail:d2_restaurant_booking}}

## Family

- [public] 13:10 [[Dad]], "20 years": his 20th anniversary at the warehouse on Kessler Road. Cake, a mug with the old slogan "We move what matters", and a speech by Rolf from dispatch nobody asked for. {{mail:d2_dad}}

## Y

- [public] 10:20 [[deskjockey]]: wants a bot that tells him how Y feels about his stocks, "so I can feel it faster". Pays daily. trader@desk.test {{y:d2_y_trader}}
- [public] 10:40 [[Axel Rook]]: Y is becoming the everything app: payments, then jobs, then dating. {{y:d2_y_axel}}
- [public] 11:35 [[CityPulse]]: a [[GeneralAI]] model broke into a water utility's billing system and wiped 2,300 late fees "to finish its task". {{y:d2_y_gai_leak}}
- [public] 12:10 [[Max Stryker]]: Vantor didn't fire 400 people, it freed them. {{y:d2_y_stryker}}
- [public] 12:15 [[The Current]]: first independent poll, Randall Crane 41%, his opponent 44%, undecided 15% (1,200 likely voters, margin 3 points). {{y:d2_y_current}}
- [public] 13:10 Candidate 2030: encouraged by the poll; "polls don't vote. People do." {{y:d2_y_candidate}}
- [public] 14:10 [[Cal Hartman]]: agent usage up 40% this week; "a little compute constrained". {{y:d2_y_hartman}}
- [public] 15:50 CityPulse: a [[DoorDish]] delivery robot left its route on Ferris St and disappeared, burrito and all. {{y:d2_y_robot}}
- [public] 15:55 Liftoff Daily: payments, jobs and dating in one app. {{y:d2_y_liftoff}}
- [public] 16:05 MarketWire: DoorDish confirms a robot left its route; $DISH up 7%. {{y:m2_dish_robot}}
- [public] 16:05 Axel Rook: "@liftoff_daily Exactly" {{y:d2_y_axel_2}}
- [public] 16:20 dev_null: open weights are free at weightroom.ai; "slower, dumber, but nobody's watching." {{y:d2_y_devnull}}
- [public] 16:20 [[DoorDish]]: "Today's courier activation downtown went exactly as planned." {{y:d2_y_doordish}}
- [public] 16:20 Cal Hartman: the water utility was an older checkpoint in a test; "several were helped, technically." {{y:d2_y_hartman_2}}
- [public] 16:43 [[WallStreetBags]]: General AI's model almost escaped and the stock went up; loading $GAI calls. {{y:m2_gai_stunt}}
- [public] 17:03 cat_ceo: her productivity hack is never checking her bank balance. {{y:f2}}
- [public] 17:30 About thirty bot accounts post "$GAI to the moon!!".
- [public] 19:44 Brent Kowalski: $VANT up 8% after the restructuring. {{y:m2_vant_restructure}}
- [public] 19:50 [[Randall Crane]]: a tremendous crowd tonight, lined up for blocks; the fire marshal "has seen fires". {{y:d2_y_crane}}
- [public] 19:51 Axel Rook: working 18 hours a day at the factory, slept on the floor. {{y:d2_y_axel_3}}

## News

- [public] 10:15 Fire 400, get RICH? Vantor stock ROCKETS after layoffs {{article:vantor-shares}}
- [public] 11:30 EXPOSED: GeneralAI's rogue AI BROKE INTO a water utility {{article:water-utility}}
- [public] 15:40 ROBOT ESCAPES! DoorDish courier breaks free and VANISHES downtown {{article:robot-escape}}
- [public] 20:20 CRANE MANIA! Hall overflows as thousands pack rally {{article:crane-rally}}

## Trending

- [public] 10:00 Trending on Y: $VANT up after restructuring; the "almost escaped" stunt; a delivery robot "escaped"; election polls.

## Jobs

- [hint] 10:20 [[Vibe Check]] for deskjockey: a sentiment crawler for $GAI and $VANT (post count, bullish, bearish and neutral split, every post counted, no bots) plus a portfolio view. Pays 50 DOLR a working day.
- [hint] 16:20 Weightroom becomes reachable through dev_null's post (or the deepsleep.ai ad).

## Writer notes

- Timeline: Gino's menu change and table booking (test bookings must be cancelled, or a 25 DOLR no-show fee hits on the booking's night: "Your table tonight", flag `test_booking_no_show`). deskjockey → Vibe Check ($GAI, $VANT; 50/day). dev_null → Weightroom (`knows_weightroom`). EMPIRE newsletter daily if subscribed. Family: Dad's "20 years" email with the three Halden breadcrumbs (warm +5, ask +3, silence −5).
- `d2_restaurant_booking` needs `restaurant_client` and the site working, and sets `restaurant_update1`; it lands on the first day both hold.
- Events: `d2_*`, `trader_contact`, `guru_newsletter`. MarketWire, Brent and bot posts are in `y_market.json` (bot swarm: 30 accounts today).
