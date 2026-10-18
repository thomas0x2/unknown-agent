---
title: Y
aliases: y.com, Y posts, timeline, followers, trending, posts
category: sites
from: 1
---

[public] Y (y.com) is the city's social network, owned by [[Axel Rook]]. Leads for work, news, [[Randall Crane]], [[Mara Vey]] and the market chatter all happen there. [[The player]]'s profile reads "Open to work." and starts with 12 followers.

## How Y works

- [public] Every profile has a bio; story accounts have written ones, strangers have odd ones, and bot accounts have crypto bios.
- [public] The search box finds a handle: Enter opens the profile, or "This account doesn't exist".
- [public] The sidebar shows what is trending that day.
- [public] Posts gain or lose followers; posting more than three times a day costs a few.
- [public] Links to citypulse.news articles in posts open the article, pollymarket.com links open the market, and stack.com links open [[Stack]].
- [public] Verified accounts carry a check mark; Mara Vey's is yellow.
- [hint] Followers open doors: some jobs only come to accounts with enough followers.
- [public] Every time [[The player]] posts, three of the [[Y regulars]] (doomscroll, cat_ceo and [[zev.dolr]]) may each reply under it, a few minutes later. The bigger the account, the more often they do; a brand-new account still gets the odd reply. noodleposter never replies.

## Regulars

- [public] Daily posters: [[Randall Crane]] (@randall_crane, 38.4M followers), [[Axel Rook]] (@axel_rook, 214M), [[Cal Hartman]] (@cal_hartman, 4.3M, all lowercase), [[Max Stryker]] (@max_stryker, 2.9M).
- [public] On day 9 [[Caleb Moxon]] (@caleb_moxon, verified, 41.3K), a safety researcher who just left GeneralAI, starts posting, about once a day.
- [public] News: [[CityPulse]] (@citypulse, verified), [[The Current]] (@the_current), MarketWire (@marketwire); fan account [[Liftoff Daily]]; [[DoorDish]] (@doordish); the betting site [[Pollymarket]] (@pollymarket, verified).
- [public] Market posters: [[WallStreetBags]] (@wallstreetbags, verified), Brent Kowalski (@brentk_capital), Priya Shah (@priyashah_cfa), Dana Ruiz (@danaruiz_trades), Tyler Moss, quietquant, Ollie Banks, Sam Ortiz, rk_dividends, Jess Park; and bot accounts posting "$GAI to the moon!!" on some days.
- [public] Background accounts: noodleposter, cat_ceo, doomscroll, zev.dolr (@zev_dolr), Teo Vasquez, studioghast.
- [public] Leads: [[Logan Pryce]] (day 1), the Spin Cycle regulars (day 1), [[deskjockey]], Viktor and others post when they need something built.
- [public] On day 5 an impostor, @randa11_crane, posts in Crane's name with two ones for the l's and no verified check. {{y:m5_vant_impostor}}

## Trending by day

- [public] Topics trend from the moment the story behind them breaks, so the sidebar fills up over the day.
- [hidden; public from day 2] On day 1: AI layoffs; "our AI almost escaped"; from 13:50 laundromat complaints; from 16:30 the presidential race.
- [hidden; public from day 3] On day 2: the "almost escaped" stunt; from 10:15 $VANT up after restructuring; from 11:35 the water utility break-in; from 12:23 election polls; from 15:40 a delivery robot "escaped".
- [hidden; public from day 4] On day 3: AI layoffs (continued); from 10:05 a weekly appetite jab; from 11:10 the jobs fair queue; from 16:00 "send the machines back".
- [hidden; public from day 5] On day 4: GeneralAI agent-2; the DoorDish robot (still missing); from 13:26 Crane vs. Vantor.
- [hidden; public from day 6] On day 5: is agent-2 worse?; from 16:20 Crane's 71% Y poll; from 17:30 AI-art backlash; from 19:10 the fake Randall Crane.
- [hidden; public from day 7] On day 6: #RentDayEve; from 11:00 Crane's GeneralAI U-turn; from 15:18 $GAI rallying; from 18:50 Apogee static fire.
- [hidden; public from day 8] On day 7: #RentDay; from 12:30 Rent Board appeals; from 13:00 "The people AI left behind"; from 19:20 Crane vs. Y check marks.
- [hidden; public from day 9] On day 8: from 10:50 #ForkyardDown; from 13:20 the Forkyard hack; from 15:05 "agent-2 did what it was asked".
- [hidden; public from day 10] On day 9: agent's new usage policy; from 10:05 agent-3.
- [public] From day 10 the sidebar shows only #AI, #jobs and #election.

## Later changes

- [public] On day 8 Rook says check marks are under review. {{y:d8_y_axel}}
- [public] From day 9 Crane's check mark is a bigger, shiny gold seal.
- [public] On day 15 Rook fires Y's human moderators and moves moderation to an AI that finds nothing wrong in 3 billion posts; appeals go to the same AI. {{article:y-moderation}} {{y:d15_y_axel}}
- [public] On day 17 the presidential debate streams live on Y, hosted by Rook.

## Writer notes

- Bios `app/src/ui/y-bios.ts`, avatars `app/src/ui/y-avatars.ts`, trending `app/content/trending.json` (a topic with `at` trends from that time, `trendingAt` in `src/engine/trending.ts`; days 8 to 28 fall back to #AI, #jobs, #election; proposals need Thomas's OK). Market posts `app/content/y_market.json`.
- Follower rubric `Y`/`POST_BANDS` in config: gains per post by category with ±30% jitter; more than 3 posts a day costs 2%. A post sharing a word with a trending topic rates as a "reaction". The deepfake needs 60+ followers and goes up as the player's own post with a picture (`img`), its likes climbing for hours (`viral`, engine/agentJobs.ts viralLikes); the Bean There shout-out 25+.
- max_followers (`maxFollowers`, engine/yReplies.ts): the most followers any player could have by the end of a day, not one playthrough: every day's three free posts at the best category and quality at the top of their +30% jitter, plus every agent-job follower jump at the top of its spread on its first possible day, counted once (the deepfake, 2800, day 6). 66 on day 1, about 11K on day 6, compounding into the billions by day 28. Shown in dev mode's Y options.
- Regular replies (Thomas, 2026-10-18): on each post the player writes on Y, doomscroll, cat_ceo and zev.dolr are rolled separately; chance = followers / max_followers for the day, at least `Y.replyFloor` (5%). Haiku writes each reply in the regular's character (`y_doomscroll`, `y_cat_ceo`, `y_zev_dolr` in characters.json, Writer mode `y`) when the post goes up, scripted lines if it can't; it lands 4 to 25 game minutes later (`yReplies` queue, `deliverYReplies` on the clock tick) and shows "Replying to @you". Agent-job posts (the deepfake) don't roll: their reactions are scripted.
- Bot swarm days: 2, 4, 6, 9, 12, 16, 20.
