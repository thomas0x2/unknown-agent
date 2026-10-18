---
title: Spin Cycle Board
aliases: laundromat app, Laundromat status, Spin Cycle app, machine board, laundromat status board
category: apps
from: 1
---

[public] Spin Cycle Board is a user app: a readable status board for Spin Cycle Laundry's machines, built from the raw [[Spin Cycle feed]]. Nobody hires [[The player]] for it; it pays through two ad banners, 0.5 DOLR per user a day, and starts with 30 users.

## Where it comes from

- [public] On day 2 Spin Cycle regulars complain on Y that every machine is busy and the owner's raw status feed ("M5 ST=1 T=731"??) is unreadable: "Someone make it a real app." {{y:d2_y_laundromat}}
- [public] If the app isn't built by day 3, they post again that evening. {{y:d3_y_laundromat}}
- [hint] The player starts it by asking [[agent]] to turn the feed into a readable app; the feed page explains its own codes, and the build prompt should too. {{mail:laundromat_contact}}
- [public] The app carries a Spin Cycle logo and a "Raw feed" link for checking it against the feed.

## Updates

- [hint] On day 5 (12:30) Kofi A. posts on Y that Spin Cycle has four new machines. That post adds the twelve-machine update to the app: the feed already lists 12 machines and the board should show them all. Nobody emails about it; the users complain on Y if the board still shows 8. {{y:d5_y_kofi_news}}

## Users

- [public] A first Y post naming the live app brings new users, and so does a first Yowl review naming it.
- [public] Users grow a little every day while it works.
- [public] When the board is wrong, its users complain on Y (walked_there_again, Kofi A., Steph M.) and some leave.

## Writer notes

- Template `app/content/apps/laundromat.json`, event `laundromat_contact` (startUsers 30; config default is 100), `d5_y_kofi_news` (its onDeliver updateApp adds more_machines; a no-op without the app). The owner's "Four more machines" email was cut (Thomas, 2026-10-17).
- Bugs: machines six_of_eight (only page one), done_as_free, broken_as_free (machine 3 free), raw_codes, failed_fetch (every machine free); refresh no_refresh; minutes minutes_wrong (T is seconds); more_machines still_eight, new_always_free, layout_breaks.
- Users: +8% a day; promo Y = 15% of followers (min 20), Yowl +30, once per platform; first broken payday −40%, second drops to 5%.
- [planned] Day 8: Hassan Okoro launches his own GeneralAI-built app and the player's starts losing users.
