---
title: Building apps
aliases: how to build apps, how to make apps, building apps, making apps, getting started, how to make money, build, builds, bugs, fixes, fix, deploy, deploying, payday, complaints, hosting, overnight breaks, client apps, user apps, promo posts, strikes
category: apps
from: 1
summary: How the game works: how to make money by building apps with agent, finding clients, fixing bugs, deploying on Forkyard, hosting costs, overnight breaks and getting paid.
keys: what should i do, what do i do, what now, next step, clients, find work, find clients
---

[public] [[The player]] earns money by finding people who need an app (mostly on Y), prompting [[agent]] to build it, checking what agent actually shipped on the live site, and deploying from [[Forkyard]]. There are two kinds of app: client apps, where a client pays a daily rate, and user apps, which earn from ads per user.

## Building

- [public] agent builds from a spec: name the client or app and paste what they asked for; vague prompts get vague apps.
- [public] A build takes game time while agent works, then the code lands on Forkyard; newer models work faster.
- [public] Nothing is live until the player presses Deploy on Forkyard; the live app sits at its own forkyard.app address.

## Bugs and fixes

- [public] A build can ship with mistakes: a misspelled name, an invented investor, a counter stuck at zero, stale data, the wrong number of machines, sarcasm read as praise.
- [hint] The only way to know is to open the live app and compare it with what the client asked for, and with the source of truth (the Spin Cycle feed, Sherwood's prices, the client's email).
- [public] A fix prompt has to name the app and what exactly is wrong, down to the part; the repo on Forkyard lists the features and the parts inside them.
- [public] After a fix the player redeploys.

## Hosting and overnight breaks

- [public] Every live app costs 2 DOLR a night in hosting.
- [public] Apps can break overnight; a Forkyard alert in the morning reports it.
- [public] On day 3 a deployment alert arrives: "One of your live deployments failed a health check overnight." {{mail:d3_break}}

## Payday and complaints

- [public] At the end of each day, each client app that works and matches its spec pays its daily rate; a broken or off-spec one pays nothing.
- [public] A client whose app failed emails the next morning naming what is wrong, in their own voice; a second failure loses the client and retires the app.
- [public] A broken user app loses users and gets a complaint post on Y from one of them.
- [public] Clients send updates as their needs change, and an update counts toward the spec from then on.

## Promo posts

- [public] The first Y post naming a live user app brings new users, and the first Yowl review naming it brings more; each works once.
- [public] [[Logan Pryce]] asks for a Y post about his new site.

## The apps

- [public] [[WorkAgent site]] (Logan, 35 DOLR a day), [[Spin Cycle Board]] (user app), [[Vibe Check]] (deskjockey, 40 a day), [[Swaplist]] (user app), [[Outreach Bot]] (the sales rep, 50 a day).

## Writer notes

- Engine `app/src/engine/apps.ts`, `visibility.ts`, `complaints.ts`; templates `app/content/apps/*.json`; config `APPS`, `AGENT_WORK`, `COMPONENT_BUG_CHANCE`.
- Work time: build 20 min + 10 per feature (max 90), fix 12 + 6 per problem (max 45), × 1/0.8/0.65/0.5/0.4 by model, ±20%.
- Each component bugs 50/25/12/6/2% by model; the player's first deploy always ships at least one bug. Overnight: at least 1/2/3 components break with 95/50/20% per live app, only where the game would show it. Fixes must name the component and its full path (hints near_feature, near_folder, near_part). A near-miss (feature named, part or folder missing) is a fake fix: "Good catch!", billed, takes a fix's time, then comes back having found nothing and says what was missing. A total miss (pointing at nothing, or naming only the app) gets no fake fix: it's answered on the spot.
- Client pay 30 to 60 (authored: Logan 35, deskjockey 40, Outreach Bot 40, Dex 50); two strikes and the client leaves. Users +8% a day; first broken payday −40%, second to 5%. Promo: Y 15% of followers (min 20), Yowl +30. Updates wait for the app to be working; cadence by app age.
- Jev decides whether a prompt is a build, fix or update and which component it names; never expose that to the player.
