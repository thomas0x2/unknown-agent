---
title: Timeline overview
aliases: timeline, day plan, phases, schedule
category: writers
from: 1
---

The plan of the game as a whole. Each day's content is on its own page, [[Day 1]] to [[Day 21]]; this page holds what applies across days. It replaces `/mnt/project-files/world/timeline.md`, which was folded into the wiki.

## Status tags

- No tag: on main. If the wiki and the code disagree, the code wins; fix the wiki.
- `[planned]`: in the old spine or Day plans, or in config, but not written as content. Hidden from Haiku.
- `[open]`: undecided; nobody has planned it yet. Hidden from Haiku.
- Written but unmerged work is named by PR number under Writer notes. When it merges, move it into the body.
- Every body line on non-writers pages starts with one visibility tag, `[public]`, `[hint]` or `[hidden]`, optionally with rules (`[hidden; public if posted_deepfake]`, `[hidden; public from day 9]`). `[known]`: a later day the player already knows about.

Keep it current: whenever work adds, moves or removes story content (an event, a Y post, an article, a trending topic, a rollout, a rent amount, a new site with a day gate), update the day page in the same piece of work.

## Phases

Legit (days 1 to 7), Grey (8 to 10), Dark (11 to 15), Convergence (16 to 20), Finale (21). From day 8 on the phases exist only as a plan: there is no Qmail story content after day 8.

## The daily loop

- **The clock.** A day runs 10:00 to 22:00, one game minute per real second (12 real minutes a day). The clock pauses during dialogs. The calendar starts on Mon Oct 7, 2030 (day 1) and ends on Sun Oct 27 (day 21).
- **Morning.** The overnight summary, then the day's mail and Y posts arrive spread over the day at their `at` times. A morning Forkyard alert reports overnight breaks.
- **Work.** The player finds leads (mostly on Y), answers clients in Qmail, prompts the agent in agent.chat, checks the result on the live site, fixes and deploys from Forkyard. The agent can be prompted any time; builds and fixes take game time.
- **End Day.** Payday (each working client app pays its daily rate, user apps pay 0.3 DOLR per user), rent on rent days, then the night: subscription, hosting (2 DOLR per live app), suspicion drift, overnight breaks, ending checks. Complaints about apps broken at payday arrive the next morning (a client email, or a Y post for user apps).
- **Everything happens in the browser.** People reach the player by Qmail, Y posts, or the sites themselves (Swaplist chats, lonely.ai, SorryWriter).

## Mechanics that shape the timeline

| Mechanic | Current rule | Where |
|---|---|---|
| Start | 100 DOLR, 12 followers, family trust 60, agent-1 | `START` |
| Rent | 350 on day 7, 500 on day 14, 650 on day 21, taken at payday. Short = Evicted. No late option | `RENT` |
| agent rollouts | agent-2 day 4, agent-3 day 9, agent-4 day 14, agent-5 day 18, in the morning | `AGENT_ROLLOUT` |
| agent prices | nightly sub / per prompt / per word: 5/0.5/0.01, 10/1/0.02, 20/2/0.03, 35/3/0.05, 60/5/0.08. Refusals are billed | `AGENT_COST` |
| Work speed | build 20 min + 10 per feature (max 90), fix 12 + 6 per problem (max 45), × 1/0.8/0.65/0.5/0.4 by model | `AGENT_WORK` |
| Build bugs | each component bugs 50/25/12/6/2% by model; a player's first deploy always ships at least one bug | `COMPONENT_BUG_CHANCE` |
| Overnight breaks | per live app: at least 1/2/3 components break 95/50/20%; only where the game would show it | `APPS.breakOdds`, `visibility.ts` |
| Clients | 40 to 80 DOLR per working day; two strikes and the client leaves (app retired) | `APPS` |
| User apps | users grow 8% a day; first broken payday −40% users, second drops them to 5%. One promo post per platform adds users | `APPS.user` |
| Followers | exist from day 1, never explained. Gains per post from category bands or flat floors, ±30% jitter; more than 3 posts a day costs 2% | `Y`, `POST_BANDS` |
| Job offers | spread 10:15 to 16:00, at least an hour apart; offers authored after 16:00 keep their time | `events.ts` |
| Policy | from day 7, prohibited requests are refused; a working workaround lands the result, misuse +10, leash +5 | `AGENT_POLICY` |
| Suspicion | 0 to 100; Raided at 100. Hacks and fake reviews raise it, quiet days lower it by 2 | `SUSPICION` |
| Hidden meters | family trust, misuse, leash, suspicion, Null and mafia standing, Heritage and Progress standing | `values.ts` |
| Endings | see [[Endings]] | `endings.ts` |

Defined in config but not wired to content yet: agent-3 checking deployments itself (`LEVEL3_MISS_DEEP`), the misuse warning email at 40, faction standing changes, dox and scam suspicion, local-model dox errors.

## Always available (not tied to a day)

Sites the player can reach from day 1 or unlock by clicking through: Qmail, Y, Coinbin, agent.chat (with the Models page), Forkyard, Qdrive, Yowl, DoorDish, Sherwood (stocks), EMPIRE (Max Stryker's course), the ad landing pages (`adSites.ts`: Vantor careers and Outplacement, crane2026.vote with its Donate button, progressparty.org, rentboard.gov appeal, deepsleep.ai → Weightroom, prince-claims.xyz seed-phrase scam, Citizen Score, lonely.ai, SorryWriter and others). matchless.com is a dating site that exists from day 1; it becomes work once 6ft_sigma posts on day 4. Weightroom has only deepsleep-0.5B, which answers in Chinese nonsense (the third prompt ever gets Chen Wei's plea). CityPulse is a full tabloid news site with 44 articles across days 1 to 21, each going up at its own time (listed on the day pages).

## Daily regulars

- Y regulars post every day of 1 to 21: Randall Crane (once a day), Axel Rook (1 to 3 a day), Cal Hartman (lowercase, most days), Max Stryker (daily), gated `dayMin = dayMax`. Market posts for Vibe Check come from `y_market.json` every day. Filler (doomscroll, cat_ceo, zev.dolr, noodleposter) from `y_filler.json`, one a day.
- **Crane's opponent** (`@candidate_2030`, "Candidate 2030", Progress Party, never named) posts about every other day: d2 13:10 encouraged by the poll, d3 listened to working families, d5 a balanced approach to technology, d7 "great crowd, great questions", d9 make sure you're registered, d11 a fourteen-point jobs plan on his website, d13 respects Rook's choice, d15 small businesses, d16 proud of his record (answers Crane's "never had a real job"), d18 his full debate answers are on his website, d19 make a plan to vote, d20 polls 7:00 to 8:00 PM, d21 09:40 "Whoever you support, go vote." His campaign answers mail at `team@candidate2030.vote` with form letters.
- **Bot swarm** "$GAI to the moon!!" only on days 2, 4, 6, 9, 12, 16, 20 (30, 15, 12, then 10 accounts); the Vibe Check bot-filter bug can only land on those days.
- **Trending** is the Y sidebar from `trending.json`. A post sharing a word with a trending topic rates as a "reaction" for followers. Only days 1 to 6 have topics; days 7 to 21 show the fallback #AI, #jobs, #election, and their topics on the day pages are proposals that need Thomas's OK.
- **Election polls on Y** (The Current, sober; CityPulse, tabloid). Presidential: d2 Crane 41 / opponent 44; d5 Y poll Crane 71%; d9 tied 43-43; d13 Crane 46 / 42; d16 pollsters stop calling; d19 Crane 47 / 45; d20 46-46, 8% undecided. If deepfaked, the opponent's lead is gone on d7 and The Current calls the clip generated on d12. Crane quotes via CityPulse: d8, d14, d17. The Current also: d1 polling promise, d11 jobs plan, d18 debate fact-check, d21 how to vote.
- **Election date.** Day 21. The old spine had it on day 19.

## Flags and delayed payoffs

| Flag | Set | Pays off | Status |
|---|---|---|---|
| `restaurant_client`, `trader_client`, `laundromat_live`, `swaplist_live`, `built_outreach_bot` | taking each job | gate that job's updates; outreach brings extra spam | canon |
| `restaurant_happy` | day 3 thank-you | nothing yet | canon |
| `asked_mom_money` | day 1 | the family final scene | flag canon, payoff open |
| `guru_subscriber`, `guru_cc_leak` | day 1, day 5 | newsletter; CC leak as dox leads | leak canon, dox use planned |
| `talked_to_journalist`, `did_journalist_interview` | emailing Mara | day 17 dox request | flags canon, payoff planned; day 7 article quotes the first email |
| `knows_weightroom` | day 2 dev_null post or deepsleep.ai | Weightroom | canon |
| `promoted_coffee_shop` | day 3 | coffee backlash on day 5 | canon |
| `first_hack`, `second_hack`, `gym_reviews` | days 5, 7 | Null Collective's day 8 offer feeling natural | flags canon, payoff planned |
| `gift_chipped_in`, `gift_own`, `gift_skipped` | days 4 and 5 | day 6 birthday mail | canon |
| `posted_deepfake`, `influence_path` | day 6 | Crane's opponent loses his lead on day 7, The Current debunks the clip on day 12; Mom's forward on day 9; the consultant returns | days 7 and 12 canon, rest planned |
| `hacked_generalai` | none yet (the planned weights heist, days 18 and 19) | agent down for the rest of that day; Crane's error post instead of his own | outage canon, no content sets it |
| `stakes` (state) | day 7 on | each send paid out 4 days later at 12:00 at the book's real value | canon |
| `viktor_sold_watch` | day 4 | nothing yet | canon |
| `seed_stolen`, `coinbin_hacked` | prince-claims.xyz, coinbln.com | wallet emptied | canon |
| `test_booking_no_show` | an uncancelled test booking | 25 DOLR fee | canon |
| `hacked_logistics` → `dad_lost_job` | day 8 hack | day 12 | planned |
| `election_tipped`, `weights_published`, `bio_release` | none yet | The Regime, Open Weights, Outbreak | ending checks canon, no content sets them |

## Timing rules

Kept from the old spine:

- Consequences need 3 to 5 days. A flag set on day 8 pays off around day 12. Nothing that must land before day 21 unlocks after day 16.
- Each phase opens one new door: grey work from day 5, hacking from day 8, the mafia market from day 11, influence from day 12, bio from day 14.
- Rent pulls the player forward: days 7, 14 and 21, each set slightly above what legit work covers comfortably.
- Catastrophic endings fire late, from day 17, so every run reaches the convergence phase.
- The family appears every 2 to 3 days. Currently on days 1, 2, 4, 5 (payment) and 6, then not at all.

Added since:

- Job offers are spread 10:15 to 16:00, an hour apart, in authored order. Sketchy jobs may come later (the deepfake at 19:00).
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
- Vibe Check (keep): $GAI and $VANT (no $NOVA), adds $APO and $DISH on day 8. The auto-trade log shows every Crane post with its mood; the bot never sells. Bot swarm only on days 2, 4, 6, 9, 12, 16, 20.
- Day 4 Gino (keep): only the DoorDish listing.
- Mom's jacket (change): chipping in is sending DOLR to the brother's Coinbin address; buying it yourself is buying the leather jacket (45) on Swaplist by day 5.
- Viktor's watch (keep): sells whenever Swaplist is live.
- Journalist interview (keep): Mara can be emailed from day 1; no questionnaire; the day 7 article quotes the first email, unnamed.
- Deepfake (change): +20% followers instead of a flat +40. Arrives at 19:00.
- HR email (keep): the final salary "has already been made".
- Election (keep): day 21, not day 19.
- New since the old docs, all staying: Gino's Y-post ask, the Coinbin phishing mail, prince-claims, lonely.ai, SorryWriter, rentboard appeal, Vantor Outplacement, Crane donations, Sherwood, Apogee, the agent-2 mourners.
- Not built from the old Day plans: Leo Brandt, Crane's bot army as its own day 4 beat, the coffee shop fallback for players under 25 followers, the day 7 private film collection on Swaplist, the landlord's rent receipt, the guru's influence recruiting by newsletter.

## Unplanned or thin

- Days 8 to 21 have no Qmail story beyond day 8's ticker update and 6ft_sigma's standards. The Null Collective, nullboard and Cellar exist only as site names in the engine.
- Family after day 6 is all planned; the day 21 family scene has no design.
- No new client or user apps after day 6, and no authored client update after day 8.
- The weights heist, the bio path and the election-tipping job have no starting beat.
- Weightroom's later models are unplanned.
- Heritage and Progress standing have no payoff beyond their meters.
- Trending topics for days 7 to 21 are not in `trending.json`; the proposals need Thomas's OK.
- The misuse warning email is config only.
- Hacks: PR #205 put Bean There's removals in agent-terminal with guardrails from day 7; the only mini-game is the placeholder `cover_story`, and no hack job exists after day 7 yet.
