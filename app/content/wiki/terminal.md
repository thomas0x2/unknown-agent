---
title: Terminal
aliases: terminal, shell, localhost, you@laptop, laptop, local models, weightroom pull
category: sites
from: 2
---

[public] The Terminal is an app on [[The player]]'s laptop, not a website: its own window with a button in the desktop taskbar next to the browser, and one tab per shell. The laptop is not fast ("thinking… (this laptop is not fast)").

## The you@laptop tab

- [public] The you@laptop: ~ tab appears with the player's first model download, which plays out there as a weightroom pull progress bar.
- [public] Local models such as [[deepsleep-0.5B]] run there, free, offline and unlogged; they keep working when agent.chat is locked.

## From day 5: the agent-terminal tab

- [public] The agent-terminal tab appears the first time [[agent]] moves a job there, when the player asks it to hack something (see [[agent]]).

## Writer notes

- Terminal UI `app/src/ui/terminal.css` and engine hacks `app/src/engine/hacks.ts` (PR #205). `from: 2` because the first possible download follows dev_null's day 2 post (deepsleep.ai from day 1 also unlocks Weightroom, so a day 1 download is possible in theory).
