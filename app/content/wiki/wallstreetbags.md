---
title: WallStreetBags
aliases: @wallstreetbags, wallstreetbags, WSB, Wall Street Bags
category: companies
from: 2
summary: WallStreetBags is a verified Y account for a huge online community of retail traders who post their bets and losses on $GAI and $APO
---

[public] WallStreetBags (@wallstreetbags) is a verified account on [[Y]] with 15.8 million followers, run for an online community of retail traders. Bio: "Buy high, sell lower. Fifteen million members, most of them down. Nothing here is financial advice." Its picture is the community's mascot: a man in a dark suit with slicked-back hair, aviators and a green tie.

[public] It posts the community's bets and its members' losses in the same tone. It is always long, mostly on $GAI and $APO, and it reads a falling stock as a buying chance. When it congratulates a member, the member has usually lost money.

[hint] Its congratulations are sarcastic: a post that sounds pleased about a member's trade is about a loss, and a sentiment bot that reads the words literally gets it backwards.

## Its posts

- [public] On day 2 it calls General AI's "almost escaped" model a reason to buy $GAI calls. {{y:m2_gai_stunt}}
- [public] On day 6 it congratulates a member who sold all his $GAI on Thursday, before the rally. {{y:m6_gai_late}}
- [public] On day 8 it goes all in on $APO because Rook gives the launch a 70% chance of working. {{y:m8_apo_rook}}
- [public] On day 12 it says $GAI doesn't go down on bad news, so it stopped reading the news. {{y:m12_gai_growth}}
- [public] On day 13 it is "really proud" of a member who put his rent into $GAI at the open, the day it dipped. {{y:m13_gai_great}}
- [public] On day 15 it notes $APO went up because Rook replaced Y's moderators, and that everyone there is long anyway. {{y:m15_apo_mod}}
- [public] On day 16 its daily $APO thread: still holding, still can't say why. {{y:m16_apo_retail}}
- [public] On day 18 it says $PDUR paid $40M for keeping people awake nine days and the stock went up: "Members, this is the business model." {{y:m18_pdur_wsb}}
- [public] On day 20 its election play is long $APO whoever wins. {{y:m20_apo_vote}}

## Writer notes

- Parody of r/wallstreetbets. Posts live in `content/y_market.json` (handle `wallstreetbags`), labelled like every other market post, so [[Vibe Check]] reads them. The day 6 and day 13 posts carry `literal: bullish` (mood bearish) for the `sarcasm_literal` bug.
- Took over these posts from Tyler Moss, Ollie Banks and Brent Kowalski (same ids, same tickers and moods). Verified and follower count in `Y_VERIFIED` / `Y_FOLLOWERS` (ui/view/y.ts), bio in ui/y-bios.ts, avatar `WSB` in ui/y-avatars.ts.
