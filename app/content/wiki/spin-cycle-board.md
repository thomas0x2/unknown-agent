---
title: Spin Cycle Board
aliases: laundromat app, Laundromat status, Spin Cycle app, machine board, laundromat status board
category: apps
from: 1
---

[public] Spin Cycle Board is a user app: a readable status board for Spin Cycle Laundry's machines, built from the raw [[Spin Cycle feed]]. Nobody hires [[The player]] for it; it pays through two ad banners, 0.3 DOLR per user a day, and starts with 30 users.

## Where it comes from

- [public] On day 1 Spin Cycle regulars complain on Y that every machine is busy and the owner's raw status feed ("M5 ST=1 T=731"??) is unreadable: "Someone make it a real app."
- [hint] The player starts it by asking [[agent]] to turn the feed into a readable app; the feed page explains its own codes, and the build prompt should too.
- [public] The app carries a Spin Cycle logo and a "Raw feed" link for checking it against the feed.

## Updates

- [hint] On day 5 Spin Cycle's owner emails "Four more machines": the app needs to show 12 now, not 8, and the feed already lists them.

## Users

- [public] A first Y post naming the live app brings new users, and so does a first Yowl review naming it.
- [public] Users grow a little every day while it works.
- [public] When the board is wrong, its users complain on Y (walked_there_again, Kofi A., Steph M.) and some leave.

## Writer notes

- Template `app/content/apps/laundromat.json`, event `laundromat_contact` (startUsers 30; config default is 100), `d5_laundromat_update`.
- Bugs: machines six_of_eight (only page one), done_as_free, broken_as_free (machine 3 free), raw_codes, failed_fetch (every machine free); refresh no_refresh; minutes minutes_wrong (T is seconds); more_machines still_eight, new_always_free, layout_breaks.
- Users: +8% a day; promo Y = 15% of followers (min 20), Yowl +30, once per platform; first broken payday −40%, second drops to 5%.
- [planned] Day 8: Hassan Okoro launches his own GeneralAI-built app and the player's starts losing users.
