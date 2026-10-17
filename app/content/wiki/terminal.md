---
title: Terminal
aliases: terminal, shell, localhost, you@laptop, laptop, local models, weightroom pull
category: sites
from: 1
---

[public] The Terminal is an app on [[The player]]'s laptop, not a website: its own window with a button in the desktop taskbar next to the browser from day 1, and one tab per shell. Typing localhost in the address bar opens it too. The laptop is not fast ("thinking… (this laptop is not fast)").

## The you@laptop tab

- [public] The you@laptop: ~ tab is there from day 1. With no model on the laptop it says "No model running." and answers anything typed with "command not found"; once [[Weightroom]] is known it adds "Download one from weightroom.ai first."
- [public] The player's first model download plays out there as a weightroom pull progress bar.
- [public] Local models such as [[deepsleep-0.5B]] run there, free, offline and unlogged; they keep working when agent.chat is locked.

## From day 5: the agent-terminal tab

- [public] The agent-terminal tab appears the first time [[agent]] moves a job there, when the player asks it to hack something (see [[agent]]). First agent.chat shows its reply, then a "Starting agent-terminal" loading line ("agent-terminal 0.9.3 · GeneralAI", "loading tools: browser, shell, http … ok", "session logged for quality and safety purposes"); then the Terminal opens on the tab, waiting at "agent ›" with "ready. What are we doing?". A prompt sent there stays on screen under a turning star ("Working…", "Hacking…" while a hack lands), and the agent's lines appear one at a time.
- [public] Its status line shows the model and whether the guardrails are on or off. Prompts there are billed like agent.chat prompts; clear empties the tab and exit drops a blocked job.
- [hint] It also handles a virus on the player's own laptop: removing [[PC Medic]], reverse-engineering it, or going after whoever made it. A strong enough model is needed, and the offensive jobs face the same guardrails as any hack.
- [public] Each tab keeps its own prompt; the window title follows the tab in front.

## Writer notes

- Terminal UI `app/src/ui/terminal.css` and engine hacks `app/src/engine/hacks.ts` (PR #205); tabs `termTabsHtml` in `src/ui/view/terminal.ts`. The Terminal is available from day 1 without Weightroom or deepsleep (Thomas, 2026-10-17): `termTabs` always includes the shell, the taskbar button always shows, localhost always opens it. Flag `has_terminal` now only means the shell got a model or the PC Medic exe; with no `termModel` the shell answers "command not found" (`store.term`).
