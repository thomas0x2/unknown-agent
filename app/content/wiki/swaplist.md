---
title: Swaplist
aliases: swaplist, classifieds, Viktor's site, listing site, marketplace
category: apps
from: 3
---

[public] Swaplist is a plain classifieds site [[The player]] builds after Viktor asks for one, with a purple swap-arrows logo and two ad banners. It is a user app: nobody pays for it directly; it earns 0.3 DOLR per user a day from ads and starts with 20 users.

## Where it comes from

- [public] On day 3 Viktor, recently laid off, posts on Y that he needs to sell his grandfather's pocket watch and there's nowhere simple to list it anymore.
- [hint] Viktor's post lists what he needs: listings with a photo and a price, search, and marking things sold.

## Listings

- [public] Swaplist is empty until its first listing, which appears about an hour of play after the first deploy: Viktor's grandfather's pocket watch, 120 DOLR.
- [public] After that, regulars list about one thing an hour: ines_sells, second_hand_sam, pia_l, kofi_a, steph_m and walked_there_again; one sells a Crane 2028 commemorative plate for 3 DOLR.
- [public] Sellers add "EDIT: sold, thanks." when something goes.
- [public] On day 4 Viktor posts that the watch sold on Swaplist within a day.
- [hint] On day 5 Viktor posts that Swaplist needs a way to message the seller, because people put their phone numbers in listings and get calls at 2am.
- [public] The player can buy too, paying in DOLR through Coinbin, and once messages exist, chat with sellers and make offers.

## When it breaks

- [public] When Swaplist is broken, users complain on Y (Ines, second_hand_sam, Pia L.) and some leave.

## Writer notes

- Template `app/content/apps/swaplist.json` (`firstContentAfter: 60`), events `d3_y_swaplist`, `viktor_contact` (startUsers 20), `d4_viktor_resolve` (`viktor_sold_watch`; sells whenever Swaplist is live), `d5_y_swaplist_messages`. Engine `swaplist.ts`, `swapdeal.ts`.
- No bugs can exist before the first listing; the first listing brings at least one. Bugs: listings titles_shifted, no_photos, price_x100, all_free; search search_exact, filter_ignored; contact contact_dead, wrong_seller; mark_sold no_sold_badge, offers_open.
- Sellers take 75% of asking, Viktor 90%. The leather jacket (45 DOLR) is the brother's gift option. Name is a placeholder; NPC catalogue planned. [planned] late_night_lou's "private film collection" listing (never describe it).
