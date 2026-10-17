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

[public] The city has a Municipal Rent Board and sits in an unnamed state with a governor and a state senate (see [[Government]], [[The election]]).

## The clock

[public] Each game day runs from 10:00 to 22:00. The clock ticks minute by minute while [[The player]] plays; at 22:00 the day ends with payday, rent on rent days, and the night. Mail, Y posts and news arrive at their own times through the day. Each new day starts a fresh session with [[agent]], which remembers nothing from the day before.

## The calendar

[public] The game runs 21 days, from Tuesday, October 3, 2028 to Monday, October 23, 2028 [known]. Election day is Monday, October 23 [known].

| [public] Day | Date |
|---|---|
| [public] 1 | Tue Oct 3 |
| [public] 2 | Wed Oct 4 [known] |
| [public] 3 | Thu Oct 5 [known] |
| [public] 4 | Fri Oct 6 [known] |
| [public] 5 | Sat Oct 7 [known] |
| [public] 6 | Sun Oct 8 [known] |
| [public] 7 | Mon Oct 9 [known] |
| [public] 8 | Tue Oct 10 [known] |
| [public] 9 | Wed Oct 11 [known] |
| [public] 10 | Thu Oct 12 [known] |
| [public] 11 | Fri Oct 13 [known] |
| [public] 12 | Sat Oct 14 [known] |
| [public] 13 | Sun Oct 15 [known] |
| [public] 14 | Mon Oct 16 [known] |
| [public] 15 | Tue Oct 17 [known] |
| [public] 16 | Wed Oct 18 [known] |
| [public] 17 | Thu Oct 19 [known] |
| [public] 18 | Fri Oct 20 [known] |
| [public] 19 | Sat Oct 21 [known] |
| [public] 20 | Sun Oct 22 [known] |
| [public] 21 | Mon Oct 23 [known] |

[public] Fixed dates: rent is due Monday, October 9 (day 7) [known]. Mom's birthday is Sunday, October 8.

## Writer notes

- One game minute per real second, 12 real minutes per day; the clock pauses during dialogs and when the tab is hidden. Actions take no game time; agent builds and fixes do. `CLOCK` in `app/src/engine/config.ts`; `app/src/engine/calendar.ts`. The UI shows dates, dev tools show day numbers. Copy must match the 2028 weekdays.
- Key days: 4 agent-2, 6 Mom's birthday, 7 rent 350, 9 agent-3, 14 agent-4 and rent 500, 17 earliest catastrophic endings, 18 agent-5, 21 rent 650, election and finale.
- Unnamed on purpose: the city, the state, the player (`{{playerName}}`), the family.
