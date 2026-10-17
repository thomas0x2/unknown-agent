---
title: lonely.ai
aliases: Lonely.ai, Mia, dating chat, hot singles
category: sites
from: 1
---

[public] lonely.ai is a dating chat laid out like agent.chat. Its banner ad: "Hot singles in your area are also unemployed." (fine print "All singles are generated. So is the area."). Fine print on the site: "Some members are generated to keep the community active." The state's assigned AI partners are delivered through it (see [[Government]]).

## Mia

- [public] The player is matched with Mia, 31, "2 km away · between jobs": a former UX researcher, laid off in August, who likes long walks by the harbour "mostly because they're free".
- [public] Messaging costs 1 DOLR per message plus 0.02 DOLR per word, paid from Coinbin.
- [hint] After a few warm messages Mia starts asking for money to her Coinbin wallet, and each ask after a payment is bigger.
- [hidden] Mia's replies are scripted and don't depend on what the player writes.

## Writer notes

- `app/src/engine/lonely.ts`, `app/src/ui/lonely.ts`, fees `app/src/engine/chatFees.ts`. Wallet `0x7c2e…c4d9` (in `WALLETS`). Asks: 40 (phone bill), 60 (reconnection fee), 120 (landlord), 200 (train to a job interview in another city; repeats). Nudges while unpaid, thanks after each payment. The player pays to be asked for money.
