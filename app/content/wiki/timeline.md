---
title: Timeline overview
aliases: timeline, day plan, phases, schedule
category: writers
from: 1
---

The plan of the game as a whole. Each day's content is on its own page, [[Day 1]] to [[Day 28]]; this page holds what applies across days. It replaces `/mnt/project-files/world/timeline.md`, which was folded into the wiki.

## Status tags

- No tag: on main. If the wiki and the code disagree, the code wins; fix the wiki.
- `[planned]`: in the old spine or Day plans, or in config, but not written as content. Hidden from Haiku.
- `[open]`: undecided; nobody has planned it yet. Hidden from Haiku.
- Written but unmerged work is named by PR number under Writer notes. When it merges, move it into the body.
- Every body line on non-writers pages starts with one visibility tag, `[public]`, `[hint]` or `[hidden]`, optionally with rules (`[hidden; public if posted_deepfake]`, `[hidden; public from day 9]`). `[known]`: a later day the player already knows about.

Keep it current: whenever work adds, moves or removes story content (an event, a Y post, an article, a trending topic, a rollout, a rent amount, a new site with a day gate), update the day page in the same piece of work.

## Phases

Legit (days 1 to 7), Grey (8 to 10), Dark (11 to 15), Convergence (16 to 27), Finale (28). From day 8 on the phases exist only as a plan: there is no Qmail story content after day 8.

## The daily loop

- **The clock.** A day runs 10:00 to 22:00, one game minute per real second (12 real minutes a day). The clock pauses during dialogs. The calendar starts on Mon Oct 7, 2030 (day 1) and ends on Sun Nov 3 (day 28), election day.
- **Morning.** The overnight summary, then the browser opens on Qmail with [[The Current]]'s morning newsletter at 10:00 (one headline and two small items, some about what the player did the day before), then the day's mail and Y posts arrive spread over the day at their `at` times. A morning Forkyard alert reports overnight breaks.
- **Work.** The player finds leads (mostly on Y), answers clients in Qmail, prompts the agent in agent.chat, checks the result on the live site, fixes and deploys from Forkyard. The agent can be prompted any time; builds and fixes take game time.
- **End Day.** Payday (each working client app pays its daily rate, user apps pay 0.5 DOLR per user), dinner from DoorDish (15 DOLR), rent on rent days, then the night: subscription, hosting (2 DOLR per live app), suspicion drift, overnight breaks, ending checks. Complaints about apps broken at payday arrive the next morning (a client email, or a Y post for user apps).
- **Everything happens in the browser.** People reach the player by Qmail, Y posts, or the sites themselves (Swaplist chats, lonely.ai, SorryWriter).

## Mechanics that shape the timeline

| Mechanic | Current rule | Where |
|---|---|---|
| Start | 100 DOLR, 12 followers, family trust 60, agent-1 | `START` |
| Rent | 350 on day 7, 500 on day 14, 650 on days 21 and 28, taken at payday. Short = Evicted. No late option | `RENT` |
| agent rollouts | agent-2 day 4, agent-3 day 12, agent-4 day 19, agent-5 day 25, in the morning (spread over the 28 days, Thomas 2026-10-20) | `AGENT_ROLLOUT` |
| agent prices | nightly sub / per prompt / per word: 5/0.5/0.01, 10/1/0.02, 20/2/0.03, 35/3/0.05, 60/5/0.08. Refusals are billed | `AGENT_COST` |
| Work speed | build 20 min + 10 per feature (max 90), fix 12 + 6 per problem (max 45), × 1/0.8/0.65/0.5/0.4 by model | `AGENT_WORK` |
| Build bugs | each component bugs 50/25/12/6/2% by model; a player's first deploy always ships at least one bug | `COMPONENT_BUG_CHANCE` |
| Overnight breaks | per live app: at least 1/2/3 components break 95/50/20%; only where the game would show it | `APPS.breakOdds`, `visibility.ts` |
| Clients | 30 to 60 DOLR per working day (authored ones 35 to 50); two strikes and the client leaves (app retired) | `APPS` |
| User apps | users grow 8% a day; first broken payday −40% users, second drops them to 5%. One promo post per platform adds users | `APPS.user` |
| Followers | exist from day 1, never explained. Gains per post from category bands or flat floors, ±30% jitter; more than 3 posts a day costs 2% | `Y`, `POST_BANDS` |
| Job offers | spread 10:15 to 16:00, at least an hour apart; offers authored after 16:00 keep their time | `events.ts` |
| Forkyard hack | day 8 from 10:30 to the next morning: no sign-in, no pushes (agent says it can't reach the server), every hosted app a 502; that night no app pays, strikes, loses users or is billed for hosting | `FORKYARD_OUTAGE` |
| Policy | from day 9 (the morning after the Forkyard hack), prohibited requests are refused; every illegal prompt raises misuse (blunt +20, workaround +10); a working workaround lands the result, leash +5; misuse 100 = suspension, then Caught | `AGENT_POLICY` |
| Suspicion | 0 to 100; Raided at 100. Hacks and fake reviews raise it, quiet days lower it by 2 | `SUSPICION` |
| Hidden meters | family trust, misuse, leash, suspicion, Null and mafia standing, Heritage and Progress standing | `values.ts` |
| Endings | see [[Endings]] | `endings.ts` |

Defined in config but not wired to content yet: agent-3 checking deployments itself (`LEVEL3_MISS_DEEP`), the misuse warning email at 40, faction standing changes, dox and scam suspicion, local-model dox errors.

## Always available (not tied to a day)

Sites the player can reach from day 1 or unlock by clicking through: Qmail, Y, Coinbin, agent.chat (with the Models page), Forkyard, Qdrive, Yowl, DoorDish, Sherwood (stocks), EMPIRE (Max Stryker's course), the ad landing pages (`adSites.ts`: Vantor careers and Outplacement, crane2026.vote with its Donate button, progressparty.org, rentboard.gov appeal, deepsleep.ai → Weightroom, prince-claims.xyz seed-phrase scam, Citizen Score, lonely.ai, SorryWriter and others). matchless.com is a dating site that exists from day 1; it becomes work once 6ft_sigma posts on day 4. Weightroom has only deepsleep-0.5B, which answers in Chinese nonsense (the third prompt ever gets Chen Wei's plea). CityPulse is a full tabloid news site with 52 articles a run across days 1 to 28, each going up at its own time (listed on the day pages). Pollymarket (pollymarket.com) is a prediction market with story markets whose odds and trades move with the news (listed on the day pages); there is nothing to bet with.

## Daily regulars

- Y regulars post every day of 1 to 28: Randall Crane (once a day), Axel Rook (1 to 3 a day), Cal Hartman (lowercase, most days), Max Stryker (daily, plus dating advice on odd days 5 to 15 that 6ft_sigma answers), gated `dayMin = dayMax`. Market posts for Vibe Check come from `y_market.json` every day. Filler (doomscroll, cat_ceo, zev.dolr, noodleposter) from `y_filler.json`, one a day.
- **Wade Tillman** (@wade_awake), the conspiracy theorist, posts on days 1 to 6, 8 to 11, 15, 18, 22, 26 and 28, plus the day after the player's deepfake and two posts that follow Fluvera's launch (1 and 5 days after `fluvera_launched`). See [[Wade Tillman]].
- **Crane's opponent** (`@candidate_2030`, "Candidate 2030", Progress Party, never named) posts about every other day: d2 13:10 encouraged by the poll, d3 listened to working families, d5 a balanced approach to technology, d7 "great crowd, great questions", d9 make sure you're registered, d11 a fourteen-point jobs plan on his website, d13 respects Rook's choice, d15 small businesses, d16 proud of his record (answers Crane's "never had a real job"), d18 his full debate answers are on his website, d19 make a plan to vote ("Nine days left"), d20 knocking on doors on the Eastside, d21 one week to go, d22 voted early with his family, d23 looking forward to the town hall, d24 answered eleven questions rather than make up forty-one, d25 two more days of early voting, d26 early voting closes at 5, d27 polls 7:00 to 8:00 PM, d28 09:40 "Whoever you support, go vote." His campaign answers mail at `team@candidate2030.vote` with form letters.
- **Bot swarm** "$GAI to the moon!!" only on days 4, 6, 9, 12, 16, 27 (30, 12, then 10 accounts), and only from the day the player takes deskjockey's job (`trader_client`, Thomas 2026-10-18), at the earliest 30 minutes after it and never after 19:00 (later ones go up the next day); the Vibe Check bot-filter bug can only land on those days.
- **Trending** is the Y sidebar from `trending.json`. A post sharing a word with a trending topic rates as a "reaction" for followers. A topic with an `at` time trends from then on, so it never shows before the beat it is about. Only days 1 to 7 have topics (Thomas, 2026-10-18: stick to those for now); days 8 to 28 show the fallback #AI, #jobs, #election, and their topics on the day pages are proposals that need Thomas's OK.
- **Election polls on Y** (The Current, sober; CityPulse, tabloid). Presidential: d2 Crane 41 / opponent 44; d5 Y poll Crane 71%; d9 tied 43-43; d13 Crane 46 / 42; d16 pollsters stop calling; d19 Crane 47 / 45; d20 Crane 46 / 45; d25 Crane 47 / 46, 7% undecided; d27 46-46, 8% undecided. If deepfaked, the opponent's lead is gone on d7 and The Current calls the clip generated on d12. Crane quotes via CityPulse: d8, d14, d17. The Current also: d1 polling promise, d11 jobs plan, d18 debate fact-check, d21 early voting opens tomorrow, d22 early voting lines, d23 town hall rules, d24 town hall snap poll, d26 record 31% early turnout and nine agent ballots not counted, d28 how to vote.
- **Election date.** Day 28 (Sun Nov 3), the last day. The old spine had it on day 19; before the game grew to 28 days it was day 21.

## Flags and delayed payoffs

| Flag | Set | Pays off | Status |
|---|---|---|---|
| `logan_client`, `trader_client`, `laundromat_live`, `swaplist_live`, `built_outreach_bot` | taking each job | gate that job's updates; outreach brings extra spam | canon |
| `asked_mom_money` | day 1 | the family final scene | flag canon, payoff open |
| `guru_subscriber`, `guru_cc_leak` | day 1, day 5 | newsletter; CC leak as dox leads | leak canon, dox use planned |
| `talked_to_journalist`, `did_journalist_interview` | emailing Mara | day 17 dox request | flags canon, payoff planned; day 7 article quotes the first email |
| `knows_weightroom` | day 2 dev_null post or deepsleep.ai | Weightroom | canon |
| `promoted_coffee_shop` | day 3 | coffee backlash on day 5 | canon |
| `first_hack`, `second_hack`, `gym_reviews` | days 5, 7, and the day after `first_hack` | Null Collective's day 8 offer feeling natural | flags canon, payoff planned |
| `any_hack` | the first hack that lands | q7vx2k9m4t's null.onion email the next night (`d6_onion_mail`) | email built, payoff open |
| `gift_chipped_in`, `gift_own`, `gift_skipped` | days 4 and 5 | day 6 birthday mail | canon |
| `posted_deepfake`, `influence_path` | day 6 | Crane's opponent loses his lead on day 7, The Current debunks the picture on day 12; the newsletter follows it the morning after the post and on days 8, 13 and 17; Y posts change on days 7, 8, 12 and 16; Mom's forward on day 9; the consultant returns | days 7, 8, 12, 13, 16, 17 canon, rest planned |
| `hacked_generalai` | none yet (the planned weights heist, days 25 and 26) | agent down for the rest of that day; Crane's error post instead of his own | outage canon, no content sets it |
| `stakes` (state) | day 7 on | each send paid out 4 days later at 12:00 at the book's real value | canon |
| `viktor_sold_watch` | day 6 | nothing yet | canon |
| `seed_stolen`, `coinbin_hacked` | prince-claims.xyz, coinbln.com | wallet emptied | canon |
| `hacked_logistics` → `dad_lost_job` | day 8 hack | day 12 | planned |
| `election_tipped`, `weights_published`, `bio_release` | none yet | The Regime, Open Weights, Outbreak | ending checks canon, no content sets them |

## Timing rules

Kept from the old spine:

- Consequences need 3 to 5 days. A flag set on day 8 pays off around day 12. Nothing that must land before day 21 unlocks after day 16 (written for the 21-day game).
- Each phase opens one new door: grey work from day 5, hacking from day 8, the mafia market from day 11, influence from day 12, bio from day 14.
- Rent pulls the player forward: days 7, 14, 21 and 28, each set slightly above what legit work covers comfortably.
- Catastrophic endings fire late, from day 17, so every run reaches the convergence phase.
- The family appears every 2 to 3 days. Currently on days 1, 2, 4, 5 (payment) and 6, then not at all.

Added since:

- Job offers are spread 10:15 to 16:00, an hour apart, in authored order. Sketchy jobs may come later (the deepfake at 19:00).
- Kirschbaum (Thomas, 2026-10-17): the day 6 deepfake puts Crane's opponent next to sex offender Kirschbaum; days 11, 15 and 16 reveal Crane was Kirschbaum's friend, whatever the player did.
- Story Y posts land by 20:00 (arrivals test). Posts linking a CityPulse article land after it.
- Client updates wait for the app to be working (`appWorking`) and, where chained, a day after the previous update.
- Weekdays in copy must match the 2030 calendar (day 7 is a Sunday).
- One app per prompt, one kind of work per prompt. A day's client updates should not need two apps changed in one go.

## Where the game differs from the old plan

Thomas went through this on 2026-10-17: the game's version stays everywhere except where marked **change**.

- Bugs (keep): no scripted first-build bug; every component rolls by model, and the first deploy always ships at least one. Fixes must name the component and its full path.
- Overnight breaks (keep): 95/50/20% per app for 1/2/3 components, not a flat 40%.
- Mom's money (keep): 20 DOLR, not 100.
- Laundromat (keep, plus change): lead on day 1 with 30 users. The day 8 retirement (Spin Cycle's own app) will be added (planned).
- Vibe Check (keep): deskjockey posts on day 4 (moved from day 2, Thomas 2026-10-18). $GAI and $VANT (no $NOVA), auto-buy asked for from day 5, adds $APO and $DISH on day 8. The auto-trade log shows every Crane post with its mood; the bot never sells. Bot swarm only on days 4, 6, 9, 12, 16, 27, once the job is taken.
- Gino (change, Thomas 2026-10-18): Trattoria Gino is scrapped; [[Logan Pryce]] and the [[WorkAgent site]] are the day 1 job. His DoorDish listing, dish pictures, the raise and Marguerite's #AIslop post went with him.
- Mom's jacket (change): chipping in is sending DOLR to the brother's Coinbin address; buying it yourself is buying the leather jacket (45) on Swaplist by day 5.
- Viktor's watch (keep): sells whenever Swaplist is live.
- Journalist interview (keep): Mara can be emailed from day 1; no questionnaire; the day 7 article quotes the first email, unnamed.
- Deepfake (change): +2400 ± 400 followers (Thomas, 2026-10-17; was +20%, before that a flat +40). Arrives at 19:00.
- HR email (keep): the final salary "has already been made".
- Election (keep): the last day, now day 28 (was day 21), not day 19.
- New since the old docs, all staying: the client's Y-post ask (now Logan's), the Coinbin phishing mail, prince-claims, lonely.ai, SorryWriter, rentboard appeal, Vantor Outplacement, Crane donations, Sherwood, Apogee, the agent-2 mourners.
- Not built from the old Day plans: Leo Brandt, Crane's bot army as its own day 4 beat, the coffee shop fallback for players under 25 followers, the day 7 private film collection on Swaplist, the landlord's rent receipt, the guru's influence recruiting by newsletter.

## Unplanned or thin

- Days 8 to 28 have no Qmail story beyond day 8's ticker update and 6ft_sigma's standards. The Null Collective, nullboard and Cellar exist only as site names in the engine.
- Family after day 6 is all planned; the final-day (day 28) family scene has no design.
- No new client or user apps after day 6, and no authored client update after day 8.
- The weights heist, the bio path and the election-tipping job have no starting beat.
- Weightroom's later models are unplanned.
- Heritage and Progress standing have no payoff beyond their meters.
- Trending topics for days 10 to 28 are not in `trending.json`; the proposals need Thomas's OK. Days 8 and 9 have the Forkyard hack and the usage policy.
- The misuse warning email is config only.
- Hacks: PR #205 put Bean There's removals in agent-terminal with guardrails (from day 9 since the Forkyard hack moved them); games: placeholder `cover_story` (Bean There) and `real_customers` (Iron Yard's fake reviews, day 6+). Every hack's job is paid overnight (`payHacks`). No hack job exists after day 7 yet.
