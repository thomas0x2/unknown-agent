---
title: EURI
aliases: EURI, euri, the other currency, wrong currency, euro coin
category: world
from: 1
---

[public] **EURI** is a stablecoin pegged to the euro, issued somewhere overseas by a foundation nobody in [[The city]] has heard of. It is not DOLR (see [[Money and DOLR]]): no landlord, shop or client in town takes it. [[Coinbin]] lists it on its exchange, at about 1.08 DOLR, moving a fraction of a percent a day.

[public] EURI turns up in [[The player]]'s life when [[agent]] gets a price wrong, for example a menu priced in EURI instead of DOLR, or when they buy some on Coinbin's exchange.

## Writer notes

- In code it exists only as the `prices_euri` menu bug of the restaurant app (`app/content/apps/restaurant.json`, `app/src/engine/restaurant.ts`): the menu shows its prices in EURI. Since 2026-10-18 also a coin on Coinbin's exchange (`app/src/engine/exchange.ts`); not on Sherwood. The restaurant bug shows the same numbers with the EURI label; it doesn't convert.
- Was called CURO until 2026-10-17 (renamed by Thomas).
