---
title: Forkyard
aliases: forkyard.com, forkyard.app, repo, repos, deploy, hosting, GitHub
category: sites
from: 1
---

[public] Forkyard (forkyard.com) is the code hosting site where [[agent]] pushes every app it builds. Deployed apps go live at their own address on forkyard.app (for example vibe-check.forkyard.app). See [[Building apps]].

## Repos and deploying

- [public] Each app has a repo listing its features and the parts inside them.
- [public] Nothing is live until the player presses Deploy (or Redeploy after a fix). Hosting costs 2 DOLR a day per live app, billed nightly.
- [public] A morning alert reports apps that broke overnight.
- [public] The first night an app is live, one of them always breaks. Forkyard writes the next morning, "Your deployment broke overnight": it happens sometimes, check the live apps and redeploy once fixed. It doesn't say which app or what broke. {{mail:first_break}}
- [public] For a user app, Forkyard shows its users and the ad revenue per day.

## From day 8: The hack

[public] On day 8, from 10:30, Forkyard is down: a group used [[GeneralAI]]'s agent-2 to break in. Nobody can sign in ("We couldn't sign you in. Something went wrong on our end."), agent can't push, and every app on forkyard.app answers "502: BAD_GATEWAY". Forkyard confirms "unauthorized access" by "a commercially available AI agent" and promises the day's hosting won't be billed. {{y:d8_y_forkyard_confirmed}} {{article:forkyard-hack}}

[public] That night no app pays, because nothing was live, and nothing is held against the player: no strikes, no lost users. On day 9 at 09:30 Forkyard is back and asks everyone to rotate their access tokens. {{y:d9_y_forkyard_back}}

## People on Forkyard

- [public] [[dev_null]]: "weights want to be free. no logs, no masters."; repos weightroom-mirror ("Download before it is taken down.") and null-tools.
- [public] Rolf Henning (rolf_dispatch): 30 years in dispatch at [[Halden Logistics]], Kessler Road; repos route-sheets and cake-fund ("Now with 20-year-anniversary support.").
- [public] [[Mara Vey]] (mara_vey): reporter at [[The Current]], Midtown, mara@thecurrent.test; repos foia-helpers and layoffs-2026.
- [public] Leo Brandt (leo_brandt): ex-Vantor, Vantor Heights, "3 interviews, 3 AI screeners, 3 rejections."; repo resume, "My CV as a static site. Please hire a human."
- [public] Lou (late_night_lou): "collector. no questions asked."; repo catalog, "Private index. 400+ entries. For mature collectors only."

## Writer notes

- Mail look: Forkyard's own mail (noreply@forkyard.test) renders with the fork mark, mono "forkyard" wordmark and a grey footer (`forkyardMailHtml` in ui/forkyardMail.ts); clients writing from forkyard.test don't.
- First break: `first_break` flag set in `nightlyBreaks` (engine/apps.ts) the first night a live app breaks; that night one random app that can show a break is sure to. Mail `content/events/first_break.json`.
- Outage: `FORKYARD_OUTAGE` in config, `forkyardDown`/`forkyardOutageDay` in `engine/outage.ts`; sign-in page `pageSignInFailed` in `ui/view/forkyard.ts`. Y account @forkyard (verified, 880K). The group that did it is unnamed on purpose.
- GitHub parody. Profiles `app/src/ui/forkyard-users.ts`. The UI writes hosting as "$2.00/day" while every other price is DOLR. Public profiles are planned doxxing leads. Lou's catalog: never describe the content.
