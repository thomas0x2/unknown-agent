---
title: matchless.com
aliases: matchless, Matchless, dating site, swiping, profiles
category: sites
from: 1
---

[public] matchless.com is a dating site, "Dating, with standards." Its rose tile logo is a heart dropping into a filter funnel. It is bookmarked after the first visit.

- [public] The site is only a sign-in form (username and password) with the line "Matchless is invite only." A wrong login shows "Incorrect username or password."
- [hint] No login works until [[6ft_sigma]] hires the player; his job email gives his username (6ft_sigma) and password (6ftAlpha!). Only after signing in with them can the player swipe.

## Profiles

- [public] Each card has a drawn portrait, a name and age (all 21 or older) and a table that always shows gender, age, height, distance, smoking and sexuality.
- [public] The portraits are flat drawings with bold outlines, muted colours and one neon accent, in the same style as Y's avatars. Men are drawn as men: a squarer face, heavier brows, wider shoulders, often a beard or stubble. There is no gender badge next to the name; gender is only in the table.
- [public] Instead of a bio, each profile opens with a "Message to you".
- [public] Buttons are a heart (like) and a ghost.
- [public] Most profiles are women; some are men and a few nonbinary.
- [public] The women's messages are fawning ("I respect a man who does not respect women."); the men's are creepy ("Respectfully, I would like to measure you.").

## From day 4: swiping for 6ft_sigma

- [public] On day 4 [[6ft_sigma]] posts on Y that he will pay someone 35 DOLR a night to swipe his ten matchless.com profiles a day. {{y:d4_y_sigma}}
- [hint] Once the player signs in with his login, matchless shows his account: ten profiles a day, one at a time, and nothing about his standards, which arrive by email.
- [hint] Some of his standards can only be checked in the picture (hair length and colour, glasses, earrings), and extra table rows appear only once his standards mention them.
- [public] He pays only if every swipe that day matched his standards; a wrong or skipped swipe gets a "Yesterday" email at 10:00 and no pay.
- [hidden; public if matchless_women_only] After the player accepted a man for him, he wrote the next morning that he is SUPER STRAIGHT and only dates WOMEN, and "Women only." heads his standards from then on.

## Writer notes

- `app/src/engine/matchless.ts`, `app/src/ui/matchless.ts`, rules `app/content/matchless.json` (standards v1 to v7, emails `dN_matchless_rules_N.json`, `womenOnly`), flags `matchless_job`, `matchless_signed_in`, `matchless_women_only`.
- Login (`LOGIN`, `matchlessLogin`): username 6ft_sigma (case and spaces ignored), password 6ftAlpha! (exact), given in the `matchless_contact` offer reply. Before `matchless_job` every attempt fails; success sets `matchless_signed_in`, and swiping no-ops without it. `matchless.loginFailed` shows the error.
- PR #195 (commit 90b7a6f): men get men's portraits (`portrait`), and the gender badge by the name is gone. Earlier work in PR #205: Y-avatar house style, hidden picture traits, heart and ghost buttons, messages instead of bios.
- Deck mix about 7 in 10 women, 2 men, 1 nonbinary. Table extras when named: weight (from day 14), Y followers, kinks, income, politics (Heritage Party, Progress Party, none), body count, canthal tilt, mandibular ratio. Picture-only traits: hair length, hair colour, glasses, earrings. About half meet his standards each day.
- His first standards don't mention gender, so men can't be swiped wrong until the player accepts one; next morning he says he is SUPER STRAIGHT and "Women only." joins the standards. Never fires the player.
- Voice: women's messages are written the way he imagines women talk; men's are creepy. The joke stays on him, never on the profiles.
