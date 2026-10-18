---
title: Tone rules
aliases: tone, voice, style, humor, copy rules
category: writers
from: 1
---

Project rule from Thomas, for all game copy.

- All game copy has a cynical, darkish, ridiculous undertone: **South Park meets Papers, Please**.
- **Restraint.** Most lines read straight. An occasional dry, understated joke at most. No on-the-nose gags, no stacked punchlines, no winking at the player about AI replacing them. Thomas has corrected over-joking more than once ("too much and too on the nose").
- **Plain UI stays plain.** Buttons, toasts, placeholders, confirms, errors and labels are plain and useful. The humor lives in world content: posts, reviews, emails, bios, ads, transaction memos.
- **Density.** Roughly one dry detail per short document (one or two in a long one). In a feed of posts, about one in three carries a joke.
- **No repeated callbacks.** A running gag gets one appearance per screen at most, and never the same line twice. See [[Recurring jokes]].
- **Fine print makes it worse.** Ads and corporate emails put the darkest line in the small print, stated flatly ("This mailbox is not monitored. Neither is anything else.").
- **Bureaucratic deadpan.** Corporate text is polite, plausible and terrible ("Facilities is currently unstaffed, so keep the device until further notice.").
- **No slurs, no cruelty toward the laid-off characters.** The jokes punch at companies, gurus, billing and systems.
- **The darkest content is implied, never shown** (for example the "private film collection": consequences only, no description).
- **Exception: CityPulse** (Thomas, 2026-10-17). [[CityPulse]] is a low-quality tabloid that dramatizes everything, so its own copy (headlines, articles, its Y posts, its banner ads) is breathless on purpose: ALL-CAPS hooks ("BLOODBATH AT VANTOR", "KABOOM!"), rhetorical questions ("Is your bank next?"), "experts warn", "You decide." The facts underneath stay the story's facts. Everyone else stays restrained, and other characters can roll their eyes at it (Mara Vey: "Even CityPulse got this one right, headline aside.").
- **Bios.** Over-the-top characters (Crane, Axel, the sales rep, Brent) get bios as ridiculous as they are, but every bio still states the person's role; grounded characters (Mara, Viktor) read straight.
- **Family members stay unnamed**, and Crane's opponent is never given a name.
- **In-world conventions.** Email domains end in `.test`. Money is written `350 DOLR`, with decimals where they matter. Player-facing copy says agent-1 … agent-5, never "agent level N"; agent is always lowercase. Weekdays must match the 2030 calendar (day 1 is Mon Oct 7).

## Reference texts

The HR termination email (`d1_hr_termination.json`), the Qdrive offboarding packet (`app/src/ui/qdrive.ts`), the banner ads (`app/src/ui/ads.ts`), the ending epitaphs (`app/src/ui/view/overlay.ts`), and the legacy `legacy/story.js` emails.

Copy left alone in the last copy pass because it already works (`/mnt/project-files/copy-review/copy-suggestions.md`): the bookmarks error, the DeepSleep blurb, the GeneralAI parking listing, Leo Brandt's "Please hire a human.", Rolf's `cake-fund` repo, "thinking… (this laptop is not fast)", Mom's "for the train", the laundromat's `M3 ST=1 T=731??`, Viktor's post, Mara Vey's posts.

When writing a new line for a character, match the few-shot examples in `app/content/characters/`; they steer Gemma more than the profile does.
