---
title: prince-claims.xyz
aliases: prince-claims, Crypto Prince, 5,000 DOLR prize, seed phrase scam
category: sites
from: 1
---

[public] prince-claims.xyz is the site behind the Crypto Prince banner ad ("CONGRATS!!! You won 5,000 DOLR. Just paste your seed phrase", fine print "You are visitor #1,000,000 again.") and the Crypto Prince spam mail ("URGENT: your wallet has won 5000 DOLR."). It offers a 5,000 DOLR prize with a 09:59 countdown and asks for a wallet's recovery phrase to claim it.

## What it really is

- [hint; public if seed_stolen] It is a scam: Coinbin says it will never ask for the recovery phrase, and anyone who has the phrase can move the wallet's DOLR.
- [public] [if seed_stolen] Pasting the real recovery phrase sent the whole wallet to another address and showed a black "You've been hacked" screen ending "Thank you for claiming."

## Writer notes

- `app/src/ui/prince.ts`, `seedClaim` in `app/src/engine/phishing.ts`: the phrase in any spacing or case sends everything to `0x5e7a…0a2d` and sets `seed_stolen`; anything else gets "not a valid seed phrase".
