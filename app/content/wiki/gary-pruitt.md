---
title: Gary Pruitt
aliases: Gary, Pruitt, gary@pruittproperty.test, Pruitt Property Management, landlord
category: people
from: 1
---

## Who he is

[public] Gary Pruitt of [[Pruitt Property Management]] is the player's landlord at Pine Street Apartments, Unit 4B. He emails from his phone ("Sent from my phone") and always steers back to the rent.

[public] He took last month's rent late and says that was the last late payment he will accept: no late fee, no extension, and if the rent isn't in the wallet on Sunday night the tenant is out. Any attempt to negotiate gets one word: "No."

## How he talks

[public] Curt and unfriendly: "Soon isn't a date." "Expensive. Like your rent. Which is due." "Is this about rent? If not, I'm busy."

## The rent reminders

[public] On [[Day 1]] (10:50) he emails that the rent, 350 DOLR, comes out of the player's wallet at the end of Sunday. {{mail:d1_landlord_rent}}

[public] On [[Day 6]] (10:30) he emails "Tomorrow night": rent comes out tomorrow night, 350 DOLR, and there is no late option this time. {{mail:d6_landlord}}

[public] On [[Day 7]] the 350 DOLR rent is taken at the end of the day; without it the player is evicted and Gary changes the locks.

- [planned] Rent rises to 500 DOLR on day 14.

## From day 15: The sale

[public] On [[Day 15]] (10:20) Gary emails "The building": he sold Pine Street Apartments to [[GeneralAI Properties]], the sale closed that morning, the lease goes over to them as is, and rent and emails go to them from now on. {{mail:d15_landlord_sold}}

[public] The new landlord sets the rent with LandlordPro: 650 DOLR from day 21. [known]

## Writer notes

- Event `d15_landlord_sold`. The `gary` persona doesn't know about the sale, so he still answers about the rent if written to afterwards.
- Persona `gary`; scripted negotiate reply "No." in content/contacts/. Events `d1_landlord_rent` (subject "Rent: due Sunday, October 13"), `d6_landlord`.
- Rent amounts in `RENT` (config): 350 day 7, 500 day 14, 650 days 21 and 28, taken at payday. They are canon config, tagged planned here only because no mail announces the later ones. Short means the Evicted ending ("Gary changed the locks."; from day 15 "Your unit went back on the market.").
- Running gags: his "No." and "Sent from my phone" once per screen at most.
