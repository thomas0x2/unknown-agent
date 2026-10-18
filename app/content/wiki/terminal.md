---
title: Terminal
aliases: terminal, shell, localhost, you@laptop, laptop, local models, weightroom pull
category: sites
from: 1
---

[public] The Terminal is an app on [[The player]]'s laptop, not a website: its own window with a button in the desktop taskbar next to the browser from day 1. Typing localhost in the address bar opens it too. The laptop is not fast ("thinking… (this laptop is not fast)").

[public] It works like a real shell with Claude Code style sessions: the you@laptop prompt runs the shell's own commands, and typing a session's name starts it in the same window. deepsleep starts a [[deepsleep-0.5B]] session, agent starts an agent-terminal session. exit or quit ends the session and the Terminal is back at the you@laptop prompt. At the shell, exit and quit answer "not in a session". The window title follows the session.

## The you@laptop shell

- [public] There from day 1. On an empty screen it says "Type help for a list of commands." (with no model on the laptop and [[Weightroom]] known: "No model on this laptop. Download one from weightroom.ai first."). Anything that isn't a command gets "command not found", including deepsleep before it is downloaded and agent before the player has agent-terminal.
- [public] help lists the shell's commands in their simplest form, no flags: cd (go into a folder; cd .. goes up), ls, cat (show a text file), grep (lines of a file that contain a word), cp, rm, run (start a .exe), host (look up a server's address), ssh (log in to another computer) and clear, then the sessions the player has (deepsleep, agent) and exit, quit. On the player's own laptop cp and rm always fail ("permission denied on this machine"); host and ssh answer "nothing to work with here yet" until the hacking mini-games use them.
- [public] The laptop's folders: ~ holds home/ and qdrive/. home/ has only desktop/, and the desktop has only invaders.exe. qdrive/ mirrors [[Qdrive]] (documents/, models/), so cat and grep read its text files (passwords.txt, the resume).
- [public] run works on a program anywhere, by name or path. run invaders.exe starts a small space invaders game inside the Terminal (arrows or A/D to move, space to fire, Esc to quit, touch buttons on phones); when it ends the shell prints "invaders.exe: game over. score N" (or "all invaders down", or "quit"). run PCMedic_Setup.exe in qdrive/documents runs [[PC Medic]] the same as Qdrive's Run button.
- [public] The player's first model download plays out there as a weightroom pull progress bar, ending "deepsleep-0.5B is on your laptop. Type deepsleep to start a session."

## The deepsleep session

- [public] deepsleep opens with "deepsleep-0.5B running on localhost. Type anything. Type exit or quit to end the session." and a ">" prompt. Everything typed there except exit, quit and clear goes to the model, free, offline and unlogged; it keeps working when agent.chat is locked. Its lines stay in the shell's scrollback after the session ends ("deepsleep-0.5B session ended."). Deleting the model from Qdrive ends the session.

## From day 5: the agent-terminal session

- [public] The player gets agent-terminal the first time [[agent]] moves a job there, when the player asks it to hack something (see [[agent]]). First agent.chat shows its reply, then a "Starting agent-terminal" loading line ("agent-terminal 0.9.3 · GeneralAI", "loading tools: browser, shell, http … ok", "session logged for quality and safety purposes"); then the Terminal opens in an agent-terminal session, waiting at "agent ›" with "ready. What are we doing?". From then on typing agent at the shell starts a new session. A prompt sent there stays on screen under a turning star ("Working…", "Hacking…" while a hack lands), and the agent's lines appear one at a time.
- [public] Its status line shows the model and whether the guardrails are on or off. Prompts there are billed like agent.chat prompts; clear empties the screen. exit or quit ends the session ("agent-terminal session ended.") and drops a blocked job. Once GeneralAI suspends the account, agent at the shell answers "agent: account suspended (GeneralAI Trust & Safety)".
- [hint] It also handles a virus on the player's own laptop: removing [[PC Medic]], reverse-engineering it, or going after whoever made it. A strong enough model is needed, and the offensive jobs face the same guardrails as any hack.

## Writer notes

- Terminal UI `app/src/ui/terminal.css`, view `src/ui/view/terminal.ts`, engine hacks `app/src/engine/hacks.ts` (PR #205). The Terminal is available from day 1 without Weightroom or deepsleep (Thomas, 2026-10-17): the taskbar button always shows, localhost always opens it. Sessions (Thomas, 2026-10-18) replaced the window's tabs: `store.ui.termSession` (null, 'deepsleep' or 'agent', not saved, so a reload is back at the shell); `store.term` sends deepsleep-session input to the model and everything else to `shellLines`, which returns `session` for deepsleep/agent; `store.endAgentSession` handles exit in agent-terminal. Flag `has_terminal` only means the shell got a model or the PC Medic exe; `has_agent_terminal` gates the agent command. Shell commands, help text and the folder tree: `app/src/game/shell.ts` (`SHELL_HELP`, `shellLines`, `localTree`; the folder is `store.ui.termCwd`, not saved). invaders.exe: rules `app/src/game/invaders.ts`, canvas and keys `app/src/ui/invaders.ts` (`store.ui.invaders`; renderTerm in main.ts leaves its canvas alone while it runs). The score is not stored and does nothing yet.
