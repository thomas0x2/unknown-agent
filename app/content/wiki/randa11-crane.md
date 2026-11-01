---
title: randa11_crane
aliases: @randa11_crane, randa11, fake Crane, Crane impostor, impostor, the impostor account, lookalike Crane
category: people
from: 5
summary: A fake Y account posing as Randall Crane, with two ones in place of the l's, that praises $VANT on day 6
---

## Who it is

[hidden; public if shown m6_vant_impostor] @randa11_crane is an account on [[Y]] made to look like [[Randall Crane]]'s @randall_crane: the same name, two ones in place of the two l's in the handle, and no verified check. Nobody has said who runs it.

[hidden; public if shown m6_vant_impostor] Its bio copies Crane's with two typos: "Next President of the United States (polling at 112%). Heritage Party. Saving American jobs from the computers. Offical account, the only one. BELIVE IT." Its picture is Crane's, stretched sideways.

## What it posted

- [public] On day 6 (15:40) it praises Vantor: "Huge fan of Vantor ($VANT). Great company, great people. The best." {{y:m6_vant_impostor}}
- [public] On day 6 traders pile into $VANT on the post before anyone notices the spelling, CityPulse reports. {{article:crane-impostor}}

## What happened after

- [public] On day 6 (19:30) the real Crane posts that there is a "FAKE Randall Crane on Y saying nice things about companies". {{y:d6_y_crane}}
- [public] On day 6 (19:40) [[Axel Rook]] answers Crane with "Concerning". {{y:d6_y_axel}}
- [public] On day 6 (20:00) Rook adds that parody accounts must say parody in the name. {{y:d6_y_axel_3}}

## Vibe Check

- [hidden; hint if trader_client] The impostor's $VANT post is a trap for [[Vibe Check]]'s auto-buy: an auto-buy that doesn't check who posted buys 2,000 $VANT off it, and the auto-trade log shows the buy next to @randa11_crane.

## Writer notes

- Post `m6_vant_impostor` in `y_market.json` (`impostor: true`, at 15:40; moved from day 5 on 2026-10-20). Bio in `y-bios.ts`, stretched avatar in `y-avatars.ts`.
- On day 6 a live auto-buy always gets bug `impostor_buy` (`storyBugs` in `apps/sentiment.json`), held until the post is up, once a game, fixable until payday by naming auto-buy > signal > "checking the post is from Crane's real account" (`auto_buy/signal/author`).
- Never posts again after day 6 [open].
