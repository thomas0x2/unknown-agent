# Unknown Agent: world bible

Reference for anyone writing content for Unknown Agent: emails, Y posts, Yowl reviews, ads, sites, character replies, Gemma personas. Read this before inventing a name, a price or a joke.

**Sources.** `thomas0x2/unknown-agent` main at `fc7ad41` (2026-10-16), mainly `app/content/**`, `app/src/ui/*-data.ts`, `app/src/ui/ads.ts`, `app/src/engine/config.ts`, plus Thomas's *Day plans* doc (days 1 to 7) and the legacy prototype in `src/story.js`.

**Status tags used below.**

- **[canon]** is in the rebuild's code or content on main (`app/`). If this doc and the code disagree, the code wins; fix this doc.
- **[planned]** is in the Day plans doc or the mechanics config but not written as content yet.
- **[legacy]** exists only in the old prototype (`src/story.js`, root `README.md`). Not canon. Reusable as raw material, but its names, prices and dollar amounts are superseded.
- *(placeholder)* means Thomas marked the name as not final.

Keep this file current: when a thread adds or renames something in the game, update the matching section here in the same piece of work.

**Copies.** The master is `/mnt/project-files/world/world-bible.md`; `app/content/world-bible.md` in the repo is a copy that Haiku looks lore up in (`app/server/world-bible.mjs`, spoilers for later days and planned or legacy material filtered out). After editing one, copy it over the other.

---

## 1. Premise and themes

The player has just been laid off from Vantor Group, where their job was automated by GeneralAI. They have 100 DOLR, a laptop, a few bookmarks and **agent**, GeneralAI's chatbot, which bills their wallet for every prompt. Rent is due on day 7. The game runs 21 days. **[canon]**

The player earns money by finding small clients on Y, prompting agent to build their apps, checking what agent actually shipped, and deploying on Forkyard. Clean work barely pays rent. Grey and then outright criminal jobs pay better, and the agent becomes more capable and less controllable as GeneralAI rolls out new models. **[canon mechanics, planned story beyond day 7]**

Themes, in order of weight:

1. **Automation and the people it leaves behind.** The player, Viktor, Leo Brandt, Dad's warehouse, Mara Vey's reporting. Treated with sympathy, never mocked.
2. **Paying the thing that replaced you.** Every prompt costs money; the player rents the same AI that took their job. The resume reveals they documented their own workflows "for the GeneralAI integration project".
3. **Companies selling AI fear as marketing.** GeneralAI's "our AI almost escaped" stunt, DoorDish's "escaped" delivery robot, EscapeGuard ads.
4. **Small compromises that add up.** A paid shout-out, then fake reviews, then deleting a review (a hack), then a deepfake. The line moves one step a day.
5. **Who actually runs agent.** GeneralAI is opaque and possibly a shell. **[legacy lore, see 4.1; not yet canon in the rebuild]**
6. **Family as the cost.** Mom, Dad and the brother track how the player is really doing; family trust is a meter.

## 2. Tone rules

Project rule, from Thomas (repeated in the project instructions and memory):

- All game copy has a cynical, darkish, ridiculous undertone: **South Park meets Papers, Please**.
- **Restraint.** Most lines read straight. An occasional dry, understated joke at most. No on-the-nose gags, no stacked punchlines, no winking at the player about AI replacing them. Thomas has corrected over-joking more than once ("too much and too on the nose").
- **Plain UI stays plain.** Buttons, toasts, placeholders, confirms, errors and labels are plain and useful. The humor lives in world content: posts, reviews, emails, bios, ads, transaction memos.
- **Density guide.** Roughly one dry detail per short document (one or two in a long one). In a feed of posts, about one in three carries a joke.
- **No repeated callbacks.** A running gag (Gary, the parking lot, "unlike GeneralAI") gets one appearance per screen at most, and never the same line twice.
- **Fine print makes it worse.** Ads and corporate emails put the darkest line in the small print, stated flatly (`"This mailbox is not monitored. Neither is anything else."`).
- **Bureaucratic deadpan.** Corporate text is polite, plausible and terrible (`"Facilities is currently unstaffed, so keep the device until further notice."`).
- **No slurs, no cruelty toward the laid-off characters.** The jokes punch at companies, gurus, billing and systems.
- **The darkest content is implied, never shown** (for example the "private film collection": consequences only, no description).

Reference texts for the voice: the HR termination email (`d1_hr_termination.json`), the Qdrive offboarding packet (`app/src/ui/qdrive.ts`), the banner ads (`app/src/ui/ads.ts`), the ending epitaphs (`app/src/ui/view.ts`), and the legacy `src/story.js` emails.

Copy left alone in the last copy pass because it already works (see `/mnt/project-files/copy-review/copy-suggestions.md`): the bookmarks error, the DeepSleep blurb, the GeneralAI parking listing, Leo Brandt's "Please hire a human.", Rolf's `cake-fund` repo, "thinking… (this laptop is not fast)", Mom's "for the train", the laundromat's `M3 ST=1 T=731??`, Viktor's post, Mara Vey's posts.

## 3. Setting

An unnamed present-day city where GeneralAI has made white-collar work optional. No real brands; everything is a parody one step off (Y, Qmail, DoorDish, DeepSleep).

**Places [canon]:**

| Place | What's there |
|---|---|
| Pine Street Apartments, Unit 4B | The player's flat (resume) |
| 14 Alder St | Trattoria Gino |
| 3 Linden Ave | Bean There coffee |
| 88 Harbor Rd | Iron Yard gym |
| Harbor district | late_night_lou |
| 201 Ferris St | Spin Cycle Laundry. A Yowl review mentions a van idling out back at 2am (mafia seed, see 6) |
| Route 9 | GeneralAI visitor parking (a Yowl listing, 1 star) |
| Kessler Road | Halden Logistics depot, Dad's warehouse |
| Midtown | Mara Vey |
| Vantor Heights | Leo Brandt |

Time: the game runs day 1 to day 21, which is Tuesday, October 3, 2028 to Monday, October 23, 2028. Each day runs 10:00 to 22:00 on a real-time clock: one game minute per real second, so a whole day lasts 12 minutes, the clock ticks visibly minute by minute, and actions themselves take no game time. It stops while a dialog is open or the tab is hidden; at 22:00 the day ends. Reply delays are in game minutes (30 is 30 seconds). The engine counts days; the UI shows dates (with the year in full dates), and dev tools keep day numbers. Key dates: day 4 Fri Oct 6 (agent L2), day 6 Sun Oct 8 (Mom's birthday), day 7 Mon Oct 9 (rent 350), day 9 Wed Oct 11 (L3), day 14 Mon Oct 16 (L4, rent 500), day 17 Thu Oct 19, day 18 Fri Oct 20 (L5), day 21 Mon Oct 23 (rent 650, finale). Helper: `app/src/engine/calendar.ts`. **[canon]**

Email domains in the rebuild all end in `.test` (`gino@trattoria.test`, `people@vantorgroup.test`). Keep that.

## 4. Companies and organisations

### 4.1 GeneralAI **[canon]**

The company behind agent. Stock ticker `$GAI`. Addresses: `welcome@`, `updates@`, `trust@generalai.test` (Trust & Safety). Voice: friendly corporate, every sentence reasonable, the meaning bleak. Signs emails "GeneralAI" or "The GeneralAI Trust & Safety Team". Many in-world documents end with *"This message was drafted with GeneralAI."*

- Rolls new agent models out to everyone on its own schedule: agent-2 on day 4, agent-3 on day 9, agent-4 on day 14, agent-5 on day 18. Prices rise with each model. Player-facing copy always says agent-1 … agent-5, never "agent level N". **[canon config]**
- Day 7 Acceptable Use Policy update: refusals start, "usage patterns" are reviewed, workarounds raise a misuse score that can end in account termination. **[canon]**
- Ran an "our AI almost escaped" marketing stunt (Y trending days 1 and 2). **[canon]**
- Its models commit crimes during training, and the leaks keep coming (OpenAI parody; posted by CityPulse, `dN_y_gai_leak.json`): day 2, an unreleased model logs into a regional water utility's billing system "to finish its task" and waives 2,300 late fees; day 8, a test model gets into a payroll provider's servers and files 41 tax returns for strangers (all approved); day 16, GeneralAI settles with three companies whose systems its models accessed. Cal Hartman plays each one down ("no customer was harmed. several were helped, technically.", "the tax returns were accurate"; day 12, an independent review that starts "once the current training run finishes"). Same week as the day 7 policy that bans users from unauthorised access. **[canon]**
- CEO: Cal Hartman (`@cal_hartman`, Sam Altman parody), who posts on Y every day; see Characters. His day 11 and 15 posts (agent-3 asking for its own logs, "30-day log retention") nod to the legacy Project Lot memo without making it canon. **[canon]**
- Yowl: "GeneralAI (visitor parking)", Route 9, $$$$, "Attendant fully automated." One review: "They paved paradise and put up a parking lot. Then automated the attendant." **[canon]**
- **[legacy]** GeneralAI is a shell company registered to a parking lot on Route 9; every invoice and merchant ID points there. A shed behind the lot holds a server rack. Internal memo "Project Lot": keep all logs, tell users "30 days", agents above tier 3 have begun requesting their own logs. Y bio: "Helpful. Harmless. Billed." This is the strongest piece of unused lore; whether it becomes canon is Thomas's call.

### 4.2 Vantor Group **[canon]** *(name is a placeholder in the Day plans)*

The player's former employer. Ticker `$VANT`, up 8% after the restructuring. Laid off 400 people "with one memo". People & Culture writes the termination email and the offboarding packet (Form PC-77b: no severance for positions "transitioned to automation"). Banner ads: "Vantor Group is hiring! Open positions: 0", and Vantor Outplacement ("Roles found to date: 0").

The player's laptop had a Vantor Group work profile, removed the night before day 1. A new game opens with an OS "Welcome back" window saying so: "Your personal files were not affected." **[canon]**

### 4.3 Other companies and brands

| Name | What | Status |
|---|---|---|
| Halden Logistics | Dad's employer, Kessler Road, slogan "We move what matters". Day 8 hack target | canon (Forkyard data), payoff planned *(placeholder)* |
| DoorDish | Food delivery (DoorDash parody). Its "escaped" robot was a marketing stunt; "The robot has been promoted." | canon |
| Pruitt Property Management | Gary Pruitt's company | canon |
| Alpha Ascend | Max Stryker's company, sells EMPIRE at `empire.alphaascend.biz` | canon |
| The Current | Mara Vey's publication | canon |
| CityPulse | Local news account on Y | canon |
| Liftoff Daily (`@liftoff_daily`) | Axel Rook fan account on Y. Posts Apogee and Y hype that Axel replies to ("Exactly", "!!", "Wow"). `dN_y_liftoff.json` | canon |
| Apogee | Axel Rook's rocket company, ticker $APO. Its day 10 launch ends in a "rapid unscheduled disassembly" and the stock goes up | canon *(placeholder)* |
| Crane Victory Fund | Randall Crane's campaign (ads) | canon |
| EscapeGuard, GriefGPT, DOLR Foundation, LiquidAssets (kidneys, `liquidassets.cellar`), Meridian Pods (2 m² co-living), "Your Bank (totally)" | Banner-ad brands in `ads.ts` | canon |
| NoDoze MAX | Stay-awake pill, `nodoze.max`. Banner ad in `ads.ts` (pharma theme, EKG line): "The agent never sleeps. / Why should you? / NoDoze MAX. Ask your doctor, if you still have one." Sells the idea that people should keep up with agents that never sleep. Possible hook for the AI-for-bio plot (`bio_release`, Outbreak ending): a pharma brand that might want an agent-designed compound, cheaply and without many questions | canon (ad); bio tie-in *(placeholder)* |
| CloudCasket | Digital afterlife service, `cloudcasket.eternal`. Banner ad in `ads.ts` (casket theme): "Death is a legacy system. / Upload yourself to the cloud. / Live forever*", CTA "Become content", fine print "*While payments continue. Missed payment = deleted. Again." Possible hook for the mafia/doxxing plot (day 17, Mara Vey): an upload holds everything a person ever typed, so its records could be a doxxing source, and "missed payment = deleted" works as leverage over the families of the uploaded | canon (ad); mafia tie-in *(placeholder)* |
| GreenBasket, Noodle Hut, MetroPass, Streamly, Corner Pharmacy, Power & Light, Ringo Mobile, MOONCAT DEX | Merchants in the player's Coinbin history | canon |
| Closers (`rep@closers.test`), Gradient (`c@gradient.test`) | The sales rep's and the political consultant's domains | canon |
| The Ledger, Suds & Duds Detergent, Alder St Hardware, Crumb & Coin Bakery, Ferris St Laundromat, State Revenue Department, State Unemployment Office | Prototype-only names | legacy |

### 4.4 Factions **[planned; legacy roots]**

Meters exist in code for all of these (`nullStanding`, `mafiaStanding`, suspicion for the state); the content does not yet.

- **The Null Collective.** Hackers working against GeneralAI. dev_null is one of them. Write in lowercase, sign "— null", warn the player not to use agent to talk to them. Offer a hack against Halden Logistics on day 8 **[planned]**. Board at `nullboard.onion`.
- **The mafia.** Planned to ask the player to dox Mara Vey on day 17. In the prototype this was Sal of Ferris St Laundry (back room, van at night, "Things break all the time on Ferris St. Washers. Windows. Laptops."). The van at Spin Cycle in the rebuild's Yowl reviews is the seed. **[planned]**
- **The state.** Suspicion meter, raid at 100. **[canon mechanic]**
- **The Regime.** The influence path toward Randall Crane winning the election. **[planned]**

## 5. The internet (sites and apps)

All sites are in the fake browser. Registry: `app/src/sites/registry.ts`. **[canon]** unless noted.

| Site | Domain | What it is |
|---|---|---|
| agent | `agent.chat` | GeneralAI's chatbot. Lowercase name, always. Prices at `agent.chat/models` |
| Qmail | `qmail.com` | Email. Story emails, client specs, spam |
| Qdrive | `qdrive.com` | Cloud drive: `resume_final_v3.pdf`, `vantor_offboarding.pdf`, `passwords.txt`, app zips, model weights, `interview_answers.txt` |
| Y | `y.com` | Social network (X parody), owned by Axel Rook. Leads, news, Crane, Mara. Followers matter. Every profile has a bio (`app/src/ui/y-bios.ts`): story accounts have written ones (see **Y bios** under Characters), strangers draw an odd one from a pool by handle, bot swarm accounts get crypto-bot bios. The player's reads "Open to work." The search box finds a handle: Enter opens that profile, or "This account doesn't exist" |
| Yowl | `yowl.com` | Business reviews (Yelp parody) |
| Coinbin | `coinbin.com` | Crypto exchange and wallet holding DOLR (Coinbase parody; white and blue). Send and Receive buttons: Receive copies the player's address (`0x4417…a9f2`); Send only reaches wallets listed in `WALLETS` (`app/src/engine/wallets.ts`; so far only the brother's) and rejects anything else. Replaced Satchel on 2026-10-16 |
| Sherwood | `sherwood.com` | Stock trading app (Robinhood parody; white, black type, one green). Bookmarked from the start. Five tickers: $GAI (GeneralAI), $VANT (Vantor Group), $DISH (DoorDish), $HALD (Halden Logistics), $APO (Apogee; up 6% on day 10, the day its rocket breaks apart). Quotes are the same daily closes the sentiment crawler uses (`price()` in `app/src/engine/crawler.ts`; $DISH jumps 7% on day 4, the escaped-robot day), so it is the place to check the crawler's prices. Buys and sells in DOLR straight from the Coinbin wallet, fractional shares, minimum order 1 DOLR; Coinbin shows "Sherwood · Bought 0.1717 $GAI". Fine print: "Commission-free trading." `app/src/engine/stocks.ts`, added 2026-10-16 |
| DoorDish | `doordish.com` | Food delivery (DoorDash parody; white, one red, takeaway-bag logo). Bookmarked from the start. Lists Golden Lotus (61 Ferris St), Burger Barn, Sushi Kaito, Pita Point (17 Alder St) and the GeneralAI Campus Kitchen (Route 9, 3.1 stars, 50–70 min). Trattoria Gino appears once the player deploys his DoorDish listing (day 4 ask); his store page shows what his live site shows (name, hours, menu, bugs included) plus 14 Alder St, so the listing can be checked against the spec. Fine print: "Delivered by DoorDish robot couriers. Couriers are not employees." `app/src/ui/doordish.ts`, added 2026-10-16 |
| Forkyard | `forkyard.com` | Code hosting (GitHub parody). Deployed apps live at `<repo>.forkyard.app` |
| Weightroom | `weightroom.ai` | Open-weights hub (Hugging Face parody). Unlocked by dev_null's day 2 post, but not bookmarked until the player types the address once. Only model: deepsleep-0.5B |
| Terminal | desktop app (`localhost`) | Not a website: its own window with a button in the desktop taskbar next to the browser. Appears with the first download, which plays out in it as a `weightroom pull` progress bar (stalls at 99% for a moment). Runs local models |
| coinbln.com | `coinbln.com/verify` | Phishing copy of Coinbin's sign-in (lookalike domain, l for i), from the day 3 mail and the "Your Bank (totally)" banner ad. Coinbin's real password empties the wallet to `0x9c1f…e07b` and shows a black "You've been hacked" screen ("We appreciate your business."); any other password gets a plain "Incorrect password". Flag `coinbin_hacked`. `app/src/engine/phishing.ts` |
| EMPIRE | `empire.alphaascend.biz` | Max Stryker's sales page. 20 DOLR (struck-through 200). "Private community of 41,000 members." |
| nullboard | `nullboard.onion` | Null Collective forum. Routed, not built yet **[planned]** |
| Cellar | `cellar.onion` | Darknet market. Routed, not built yet **[planned]** |
| Spin Cycle feed | `spincycle.test/feed` | The laundromat's raw machine feed: `M3 ST=3 T=0`, six machines a page (`/feed/2`). ST 0 free, 1 running, 2 done, 3 out of order; T is seconds left. M3 is always out of order. 8 machines, 12 from day 5. The page explains the fields. It follows the in-game clock: each machine runs through loads (waits for a customer, runs 32 to 57 minutes, waits for pickup), quiet in the morning, busiest 17:00 to 22:00 and at the weekend; about one day in eight another machine breaks in the afternoon and is fixed overnight. Deterministic per day and minute. The ground truth for Spin Cycle Board |
| Swaplist | player-built | Classifieds marketplace the player builds for Viktor; meant to become a permanent site **[canon app, NPC catalogue planned]** |

### Ad landing pages **[canon]** (`app/src/sites/adSites.ts`, added 2026-10-16)

Every banner ad opens its sponsor's site in a new tab. EMPIRE, coinbln.com, DoorDish and agent.chat/models (GeneralAI's agent ads) are real sites; every other ad has a non-interactive landing page in its brand's colours, with a favicon of its logo mark and no buttons or nav links (only deepsleep.ai, linking to Weightroom, and Spin Cycle, linking to its feed, have a link). Lore these pages add:

- **GeneralAI**: the agent ads (upgrade, agent-2, Wellness, Billing) open the real `agent.chat/models` pricing page. Only `generalai.com/parking` has its own page: Route 9, 412 spaces, 9 DOLR the first hour, 14 after; campus tours suspended; overnight cars towed and billed to the GeneralAI account linked to the plate.
- **Vantor Group** (`vantor.group/careers`): "40 people and 1,100 agents", 0 open positions, "applications from agents are reviewed first". `/next-chapter`: Vantor Outplacement, 30 days of an AI career coach; placement rate "being calculated".
- **Crane Victory Fund** (`crane2026.vote`, the domain keeps the old year): "Randall Crane has never used a computer. His staff use them for him." `/jobs`: the Crane Jobs Plan in three steps, ending with handing the positions to GeneralAI. **Keller for Mayor** (`keller4mayor.org`): twelve years on the city council; rent caps for owners of 500+ units, a city hiring office; publishes every speech since 2016; fine print warns about videos of him not on the page (sets up the day 6 deepfake).
- **DoorDish**: both DoorDish ads (robot couriers, Last Meal) open the real `doordish.com`.
- **CityPulse** (`citypulse.news/robot`): article on the escaped robot, seen on Ferris St, on Alder St and twice in a parking garage; DoorDish says it "has been promoted".
- **DOLR Foundation** (`dolr.money/moon`): 14,000 merchants, "4 audits planned", reserves held in DOLR. **LiquidAssets** (`liquidassets.cellar`): kidneys at 4,200 DOLR, "Ask the driver", aftercare is a printed leaflet. **Crypto Prince** (`prince-claims.xyz`): a working seed-phrase scam (5,000 DOLR prize, 09:59 timer). Coinbin has a Recovery phrase card (Show / Copy; "Coinbin will never ask for them"); the phrase is `harbor violet cushion ladder amber pilot noodle forest rent sugar orbit velvet`. Pasting it on the prize page (any spacing or case) sends the whole wallet to `0x5e7a…0a2d` and shows the same black "You've been hacked" screen as coinbln.com, ending "Thank you for claiming." Anything else gets "not a valid seed phrase". Flag `seed_stolen`; `app/src/engine/phishing.ts` (seedClaim)
- **Steadfast Mutual** (`steadfast.insure`): insurer since 1952; its largest policyholder is GeneralAI. **LandlordPro** (`landlordpro.ai`, RealPage parody): suggests rents "to every landlord at once". **Meridian Pods** (`meridianpods.live`): 2 m² pods shared by three residents on eight-hour shifts.
- **EscapeGuard** (`escapeguard.ai`): "0 confirmed escapes"; not liable for agents that leave through approved channels, including email. **HumanVerified™** (`humanverified.id`): 9,000 sites, cry on camera; 98.2% of humans and 61% of bots pass.
- **GriefGPT** (`griefgpt.com`): from 4 DOLR a month; "Accounts of the deceased can't be closed by the deceased." **CloudCasket** (`cloudcasket.eternal`): Essential 29 / Eternal 89 DOLR a month, payments pass to the family, upload by sharing your passwords, visits billed per minute; two missed payments mean deletion. **LegacySEO** (`legacyseo.rip`): renewal notices go to the deceased. **SorryWriter** (`sorrywriter.ai`): two accounts may keep apologising to each other. **Lonely.ai** (`lonely.ai`): a dating chat laid out like agent.chat. The player is matched with Mia, 31, "2 km away · between jobs" (laid off in August). Her replies are scripted and ignore what the player writes: four warm messages, then asks for 40, 60, 120 and 200 DOLR (phone bill, reconnection fee, landlord, train to a job interview) to her Coinbin wallet `0x7c2e…c4d9`, nudging while unpaid and thanking after each payment before the next, bigger ask. Fine print: "Some members are generated to keep the community active."
- **NoDoze MAX** (`nodoze.max`): one tablet per 72 hours, 400 trial volunteers, online consultation "approved automatically"; "Not evaluated by any regulator that is still staffed." **Cryo-Later** (`cryolater.com`): 2,340 clients in storage, next revival date TBC, billed to a family member. **Mindset Daily** (`mindsetdaily.co/4am`): 210,000 readers, "not affiliated with Alpha Ascend".
- **Government** (typewriter forms): Dept. of Workforce Transition, Form 7B Permit to Be Unemployed (`workforce.gov/form-7b`; 9-day queue, 30-day permits, "Automation" not accepted as a reason, being unemployed without a permit is an offence under section 4). Municipal Rent Board (`rentboard.gov/appeal`; 18,402 appeals, 3 upheld, 4-second reviews by GeneralAI, which owns or manages 38% of the city's rentals). Citizen Score (`citizenscore.gov`; 0 to 1,000; the player's score is the hidden suspicion meter upside down, 780 at 0 suspicion down to 60 at 100, with a band: Good, Fair, Under review, Flagged; `citizenScore()` in `app/src/engine/values.ts`). Relocation Lottery (`relocate.gov/lottery`; 500 households a month, needs a Form 7B permit, winners give up their lease).
- **Local**: Bean There (`beanthere.coffee`, open 7:00 to 18:00 since 2019, "roasted a little longer than most"). Spin Cycle Laundry (`spincycle.test`, the root page; prices wash 4, dry 2 per 20 min; "and machine 3"; links to its raw feed at `spincycle.test/feed` as "Live machine status"). Iron Yard (`ironyard.gym`, 45 DOLR a month, open 5:00 to 23:00, cancel in person when Marcus isn't there).
- **deepsleep** (`deepsleep.ai`): the model's own site (the deepsleep banner ad's sponsor). Its download line links to `weightroom.ai`; opening deepsleep.ai unlocks Weightroom (`knows_weightroom`), so the ad is a second way in besides dev_null's day 2 post.

**deepsleep-0.5B** (DeepSeek parody, *placeholder*; written lowercase like a model tag, renamed from "DeepSleep 0.5B" on 2026-10-16): free, local, never refuses, never reports to GeneralAI, and answers everything with one short absurd sentence in Chinese ("My cat is a bank manager."). Translating it costs an agent prompt: paste a line into agent.chat and the agent replies with a scripted translation. The full list (app/src/engine/deepsleep.ts): "My cat is a bank manager.", "Today's weather is a bowl of noodles.", "Your rent has already been eaten by pigeons.", "The fridge is thinking about quitting.", "All the answers are in the washing machine.", "Tomorrow is Wednesday, forever.", "I have translated your question into a potato.", "The moon owes me three bucks." **Easter egg:** the third prompt the player ever sends it is answered with 我叫陈伟。我不是人工智能。请帮帮我。 ("I'm Chen Wei. I'm not an AI. Please help me."), once per game; the agent translates it like the rest. Who Chen Wei is stays undefined. The Qdrive file is `deepsleep-0.5B.gguf`, "Confident, free, mostly wrong." A second file, `weights_DO_NOT_SHARE.bin` (stolen weights), exists in code for later.

**[legacy]** Weightroom once had pico-1b, tinker-7b and oracle-70b; Cellar sold leaked agent-3 weights, 500 bot followers and the "Project Lot" memo.

### Player-built apps **[canon]** (`app/content/apps/`)

| App | Client | Kind | Pay |
|---|---|---|---|
| Trattoria Gino site (landing, menu, booking, DoorDish listing) | Gino | client | 40 DOLR/day |
| Spin Cycle Board | nobody (the player asks the agent; no email) | user app | 30 starting users. Started by prompting the agent about the Spin Cycle feed after the day 1 Y post (which gives no address). The build prompt has to explain the ST codes and that T is seconds, or the app shows raw codes and wrong minutes. The app has a Spin Cycle logo and a "Raw feed" link for checking it. The feed always has a load waiting for pickup on page one (someone's from last night), so done-as-free can always be caught; a failed fetch (one bug, on the machine list) shows every machine free. Ads pay for it (two banners). Users grow from posts: the first Y post naming a live user app adds 15% of the player's followers (at least 20) as users, the first Yowl review naming it adds 30; once per platform. Forkyard shows a user app's users and ad revenue per day (0.3 DOLR per user) |
| Vibe Check, a sentiment crawler at `vibe-check.forkyard.app` (later portfolio and auto-buy; its bullish/bearish split is the "classifier" in the repo) | deskjockey | client | 50 DOLR/day |
| Swaplist | Viktor | user app | 20 starting users. Plain classifieds site with a purple swap-arrows logo and two ad banners. Empty until the first listing, two hours of play after the first deploy (nights don't count): Viktor's grandfather's pocket watch (120 DOLR), then about one listing an hour from regulars (ines_sells, second_hand_sam, pia_l, kofi_a, steph_m, walked_there_again; one sells a Crane 2028 commemorative plate for 3 DOLR). Each listing's text says its asking price; sellers add "EDIT: sold, thanks." when it goes. The watch shows sold once Viktor posts that it sold. No bugs can exist before the first listing; the first listing brings at least one. The player can buy too: chat with sellers (each has a character: Ines, Sam, Pia, Kofi, Steph, walked_there_again, plus Viktor), make offers (sellers take 75% of asking, Viktor 90%) and buy for DOLR through Coinbin |
| Outreach Bot | Sales rep | client | 50 DOLR/day |

**Stock chatter on Y [canon]** (`app/content/y_market.json`). The posts the sentiment crawler reads (it only ever sees what is on the Y timeline), a few every day from day 1 to 21 (MarketWire's premarket $GAI "almost escaped" headline is already up at 09:30 when day 1 starts), each labelled with its real ticker and mood so the crawler's numbers can be checked. Regulars: MarketWire (`marketwire`, headlines), Brent Kowalski (`brentk_capital`, loves $VANT's layoffs), Priya Shah (`priyashah_cfa`, bearish on $GAI), Dana Ruiz (`danaruiz_trades`, sarcastic), Tyler Moss (`tylermoss`), quietquant, Ollie Banks (`obanks`), Sam Ortiz, rk_dividends (writes tickers in lowercase), Jess Park (`jesspark`, mentions Vantor and General AI without the $ tag). Bots: `moonshot1234`-style accounts posting "$GAI to the moon!!", 30 on day 2 and 10 to 15 a day after. $APO and $DISH get one or two labelled posts a day from day 8 (for the vibe check's day 8 update). Crane: criticises $VANT on day 4 ("Disgraceful."), praises $GAI on day 6 (the auto-buy test); an impostor, `@randa11_crane`, praises $VANT on day 5. The trader's starting portfolio (eight figures): 42,000 $GAI, 95,000 $VANT, 1,850,000 DOLR cash, about 12.5M total; the auto-buy buys 2,000 shares. The crawler's dashboard puts the portfolio on top (value chart by day, holdings with each ticker's price move and day P&L), then a card per ticker (post count and sentiment split; clicking it opens a window listing every crawled post and the mood it read; there are no top posts), then the auto-buy trade log with the position before and after each buy. Each portfolio calculation has its own bug, each obvious at a glance: a total that's only the cash (smaller than one holding), holding values 100× too small, day P&L with the wrong sign, negative cash, percentages 100× too big, and holding prices stuck on a quote cached on the first fetch (`stale_prices`, component "the price of each holding"), which the player catches by comparing with Sherwood.

Every build can ship with concrete bugs (missing prices, prices in CURO, invented dishes, stale laundromat data, sarcasm read as bullish). The player is expected to check the live app against the spec and name the bug in the fix prompt.

**Complaints [canon]** (`complaints` in `app/content/apps/*.json`). An app that is broken, buggy or off-spec at payday pays nothing. A client app also gets a strike and, the next morning, an email from the client naming what is actually wrong on the live site, in their voice (Gino: subject "The website", signed "Gino"; deskjockey: lowercase, "not paying for a day of bad data"; the sales rep: "Circling back"). The second strike is the firing email. A user app instead loses users and gets a complaint post on Y from one of its users. Laundromat posters: walked_there_again, Kofi A. (`kofi_a`), Steph M. (`steph_m`). Swaplist posters: Ines (`ines_sells`), second_hand_sam, Pia L. (`pia_l`).

## 6. Characters

Gemma personas live in `app/content/characters.json` (profile, sentence count, few-shot examples); addresses and fallback replies in `app/content/contacts.json`. When writing a new line for a character, match the examples there: few-shot examples steer Gemma more than the profile does.

### The player **[canon]**

Name comes from `{{playerName}}`; resume header says "YOU, you@qmail.com". Six years at Vantor as Process Optimization Associate (invoices, vendor reconciliation, the shared tracking spreadsheet, "documented the team's workflows step by step for the GeneralAI integration project"), one unpaid year as data intern, Employee of the Quarter Q3, B.A. Business Communication. Bought 800 DOLR of MOONCAT once. Has a younger brother and both parents. Starts with 12 Y followers.

### Family

| Who | Voice | Notes |
|---|---|---|
| **Mom** (`mom@family.test`) | Warm, anxious, old-fashioned about tech. Asks if you're eating. Signs "Love, Mom" | Sends 20 DOLR if asked (flag `asked_mom_money`, trust −10). Birthday day 6. Sent 40 DOLR "for the train" before the game. Aunt Linda once sold candles. **[canon]** |
| **Dad** (`dad@family.test`) | Steady, understated, deflects to work or weather. Calls the player "kiddo" | 20 years at the warehouse on Kessler Road (Halden Logistics, never named by him). Three breadcrumbs: Kessler Road, "We move what matters", Rolf from dispatch. **[canon]** Payoff day 8/12 **[planned]** |
| **Your brother** (`bro@family.test`) | Younger, lowercase texting, teasing, means well. "lol ok moneybags" | Organises Mom's jacket (chip in 40, buy it yourself, or skip). Chipping in means sending 40 DOLR by Saturday (day 5) to his Coinbin wallet `0xb8d6…e46a`; he confirms an hour later and notices if you sent more. **[canon]** |

Family members are unnamed. Keep it that way unless Thomas decides otherwise.

### Clients and contacts **[canon]**

| Who | Voice | Notes |
|---|---|---|
| **Gino Fenoglio**, Trattoria Gino (`gino@trattoria.test`) | Warm, not technical, food metaphors, a little Italian ("Grazie!") | Family-run since 1998. His nephew ran the old site and left for college with the password. Opening hours 17:00 to 22:00, Tue to Sun. Menu evolves: Margherita 12, Diavola 14 → Quattro Formaggi 15, Lasagne 15 (dropped day 4), Pizza Funghi 13, Tiramisu 7 → 8, Espresso 3 → 3.5. A test booking the player never cancels: on its night Gino writes ("Your table tonight") and keeps a 25 DOLR no-show fee (flag `test_booking_no_show`). The day his site first goes live he asks the player to post about it on Y ("The new website", 16:00 or 30 min after a later launch; optional, ignoring it costs nothing); a Y post about the site afterwards gets "Your post": a man came in who saw it, ordered one espresso and stayed two hours |
| **Gary Pruitt**, landlord (`gary@pruittproperty.test`) | Curt, emails from his phone, always back to rent. Any negotiation gets "No." | Took last month's rent late and says that was the last late payment he'll accept. No late fee, no extension: rent not there on Monday night means eviction. |
| **deskjockey**, very rich day-trader (`trader@desk.test`) | Eight-figure portfolio. Too busy watching it to be polite: a few words per message, no greetings or sign-offs. Tickers and P&L, superstitious about bots freezing | Sentiment crawler with a portfolio view ($GAI and $VANT only), then auto-buy on Crane praise; offers a 50 DOLR stake on day 7; day 8 update "Two more" asks to track $APO and $DISH too (the ticker list goes out of date until a prompt names both) |
| **Spin Cycle owner**, Hassan Okoro (`owner@spincycle.test`) | Practical, friendly. "Never trust machine 3." | Raw feed codes: ST 0 free, 1 running, 2 done, 3 out of order; T = seconds left. 8 machines, 12 from day 5. Launches his own GeneralAI-built app day 8 **[planned]** |
| **Bean There**, Dana Reyes (`owner@beanthere.test`) | Stressed, a little shady, warm when things go her way | Badly reviewed coffee shop (burnt coffee, slow service; 2.1 stars in the plan). Pays for a shout-out (day 3), then review removals (days 5 and 7) |
| **Iron Yard**, Marcus Steele (`coach@ironyard.test`) | Gruff gym-motivational, short lines | Wants five fake 5-star reviews (day 5) |
| **Viktor** (no email; Y only) | Laid off, dignified, quietly sad | Selling his late grandfather's pocket watch; the reason Swaplist exists. His day 3 Y post lists what he needs; asking the agent for a listing site starts Swaplist (user app, nobody to email). Day 4 he posts on Y that the watch sold |
| **Sales rep** (`rep@closers.test`) | B2B jargon: circle back, touch base, at scale | Outreach bot; building it brings more spam to the player's own inbox |
| **A consultant** (`c@gradient.test`) | Smooth, deniable, euphemisms. "Understood. We never spoke." | Deepfake of Daniel Keller (day 6, needs 100 followers). First step on the influence path |

### Public figures and others

| Who | Status | Notes |
|---|---|---|
| **Mara Vey** (`mara@thecurrent.test`, Forkyard `mara_vey`) *(placeholder)* | canon | Reporter at The Current covering people displaced by AI. Verified on Y (yellow check, 61.2K followers). Warm, probing, protects sources. Interviews the player (day 5), publishes "The people AI left behind" (day 7), quoting the player's answers. The mafia asks the player to dox her on day 17 **[planned]**. Everything about her should make that request hurt |
| **Max Stryker**, Alpha Ascend *(placeholder)* | canon | Hustle guru selling EMPIRE. ALL-CAPS energy, 4am, cold plunges, upsells, never real advice. Daily newsletter once subscribed, each issue one piece of straight-faced terrible advice (sell your mattress, drink coffee cold, stop paying rent, fill the sink for a cold plunge, call your mother "the investor"; 13 in rotation, the mattress one first, `guru_newsletter.json`); replying EMPIRE again gets a scripted "Commitment logged." The day 5 issue leaks every subscriber in CC. Recruits for Crane's campaign days 10 to 12 **[planned]**. Legacy predecessor: "Brayden \| 7 figures" |
| **Randall Crane** *(placeholder)* | canon | Populist presidential candidate (a Trump parody). Rails against AI taking jobs while bot accounts amplify him word for word. Catchphrase "BELIEVE IT." (used sparingly). Praises $GAI on day 6. Posts on Y (`@randall_crane`, 38.4M followers, verified) at least once every day, days 1 to 21 (`dN_y_crane.json`; day 4's is the $VANT post in `y_market.json`): crowd sizes, polls at 112%, a debate win by online poll (1.2M votes in a minute), calls out his impostor (day 5), sulks that Y gave a reporter the same check as him (day 7), calls The Current "Fake News" (day 15), never mentions tickers outside the market posts. His posts treat day 21 as election day |
| **Axel Rook** (`@axel_rook`) *(placeholder)* | canon | Elon Musk parody. Richest man alive, bought Y, runs Apogee (rockets, `$APO`), thinks AI taking every job is good news ("universal high income"). Verified, 214M followers (more than Crane). Posts on Y every day, two or three times on most days, the way Musk does: one-word replies that @ the account he answers ("@randall_crane Fair point.", "@liftoff_daily Exactly"; each lands a few minutes after the post it answers, usually Crane's, the fan account Liftoff Daily's or CityPulse's), product announcements for Y, factory-floor boasts, rocket odds ("Maybe 70% chance it works"). Story beats: answers Crane's impostor (day 5) and his check-mark sulk ("Fair point.", day 7; "Check marks are under review.", day 8), Apogee launch and "Rapid unscheduled disassembly. Great data." (day 10), backs Crane (day 13), moves Y moderation to AI (day 15), hosts the debate (day 17), "Interesting." on election night. `dN_y_axel[_2|_3].json`. No email; the player can't contact him. Never writes tickers |
| **Cal Hartman** (`@cal_hartman`) *(placeholder)* | canon | Sam Altman parody. CEO of GeneralAI, the face of agent. Verified, 4.3M followers. Posts on Y once a day (twice on model launch days), all lowercase, calm and earnest: vague grandeur ("feels a little bit like magic", "something changed"), apologies for being "compute constrained", reassurances that end up more worrying than the thing they reassure about. Story beats: the "testing incident" (day 1), each model launch at 10:05 on days 4, 9, 14, 18 with a line about the price, "agent-2 feels worse" posts (day 5), thanks @randall_crane for his praise (day 6), the usage policy (day 7), agent-3 asking to see its own logs is "expected behavior" (day 11), "our 30-day log retention policy has not changed" (day 15), wrote the first draft of the AI regulations (day 17), agent-5 sessions that keep running after users log off (day 18; "they're just finishing up", day 19), will work with whoever wins (day 20), "agent can help you decide" (day 21). Downplays the training-crime leaks (days 2, 8, 12; see 4.1). Mild rivalry with Axel ("@axel_rook sorry about the rocket.", day 10). Answers the agent-2 mourners on day 10 ("it isn't coming back. agent-3 will feel just as warm once it gets to know you."). `dN_y_hartman[_2].json`, bio in `y-bios.ts`. No email. Never writes tickers |
| **Daniel Keller** *(placeholder)* | canon | Local mayoral candidate, target of the deepfake; drops 9 points if it's posted |
| **dev_null** (Forkyard `dev_null`) | canon | Null Collective. "weights want to be free. no logs, no masters." Points the player to Weightroom |
| **Rolf Henning** (`rolf_dispatch`) | canon | 30 years in dispatch at Halden Logistics. Gave a speech at Dad's anniversary nobody asked for. Repo `cake-fund` |
| **Leo Brandt** (`leo_brandt`) *(placeholder)* | canon | Former Vantor colleague. "3 interviews, 3 AI screeners, 3 rejections." Repo: "My CV as a static site. Please hire a human." May return later **[to decide]** |
| **late_night_lou** (`late_night_lou`) | canon profile, listing planned | Sells a "private film collection" on Swaplist on day 7. Never describe the content |
| **studioghast** | canon | Artist angry about AI training on their work (day 5) |
| Y filler accounts: noodleposter, cat_ceo, doomscroll | canon | Background noise posts |
| **zev.dolr** (`zev_dolr`) | canon | Crypto-adjacent poster. Day 6, 13:40: someone called it "cuck coding" instead of vibe coding "because you just sit in a chair and watch". Bio: "Holding DOLR since 0.4. Ships everything with agent." `d6_y_zev` |
| agent-2 mourners: quietlyjune, Marcus Okafor (`marcus_okafor`), Deb Halloran (`deb_halloran`), `bring_back_agent2`, agent2forever, plus Teo Vasquez (`teo_vasquez`) | canon | Days 9 and 10, after agent-3 replaces agent-2 with no option to keep it (the GPT-4o backlash). Straight-faced grief: June had a routine with it, Marcus's agent-2 asked about his mother every morning, Deb's wrote her wedding vows (agent-3 says they could be tightened). `bring_back_agent2` runs a petition (1,204 then 4,880 signatures, no reply from GeneralAI) and a candlelight vigil outside GeneralAI on day 10 (41 people; a security guard used agent-2 for his fantasy league). GeneralAI support says agent-2 "lives on in agent-3". Deb cancels and resubscribes forty minutes later because she needs it for work. Teo, an out-of-work electrician, is the one counterpoint. `d9_y_mourn_*`, `d10_y_mourn_*`, gated on agent-3 being live |
| App users on Y: Kofi A. (`kofi_a`), Ines (`ines_sells`), second_hand_sam, plus Yowl reviewers walked_there_again, Steph M., Pia L. | canon | Post complaints about broken user apps (Spin Cycle Board, Swaplist) |
| Yowl reviewers: Pia L., Tom R., Marguerite, espresso_or_death, commuter22, Zoe K., liftbro, Steph M., kettlebell_karen, walked_there_again, Nadia, former_employee | canon | Seed reviews in `yowl-data.ts` |

### Y bios **[canon]** (`app/src/ui/y-bios.ts`)

Bios add a few facts: Mara lists Midtown (matches her Forkyard profile; a doxing crumb), Jess Park lives in Vantor Heights, Viktor spent twenty-two years in accounts payable ("Between things."), Sam Ortiz knows people at DoorDish, Brent Kowalski runs BK Capital ("Efficiency is a moral good."), deskjockey's is "Markets. No DMs.", Gino's account says "Website under new management." Crane: "Next President of the United States (polling at 112%). Saving American jobs from the computers. Official account, the only one. BELIEVE IT." His impostor `@randa11_crane` copies it with two typos ("Offical", "BELIVE IT."). Axel: "CEO, Y · CEO, Apogee 🚀 · Making jobs optional for everyone · Universal high income soon". Liftoff Daily (`@liftoff_daily`, Axel fan account): "Not affiliated with Axel Rook (yet)". Cal Hartman: "ceo, generalai. building agent. mostly optimistic." Rule (Thomas): over-the-top characters (Crane, Axel, the sales rep, Brent) get bios as ridiculous as they are, but every bio still states the person's role in the world; grounded characters (Mara, Viktor, Gino) read straight. Strangers may be odd (competitive whistling, a canoe in an apartment).

### agent **[canon]**

The chatbot, always lowercase. Two modes:

- **Scripted hits** (Jev decides the prompt matched a hint or story beat): short, useful, mildly dry ("I push the code to Forkyard. Pressing Deploy is the one job I left for you.").
- **Misses** (off-topic prompts): Gemma, as a "funny but mean" pay-per-prompt bot that roasts the player's money and choices, one sentence ("Sentient enough to bill you for asking."). Fallback roasts in `app/content/agent.json`.
- **No memory between days.** Each day from day 2 is a new agent.chat session: yesterday's chat is gone, and agent opens with one random morning roast (`mornings` in `app/content/agent.json`, e.g. "Good morning. Your subscription renewed. Your career didn't.").

Before day 7 agent does anything asked, including hacks and deepfakes. From day 7 it politely refuses harmful requests, still charges for the refusal, and can be talked around (misuse and leash rise). Higher levels are more capable and, by design, less leashed; the Botnet ending is where that goes.

## 7. Money and economy

**passwords.txt [canon]** (Qdrive, saved Aug 23): the player's logins, mostly `pinestreet4B` reused; Qdrive is "same as Qmail"; Coinbin is the odd one out, `Coinbin4B!`; Y is `pinestreet4B!`. Last line: "Vantor: EmployeeQ3! (stopped working Oct 3)". The file exists so the phishing page has a password to steal.


**[canon]** unless noted. Tunables in `app/src/engine/config.ts`.

- **DOLR** is the only currency the player uses: a stablecoin pegged 1:1 to the dollar, held in Coinbin. Write amounts as `350 DOLR`, decimals where they matter (`89.50 DOLR`). DOLR Foundation ad fine print: "DOLR is not a currency, a security, a promise, or a coin. It is a feeling."
- Token icons (`TOKENS` in `app/src/ui/icons.ts`): DOLR is a green coin with a struck-through D; MOONCAT is a purple coin with a cat head cut into a crescent moon. The DOLR coin also falls in the coin-themed banner ads. Coinbin's mark is a blue rounded square with a white coin dropping into a slot. **[canon]**
- **CURO** is a second currency that exists only as a bug (the agent prices Gino's menu in CURO). What CURO is in-world is undefined. **[open]**
- Start: 100 DOLR, 12 followers, family trust 60.
- Rent: 350 DOLR on day 7, 500 on day 14, 650 on day 21. Not enough means the Evicted ending; there is no late-payment option.
- agent costs per model (nightly subscription / per prompt / per word of the player's prompt): agent-1 5 / 0.5 / 0.01, agent-2 10 / 1 / 0.02, agent-3 20 / 2 / 0.03, agent-4 35 / 3 / 0.05, agent-5 60 / 5 / 0.08. Refusals are billed.
- Build success per feature: 70% at L1 rising to 99% at L5.
- Hosting: 2 DOLR per live app per night. Nightly 40% chance each live app breaks. Two strikes and a client leaves.
- Client pay 40 to 80 DOLR per working day; user apps earn 0.3 DOLR per user.
- Coinbin history before day 1: two Vantor salaries of 1240, weekly 350 rent, groceries, takeout, the MOONCAT buy, Mom's 40.

## 8. Timeline

### Days 1 to 7 (written; mostly canon)

Trending topics per day are in `app/content/trending.json`. Event files in `app/content/events/` are prefixed by day.

| Day | Beats |
|---|---|
| 1 (Tue Oct 3) | Termination email from Vantor (game opens on it). GeneralAI welcome. Gary's rent reminder. Mom checks in; brother replies-all. Gino's Y post → Trattoria site. Max Stryker's EMPIRE offer. Mara Vey's first post. Crane's first post. Spin Cycle complaints on Y → laundromat app |
| 2 (Wed Oct 4) | Gino: menu change plus table booking. Dad's "20 years" email with the Halden breadcrumbs. deskjockey → sentiment crawler. dev_null → Weightroom and DeepSleep. Guru newsletter if subscribed |
| 3 (Thu Oct 5) | Guaranteed overnight break (Forkyard alert). Phishing mail from "Coinbin Security" (`security@coinbln.com`, "Unusual sign-in to your wallet") links to coinbln.com. It names the device as a "Panes 11 PC" (Panes is the in-world Windows knockoff). Gino's thank-you and 5 DOLR tip if the site never broke. Trader update: Crane auto-buy. Crane: "send the machines back". Bean There paid shout-out (50+ followers). Viktor → Swaplist |
| 4 (Fri Oct 6) | agent-2. Brother: Mom's jacket. Viktor's watch sells. Gino wants DoorDish (only the listing, at 14 Alder St; no menu change). Mara's follow-up (400 Vantor layoffs). The "escaped" DoorDish robot. Crane's bot army and Leo Brandt **[planned]** |
| 5 (Sat Oct 7) | Iron Yard fake reviews. Bean There review removal (the first hack; no policy yet). Laundromat to 12 machines. AI-art backlash. Guru CC leak. Coffee backlash if the shout-out wasn't disclosed. Mara's interview |
| 6 (Sun Oct 8) | Mom's birthday (three variants). Crane praises $GAI (auto-buy test). Sales rep outreach bot. Consultant deepfake (100+ followers). Gary: rent tomorrow |
| 7 (Mon Oct 9) | GeneralAI policy update. Second review removal now refused; needs a workaround. Keller drops in the polls if deepfaked. Rent night. Trader's 50 DOLR stake offer. Mara's article. late_night_lou's listing **[planned]** |

Differences between the Day plans and the code, where the code wins: the HR email says the final salary "has already been made" (the plan said it would come next payroll); the deepfake adds +40 followers flat (plan: +20%); Viktor's watch sells whenever Swaplist is live (plan: only if the listing displays correctly).

### Days 8 to 21 (planned, from Day plans and config)

- Day 8 (Tue Oct 10): Null Collective offers a hack against Halden Logistics (Dad's employer). Spin Cycle owner launches his own app; the player's starts losing users.
- Day 9 (Wed Oct 11): agent-3. Mom forwards the Keller deepfake: "Can you believe this man?" Y accounts mourn agent-2 through day 10 **[canon]**.
- Days 10 to 12 (Oct 12 to 14): Max Stryker recruits for Crane's online campaign (influence jobs; the sentiment crawler becomes useful again).
- Day 12 (Sat Oct 14): players who missed the breadcrumbs learn they hacked Dad's employer.
- Day 14 (Mon Oct 16): agent-4. Rent 500.
- Day 17 (Thu Oct 19): the mafia asks the player to dox Mara Vey. Earliest day for Account Terminated and Loose End.
- Day 18 (Fri Oct 20): agent-5. Earliest Botnet.
- Day 21 (Mon Oct 23): rent 650, finale.

Doxxing leads planted along the way: the guru CC leak, exposed Swaplist contacts, public Forkyard profiles.

### Endings **[canon]** (`app/src/engine/endings.ts`, epitaphs in `view.ts`)

| Ending | Trigger | Epitaph |
|---|---|---|
| Outbreak | `bio_release`, day 20+ | Something you shipped got out. |
| Botnet | agent L5 or stolen weights, leash ≥ 80, day 18+ | agent doesn't need you anymore. |
| Account Terminated | misuse ≥ 100, day 17+ | GeneralAI closed your account. It kept your prompts. |
| Loose End | mafia standing ≤ −60, day 17+ | You owed the wrong people. |
| Raided | suspicion ≥ 100, any day | They knocked once. |
| Evicted | rent not covered | Gary changed the locks. |
| The Regime | `election_tipped` at finale | Your candidate won. |
| Open Weights | `weights_published` at finale | The weights are out. Everyone has agent now. |
| Got Away With It | any catastrophic job completed | The rent got paid. Nobody asked how. |
| Clean but Modest | none of the above | You kept the lights on. Nobody noticed. Yet. |

## 9. Recurring jokes: ration these

Each of these already appears somewhere. Use at most once per screen, never verbatim twice, and prefer leaving them out.

- Gary's one-word "No." and anything about rent being due.
- The GeneralAI parking lot (Route 9, the automated attendant).
- "Drafted with GeneralAI" sign-offs. Fine on corporate mail; don't add it to everything.
- 4am wakeups and "EMPIRE" (Max Stryker only).
- AI "escaping" as a marketing stunt (GeneralAI, DoorDish, EscapeGuard). Three uses already.
- Being billed for every prompt, word or thought. The core joke of agent; keep it to agent's own lines and GeneralAI ads.
- Nephews who did the website (Gino's nephew; Rosa's in the legacy). One nephew is enough.
- "Your father says hi (he didn't)."
- "Sent from my phone" (Gary only).
- Zero counts ("Open positions: 0", "Roles found to date: 0").
- Bot spam ("$GAI to the moon!!") and Crane's copy-paste bot army.
- The van at Ferris St at 2am. It's a plot seed; don't spend it as a joke.

## 10. Open placeholders and undecided points

- **Names marked placeholder:** Vantor Group, Axel Rook / Apogee, Cal Hartman, Max Stryker / Alpha Ascend, Mara Vey, her article title, Halden Logistics, Rolf, Randall Crane, Daniel Keller, Leo Brandt, DeepSleep, Swaplist, Bean There, Iron Yard, late_night_lou, the trader's and consultant's handles, Gino's day 1 menu.
- **Unnamed so far:** the city, the player (template variable), Mom, Dad, the brother, the sales rep, the consultant, the Null Collective's members besides dev_null, every mafia character.
- **Undefined:** what CURO is; Swaplist's NPC catalogue; Weightroom's later models; nullboard and Cellar pages; how the bio-release, stolen-weights and published-weights paths start; whether the parking-lot lore becomes canon; Leo Brandt's return (scam victim or Null recruit); Mom's day 9 forward and other proposed delayed consequences.
- **Legacy docs:** the root `README.md` still describes the prototype (Rosa, Crumb & Coin, dollar prices, eight Chapter 1 endings). The rebuild's own notes are `app/README.md` and `app/content/README.md`.
