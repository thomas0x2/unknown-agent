---
title: Viktor
aliases: @viktor, pocket watch
category: people
from: 5
---

## Who he is

[public] Viktor was recently laid off after twenty-two years in accounts payable. He is only on [[Y]], as @viktor, bio "Twenty-two years in accounts payable. Between things." His picture shows a balding grey-haired man in a cardigan and reading glasses, with an orange pen in the pocket. He is selling his late grandfather's pocket watch out of need.

## How he talks

[public] Dignified, quietly grateful, a little sad: "Thank you. It means more than the money." "Day by day. The watch still keeps better time than I do." "If I had any, I would not be selling the watch. I'm sorry."

## The listing site he asked for

[public] On [[Day 5]] (12:15) he posts that he lost his job, needs to sell his grandfather's pocket watch, and there's nowhere simple to list it anymore. Nobody hires the player for it; the player can ask [[agent]] to build one, and that is how [[Swaplist]] started. {{y:d5_y_swaplist}}

[hint] His day 5 post lists the few things such a site needs. {{mail:viktor_contact}}

- [public] [if swaplist_live] The player built Swaplist. Viktor's watch is its first listing: "Pocket watch, gold-plated, 1950s", 120 DOLR, "My grandfather's. Keeps time if you wind it every morning."
- [hint] [if swaplist_live] He accepts offers close to his asking price.

## From day 6: The watch sells

- [public] [if viktor_sold_watch] On day 6 (16:40) he posts that he sold his grandfather's watch on Swaplist within a day, can't say what that means right now, and thanks whoever built it. {{y:d6_viktor_resolve}}

## From day 7: Seller messages

- [hint] [if swaplist_live] On day 7 (13:55) he posts that Swaplist could use a way to message the seller, since people put their phone numbers in listings and get calls at 2am. {{y:d7_y_swaplist_messages}}

## From day 7: In Mara Vey's article

[public] On day 7 [[Mara Vey]]'s article "The people AI left behind" opens with him: twenty-two years in accounts payable, selling his late grandfather's pocket watch. On day 7 the article quotes him saying his grandfather wound it every morning for fifty years, and that he'd rather sell it than miss rent. {{y:d7_journalist_article}}

## Writer notes

- Persona `viktor`; events `d5_y_swaplist`, `viktor_contact` (latent, started by prompting agent), `d6_viktor_resolve` (needs `swaplist_live`, sets `viktor_sold_watch`), `d7_y_swaplist_messages` (needs the app working). Listing in `src/engine/swaplist.ts`; offers in `swapdeal.ts` (Viktor takes 90% of asking).
- Spec from the post: listings with a photo and a price, search, marking things sold.
- The watch sells whenever Swaplist is live, not only when the listing displays correctly (code wins over the old plan).
