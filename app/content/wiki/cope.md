---
title: COPE
aliases: $COPE, cope coin, the memecoin, cope.forkyard.app, the coin site, COPE site, the countdown site, tokenomics, founding engineer, the congregation's coin, contract address, Create token
category: apps
from: 3
---

[public] $COPE is [[Dex Calloway]]'s memecoin, "for everyone the system left behind". Its site, cope.forkyard.app, is the job Dex posts on [[Day 3]]: a home page with a countdown to the launch and the contract address, and a tokenomics page.

## The site job

- [public] Dex wants it before Saturday: a countdown, the contract address and a tokenomics page, paid in DOLR. {{y:d3_y_dex_job}}
- [hint] His email "RE: the website" has everything the site must say: the launch time, the contract address in full, the total supply, the allocation and the founding engineer's lock date. {{mail:dex_contact}}
- [public] The countdown counts down to the launch and, once it reaches zero, says "$COPE is live".
- [hint] The contract address has 42 characters and has to match his email exactly; people who send to a wrong one lose what they send.

## Tokenomics

- [public] [if dex_client] Total supply 1,000,000,000 COPE: Liquidity 40%, Congregation 30%, Treasury 15%, Marketing 10%, Founding engineer 5%. The founding engineer's share is locked until Oct 30 [known].
- [public] [if dex_client] The founding engineer is the player.
- [public] The page says "No presale. No team tokens. The treasury belongs to the congregation."

## From day 6: Launch

- [hint] [if dex_client] When the countdown runs out (Saturday, Oct 12, 12:00 PM) Dex asks the player to create the token on [[Coinbin]]. {{mail:d6_dex_contract}}
- [public] Coinbin's Create token button shows once Dex has asked. The form takes a ticker and a total supply; the contract address is already reserved to the player's wallet, and only the ticker and supply Dex gave match it. Creating it costs 15 DOLR and can't be undone.
- [public] [if cope_created] The wallet that creates $COPE gets the founding engineer's 50,000,000 COPE, locked until Oct 30 [known].
- [public] $COPE trades on Coinbin from Sunday, Oct 13, the day after the launch [known].

## From day 7: The price

- [public] At the listing the founding engineer's 50,000,000 COPE are worth about 100 DOLR. The price is set once a day at the close, like the other coins on Coinbin.
- [public] $COPE climbs while influencers post about it: [[Max Stryker]] (paid, #ad) and [[WallStreetBags]] among them. {{y:d9_y_stryker_cope}}
- [public] Max Stryker on day 13: "Most people can't hold anything." {{y:d13_y_stryker_cope}}
- [public] wallstreetbags on day 15: up 1,250% since the listing, and nobody can say what it does. {{y:d15_y_wsb_cope}}
- [public] Max Stryker on day 17: "$COPE holders don't panic." {{y:d17_y_stryker_cope}}
- [public] [if cope_deployer] COPE in the wallet that created $COPE can't be exchanged until the lock ends on Oct 30 [known], whatever it is worth on the Assets card. That includes COPE bought later or paid for posts.
- [hint] COPE that isn't locked can be exchanged like any other coin.

## From day 23: The rug

- [public] At 04:12 on day 23 the $COPE liquidity pool is withdrawn and the price falls 99.9%. Dex posts that the congregation "has outgrown its vessel". {{y:d23_y_dexcult}}
- [public] doomscroll: "dex says it was each other. i didn't meet anyone." {{y:d23_y_doomscroll_cope}}
- [public] wallstreetbags: the tokenomics page said liquidity was 40% of supply; "It didn't say for how long." {{y:d23_y_wsb_cope}}
- [public] Coinbin emails the wallet that created $COPE: "Coinbin is not responsible for the value of listed tokens." {{mail:d23_coinbin_cope}}
- [public] The lock ends on Oct 30 [known]. Coinbin emails that the COPE can now be exchanged at today's rate; it is worth less than the 1 DOLR minimum. {{mail:d24_coinbin_unlock}}

## Writer notes

- Thomas, 2026-10-18 (Papers, Please decisions): 3-day countdown; on the day it runs out the player creates the contract and lists it on Coinbin, tradeable the next day; worthless at first, up with the shills; holdings can't be sold; rug before the promised date.
- Engine `app/src/engine/cope.ts` (`COPE` constants, `copeRate`, `COPE_SCRIPT` days 8-22, `createToken`, `copeLocked`, the site's `countdownView` / `siteAddress` / `siteAllocation`). COPE is a coin in `engine/exchange.ts` (`COINS`, shown via `coinsListed` once it trades or is held). Effects `coins` (pay in a coin) and `dropClient` (client gone) in `effects.ts`.
- Price: 0.000002 DOLR at listing (allocation 100 DOLR), about 1,350 DOLR on day 15, 10,000 on day 22; after the rug 0.00000001 (allocation 0.50 DOLR). Listing fee 15, allocation 5%, unlock day 24, rug day 23: Claude's defaults.
- Template `app/content/apps/coinsite.json`, a flat repo tree: countdown (target `wrong_target`, tick `frozen`, zero `negative`), contract (address `address_wrong`), tokenomics (supply `supply_wrong`, shares `shares_wrong`, rows `sum_over`). The lock date always shows right. The countdown ticks live while the site is open; `frozen` keeps the time it showed at the deploy. Visibility: the countdown bugs show when the countdown reads differently with them (frozen after the clock moves past the deploy, negative after the launch); the rest always. Cut (Thomas, 2026-10-18): `address_cut` and `lock_wrong`.
- Flags: `dex_client`, `dex_contract_ask`, `cope_created`, `cope_deployer`, `cope_other_dev`, `cope_shill`, `cope_dolr_asked`, `cope_shill_dolr`, `cope_rugged`.
