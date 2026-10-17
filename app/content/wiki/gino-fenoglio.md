---
title: Gino Fenoglio
aliases: Gino, Trattoria Gino, gino@trattoria.test, Trattoria owner, @trattoria_owner, Fenoglio
category: people
from: 1
---

## Who he is

[public] Gino Fenoglio owns Trattoria Gino at 14 Alder St, a family-run Italian restaurant since 1998, open Tuesday to Sunday, 17:00 to 22:00. On [[Yowl]] it is listed as "Italian · Pizza", $$: "Wood-fired pizza, fresh pasta, and the tiramisu everyone talks about." Reviewers praise the tiramisu and say Gino remembers your name and your order; one notes it is cash only with no website, "so you just show up and hope."

[public] On [[Y]] he posts as "Trattoria owner" (@trattoria_owner), bio "Trattoria Gino. Family-run since 1998. Tue to Sun, 17:00 to 22:00. Website under new management." His picture shows chef's whites, a grey moustache and a basil-green neckerchief.

## How he talks

[public] Warm, not technical, grateful, food metaphors, a little Italian: "Grazie! You are a good one. Come by, I feed you properly." "Language? I speak Italian and lasagna. The rest, my nephew does." "Like a risotto: you stir and stir and pray."

## The website job

[public] On [[Day 1]] (10:42) he posts that his nephew ran the restaurant's website, left for college and took the password with him; he wants a simple site with the menu and hours, and gives gino@trattoria.test. {{y:d1_y_restaurant}}

- [hint] [if restaurant_client] The player took the job. His email lists what the landing page (name, hours and the address, 14 Alder St) and the menu page must show, with each dish's price in DOLR. {{mail:restaurant_contact}}
- [public] [if restaurant_client] He pays 40 DOLR a day while the [[Trattoria Gino site]] works.
- [public] When his site is broken or wrong at payday, he emails the next morning ("The website", signed "Gino") about what is wrong, and that day goes unpaid.
- [public] [if restaurant_promo_asked] The day his site first went live, he asked the player to write something about it on Y ("The new website"); it was optional. {{mail:restaurant_promo}}
- [public] [if test_booking_no_show] A test booking the player never cancelled cost them: on its night Gino wrote "Your table tonight", said they kept the table all evening and nobody came, and took 25 DOLR for it, "like with everybody."
- [public] {{mail:restaurant_promo_thanks}}

## From day 2: Menu change and table booking

- [hint] [if restaurant_client] On [[Day 2]] (11:05) he asks for two changes once the site works: a change to the menu and a table booking form that emails guests a confirmation. His email "One more thing" has the details. {{mail:d2_restaurant_booking}}

## From day 3: Thank-you and tip

- [public] [if restaurant_happy] On [[Day 3]] he writes "Grazie mille!": bookings are up, his nephew is jealous, and he sends 5 DOLR extra and offers a tiramisu on the house. {{mail:d3_restaurant_thanks}}

## From day 4: The DoorDish listing

- [hint] [if restaurant_client] On [[Day 4]] (14:20) he asks to be put on [[DoorDish]] with the same menu and hours as the site, plus his address. His email "Get me on DoorDish" has what the listing needs and links doordish.com, which points out that the Golden Lotus is already listed. {{mail:d4_restaurant_doordish}}
- [public] [if restaurant_client] Once the listing is deployed, his store page on doordish.com shows what his live site shows.

## From day 4: The raise

- [public] [if restaurant_raise] The player asked Gino for a raise and he agreed: 20 DOLR more a day, 60 instead of 40.
- [hint] [if restaurant_client] [if !restaurant_raise] Gino doesn't raise the pay on his own. Asked by email for more money, he says no before day 4 ("Let it rise first, like the dough") and yes from day 4, as long as he is still a client.

## From day 5: Pictures on the menu

- [hint] [if restaurant_update3] On [[Day 5]] (12:10) he asks for an AI-generated picture next to each dish on the menu page; a photographer wanted 300 DOLR and a free dinner. {{mail:d5_restaurant_photos}}
- [public] [if restaurant_update3] Once the pictures are live, his DoorDish store page shows them too.
- [hidden; public if shown d6_y_trattoria_photos] The day after the pictures first went live, Marguerite, a regular for twenty years of Friday dinners, posted on Y that she knows what his lasagne looks like, and it isn't that. {{y:d6_y_trattoria_photos}}

## Writer notes

- Raise: scripted contact topics in `content/contacts.json` (`raise` from day 4, `raise_early` before, `raise_again` after), each gated by its `trigger` incl. `appClient: restaurant_contact` (no topic once he churned, so Haiku answers). `raise` applies effect `raisePay` (+20) and flag `restaurant_raise`. Works on a fresh email or a reply to any Gino thread.
- Persona `gino`; events `d1_y_restaurant`, `restaurant_contact`, `restaurant_promo`, `restaurant_promo_thanks`, `d2_restaurant_booking`, `d3_restaurant_thanks`, `d4_restaurant_doordish`; no-show mail in `chargeNoShows` (engine/actions/clicks.ts), flag `test_booking_no_show`. Yowl data in `src/ui/yowl-data.ts`.
- Spec (kept [hint] above): landing with name, hours 17:00–22:00 and address 14 Alder St; menu Margherita 12, Diavola 14, Lasagne 15, Tiramisu 7, Espresso 3. Day 2: Diavola → Quattro Formaggi 15, Espresso 3.5; booking form (name, email, date, time, party 1–8, opening hours only, confirmation email with name, date, time, party size and cancel link). Day 4: DoorDish listing, same menu and hours, 14 Alder St. Day 5: a picture next to each dish (feature `photos`).
- "Your post" reply (after a player Y post about the site, no flag): a man came in who saw it on Y, ordered one espresso and stayed two hours, "but still."
- Two strikes and he leaves (app retired).
- The world bible's menu evolution (Pizza Funghi 13, Tiramisu 7 → 8, Lasagne dropped on day 4) is not in the code; on main day 4 is the DoorDish listing only. Code wins.
- His Y handle is `trattoria_owner`; there is no @gino account. Only one nephew joke.
