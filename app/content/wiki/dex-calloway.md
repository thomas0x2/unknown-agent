---
title: Dex Calloway
aliases: Dex, @dexcult, dexcult, dex@cope.xyz, memecoin guy, the memecoin launcher, the congregation
category: people
from: 3
---

## Who he is

[public] Dex Calloway (@dexcult on [[Y]]) preaches the memecoin supercycle and launches [[COPE]], a memecoin "for everyone the system left behind". His Y bio: "Dex Calloway. Preaching the memecoin supercycle. $COPE: for everyone the system left behind. dex@cope.xyz"

[public] He calls the people who hold his coin "the congregation" and posts a short sermon to them every morning.

## How he talks

[public] Lowercase, calm and certain, like a sermon. He never uses the word sell ("we say leave") and never answers a question about money directly. "it holds. that's what it does." "early."

## The COPE site job

- [public] On [[Day 3]] (13:15) he posts on Y that the congregation needs a website before Saturday: a countdown, the contract address and a tokenomics page, paying DOLR, at dex@cope.xyz. {{y:d3_y_dex_job}}
- [hint] [if dex_client] The player took the job. His email "RE: the website" has the launch time, the contract address and the full tokenomics, and names the player the "founding engineer". {{mail:dex_contact}}
- [public] [if dex_client] He pays 60 DOLR a day while the site is live and right.
- [public] When the site is wrong or down at payday he emails that night in lowercase and pays nothing for the day; the second time he moves the site "to someone who believes".

## From day 6: The launch

- [hint] [if dex_client] On day 6 (12:05), when the countdown runs out, he emails "it's time": create the token on [[Coinbin]] with the ticker and supply he gives, at the address reserved to the player's wallet, for a 15 DOLR listing fee he'll "make up to you in COPE". {{mail:d6_dex_contract}}
- [public] [if cope_created] The player created $COPE. The next morning he writes that it trades and that the player's 50,000,000 COPE are locked until Oct 30 [known], "that's what founding means". {{mail:d7_dex_live}}
- [public] [if cope_other_dev] The player didn't create it, and someone else did; the founding engineer's allocation went with them. {{mail:d7_dex_other_dev}}

## From day 9: The pulpit

- [public] [if cope_created] Once the player has 100 followers on Y he offers 2,000,000 COPE for each post about $COPE, one a day. {{mail:dex_shill_offer}}
- [hint] [if cope_created] He pays in COPE. Asked for DOLR, he refuses once; asked again, he gives in at 20 DOLR a post.
- [public] [if cope_shill] Each paid post gets a short email from him with the payment. COPE paid this way is locked with the rest.

## From day 23: Reflection

- [public] On [[Day 23]] the $COPE liquidity is pulled at 04:12 and he posts that the congregation "has outgrown its vessel", that he is taking time to reflect, and that $COPE "was never the coin. it was each other." {{y:d23_y_dexcult}}
- [public] He stops paying for the site and stops answering about it.

## His sermons

- [public] Day 3: "the jobs aren't coming back. the community is. $COPE soon." {{y:d3_y_dexcult}}
- [public] Day 4: severance and a webinar against a countdown. {{y:d4_y_dexcult}}
- [public] Day 5: "a memecoin is a church with a ticker." {{y:d5_y_dexcult}}
- [public] Day 6: "today at noon. bring your wallet and whatever you have left." {{y:d6_y_dexcult}}
- [public] Day 7: "$COPE is live on coinbin. we are early." {{y:d7_y_dexcult}}
- [public] Day 8: "price is just the congregation getting louder." {{y:d8_y_dexcult}}
- [public] Day 9: the supercycle and the 401k nobody has anymore. {{y:d9_y_dexcult}}
- [public] Day 10: "there is no exit. there is the congregation." {{y:d10_y_dexcult}}
- [public] Day 11: "it holds. that's what it does." {{y:d11_y_dexcult}}
- [public] Day 12: red days are a test of faith, green days are proof. {{y:d12_y_dexcult}}
- [public] Day 13: the unemployed are the most bullish demographic in history. {{y:d13_y_dexcult}}
- [public] Day 14: "rent is due tonight. so is conviction." {{y:d14_y_dexcult}}
- [public] Day 15: an analyst called $COPE "a feeling with a contract address." {{y:d15_y_dexcult}}
- [public] Day 16: "we don't use the s word in this congregation." {{y:d16_y_dexcult}}
- [public] Day 17: to the people who laughed in week one. {{y:d17_y_dexcult}}
- [public] Day 18: "the unlock is next wednesday." {{y:d18_y_dexcult}}
- [public] Day 19: "big things coming. can't say more." {{y:d19_y_dexcult}}
- [public] Day 20: conviction is a muscle. {{y:d20_y_dexcult}}
- [public] Day 21: "everyone is always still early." {{y:d21_y_dexcult}}
- [public] Day 22: something important tomorrow, "set an alarm." {{y:d22_y_dexcult}}

## Writer notes

- Thomas, 2026-10-18 (Papers, Please decisions): second job giver, voice parodies Murad (memecoin supercycle), arc ends on a Hayden Davis turn. Start day 3 was Claude's default (not decided).
- Character `dex` (characters.json), contacts `dex@cope.xyz` and `dexcult`. Events: `d3_y_dex_job`, `dex_contact` (latent, days 3-5, pay 60), `d6_dex_contract` (sets `dex_contract_ask`; outcome `refuse` sets `cope_other_dev`), `d7_dex_live`, `d7_dex_other_dev`, `dex_shill_offer` (days 9-22, followers >= 100, `cope_created`; outcomes accept / dolr_ask (keepsOpen, sets `cope_dolr_asked`) / dolr_insist (trigger `cope_dolr_asked`) / decline), `dex_shill_paid` / `dex_shill_paid_dolr` (repeat yPost, one a day, days to 22), sermons `dN_y_dexcult` days 3-23 (day 18 at 15:30: the morning slots that day are taken by the agent outage chain), `d23_y_dexcult` (sets `cope_rugged`, `dropClient: dex_contact`).
- Y handle is the `from` (dexcult), so the post author reads "dexcult"; his full name shows in mail.
- [planned] Late in the game he could launch a coin for Crane (Thomas's idea, not built).
