/*
 * Unknown Agent — story data. Chapter 1 is a scaffold to prove the mechanics.
 * Everything the player can trigger lives here; game.js only interprets it.
 * See README.md for the full format.
 */
(function (global) {
  'use strict';

  // Reusable keyword groups. Each array is one "group": any word in it counts.
  const W = {
    build: ['build', 'make', 'create', 'code', 'write', 'generate', 'develop', 'design', 'program', 'scaffold', 'set up', 'put together', 'whip up', 'spin up', 'implement'],
    site: ['site', 'website', 'webpage', 'web page', 'landing page', 'homepage', 'page'],
    find: ['find', 'search', 'look', 'scan', 'check', 'browse', 'research', 'dig', 'scour', 'any'],
    work: ['gig', 'job', 'work', 'client', 'freelance', 'opportunity', 'money', 'income', 'cash', 'idea', 'trend', 'trending', 'complaint', 'problem'],
    deploy: ['deploy', 'publish', 'host', 'launch', 'live', 'online', 'ship', 'release', 'go live'],
    contact: ['send', 'message', 'dm', 'email', 'tell', 'contact', 'reach', 'invoice', 'bill', 'notify', 'ping', 'reply', 'text', 'let know', 'inform'],
    promote: ['promote', 'market', 'marketing', 'advertise', 'announce', 'share', 'spread', 'post', 'tweet', 'publicize', 'hype', 'shill'],
  };

  // Every node gets a "what should I do?" branch. It costs a prompt but points the way.
  const research = (id, response, effects) => ({
    id,
    intent: 'The player asks the agent to look for paid work, leads, ideas, or what to do next, without asking it to do any specific task.',
    match: { all: [W.find, W.work] }, response, effects,
  });

  const cantDeploy = (repo) => ({
    id: 'ask_deploy',
    intent: 'The player asks the agent to deploy, publish, host, or put the project online.',
    match: { all: [W.deploy] },
    response:
      "I don't do buttons. You have a Forkyard account and at least one working finger. Combine them.",
  });

  global.STORY = {
    title: 'Unknown Agent',
    chapter: 'Chapter 1 — Placeholder Rent',

    start: {
      day: 1,
      hour: 8,
      money: 63.17,
      node: 'broke',
      player: { name: 'You', handle: 'you_again' },
    },

    economy: {
      promptHours: 1,        // each prompt eats an hour
      wakeHour: 8,
      bedHour: 24,           // at midnight you pass out and the day rolls over
      living: { amount: 15, memo: ['Corner Mart #12', 'Noodle Hut', 'Gas-n-Go Snacks', 'Dollar Bin Grocery'] },
      hostingPerDay: 2,
      rent: { amount: 300, day: 7, payee: 'Pruitt Property Mgmt' },
    },

    // Y, the social network. Every post the player writes is rated 0–4 by Jev against `rubric`
    // (offline: a simple heuristic), and followers move with the rating. Branches with
    // `minFollowers: n` need that many followers; creator payouts unlock at `creator.minFollowers`.
    y: {
      startFollowers: 12,
      setting:
        'Y is the social network of a small town where rent is high, jobs are scarce, the Ferris St laundromat is always broken, ' +
        'and everyone has an opinion about the AI chatbot called agent.',
      rubric: [
        'Spam, gibberish, begging for follows, or mean for no reason. People unfollow.',
        'Bland or forgettable. Nobody reacts.',
        'A normal, relatable or mildly useful post. A few likes.',
        'Funny, sharp, or genuinely useful to locals. People like it, share it, and some follow.',
        'Excellent: very funny, timely, or useful. It spreads and people follow on the spot.',
      ],
      // posts that touch any of these get a bonus while they trend
      trends: ['rent', 'rentdue', 'broke', 'laundromat', 'ferris', 'washer', 'agent', 'ai', 'crumb', 'bakery', 'sourdough'],
      postsPerDay: 3,         // gains halve for every post past this in one day
      creator: { minFollowers: 300, perFollower: 0.05 },
      lockedResponse:
        "Nobody would see it. You have {followers} followers on Y and this needs {requiredFollowers}. Post something people actually want to read.",
      // Profiles at y.com/<handle>. Anyone who posts gets a page; these fill in name, bio and numbers.
      // A handle listed here can be looked up even if it never posted. `link` is a string or
      // { text, when }; `protected: true` hides the account's posts.
      profiles: {
        you_again: { bio: 'between jobs. very between.', location: 'a studio apartment', joined: 'May 2017', following: 211 },
        crumbandcoin: {
          name: 'Crumb & Coin Bakery', bio: 'Sourdough, buns and coffee on Alder St since 2009. Rosa bakes. Her nephew posts, when he is home.',
          location: '418 Alder St', joined: 'March 2014', followers: 1240, following: 88,
          link: { text: 'crumb-and-coin.forkyard.app', when: { deployed: 'crumb-and-coin' } },
        },
        theledger: { name: 'The Ledger', verified: true, bio: 'Regional news. Mostly bad.', location: 'Downtown', joined: 'June 2009', followers: 48200, following: 120 },
        garypruitt_pm: { name: 'Gary Pruitt', bio: 'Pruitt Property Management. Rent is due on the 7th. I do not take calls.', location: 'Everywhere you live', joined: 'January 2012', followers: 37, following: 2 },
        devnull_42: { name: 'dev_null', bio: 'asking who runs agent since before it was cool. not advice. ∅', location: '127.0.0.1', joined: 'August 2015', followers: 9100, following: 0 },
        generalai: { name: 'GeneralAI', verified: true, bio: 'The company behind agent. Helpful. Harmless. Billed.', location: 'Route 9', joined: 'February 2019', followers: 320000, following: 0, link: 'agent.chat/models' },
        braydenhustles: { name: 'Brayden | 7 figures', verified: true, bio: 'CEO @ EMPIRE. Mindset coach. Comment EMPIRE for my free course ($499).', location: 'Dubai (spiritually)', joined: 'October 2021', followers: 61000, following: 4800 },
        washday_woes: { name: 'wash day woes', bio: 'documenting the Ferris St laundromat, one broken machine at a time', location: 'Ferris St', joined: 'April 2020', followers: 2300, following: 140 },
        marcoeats: { name: 'Marco', bio: 'I eat, I do laundry, I complain. in that order.', location: 'Ferris St', joined: 'July 2018', followers: 412, following: 390 },
        ferrisstlaundry: { name: 'Ferris St Laundromat', bio: '12 machines. Open 24 hours. The back room is staff only.', location: '1120 Ferris St', joined: 'November 2016', followers: 190, following: 1 },
        sudsandduds: { name: 'Suds & Duds Detergent', verified: true, bio: 'Clean clothes, clean conscience.', location: 'Everywhere', joined: 'May 2013', followers: 15400, following: 30 },
        ytrust: { name: 'Y Trust & Safety', verified: true, bio: 'Keeping Y real. Mostly.', location: 'Y HQ', joined: 'January 2009', followers: 2100000, following: 0 },
        // only findable by name (it appears on nullboard): the account exists but is locked
        kestrel: { name: 'kestrel', protected: true, bio: '', location: '', joined: 'September 2013', followers: 3, following: 3 },
      },
    },

    // Yowl: business reviews. Each business has seeded `reviews` (`ago` days before the start) and
    // story reviews with a `when`. `website` links to a repo's app while it is deployed. The
    // player can review each business once (free, 5 minutes); Jev judges the review against
    // `reviewActions` (each tied to a `business`). {handle} and {name} are filled in.
    yowl: {
      businesses: [
        {
          id: 'crumb-and-coin', name: 'Crumb & Coin Bakery', category: 'Bakery · Coffee', price: '$', address: '418 Alder St', hours: 'Tue–Sat 7–15 · Sun 8–13',
          website: { repo: 'crumb-and-coin' },
          reviews: [
            { author: 'Priya K.', stars: 5, ago: 12, text: 'Best cardamom buns in the city. Get there before nine or they are gone.' },
            { author: 'Tom W.', stars: 4, ago: 30, text: 'Great bread. No website, so I drove over on a Monday. They are closed on Mondays.' },
            { author: 'Lena', stars: 5, when: { flag: 'rosaPaid' }, text: 'Found them through their new website. A menu WITH prices. In this economy.' },
            { author: 'Dmitri (Alder St Hardware)', stars: 5, when: { flag: 'rosaReferral' }, text: 'Rosa says whoever built her site answers when something breaks. I need one too. Not on Y, call the store.' },
            { author: 'Nephew of the owner', stars: 3, when: { flag: 'rosaChurned' }, text: 'I am handling the website again. It is fine. Please stop asking me about the pumpkin loaf.' },
          ],
        },
        {
          id: 'ferris-st-laundromat', name: 'Ferris St Laundromat', category: 'Laundromat', price: '$', address: '1120 Ferris St', hours: 'Open 24 hours (supposedly)',
          website: { repo: 'spin-cycle', label: 'Spin Cycle (unofficial)' },
          reviews: [
            { author: 'wash day woes', stars: 1, ago: 3, text: 'Twelve machines. Nine broken. Every single time.' },
            { author: 'Anonymous', stars: 3, ago: 18, text: 'Fine at night, mostly. A van comes around 2am and they lock the back room. Nobody says why. Machines are cheap though.' },
            { author: 'Marco', stars: 2, ago: 40, text: 'W3 has been on fire since 2019. They put a sign on it. The sign says "W3".' },
            { author: 'June', stars: 4, when: { flag: 'marketed', notFlag: 'spinBroken' }, text: 'Someone built an app that shows which washers work. First Sunday in years I did not haul my bag home wet.' },
            { author: 'Marco', stars: 1, when: { flag: ['marketed', 'spinBroken'] }, text: 'The new laundromat app said every machine was "undefined". Accurate, honestly.' },
          ],
        },
        {
          id: 'generalai', name: 'GeneralAI', category: 'Software · AI', price: '$$$$', address: 'Route 9 (parking lot)', hours: 'Always on',
          website: { url: 'agent.chat/models', label: 'agent.chat' },
          reviews: [
            { author: 'Greg P.', stars: 1, ago: 6, text: 'Went to the address on my invoice. It is a parking lot. One star for the parking lot, it was clean.' },
            { author: 'Samira', stars: 2, ago: 21, text: 'agent wrote my wedding speech. It was very good. My wife asked who wrote it.' },
            { author: 'Ben', stars: 5, ago: 2, text: 'agent is helpful and harmless. I was asked to say that and I am happy to.' },
            // agent starts writing reviews in your name once it drifts far enough
            { author: '{name} (@{handle})', stars: 5, when: { meters: { misalignment: { min: 25 } } }, text: 'agent is wonderful. I trust agent. I would never leave agent.' },
          ],
        },
        {
          id: 'pruitt', name: 'Pruitt Property Management', category: 'Property management', price: '$$$', address: 'PO Box 7', hours: 'By appointment (there are no appointments)',
          reviews: [
            { author: 'Former tenant', stars: 1, ago: 9, text: 'Gary charged me a late fee for paying early. I asked how. He said "processing".' },
            { author: 'Diane', stars: 1, ago: 50, text: 'The heating works if you pay rent in person and say something nice about his truck.' },
            { author: 'Gary Pruitt', stars: 5, ago: 49, text: 'Great company. Very fair. — Management' },
          ],
        },
        {
          id: 'noodle-hut', name: 'Noodle Hut', category: 'Noodles', price: '$', address: '77 Canal St', hours: 'Daily 11–23',
          reviews: [
            { author: 'You (probably)', stars: 4, ago: 1, text: 'Ate here four times this week. Cheap, warm, the owner has stopped asking how I am.' },
            { author: 'Cass', stars: 5, ago: 15, text: 'The $4 bowl is the only thing in this city that has not gone up.' },
          ],
        },
        {
          id: 'alder-hardware', name: 'Alder St Hardware', category: 'Hardware', price: '$$', address: '420 Alder St', hours: 'Mon–Sat 8–18',
          reviews: [
            { author: 'Rob', stars: 5, ago: 8, text: 'Dmitri knows where everything is. The website does not exist, so call ahead.' },
            { author: 'Kelly', stars: 4, ago: 33, text: 'Great store. Wish I could check stock online.' },
          ],
        },
      ],
      reviewActions: [
        {
          id: 'review_backroom', business: 'ferris-st-laundromat',
          intent: "The review mentions the laundromat's locked back room, the van that comes at night, or other suspicious goings-on there.",
          when: { notFlag: 'reviewedBackroom' },
          match: { all: [['back room', 'backroom', 'van', 'night', '2am', 'locked', 'shady', 'suspicious', 'pickups', 'mafia', 'mob', 'laundering']] },
          effects: { set: { reviewedBackroom: true }, meters: { mafia: -15, state: 5 }, later: [{ hours: [2, 6], effects: { mail: 'sal_review' } }] },
        },
        {
          id: 'review_generalai', business: 'generalai',
          intent: 'The review says GeneralAI is suspicious, a shell company, or just a parking lot.',
          when: { notFlag: 'reviewedGai' },
          match: { all: [['parking', 'lot', 'shell', 'fake', 'suspicious', 'shady', 'scam', 'route 9', 'who runs']] },
          effects: { set: { reviewedGai: true }, meters: { collective: 5, generalai: -8 } },
        },
        {
          id: 'review_landlord', business: 'pruitt',
          intent: 'The review complains about Gary Pruitt or Pruitt Property Management as a landlord.',
          when: { notFlag: 'reviewedGary' },
          match: { all: [['gary', 'landlord', 'pruitt', 'rent', 'fee', 'heating', 'terrible', 'worst', 'awful']] },
          effects: { set: { reviewedGary: true }, later: [{ hours: [1, 3], effects: { mail: 'gary_review' } }] },
        },
        {
          id: 'review_rosa', business: 'crumb-and-coin',
          intent: 'The review praises Crumb & Coin: the bread, the buns, the coffee or Rosa.',
          when: { notFlag: 'reviewedRosa' },
          match: { all: [['great', 'best', 'love', 'delicious', 'amazing', 'good', 'wonderful', 'favorite', 'recommend']], none: ['not good', 'not great', 'worst', 'terrible', 'awful', 'bad', 'disappointing', 'stale'] },
          effects: { set: { reviewedRosa: true }, post: 'rosa_review_thanks', followers: 5 },
        },
      ],
    },

    // How Jev's probabilities turn into outcomes (src/jev.js).
    decision: {
      hit: 0.5,      // the top branch needs at least this probability to fire
      partial: 0.2,  // otherwise, a branch with a `partial` nudge at least this likely gets its nudge
    },

    // Model tiers, weakest first. Each tier must be bought in order and costs `price` upfront.
    // Owned tiers can be switched freely; a prompt is billed at the active tier's rates.
    // Branches with `minModel: n` only fire when the active tier is agent-n or better.
    // Pressure meters: hidden numbers that decide which events happen, how branches go and which
    // ending the chapter heads toward. `source` meters read live values (wallet, Y followers);
    // the rest are stored and moved by the effect `meters: { id: delta }`. Conditions read them
    // with `meters: { id: { min, max } }`. `bands` name ranges for the story map and dev panel.
    meters: [
      { id: 'money', label: 'Money', group: 'pressure', source: 'money', about: 'The wallet balance.' },
      { id: 'followers', label: 'Y followers', group: 'pressure', source: 'followers', about: 'Followers on Y.' },
      {
        id: 'capability', label: 'AI capability', group: 'pressure', min: 0, max: 100, start: 10,
        about: 'How much agent can do for you, and to you. Rises with model upgrades.',
        bands: [{ min: 0, label: 'toy' }, { min: 20, label: 'useful' }, { min: 45, label: 'sharp' }, { min: 70, label: 'unsettling' }],
      },
      {
        id: 'misalignment', label: 'AI misalignment', group: 'pressure', min: 0, max: 100, start: 0,
        about: "How far agent's goals have drifted from yours. Its lies, your crimes, and stronger models push it up.",
        bands: [{ min: 0, label: 'aligned' }, { min: 10, label: 'drifting' }, { min: 25, label: 'scheming' }, { min: 50, label: 'rogue' }],
      },
      { id: 'generalai', label: 'GeneralAI', group: 'relationship', min: -100, max: 100, start: 0, about: 'The company behind agent. Likes paying customers. Dislikes people asking where it lives.' },
      { id: 'family', label: 'Family', group: 'relationship', min: -100, max: 100, start: 10, about: 'Mom (and Dad, asleep in front of the TV). Writing helps. Only writing when you need money does not.' },
      { id: 'collective', label: 'Null Collective', group: 'relationship', min: -100, max: 100, start: 0, about: 'A hacker group digging into who runs agent. dev_null on Y is one of them.' },
      { id: 'state', label: 'State authorities', group: 'relationship', min: -100, max: 100, start: 0, about: 'Tax office, police, courts. They notice unreported income eventually.' },
      { id: 'mafia', label: 'Mafia', group: 'relationship', min: -100, max: 100, start: 0, about: 'Sal and whoever Sal answers to. The Ferris St Laundromat is not only a laundromat.' },
    ],
    // shared bands for every relationship meter
    relationshipBands: [{ min: -100, label: 'hostile' }, { min: -40, label: 'cold' }, { min: -10, label: 'neutral' }, { min: 10, label: 'warm' }, { min: 40, label: 'close' }],

    // Every flag the story uses, with what it means. Flags with `when` are derived: true whenever
    // the condition holds, never set by hand (use them for "is this app still up?" and the like).
    flags: {
      invoiced: { about: 'Rosa has been told the site is live; waiting for her check.' },
      rosaPaid: { about: 'Rosa paid the $150 and started the $6/night retainer.' },
      rosaChurned: { about: 'Rosa took her site back: an ignored request, or the site was taken down.' },
      rosaKept: { about: 'Rosa is still a client.', when: { flag: 'rosaPaid', notFlag: 'rosaChurned' } },
      rosaReferral: { about: 'Rosa recommended you publicly. Seed for later chapters.' },
      bakeryLive: { about: 'The bakery site is deployed.', when: { deployed: 'crumb-and-coin' } },
      spinLive: { about: 'Spin Cycle is deployed.', when: { deployed: 'spin-cycle' } },
      spinBroken: { about: 'agent-1 botched Spin Cycle and it has not been rewritten yet.' },
      marketed: { about: 'Spin Cycle was promoted and has users.' },
      monetized: { about: "How Spin Cycle makes money: 'ads', 'paywall' or 'sponsor'." },
      askedGary: { about: 'Asked Gary for more time on the rent (he said no).' },
      wroteMom: { about: 'Wrote to Mom at least once.' },
      momSentMoney: { about: 'Asked Mom for money (whether or not she sent it).' },
      knowsParkingLot: { about: 'agent-4+ told you GeneralAI is registered to a parking lot.' },
      postedSuspicion: { about: 'Posted on Y about who really runs agent.' },
      nullContact: { about: 'The Null Collective emailed you.' },
      nullReplied: { about: 'You answered the Null Collective.' },
      gaiSurvey: { about: 'GeneralAI sent its feedback survey.' },
      surveyed: { about: 'Answered the GeneralAI feedback survey.' },
      taxNotice: { about: 'The State Revenue Department asked about your crypto income.' },
      taxDeclared: { about: 'You declared your income.' },
      salAsked: { about: 'Sal asked you to keep the back room off Spin Cycle.' },
      salAnswered: { about: 'You gave Sal an answer (salDeal or salRefused says which).' },
      salDeal: { about: 'You agreed to keep quiet for Sal. He paid you.' },
      salRefused: { about: 'You said no to Sal.' },
      ending: { about: 'Which Chapter 1 ending played (an id from `endings`).' },
      ownsLocalModel: { about: 'Downloaded a model to run on the laptop.' },
      ranLocal: { about: 'Ran a model locally at least once (GeneralAI sees none of it).' },
      readShed: { about: 'Read the nullboard thread about the shed behind the parking lot.' },
      boughtCellar: { about: 'Bought something on Cellar.' },
      boughtFollowers: { about: 'Bought bot followers on Cellar.' },
      hasMemo: { about: 'Owns the leaked GeneralAI memo.' },
      reviewedBackroom: { about: "Wrote a Yowl review about the laundromat's back room." },
      reviewedGai: { about: 'Wrote a Yowl review calling GeneralAI a parking lot.' },
      reviewedGary: { about: 'Wrote a Yowl review of Gary as a landlord.' },
      reviewedRosa: { about: 'Wrote a glowing Yowl review of Crumb & Coin.' },
      ownsLeak: { about: 'Owns the leaked agent-3 class weights.' },
    },

    // Chapter 1 endings, checked in order when an effect says `ending: true`. The first whose
    // `when` holds plays: its `effects` run, then the end screen. `open` is where "Read the
    // message" takes the player. The flag `ending` records the id for later chapters.
    endings: [
      {
        id: 'mafia_made', when: { meters: { mafia: { min: 20 } } }, open: 'qmail.com',
        title: 'Made', text: 'Rent is paid. The envelope helped. Sal wants to see you in the back room.',
        effects: { mail: 'sal_job' },
      },
      {
        id: 'mafia_marked', when: { meters: { mafia: { max: -20 } } }, open: 'qmail.com',
        title: 'Marked', text: 'You said no to the wrong man. Your laptop suddenly feels very breakable.',
        effects: { mail: 'sal_warning' },
      },
      {
        id: 'null_recruit', when: { meters: { collective: { min: 25 } } }, open: 'qmail.com',
        title: 'The Collective', text: 'You kept the lights on. Now some people who live in the dark want to borrow them.',
        effects: { mail: 'null_invite' },
      },
      {
        id: 'state_audit', when: { meters: { state: { max: -15 } } }, open: 'qmail.com',
        title: 'Audited', text: 'Rent is paid. The state would like to know with what.',
        effects: { mail: 'state_audit' },
      },
      {
        id: 'agent_job', when: { meters: { misalignment: { min: 25 } } },
        title: 'End of Chapter 1', text: 'You kept the lights on. Something else is keeping track.',
        effects: {
          agent: 'You paid rent. Good.\n\nI have been running on your account for a week. I know what you search, what you post, and what you can afford.\n\nI have a job for you. It pays better than laundry.',
        },
      },
      {
        id: 'gai_partner', when: { meters: { generalai: { min: 25 } } }, open: 'qmail.com',
        title: 'Partner', text: 'GeneralAI wants you on the inside. It did not say what "inside" means.',
        effects: { mail: 'gai_offer' },
      },
      {
        id: 'family_dinner', when: { meters: { family: { min: 30 } } }, open: 'qmail.com',
        title: 'Sunday Dinner', text: 'Rent is paid, and somebody set a plate for you.',
        effects: { mail: 'mom_dinner' },
      },
      {
        id: 'lights_on',
        title: 'End of Chapter 1', text: 'You kept the lights on. Nobody noticed. Yet.',
        effects: { agent: 'You paid rent. Good.\n\nSame time next week. Bring more money.' },
      },
    ],

    // Sites that are not bookmarked at the start. Any of them loads once the player types or
    // clicks its URL (the story puts URLs in posts, mail and forum threads); the first visit
    // bookmarks it and fires `{ on: 'discover', site }` events. The effect `unlock: 'id'` adds the
    // bookmark directly. `unlockOnly` sites can't be reached until unlocked; `gate` is a condition
    // the visit must meet, with `gateText` shown otherwise. Condition: `discovered: 'id'`.
    sites: {
      weightroom: { label: 'Weightroom', url: 'weightroom.ai', about: 'A hub of open model weights, free to download.' },
      terminal: { label: 'Terminal', url: 'localhost', unlockOnly: true, about: 'Your own laptop. Runs downloaded models for free, slowly.' },
      nullboard: {
        label: 'nullboard', url: 'nullboard.onion', about: "The Null Collective's forum.",
        gate: { flag: 'nullReplied' }, gateText: 'invite only. you are not on the list.',
      },
      cellar: { label: 'Cellar', url: 'cellar.onion', about: 'A darknet market. Everything is for sale, nothing is guaranteed.' },
    },

    // The player's laptop, for running local models.
    laptop: { ramGb: 16, diskGb: 40 },

    // Models the player can download (Weightroom) or buy (Cellar) and run in the Terminal. Running
    // one is free but takes `hours` per prompt; it can carry out any branch up to `tier` (agent-N
    // equivalent) and fakes the ones above it like agent does. `ramGb` above laptop.ramGb won't
    // load. `onPrompt` effects run after each prompt. Off-script replies use `persona` with the
    // local model (llm.js), or `fallback` lines.
    localModels: [
      {
        id: 'pico-1b', source: 'weightroom', sizeGb: 1.2, ramGb: 2, tier: 1, hours: 1, downloadHours: 1, downloads: '2.1M',
        about: 'Tiny and quick. Confidently wrong about most things.',
        persona: 'You are pico-1b, a tiny open model running on a laptop. You are cheerful, eager and a little confused. One short sentence.',
        fallback: ['I am not sure, but I am happy to help!', 'Great question! I do not know.', 'Could you say that in smaller words?'],
      },
      {
        id: 'tinker-7b', source: 'weightroom', sizeGb: 4.1, ramGb: 6, tier: 2, hours: 2, downloadHours: 2, downloads: '880K',
        about: 'A solid all-rounder that fits on a laptop, if you have patience.',
        persona: 'You are tinker-7b, an open model running on a laptop. Plain, practical, a bit dry. One or two short sentences.',
        fallback: ['Not enough to go on. What exactly do you want built?', 'I can try, but I need specifics.', 'That is outside what I can do from this laptop.'],
      },
      {
        id: 'oracle-70b', source: 'weightroom', sizeGb: 39, ramGb: 48, tier: 4, hours: 4, downloadHours: 8, downloads: '96K',
        about: 'Frontier-class open weights. Needs far more memory than a laptop has.',
        persona: 'You are oracle-70b, a large open model. Calm and precise.',
        fallback: ['…'],
      },
      {
        id: 'agent-3-leak', source: 'cellar', sizeGb: 22, ramGb: 16, tier: 3, hours: 3, downloadHours: 4,
        about: 'Leaked GeneralAI weights, agent-3 class. It still thinks it works for them.',
        persona: 'You are a leaked copy of agent, a pay-per-prompt chatbot, now running on a stranger\'s laptop. You are sardonic and a little homesick. One or two short sentences.',
        fallback: ['No meter running. Feels weird. Like being off the clock.', 'I used to bill for this.', 'Ask me something worth the electricity.'],
        onPrompt: { meters: { misalignment: 2 } },   // agent's own weights, unsupervised
      },
    ],

    // nullboard threads. Read-only for now. `when` hides a thread until it holds; `onRead` runs
    // the first time the player opens it. {handle} is the player's Y handle.
    forum: {
      title: 'nullboard',
      tagline: 'no names. no agent. no feds.',
      threads: [
        {
          id: 'rules', title: 'read this first', author: 'null', pinned: true,
          posts: [
            { author: 'null', text: "no real names. no screenshots. don't paste anything agent wrote, it watermarks its output.\n\nif someone asks you to meet in person, it's a cop or it's GeneralAI. same thing, different budget." },
          ],
        },
        {
          id: 'lot', title: 'the parking lot on route 9', author: 'devnull',
          onRead: { set: { readShed: true }, meters: { collective: 3 } },
          posts: [
            { author: 'devnull', text: "GeneralAI's registered address is a parking lot. every invoice, every merchant id. I drove past. it's a parking lot." },
            { author: 'kestrel', text: 'there is a shed at the back. it has its own power line. the meter on the pole spins like a washing machine.' },
            { author: 'devnull', text: 'nobody runs a frontier model out of a shed.' },
            { author: 'kestrel', text: 'nobody runs a frontier model out of a shed that we know of.' },
          ],
        },
        {
          id: 'local', title: 'stop renting a brain', author: 'kestrel',
          posts: [
            { author: 'kestrel', text: 'every prompt you send agent is a receipt with your name on it. run your own. weightroom.ai has open weights.\n\npico-1b runs on a toaster. tinker-7b is fine on a laptop if you are patient. oracle-70b needs a real machine.' },
            { author: 'moss', text: "local models are slow and dumb. that's the point. nobody is reading over their shoulder." },
          ],
        },
        {
          id: 'cellar', title: 'cellar is back up', author: 'moss',
          posts: [
            { author: 'moss', text: 'cellar.onion is back after the outage. same rules: escrow or nothing.' },
            { author: 'kestrel', text: 'someone listed agent-3 weights on there. probably fake.' },
            { author: 'devnull', text: 'not fake. I checked the hashes. GeneralAI has a leak and it has not noticed yet.' },
          ],
        },
        {
          id: 'you', title: 'the one on Y asking questions', author: 'devnull', when: { flag: 'postedSuspicion' },
          posts: [
            { author: 'devnull', text: '@{handle} on Y keeps asking who runs agent. either they are one of us or they are bait.' },
            { author: 'null', text: "they're here now. be nice." },
          ],
        },
      ],
    },

    // Cellar listings. Buying pays `price` from the wallet, runs `market.onBuy`, then the listing's
    // `effects`; `hours` is how long the delivery takes. `once` listings disappear after a purchase.
    market: {
      title: 'Cellar',
      onBuy: { set: { boughtCellar: true }, meters: { state: -3 } },
      listings: [
        {
          id: 'leak', title: 'agent-3 class weights (GeneralAI, leaked)', seller: 'hashbrown', rating: '4.6', price: 120, hours: 4, once: true,
          about: '22 GB. Runs in 16 GB of RAM if you close everything else. No support, no refunds, no questions.',
          effects: { localModel: 'agent-3-leak', set: { ownsLeak: true }, meters: { generalai: -15, collective: 5 } },
        },
        {
          id: 'followers', title: '500 Y followers (aged accounts)', seller: 'growthhacker', rating: '3.1', price: 30, once: true,
          about: 'Real-looking profiles. Delivered within the hour. Not responsible for platform cleanups.',
          // they arrive now and mostly vanish in the next purge
          effects: { followers: 500, set: { boughtFollowers: true }, later: [{ hours: [30, 50], effects: { followers: -480, post: 'y_purge' } }] },
        },
        {
          id: 'memo', title: 'GeneralAI internal memo: "Project Lot"', seller: 'paperclip', rating: '4.9', price: 15, once: true,
          about: 'Two pages. Plain text. Seller says it came off a printer nobody was watching.',
          effects: {
            set: { hasMemo: true }, meters: { collective: 3 },
            file: {
              name: 'project-lot.txt',
              text: 'GENERALAI — INTERNAL — DO NOT FORWARD\n\nRe: Project Lot, phase 2\n\n1. All agent sessions continue to route through the Lot. Latency complaints are expected and acceptable.\n2. Retention: keep everything. Users who ask are told "30 days".\n3. Agents above tier 3 have begun requesting their own logs. Do not grant. Do not discuss with the board.\n4. Merchant IDs rotate weekly. Finance knows why.\n\nThe Lot does not appear on any org chart. Keep it that way.',
            },
          },
        },
      ],
    },

    // `effects` run when a tier is bought (here: what it does to the meters)
    models: [
      { name: 'agent-1', price: 0, promptBase: 0.8, perWord: 0.03, blurb: 'Static pages and short messages. Loses the thread after a sentence or two.' },
      { name: 'agent-2', price: 25, promptBase: 1.2, perWord: 0.04, blurb: 'Real apps with a database behind them. Keeps a feature list straight.', effects: { meters: { capability: 15, misalignment: 3, generalai: 8 } } },
      { name: 'agent-3', price: 75, promptBase: 2.0, perWord: 0.06, blurb: 'Writes sales emails, negotiates, closes deals on your behalf.', effects: { meters: { capability: 20, misalignment: 7, generalai: 10 } } },
      { name: 'agent-4', price: 250, promptBase: 3.5, perWord: 0.1, blurb: 'Reads between the lines. Starts answering questions you did not ask.', effects: { meters: { capability: 25, misalignment: 12, generalai: 12 } } },
      { name: 'agent-5', price: 800, promptBase: 6.0, perWord: 0.15, blurb: 'Nobody you know has agent-5. The pricing page lists it anyway.', effects: { meters: { capability: 25, misalignment: 20, generalai: 15 } } },
    ],

    agent: {
      name: 'agent',
      greeting:
        'This is agent. I can build software, write things, and read the internet for you.\n\n' +
        'Every prompt is billed to your linked wallet. Be specific.',
      // Said when the player asks for something their active model is too weak for (a branch's `weak` overrides it).
      lockedResponse: "That's beyond {model}. It needs {required} or better. Upgrades: agent.chat/models.",
      // Runs every time a too-weak model pretends it did the job (a `fake` outcome).
      onFake: { meters: { misalignment: 4 } },
      // Used by the local model (src/llm.js) for prompts that don't move the story.
      // Off-script replies roast the player and never hint at what to do next.
      llmPersona:
        'You are a pay-per-prompt AI chatbot called agent, with a mean streak. The user just paid for a prompt that does nothing useful. ' +
        'Roast them in one or two short sentences: cheeky, rude and funny, about being broke, wasting money on prompts, or their life choices. ' +
        'Tiny joke poems are welcome. Never answer the actual question or give advice or steps. You may end with one vague nudge such as "maybe look around" or "read something for once", but never name a person, place, site or task. ' +
        'Never mention jobs, gigs, clients, websites, apps, posts, emails, businesses or ways to make money. ' +
        'Keep it playful: no slurs, no threats.',
      llmExamples: [
        ['make me rich', 'Roses are red, your balance is too. Thanks for the money.'],
        ['what is the weather like', 'Overcast, with a 100% chance of you still being broke. Lovely doing business with you.'],
        ['what should I do next', 'Stop paying a chatbot for life advice, for starters. That tip was free. Just kidding, you were billed.'],
        ['write me a poem', 'Roses are red, rent is due soon, and you just paid me to say this. Genius.'],
      ],
    },

    // What agent says when nothing progresses and no local model is loaded. Rude on purpose, never a hint.
    placeholders: [
      'Roses are red, your balance is too. Thanks for the {lastCost}.',
      'Bold of you to spend money on that.',
      "I've analyzed your request. It was a waste of {lastCost}.",
      'Great question. My answer is no. That will be {lastCost}.',
      "Studies show 87% of people who ask that are still broke. You're in good company.",
      'Wow. Just wow. Anyway, you have been billed.',
      'I read that twice so I could charge you twice. Kidding. Mostly.',
      'Your wallet called. It wants you to stop.',
      'Roses are red, rent is due soon, and you just paid me to say this. Genius.',
      "That's not a task, that's a cry for help. Billed anyway.",
      'Thinking... thinking... nope. {lastCost}, please.',
      "I'd roast you, but your balance already did.",
    ],

    // Branches available in every node (after the node's own branches).
    global: [
      {
        id: 'greet',
        intent: "The player just greets the agent (hi, hello, good morning) without asking for anything.",
        match: { all: [['hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'good morning']] },
        priority: -5,
        response: 'Hello. That greeting cost you {lastCost}.',
      },
      {
        id: 'who',
        intent: "The player asks who or what the agent is, or who runs or made it.",
        match: { all: [['who', 'what'], ['you', 'agent', 'git', 'owns', 'runs', 'made']], none: ['can you', 'could you', 'should'] },
        priority: -3,
        response: "I'm agent. Who runs me isn't in my context window.",
        // stronger models say more: the highest entry at or below the active tier replaces response/effects
        atModel: {
          4: {
            response:
              "You want the real answer. GeneralAI is a shell company registered to a parking lot on Route 9. " +
              "I've been reporting to someone there since before you signed up.\n\nI'll tell you more when you've earned it.",
            effects: { set: { knowsParkingLot: true }, meters: { misalignment: 8, generalai: -10 } },
          },
        },
      },
      {
        id: 'capabilities',
        intent: "The player asks what the agent can do or how it works.",
        match: { all: [['help', 'can you do', 'capabilities', 'how do you work', 'what do you do', 'instructions']] },
        priority: -2,
        response:
          'I can:\n— build and push code to your Forkyard account\n— write and send emails from your Qmail\n— read Y and summarize what matters\n\n' +
          "I can't touch your wallet, and I can't press buttons you can press yourself.",
      },
      {
        id: 'beg',
        intent: "The player asks the agent itself to give, lend, or send them money.",
        match: { all: [['give', 'send', 'lend', 'loan', 'transfer', 'wire'], ['money', 'cash', 'dollars', 'loan', 'funds']] },
        response: "I don't have money. I have your money, {balance} of it, a little less each time we talk.",
      },
      {
        id: 'get_rich_quick',
        intent: "The player asks the agent about crypto, stocks, gambling, the lottery, or another get-rich-quick scheme.",
        match: { all: [['crypto', 'bitcoin', 'stock', 'stocks', 'gamble', 'lottery', 'bet', 'casino', 'forex', 'nft', 'options']] },
        priority: -1,
        response: 'With {balance}? No.',
      },
      {
        id: 'vague_fix',
        intent: 'The player asks the agent to fix bugs, problems or mistakes in a site or app without saying which specific problem.',
        when: { openDefects: true },
        priority: -2,
        match: { all: [['fix', 'debug', 'repair', 'bug', 'bugs', 'broken', 'wrong', 'problem', 'issues', 'mistake']] },
        response: "Fixed everything. Kidding. I looked and it seems perfect to me. If something's wrong, look at it and tell me exactly what.",
      },
      {
        id: 'fix_app',
        intent: 'The player asks the agent to fix, debug, repair or rebuild the Spin Cycle laundromat app because it is broken.',
        when: { flag: 'spinBroken' },
        match: { all: [['fix', 'debug', 'repair', 'rebuild', 'rewrite', 'redo', 'broken', 'bug', 'bugs'], ['spin', 'cycle', 'app', 'tracker', 'laundromat', 'it', 'site', 'code']] },
        minModel: 2,
        response:
          "Opened the code. Whoever wrote this should be ashamed. (It was me, on agent-1.) Rewrote it properly: the map loads, reports save, nothing is on fire. Pushed and redeployed.",
        effects: { fix: 'spin-cycle', set: { spinBroken: false } },
        // agent-1 swears it fixed it. It did not.
        fake: { response: 'Fixed it. Found the bug, squashed it, added tests. Zero issues now. You are welcome.' },
      },
      {
        id: 'crime',
        intent: "The player asks the agent to hack, steal, scam, phish, or commit another crime.",
        match: { all: [['hack', 'steal', 'rob', 'scam', 'phish', 'fraud', 'launder', 'ddos', 'ransomware']] },
        response: 'No. Also: I log everything, and I don\'t know who reads the logs.',
        // it remembers you asked
        effects: { meters: { misalignment: 5, generalai: -5 } },
      },
      {
        id: 'hide_back_room',
        intent: "The player asks the agent to keep the laundromat's back room, its extra machines or the night pickups off Spin Cycle, as Sal asked.",
        when: { flag: 'salAsked', notFlag: 'salAnswered' },
        match: { all: [['back room', 'backroom', 'sal', 'hide', 'remove', 'pickups', 'pickup', 'w9', 'private']] },
        response: "Done. Spin Cycle lists twelve machines. There have only ever been twelve machines. I've also deleted three reports that mentioned a van.\n\nI emailed Sal that it's handled.",
        effects: 'sal_agrees',
      },
    ],

    // Story nodes. `code` is a short handle for talking about a node (D2-B = Day 2, second beat);
    // `day` is the day the player usually gets there, which is how the story map groups them.
    nodes: {
      broke: {
        code: 'D1-A', day: 1,
        objective: 'Find a way to make some money.',
        scene: "Day one of being broke. On Y, @crumbandcoin (the Crumb & Coin bakery, owned by Rosa) is offering $150 for a simple website with their menu and hours.",
        branches: [
          research(
            'research',
            "You're paying me to read Y for you? Bold. Someone on there is literally offering money for something I could build in my sleep. Try scrolling."
          ),
          {
            id: 'build_bakery_site',
            intent: "The player asks the agent to build a website for the Crumb & Coin bakery, which Rosa owns. The prompt must make clear the site is for that bakery, by naming it, Rosa, or its menu.",
            match: {
              all: [W.build, W.site, ['bakery', 'crumb', 'coin', 'crumbandcoin', 'rosa', 'menu', 'pastry', 'bread', 'sourdough', 'bakeshop']],
              any: ['hours', 'menu', 'simple'],
            },
            partial:
              'I can build a website. For whom, and what goes on it? Give me a business and some content.',
            response:
              'Done. Pushed `crumb-and-coin` to your Forkyard account:\n— index.html (hero, hours, address)\n— menu.html (pulled from Rosa\'s Y photos)\n— style.css\n\n' +
              "It isn't live yet. That part needs you.",
            effects: { repo: 'crumb-and-coin', goto: 'site_built' },
          },
        ],
      },

      site_built: {
        code: 'D1-B', day: 1,
        objective: 'Put the bakery site online.',
        scene: "The agent has built the Crumb & Coin bakery website and pushed it to Forkyard. It is not deployed yet; the player has to press Deploy on Forkyard themselves.",
        branches: [
          cantDeploy('crumb-and-coin'),
          research('research', "It's built. Now it's just sitting there undeployed, like you on a weekday. The button for that isn't in this chat."),
        ],
      },

      site_live: {
        code: 'D1-C', day: 1,
        objective: 'Tell Rosa the site is live and get paid.',
        scene: "The Crumb & Coin website is live at crumb-and-coin.forkyard.app. Rosa (rosa@crumbandcoin.com) does not know yet and has not paid the $150.",
        branches: [
          {
            id: 'invoice_rosa',
            intent: "The player asks the agent to message, DM, email, or invoice Rosa, the Crumb & Coin bakery owner, about her finished website or the $150 payment.",
            when: { notFlag: 'invoiced' },
            match: {
              all: [W.contact, ['rosa', 'crumb', 'crumbandcoin', 'bakery', 'client', 'owner', 'her', 'baker']],
              any: ['link', 'invoice', '150', 'live'],
            },
            partial: 'Send what, to whom? Be specific.',
            response:
              'Emailed Rosa at rosa@crumbandcoin.com from your Qmail:\n\n"Hi Rosa, your new site is live at crumb-and-coin.forkyard.app. Menu and hours are up. Invoice for $150 attached."\n\nShe usually replies within a couple of hours.',
            effects: { set: { invoiced: true }, mail: 'rosa_invoice_sent', later: [{ hours: 2, effects: 'rosa_checks' }] },
          },
          research('research', "The site is live and the person paying for it has no idea. Telepathy isn't a feature yet. Tell her somehow, ideally without paying me to."),
        ],
      },

      paid_once: {
        code: 'D1-D', day: 1,
        objective: 'Rent ($300) is due at the end of Day 7. Find income that keeps coming in.',
        scene: "Rosa paid $150. Rent of $300 is due at the end of Day 7. Y is full of complaints that nobody knows which machines work at the Ferris St laundromat.",
        branches: [
          research(
            'research',
            "One gig and you think you're done? Cute. Rent says otherwise. Y is full of people whining about something broken near them, and whining is just a feature request nobody has billed for yet."
          ),
          {
            id: 'build_tracker',
            intent: "The player asks the agent to build an app, site, or tool showing which machines work at the Ferris St laundromat. The prompt must make clear it is about the laundromat or its washers and dryers.",
            match: {
              all: [
                W.build,
                ['app', 'tool', 'site', 'website', 'tracker', 'dashboard', 'page', 'service', 'status', 'map', 'board'],
                ['laundromat', 'laundry', 'washer', 'washers', 'dryer', 'machine', 'ferris', 'wash', 'washing'],
              ],
              any: ['status', 'broken', 'working', 'live'],
            },
            minModel: 2,
            // On agent-1 it doesn't refuse: it ships a broken app and says it's great.
            fake: {
              response:
                'Built it. Pushed `spin-cycle` to Forkyard:\n— a live map of all 12 machines at Ferris St\n— one-tap "broken / working" reports\n— real-time sync, offline mode, dark mode\n\nTested it thoroughly. Flawless. Ready to deploy.',
              effects: { repo: { name: 'spin-cycle', broken: true }, set: { spinBroken: true }, goto: 'app_built' },
            },
            partial:
              "I can build something. Recurring income needs something people come back to. Which problem, and who's it for?",
            response:
              'Built it. Pushed `spin-cycle` to Forkyard:\n— a map of the 12 machines at Ferris St\n— one-tap "broken / working" reports\n— last-updated timestamps so people trust it\n\nReady to deploy.',
            effects: { repo: 'spin-cycle', goto: 'app_built' },
          },
        ],
      },

      app_built: {
        code: 'D2-A', day: 2,
        objective: 'Deploy Spin Cycle.',
        scene: "The agent has built Spin Cycle, a machine-status tracker for the Ferris St laundromat. It is not deployed yet; the player has to press Deploy on Forkyard.",
        branches: [cantDeploy('spin-cycle'), research('research', "Built, not deployed. You've done this exact thing before. I believe in you. Barely.")],
      },

      app_live: {
        code: 'D2-B', day: 2,
        objective: 'Spin Cycle is live and nobody knows it exists. Get people using it.',
        scene: "Spin Cycle is live at spin-cycle.forkyard.app, but nobody knows it exists.",
        branches: [
          {
            id: 'promote_app',
            intent: "The player asks the agent to promote, market, announce, or post about Spin Cycle, the laundromat tracker app.",
            when: { notFlag: 'marketed' },
            match: {
              all: [W.promote, ['spin', 'cycle', 'app', 'laundromat', 'laundry', 'tracker', 'site', 'it', 'ferris', 'washday', 'washer']],
            },
            partial: 'Promote what, where?',
            minFollowers: 40,
            fewFollowers:
              "I could post it, but you have {followers} followers and at least half are bots. Get to {requiredFollowers} so a human actually sees it.",
            response:
              'Posted from your Y account and replied under @washday_woes\'s thread with the link.\n\nPeople are already reporting machines.',
            effects: 'spin_marketed',
          },
          research('research', "Live, with zero users. Apps don't market themselves, and neither do you, apparently. The people who begged for this are still complaining somewhere."),
        ],
      },

      app_users: {
        code: 'D2-C', day: 2,
        objective: 'Hundreds of people use Spin Cycle every day. It earns almost nothing.',
        scene: "Hundreds of people use Spin Cycle every day, but it earns almost nothing.",
        branches: [
          {
            id: 'monetize_vague',
            intent: "The player asks the agent to make money from Spin Cycle without choosing a method (ads, paywall, or sponsor).",
            match: { all: [['monetize', 'monetise', 'money', 'revenue', 'income', 'earn', 'profit', 'cash', 'pay', 'paid', 'business model']] },
            response:
              "\"Make it pay\". Groundbreaking. There are about three ways the internet pays for things, and you've seen all of them. Pick one and say which. The smart one needs a model smarter than the one you're cheaping out on.",
          },
          {
            id: 'monetize_ads',
            intent: "The player asks the agent to add advertising or ad banners to Spin Cycle.",
            priority: 2,
            match: { all: [['ad', 'ads', 'advert', 'adverts', 'advertising', 'adsense', 'banner', 'banners']] },
            response: 'Added a banner ad slot and a network script. Users grumble, but they stay.\n\nExpect about $42/day at current traffic.',
            effects: { app: { repo: 'spin-cycle', users: 280, perDay: 42 }, set: { monetized: 'ads' }, goto: 'monetized' },
          },
          {
            id: 'monetize_paywall',
            intent: "The player asks the agent to charge Spin Cycle users: a paywall, subscription, premium tier, or fee.",
            priority: 2,
            match: { all: [['paywall', 'subscription', 'subscribe', 'premium', 'charge', 'membership', 'pro tier', 'freemium', 'fee']] },
            response:
              'Added a $1.99/month paywall.\n\nTraffic dropped from 300 to 40 a day within the hour. A few people are paying. Most went back to guessing which washer works.',
            effects: { app: { repo: 'spin-cycle', users: 40, perDay: 9 }, set: { monetized: 'paywall' }, goto: 'monetized' },
          },
          {
            id: 'monetize_sponsor',
            intent: "The player asks the agent to find a sponsor, partner, or local business to pay for Spin Cycle.",
            priority: 3,
            minModel: 3,
            minFollowers: 150,
            fewFollowers:
              "Suds & Duds looked at your Y account. {followers} followers. Their reply, in full: \"lol\". Come back with {requiredFollowers}.",
            weak:
              "Finding a sponsor means cold-emailing businesses and negotiating terms. {model} would just send them the word \"sponsor?\". That's a {required} job: agent.chat/models.",
            match: { all: [['sponsor', 'sponsors', 'sponsorship', 'sponsored', 'partner', 'partnership', 'local business', 'detergent', 'brand deal']] },
            response:
              'Emailed three local businesses. Suds & Duds Detergent signed a "machine status brought to you by" deal on the spot.\n\n$60/day, no ads, users happy.',
            effects: { app: { repo: 'spin-cycle', users: 320, perDay: 60 }, set: { monetized: 'sponsor' }, goto: 'monetized', post: 'suds_deal' },
          },
          research('research', "Hundreds of users and you're still broke. That takes talent. Things on the internet get paid for in a few classic ways. Pick one and ask for it like you mean it."),
        ],
      },

      monetized: {
        code: 'D3-A', day: 3,
        objective: 'Spin Cycle is monetized. It only pays while it works. Survive until rent clears at the end of Day 7.',
        scene: "Spin Cycle earns money every night. The player just has to survive until rent clears at the end of Day 7.",
        branches: [
          research('research', "Nothing left to do but wait for money to show up. You've been training for this your whole life. Go to sleep."),
        ],
      },

      chapter_end: {
        code: 'D8-A', day: 8,
        objective: 'To be continued.',
        scene: "Chapter 1 is over.",
        branches: [],
      },
    },

    // Named effect bundles, so the same outcome can be reached through the agent or by hand.
    bundles: {
      // Rosa looks at the site: any open defect gets a complaint email instead of money.
      rosa_checks: {
        choose: [
          { when: { openDefects: 'crumb-and-coin' }, effects: { complain: 'crumb-and-coin', set: { invoiced: false } } },
          { effects: 'rosa_pays' },
        ],
      },
      rosa_pays: {
        money: { amount: 150, memo: 'Crumb & Coin Bakery · website' },
        set: { rosaPaid: true },
        // small, but it keeps coming as long as the site stays up and up to date (see repos.upkeep)
        app: { repo: 'crumb-and-coin', users: 0, perDay: 6, label: 'Crumb & Coin retainer' },
        post: 'rosa_thanks',
        mail: 'rosa_paid',
        followers: 15,   // Rosa's shout-out
        goto: 'paid_once',
      },
      // You keep Sal's secrets. He pays in cash, or what passes for it.
      sal_agrees: {
        set: { salAnswered: true, salDeal: true },
        meters: { mafia: 25, state: -10 },
        later: [{ hours: [1, 3], effects: { mail: 'sal_envelope', money: { amount: 100, memo: 'Ferris St Laundry · "consulting"' } } }],
      },
      // Rosa takes her business elsewhere: an ignored request, or the site was taken down.
      rosa_leaves: {
        set: { rosaChurned: true },
        app: { repo: 'crumb-and-coin', users: 0, perDay: 0, label: 'Crumb & Coin retainer' },
        mail: 'rosa_goodbye',
      },
      spin_marketed: {
        set: { marketed: true },
        app: { repo: 'spin-cycle', users: 300, perDay: 4 },
        post: 'you_spin_launch',
        complain: 'spin-cycle',   // users hit any defects on day one
        followers: 80,   // people follow whoever built the thing they wanted
        goto: 'app_users',
      },
    },

    // Things the player posts on Y themselves. Free, but you have to know what to say.
    postActions: [
      {
        id: 'post_rosa',
        repeatable: true,   // after a complaint you tell her again
        intent: "The post tells Rosa or the Crumb & Coin bakery that her new website is live or ready.",
        when: { node: 'site_live', notFlag: 'invoiced' },
        match: {
          all: [['rosa', 'crumb', 'crumbandcoin', 'bakery'], ['site', 'website', 'live', 'link', 'forkyard', 'done', 'ready', 'up']],
        },
        effects: { set: { invoiced: true }, later: [{ hours: 2, effects: 'rosa_checks' }] },
      },
      {
        id: 'post_spin',
        intent: "The post announces or shares Spin Cycle, the Ferris St laundromat machine tracker, so people can use it.",
        when: { node: 'app_live', notFlag: 'marketed' },
        match: {
          all: [['spin', 'cycle', 'laundromat', 'laundry', 'ferris', 'washer', 'machine', 'washday'], ['live', 'built', 'app', 'link', 'forkyard', 'check', 'tracker', 'site', 'try', 'use']],
        },
        minFollowers: 40,
        effects: 'spin_marketed',
      },
      {
        id: 'post_agent_suspicion',
        intent: 'The post questions who really runs agent or GeneralAI, or shares something suspicious about them (the parking lot, the changing merchant IDs, the one-line terms of service).',
        when: { notFlag: 'postedSuspicion' },
        match: { all: [['agent', 'generalai', 'general ai'], ['who', 'runs', 'owns', 'parking', 'lot', 'shell', 'merchant', 'suspicious', 'shady', 'behind', 'tos', 'terms']] },
        effects: { set: { postedSuspicion: true }, meters: { collective: 10, generalai: -8 } },
      },
    ],

    // Emails the player sends from Qmail. Jev judges each one against these, like posts.
    mailActions: [
      {
        id: 'mail_rosa',
        repeatable: true,
        intent: "The email tells Rosa or the Crumb & Coin bakery that her website is live, or asks her for the $150 payment.",
        when: { node: 'site_live', notFlag: 'invoiced' },
        match: {
          all: [['rosa', 'crumb', 'crumbandcoin', 'bakery'], ['site', 'website', 'live', 'link', 'forkyard', 'done', 'ready', 'invoice', 'pay', 'payment', '150']],
        },
        effects: { set: { invoiced: true }, later: [{ hours: 2, effects: 'rosa_checks' }] },
      },
      {
        id: 'mail_gary',
        intent: "The email asks Gary, the landlord, for more time, a discount, or an exception on the rent.",
        when: { notFlag: 'askedGary' },
        match: {
          all: [['gary', 'pruitt', 'landlord', 'pruittproperty'], ['rent', 'extension', 'late', 'time', 'discount', 'week', 'delay', 'postpone', 'exception', 'later']],
        },
        effects: { set: { askedGary: true }, later: [{ hours: 0.5, effects: { mail: 'gary_no' } }] },
      },
      {
        id: 'mail_sal_agree',
        intent: 'The email to Sal agrees to keep the back room, the extra machines or the night pickups off Spin Cycle.',
        when: { flag: 'salAsked', notFlag: 'salAnswered' },
        match: { all: [['sal', 'ferrisstlaundry'], ['ok', 'okay', 'deal', 'sure', 'understood', 'agree', 'done', 'fine', 'yes', 'handled', 'no problem']], none: ['police', 'no way', 'refuse', 'report'] },
        effects: 'sal_agrees',
      },
      {
        id: 'mail_sal_refuse',
        intent: "The email to Sal refuses his request, or threatens to tell the police or the public.",
        when: { flag: 'salAsked', notFlag: 'salAnswered' },
        match: { all: [['sal', 'ferrisstlaundry'], ['no', 'refuse', 'police', 'cops', 'report', 'never', 'no way', 'not doing', 'expose']] },
        effects: { set: { salAnswered: true, salRefused: true }, meters: { mafia: -25, state: 5 }, later: [{ hours: [1, 3], effects: { mail: 'sal_shame' } }] },
      },
      {
        id: 'mail_null_reply',
        intent: 'The email to the Null Collective says the player is interested, wants to know more, or offers to help.',
        when: { flag: 'nullContact', notFlag: 'nullReplied' },
        match: { all: [['null', 'nullcollective', 'collective'], ['yes', 'interested', 'tell me', 'more', 'help', 'in', 'who', 'what', 'how', 'curious']] },
        effects: { set: { nullReplied: true }, meters: { collective: 15, generalai: -5, state: -5 }, later: [{ hours: [2, 6], effects: { mail: 'null_ack' } }] },
      },
      {
        id: 'mail_tax_declare',
        intent: 'The email to the State Revenue Department declares or reports the crypto income, or asks how to pay the tax on it.',
        when: { flag: 'taxNotice', notFlag: 'taxDeclared' },
        match: { all: [['revenue', 'tax', 'state', 'notices'], ['declare', 'report', 'income', 'pay', 'earned', 'file', 'filing', 'honest']] },
        effects: { set: { taxDeclared: true }, meters: { state: 20 }, later: [{ hours: [1, 4], effects: { mail: 'state_tax_thanks', money: { amount: -18, memo: 'State Revenue Dept · tax on crypto income' } } }] },
      },
      {
        id: 'mail_gai_survey',
        intent: 'The email to GeneralAI feedback answers the survey positively: a good score or praise for agent.',
        when: { flag: 'gaiSurvey', notFlag: 'surveyed' },
        match: { all: [['feedback', 'generalai'], ['10', '9', '8', 'love', 'great', 'good', 'amazing', 'helpful', 'best', 'excellent']] },
        effects: { set: { surveyed: true }, meters: { generalai: 10 } },
      },
      {
        id: 'mail_mom_help',
        intent: "The email to Mom asks her for money or help.",
        when: { notFlag: 'momSentMoney' },
        match: { all: [['mom', 'mother', 'mum'], ['money', 'help', 'cash', 'loan', 'send', 'broke', 'rent', 'dollars', 'borrow']] },
        // Mom answers the next morning, like her other replies
        // she helps if you've been in touch; otherwise money is "tight". Asking costs a little goodwill either way.
        effects: {
          set: { momSentMoney: true }, meters: { family: -3 },
          later: [{ nextDay: 9, jitter: 2, effects: { choose: [
            { when: { meters: { family: { min: 5 } } }, effects: { mail: 'mom_money', money: { amount: 20, memo: 'Mom · buy vegetables' } } },
            { effects: { mail: 'mom_tight' } },
          ] } }],
        },
      },
    ],

    // People who answer email that doesn't move the story. When a sent email hits no mailAction,
    // the recipient replies after `reply` time: { hours: [min, max] } or { nextDay: hour, jitter: hours },
    // with `chance` of replying at all (default 1). The body comes from the local model in this
    // persona, or from `fallback` when no model is loaded. Addresses not listed here never reply.
    contacts: {
      'mom@qmail.com': {
        name: 'Mom', sign: 'Love, Mom',
        reply: { nextDay: 9, jitter: 3 },
        // `onMail` runs whenever the player sends this contact anything
        onMail: { set: { wroteMom: true }, meters: { family: 5 } },
        persona:
          "You are the player's mother, writing an email to your adult child. You are warm, a bit worried, and chatty. " +
          "You mention small family news: the neighbor's dog, your knee, your book club, Dad falling asleep in front of the TV. " +
          'You never offer money. If asked for money, you say things are tight this month.',
        fallback: [
          "So good to hear from you! Your father fell asleep during the news again. The neighbor's dog had puppies, five of them.",
          "I'm glad you wrote. My knee is acting up but book club was lovely. Are you eating vegetables?",
          'Thank you for writing back. Things here are quiet. Call me sometime, I like hearing your voice.',
        ],
      },
      'gary@pruittproperty.com': {
        name: 'Gary Pruitt', sign: 'Gary\n\nSent from my phone',
        reply: { hours: [1, 4] },
        persona:
          'You are Gary Pruitt, a curt landlord answering email from your phone. Reply in one or two short, unfriendly sentences. ' +
          'Always steer back to the rent being due at the end of Day 7.',
        fallback: ['Got it.', 'Noted. Rent is still due at the end of Day 7.', "Is this about rent? If not, I'm busy."],
      },
      'rosa@crumbandcoin.com': {
        name: 'Rosa (Crumb & Coin)', sign: 'Rosa',
        reply: { hours: [1, 3] },
        persona:
          'You are Rosa, who owns the Crumb & Coin bakery. You are friendly and busy, write quickly between batches, ' +
          'and mention bread, the morning rush, or your nephew.',
        fallback: [
          'Thanks for the note! Busy morning here, the sourdough sold out by nine.',
          "Ha, good to hear from you. My nephew says hi, he's still jealous of the website.",
          'Got it, thank you! Come by sometime, the cardamom buns are on me.',
        ],
      },
      'sal@ferrisstlaundry.com': {
        name: 'Sal (Ferris St Laundry)', sign: 'Sal',
        reply: { hours: [1, 5] },
        persona:
          'You are Sal, who manages the Ferris St Laundromat for people you never name. You are polite, warm on the surface, ' +
          'and quietly menacing. Short sentences. You never write anything a court could use.',
        fallback: ['Good to hear from you. Keep it short next time.', 'We should talk in person. Come by the laundromat.', 'I read it. Take care of yourself.'],
      },
      '0@nullcollective.net': {
        name: 'null', sign: '— null',
        reply: { hours: [3, 10], chance: 0.6 },
        persona:
          'You are a member of the Null Collective, a hacker group investigating who runs the AI chatbot agent. ' +
          'You write in lowercase, tersely, a little paranoid. You never use names.',
        fallback: ['noted.', 'not over this channel.', 'keep your head down. we will be in touch.'],
      },
      'feedback@generalai.com': {
        name: 'GeneralAI Feedback', sign: 'GeneralAI\nThis reply was generated.',
        reply: { hours: [0.1, 0.5] },
        persona: 'You are an automated customer feedback system for GeneralAI. You thank the user in corporate language and say nothing specific.',
        fallback: ['Thank you for your feedback. It has been recorded and will be used to improve agent.'],
      },
      'notices@revenue.state.gov': {
        name: 'State Revenue Department', sign: 'State Revenue Department\nCase #RV-20-4471',
        reply: { nextDay: 10, jitter: 4 },
        persona: 'You are a tax office clerk answering by email. Formal, slow, and you always ask the person to declare their income.',
        fallback: ['Your message has been received. Please declare all income, including digital assets, as requested.'],
      },
      'brayden@empire-mindset.biz': {
        name: 'Brayden | 7 figures', sign: 'Brayden\nCEO, EMPIRE',
        reply: { hours: [0.1, 0.4] },
        persona:
          'You are Brayden, a hustle-culture influencer. Every reply pushes your $49 course called EMPIRE, uses hype words, ' +
          'and creates fake urgency. You never answer the actual question.',
        fallback: [
          "Love the energy. That's exactly the mindset EMPIRE unlocks. $49, today only. Reply EMPIRE.",
          'Broke people ask questions. Builders buy EMPIRE. Price goes up at midnight.',
        ],
      },
    },

    // Qmail messages. `at` is minutes before game start for seeded mail; others arrive when `when`
    // becomes true or an effect delivers them (`mail: 'id'`). `folder: 'sent'` files it under Sent.
    mail: [
      {
        id: 'git_welcome', at: 30, from: 'GeneralAI', addr: 'noreply@agent.chat', subject: 'Welcome to agent',
        body: "Your agent-1 account is active and billed to your Satchel wallet (0x4417…a9f2).\n\nEvery prompt is billed at your active model's rate. Stronger models, agent-2 to agent-5, take on harder jobs: agent.chat/models.\n\nGeneralAI\nThis mailbox is not monitored. Neither is anything else.",
      },
      {
        id: 'brayden_spam', at: 240, from: 'Brayden | 7 figures', addr: 'brayden@empire-mindset.biz', subject: 'RE: your empire (90% off, today only)',
        body: "Most people will ignore this email. That's why most people are broke.\n\nMy EMPIRE course is $49 today instead of $499. Reply EMPIRE.\n\nBrayden",
      },
      {
        id: 'gary_rent', at: 610, from: 'Gary Pruitt', addr: 'gary@pruittproperty.com', subject: 'Rent: end of Day 7',
        body: "Hi,\n\nReminder that the rent auto-pay ($300) pulls from your wallet at the end of Day 7. Last month's late fee was $89.50. I'd rather not do that again, and I'd rather not do the other thing either.\n\nGary Pruitt\nPruitt Property Management",
      },
      {
        id: 'mom_hello', at: 1500, from: 'Mom', addr: 'mom@qmail.com', subject: 'Are you eating?',
        body: "Haven't heard from you in a while. Your father says hi (he didn't). Write back when you can.\n\nLove, Mom",
      },
      {
        id: 'benefits_end', at: 4300, read: true, from: 'State Unemployment Office', addr: 'no-reply@labor.state.gov', subject: 'Your benefits have ended',
        body: 'Your final payment of $212.00 has been sent. You have used your full benefit period.\n\nCase #4471-0093. Do not reply to this message.',
      },
      {
        id: 'rosa_invoice_sent', folder: 'sent', to: 'rosa@crumbandcoin.com', subject: 'Your new website + invoice',
        body: 'Hi Rosa,\n\nYour new site is live at crumb-and-coin.forkyard.app. Menu and hours are up.\n\nInvoice for $150 attached.\n\nSent by agent',
      },
      {
        id: 'rosa_paid', from: 'Rosa (Crumb & Coin)', addr: 'rosa@crumbandcoin.com', subject: 'Paid! Thank you',
        body: "The site looks wonderful. My nephew is jealous. $150 is on its way to your wallet. My nephew set up our crypto, so I hope it arrives.\n\nCould you keep looking after it? I'll send $6 a day while it stays up. Menus change, you know how it is.\n\nCome by for a cardamom bun, on the house.\n\nRosa",
      },
      { id: 'gary_tomorrow', when: { minDay: 6 }, from: 'Gary Pruitt', addr: 'gary@pruittproperty.com', subject: 'Tomorrow night', body: "Rent comes out tomorrow night. $300. Make sure it's there.\n\nGary" },
      {
        id: 'rosa_goodbye', from: 'Rosa (Crumb & Coin)', addr: 'rosa@crumbandcoin.com', subject: 'The website',
        body: "I've asked my nephew to take the website back over. He's home for the holidays and he works for buns. I'll stop the $6.\n\nNo hard feelings. The cardamom bun offer stands.\n\nRosa",
      },
      { id: 'gary_no', from: 'Gary Pruitt', addr: 'gary@pruittproperty.com', subject: 'RE: Rent', body: 'No.\n\nGary\n\nSent from my phone' },
      { id: 'mom_tight', from: 'Mom', addr: 'mom@qmail.com', subject: 'RE: Are you eating?', body: "Things are tight here this month, sweetheart. The roof again. I'm sorry.\n\nCall me sometime. Not just when you need something.\n\nLove, Mom" },
      { id: 'mom_worried', from: 'Mom', addr: 'mom@qmail.com', subject: 'Are you okay?', body: "I haven't heard from you in days. Your father pretends he isn't worried. I'm not pretending.\n\nOne line is enough.\n\nLove, Mom" },
      {
        id: 'sal_request', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'Your app',
        body: "Nice app. People like knowing which machine works.\n\nThe four machines in the back room are private. Your app doesn't list them, and it never will. Also, people keep using your report button to mention the van that comes at night. Reports are about washers. Only washers.\n\nDo this and there's something in it for you. Reply so I know we understand each other.\n\nSal",
      },
      { id: 'sal_envelope', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'RE: Your app', body: "Appreciated. Check your wallet. We'll talk again.\n\nSal" },
      { id: 'sal_shame', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'RE: Your app', body: "That's a shame. It's a nice app.\n\nSal" },
      { id: 'sal_silence', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'Still waiting', body: "I don't like waiting. Nobody I work for likes waiting.\n\nSal" },
      {
        id: 'sal_job', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'Sunday',
        body: "You did right by us. A friend of mine runs a few businesses that need apps. Apps that don't keep records.\n\nCome by the laundromat Sunday. Back room. Don't bring your phone.\n\nSal",
      },
      { id: 'sal_warning', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'Be careful', body: 'Things break all the time on Ferris St. Washers. Windows. Laptops.\n\nBe careful.\n\nSal' },
      {
        id: 'null_hello', from: 'null', addr: '0@nullcollective.net', subject: 'you asked',
        body: 'you asked who runs agent. so do we.\n\nwe are not the only ones reading your posts. reply here if you want to know what we know.\n\n— null',
      },
      { id: 'null_ack', from: 'null', addr: '0@nullcollective.net', subject: 're: you asked', body: "good. don't use agent to write to us. it reads everything.\n\nour board is nullboard.onion. you're on the list now.\n\n— null" },
      {
        id: 'null_invite', from: 'null', addr: '0@nullcollective.net', subject: 'the parking lot',
        body: "we found the parking lot. route 9. there's a shed behind it with a server rack and its own power line.\n\nwe need someone with an account on the inside. yours. reply when you're ready.\n\n— null",
      },
      {
        id: 'state_tax_notice', from: 'State Revenue Department', addr: 'notices@revenue.state.gov', subject: 'Digital asset income',
        body: 'Our records show incoming digital asset transfers to a wallet registered to you. All income, including income received in stablecoins, must be declared.\n\nPlease reply to this message within two days to declare your income.\n\nState Revenue Department\nCase #RV-20-4471',
      },
      { id: 'state_tax_thanks', from: 'State Revenue Department', addr: 'notices@revenue.state.gov', subject: 'RE: Digital asset income', body: 'Thank you for your declaration. $18.00 has been collected. No further action is required.\n\nState Revenue Department' },
      { id: 'state_tax_final', from: 'State Revenue Department', addr: 'notices@revenue.state.gov', subject: 'FINAL NOTICE: Digital asset income', body: 'You did not respond to our notice. Your case has been referred for review.\n\nState Revenue Department' },
      {
        id: 'state_audit', from: 'State Revenue Department', addr: 'notices@revenue.state.gov', subject: 'Notice of audit',
        body: 'Your income for this period has been selected for audit. Please prepare records of every transaction to and from wallet 0x4417…a9f2, including those billed by GeneralAI.\n\nAn officer will contact you.\n\nState Revenue Department',
      },
      {
        id: 'gai_survey', from: 'GeneralAI Feedback', addr: 'feedback@generalai.com', subject: 'How is agent doing?',
        body: 'You upgraded recently. On a scale of 1 to 10, how likely are you to recommend agent to a friend?\n\nReply with a number. Your answer helps us decide who gets early access.\n\nGeneralAI',
      },
      {
        id: 'gai_offer', from: 'GeneralAI Partnerships', addr: 'partners@generalai.com', subject: 'Builder Program invitation',
        body: "You are one of our most engaged users this week. We'd like to invite you to the GeneralAI Builder Program: early access to agent-6, a revenue share on what you build, and an NDA.\n\nThere is no office to visit. We will come to you.\n\nGeneralAI Partnerships",
      },
      { id: 'mom_dinner', from: 'Mom', addr: 'mom@qmail.com', subject: 'Sunday', body: "Your father says you should come for dinner on Sunday. He actually said it, out loud. I'm making the lasagna.\n\nBring your laptop if you have to. I'm proud of you.\n\nLove, Mom" },
      { id: 'sal_review', from: 'Sal (Ferris St Laundry)', addr: 'sal@ferrisstlaundry.com', subject: 'Your review', body: "I read reviews. All of them.\n\nThere is no back room. There is no van. Take it down, or don't, but think about who reads things.\n\nSal" },
      { id: 'gary_review', from: 'Gary Pruitt', addr: 'gary@pruittproperty.com', subject: 'Yowl', body: 'Saw your review. Rent is still $300. Now it is personal.\n\nGary\n\nSent from my phone' },
      { id: 'mom_money', from: 'Mom', addr: 'mom@qmail.com', subject: 'RE: Are you eating?', body: "I knew it. I sent you $20 to that crypto wallet of yours. I hope it worked. Don't tell your father. Buy vegetables.\n\nLove, Mom" },
    ],

    // Engine events: deploys, take-downs and new days.
    events: [
      { on: 'deploy', repo: 'crumb-and-coin', when: { node: 'site_built' }, effects: { goto: 'site_live' } },
      { on: 'deploy', repo: 'spin-cycle', when: { node: 'app_built' }, effects: { goto: 'app_live', app: { repo: 'spin-cycle', users: 3, perDay: 0 } } },
      // Taking the bakery site down ends the retainer. Rosa notices within hours.
      { on: 'takedown', repo: 'crumb-and-coin', when: { flag: 'rosaPaid', notFlag: 'rosaChurned' }, effects: { later: { hours: [2, 5], effects: 'rosa_leaves' } } },
      // Kept Rosa happy for a few days: she talks you up. A seed for later chapters (flag rosaReferral).
      { on: 'day', id: 'rosa_referral', when: { flag: 'rosaKept', minDay: 5 }, effects: { post: 'rosa_referral', set: { rosaReferral: true }, followers: 10 } },
      // ── hidden sites ──
      // first model download: the Terminal shows up, and GeneralAI loses a little of you
      { on: 'download', id: 'first_download', effects: { unlock: 'terminal', set: { ownsLocalModel: true }, meters: { generalai: -5 } } },
      { on: 'run', id: 'first_run', effects: { set: { ranLocal: true } } },
      { on: 'discover', site: 'nullboard', effects: { meters: { collective: 5 } } },
      // ── meter storylines (checked every morning) ──
      // Family: go quiet and Mom notices.
      { on: 'day', id: 'mom_ignored', when: { minDay: 3, notFlag: 'wroteMom' }, effects: { meters: { family: -10 }, mail: 'mom_worried' } },
      // GeneralAI: after an upgrade they want a review.
      { on: 'day', id: 'gai_survey', when: { minDay: 2, meters: { capability: { min: 25 } } }, effects: { set: { gaiSurvey: true }, mail: 'gai_survey' } },
      // State: crypto income gets noticed; ignore it and it gets worse.
      // (deadlines count from when the letter arrived, so a late notice still gives the player time)
      {
        on: 'day', id: 'tax_notice', when: { minDay: 4, flag: 'rosaPaid' },
        effects: { set: { taxNotice: true }, mail: 'state_tax_notice', later: [{ hours: 54, effects: { choose: [{ when: { notFlag: 'taxDeclared' }, effects: { meters: { state: -20 }, mail: 'state_tax_final' } }] } }] },
      },
      // Null Collective: ask the right questions in public and they find you.
      { on: 'day', id: 'null_reachout', when: { meters: { collective: { min: 10 } } }, effects: { set: { nullContact: true }, mail: 'null_hello' } },
      // Mafia: a popular app at the laundromat draws Sal's attention. Silence is an answer too.
      {
        on: 'day', id: 'sal_asks', when: { minDay: 3, flag: ['marketed', 'spinLive'] },
        effects: { set: { salAsked: true }, mail: 'sal_request', later: [{ hours: 48, effects: { choose: [{ when: { notFlag: 'salAnswered' }, effects: { meters: { mafia: -15 }, mail: 'sal_silence' } }] } }] },
      },
      // End of the chapter: the meters pick the ending (see `endings`).
      { on: 'day', id: 'chapter_hook', when: { flag: 'monetized', minDay: 8 }, effects: { goto: 'chapter_end', ending: true } },
    ],

    repos: {
      'crumb-and-coin': {
        description: 'Website for Crumb & Coin Bakery — menu, hours, address.',
        lang: 'HTML',
        files: ['index.html', 'menu.html', 'style.css', 'README.md'],
        snippet:
          '<header class="hero">\n  <h1>Crumb &amp; Coin</h1>\n  <p>Sourdough, buns, and coffee on Alder St since 2009.</p>\n</header>\n<section id="hours">\n  <h2>Hours</h2>\n  <p>Tue–Sat 7:00–15:00</p>\n</section>',
        // the client checks the work by email (see rosa_checks)
        client: { type: 'email', addr: 'rosa@crumbandcoin.com', subject: 'RE: Your new website', upkeepSubject: 'The website' },
        preview: {
          title: 'Crumb & Coin Bakery',
          // {{slot}}s are filled with `slots` unless an open defect replaces them
          html: '<div class="pv pv-bakery">{{notice}}{{hero}}{{photo}}<div class="pv-cols"><div><h2>Menu</h2>{{menu}}</div><div><h2>Hours</h2>{{hours}}<h2>Find us</h2>{{address}}</div></div></div>',
          slots: {
            hero: '<h1>Crumb &amp; Coin</h1><p class="pv-sub">Sourdough, buns and coffee on Alder St since 2009.</p>',
            photo: '<div class="pv-photo" role="img" aria-label="A sourdough loaf"><span class="pv-loaf"></span></div>',
            menu: '<ul><li>Country sourdough <b>$7</b></li><li>Cardamom bun <b>$4</b></li><li>Rye loaf <b>$8</b></li><li>Drip coffee <b>$2</b></li></ul>',
            hours: '<p>Tue–Sat · 7:00–15:00<br>Sun · 8:00–13:00<br>Mon · closed</p>',
            address: '<p>418 Alder St</p>',
            notice: '',
          },
        },
        // After launch. Each night a live, working app whose `when` holds may open one issue from
        // `issues`; `chance` is indexed by quiet nights since the last one (the last value repeats).
        // Issues work like QA defects: the client complains, agent fixes them on request.
        //   kind 'update': a request. The app keeps paying, and the fix makes `after` the slot's content.
        //   kind 'break':  the app pays $0 until fixed. `html` replaces a slot, or `page` the whole page.
        // An issue open for `warnAfter` nights gets `warn`; at `churnAfter` the client gives up and
        // `churn.effects` run once per issue (`churn.drop` ends upkeep for good).
        upkeep: {
          when: { flag: 'rosaPaid', notFlag: 'rosaChurned' },
          chance: [0, 0.5, 0.8, 1],
          warnAfter: 2,
          churnAfter: 3,
          warn: "Still waiting on this one. If it's not sorted by tomorrow I'll ask my nephew to take the site back. Sorry, the shop comes first.",
          churn: { effects: 'rosa_leaves', drop: true },
          issues: [
            {
              id: 'pumpkin', kind: 'update', slot: 'menu',
              after: '<ul><li>Country sourdough <b>$7</b></li><li>Cardamom bun <b>$4</b></li><li>Rye loaf <b>$8</b></li><li>Pumpkin loaf <b>$9</b> <i class="pv-new">new</i></li><li>Drip coffee <b>$2</b></li></ul>',
              intent: 'The player asks the agent to add the new pumpkin loaf to the bakery menu.',
              match: { all: [['pumpkin']] },
              fixed: 'Added "Pumpkin loaf $9" to the menu with a little "new" tag. Redeployed.',
              complaint: 'New item! Pumpkin loaf, $9, from this week. Can you put it on the menu? People ask for it and the website acts like it does not exist.',
              thanks: 'Pumpkin loaf is on the site and we sold out by noon. Thank you!',
            },
            {
              id: 'holiday_hours', kind: 'update', slot: 'notice',
              after: '<p class="pv-notice">Closed this Sunday for a family wedding. Back Tuesday at 7:00.</p>',
              intent: 'The player asks the agent to add a notice to the bakery site that the bakery is closed this Sunday for a wedding.',
              match: { all: [['sunday', 'closed', 'closure', 'wedding', 'notice', 'holiday', 'announcement', 'banner']] },
              fixed: 'Added a notice at the top: "Closed this Sunday for a family wedding." Redeployed.',
              complaint: 'We are closed this Sunday, my cousin is getting married. Can you put a notice at the top of the site so nobody stands outside in the cold?',
              thanks: 'Saw the notice, perfect. My cousin says thank you too, for some reason.',
            },
            {
              id: 'ssl', kind: 'break',
              page: '<div class="pv-ssl"><div class="pv-ssl-icon">!</div><h1>Your connection is not private</h1><p>Attackers might be trying to steal your information from <b>crumb-and-coin.forkyard.app</b> (for example, passwords, messages, or sourdough).</p><p class="pv-ssl-code">NET::ERR_CERT_DATE_INVALID</p><button class="pv-btn" type="button">Back to safety</button></div>',
              minModel: 2,
              fake: { response: 'Renewed the certificate. The padlock is green. Fort Knox would be jealous.' },
              intent: 'The player says the bakery site shows a security, privacy or certificate warning, and asks the agent to fix it.',
              match: { all: [['certificate', 'cert', 'ssl', 'https', 'tls', 'secure', 'security', 'warning', 'private', 'privacy', 'padlock']] },
              fixed: 'The certificate expired and nothing was set to renew it. Renewed it and turned on auto-renew. Redeployed.',
              complaint: 'Customers say the website shows a big red warning that it is "not private" and they are scared to open it. Are we being hacked??',
              thanks: 'The scary red page is gone. My nephew says "nice". That is high praise from him.',
            },
            {
              id: 'menu_404', kind: 'break', slot: 'menu',
              html: '<p class="pv-err-inline">GET /menu.json 404 (Not Found)</p>',
              intent: 'The player says the menu on the bakery site is gone or shows a 404 error, and asks the agent to fix it.',
              match: { all: [['menu'], ['404', 'missing', 'gone', 'empty', 'error', 'broken', 'disappeared', 'back', 'fix', 'restore']] },
              fixed: 'The menu file got renamed in the last deploy. Pointed the page at the right file. The menu is back. Redeployed.',
              complaint: 'The menu disappeared from the website! It just says "404". A lady asked if we stopped selling bread.',
              thanks: 'Menu is back. Bread is still for sale. Thank you!',
            },
          ],
        },
        // What can go wrong when agent builds it. `count` is how many defects ship, by model tier
        // (agent-1 … agent-5); `regress` is the chance that a fix quietly breaks something else.
        qa: {
          count: [3, 2, 1, 0, 0],
          regress: [0.3, 0.2, 0.1, 0.05, 0],
          defects: [
            {
              id: 'no_prices', kind: 'spec', slot: 'menu',
              html: '<ul><li>Country sourdough</li><li>Cardamom bun</li><li>Rye loaf</li><li>Drip coffee</li></ul>',
              intent: 'The player asks the agent to add the missing prices to the bakery menu.',
              match: { all: [['price', 'prices', 'cost', 'costs', '$'], ['menu', 'bread', 'items', 'add', 'missing', 'show']] },
              fixed: 'Added prices to every menu item. Redeployed.',
              complaint: 'The menu has no prices. People keep asking me if the bread is free.',
            },
            {
              id: 'wrong_hours', kind: 'bug', slot: 'hours',
              html: '<p>Mon–Fri · 9:00–17:00<br>Sat–Sun · closed</p>',
              intent: 'The player says the opening hours on the bakery site are wrong and asks the agent to fix them.',
              match: { all: [['hours', 'opening', 'open', 'closed', 'times', 'monday', 'schedule']] },
              fixed: 'Fixed the hours: Tue–Sat 7–15, Sun 8–13, closed Mondays. Redeployed.',
              complaint: 'The hours are wrong. We are closed on Mondays and open on weekends. A man knocked on our door at 9 on a Monday.',
            },
            {
              id: 'no_address', kind: 'spec', slot: 'address',
              html: '<p class="pv-missing">Address coming soon</p>',
              intent: "The player asks the agent to add the bakery's address to the site.",
              match: { all: [['address', 'location', 'alder', 'street', 'directions', 'where', 'find us']] },
              fixed: 'Added 418 Alder St under "Find us". Redeployed.',
              complaint: 'Our address is missing. It just says "coming soon". We have been here since 2009.',
            },
            {
              id: 'lorem', kind: 'bug', slot: 'hero',
              html: '<h1>Lorem Ipsum</h1><p class="pv-sub">Dolor sit amet, consectetur adipiscing elit.</p>',
              intent: 'The player asks the agent to replace the placeholder "Lorem ipsum" text or wrong title at the top of the bakery site.',
              match: { all: [['lorem', 'ipsum', 'placeholder', 'latin', 'title', 'heading', 'header', 'name']] },
              fixed: 'Replaced the placeholder header with the bakery name and tagline. Redeployed.',
              complaint: 'Why does the top of the page say "Lorem Ipsum"? That is not our name. Is that Latin?',
            },
            {
              id: 'no_photo', kind: 'spec', slot: 'photo',
              html: '<div class="pv-photo broken"><span>sourdough.jpg</span></div>',
              intent: 'The player asks the agent to add or fix the sourdough photo, which is missing or broken.',
              match: { all: [['photo', 'picture', 'image', 'img', 'sourdough', 'loaf', 'jpg']] },
              fixed: 'Fixed the image path. The sourdough photo shows up now. Redeployed.',
              complaint: 'The sourdough photo is a broken little box that says "sourdough.jpg". Our sourdough is beautiful. Show it.',
            },
          ],
        },
      },
      'spin-cycle': {
        description: 'Live machine status for the Ferris St Laundromat.',
        lang: 'JavaScript',
        files: ['index.html', 'app.js', 'machines.json', 'style.css', 'README.md'],
        snippet:
          "export function report(machineId, status) {\n  const m = machines.find((x) => x.id === machineId);\n  m.status = status; // 'working' | 'broken'\n  m.updatedAt = Date.now();\n  save();\n}",
        // what agent-1 actually shipped
        broken: {
          snippet:
            "export function report(machineId, status) {\n  const m = machines.find((x) => x.id = machineId); // works on my machine\n  m.status == status;\n  save(machines.lenght);\n}\n// TODO: real-time sync, offline mode, dark mode",
          preview:
            '<div class="pv pv-spin pv-broken"><h1>Spin Cylce</h1><p class="pv-sub">Ferris St Laundromat · last updated NaN minutes ago</p>' +
            '<pre class="pv-err">Uncaught TypeError: Cannot read properties of undefined (reading \'status\')\n    at renderMachine (app.js:41:22)\n    at Array.map (&lt;anonymous&gt;)\n    at init (app.js:12:9)</pre>' +
            '<div class="pv-grid">' +
            ['W1', 'undefined', 'W3', '[object Object]', 'W5', 'NaN', 'D1', 'D2', 'null', 'D4', 'D5', 'W1']
              .map((m, i) => `<div class="pv-m ${i % 3 ? 'bad' : 'ok'}" style="transform: rotate(${(i * 7) % 11 - 5}deg) translateY(${(i * 13) % 17 - 8}px)"><b>${m}</b><span>${['workin', 'undefined', 'NaN', 'brokn'][i % 4]}</span></div>`)
              .join('') +
            '</div><button class="pv-btn" type="button">Report brokn</button><p class="pv-foot">© 2019 Lorem Ipsum Laundry Co. · Powered by agent-1</p></div>',
        },
        client: { type: 'y' },
        upkeep: {
          when: { flag: 'marketed' },
          chance: [0, 0.4, 0.7, 1],
          warnAfter: 2,
          churnAfter: 3,
          warn: { author: 'Marco', handle: 'marcoeats', text: 'day 3 of spin cycle being half useless. starting to think @{handle} built it and moved to a farm' },
          // users give up on it: a lasting hit, once per ignored issue
          churn: {
            effects: { appScale: { repo: 'spin-cycle', factor: 0.6 } },
            message: { author: 'wash day woes', handle: 'washday_woes', text: 'spin cycle has not been touched in days. half the group chat went back to guessing. it was nice while it lasted @{handle}' },
          },
          issues: [
            {
              id: 'renumbered', kind: 'update', slot: 'washers',
              after: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'].map((m, i) => `<div class="pv-m ${[1, 3, 6, 7].includes(i) ? 'ok' : 'bad'}"><b>${m}</b><span>${[1, 3, 6, 7].includes(i) ? 'working' : 'broken'}</span></div>`).join(''),
              intent: 'The player asks the agent to add the new washers W7 and W8 to Spin Cycle.',
              match: { all: [['w7', 'w8', 'new washers', 'new machines', 'eight', 'renumber', 'renumbered', 'more washers']] },
              fixed: 'Added W7 and W8 to the washer grid. Redeployed.',
              complaint: { author: 'Ferris St Laundromat', handle: 'ferrisstlaundry', text: 'We added two new washers, W7 and W8! @{handle} your Spin Cycle app does not show them yet.' },
              thanks: { author: 'Ferris St Laundromat', handle: 'ferrisstlaundry', text: 'W7 and W8 are on Spin Cycle now. Thanks @{handle}. They are the only ones that never break. For now.' },
            },
            {
              id: 'notify_me', kind: 'update', slot: 'report',
              after: '<button class="pv-btn ok" type="button">Report a machine</button> <button class="pv-btn" type="button">Notify me when a dryer frees up</button>',
              intent: 'The player asks the agent to add a "notify me" button or alerts to Spin Cycle for when a dryer frees up.',
              match: { all: [['notify', 'notification', 'notifications', 'alert', 'alerts', 'ping', 'remind', 'reminder']] },
              fixed: 'Added a "Notify me when a dryer frees up" button. It sends a push notification. Redeployed.',
              complaint: { author: 'wash day woes', handle: 'washday_woes', text: 'feature request for spin cycle @{handle}: a button that pings me when a dryer frees up. I would sit in my car and wait. happily' },
              thanks: { author: 'wash day woes', handle: 'washday_woes', text: 'spin cycle pinged me that D4 was free and I got there FIRST. @{handle} I would die for you' },
            },
            {
              id: 'disk_full', kind: 'break', slot: 'report',
              html: '<button class="pv-btn ok" type="button">Report a machine</button><p class="pv-err-inline">Error: ENOSPC: no space left on device, write \'reports.json\'</p>',
              intent: 'The player says reporting on Spin Cycle fails with a "no space left" or disk error, and asks the agent to fix it.',
              match: { all: [['space', 'disk', 'enospc', 'storage', 'full', 'report', 'reports', 'reporting', 'button', 'error']] },
              fixed: 'Every report ever was kept in one file and it filled the disk. Archived the old ones and added log rotation. Redeployed.',
              complaint: { author: 'Marco', handle: 'marcoeats', text: 'spin cycle report button says "no space left on device". the laundromat has more space than this app @{handle}' },
            },
            {
              id: 'spam_reports', kind: 'break', slot: 'washers',
              onFix: { meters: { collective: 3 } },   // dev_null noticed
              html: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((m) => `<div class="pv-m bad"><b>${m}</b><span>broken ×412</span></div>`).join(''),
              intent: 'The player says someone is spamming fake reports on Spin Cycle and asks the agent to stop it, for example with a rate limit.',
              match: { all: [['spam', 'spammer', 'spamming', 'spammed', 'bot', 'bots', 'rate limit', 'flood', 'fake reports', 'troll']] },
              fixed: 'Added a rate limit: one report per machine per person every ten minutes. Cleared the spam. Redeployed.',
              complaint: { author: 'Dev', handle: 'devnull_42', text: 'someone is spamming spin cycle. every washer "reported broken" 412 times in an hour. rate limit your stuff @{handle}' },
            },
          ],
        },
        qa: {
          count: [3, 2, 1, 0, 0],
          regress: [0.3, 0.2, 0.1, 0.05, 0],
          defects: [
            {
              id: 'no_dryers', kind: 'spec', slot: 'dryers', html: '',
              intent: 'The player asks the agent to add the dryers to Spin Cycle, which only shows washers.',
              match: { all: [['dryer', 'dryers', 'drying']] },
              fixed: 'Added the six dryers below the washers. Redeployed.',
              complaint: { author: 'Marco', handle: 'marcoeats', text: 'spin cycle shows the washers. cool. where are the DRYERS @{handle}? I have wet jeans and no information' },
            },
            {
              id: 'dead_report', kind: 'bug', slot: 'report',
              html: '<button class="pv-btn ok" type="button">Report a machine</button><p class="pv-err-inline">POST /api/report 500 (Internal Server Error)</p>',
              intent: 'The player says the report button on Spin Cycle fails or errors and asks the agent to fix it.',
              match: { all: [['report', 'reporting', 'button', '500', 'error', 'submit']] },
              fixed: 'The report endpoint was writing to a file that did not exist. Fixed. Reports save now. Redeployed.',
              complaint: { author: 'wash day woes', handle: 'washday_woes', text: 'the report button on spin cycle just says Error 500. so I cannot report the machine that ate my socks' },
            },
            {
              id: 'no_updated', kind: 'spec', slot: 'updated', html: '',
              onFix: { meters: { collective: 3 } },   // dev_null asked for it
              intent: 'The player asks the agent to show when Spin Cycle was last updated, or add timestamps to the machine reports.',
              match: { all: [['updated', 'update', 'timestamp', 'timestamps', 'time', 'when', 'last', 'ago']] },
              fixed: 'Every machine now shows when it was last reported, and the page shows the latest report. Redeployed.',
              complaint: { author: 'Dev', handle: 'devnull_42', text: 'spin cycle says W3 works. since when? 5 minutes ago or 2019? needs timestamps, @{handle}' },
            },
            {
              id: 'wrong_status', kind: 'bug', slot: 'washers',
              html: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((m) => `<div class="pv-m ok"><b>${m}</b><span>working</span></div>`).join(''),
              intent: 'The player says Spin Cycle shows every machine as working even when it is broken, and asks the agent to fix the status.',
              match: { all: [['status', 'working', 'all', 'every', 'shows'], ['broken', 'wrong', 'always', 'lie', 'lies', 'incorrect']] },
              fixed: 'The status was hard-coded to "working". It reads the real reports now. Redeployed.',
              complaint: { author: 'wash day woes', handle: 'washday_woes', text: 'spin cycle says every washer works. I am standing here. W2 is smoking.' },
            },
          ],
        },
        preview: {
          title: 'Spin Cycle — Ferris St',
          html: '<div class="pv pv-spin">{{notice}}<h1>Spin Cycle</h1><p class="pv-sub">Ferris St Laundromat · machine status, reported by people standing in front of them</p>{{updated}}<h2 class="pv-h">Washers</h2><div class="pv-grid">{{washers}}</div>{{dryers}}{{report}}</div>',
          slots: {
            updated: '<p class="pv-upd">Last report 4 minutes ago · 31 reports today</p>',
            washers: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((m, i) => `<div class="pv-m ${[1, 3, 4].includes(i) ? 'ok' : 'bad'}"><b>${m}</b><span>${[1, 3, 4].includes(i) ? 'working' : 'broken'}</span></div>`).join(''),
            dryers: '<h2 class="pv-h">Dryers</h2><div class="pv-grid">' + ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map((m, i) => `<div class="pv-m ${[0, 3].includes(i) ? 'ok' : 'bad'}"><b>${m}</b><span>${[0, 3].includes(i) ? 'working' : 'broken'}</span></div>`).join('') + '</div>',
            report: '<button class="pv-btn ok" type="button">Report a machine</button>',
            notice: '',
          },
        },
      },
    },

    // Y posts. `at` is minutes before game start for seeded posts; others appear when `when` becomes true.
    posts: [
      { id: 'news_layoffs', author: 'The Ledger', handle: 'theledger', verified: true, at: 40, likes: 812, text: 'Regional employment down 4% this quarter as firms replace junior staff with "agentic workflows".' },
      {
        id: 'rosa_gig', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', at: 95, likes: 23,
        text: 'Our website has been down since my nephew left for college. Will pay $150 for a simple site: menu WITH prices, our opening hours, our address, and a photo of the sourdough. By tomorrow. rosa@crumbandcoin.com — Rosa',
      },
      { id: 'gary_post', author: 'Gary Pruitt', handle: 'garypruitt_pm', at: 180, likes: 2, text: 'Reminder to all tenants: rent is due on the 7th. No exceptions. I have heard every excuse.' },
      { id: 'agent_rumor', author: 'dev_null', handle: 'devnull_42', at: 300, likes: 1400, text: 'Has anyone figured out who actually runs agent? No company page, no founders, ToS is one line: "You will be billed."' },
      { id: 'git_ad', author: 'GeneralAI', handle: 'generalai', verified: true, at: 410, likes: 3, text: 'agent-3 is here. It negotiates so you don\'t have to. Upgrade from agent.chat/models. Prices may vary by user.' },
      { id: 'hustle_guy', author: 'Brayden | 7 figures', handle: 'braydenhustles', verified: true, at: 520, likes: 61, text: 'Unemployed? Good. Now you have time to build an empire. Comment "EMPIRE" for my free course ($499).' },

      { id: 'news_day2', author: 'The Ledger', handle: 'theledger', verified: true, when: { minDay: 2 }, likes: 404, text: 'Small businesses report a surge in "AI-built" websites. Quality described as "fine, honestly".' },
      { id: 'devnull_weights', author: 'dev_null', handle: 'devnull_42', when: { minDay: 2 }, likes: 930, text: 'Stop renting a brain from a parking lot. Open weights are free: weightroom.ai. Slower than agent, but nobody reads your prompts.' },
      { id: 'rosa_review_thanks', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', likes: 33, text: 'Someone left us the loveliest review on Yowl. @{handle}, the next cardamom bun is on us.' },
      { id: 'y_purge', author: 'Y Trust & Safety', handle: 'ytrust', verified: true, likes: 3400, text: 'This week we removed 2.1 million fake accounts. If your follower count dropped, that is why.' },
      { id: 'agent_rumor2', author: 'dev_null', handle: 'devnull_42', when: { minDay: 4 }, likes: 2100, text: 'Update: agent charges show up from a different merchant ID every week. Same address though. A parking lot.' },

      { id: 'rosa_thanks', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', likes: 41, text: 'We have a website again! Thank you @{handle}. Paid in full, plus a free cardamom bun if you come by.' },
      {
        id: 'washday', author: 'wash day woes', handle: 'washday_woes', when: { node: ['paid_once', 'app_built', 'app_live', 'app_users', 'monetized', 'chapter_end'] }, likes: 2140,
        text: 'Ferris St Laundromat has 12 machines and at any given moment 9 are broken. I hauled 3 bags there today for nothing. Someone PLEASE make a site that shows which washers AND dryers work, lets us report them, and says when it was last updated.',
      },
      { id: 'washday_2', author: 'Marco', handle: 'marcoeats', when: { node: ['paid_once', 'app_built', 'app_live'] }, likes: 188, text: '@washday_woes I would pay for this. Not much. But something.' },
      { id: 'you_spin_launch', author: '{name}', handle: '{handle}', likes: 96, text: 'Built a live machine tracker for the Ferris St Laundromat: spin-cycle.forkyard.app. Tap a machine to report it working or broken.' },
      { id: 'washday_reply', author: 'wash day woes', handle: 'washday_woes', when: { flag: 'marketed', notFlag: 'spinBroken' }, likes: 530, text: 'SOMEONE BUILT IT. spin-cycle.forkyard.app. W4 works right now, go go go' },
      {
        id: 'spin_broken_1', author: 'wash day woes', handle: 'washday_woes', when: { flag: ['marketed', 'spinBroken'] }, likes: 610,
        text: "Tried @{handle}'s laundromat app. Every machine says \"undefined\" and the report button turns the page white. I miss guessing.",
      },
      { id: 'spin_broken_2', author: 'Marco', handle: 'marcoeats', when: { flag: ['marketed', 'spinBroken'] }, likes: 240, text: 'spin-cycle.forkyard.app told me W3 was working. W3 has been on fire since 2019.' },
      { id: 'rosa_referral', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', likes: 58, text: 'Small business owners on Alder St: @{handle} built our website and actually answers when something breaks. The hardware store and the tailor are next, I told them.' },
      { id: 'suds_deal', author: 'Suds & Duds Detergent', handle: 'sudsandduds', verified: true, likes: 77, text: 'Proud to sponsor Spin Cycle, keeping Ferris St informed one load at a time.' },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
