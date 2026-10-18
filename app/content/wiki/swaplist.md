---
title: Swaplist
aliases: swaplist, classifieds, Viktor's site, listing site, marketplace
category: apps
from: 5
---

[public] Swaplist is a plain classifieds site [[The player]] builds after Viktor asks for one, with a purple swap-arrows logo and two ad banners. It is a user app: nobody pays for it directly; it earns 0.25 DOLR per user a day from ads and starts with 20 users.

## Where it comes from

- [public] On day 5 Viktor, recently laid off, posts on Y that he needs to sell his grandfather's pocket watch and there's nowhere simple to list it anymore. {{y:d5_y_swaplist}}
- [hint] Viktor's post lists what he needs: listings with a photo and a price, search, and marking things sold. {{mail:viktor_contact}}

## Listings

- [public] Swaplist is empty until its first listing, which appears about an hour of play after the first deploy: Viktor's grandfather's pocket watch, 120 DOLR.
- [public] Nobody lists anything on Swaplist after 20:00. A listing that would go up later appears the next morning instead, so a site deployed at 19:30 gets its first listing at 10:30 the next day.
- [public] After that, regulars list about one thing an hour: ines_sells, second_hand_sam, pia_l, kofi_a, steph_m and walked_there_again; one sells a Crane 2030 commemorative plate for 3 DOLR.
- [public] Sellers add "EDIT: sold, thanks." when something goes.
- [public] On day 6 Viktor posts that the watch sold on Swaplist within a day. {{y:d6_viktor_resolve}}
- [hint] On day 7 Viktor posts that Swaplist needs a way to message the seller, because people put their phone numbers in listings and get calls at 2am. {{y:d7_y_swaplist_messages}}
- [public] The player can buy too, paying in DOLR through Coinbin, and once messages exist, chat with sellers and make offers.

## When it breaks

- [public] When Swaplist is broken, users complain on Y (Ines, second_hand_sam, Pia L.) and some leave.

## Writer notes

- Template `app/content/apps/swaplist.json` (`firstContentAfter: 60`), events `d5_y_swaplist`, `viktor_contact` (startUsers 20), `d6_viktor_resolve` (`viktor_sold_watch`; sells whenever Swaplist is live), `d7_y_swaplist_messages`. Engine `swaplist.ts`, `swapdeal.ts`.
- Posting hours (`postingTime`, `SWAP_LAST_POST` in `swaplist.ts`): listing times, the first one included, count only 10:00-20:00, so a bug a listing shows never lands too late to be seen. Sales can still happen after 20:00.
- No bugs can exist before the first listing; the first listing brings at least one. Bugs: listings titles_shifted, no_photos, price_x100, all_free; search search_exact, filter_ignored; contact contact_dead, wrong_seller; mark_sold no_sold_badge, offers_open.
- Sellers take 75% of asking, Viktor 90%. The leather jacket (45 DOLR) is the brother's gift option. Name is a placeholder; NPC catalogue planned. [planned] late_night_lou's "private film collection" listing (never describe it).
