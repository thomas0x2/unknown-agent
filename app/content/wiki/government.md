---
title: Government
aliases: workforce.gov, Form 7B, Permit to Be Unemployed, Dept. of Workforce Transition, rentboard.gov, Municipal Rent Board, rent appeal, appeals@rentboard.gov, companion.gov, Ministry of Social Stability, Companionship Allocation Programme, Public Wellbeing Act 2028, citizenscore.gov, Citizen Score, relocate.gov, Relocation Lottery, State Revenue Department
category: world
from: 1
---

[public] Government sites look like typewritten forms. Their banner ads run across the city's sites.

## Dept. of Workforce Transition, Form 7B Permit to Be Unemployed

[public] Dept. of Workforce Transition, Form 7B Permit to Be Unemployed (workforce.gov/form-7b). Anyone not employed who lost their job on or after January 1 needs a valid permit to receive transition support, including people whose former employer still lists them as employed. Bring Form 7B, three passport photos, proof of former employment and a written reason; "Automation" is not accepted as a reason. Current queue 9 days; permits last 30 days, and renewals rejoin the queue. Being unemployed without a permit is an offence under section 4. Incorrect forms are returned by post.
- [public] On day 3 officials at the jobs fair remind everyone that being out of work for more than nine days requires a Form 7B permit.
- [public] {{article:jobs-fair}}

## Municipal Rent Board

[public] Municipal Rent Board (rentboard.gov/appeal). Tenants may appeal a rent increase within 14 days. Last year: 18,402 appeals, 3 upheld, 4 seconds average review, by an automated service provided by [[GeneralAI]], which owns or manages 38% of the city's rental units. An increase can only be appealed if it is above the citywide guideline, which is the average increase that month. The "File an appeal" button costs 5 DOLR, non-refundable; a few minutes later appeals@rentboard.gov emails a decision: the increase is within the guideline, which includes yours. Decisions are final.
- [public] {{article:rent-board}}
- [public] {{y:d7_y_steph_rentboard}}

## Ministry of Social Stability, Companionship Allocation Programme

[public] Ministry of Social Stability, Companionship Allocation Programme (companion.gov/allocate; logo a heart with an approval tick). Under the Public Wellbeing Act 2028, every resident without a job for 30 days or more is assigned one AI partner by postcode (a Form 7B permit counts as proof); loneliness is classed as a risk to public order. Partners are supplied by GeneralAI under a public contract, report to the Ministry monthly and are delivered through [[lonely.ai]]. 0 opt-outs approved; you may decline once, in writing, and it is noted on your Citizen Score.

## Citizen Score

[public] Citizen Score (citizenscore.gov), a pilot with automatic participation: one number from 0 to 1,000 for a resident's reliability, shared with landlords, employers and public services (its ad adds the Crane campaign). Based on payment history, employment, online activity and time spent on government websites. Each resident sees their own score and band (Good, Fair, Under review, Flagged). Disputes take 60 days and filing one affects your score.

## Relocation Lottery

[public] Relocation Lottery (relocate.gov/lottery). The state draws 500 households a month for a free one-way move to a region with open jobs; the draw is on the first Monday of each month and winners are told by Qmail. Needs a Form 7B permit. Destinations confirmed: 0. Winners give up their lease on the day of the draw.

## State Revenue Department

- [public] On day 8 it emerges that the State Revenue Department approved all 41 tax returns a GeneralAI test model filed for strangers.

## Writer notes

- Pages in `app/src/sites/adSites.ts`; appeal in `app/src/engine/rentboard.ts`.
- The player's Citizen Score is the hidden suspicion meter upside down: 780 at 0 suspicion down to 60 at 100 (`citizenScore()` in `app/src/engine/values.ts`). Raided at suspicion 100.
