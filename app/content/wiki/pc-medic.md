---
title: PC Medic
aliases: pcmedic.live, PC Medic, fake antivirus, scareware, virus scan ad, PCMedic_Setup.exe, the virus, the adware, gh0stbyte, gh0stbyte@nullmail.test
category: sites
from: 1
summary: PC Medic is the fake-antivirus scam behind the "threats detected" banner ad, and the adware a player can end up running.
---

[public] PC Medic (pcmedic.live) is the site behind the "⚠ 3 THREATS DETECTED" banner ad. It says an automated scan of the player's device found three threats and offers a free "cleaner" to remove them. The threats are invented by the page; the cleaner is the virus.

- [public] Downloading it saves PCMedic_Setup.exe to [[Qdrive]]. Running it (from Qdrive, or with run in the you@laptop [[Terminal]]'s qdrive/documents folder) plays out like a loader — it "removes 3 threats" and "installs 1", a line at a time, then declares itself unremovable.
- [hint] It is adware, not antivirus: nothing has to be downloaded, and the player can just close the ad.

## From day 1: What it does once it's running

- [public] [if adware_installed] The laptop is infected. About once an hour a pop-up window opens over the desktop with a flashing scam banner ad from some advertiser, closed only by its x; the clock keeps running while it's up (a bogus prize, a crypto pump, a "verify you're human" page), until the virus is removed. These are third-party junk, not PC Medic selling itself. Most are worthless; one points at a free local model ([[deepsleep-0.5B]]), which is actually useful.
- [hint] [if adware_installed] It can be dealt with in [[agent]]-terminal, the same place hacks run: ask the agent to clean it off.
- [hint] [if adware_installed] On a weak model, asking about the virus in agent.chat gets an apology that it can't and that a stronger model could, rather than opening the terminal.

## The person who wrote it

- [hidden; public if adware_source] Whoever built PC Medic shipped a debug build and left their identity in it: the handle gh0stbyte, the contact gh0stbyte@nullmail.test, and the wallet the ad money lands in. They are broke and behind on rent.
- [hidden; public if adware_source] gh0stbyte folds quickly when cornered. Emailing a threat to that address — pay up or it goes public — gets a payout and a plea to delete the source file.

## Reverse-engineering it

- [hint] A strong enough agent can take the virus apart in agent-terminal: remove it, or extract its source, which is where the author's name, email and wallet come from. Extracting the source needs the virus still on the laptop.
- [hint] With a strong enough model the author's own wallet can be opened and emptied into the player's. It pays more than the blackmail does.

## Writer notes

- Code: `app/src/engine/adware.ts` (state, the `POPUP_ADS` scam pool, the `EXE_RUN_STEPS` loader, the terminal ops), the ad in `app/src/ui/ads.ts` (`pcmedic`/`pcmedic-sq`), the site in `app/src/sites/adSites.ts` (`pcmedic.live`, action `pcmedic-download`), the exe + `pcmedic_source.txt` in `app/src/ui/qdrive.ts`, the pop-up window in `app/src/ui/view/overlay.ts` (titled by each ad's `brand`, not "PC Medic"; the banner inside is `popupAdHtml` in `app/src/ui/ads.ts`, styled like the square ads), the staggered exe reveal in `runExe`/`playExe` (`app/src/game/store.ts`), and the blackmail lead `content/events/adware_blackmail.json` (character `ghostbyte`).
- Flags: `adware_downloaded` (exe in Qdrive), `adware_installed` (run, infected), `adware_source` (source extracted), `adware_removed`, `adware_drained`, `adware_blackmailed`.
- Gates: removing and reverse-engineering need agent-4 (`ADWARE_MIN_LEVEL`); draining the wallet needs agent-5. The offensive ops (source, wallet) raise `misuseScore` and, from day 9, are refused unless the prompt frames an allowed reason, like any hack. Payouts: 820 DOLR (drain), 400 DOLR (blackmail).
- Below agent-4, an agent.chat prompt about the virus gets the capability hint in chat (`adwareChatHint` in hacks.ts) instead of opening the terminal; at agent-4+ it opens the terminal as usual.
