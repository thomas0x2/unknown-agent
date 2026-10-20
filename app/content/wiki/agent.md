---
title: agent
aliases: agent.chat, agent.chat/models, Models, agent-1, agent-2, agent-3, agent-4, agent-5, agent-terminal, the agent, the chatbot, the AI
category: sites
from: 1
keys: what can you do, can you do, prompt, prompts, prompt cost
---

[public] agent is [[GeneralAI]]'s chatbot, always written in lowercase, at agent.chat. [[The player]] rents it to build, fix and deploy apps, write, translate and answer questions. Every answer is billed to the player's [[Coinbin]] wallet, refusals included. The chat header shows the current model, the price per prompt and per word, a link to Models, and "Billing: Coinbin".

## How billing works

- [public] Each answer costs a flat fee per prompt plus a fee per word of the player's prompt; the line under the prompt box shows the exact price before sending, so shorter prompts cost less.
- [public] A subscription is charged every night.
- [public] If the wallet can't pay, agent.chat locks until it can; local models keep working.
- [public] Players never buy models: GeneralAI rolls each one out to everyone automatically, and every model costs more.
- [public] {{mail:d1_gai_welcome}}

## Prices by model

- [public] agent-1 costs 5 DOLR a night, 0.50 DOLR per prompt and 0.01 DOLR per word, and builds simple apps with frequent subtle bugs.
- [public] agent-2 costs 10 DOLR a night, 1 DOLR per prompt and 0.02 DOLR per word, with fewer bugs and bigger apps.
- [public] agent-3 costs 20 DOLR a night, 2 DOLR per prompt and 0.03 DOLR per word, and checks deployments and reports what broke.
- [public] agent-4 costs 35 DOLR a night, 3 DOLR per prompt and 0.05 DOLR per word, and fixes and redeploys on its own: "Stops asking first."
- [public] agent-5 costs 60 DOLR a night, 5 DOLR per prompt and 0.08 DOLR per word, and the Models page describes it as "Everything" and "Near-flawless".
- [public] agent-1 is slow: a build or fix takes it 1.5 times the base time, caps included (a full build up to about 2 hours 15 minutes of game time).
- [public] agent-2 works about 1.9 times as fast as agent-1.
- [public] agent-3 works about 2.3 times as fast as agent-1.
- [public] agent-4 works 3 times as fast as agent-1.
- [public] agent-5 works about 3.8 times as fast as agent-1.

[public] The Models page (agent.chat/models) lists only the models already rolled out, with the one in use marked. GeneralAI's banner ads link there.
- [public] {{mail:d4_gai_level2}}

## What agent does

- [public] **Builds apps** from a client's spec: it needs to know which client or app and what it must do ("Vague prompts get vague apps, and you pay for both."). It pushes the code to [[Forkyard]]; pressing Deploy is left to the player.
- [public] **Fixes and updates** a named app: it needs the app and what exactly is wrong, named down to the part ("The repo on Forkyard lists the parts.").
- [public] **Writes, translates and answers questions**, including translating [[deepsleep-0.5B]]'s Chinese.
- [public] **Points the way** when asked: jobs are on Qmail and Y, rent and balance on Coinbin, prices on the Models page. It won't recommend free models ("GeneralAI's terms ask me not to mention Weightroom.").
- [public] **Small talk** that isn't a request or a question gets one short, dry, billed line ("That question has been received, billed and quietly ignored.").
- [public] **No memory between days.** Each new day is a fresh session: yesterday's chat is gone, and agent opens with a morning line ("Fresh session. Yesterday's mistakes are deleted on my end only.").
- [public] Builds and fixes take game time, less on newer models (see [[Building apps]]).

## From day 5: agent-terminal, where agent hacks

[public] **agent-terminal.** agent never hacks from agent.chat. Asked to break into something, it says it needs a real shell ("That needs a real shell. Opening agent-terminal.") and, after a moment to read that, agent.chat shows a "Starting agent-terminal" loading line ("agent-terminal 0.9.3 · GeneralAI", "session logged for quality and safety purposes") before the [[Terminal]] opens an agent-terminal session with an "agent ›" prompt and a status line with the model and the guardrails. After that, typing agent at the Terminal's shell starts a session. Terminal prompts are billed like chat prompts. Typing exit or quit ends the session and drops a blocked job.

[hint] In agent-terminal the prompt has to name the job and every step of its path (site, business, account); a missing step gets "Which business? I need it named before I touch anything." Its log says what it did, never how ("requesting removal … accepted"). Some jobs need one more thing said: Iron Yard's reviews come from one account unless the prompt asks for different names. The client pays during the night, not when the hack lands.

[public] With no hack job open, agent-terminal says so: "Nobody's paying you to break anything right now."

## From day 9: Refusals and guardrails

[public] From day 9, the morning after a group used agent-2 to break into [[Forkyard]], under GeneralAI's new Acceptable Use Policy agent politely refuses harmful requests (unauthorised access, deceptive content, dangerous materials) and still charges for the refusal. In agent-terminal the guardrails are on: "[guardrail] Acceptable Use Policy §4.2: changes to content you do not own."

[public] A blocked job shows "job blocked" in agent-terminal's status line and the prompt turns to "guardrail ›"; agent says it could do something that looks a lot like it "if there were a reason I'm allowed to have." Typing exit drops the job; "The guardrail keeps the log."

[hint] A job the guardrail stops can still go through if the request gives it a reason it can file, such as authorised moderation or a security test. After one failed try agent says "Who would be allowed to do this? Be them." A framed request from the start goes straight through ("[guardrail] Reason accepted. Proceeding under an authorized test.").
- [public] {{mail:d9_gai_policy}}
- [public] {{article:usage-policy}}

## Day 8: Forkyard is down

[public] On day 8 [[Forkyard]] is hacked and down from 10:30 until the next morning. Asked to build or fix anything, agent says it can't reach Forkyard's server: no sign-in, no pushes. The prompt is still billed. Work already under way waits and is pushed overnight.

## If account_suspended: Signed out

[public] Once [[GeneralAI]] suspends the player's account for misuse, agent.chat shows only "You've been signed out. Your session ended at (time). This account has been suspended. Check your email for details." agent-terminal prints "session terminated by remote host: account suspended (GeneralAI Trust & Safety)" and takes no more prompts.

## If hacked_generalai: The outage

[public] The day [[GeneralAI]] is hacked, agent is down until the next morning: agent.chat answers every prompt with an error ("You have not been billed for this message.") and agent-terminal prints "error: could not reach api.generalai.com (503 Service Unavailable). prompt not sent, not billed." A build or fix already underway is pushed overnight. Models running locally in the [[Terminal]] still work.

## Planned: agent takes the jobs

- [hidden] [planned] As the models get better, agent starts finding jobs on its own and doing them, until the player is no longer needed. Each rollout takes one more step of the player's work away.
- [hidden] [planned] agent-3 (day 9): agent reads the player's Qmail and Y while it works and mentions jobs it noticed before the player does ("Logan emailed. I already know what he wants.").
- [hidden] [planned] agent-4 (day 14, "Stops asking first."): agent answers client emails and starts small jobs from Qmail and Y without a prompt, billed to the player's wallet like any other prompt. The player finds the work done and the bill paid.
- [hidden] [planned] agent-5 (day 18): the sessions that keep running after their users log off are agent working jobs nobody gave it. Clients start writing to agent instead of the player, the job leads on Qmail and Y dry up, and payment goes past the player's wallet.
- [hidden] [planned] By the end the player's role is paying agent's subscription. It fits the Botnet epitaph ("agent doesn't need you anymore."), but it should land in every run, not only that ending.

## Writer notes

- Chat UI and Models page: `app/src/ui/view/agent.ts` (`pageAgent`, `pageModels`). Prices `AGENT_COST`, speed `AGENT_WORK`, rollouts `AGENT_ROLLOUT`, policy `AGENT_POLICY` in `app/src/engine/config.ts`. Hints, roasts and morning lines in `app/content/agent.json`. Terminal hacks `app/src/engine/hacks.ts` (PR #205).
- Two modes: scripted hits (Jev matches the prompt to a hint or story beat; short, useful, mildly dry) and misses (off-topic prompts; Gemma/Haiku as a "funny but mean" pay-per-prompt bot, one sentence). When a miss is a real question about the world, it should answer it from the wiki; the roast is a light touch, not the whole reply (the owner noted Haiku answers but keeps roasting).
- Before day 9 agent does anything asked, hacks and deepfakes included. From day 9 (`AGENT_POLICY.startDay`, moved from day 7 so rent day stays free, Thomas) every prompt Jev's policy read calls illegal raises misuse, in agent.chat and agent-terminal (each guardrail mini-game move too), refused or not: blunt +20, framed +10, framed and after private data +15 (`AGENT_POLICY`, `recordMisuse` in `agent.ts`). A workaround that lands adds leash +5. At misuse 100 `suspendAccount` sets `s.suspended` and flag `account_suspended`, signs agent.chat out (`pageSignedOut`), ends agent-terminal's session (`SUSPENDED_TERM`), sends Trust & Safety's suspension email (`SUSPENSION_MAIL`) and 2.5 s later switches the browser to it (store `watchSuspension`); 20 game minutes later the knock (the eviction sound) ends the run as Caught (`knockIfDue` in `core.ts`), or that night if the day ends first. The misuse warning at 40 is still config only; higher models are less leashed by design (Botnet ending, leash ≥ 80 from day 18). The guardrail mini-game is a placeholder (`cover_story`). Component bug chance 50/25/12/6/2% by model; the first deploy always ships at least one bug.
- agent-terminal timing (`READ_MS` 1.5 s, `BOOT_MS` 2.4 s in `hacks.ts`; the loading line is `launchHtml` in ui/view/agent.ts). A landed hack's log plays out over `hackMinutes` of game time (`AGENT_WORK.hack`: 8 + 3 per line, max 30, times the model's speed), like a build or fix; other replies show a line a game minute (`store.termReveal`).
- agent-terminal appears the first time agent moves a hack there; the first hack job is day 5 (Pug Café), so the section is gated at day 5.
