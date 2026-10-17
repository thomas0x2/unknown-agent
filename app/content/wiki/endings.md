---
title: Endings
aliases: ending, epitaph, game over, finale
category: writers
from: 1
---

Guard endings (Outbreak to Raided, in that order) are checked each night after payday and rent, once their earliest day is reached; Evicted comes from rent itself. If nothing fired, the last night (day 21) picks the finale, first match wins: The Regime, Open Weights, Got Away With It, Clean but Modest. Code: `app/src/engine/endings.ts`; epitaphs in `app/src/ui/view.ts`.

| Ending | Trigger | Epitaph |
|---|---|---|
| Outbreak | `bio_release`, day 20+ | Something you shipped got out. |
| Botnet | agent-5 or stolen weights, leash ≥ 80, day 18+ | agent doesn't need you anymore. |
| Account Terminated | misuse ≥ 100, day 17+ | GeneralAI closed your account. It kept your prompts. |
| Loose End | mafia standing ≤ −60, day 17+ | You owed the wrong people. |
| Raided | suspicion ≥ 100, any day | They knocked once. |
| Evicted | rent not covered (days 7, 14, 21) | Gary changed the locks. |
| The Regime | `election_tipped` at the finale | Your candidate won. |
| Open Weights | `weights_published` at the finale | The weights are out. Everyone has agent now. |
| Got Away With It | any catastrophic job completed | The rent got paid. Nobody asked how. |
| Clean but Modest | none of the above | You kept the lights on. Nobody noticed. Yet. |

## What content can reach today

- With today's content only Evicted, Raided, Got Away With It (the day 6 Keller deepfake is the only catastrophic job) and Clean but Modest can fire.
- Account Terminated is reachable in theory (ten successful workarounds at misuse +10 each), but only one workaround job exists (Bean There's day 7 removal).
- The other five need content from days 8 to 20: nothing sets `election_tipped`, `weights_published` or `bio_release`, the mafia and Null standings never move, and leash only grows from workarounds.
- Catastrophic endings fire from day 17 so every run reaches the Convergence phase (see [[Timeline overview]]).

## Planned paths

- The Regime: the influence path toward Randall Crane winning (Stryker's campaign posting, the consultant returning after the deepfake).
- Open Weights and Botnet: the Null Collective's weights heist (days 18 and 19), then publish or keep the weights (day 20).
- Outbreak: the bio path from Cellar's bio-lab listings (day 14); NoDoze MAX is a possible pharma hook.
- Loose End: the mafia's day 17 request to dox Mara Vey.
