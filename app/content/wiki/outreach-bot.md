---
title: Outreach Bot
aliases: outreach bot, cold-email bot, sales bot, rep@closers.test, Closers, sales rep
category: apps
from: 6
---

[public] Outreach Bot is the cold-email bot [[The player]] builds for a sales rep at Closers (rep@closers.test), who speaks in B2B jargon ("circle back", "touch base", "at scale"). He pays 50 DOLR for each day it works at payday.

## The job

- [public] On day 6 the sales rep posts on Y: "Anyone build cold-email bots? Need to hit 200 leads without my thumbs falling off." {{y:d6_y_outreach}}
- [hint] His spec email covers personalisation, a daily cap, unsubscribes, duplicates and a test button. {{mail:outreach_contact}}
- [public] Once the bot is built, more spam reaches the player's own inbox.

## When it breaks

- [public] If the bot is broken or off-spec at payday, the rep doesn't pay and emails "Circling back" the next morning; after two misses he moves on "from this partnership".

## Writer notes

- Template `app/content/apps/outreach.json`; events `d6_y_outreach`, `outreach_contact` (pay 50, flag `built_outreach_bot`; Mindset Daily spam follows).
- Spec: personalised cold emails to 200 leads filling {first name} and {company}; at most 50 a day; working unsubscribe, never email an unsubscriber; no duplicates; Test button sends the first 3 to the rep. Features have no authored bug lists yet.
