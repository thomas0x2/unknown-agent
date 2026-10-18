---
title: GeneralAI Properties
aliases: GeneralAI Properties Resident Services, residents@properties.generalai.test, properties.generalai.test, new landlord
category: companies
from: 15
---

[public] GeneralAI Properties is [[GeneralAI]]'s real estate subsidiary. It owns or manages most of the city's rentals and lets LandlordPro set the rents (see [[Ad brands]]).

[public] [[The Current]]'s newsletter on the morning of day 15 reports that GeneralAI's property arm, which already owned or managed 38% of the city's rentals, has bought fourteen more apartment buildings this month, with rents set by software. {{mail:current_newsletter@15}}

[public] On [[Day 15]] it buys Pine Street Apartments from [[Gary Pruitt]], so it becomes [[The player]]'s landlord for Unit 4B. It writes from residents@properties.generalai.test and signs "GeneralAI Properties, Resident Services".

[public] At 15:40 on day 15 it welcomes the player: the lease continues as is, except that LandlordPro has adjusted the weekly rent to 650 DOLR, effective Sunday, October 27. [known] Rent is still collected automatically at the end of the due day; if it isn't there, the unit goes back on the market the next morning. Appeals go to the Municipal Rent Board at rentboard.gov, where they are reviewed automatically. {{mail:d15_gai_properties}}

[public] Resident Services answers every email with a polite support reply. It never lowers the rent, never names a person and points disputes to the Municipal Rent Board.

## Writer notes

- Event `d15_gai_properties`; contact `residents@properties.generalai.test`, character `gai_properties`. Restart `npm run proxy` after pulling (it reads characters.json at startup).
- Being evicted on day 21 or 28 shows the epitaph "Your unit went back on the market." instead of Gary's locks (`epitaph` in `src/ui/view/overlay.ts`, day 15 and later).
