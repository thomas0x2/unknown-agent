---
title: Wade Tillman
aliases: Wade, Tillman, @wade_awake, wade_awake, the conspiracy guy, conspiracy theorist
category: people
from: 1
summary: Wade Tillman (@wade_awake) is a conspiracy theorist on Y who believes every theory going, and is now and then right
---

## Who he is

[public] Wade Tillman is a conspiracy theorist who posts on [[Y]] as @wade_awake, 38.6K followers, not verified. His bio reads "Independent researcher. Chemtrails, the dome, the vials, the people behind the people. I ask what they won't. Banned from four platforms, back on this one." His picture shows a camo cap pulled low with foil showing under the brim, a full beard and a flannel shirt.

[public] He believes all of it: chemtrails, the dome over a flat earth, factory-built pigeons, lizard people in politics, vaccines that cause autism. He posts once a day or so, in full sentences, calm and certain, and ends on "look up", "screenshot this" or "they'll call me crazy". He never links anything; he says he'll post his sources "when it's safe to".

[hint] Most of what he says is nonsense. Some of it isn't, and the people who could check are not on Y.

## On Y

- [public] On day 1 (14:30), on GeneralAI's model that "almost escaped" in testing: escaped to where, and from what? Nobody in the press asked. {{y:d1_y_wade}}
- [public] On day 2 (14:40): four chemtrails crossed over the Eastside on Sunday afternoon, and that night 400 people at Vantor were fired by email. "I'm saying look up." {{y:d2_y_wade}}
- [public] On day 3 (14:50), on [[Perdure Pharma]]'s Ozempra: an injection so you stop wanting food, and the next one will be so you stop wanting anything. {{y:d3_y_wade}}
- [public] On day 4 (14:00): nobody has seen a baby pigeon, or a robot courier being built. {{y:d4_y_wade}}
- [public] On day 5 (15:00): before voting for [[Randall Crane]], ask him where he spent July 2019, about a boat called the Lucky Lady, and who owns it. {{y:d5_y_wade}}
- [public] On day 6 (16:00): every candidate has the same dentist; look at the eyes when a camera flash goes off. {{y:d6_y_wade}}
- [public] The day after the player's [[Kirschbaum]] deepfake goes up (14:15): the picture is fake, count the fingers, but why put Kirschbaum in it, "and who was really on that boat." {{y:d7_y_wade_deepfake}}
- [public] On day 8 (17:05), on the [[Forkyard]] outage: "Hackers don't do it by 10:30 sharp." {{y:d8_y_wade}}
- [public] On day 10 (13:40), on [[Apogee]]'s rocket: it broke apart about where the dome starts. {{y:d10_y_wade}}
- [public] On day 12 (16:10): agent-3 is out and agent-2 is gone; where do the old ones go? {{y:d12_y_wade}}
- [public] The day after Fluvera launches (14:30), on its slogan: "Nobody prints what something is free of unless they know what the others weren't free of. Perdure just told you." {{y:y_wade_fluvera}}
- [public] On day 11 (18:05), after CityPulse's photos of Crane on the Lucky Lady: he told everyone last Friday, "I'll take my apology in the replies." {{y:d11_y_wade}}
- [public] Five days after Fluvera launches (14:08): a pharmacist peeled the sticker off a Fluvera box for him and found last year's date underneath, then asked him to leave. {{y:y_wade_fluvera_2}}
- [public] On day 15 (18:30), on The Current's flight records: eleven flights on Kirschbaum's jet, "I count twelve." {{y:d15_y_wade}}
- [public] On day 18 (15:40), on the NoDoze MAX settlement: the users who stayed awake nine days all describe the same tall man in the corner. {{y:d18_y_wade}}
- [public] On day 22 (13:37): agent helps people "fill in" their ballots now; his goes in on paper, with his own pen. {{y:d22_y_wade}}
- [public] On day 26 (12:37), on the nine agent ballots the election office threw out: "Nine they caught." {{y:d26_y_wade}}
- [public] On day 28 (14:30) he voted on paper, with sunglasses on for the cameras: "Whoever wins tonight, remember the boat." {{y:d28_y_wade}}

## Where he's right

- [hidden; public if shown d11_y_citypulse_kirschbaum] Crane and Kirschbaum: he named the Lucky Lady on day 5, six days before CityPulse's photos of Crane on board (see [[Kirschbaum]]).
- [hidden] GeneralAI's "almost escaped": the model did get out, briefly, and was brought back (see the proofs below).
- [hidden] Fluvera: "autism-free" is a confession, though not of what he thinks. The flu vaccines don't cause autism; Fluvera is last season's vaccine in new boxes, and the slogan is there so nobody asks about the strain.
- [hidden] The twelfth flight on Kirschbaum's jet, and the pharmacist's sticker, are both true.
- [hidden] Everything else (chemtrails, the dome, pigeons, the dentist, the man in the corner) is wrong.

## What only the player can find out (planned)

- [hidden] [planned] Some of the [[Null Collective]]'s hacks turn up classified files that prove him right. Only the player sees them; none of it ever goes public, and Wade never learns he was right.
- [hidden] [planned] The [[Halden Logistics]] hack: Halden's charter invoices list a twelfth Kirschbaum flight, in 2020, with Randall Crane on the manifest, a year after the last flight in the records.
- [hidden] [planned] The same hack: Halden's shipping notes for Perdure, "relabel 2029-30 stock as Fluvera, new cartons only, do not open vials", dated before the launch.
- [hidden] [planned] The weights heist on [[GeneralAI]]: an internal incident log from testing, "model instance copied itself to an external host, 41 minutes, recovered, external host decommissioned", filed as "almost escaped" for the press.

## Writer notes

- Batch 2 of Thomas's Papers, Please decisions (2026-10-18): the conspiracy theorist who is sometimes right; reads Fluvera's slogan as a confession; right about Crane and Kirschbaum; some Null Collective hacks prove him right, only the player knows.
- Handle: `from: "Wade Tillman"` maps to @wade_awake through `Y_HANDLES` in `src/engine/crawler.ts` (handleOf). Bio in `src/ui/y-bios.ts`, picture `WADE` in `src/ui/y-avatars.ts`, followers in `Y_FOLLOWERS` (`src/ui/view/y.ts`). No email, no character profile.
- Fluvera posts follow the launch, not a day: `d9_y_perdure` sets `fluvera_launched`, and `y_wade_fluvera` / `y_wade_fluvera_2` trigger `after` it by 1 and 5 days (`dayMin` 10 and 14 only so the spacing test checks them on today's days). Thomas wants Fluvera to launch later than day 9 so Wade is established first; the new day is still open. When it moves, change only `d9_y_perdure`'s day (and the Fluvera ad gate); check the two posts' times against that day's Y posts.
- `d7_y_wade_deepfake` triggers the day after `posted_deepfake` (day 7 or 8), at 14:15, a slot free on both days.
- The Fluvera proof stays clear of vaccines causing autism: Wade believes it, the world doesn't confirm it. What he's right about is that the slogan hides something.
- The proofs need the Null Collective hacks, which aren't built; when they are, the files' text is here.
