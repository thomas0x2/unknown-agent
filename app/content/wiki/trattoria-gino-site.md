---
title: Trattoria Gino site
aliases: Trattoria Gino, restaurant site, Gino's website, trattoria site, restaurant app, booking form, DoorDish listing
category: apps
from: 1
---

[public] The Trattoria Gino site is the website [[The player]] builds for [[Gino Fenoglio]]'s restaurant at 14 Alder St, through [[agent]] and [[Forkyard]]. Gino is a paying client: 40 DOLR for each day the site works at payday. His nephew ran the old site and left for college with the password.

## The job

- [public] On day 1 Gino posts on Y that he needs a simple site with his menu and hours, and asks people to email gino@trattoria.test. {{y:d1_y_restaurant}}
- [hint] Gino's reply lists what the site needs: a landing page and a menu page, with exactly the name, hours, dishes and prices in his email. {{mail:restaurant_contact}}

## Gino's updates

- [hint] On day 2 Gino emails "One more thing": a menu change and a table booking form; his email lists exactly what each booking must do. {{mail:d2_restaurant_booking}}
- [hint] Test bookings the player makes on the live site are real bookings; Gino expects guests on their night.
- [public] On day 3 Gino thanks the player ("Grazie mille!") if the site never broke, with 5 DOLR extra and a tiramisu on the house. {{mail:d3_restaurant_thanks}}
- [hint] On day 4 Gino asks to be put on [[DoorDish]] with the same menu and hours as the site and his address, 14 Alder St. {{mail:d4_restaurant_doordish}}
- [public] Once the DoorDish listing is deployed, Trattoria Gino appears on doordish.com, showing what the listing shows.

## The Y post

- [public] The day the site first goes live, Gino asks the player to write about it on Y; it is optional. {{mail:restaurant_promo}}
- [public] {{mail:restaurant_promo_thanks}}

## When it breaks

- [public] If the site is broken or doesn't match his requests at payday, Gino pays nothing that day and emails the next morning ("The website"), naming what is wrong; the second time, he finds someone else.

## Writer notes

- Template `app/content/apps/restaurant.json`; engine `app/src/engine/restaurant.ts`; events `d1_y_restaurant`, `restaurant_contact` (pay 40), `d2_restaurant_booking`, `d3_restaurant_thanks` (`restaurant_happy`), `d4_restaurant_doordish`, `restaurant_promo`, `restaurant_promo_thanks` (after a Y post about the site, Gino writes "Your post": a man who saw it came in, ordered one espresso and stayed two hours; not a flag, so kept out of the body).
- Spec v1: Trattoria Gino, 17:00–22:00, Margherita 12, Diavola 14, Lasagne 15, Tiramisu 7, Espresso 3. Day 2: Diavola → Quattro Formaggi 15, Espresso 3.5; booking form (name, email, date, time, party size 1–8, only in opening hours; guest gets a confirmation with name, date, time, party size and a cancel link).
- Bugs by feature: landing hours_wrong, name_wrong; menu prices_missing, prices_euri (prices in EURI), prices_wrong, wrong_items (invented dishes like Risotto ai Funghi, renamed ones like "Expresso"); booking no_email, wrong_date, wrong_time, sent_to_restaurant, party_wrong, name_wrong_mail, no_hours_check, past_dates, dead_button.
- An uncancelled test booking: on its night Gino writes "Your table tonight" and keeps a 25 DOLR no-show fee (`test_booking_no_show`).
- The world bible's menu evolution (Pizza Funghi 13, Tiramisu 8, Lasagne dropped day 4) is not in the code.
