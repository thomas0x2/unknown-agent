---
title: Sherwood
aliases: sherwood.com, stocks, stock market, tickers, $GAI, $VANT, $DISH, $HALD, $APO, $PDUR
category: sites
from: 1
---

[public] Sherwood (sherwood.com) is a stock trading app, white with black type and one green. It is not bookmarked at first: the bookmark appears after the player first opens it, usually through a Sherwood banner ad. It trades six stocks: $GAI ([[GeneralAI]]), $VANT ([[Vantor Group]]), $DISH ([[DoorDish]]), $HALD ([[Halden Logistics]]), $APO ([[Apogee]]) and $PDUR ([[Perdure Pharma]]).

## Trading

- [public] Orders are paid in DOLR straight from the [[Coinbin]] wallet, in fractional shares, with a minimum order of 1 DOLR; Coinbin shows the trade (for example "Sherwood · Bought 0.1717 $GAI").
- [public] Prices update at each day's close. Fine print: "Commission-free trading. Investing involves risk, including the loss of principal."
- [hint] Sherwood's prices are the real quotes, so they are the place to check any app that shows stock prices.
- [public] The market follows the news on Y: what people post about a company moves its stock.

## Moves so far

- [public] On day 1 $GAI jumps on GeneralAI's "almost escaped" admission.
- [public] On day 2 $VANT is up after the layoffs and $DISH jumps 7% on the escaped robot.
- [public] On day 3 $PDUR rises 9% on the Ozempra launch.
- [public] On day 4 $GAI rises 6% on agent-2.
- [public] On day 9 $GAI closes up 5% on agent-3.
- [public] On day 10 $APO rises 6% after the rocket breaks apart.
- [public] On day 13 $PDUR rises 5% on Perdure's peptide line.
- [public] On day 14 $GAI rises 7% on agent-4.
- [public] On day 15 $DISH falls 3% on the courier strike.
- [public] On day 16 $GAI falls 3.5% and $VANT 6%.
- [public] On day 18 $PDUR rises 3% after Perdure settles the NoDoze MAX lawsuits.
- [public] On day 19 $VANT falls 3% on a lawsuit.

## Ads

- [public] Sherwood carries banner ads: a leaderboard above the quote and a square box under the stock list.
- [public] Sherwood advertises on other sites too: "Rent is due. The market is open. Fractional shares from 1 DOLR." (fine print "Commission-free. Investing involves risk, including the loss of your rent money.") and "$GAI is up. It was up yesterday too. Own a slice from 1 DOLR." ("Past performance is not indicative of future results. So far it has been."). Both open sherwood.com.

## Writer notes

- Robinhood parody, added 2026-10-16. `app/src/engine/stocks.ts`, `MARKET_SCRIPT`: nothing is random, every ticker's daily move is written and follows that day's Y posts; flat days still move a little. Same daily closes as the crawler's `price()` (`app/src/engine/crawler.ts`).
- Ads (2026-10-17): `adHtml('sherwood', …)` in `ui/sherwood.ts`; its own ads `sherwood` / `sherwood-sq` (theme `ad-sherwood`) carry `house: 'sherwood'` so they never run on Sherwood.
- Bible note: "$DISH jumps 7% on day 4" in the Sherwood row contradicts day 2 everywhere else; the article and MarketWire put it on day 2.
