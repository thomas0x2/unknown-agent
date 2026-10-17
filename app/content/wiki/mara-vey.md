---
title: Mara Vey
aliases: Mara, Vey, @mara_vey, mara@thecurrent.test, mara_vey
category: people
from: 1
---

## Who she is

[public] Mara Vey is a reporter at [[The Current]], a reader-funded paper, covering people displaced by AI. On [[Y]] she is @mara_vey, verified, 61.2K followers, bio "Reporter at The Current, Midtown. Writing about the people AI left behind. Sources are protected." Her picture shows a dark bob, round glasses, a trench coat and a yellow press lanyard.

[public] Her public [[Forkyard]] profile (mara_vey, 2,210 followers, joined January 2019) lists Midtown, The Current, mara@thecurrent.test and thecurrent.test/mara, with the repos foia-helpers (public-records request templates) and layoffs-2026 (scraped layoff announcements).

[classified] Who her sources are.

## How she talks

[public] Warm but probing, and she protects her sources: "Someone has to. Your story matters more than the companies want it to." "You know I can't tell you that. I'd protect your name the same way." "I wish I could. I can make sure people hear what happened to you, though."

## Writing to her

[public] On [[Day 1]] (12:30) she posts that she is writing about the people behind this week's AI layoffs, "the ones the press forgets", and asks them to write to mara@thecurrent.test. Anyone who writes gets "RE: your story": she'd like to hear how the layoff happened and how they're coping, and nothing goes to print without their okay.

- [public] [if did_journalist_interview] The player told her their story honestly. She replied: "Thank you. Really. This is exactly the human side people need to see."

## Her posts on Y

- [public] On day 2 she posts that Vantor ($VANT) laid off 400 people.
- [public] On day 4 (11:30) she follows up: 400 people, one memo, and "If you were one of them, tell me your story."
- [public] On day 7 [[Randall Crane]] complains that Y gave "a 'reporter' from The Current" the same check mark as him.
- [public] On day 8 she posts that Vantor's outplacement program has placed 0 of 400 former staff.
- [public] On day 12 she posts that Vantor's quarterly report shows headcount down 400 and executive bonuses up.
- [public] On day 15 Crane calls The Current "Fake News" for "ANOTHER sob story" about displaced workers.
- [public] On day 17 (15:30) she posts "Even CityPulse got this one right, headline aside": GeneralAI wrote the first draft of the rules meant to regulate it.
- [public] On day 18 she posts that Vantor replaced its customer support with GeneralAI.

## From day 7: "The people AI left behind"

[public] On day 7 (13:00) she publishes "The people AI left behind" at thecurrent.test/people-ai-left-behind and links it on Y, asking readers whose story she missed. On day 7 the article's sources include [[Viktor]], an insurance claims handler who spent six weeks documenting her own job for an "integration project" ("I was very thorough"), and someone whose rent appeal was rejected in four seconds. On day 7 it notes that Vantor's People & Culture points to Vantor Outplacement, which lists no open roles, and that GeneralAI did not comment.

[public] On day 7 [[Max Stryker]] answers the article on Y that nobody left them behind, "They were walking slower."

## Planned

- [planned] Day 16: she starts asking questions.
- [planned] Day 17: the mafia asks the player to dox her.

## Writer notes

- Persona `mara`; events `d1_y_journalist`, `journalist_contact` (flags `talked_to_journalist`, `did_journalist_interview`), `d4_y_journalist`, `d7_journalist_article`, `d17_y_mara_rules`; $VANT posts in `y_market.json`; article in `src/ui/current.ts`.
- If the player emailed her before the article went up, it quotes their first email, unnamed ("One former Vantor employee…"). Depends on mail timing, not a flag, so it stays here.
- Name is a placeholder. Midtown in her bio and Forkyard is a doxing crumb. Everything about her should make the day 17 request hurt.
