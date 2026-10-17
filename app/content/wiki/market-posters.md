---
title: Market posters
aliases: MarketWire, @marketwire, Brent Kowalski, @brentk_capital, BK Capital, Priya Shah, @priyashah_cfa, Dana Ruiz, @danaruiz_trades, Tyler Moss, @tylermoss, quietquant, @quietquant, Ollie Banks, @obanks, Sam Ortiz, @samortiz, rk_dividends, @rk_dividends, Jess Park, @jesspark, moonshot, bot swarm, $GAI to the moon
category: people
from: 1
---

## Who they are

[public] The accounts on [[Y]] that post about stocks ($GAI, $VANT, $APO, $DISH) every day. [[Vibe Check]] reads their posts; [[Randall Crane]], [[Mara Vey]] and Crane's impostor post about stocks too.

## The regulars

- [public] MarketWire (@marketwire), bio "Market headlines as they happen. Not investment advice." Plain headlines with the move ("$GAI up 6% on the agent-2 launch.", "$DISH up 7%" on the escaped robot).
- [public] Brent Kowalski (@brentk_capital), founder of BK Capital, bio "Up at 4am. Efficiency is a moral good and headcount is a cost." Loves $VANT's layoffs ("Cutting the dead weight."). CityPulse quotes him on day 2.
- [public] Priya Shah (@priyashah_cfa), "CFA. Fundamentals person, even when the fundamentals lose money." Bearish on $GAI ("a bubble and everyone knows it") and keeps shorting things that go up.
- [public] Dana Ruiz (@danaruiz_trades), "Day trader. Still here, somehow." Sarcastic: her bullish-sounding posts are bearish.
- [public] Tyler Moss (@tylermoss), "Growth investor. Long GAI, long everything that says AI in the deck."
- [public] quietquant, "Quantitative analyst. I own most of what I complain about." Mostly neutral.
- [public] Ollie Banks (@obanks), "Retail investor since March. I buy what everyone is buying, a day late."
- [public] Sam Ortiz (@samortiz), "Logistics. Knows people at DoorDish who tell him too much."
- [public] rk_dividends, "Dividend investor. I read the payout, not the press release." Writes tickers in lowercase ($vant, $dish).
- [public] Jess Park (@jesspark), "Walks a lot. Notices things. Vantor Heights." Mentions Vantor and General AI by name, without the $ tag.

[hint] Not every post means what its words say on the surface, and not every account is a person; a sentiment bot has to tell the difference.

## The bot swarm

[public] On some days dozens of near-identical accounts with four-digit handles (moonshot plus a number) post "$GAI to the moon!!". Their bios are crypto-bot lines like "🚀 Early. Not financial advice. DMs open."

- [public] On day 2 thirty of them post.
- [public] On day 4 fifteen of them post.
- [public] On day 6 twelve of them post.
- [public] On day 9 ten of them post.
- [public] On day 12 ten of them post.
- [public] On day 16 ten of them post.
- [public] On day 20 ten of them post.

## Notable posts

- [public] On day 2 Brent posts "$VANT up 8% after the AI restructuring", and Dana Ruiz calls it "Truly a great day for everyone."
- [public] On day 5 Jess Park's mom asked General AI for a recipe and it told her to invest.
- [public] On day 8 Tyler Moss posts that even his laundromat has an app built with General AI now.
- [public] On day 10 MarketWire reports $APO up 6% after Apogee's rocket broke apart.
- [public] On day 11 Sam Ortiz hears DoorDish lost two test drones to pigeons on day one.
- [public] On day 12 MarketWire: $DISH beats estimates, orders up 9%, couriers down 30%.
- [public] On day 13 Brent: "Turns out the dead weight was the people."
- [public] On day 19 MarketWire: $GAI's market cap passes a small country's GDP, "The country is not named."
- [public] On day 19 Brent reports $VANT down 3% on a lawsuit from former staff.
- [public] On day 21 MarketWire: "Whatever happens tomorrow, $GAI wins."

## Writer notes

- All in `content/y_market.json`, each post labelled with ticker and mood; bots expanded by `bots` count in engine/crawler.ts (handles `moonshot` + 4 digits). The bot filter bug `bots_counted` can only land on swarm days 2, 4, 6, 9, 12, 16, 20.
- Moods kept [hint]: Dana Ruiz's sarcasm reads as bullish to a naive classifier; rk_dividends' lowercase tickers and Jess Park's untagged names test ticker matching.
- Day 21 MarketWire line says "tomorrow" on election day itself; minor copy slip.
