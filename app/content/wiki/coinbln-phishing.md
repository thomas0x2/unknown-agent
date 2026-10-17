---
title: coinbln.com
aliases: coinbln, coinbln.com/verify, Coinbin Security, security@coinbln.com, Your Bank (totally), phishing, fake Coinbin
category: sites
from: 1
---

[hint; public if coinbin_hacked] coinbln.com/verify is a copy of [[Coinbin]]'s sign-in page on a lookalike address, with an l where Coinbin has an i. It is a phishing page.

## How the player meets it

- [public] The "Your Bank (totally)" banner ad ("Unusual activity on your account. Verify within 24h.", fine print "We are definitely your bank. Which bank? Yes.") links to it.
- [public] On day 3 a mail from "Coinbin Security" (security@coinbln.com, "Unusual sign-in to your wallet") names a "Panes 11 PC" as the new device and asks the player to verify within 24 hours at coinbln.com/verify; it ends "Coinbin will never ask for your password by email." {{mail:d3_coinbin_phish}}
- [hint; public if coinbin_hacked] The sender's address and the link both spell coinbln, not coinbin.

## Signing in there

- [public] [if coinbin_hacked] Signing in there with the real Coinbin password emptied the player's wallet to another address and showed a black "You've been hacked" screen: "We appreciate your business."

## Writer notes

- `app/src/engine/phishing.ts`: the right password (`Coinbin4B!`, from passwords.txt) sends every DOLR to `0x9c1f…e07b` and sets `coinbin_hacked`; any other password gets "Incorrect password. Try again." Mail `d3_coinbin_phish.json`. "Panes" is the in-world Windows knockoff.
