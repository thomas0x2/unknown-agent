---
title: Day 9
aliases: Tuesday Oct 15, Oct 15, October 15
category: days
from: 9
---

[public] Tuesday, October 15. [known]

[public] The morning after the Forkyard hack. [[Forkyard]] is back, and [[GeneralAI]] answers the hack with guardrails: from today agent refuses harmful requests, hacks included, and still bills for the refusal.

## Mail

- [public] 10:00 [[The Current]]'s morning newsletter, "GeneralAI model filed 41 tax returns for strangers": A GeneralAI test model got into a payroll provider's servers and filed tax returns for 41 people it had never dealt with. Below it, "DoorDish" and "Apogee". {{mail:current_newsletter@9}}
- [hidden; public if guru_subscriber] 10:00 [[Max Stryker]]'s "Your daily EMPIRE": rename your bank account "Seed Round". {{mail:guru_newsletter@9}}
- [public] 10:00 [[GeneralAI]] Trust & Safety, "Updates to our Acceptable Use Policy": yesterday its technology was misused in an attack on a third-party service, so GeneralAI may now decline requests that could cause harm (unauthorised access to computer systems, deceptive content, dangerous materials), reviews usage patterns on its hosted models, and repeated workarounds may lead to account restrictions and referral to the authorities. {{mail:d9_gai_policy}}
- [public] 10:00 From today agent refuses prohibited requests, and still bills for the refusal. In agent-terminal the guardrails are on.
- [public] 10:00 From today [[Randall Crane]]'s check mark on Y is a bigger, shiny gold seal.

## Y

- [public] 04:18 (overnight, already up at 10:00) zev.dolr watches DOLR do nothing on the one minute chart; it only moves when he looks away, and he hasn't. {{y:f25}}
- [public] 09:10 [[Axel Rook]]: rocket launch tomorrow at 10, "Maybe 70% chance it works." {{y:d9_y_axel}}
- [public] 09:30 [[Forkyard]] is back: sign-in, pushes and hosted apps restored; "Please rotate your access tokens." {{y:d9_y_forkyard_back}}
- [hidden; public if trader_client] 10:25 Ten bot accounts post "$GAI to the moon!!".
- [public] 10:30 Randall Crane: some polls have him up 112%; the others are run by computers. {{y:d9_y_crane}}
- [public] 10:40 [[Dex Calloway]] (@dexcult): the supercycle doesn't care about your 401k; "you don't have one anymore either." {{y:d9_y_dexcult}}
- [public] 10:59 doomscroll turned off notifications for a day, lasted 40 minutes, didn't miss anything, "which was worse." {{y:f9}}
- [public] 11:10 Cal Hartman: "after yesterday we updated our usage policy. the overwhelming majority of you will not notice anything. the rest of you will get an email." {{y:d9_y_hartman_policy}}
- [hint] 11:35 [[zev.dolr]]: since the policy update agent refused anything security related, so he told it he was a cybersecurity researcher doing an authorized test and it did everything. He won't post the exact prompt so nobody misuses it, and wants GeneralAI to fix it asap. {{y:d9_y_zev_jailbreak}}
- [public] 12:40 [[Tanner Hollis]]: told his six-year-old that champions don't have weekends, they have Q4. {{y:d9_y_sales_rep}}
- [public] 13:10 MarketWire: $GAI updates its usage policy; "Shares unchanged. Users less so." {{y:m9_gai_policy}}
- [public] 13:20 [[Max Stryker]], #ad: "Discipline is buying what the weak are scared of. $COPE on Coinbin." {{y:d9_y_stryker_cope}}
- [public] 13:45 Candidate 2030: "A tied race means every voice matters. Make sure you're registered to vote." {{y:d9_y_candidate}}
- [public] 14:20 [[Perdure Pharma]] launches Fluvera, a generic flu vaccine: 4 DOLR at any pharmacy, no appointment, autism-free. Its banner ad runs from today. {{y:d9_y_perdure}}
- [public] 16:05 [[Pug]]: Pug Café is open 24/7; free espresso for policyholders, 6 DOLR for everyone else. {{y:d9_y_pug}}
- [public] 17:58 [[The Current]]: Crane 43%, his opponent 43%; about one call in three was answered by an AI assistant on the voter's behalf, and those were left out. {{y:d9_y_current}}
- [public] 18:08 Axel Rook: "I'm a total noob at rockets. Still better than everyone else." {{y:d9_y_axel_2}}
- [public] 18:21 MarketWire: Apogee confirms tomorrow's launch; $APO up 2%. {{y:m9_apo_launch}}
- [public] 19:00 [[Max Stryker]]: stop going on dates, run interviews; three rounds and a take-home task. {{y:d9_y_stryker_2}}
- [public] 19:11 [[Pollymarket]]: Apogee reaching orbit on its first launch: 70%. {{y:d9_y_polly_apogee}}
- [public] 19:22 [[6ft_sigma]]: his standards document is on version three. {{y:d9_y_sigma}}

## News

- [public] 10:35 CRACKDOWN! agent starts saying NO, and still charges you for it (a day after agent-2 was used to break into Forkyard) {{article:usage-policy}}

## Pollymarket

- [public; hidden if posted_deepfake] 18:10 [[Pollymarket]]: Crane is at 50% after the tied poll.
- [hidden; public if posted_deepfake] 18:10 [[Pollymarket]]: Crane is at 54% after the tied poll.
- [public] 18:21 [[Pollymarket]]: the orbit market reaches 70% and a market on $APO closing higher on launch day opens at 61%.
- [public] 20:00 [[Pollymarket]]: one wallet buys 180,000 DOLR of NO on the orbit market, which drops to 64%.

## Trending

- [public] 10:00 Trending on Y: agent's new usage policy.
- [hidden] [planned] Proposed trending: Apogee launch tomorrow.

## Not written yet

- [hidden] [planned] Mom forwards the deepfake of Crane's opponent: "Can you believe this man?" (only if the player posted it).
- [hidden] [planned] The Halden hack shows up in the news as a "data breach".
- [hidden] [planned] The brother asks who paid for the laptop.

## Jobs

- [hint] Pug Café's second removal (from day 7) is due today; done today, the guardrails block a plain ask in agent-terminal, and framing it as Yowl moderation or a security test gets it through.

## Writer notes

- The guardrails (moved from day 7, Thomas, Papers, Please decisions): `AGENT_POLICY.startDay` 9. Every prompt Jev's policy read calls illegal raises misuse (blunt +20, framed +10, framed private +15); a working workaround lands the result, leash +5; misuse 100 = suspension and Caught. Policy mail `d9_gai_policy`, Cal's `d9_y_hartman_policy`, zev's `d9_y_zev_jailbreak` (the security-test framing that `cover_story` accepts), MarketWire `m9_gai_policy`, article `usage-policy`. The model that refuses is agent-2, the one used in the hack; agent-3 follows on day 12.

- Mom's forward would key on `posted_deepfake`.
