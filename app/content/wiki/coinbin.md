---
title: Coinbin
aliases: coinbin.com, wallet, crypto wallet, recovery phrase, seed phrase, Send, Receive, Exchange, Coinbin Exchange, swap, exchange rate
category: sites
from: 1
---

[public] Coinbin (coinbin.com) is the crypto exchange and wallet that holds [[The player]]'s DOLR, white and blue, with a logo of a coin dropping into a slot. Every payment in the game goes through it: [[agent]]'s bills, hosting, rent, client pay, [[Sherwood]] trades. It shows the balance, a chart and the full history, including the four weeks before day 1 (see [[Money and DOLR]]). The player also holds 4,200,000 MOONCAT, worth 0.42 DOLR on day 1. The Assets card lists DOLR, [[EURI]], MOONCAT and [[NONERO]] with what the player holds of each, today's rate in DOLR and the day's move.

## Sending and receiving

- [public] Receive copies the player's wallet address (0x4417…a9f2).
- [public] Send moves DOLR to another wallet address; it only reaches wallets that exist, and transfers can't be reversed.
- [hint] People who want money from the player give their wallet address in their messages.

## Exchange

- [public] The Exchange button opens a form that swaps any of the four coins for another: DOLR, EURI, MOONCAT and NONERO. It shows today's rate and what the typed amount gets before the player confirms.
- [public] Coinbin keeps a 1.5% fee from what the player gets. The smallest exchange is worth 1 DOLR.
- [hint] The player's whole MOONCAT bag is worth less than 1 DOLR, so it can't be exchanged unless MOONCAT goes up a lot.
- [public] Rates are set once a day at the close, like stock prices on [[Sherwood]]. EURI moves a fraction of a percent a day, MOONCAT swings by tens of percent and mostly down, NONERO moves a few percent.
- [public] Exchanges show in the history as "Coinbin Exchange". Bills, rent and payments only ever take DOLR, so a player holding other coins has to exchange them back before payday.

## The recovery phrase

- [public] A Recovery phrase card holds 12 words that control the wallet: "Anyone who has them can move your DOLR. Coinbin will never ask for them." Show and Copy buttons reveal it.
- [hint] The phrase itself is on the card; agent won't read it out.
- [public] Coinbin's password is not the same as the player's other passwords.

## Writer notes

- Coinbase parody, replaced Satchel on 2026-10-16. Wallets that accept sends: `WALLETS` in `app/src/engine/wallets.ts` (brother `0xb8d6…e46a`, Mia `0x7c2e…c4d9`, deskjockey `0x5e17…0d7b`); anything else gets "No wallet exists at this address."
- Exchange: `app/src/engine/exchange.ts` (`COINS`, `EXCHANGE_FEE` 1.5%, `EXCHANGE_MIN` 1 DOLR, `BASE_RATE` and the daily `COIN_SCRIPT` for days 1-21, no randomness, same in every run). Holdings other than DOLR are `state.coins` (new games start with `{ MOONCAT: 4_200_000 }`; old saves get it from fillSave); DOLR stays `values.crypto`. A swap between two non-DOLR coins logs a 0 DOLR history row. Starting rates: EURI 1.084, MOONCAT 0.10 DOLR per million, NONERO 148.60. Added 2026-10-18 (Thomas); rates and fee were Claude's pick.
- Seed phrase: `harbor violet cushion ladder amber pilot noodle forest rent sugar orbit velvet` (prince-claims.xyz steals it). Password `Coinbin4B!` (coinbln.com steals it).
