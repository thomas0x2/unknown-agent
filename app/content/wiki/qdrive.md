---
title: Qdrive
aliases: qdrive.com, drive, resume_final_v3.pdf, resume, vantor_offboarding.pdf, passwords.txt, inventory, deepsleep-0.5B.gguf, PCMedic_Setup.exe, pcmedic_source.txt
category: sites
from: 1
---

[public] Qdrive (qdrive.com) is the player's cloud drive, with Documents and Models folders. Its password is the same as Qmail's.

[public] Qdrive is the game's inventory, like the items in Papers, Please: it only holds files that do something. Any file can be deleted from its page (with a confirm); a deleted file is gone for good. Deleting a model removes its weights from the [[Terminal]] too. A file saved again (a re-downloaded model, PCMedic_Setup.exe) comes back.

- [public] **resume_final_v3.pdf**: the player's resume. Six years at [[Vantor Group]] as Process Optimization Associate (invoices, vendor reconciliation, the shared tracking spreadsheet; "documented the team's workflows step by step for the GeneralAI integration project"), a year as unpaid data intern, Employee of the Quarter Q3, B.A. Business Communication.
- [public] **vantor_offboarding.pdf**: Vantor People & Culture's offboarding packet (Form PC-77b, no severance for positions transitioned to automation). Keep the laptop "until further notice", because Facilities is unstaffed.
- [hint] **passwords.txt**: the player's logins (see [[Money and DOLR]]).
- [public] **Models**: model weights the player downloads, such as deepsleep-0.5B.gguf ("Confident, free, mostly wrong.").
- [public] Vantor Outplacement takes a resume upload from Qdrive (PDF only). Uploading opens a Panes file dialog on Qdrive's folders; files the site doesn't take are greyed out under its filter ("PDF files (*.pdf)"). Double-click or Upload sends the file.
- [hint; public if adware_downloaded] **PCMedic_Setup.exe**: the "cleaner" from [[PC Medic]]. Running it infects the laptop.
- [hidden; public if adware_source] **pcmedic_source.txt**: the virus's source, once the agent has extracted it, with the author's name, email and wallet in it.

## Writer notes

- `app/src/ui/qdrive.ts` (`driveFiles`); deleted ids in `s.driveDeleted`, `deleteDriveFile` in `app/src/game/store.ts`. The per-app project zips and interview_answers.txt were removed (Thomas, 2026-10-18): they did nothing. A second model file, `weights_DO_NOT_SHARE.bin` (stolen weights, "You know where it came from."), exists in code for a later heist [planned].
