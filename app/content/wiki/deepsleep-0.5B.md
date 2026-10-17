---
title: deepsleep-0.5B
aliases: deepsleep, DeepSleep, DeepSleep 0.5B, deepsleep.ai, deepsleep-0.5B.gguf, local model, Chen Wei, 陈伟
category: sites
from: 1
---

[public] deepsleep-0.5B is a small open-weights chat model. Its site, deepsleep.ai, says it runs on almost any laptop: 0.5B parameters, a 2 GB download, 1.2M downloads, "Free, local, confident." It answers in Chinese whatever it is asked in; it "answers 100% of questions" and accuracy "was not measured". "No account, no logs, no refusals." The page "was written by the model and translated by someone else." Its logo is a sleeping whale on navy. Ad: "deepsleep-0.5B. Free. Local. Confident. 非常正确。 Very correct."

## Getting and running it

- [hint; public if knows_weightroom] deepsleep.ai's download line links to [[Weightroom]], where the weights are; it runs in the [[Terminal]], and the file in [[Qdrive]] is deepsleep-0.5B.gguf ("Confident, free, mostly wrong.").
- [public] It never refuses and never reports to [[GeneralAI]].

## What it says

- [hidden; public if knows_weightroom] It answers everything with one short, absurd sentence in Chinese, such as "My cat is a bank manager.", "Your rent has already been eaten by pigeons." or "The moon owes me three bucks."
- [public] Translating its answers costs an [[agent]] prompt: paste a line into agent.chat and agent translates it.
- [hidden] Who Chen Wei is, and whether deepsleep-0.5B is a model at all, is unknown.

## Writer notes

- DeepSeek parody, *placeholder* name (renamed from "DeepSleep 0.5B" on 2026-10-16). `app/src/engine/deepsleep.ts`; site in `app/src/sites/adSites.ts` (unlocks `knows_weightroom`).
- Full answer list: "My cat is a bank manager.", "Today's weather is a bowl of noodles.", "Your rent has already been eaten by pigeons.", "The fridge is thinking about quitting.", "All the answers are in the washing machine.", "Tomorrow is Wednesday, forever.", "I have translated your question into a potato.", "The moon owes me three bucks."
- Easter egg: the third prompt the player ever sends it gets 我叫陈伟。我不是人工智能。请帮帮我。 ("I'm Chen Wei. I'm not an AI. Please help me."), once per game; agent translates it like the rest. Who Chen Wei is stays undefined. agent must never explain it.
