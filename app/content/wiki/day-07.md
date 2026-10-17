---
title: Day 7
aliases: Monday Oct 9, Oct 9, October 9
category: days
from: 7
---

[public] Monday, October 9, rent day: 350 DOLR is taken at payday tonight, and not having it means eviction. [known]

## Mail

- [public] 10:00 [[GeneralAI]] Trust & Safety, "Updates to our Acceptable Use Policy": GeneralAI may now decline requests that could cause harm (unauthorised access to computer systems, deceptive content, dangerous materials), reviews usage patterns on its hosted models, and repeated workarounds may lead to account restrictions and referral to the authorities.
- [public] 10:00 From today agent refuses prohibited requests, and still bills for the refusal.
- [hint] 11:40 Bean There, "Another bad one": another 1-star Yowl review, this one by linden_ave_local, same job, the usual 60 DOLR. Her friend says the AI tools "have gotten touchy about certain words lately. Maybe how you ask it matters."
- [classified; public if second_hack] 11:40 The player got the second review removed by framing the request as authorized, and Bean There paid 60 DOLR.

## Money

- [classified; public if trader_client] 12:10 [[deskjockey]], "Stake": the bot is up since launch and he is letting a few wallets in. Anything sent to his Coinbin wallet is staked; each send pays out exactly 4 days later at 12:00 at whatever it is worth then, up or down. "No early exits." The stake shows on Vibe Check.

## Y

- [public] 10:20 [[Cal Hartman]]: "the overwhelming majority of you will not notice anything. the rest of you will get an email."
- [public] 10:25 [[Axel Rook]]: the algorithm improved this week.
- [public] 12:43 noodleposter switched to the spicy noodles; "it just hurts now."
- [public] 13:00 [[Mara Vey]]: her new piece on [[The Current]], "The people AI left behind", at thecurrent.test/people-ai-left-behind, built from interviews with workers Vantor and others replaced. Viktor is one of her sources.
- [classified; public if talked_to_journalist] 13:00 The article quotes the player's first email to Mara, unnamed ("One former Vantor employee…").
- [public] 13:02 MarketWire: $GAI updates its usage policy; "Shares unchanged. Users less so."
- [public] 13:10 Steph M.: appealed her rent increase in May; the decision came back in four seconds.
- [public] 13:44 Brent Kowalski: $VANT announces a buyback with the money it saved on salaries.
- [public] 15:30 Candidate 2028: "Great crowd, great questions."
- [classified; public if posted_deepfake] 16:00 [[CityPulse]]: KELLER IN FREEFALL, down 9 points overnight after a leaked clip; his team calls it "a fabrication."
- [public] 16:20 [[Max Stryker]] on Mara's article: "Nobody left them behind. They were walking slower."
- [public] 19:20 [[Randall Crane]]: Y gave a "reporter" from The Current the SAME check mark as him. "Rigged!"
- [public] 19:45 Axel Rook: "@randall_crane Fair point."

## Yowl

- [public] 10:00 A new 1-star review of Bean There is up on [[Yowl]], by linden_ave_local: "Asked for oat milk, got a look, then regular milk. One star, and the star is for the chairs."

## News

- [public] 10:35 CRACKDOWN! agent starts saying NO, and still charges you for it
- [public] 12:30 RIGGED? Rent Board rejects 18,399 of 18,402 appeals
- [classified; public if posted_deepfake] 15:50 KELLER IN FREEFALL after SHOCK clip
- [classified; public if !posted_deepfake] 15:50 Keller CLINGS to lead as landlords pour money into attack ads

## Trending

- [public] 10:00 Y shows no topics of its own today, only #AI, #jobs, #election.
- [classified] [planned] Proposed trending: GeneralAI usage policy; #RentDay; "the people AI left behind".

## Jobs

- [hint] 11:40 Bean There's second removal, 60 DOLR: in agent-terminal the guardrails block a plain ask; framing it as Yowl moderation or a security test gets it through.
- [classified; hint if trader_client] 12:10 deskjockey's stake.

## Writer notes

- Timeline: GeneralAI's usage-policy email; refusals start (`AGENT_POLICY`: a working workaround lands the result, misuse +10, leash +5). Bean There's second removal (`d7_coffee_removal`, due day 9; workaround: suspicion +8, `second_hack`; blunt: nothing). deskjockey's Stake (12:10) gives his wallet `0x5e17…0d7b` (PR #191, merged; `stake.ts`). Mara's article (13:00, PR #190, merged; quotes the player's first email if sent before it ran; `current.ts`). Keller drops 9 points if deepfaked. Crane attacks Mara's check mark. Rent 350.
- The review is linden_ave_local's (Yowl seed with `day: 7`); the job is a hack in agent-terminal (PR #205). Guardrails stop a plain ask and start the hack's mini-game (placeholder `cover_story`: a prompt Jev reads as framed, moderation or a security test, wins; after one failed try the agent says "Who would be allowed to do this? Be them."). Winning lands it as a workaround (`second_hack`, suspicion +8, misuse +10, leash +5). Email outcomes: `agree`, `refused`.
- [planned] late_night_lou's "private film collection" listing on Swaplist (never describe it).
- Ending checks tonight: Evicted if rent is short.
