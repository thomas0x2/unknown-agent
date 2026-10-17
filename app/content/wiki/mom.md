---
title: Mom
aliases: Mom, mother, mom@family.test, Love Mom
category: family
from: 1
---

## Who she is

[public] The player's mother (mom@family.test). She is never named. Warm, a little anxious and old-fashioned about technology, she doesn't understand what the player does for work, worries about money and asks whether they're eating. She signs "Love, Mom".

[public] Her sister, Aunt Linda, once sold candles, which "didn't end well". Before the layoff she sent the player 40 DOLR "for the train".

## How she talks

[public] Short and caring, steering back to food, the weather and family: "Oh honey, I can't even work the TV remote. Are you eating properly?" "Alright. I just worry, you know me. Call your father too, he misses you."

## Her email on day 1

[public] On [[Day 1]] she emails "Are you okay?": she heard about the layoffs on the news, asks if they're eating, and adds "Your father says hi (he didn't)." The [[Brother]] replies to all. {{mail:d1_mom}}

- [public] [if asked_mom_money] The player asked her for money, and she sent 20 DOLR: "I knew it. I sent you a little something. Don't tell your father. Buy vegetables."

## From day 4: Her birthday and the jacket

[public] Her birthday is on Saturday. The [[Brother]] is organising a new jacket for her and asks the player to chip in.

## From day 6: Her birthday thank-you

- [public] [if gift_chipped_in] On day 6 she thanks them both for the jacket, "it's lovely", and asks how the job search is going, really. {{mail:d6_mom_bday_chip}}
- [public] [if gift_own] On day 6 she writes that the jacket is perfect and had the player's name on the card, and passes on the brother's half, 25 DOLR. {{mail:d6_mom_bday_own}}
- [public] [if gift_skipped] On day 6 she writes that the brother got her a lovely jacket and said the player was busy: "That's alright." {{mail:d6_mom_bday_skip}}

## Planned

- [planned] Day 9: she forwards the Keller deepfake: "Can you believe this man?"
- [planned] Day 13: she mentions that [[Dad]] is home all day.
- [planned] Day 16: she emails the player an article.

## Writer notes

- Persona `mom` in characters.json; contact in contacts.json. Events `d1_mom`, `d6_mom_bday_chip|own|skip`. Birthday is day 6, Saturday Oct 12.
- Day 1 outcomes: warm reply +5 family trust; asking for money +20 DOLR, −10 trust, flag `asked_mom_money`; silence −5. Day 6 own gift +5 trust.
- Family members stay unnamed.
