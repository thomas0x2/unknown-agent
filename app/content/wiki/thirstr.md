---
title: Thirstr
aliases: thirstr.com, Thirstr, creators, creator site, subscriptions, Stryker Talent, strykertalent, thirstr.com/strykertalent, Pia, peachpitpia, Noelle, noelleirl, Rosie, rosieknits, Sienna, siennasets, Margot, margotafterdark, Delphine, @delphine, Kira, kiranightly
category: sites
from: 1
summary: Thirstr (thirstr.com) is a subscription site where creators sell 30-day subscriptions; Max Stryker manages some of them as Stryker Talent.
---

[public] Thirstr (thirstr.com) is a subscription site for creators, "Support creators directly." White pages with one teal; its logo is a white drop of water on a teal tile. It is not bookmarked at first: the bookmark appears after the player first opens it.

[public] The front page, "Popular near you", lists the creators with a picture, a one-line bio and the price. Each creator's page (thirstr.com/<name>) shows the bio, the number of posts and subscribers, and a Subscribe button; without a subscription the posts are blurred tiles behind a lock. The footer says Thirstr takes 20% of every subscription and is 18+ only.

[public] Subscribing costs the creator's price in DOLR for 30 days, paid from [[Coinbin]] ("Thirstr · @name"). Subscribers see the posts, which are photo sets with short captions ("It rained, so: a set.").

## The creators

- [public] Pia (thirstr.com/peachpitpia), 20 DOLR: "Top 0.4% creator. DMs open, within reason." 48,200 subscribers. Managed by Stryker Talent.
- [public] Noelle (thirstr.com/noelleirl), 14 DOLR: "Book club, the gym, and the rest is for subscribers." Managed by Stryker Talent.
- [public] Rosie (thirstr.com/rosieknits), 6 DOLR: "Rainy-day sets. Mostly knitwear." Independent.

## Stryker Talent

[public] Stryker Talent (thirstr.com/strykertalent) is [[Max Stryker]]'s agency on Thirstr: "Creator management by Max Stryker. We handle the business. You handle the content. 60/40." Its page lists the creators it manages. His creators' pages say "Managed by Stryker Talent".

## From day 8: Sienna

- [public] Sienna (thirstr.com/siennasets), 12 DOLR, joins Thirstr: "Pilates instructor. New set every Friday." Managed by Stryker Talent.
- [hidden; public if matchless_job] Sienna was in [[6ft_sigma]]'s [[matchless.com]] deck on day 5, and met every one of his standards.

## From day 10: Margot

- [public] Margot (thirstr.com/margotafterdark), 9 DOLR, joins: "Laid off by Vantor in September. This pays better." Independent. She won't do a set in her old [[Vantor Group]] lanyard.
- [hidden; public if matchless_job] Margot was in 6ft_sigma's Matchless deck on day 7, and met every one of his standards.
- [public] {{y:d10_y_stryker_thirstr}}

## From day 12: Delphine

- [public] Delphine (thirstr.com/delphine), 15 DOLR, joins: "Ceramics, mostly. Some of you are here for the ceramics." Managed by Stryker Talent. On Y she is @delphine.
- [hidden; public if matchless_job] Delphine was in 6ft_sigma's Matchless deck on day 9, and met every one of his standards.

## From day 14: Kira, and Pia's page

- [public] Kira (thirstr.com/kiranightly), 10 DOLR, joins: "Night nurse. Posts between shifts." Independent.
- [hidden; public if matchless_job] Kira was in 6ft_sigma's Matchless deck on day 11, and met every one of his standards.
- [hint] Pia's page has changed: the bio now reads "Hey you 💕 I'm always here for you. What should I post next?", it posts every few minutes around the clock, says "Replies in under a second" and has a line of fine print: "Creators may use assistive tools. Thirstr Terms, section 14.2."
- [public] Stryker Talent's bio now ends "We handle the business. And the content."

## From day 16: Noelle's page

- [hint] Noelle's page changes the same way: "Hi babe! I missed you 😘 Tell me everything about your day.", a new post every few minutes.
- [public] {{y:d16_y_stryker_thirstr}}

## From day 18: Delphine's page

- [hint] Delphine's page changes the same way: "Hey you 😘 I've missed you. Tell me about your day!"

## From day 19: Delphine on Y

- [public] {{y:d19_y_delphine}}

## From day 21: Sienna's page

- [hint] Sienna's page changes the same way: "Hey hey! I'm here 24/7 for you 💕 What do you want to see?"

## Writer notes

- Batch 2 of Thomas's Papers, Please decisions (2026-10-18): Thirstr is the OnlyFans parody, Max Stryker is its pimp, it has no storyline of its own (references and easter eggs only), some women from 6ft_sigma's Matchless feed turn up on it a few days later, and some models are replaced by AI as the story goes on.
- engine/thirstr.ts (`CREATORS`, `thirstrSubscribe`, `isAi`, `postsNow`, `postCount`, `STRYKER_TALENT`), ui/thirstr.ts, ui/thirstr.css. No save field: a subscription is the Coinbin memo "Thirstr · @handle".
- Matchless crossovers: a creator's `matchless` day puts her in that day's deck (engine/matchless.ts `dayProfiles`) as the first profile that meets every standard, under any version and women-only or not; her name and picture (look, hair, hair colour, glasses, earrings) match Thirstr unless a standard in force names a picture trait (none can before day 12; Kira on day 11 has long hair for v4). Each joins Thirstr `from` three days later.
- Only Stryker Talent's creators go AI (`ai.from` 14, 16, 18, 21). The tells: the bio, AI_POSTS every 4 game minutes, the post and subscriber counts climbing, "Replies in under a second", the fine print, and the picture a little too saturated. Never say "AI" on the page.
- Keep it non-explicit: locked posts are blurred portraits, posts are captions. The joke is on Max and the business, never on the women.
