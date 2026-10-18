---
title: Money and DOLR
aliases: DOLR, money, currency, rent, wallet, passwords.txt, MOONCAT, budget, prices, start
category: world
from: 1
---

[public] **DOLR** is the only money [[The player]] uses: a stablecoin pegged 1:1 to the dollar, held in their [[Coinbin]] wallet. The DOLR Foundation says 14,000 merchants take it, including landlords. Its coin is green with a struck-through D. Amounts are written like "350 DOLR" or "89.50 DOLR".

[public] **EURI** is a euro stablecoin nobody in town takes. It shows up when [[agent]] gets a price wrong (for example a menu priced in EURI), and on Coinbin's exchange; see [[EURI]].

[public] [[Coinbin]]'s exchange swaps DOLR, EURI, MOONCAT and [[NONERO]] at daily rates for a 1.5% fee. Everything the player pays still has to be in DOLR.

## Starting out

[public] The player starts day 1 with 100 DOLR, 12 Y followers and [[agent]] on agent-1. Their Coinbin history for the four weeks before day 1 shows two Vantor salaries of 1,240 DOLR (the second marked "Final salary"), 350 DOLR rent to the landlord every week, groceries at GreenBasket, takeout at Noodle Hut, MetroPass (45), Streamly (11.99, unwatched), Corner Pharmacy, Power & Light (86.10), Ringo Mobile (35), coffee at Bean There, Mom's 40 DOLR "for the train", and an 800 DOLR swap into MOONCAT, now worth 0.42 DOLR (−99.4%).

## Rent

- [public] Rent of 350 DOLR is due at the end of Sunday, October 13, day 7 [known].
- [public] Rent of 500 DOLR is due on day 14 [known].
- [public] Rent of 650 DOLR is due on day 21 [known].
- [public] Rent of 650 DOLR is due again on day 28 [known].

[public] Rent is taken at payday at the end of the day. [[Gary Pruitt]] takes no late payment: not enough money means eviction.

## Earning and spending

- [public] Client apps pay their daily rate at payday if the app works; user apps earn 0.3 DOLR per user a day from ads (see [[Building apps]]).
- [public] [[agent]] bills a nightly subscription and every prompt; hosting costs 2 DOLR per live app a night.
- [public] [[Stack]] takes DOLR deposits through Coinbin's Send and pays withdrawals back to the wallet.
- [public] [[Sherwood]] trades stocks in DOLR; [[deskjockey]]'s stake and other wallets are reached through Coinbin's Send.

## passwords.txt

[hint] A file in [[Qdrive]], saved Aug 23 ("passwords / don't lose this"). Most logins reuse "pinestreet4B"; Qdrive is "same as Qmail"; Y is "pinestreet4B!"; Coinbin is the odd one out, "Coinbin4B!". Last line: "Vantor: EmployeeQ3! (stopped working Oct 7)".

## Writer notes

- `START`, `RENT`, `AGENT_COST`, `APPS` in `app/src/engine/config.ts`; history `SEED_TX` in `app/src/engine/state.ts`; `PASSWORDS_TXT` in `app/src/engine/phishing.ts` (exists so the phishing page has a password to steal). Token icons `TOKENS` in `app/src/ui/icons.ts`.
- Start family trust 60 (hidden).
