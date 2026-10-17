---
title: Spin Cycle feed
aliases: spincycle.test/feed, raw feed, status feed, machine status, Live machine status, M3, machine 3, ST codes
category: sites
from: 1
---

[public] The Spin Cycle feed (spincycle.test/feed) is Spin Cycle Laundry's raw machine status page, linked from spincycle.test as "Live machine status". It lists the machines as lines like "M5 ST=1 T=731", six machines to a page, with more pages after the first (spincycle.test/feed/2). Regulars on Y say nobody can read it. Machine 3 is always out of order.

## Reading the feed

- [hint] The page itself explains what ST and T mean.
- [hint] The feed is live: it follows the clock, with quiet mornings and the busiest hours in the evening and at weekends.
- [public] On day 5 Spin Cycle adds four machines, for twelve.
- [public] It is the ground truth for [[Spin Cycle Board]]: any app showing Spin Cycle's machines can be checked against it.

## Writer notes

- `app/src/engine/laundromat.ts`, deterministic per day and minute. ST 0 free, 1 running, 2 done, 3 out of order; T is seconds left. 8 machines, 12 from day 5. Each machine runs loads (waits for a customer, runs 32 to 57 minutes, waits for pickup), busiest 17:00 to 22:00 and at weekends; about one day in eight another machine breaks in the afternoon and is fixed overnight. Page one always has a load waiting for pickup from last night, so done-as-free can always be caught.
- The day 1 Y post does give the address (spincycle.test/feed) and "M5 ST=1 T=731"; the world bible says the post gives no address and quotes M3.
