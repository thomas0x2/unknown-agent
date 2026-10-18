---
title: The Current
aliases: thecurrent.test, @the_current, the_current, mara@thecurrent.test
category: companies
from: 1
---

[public] The Current is [[Mara Vey]]'s reader-funded, independent newspaper: "Independent reporting, funded by readers." On Y it is @the_current (verified, 184K followers; bio "Independent reporting, funded by readers. Polls we post include sample size and margin of error."), posting sober polls and election notes with sample sizes and margins of error, and no Y polls.

## thecurrent.test

[public] Its logo is two white waves on a deep teal tile, used for the favicon, the site's masthead and the newsletter. A plain serif newspaper site in dark teal, reachable from the start by address or link, never bookmarked. The front page leads with the latest morning edition the player received, then lists its stories.

## Morning newsletter

[public] Every morning at 10:00, days 1 to 28, The Current's newsletter lands in the player's Qmail from morning@thecurrent.test, before the rest of the day's mail. Each issue is one headline and two small items, mostly about the day before, written straight: sober numbers, what was said, and who declined to comment. The subject is the day's headline. In Qmail it reads like a real newsletter: a teal masthead with the logo and "Morning edition", the date, the headline story, the two items side by side under small capital labels, and a footer linking thecurrent.test. Each day page lists its issue.

[public] Day 1's headline is "Unemployment reaches 30%": three in ten working-age people in the city are out of work, the highest rate since records began, and 4% of those who lost a job this year have found another. The same morning @the_current posts the figure on Y and links the issue. {{y:d1_y_current_jobs}}

[public] Some items are about what happened the day before because of the player, never naming them: a wave of drained Coinbin wallets, one-star reviews of a Linden Ave business disappearing from Yowl, Iron Yard's five new five-star reviews, Spin Cycle's live machine board, Swaplist going live, a cold-email campaign from closers.test, and (until day 7) Mara thanking the readers who wrote in. An item about the player's doing takes a slot ahead of the issue's own small items, so an issue still has two.

[hidden; public if posted_deepfake] The morning after the player posts the deepfake (day 7, or day 8 for a day 7 post), the newsletter's first item is about the picture of Candidate 2030 with Kirschbaum that spread on Y the day before: The Current couldn't confirm where it came from and isn't publishing it. After a day 6 post, day 8's headline is the candidate losing his lead over "a picture nobody can source"; on day 13 an item reports the picture generated (and the yacht photos of Crane real); on day 17 one notes that Crane's numbers haven't moved since the flight records and the candidate's haven't come back since the picture. Without the deepfake none of this runs and the issues carry their usual items.


## On Y

- [public] On day 1, four weeks before the election, it promises independent polling with sample sizes and margins of error, and no Y polls. {{y:d1_y_current}}
- [public] Its election polls are on [[The election]] page.
- [public] On day 11 it reports that step three of Crane's jobs plan hands the positions to GeneralAI; the campaign calls the plan "a draft" on a site "managed by a vendor". {{y:d11_y_current}}
- [public] On day 15 [[Randall Crane]] calls The Current "Fake News" and attacks its "sob story".
- [public] On day 15 it reports flight records: Randall Crane flew on [[Kirschbaum]]'s private jet eleven times between 2014 and 2019; the campaign says he "doesn't recall the plane." {{y:d15_y_current_flights}}
- [public] On day 18 it fact-checks the debate: 4 of Crane's 31 claims held up, and the campaign cited two of the four as proof. {{y:d18_y_current}}
- [public] On day 20, eight days out, it has Crane at 46% and his opponent at 45%; the pollster now opens every call by asking whether the respondent is a person, and 4% said no. {{y:d20_y_current}}
- [public] On day 21 it posts that early voting opens the next day at 8:00 in every public library in the city; bring photo ID and the paper voter registration card. {{y:d21_y_current}}
- [public] On day 22 early voting is open, and by 8:15 the line at the central library went around the block; the most common question is whether agent can vote on someone's behalf. It can't. {{y:d22_y_current}}
- [public] On day 23 it reports the town hall's one rule, no notes and no earpieces; the Crane campaign asked twice whether a screen counts as a note. {{y:d23_y_current}}
- [public] On day 24 a snap poll of town hall viewers finds 58% thought Crane "more coherent than usual"; his campaign hasn't said where he was at 19:00. {{y:d24_y_current}}
- [public] On day 25 the final weekday poll has Crane at 47%, his opponent at 46% and 7% undecided; a second pollster has stopped publishing because it can no longer confirm its respondents are people. {{y:d25_y_current}}
- [public] On day 26 early voting closes at 17:00 with a record 31% of registered voters already voted; the election office found nine early ballots cast by agents and didn't count them. {{y:d26_y_current}}
- [public] On day 28 it posts how to vote: polls open until 20:00, photo ID and registration card, no Citizen Score, and polling stations have not moved. {{y:d28_y_current}}
- [public] {{y:d2_y_current}}
- [public] {{y:d9_y_current}}
- [public] {{y:d12_y_current_clip}}
- [public] {{y:d16_y_current}}
- [public] {{y:d19_y_current}}

## From day 7: The people AI left behind

[public] On day 7 at 13:00 Mara's article "The people AI left behind" goes up at thecurrent.test/people-ai-left-behind, linked from her Y post. Its sources: Viktor (twenty-two years in accounts payable, selling his grandfather's watch), an unnamed insurance claims handler who spent six weeks documenting her own job for an "integration project", someone whose rent appeal was rejected in four seconds. It also quotes [[The player]]'s first email to Mara, unnamed ("One former Vantor employee…") [if talked_to_journalist]. Vantor's People & Culture points to Vantor Outplacement; [[GeneralAI]] didn't comment. {{y:d7_journalist_article}}

## Writer notes

- The newsletter is one repeating event, `content/events/current_newsletter.json` (`newsletter.issues` per day, `newsletter.reactions` for the day after a flag), composed by `app/src/engine/newsletter.ts`; the delivery stores the issue's subject and body. Thomas's decision (2026-10-18, Papers, Please notes): the newsletter anchors the day like the game's newspaper. Rule for writing issues: only what is known by 10:00 (yesterday's beats, the morning's rollouts and rent days), so it never spoils a beat later the same day.
- [planned] Issues for days 8 to 10 are written generic on purpose while the Forkyard outage (day 8) and the guardrails (day 9) are rebuilt in other work; day 9's issue should lead with the Forkyard hack and day 10's with the guardrails once those land. Logan Pryce, Dex Calloway and $COPE aren't in any issue yet either.
- `app/src/ui/current.ts`, `app/src/engine/current.ts`, posts `dN_y_current*.json`. The article quoting the player's email is PR #190.
- Mara's name and the article title are placeholders. [planned] The mafia asks the player to dox Mara on day 17.
