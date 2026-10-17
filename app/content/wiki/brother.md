---
title: Brother
aliases: Your brother, brother, bro, bro@family.test, moneybags
category: family
from: 1
---

## Who he is

[public] The player's younger brother (bro@family.test, shown as "Your brother"). He is never named. He texts in lowercase, teases and jokes, means well, and looks up to the player more than he lets on.

## How he talks

[public] "lol ok moneybags. ttyl." "bro i have 4 dollars and a bus pass. ask mom." "sounds fake but ok. send pics."

## His reply-all on day 1

[public] On [[Day 1]] he replies to all on [[Mom]]'s email: "well at least the robots will remember you fondly lmao. you good though?" {{mail:d1_brother_joke}}

## From day 4: Mom's birthday jacket

[public] On [[Day 4]] he emails "mom's birthday": Mom's birthday is Sunday and she needs a new jacket. He asks the player to chip in 40 DOLR by Saturday, or to buy one themselves and he'll cover half.

[hint] He gives the address of his [[Coinbin]] wallet in that email. {{mail:d4_brother_birthday}}

- [public] [if gift_chipped_in] The player sent him the money; about an hour later he confirmed that the jacket was ordered and both names would go on the card. {{mail:d4_brother_paid}} {{mail:d4_brother_paid_over}}
- [public] [if gift_own] The player bought the leather jacket on [[Swaplist]]; he said it was better than what he was going to get and put the player's name on the card. {{mail:d4_brother_bought}}
- [public] [if gift_skipped] The player didn't help, and he said he'd tell Mom they were busy.

## Planned

- [planned] Day 9: he asks who paid for the laptop.
- [planned] Day 10: he asks where the money comes from.
- [planned] Day 15: he falls for a scam, only if the player ran scams.
- [planned] Day 18: he asks the player for money.

## Writer notes

- Persona `bro`; events `d1_brother_joke`, `d4_brother_birthday`, `d4_brother_paid`, `d4_brother_paid_over` (more than 40: "either the job search is going great or you can't count", rest goes to flowers), `d4_brother_bought`.
- Wallet 0xb8d6e201b59c95094b2e417784b38b06c0c7e46a, the only entry in `WALLETS` (engine/wallets.ts) so far.
- Payment: 40 by day 5, +5 trust, flag `gift_chipped_in`; buying the 45 DOLR Swaplist jacket +10, `gift_own`; excuse or silence −5, `gift_skipped`.
