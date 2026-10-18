---
title: deskjockey
aliases: @deskjockey, trader@desk.test, the trader, trader, day-trader
category: people
from: 2
---

## Who he is

[public] deskjockey is a very rich, anonymous day-trader with an eight-figure portfolio, and the client for [[Vibe Check]]. On [[Y]] he is @deskjockey, bio "Markets. No DMs."; his picture shows a blue shirt, red braces, slicked hair and green tickers reflected in his glasses.

[hidden] Who he is behind the handle is never revealed.

## How he talks

[public] Too busy watching his stocks to be polite: a few words, no greetings, no sign-offs, no questions back; tickers and P&L; superstitious about bots freezing. "Green, keep it running." "Buy high, then panic." "Busy." "Noted."

## The sentiment bot job

[public] On [[Day 4]] (10:20) he posts on Y: "Need a bot that tells me how Y feels about my stocks, so I can feel it faster. Pays daily." He gives trader@desk.test. {{y:d4_y_trader}}

- [hint] [if trader_client] The player took the job. His email "RE: sentiment bot" lists the tickers, what each ticker card shows, what to filter out, and what the portfolio view needs, and links sherwood.com: prices must match [[Sherwood]]. {{mail:trader_contact}}
- [public] [if trader_client] He pays 50 DOLR a day while Vibe Check works.
- [public] When Vibe Check shows bad data at payday he emails the next morning, in lowercase, that he's "not paying for a day of bad data".
- [hint] [if trader_client] His book holds $GAI, $VANT and a lot of cash; Vibe Check's portfolio view should match what [[Sherwood]] quotes.
- [public] [if trader_client] He also trades by hand on the news. On day 2 he buys 10,000 $VANT on the restructuring news.

## From day 5: Auto-buy on Crane's praise

- [hint] [if trader_client] From [[Day 5]] (10:20), the morning after Vibe Check first works, he emails "Auto-buy": when [[Randall Crane]] praises a company, buy it. The email says what must and must not trigger a buy. {{mail:d5_trader_update}}
- [public] [if trader_client] Ninety minutes after the auto-buy first goes live, Crane praises Apogee ($APO), the bot buys it, and [[Axel Rook]] replies with a rocket. {{y:trader_y_crane_apo}}

## From day 4: His trades and the stake

- [public] [if trader_client] On day 4 he sells 25,000 $VANT after Crane calls Vantor's layoffs disgraceful. {{y:m4_vant_crane}}
- [hint] [if trader_client] On day 5 an account that looks like Crane's praises $VANT, and an auto-buy that doesn't check who posted buys on it. {{y:m5_vant_impostor}}
- [public] [if trader_client] On day 6 Crane praises $GAI and the auto-buy buys it. {{y:d6_y_crane_gai}}
- [public] [if trader_client] On day 7 (12:10) he emails "Stake": the bot is up since launch and he is letting a few wallets in. On day 7 he offers to stake any amount sent to his [[Coinbin]] wallet, each send paying out four days later at 12:00 at whatever it is worth then, up or down with the book, with no early exits.
- [hint] [if trader_client] His wallet address is in the "Stake" email, and the stake shows on Vibe Check. {{mail:d7_trader_buyin}}
- [hint] [if trader_client] On day 8 (11:20) he emails "Two more": add $APO and $DISH to Vibe Check, with the same cards and filters. On day 8 he explains that "Apogee moves every time Rook posts and I want to see it." {{mail:d8_trader_tickers}}
- [public] [if trader_client] On day 9 he buys $APO on the launch news.
- [public] [if trader_client] On day 10 he buys $DISH.
- [public] [if trader_client] On day 11 he sells 30,000 $VANT.
- [public] [if trader_client] On day 12 he buys more $DISH.
- [public] [if trader_client] On day 14 he buys 3,000 $GAI on agent-4.
- [public] [if trader_client] On day 15 he sells 6,000 $DISH on the courier strike.
- [public] [if trader_client] On day 16 he sells 20,000 $VANT.
- [public] [if trader_client] On day 19 he buys more $APO.

## Writer notes

- Persona `trader`; events `d4_y_trader`, `trader_contact`, `d5_trader_update`, `trader_y_crane_apo`, `trader_y_axel_apo`, `d7_trader_buyin`, `d8_trader_tickers`. Manual trades in `TRADER_TRADES` (engine/crawler.ts). Two strikes and he leaves.
- Spec: $GAI and $VANT; per ticker post count, bullish/bearish/neutral split, every post counted; no bots, no spam; portfolio with holdings, cash, today's change. Auto-buy: once per post, right ticker, not on sarcasm or criticism, buys 2,000 shares.
- Book: 42,000 $GAI, 95,000 $VANT, 1,850,000 DOLR cash, about 12.5M. Kept [hint] because the portfolio bugs (total = cash only, values 100× small, P&L sign, negative cash, % 100× big, `stale_prices`) are caught by comparing.
- The day 5 impostor (@randa11_crane) buy is bug `impostor_buy`, guaranteed on a live auto-buy, fixable until payday (component "checking the post is from Crane's real account").
- Stake wallet 0x5e17a0c94b2d83f6e1a7c05b9d42e38f6a1c0d7b. Sends from day 18 on would pay out after the election. Payout uses the book's real value; `stale_prices` makes the stake look frozen.
- His Y profile follower count is a hashed small number; no fixed figure.
