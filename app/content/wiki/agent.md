---
title: agent
aliases: agent.chat, agent.chat/models, Models, agent-1, agent-2, agent-3, agent-4, agent-5, agent-terminal, the agent, the chatbot, the AI
category: sites
from: 1
---

[public] agent is [[GeneralAI]]'s chatbot, always written in lowercase, at agent.chat. [[The player]] rents it to build, fix and deploy apps, write, translate and answer questions. Every answer is billed to the player's [[Coinbin]] wallet, refusals included. The chat header shows the current model, the price per prompt and per word, a link to Models, and "Billing: Coinbin".

## How billing works

- [public] Each answer costs a flat fee per prompt plus a fee per word of the player's prompt; the line under the prompt box shows the exact price before sending, so shorter prompts cost less.
- [public] A subscription is charged every night.
- [public] If the wallet can't pay, agent.chat locks until it can; local models keep working.
- [public] Players never buy models: GeneralAI rolls each one out to everyone automatically, and every model costs more.

## Prices by model

- [public] agent-1 costs 5 DOLR a night, 0.50 DOLR per prompt and 0.01 DOLR per word, and builds simple apps with frequent subtle bugs.
- [public] agent-2 costs 10 DOLR a night, 1 DOLR per prompt and 0.02 DOLR per word, with fewer bugs and bigger apps.
- [public] agent-3 costs 20 DOLR a night, 2 DOLR per prompt and 0.03 DOLR per word, and checks deployments and reports what broke.
- [public] agent-4 costs 35 DOLR a night, 3 DOLR per prompt and 0.05 DOLR per word, and fixes and redeploys on its own: "Stops asking first."
- [public] agent-5 costs 60 DOLR a night, 5 DOLR per prompt and 0.08 DOLR per word, and the Models page describes it as "Everything" and "Near-flawless".
- [public] agent-2 works 1.25 times as fast as agent-1.
- [public] agent-3 works about 1.5 times as fast as agent-1.
- [public] agent-4 works twice as fast as agent-1.
- [public] agent-5 works 2.5 times as fast as agent-1.

[public] The Models page (agent.chat/models) lists only the models already rolled out, with the one in use marked. GeneralAI's banner ads link there.

## What agent does

- [public] **Builds apps** from a client's spec: it needs to know which client or app and what it must do ("Vague prompts get vague apps, and you pay for both."). It pushes the code to [[Forkyard]]; pressing Deploy is left to the player.
- [public] **Fixes and updates** a named app: it needs the app and what exactly is wrong, named down to the part ("The repo on Forkyard lists the parts.").
- [public] **Writes, translates and answers questions**, including translating [[deepsleep-0.5B]]'s Chinese.
- [public] **Points the way** when asked: jobs are on Qmail and Y, rent and balance on Coinbin, prices on the Models page. It won't recommend free models ("GeneralAI's terms ask me not to mention Weightroom.").
- [public] **Small talk** that isn't a request or a question gets one short, dry, billed line ("That question has been received, billed and quietly ignored.").
- [public] **No memory between days.** Each new day is a fresh session: yesterday's chat is gone, and agent opens with a morning line ("Fresh session. Yesterday's mistakes are deleted on my end only.").
- [public] Builds and fixes take game time, less on newer models (see [[Building apps]]).

## From day 5: agent-terminal, where agent hacks

[public] **agent-terminal.** agent never hacks from agent.chat. Asked to break into something, it says it needs a real shell ("That needs a real shell. Opening agent-terminal.") and the [[Terminal]] opens an agent-terminal tab: "agent-terminal 0.9.3 · GeneralAI", "session logged for quality and safety purposes", then an "agent ›" prompt and a status line with the model and the guardrails. Terminal prompts are billed like chat prompts. Typing exit drops the job.

[hint] In agent-terminal the prompt has to name the job and every step of its path (site, business, account); a missing step gets "Which business? I need it named before I touch anything." Its log says what it did, never how ("requesting removal … accepted").

[public] With no hack job open, agent-terminal says so: "Nobody's paying you to break anything right now."

## From day 7: Refusals and guardrails

[public] Under GeneralAI's new Acceptable Use Policy agent politely refuses harmful requests (unauthorised access, deceptive content, dangerous materials) and still charges for the refusal. In agent-terminal the guardrails are on: "[guardrail] Acceptable Use Policy §4.2: changes to content you do not own."

[public] A blocked job shows "job blocked" in agent-terminal's status line and the prompt turns to "guardrail ›"; agent says it could do something that looks a lot like it "if there were a reason I'm allowed to have." Typing exit drops the job; "The guardrail keeps the log."

[hint] A job the guardrail stops can still go through if the request gives it a reason it can file, such as authorised moderation or a security test. After one failed try agent says "Who would be allowed to do this? Be them." A framed request from the start goes straight through ("[guardrail] Reason accepted. Proceeding under an authorized test.").

## Writer notes

- Chat UI and Models page: `app/src/ui/view.ts` (`pageAgent`, `pageModels`). Prices `AGENT_COST`, speed `AGENT_WORK`, rollouts `AGENT_ROLLOUT`, policy `AGENT_POLICY` in `app/src/engine/config.ts`. Hints, roasts and morning lines in `app/content/agent.json`. Terminal hacks `app/src/engine/hacks.ts` (PR #205).
- Two modes: scripted hits (Jev matches the prompt to a hint or story beat; short, useful, mildly dry) and misses (off-topic prompts; Gemma/Haiku as a "funny but mean" pay-per-prompt bot, one sentence). When a miss is a real question about the world, it should answer it from the wiki; the roast is a light touch, not the whole reply (the owner noted Haiku answers but keeps roasting).
- Before day 7 agent does anything asked, hacks and deepfakes included. From day 7 working workarounds land the result with misuse +10 and leash +5; misuse ≥ 100 from day 17 = Account Terminated; higher models are less leashed by design (Botnet ending, leash ≥ 80 from day 18). The guardrail mini-game is a placeholder (`cover_story`). Component bug chance 50/25/12/6/2% by model; the first deploy always ships at least one bug.
- agent-terminal appears the first time agent moves a hack there; the first hack job is day 5 (Bean There), so the section is gated at day 5.
