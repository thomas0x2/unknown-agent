---
title: Stack
aliases: stack.com, casino, online casino, crypto casino, slots, slot machine, Sevens Deluxe, creator code, STRYKER code
category: sites
from: 1
---

[public] Stack (stack.com) is a crypto casino, dark navy with one bright green and a logo of three stacked green chips. It is not bookmarked at first: the bookmark appears after the player first opens it, through a Stack banner ad or the stack.com link in [[Max Stryker]]'s sponsored posts on [[Y]]. Its one game is a slot machine, Sevens Deluxe, which the site lists as "Stack Originals · RTP up to 97%".

## Deposits and withdrawals

- [public] Stack holds its own balance in DOLR. To deposit, the player sends DOLR from [[Coinbin]] to the Stack deposit address shown on the site (0xbe438c43eb4b683954f59561ce47353661ee7934); it is credited at once, and Coinbin shows the send as "Stack · Sent".
- [public] Withdrawals go back to the Coinbin wallet ("Stack · Withdrawal"), with a minimum of 20 DOLR.
- [public] A creator code added before the first deposit matches that deposit 100%, up to 50 DOLR. The match is bonus money: it can't be withdrawn until it has been bet 40 times over, and withdrawing before then forfeits it. Codes can't be added after the first deposit.
- [public] The only code is STRYKER, Max Stryker's.

## Sevens Deluxe

- [public] Three reels, one line. Bets are 0.50, 1, 2, 5, 10 or 25 DOLR a spin.
- [public] Paytable: three sevens pay 200 times the bet, three bars 50, three bells 25, three lemons 20, three cherries 10; two cherries from the left reel pay 5 and one cherry on the left reel pays 2.
- [public] The page lists the player's last spins with what was bet and won, and a "Live wins" feed of other players' wins.
- [hint] Over many spins the slot pays back less than is bet; the paytable and the player's own wagered and won totals on the page show how it's going.

## Ads

- [public] Stack's banner ads run across the city's sites: "The job market is closed. The casino is open. Got a creator code? 100% deposit match." (fine print: "Bonus must be wagered 40 times before withdrawal. Most bonuses are.") and "Free afternoon? Spins from 0.50 DOLR."

## Max Stryker's sponsored posts

[public] Max Stryker promotes Stack on Y in posts marked #ad, each with his code STRYKER.

- [public] {{y:d3_y_stryker_stack}}
- [public] {{y:d6_y_stryker_stack}}
- [public] {{y:d14_y_stryker_stack}}
- [public] {{y:d18_y_stryker_stack}}

## Writer notes

- engine/casino.ts (balance, `spinSlot`, `applyCasinoCode`, `recordDeposit` on a Coinbin send in the store, `withdrawCasino`), ui/stack.ts, ui/stackIcon.ts, wallet in engine/wallets.ts. Save field `casino` (kept on rewind). Spins draw from the game rng.
- Real RTP is about 88.7% (house edge about 11%, `slotRtp()`, tested between 85 and 90%); about one spin in five wins anything. The "up to 97%" claim is the site's.
- "Live wins" is decoration picked from the clock; max_stryker shows up winning 5,000 DOLR on a 25 bet.
- Ads `stack` / `stack-sq` (house: stack). No Y account of its own yet.
