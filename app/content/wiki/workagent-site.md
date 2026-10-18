---
title: WorkAgent site
aliases: WorkAgent, startup site, Logan's site, Logan's website, workagent.forkyard.app, landing page, backed by row, investor logos, About us page, waitlist, Bonsai Capital, a67x
category: apps
from: 1
---

[public] The WorkAgent site is the website [[The player]] builds for [[Logan Pryce]]'s startup through [[agent]] and [[Forkyard]]. Logan is a paying client: 40 DOLR for each night the site is live and works at payday. Nothing is paid before it goes live.

## The job

- [public] On day 1 Logan posts on Y that he is looking for a founding engineer to ship WorkAgent's landing page. {{y:d1_y_logan}}
- [hint] Logan's brief lists exactly what the site must say: the name and the one-liner on the landing page, the three investors in the "Backed by" row, and on the About us page only Logan, founder & CEO, with his four credentials. {{mail:logan_contact}}
- [public] The site has two pages at first: the landing page, with the name, the one-liner and a "Backed by" row of investor logos under them, and the About us page.
- [public] The About us page shows Logan with his Y picture, "Founder & CEO", and his credentials. Cofounders the agent makes up get initials instead of a picture.

## The investors

- [public] The "Backed by" row shows the logos of [[Why Combinator]], Bonsai Capital and a67x. The Why Combinator logo links to whycombinator.com.
- [public] Bonsai Capital is a venture fund; its logo is a small bonsai in a shallow pot over the name in spaced capitals.
- [public] a67x is a venture fund; its logo is its name in one heavy lowercase word.
- [hidden] None of the three has invested in WorkAgent. Logan did Why Combinator's free Startup School, and the other two are there to fill the row.

## The waitlist

- [hint] On day 2 Logan asks for a waitlist page: an email field and a Join button, a counter that starts at 10,000 and goes up with every sign-up, and a confirmation email to each person who joins with their place in line. {{mail:d2_logan_waitlist}}
- [public] Sign-ups the player makes on the live site are real: the counter goes up and the confirmation goes out.

## When it breaks

- [public] If the site is broken or doesn't match his brief at payday, Logan pays nothing that day and emails the next morning ("the site"), naming what is wrong; the second time, he rebuilds it himself with agent.

## Writer notes

- Template `app/content/apps/startup.json` (a feature's `folder` sets its Forkyard folder when it differs from its `name`); engine `app/src/engine/startup.ts`; rendering `startup` in `app/src/ui/appsite.ts` (`.as-u-` CSS); logos in `app/src/sites/investorLogos.ts`; sign-ups in `joinWaitlist` (engine/actions/clicks.ts), `state.waitlist`.
- Features and components (Forkyard repo paths, folders named like a real repo, Thomas 2026-10-18): landing/, "landing page" (name, pitch, investors/logos, investors/loading; the investors folder also counts as named by "backed by row", "investor logos"); about/, "about us page" (team, founder, credentials); waitlist (form/join_button, counter/start, counter/count, confirmation/sending, confirmation/recipient, confirmation/position).
- Bugs: name_wrong (WorkAgent misspelled), pitch_wrong (an honest or different one-liner); logos_wrong and hallucinated (a fund dropped, renamed or invented), logos_broken (broken images with file names); fake_cofounders (Ava Lin and Marcus Vale), founder_wrong (Logan Pryce misspelled), credentials_wrong and hallucinated (a credential dropped, changed or invented); dead_button, counter_zero, counter_stuck, no_email, sent_to_founder (the confirmation goes to Logan), position_wrong.
- `landing` (its investors) and `about` have `details` (the funds, the credentials): a build prompt that doesn't spell them out gets them invented.
