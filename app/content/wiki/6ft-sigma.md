---
title: 6ft_sigma
aliases: @6ft_sigma, 6ft_sigma@qmail.com, sigma, 6ft sigma
category: people
from: 4
---

## Who he is

[public] 6ft_sigma is an anonymous man who signs everything with his username. On [[Y]] he is @6ft_sigma, bio "High-value man. 6'0" on most apps. Building something with standards." His picture shows a fleece vest and a cap with a lime Σ. He earns 31,000 DOLR a year and says he has 212 Y followers.

[hidden] His real name and his real height are never given.

## How he talks

[public] Short, defensive, a little grandiose and completely humourless about himself; the problem is always everyone else's taste. "Not yet. The market is adjusting." "No. The filters are the product." "Busy. High-value men usually are." "Noted. My standards stay where they are."

## The swiping job on matchless.com

[public] On [[Day 4]] (11:43) he posts on Y that he needs someone to do his swiping on [[matchless.com]]: follow his standards exactly, ten swipes a day, 30 DOLR paid nightly, only if every one is right. He gives 6ft_sigma@qmail.com. {{y:d4_y_sigma}}

- [hint] [if matchless_job] His job email gives his matchless.com login: username 6ft_sigma, password 6ftAlpha!. {{mail:matchless_contact}}
- [public] [if matchless_signed_in] The player took the job and is signed in as him on matchless.com: ten profiles a day, one at a time, like or ghost. One wrong or skipped swipe and the day is unpaid. He never fires the player.
- [hint] [if matchless_job] His standards are in his emails, not on the site; the player has to check each profile against the latest list.
- [public] [if matchless_job] After an unpaid day, a 10:00 "Yesterday" email names the first mistake and says there is no pay for yesterday.

## His standards emails

[public] While the player swipes for him, he sends stricter standards in a 10:00 email, "New standards", every other day.

- [hint] [if matchless_job] His first standards, by email when the player agrees: age 25 to 42, within 20 miles, non-smokers. They don't mention gender. {{mail:matchless_contact}}
- [hint] [if matchless_job] On day 6 he writes that he turned 32 yesterday and it is "Time to be realistic", and narrows the age range and distance and adds sexuality. {{mail:d6_matchless_rules_2}}
- [hint] [if matchless_job] On day 8 he writes "Adjusting for compatibility." and adds politics and Y followers. {{mail:d8_matchless_rules_3}}
- [hint] [if matchless_job] On day 10 he writes "Some people got through that shouldn't have." and adds income, body count and long hair. {{mail:d10_matchless_rules_4}}
- [hint] [if matchless_job] On day 12 he writes "Someone took my bike." and adds distance, height, kinks and no glasses. {{mail:d12_matchless_rules_5}}
- [hint] [if matchless_job] On day 14 he writes that he has been reading about facial harmony ("Max Stryker says it's a science"), and adds canthal tilt, weight (130 lbs or under) and no earrings. {{mail:d14_matchless_rules_6}}
- [hint] [if matchless_job] On day 16 he writes "Final version." and calls his standards facts, adding a mandibular ratio and blonde, and lowering weight to 115 lbs or under. {{mail:d16_matchless_rules_7}}

## Max Stryker fan

[public] He is a devoted fan of [[Max Stryker]]: his Y bio says "EMPIRE member", and he answers every one of Stryker's dating-advice posts, which he treats as science. Stryker's advice tends to show up in his standards a day later.

[hidden; public if guru_cc_leak] He is an EMPIRE subscriber: on [[Day 5]] his address, 6ft_sigma@qmail.com, is in the CC of Stryker's leaked newsletter. {{mail:guru_newsletter@5}}

- [public] On day 5 he hasn't texted first in four years, "Working as intended." {{y:d5_y_sigma}}
- [public] On day 7 he tried ordering for both and paying for his own; she paid for hers and left before the mains. {{y:d7_y_sigma}}
- [public] On day 8, after Stryker's peptide post, he ordered a stack online; it came in a plain box marked research use only. "Already feel taller." {{y:d8_y_sigma_peptides}}
- [public] On day 9 he is "already ahead": his standards document is on version three. {{y:d9_y_sigma}}
- [public] On day 11: "6'0\" on most apps. Good to have the science confirmed." {{y:d11_y_sigma}}
- [public] On day 13 he bought the 400 DOLR measurement module, "Measuring tomorrow." {{y:d13_y_sigma}}
- [public] On day 15 he raised his standards twice this week, "Problem's almost gone." {{y:d15_y_sigma}}

## Women only

[hidden; public if matchless_women_only] The morning after the player accepted a man for him he wrote: "About the man you accepted yesterday. That one's on me, I didn't spell it out. I thought it was obvious. I am SUPER STRAIGHT. I only date WOMEN. From now on: women only." Every standards list after that starts with "Women only."

## Writer notes

- Persona `sigma_provider` (never insults women; the joke is always on him). Events `d4_y_sigma`, `dN_y_sigma` (his replies to Stryker, odd days 5 to 15), `matchless_contact`, `d6|d8|d10|d12|d14|d16_matchless_rules_N`; rules in `content/matchless.json`, engine `src/engine/matchless.ts`. Turns 32 on day 5.
- Standards (kept [hint] because they solve the job): v1 25–42, within 20 miles, non-smokers. Day 6: 21–35, within 10 miles, straight or bi. Day 8: Heritage Party only, fewer Y followers than 212. Day 10: 21–29, earns ≤30,000, body count ≤3, long hair. Day 12: within 3 miles, 5'4" or under, no kinks listed, no glasses. Day 14: body count ≤1, canthal tilt +4° or more, 130 lbs or under, no earrings. Day 16: 21–25, 5'3" or under, 115 lbs or under, mandibular height to width ratio ≤0.70, blonde.
- Women only (`matchless.json` `womenOnly`, `matchlessWomenOnly`): until `matchless_women_only` is set, men and nonbinary profiles can't be swiped wrong. Accepting a man sets `matchless_man_accepted` at payday; next morning his line is prepended to that day's standards email (with "Women only." added to the list), or comes as its own 10:00 mail "Women"; later standards emails list "Women only." first. The deck changes then (ids end `-w`).
- His Y profile shows a hashed follower count (308), not the 212 he claims.
