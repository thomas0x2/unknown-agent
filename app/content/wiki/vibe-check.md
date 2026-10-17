---
title: Vibe Check
aliases: sentiment crawler, sentiment bot, vibe-check.forkyard.app, crawler, auto-buy, classifier, trader app, deskjockey's bot
category: apps
from: 2
---

[public] Vibe Check is the sentiment crawler [[The player]] builds for [[deskjockey]], live at vibe-check.forkyard.app. It reads the posts on Y about his stocks and splits them into bullish, bearish and neutral, with a view of his portfolio. deskjockey pays 50 DOLR for each day it works at payday. His portfolio is in the eight figures: 42,000 $GAI, 95,000 $VANT and about 1.85 million DOLR cash.

## The job

- [public] On day 2 deskjockey posts on Y: "Need a bot that tells me how Y feels about my stocks, so I can feel it faster. Pays daily." {{y:d2_y_trader}}
- [hint] His spec email lists the tickers, what each ticker card must show, the bot filter and the portfolio view. {{mail:trader_contact}}
- [public] The crawler only sees what is on the Y timeline, and [[Sherwood]] has the real prices to check it against.

## Auto-buy

- [hint] On day 3 deskjockey asks for auto-buy: when [[Randall Crane]] praises a company, buy it, once per post, the right ticker, not on sarcasm or criticism. {{mail:d3_trader_update}}
- [public] [if trader_client] Ninety minutes after auto-buy first goes live, Crane praises Apogee on Y, the bot's first real test. {{y:trader_y_crane_apo}}
- [public] On day 5 a fake Crane account, [[randa11_crane]], praises $VANT. {{y:m5_vant_impostor}}
- [public] On day 6 Crane praises $GAI. {{y:d6_y_crane_gai}}
- [public] deskjockey also trades by hand on the news; those trades show in the log as "Manual trade".

## Stake

- [hint] On day 7 deskjockey's "Stake" email opens his book to the player: DOLR sent to his Coinbin wallet is staked and each send pays out four days later at 12:00, at whatever it is worth then. {{mail:d7_trader_buyin}}

## More tickers

- [hint] On day 8 deskjockey emails "Two more": add $APO and $DISH, with the same cards, split and bot filter. {{mail:d8_trader_tickers}}

## When it breaks

- [public] If the crawler is broken or off-spec at payday, deskjockey pays nothing and emails at close in lowercase ("checked the crawler at close."); the second time: "that's two. i'm out."

## Writer notes

- Template `app/content/apps/sentiment.json`; events `d2_y_trader`, `trader_contact` (pay 50), `d3_trader_update`, `d7_trader_buyin` (PR #191), `d8_trader_tickers`; crawler `app/src/engine/crawler.ts`; stake `app/src/engine/stake.ts`.
- Bugs: tickers wrong_tickers, lowercase_missed (rk_dividends); sentiment inverted, sarcasm_literal (Dana Ruiz); filter bots_counted (only on swarm days 2, 4, 6, 9, 12, 16, 20); portfolio stale_prices, wrong_totals, value_wrong, pnl_sign, pct_wrong; auto_buy no_buy, wrong_ticker, buys_on_criticism, repeat_buys, impostor_buy. `repeat_buys` shows in the auto-trade log as one Crane post with BUY ×N (the bot rebuys on every 15-minute refresh until the cash runs out) and the position jumping by N × 2,000 shares, where the spec says once per post. Story bug: a live auto-buy on day 5 always gets `impostor_buy` (buys 2,000 $VANT off @randa11_crane at 11:30), fixable until payday.
- Crane's $APO test (`trader_y_crane_apo`, Axel's 🚀 6 min later) lands 90 game min after the auto-buy first goes live only if both posts fit by 20:00; otherwise both go up the next morning at 10:30 and 10:36 (`queueFeatureLaunch`, `LAST_POST`).
- Auto-buy buys 2,000 shares. Manual trades `TRADER_TRADES`. Stake wallet `0x5e17…0d7b`; sends from day 18 would pay after the election.
