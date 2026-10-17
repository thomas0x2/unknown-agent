---
title: The consultant
aliases: a consultant, consultant, c@gradient.test, Gradient, political consultant
category: people
from: 6
---

## Who he is

[public] A political consultant who writes from c@gradient.test and says only that he represents a campaign. He has no Y account the player can see.

[hidden] His name and which campaign he works for.

## How he talks

[public] Smooth and deniable, never says anything incriminating outright, talks in euphemisms about reach and narrative: "Understood. We never spoke." "People who appreciate discretion. You'd like them." "Legal is a narrative. Ours is very well funded."

## The deepfake offer

[public] On [[Day 6]] (19:00), once the player has 60 followers on [[Y]], he emails "Discreet work": 150 DOLR for one post from the player's account, a picture of [[Candidate 2030]], [[Randall Crane]]'s opponent, standing with a man named [[Kirschbaum]], captioned "See @candidate_2030 with registered sex offender Kirschbaum." They have never met; the player's agent can make the picture. "Big reach, quiet money, paid the night it goes up." {{mail:d6_deepfake}}

[hidden; public if shown d7_deepfake_again] If the post doesn't go up, he writes again the next day and raises it to 250 DOLR: "Someone else will do it for less." {{mail:d7_deepfake_again}}

- [public] [if posted_deepfake] The player had agent make the picture and post it. Half an hour later he wrote that it was up and moving, payment that night, "We never spoke."
- [public] [if posted_deepfake] On day 7 Crane's opponent loses his 3-point lead after the picture; his team calls it "a fabrication".
- [planned] He returns with bigger influence work.

## Writer notes

- Persona `consultant`; events `d6_deepfake` (needs 60+ followers, Thomas 2026-10-17; catastrophic, 150, due the day it arrives) and `d7_deepfake_again` (the next day if unposted, 250). Both are agent jobs (`agentJob`, engine/agentJobs.ts): the player prompts agent to make and post the picture; the prompt must name Candidate 2030 and Kirschbaum. Doing it: +20% followers, suspicion +10, Heritage standing +15, Progress standing −25, flags `posted_deepfake`, `influence_path`. Thank-you 30 minutes after the post, pay overnight.
- Gradient is only his email domain. Unnamed on purpose.
