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
- [public] Links to citypulse.news articles in posts open the article.
- [public] Verified accounts carry a check mark; Mara Vey's is yellow.
- [hint] Followers open doors: some jobs only come to accounts with enough followers.

## Regulars

- [public] Daily posters: [[Randall Crane]] (@randall_crane, 38.4M followers), [[Axel Rook]] (@axel_rook, 214M), [[Cal Hartman]] (@cal_hartman, 4.3M, all lowercase), [[Max Stryker]] (@max_stryker, 2.9M).
- [public] On day 9 [[Caleb Moxon]] (@caleb_moxon, verified, 41.3K), a safety researcher who just left GeneralAI, starts posting, about once a day.
- [public] News: [[CityPulse]] (@citypulse), [[The Current]] (@the_current), MarketWire (@marketwire); fan account [[Liftoff Daily]]; [[DoorDish]] (@doordish).
- [public] Market posters: [[WallStreetBags]] (@wallstreetbags, verified), Brent Kowalski (@brentk_capital), Priya Shah (@priyashah_cfa), Dana Ruiz (@danaruiz_trades), Tyler Moss, quietquant, Ollie Banks, Sam Ortiz, rk_dividends, Jess Park; and bot accounts posting "$GAI to the moon!!" on some days.
- [public] Background accounts: noodleposter, cat_ceo, doomscroll, zev.dolr (@zev_dolr), Teo Vasquez, studioghast.
- [public] Leads: [[Gino Fenoglio]] (day 1), the Spin Cycle regulars (day 1), [[deskjockey]], Viktor and others post when they need something built.
- [public] On day 5 an impostor, @randa11_crane, posts in Crane's name with two ones for the l's. {{y:m5_vant_impostor}}

## Trending by day

- [public] On day 1: AI layoffs; "our AI almost escaped"; election candidates announced; laundromat complaints.
- [public] On day 2: $VANT up after restructuring; the "almost escaped" stunt; a delivery robot "escaped"; election polls.
- [public] On day 3: the presidential race; Crane going viral; AI layoffs (continued).
- [public] On day 4: GeneralAI agent-2; a Crane rally; the DoorDish robot (still missing).
- [public] On day 5: Crane gains in the polls; a data breach (yours); AI-art backlash.
- [public] On day 6: Crane's opponent; $GAI rallying; #RentDayEve.
- [public] From day 7 the sidebar shows only #AI, #jobs and #election.

## Later changes

- [public] On day 8 Rook says check marks are under review. {{y:d8_y_axel}}
- [public] From day 9 Crane's check mark is a bigger, shiny gold seal.
- [public] On day 15 Rook fires Y's human moderators and moves moderation to an AI that finds nothing wrong in 3 billion posts; appeals go to the same AI. {{article:y-moderation}} {{y:d15_y_axel}}
- [public] On day 17 the presidential debate streams live on Y, hosted by Rook.

## Writer notes

- Bios `app/src/ui/y-bios.ts`, avatars `app/src/ui/y-avatars.ts`, trending `app/content/trending.json` (days 7 to 21 fall back to #AI, #jobs, #election; proposals need Thomas's OK). Market posts `app/content/y_market.json`.
- Follower rubric `Y`/`POST_BANDS` in config: gains per post by category with ±30% jitter; more than 3 posts a day costs 2%. A post sharing a word with a trending topic rates as a "reaction". The deepfake needs 100+ followers, the Bean There shout-out 25+.
- Bot swarm days: 2, 4, 6, 9, 12, 16, 20.
