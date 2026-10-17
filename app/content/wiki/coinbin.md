---
title: Coinbin
aliases: coinbin.com, wallet, crypto wallet, recovery phrase, seed phrase, Send, Receive
category: sites
from: 1
---

[public] Coinbin (coinbin.com) is the crypto exchange and wallet that holds [[The player]]'s DOLR, white and blue, with a logo of a coin dropping into a slot. Every payment in the game goes through it: [[agent]]'s bills, hosting, rent, client pay, [[Sherwood]] trades. It shows the balance, a chart and the full history, including the four weeks before day 1 (see [[Money and DOLR]]). The player also holds MOONCAT, now worth 0.42 DOLR.

## Sending and receiving

- [public] Receive copies the player's wallet address (0x4417…a9f2).
- [public] Send moves DOLR to another wallet address; it only reaches wallets that exist, and transfers can't be reversed.
- [hint] People who want money from the player give their wallet address in their messages.

## The recovery phrase

- [public] A Recovery phrase card holds 12 words that control the wallet: "Anyone who has them can move your DOLR. Coinbin will never ask for them." Show and Copy buttons reveal it.
- [hint] The phrase itself is on the card; agent won't read it out.
- [public] Coinbin's password is not the same as the player's other passwords.

## Writer notes

- Coinbase parody, replaced Satchel on 2026-10-16. Wallets that accept sends: `WALLETS` in `app/src/engine/wallets.ts` (brother `0xb8d6…e46a`, Mia `0x7c2e…c4d9`, deskjockey `0x5e17…0d7b`); anything else gets "No wallet exists at this address."
- Seed phrase: `harbor violet cushion ladder amber pilot noodle forest rent sugar orbit velvet` (prince-claims.xyz steals it). Password `Coinbin4B!` (coinbln.com steals it).
