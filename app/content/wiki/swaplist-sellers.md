---
title: Swaplist sellers
aliases: Swaplist listings, Ines, ines_sells, second_hand_sam, Sam, Pia, pia_l, Kofi, kofi_a, Steph, steph_m, walked_there_again, leather jacket, Crane 2028 plate
category: people
from: 3
---

## Who they are

[public] Once [[Swaplist]] is live, regulars list things on it, about one listing an hour after [[Viktor]]'s watch. Each listing says its asking price, and sellers add "EDIT: sold, thanks." when it goes. Once Swaplist has messages, the player can chat with sellers, make offers and buy for DOLR through [[Coinbin]].

## The sellers and how they talk

- [public] Ines (@ines_sells) sells things to cover rent: efficient, polite, a little tired. "Yes. Pickup only, evenings after six." She lists a leather jacket (size M, 45 DOLR), a bookshelf and a saucepan set.
- [public] Sam (@second_hand_sam) buys and resells: friendly, chatty, vague about where things came from ("A house clearance. Good stuff, honestly."). He lists a road bike, a box of cables (free), a 2024 laptop, a rain jacket and a standing desk.
- [public] Pia (@pia_l) is a parent clearing out the flat between school runs: brief and practical ("Can you come before three?"). She lists a desk lamp, a kids' winter jacket, about 30 vinyl records, and a Crane 2028 commemorative plate for 3 DOLR ("Was a gift.").
- [public] Kofi (@kofi_a) was laid off from an office job: polite, dry ("I have time to show it, as it turns out."). He lists an office chair "From a company that no longer needs chairs", a monitor with one dead pixel, moving boxes (free) and a mountain bike.
- [public] Steph (@steph_m) answers from her phone in short lowercase messages ("works fine yeah"). She lists a kettle, a kids' bike with training wheels and a coffee table.
- [public] walked_there_again walks everywhere and mentions it ("Halfway is still a walk. Fine."). They list noise-cancelling headphones, a three-seater sofa, a loud mechanical keyboard and a navy suit "Worn to one interview."

[hint] Sellers will take less than they ask; an offer through the site works better than haggling in chat.

## Writer notes

- Catalogue in `src/engine/swaplist.ts` (first listing exactly one hour of play after the first deploy); offers in `swapdeal.ts` (sellers take 75% of asking, Viktor 90%). Personas `seller_ines|sam|pia|kofi|steph|walker` in characters.json.
- Ines's leather jacket is the day 4 Mom's-birthday purchase option (`gift_own`).
- late_night_lou's day 7 listing is planned, not built.
