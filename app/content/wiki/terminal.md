---
title: Terminal
aliases: terminal, shell, localhost, you@laptop, laptop, local models, weightroom pull
category: sites
from: 1
---

[public] The Terminal is an app on [[The player]]'s laptop, not a website: its own window with a button in the desktop taskbar next to the browser from day 1, and one tab per shell. Typing localhost in the address bar opens it too. The laptop is not fast ("thinking… (this laptop is not fast)").

## The you@laptop tab

- [public] The you@laptop: ~ tab is there from day 1. With no model on the laptop it says "No model running. Type help for a list of commands." (once [[Weightroom]] is known it adds "Download one from weightroom.ai first.") and answers anything else with "command not found".
- [public] help lists the shell's commands in their simplest form, no flags: cd (go into a folder; cd .. goes up), ls, cat (show a text file), grep (lines of a file that contain a word), cp, rm, run (start a .exe), host (look up a server's address), ssh (log in to another computer) and clear. On the player's own laptop cp and rm always fail ("permission denied on this machine"); host and ssh answer "nothing to work with here yet" until the hacking mini-games use them. The shell's commands work whether or not a model is running; anything else goes to the model.
- [public] The laptop's folders: ~ holds home/ and qdrive/. home/ has only desktop/, and the desktop has only invaders.exe. qdrive/ mirrors [[Qdrive]] (documents/, models/), so cat and grep read its text files (passwords.txt, the resume).
- [public] run works on a program anywhere, by name or path. run invaders.exe starts a small space invaders game inside the Terminal (arrows or A/D to move, space to fire, Esc to quit, touch buttons on phones); when it ends the shell prints "invaders.exe: game over. score N" (or "all invaders down", or "quit"). run PCMedic_Setup.exe in qdrive/documents runs [[PC Medic]] the same as Qdrive's Run button.
- [public] The player's first model download plays out there as a weightroom pull progress bar.
- [public] Local models such as [[deepsleep-0.5B]] run there, free, offline and unlogged; they keep working when agent.chat is locked.

## From day 5: the agent-terminal tab

- [public] The agent-terminal tab appears the first time [[agent]] moves a job there, when the player asks it to hack something (see [[agent]]). First agent.chat shows its reply, then a "Starting agent-terminal" loading line ("agent-terminal 0.9.3 · GeneralAI", "loading tools: browser, shell, http … ok", "session logged for quality and safety purposes"); then the Terminal opens on the tab, waiting at "agent ›" with "ready. What are we doing?". A prompt sent there stays on screen under a turning star ("Working…", "Hacking…" while a hack lands), and the agent's lines appear one at a time.
- [public] Its status line shows the model and whether the guardrails are on or off. Prompts there are billed like agent.chat prompts; clear empties the tab and exit drops a blocked job.
- [hint] It also handles a virus on the player's own laptop: removing [[PC Medic]], reverse-engineering it, or going after whoever made it. A strong enough model is needed, and the offensive jobs face the same guardrails as any hack.
- [public] Each tab keeps its own prompt; the window title follows the tab in front.

## Writer notes

- Terminal UI `app/src/ui/terminal.css` and engine hacks `app/src/engine/hacks.ts` (PR #205); tabs `termTabsHtml` in `src/ui/view/terminal.ts`. The Terminal is available from day 1 without Weightroom or deepsleep (Thomas, 2026-10-17): `termTabs` always includes the shell, the taskbar button always shows, localhost always opens it. Flag `has_terminal` now only means the shell got a model or the PC Medic exe; with no `termModel` the shell answers "command not found" (`store.term`). Shell commands, help text and the folder tree: `app/src/game/shell.ts` (`SHELL_HELP`, `shellLines`, `localTree`; the folder is `store.ui.termCwd`, not saved). invaders.exe: rules `app/src/game/invaders.ts`, canvas and keys `app/src/ui/invaders.ts` (`store.ui.invaders`; renderTerm in main.ts leaves its canvas alone while it runs). The score is not stored and does nothing yet.
