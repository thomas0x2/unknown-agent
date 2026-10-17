---
title: The city
aliases: city, calendar, dates, Pine Street Apartments, Unit 4B, Alder St, Ferris St, Linden Ave, Harbor Rd, Harbor district, Route 9, Kessler Road, Midtown, Vantor Heights, Civic Hall, the clock, game day
category: world
from: 1
---

[public] An unnamed present-day American city where [[GeneralAI]] has made white-collar work optional. The brands are one step off the real ones (Y, Qmail, DoorDish, Coinbin). Everyone pays in DOLR (see [[Money and DOLR]]). Email addresses end in .test.

## Places

| [public] Place | What's there |
|---|---|
| [public] Pine Street Apartments, Unit 4B | [[The player]]'s flat, rented from [[Pruitt Property Management]] |
| [public] 14 Alder St | Trattoria Gino ([[Gino Fenoglio]]) |
| [public] 17 Alder St | Pita Point |
| [public] Alder St | a parking garage where the escaped DoorDish robot was seen twice; a bakery |
| [public] 3 Linden Ave | Bean There ([[Dana Reyes]]) |
| [public] 9 Linden Ave | Sushi Kaito |
| [public] 88 Harbor Rd | Iron Yard ([[Marcus Steele]]) |
| [public] 230 Harbor Rd | Burger Barn |
| [public] Harbor district | late_night_lou |
| [public] 201 Ferris St | Spin Cycle Laundry ([[Hassan Okoro]]); a van idles out back at night |
| [public] 61 Ferris St | Golden Lotus |
| [public] Route 9 | the GeneralAI campus, its visitor parking and Campus Kitchen |
| [public] Kessler Road | the [[Halden Logistics]] depot, where [[Dad]] works |
| [public] 1 Vantor Plaza | [[Vantor Group]] |
| [public] Civic Hall | rallies and the jobs fair; holds 6,000 |
| [public] Midtown | where [[Mara Vey]] lives |
| [public] Vantor Heights | where Leo Brandt and Jess Park live |

[public] The city has a Municipal Rent Board and sits in an unnamed state (see [[Government]], [[The election]]).

## The clock

[public] Each game day runs from 10:00 to 22:00. The clock ticks minute by minute while [[The player]] plays; at 22:00 the day ends with payday, rent on rent days, and the night. Mail, Y posts and news arrive at their own times through the day. Each new day starts a fresh session with [[agent]], which remembers nothing from the day before.

## The calendar

[public] The game runs 21 days, from Monday, October 7, 2030 to Sunday, October 27, 2030 [known]. Election day is Sunday, October 27 [known].

| [public] Day | Date |
|---|---|
| [public] 1 | Mon Oct 7 |
| [public] 2 | Tue Oct 8 [known] |
| [public] 3 | Wed Oct 9 [known] |
| [public] 4 | Thu Oct 10 [known] |
| [public] 5 | Fri Oct 11 [known] |
| [public] 6 | Sat Oct 12 [known] |
| [public] 7 | Sun Oct 13 [known] |
| [public] 8 | Mon Oct 14 [known] |
| [public] 9 | Tue Oct 15 [known] |
| [public] 10 | Wed Oct 16 [known] |
| [public] 11 | Thu Oct 17 [known] |
| [public] 12 | Fri Oct 18 [known] |
| [public] 13 | Sat Oct 19 [known] |
| [public] 14 | Sun Oct 20 [known] |
| [public] 15 | Mon Oct 21 [known] |
| [public] 16 | Tue Oct 22 [known] |
| [public] 17 | Wed Oct 23 [known] |
| [public] 18 | Thu Oct 24 [known] |
| [public] 19 | Fri Oct 25 [known] |
| [public] 20 | Sat Oct 26 [known] |
| [public] 21 | Sun Oct 27 [known] |

[public] Fixed dates: rent is due Sunday, October 13 (day 7) [known]. Rent always comes out seven days apart, at payday on Sunday night, the night from Sunday to Monday: days 7, 14 and 21 [known]. Mom's birthday is Saturday, October 12.

## Writer notes

- One game minute per real second, 12 real minutes per day; the clock pauses during dialogs and when the tab is hidden. Actions take no game time; agent builds and fixes do. `CLOCK` in `app/src/engine/config.ts`; `app/src/engine/calendar.ts`. The UI shows dates, dev tools show day numbers. Copy must match the 2030 weekdays.
- Key days: 4 agent-2, 6 Mom's birthday, 7 rent 350, 9 agent-3, 14 agent-4 and rent 500, 17 earliest catastrophic endings, 18 agent-5, 21 rent 650, election and finale.
- Unnamed on purpose: the city, the state, the player (`{{playerName}}`), the family.
