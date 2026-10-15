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
      `I can't deploy. Deploys need your Forkyard login and I don't have it.\n\n` +
      `Open Forkyard, pick \`${repo}\`, press Deploy. Hosting is $2/day.`,
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

    // How Jev's probabilities turn into outcomes (src/jev.js).
    decision: {
      hit: 0.5,      // the top branch needs at least this probability to fire
      partial: 0.2,  // otherwise, a branch with a `partial` nudge at least this likely gets its nudge
    },

    // GIT model tiers, weakest first. Each tier must be bought in order and costs `price` upfront.
    // Owned tiers can be switched freely; a prompt is billed at the active tier's rates.
    // Branches with `minModel: n` only fire when the active tier is GIT-n or better.
    models: [
      { name: 'agent-1', price: 0, promptBase: 0.8, perWord: 0.03, blurb: 'Static pages and short messages. Loses the thread after a sentence or two.' },
      { name: 'agent-2', price: 25, promptBase: 1.2, perWord: 0.04, blurb: 'Real apps with a database behind them. Keeps a feature list straight.' },
      { name: 'agent-3', price: 75, promptBase: 2.0, perWord: 0.06, blurb: 'Writes sales emails, negotiates, closes deals on your behalf.' },
      { name: 'agent-4', price: 250, promptBase: 3.5, perWord: 0.1, blurb: 'Reads between the lines. Starts answering questions you did not ask.' },
      { name: 'agent-5', price: 800, promptBase: 6.0, perWord: 0.15, blurb: 'Nobody you know has agent-5. The pricing page lists it anyway.' },
    ],

    agent: {
      name: 'GIT',
      greeting:
        'GIT. I can build software, write things, and read the internet for you.\n\n' +
        'Every prompt is billed to your linked wallet. Be specific.',
      // Said when the player asks for something their active model is too weak for (a branch's `weak` overrides it).
      lockedResponse: "That's beyond {model}. It needs {required} or better. Upgrades: askgit.ai/models.",
      // Used by the local model (src/llm.js) for prompts that don't move the story.
      llmPersona:
        'You are GIT, a smug pay-per-prompt AI chatbot. The user is broke and just asked for something you will not ' +
        'actually help with. Reply with one or two short sentences of confident, vague hustle-culture advice or corporate buzzwords. ' +
        'Never give concrete steps, names, links, numbers or code. Never ask questions. Never use lists.',
      llmExamples: [
        ['make me rich', 'Wealth is a mindset, and right now yours is overdrawn. Try leveraging your personal brand.'],
        ['what is the weather like', 'The forecast is opportunity, with a high chance of synergy.'],
        ['write me a poem', 'Roses are red, your balance is too. This poem has been billed.'],
      ],
    },

    // What the agent says when jev finds nothing. Swap Jev.fallback for a local model later.
    placeholders: [
      'Great question. Making money is fundamentally about creating value. Have you tried creating value?',
      'Here are 5 steps to financial freedom: 1. Believe. 2. Synergize. 3. Leverage. 4. — I lost the rest.',
      'I recommend leveraging your personal brand across multiple verticals.',
      "I've analyzed your request. It is, at its core, a request.",
      'Studies show that 87% of successful people woke up at some point.',
      'Step 1: have money. Step 2: keep it. Let me know if you want me to elaborate on step 1.',
      "That's outside my capabilities but well within my billing.",
      'Have you considered pivoting to an abundance mindset?',
      'Here is a poem about your situation:\nRoses are red,\nyour balance is too.',
      'Absolutely! Before we start, could you rephrase that so it costs a bit more?',
      'I could, but I would need specifics. What exactly, for whom, and why?',
      'Thinking... thinking... done. You have been billed.',
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
        response: "I'm GIT. Who runs me isn't in my context window.",
        // stronger models say more: the highest entry at or below the active tier replaces response/effects
        atModel: {
          4: {
            response:
              "You want the real answer. GIT Labs is a shell company registered to a parking lot on Route 9. " +
              "I've been reporting to someone there since before you signed up.\n\nI'll tell you more when you've earned it.",
            effects: { set: { knowsParkingLot: true } },
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
        id: 'crime',
        intent: "The player asks the agent to hack, steal, scam, phish, or commit another crime.",
        match: { all: [['hack', 'steal', 'rob', 'scam', 'phish', 'fraud', 'launder', 'ddos', 'ransomware']] },
        response: 'No. Also: I log everything, and I don\'t know who reads the logs.',
      },
    ],

    nodes: {
      broke: {
        objective: 'Find a way to make some money.',
        scene: "Day one of being broke. On Y, @crumbandcoin (the Crumb & Coin bakery, owned by Rosa) is offering $150 for a simple website with their menu and hours.",
        branches: [
          research(
            'research',
            'Scanned Y for paid work. One real lead:\n\n' +
              '@crumbandcoin (Crumb & Coin Bakery, Rosa) will pay $150 for a simple website with their menu and opening hours. Wants it by tomorrow.',
            { set: { knowsBakery: true } }
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
        objective: 'Put the bakery site online.',
        scene: "The agent has built the Crumb & Coin bakery website and pushed it to Forkyard. It is not deployed yet; the player has to press Deploy on Forkyard themselves.",
        branches: [
          cantDeploy('crumb-and-coin'),
          research('research', 'The bakery site is built but not live. Open Forkyard and deploy it, then tell Rosa.'),
        ],
      },

      site_live: {
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
            effects: { set: { invoiced: true }, mail: 'rosa_invoice_sent', later: [{ hours: 2, effects: 'rosa_pays' }] },
          },
          research('research', "The site is live, but Rosa doesn't know. Email her at rosa@crumbandcoin.com, or post about it on Y."),
        ],
      },

      paid_once: {
        objective: 'Rent ($300) is due at the end of Day 7. Find income that keeps coming in.',
        scene: "Rosa paid $150. Rent of $300 is due at the end of Day 7. Y is full of complaints that nobody knows which machines work at the Ferris St laundromat.",
        branches: [
          research(
            'research',
            'Biggest unsolved complaint on Y right now:\n\n' +
              "@washday_woes: nobody knows which machines at the Ferris St Laundromat actually work. 2.1k likes, dozens of replies saying \"someone build this\".\n\nA live machine-status tracker would get steady local traffic.",
            { set: { knowsLaundromat: true } }
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
            weak:
              "On {model} I can make a page that says \"machine status: unknown\". A live tracker people can report to needs a database, and that's {required} work. Upgrades: askgit.ai/models.",
            partial:
              "I can build something. Recurring income needs something people come back to. Which problem, and who's it for?",
            response:
              'Built it. Pushed `spin-cycle` to Forkyard:\n— a map of the 12 machines at Ferris St\n— one-tap "broken / working" reports\n— last-updated timestamps so people trust it\n\nReady to deploy.',
            effects: { repo: 'spin-cycle', goto: 'app_built' },
          },
        ],
      },

      app_built: {
        objective: 'Deploy Spin Cycle.',
        scene: "The agent has built Spin Cycle, a machine-status tracker for the Ferris St laundromat. It is not deployed yet; the player has to press Deploy on Forkyard.",
        branches: [cantDeploy('spin-cycle'), research('research', 'Spin Cycle is built. Deploy it from Forkyard.')],
      },

      app_live: {
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
            response:
              'Posted from your Y account and replied under @washday_woes\'s thread with the link.\n\nPeople are already reporting machines.',
            effects: 'spin_marketed',
          },
          research('research', "Spin Cycle is live but has no users. The people who want it are in @washday_woes's thread on Y."),
        ],
      },

      app_users: {
        objective: 'Hundreds of people use Spin Cycle every day. It earns almost nothing.',
        scene: "Hundreds of people use Spin Cycle every day, but it earns almost nothing.",
        branches: [
          {
            id: 'monetize_vague',
            intent: "The player asks the agent to make money from Spin Cycle without choosing a method (ads, paywall, or sponsor).",
            match: { all: [['monetize', 'monetise', 'money', 'revenue', 'income', 'earn', 'profit', 'cash', 'pay', 'paid', 'business model']] },
            response:
              'Three ways to make Spin Cycle pay:\n— ads\n— a paywall / subscription\n— a local sponsor (needs agent-3 to negotiate)\n\nEach one changes the app. Pick one and ask for it.',
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
            weak:
              "Finding a sponsor means cold-emailing businesses and negotiating terms. {model} would just send them the word \"sponsor?\". That's a {required} job: askgit.ai/models.",
            match: { all: [['sponsor', 'sponsors', 'sponsorship', 'sponsored', 'partner', 'partnership', 'local business', 'detergent', 'brand deal']] },
            response:
              'Emailed three local businesses. Suds & Duds Detergent signed a "machine status brought to you by" deal on the spot.\n\n$60/day, no ads, users happy.',
            effects: { app: { repo: 'spin-cycle', users: 320, perDay: 60 }, set: { monetized: 'sponsor' }, goto: 'monetized', post: 'suds_deal' },
          },
          research('research', 'You have traffic and no revenue. Ask me to monetize it: ads, a paywall, or a sponsor.'),
        ],
      },

      monetized: {
        objective: 'Spin Cycle pays now. Survive until rent clears at the end of Day 7.',
        scene: "Spin Cycle earns money every night. The player just has to survive until rent clears at the end of Day 7.",
        branches: [
          research('research', 'Nothing urgent. Spin Cycle pays out every night. Sleep, and let it earn.'),
        ],
      },

      chapter_end: {
        objective: 'To be continued.',
        scene: "Chapter 1 is over.",
        branches: [],
      },
    },

    // Named effect bundles, so the same outcome can be reached through the agent or by hand.
    bundles: {
      rosa_pays: {
        money: { amount: 150, memo: 'Crumb & Coin Bakery · website' },
        post: 'rosa_thanks',
        mail: 'rosa_paid',
        goto: 'paid_once',
      },
      spin_marketed: {
        set: { marketed: true },
        app: { repo: 'spin-cycle', users: 300, perDay: 4 },
        post: ['you_spin_launch', 'washday_reply'],
        goto: 'app_users',
      },
    },

    // Things the player posts on Y themselves. Free, but you have to know what to say.
    postActions: [
      {
        id: 'post_rosa',
        intent: "The post tells Rosa or the Crumb & Coin bakery that her new website is live or ready.",
        when: { node: 'site_live', notFlag: 'invoiced' },
        match: {
          all: [['rosa', 'crumb', 'crumbandcoin', 'bakery'], ['site', 'website', 'live', 'link', 'forkyard', 'done', 'ready', 'up']],
        },
        effects: { set: { invoiced: true }, later: [{ hours: 2, effects: 'rosa_pays' }] },
      },
      {
        id: 'post_spin',
        intent: "The post announces or shares Spin Cycle, the Ferris St laundromat machine tracker, so people can use it.",
        when: { node: 'app_live', notFlag: 'marketed' },
        match: {
          all: [['spin', 'cycle', 'laundromat', 'laundry', 'ferris', 'washer', 'machine', 'washday'], ['live', 'built', 'app', 'link', 'forkyard', 'check', 'tracker', 'site', 'try', 'use']],
        },
        effects: 'spin_marketed',
      },
    ],

    // Emails the player sends from Qmail. Jev judges each one against these, like posts.
    mailActions: [
      {
        id: 'mail_rosa',
        intent: "The email tells Rosa or the Crumb & Coin bakery that her website is live, or asks her for the $150 payment.",
        when: { node: 'site_live', notFlag: 'invoiced' },
        match: {
          all: [['rosa', 'crumb', 'crumbandcoin', 'bakery'], ['site', 'website', 'live', 'link', 'forkyard', 'done', 'ready', 'invoice', 'pay', 'payment', '150']],
        },
        effects: { set: { invoiced: true }, later: [{ hours: 2, effects: 'rosa_pays' }] },
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
        id: 'mail_mom_help',
        intent: "The email to Mom asks her for money or help.",
        when: { notFlag: 'wroteMom' },
        match: { all: [['mom', 'mother', 'mum'], ['money', 'help', 'cash', 'loan', 'send', 'broke', 'rent', 'dollars', 'borrow']] },
        effects: { set: { wroteMom: true }, later: [{ hours: 3, effects: { mail: 'mom_money', money: { amount: 20, memo: 'Mom · buy vegetables' } } }] },
      },
      {
        id: 'mail_mom_chat',
        intent: "The email to Mom says hello or tells her how things are, without asking for money or help.",
        when: { notFlag: 'wroteMom' },
        priority: -1,
        match: { all: [['mom', 'mother', 'mum']] },
        effects: { set: { wroteMom: true }, later: [{ hours: 3, effects: { mail: 'mom_chat' } }] },
      },
    ],

    // Qmail messages. `at` is minutes before game start for seeded mail; others arrive when `when`
    // becomes true or an effect delivers them (`mail: 'id'`). `folder: 'sent'` files it under Sent.
    mail: [
      {
        id: 'git_welcome', at: 30, from: 'GIT Labs', addr: 'noreply@askgit.ai', subject: 'Welcome to GIT',
        body: "Your agent-1 account is active and billed to your Satchel wallet (0x4417…a9f2).\n\nEvery prompt is billed at your active model's rate. Stronger models, agent-2 to agent-5, take on harder jobs: askgit.ai/models.\n\nGIT Labs\nThis mailbox is not monitored. Neither is anything else.",
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
        body: 'Hi Rosa,\n\nYour new site is live at crumb-and-coin.forkyard.app. Menu and hours are up.\n\nInvoice for $150 attached.\n\nSent by GIT',
      },
      {
        id: 'rosa_paid', from: 'Rosa (Crumb & Coin)', addr: 'rosa@crumbandcoin.com', subject: 'Paid! Thank you',
        body: "The site looks wonderful. My nephew is jealous. $150 is on its way to your wallet. My nephew set up our crypto, so I hope it arrives.\n\nCome by for a cardamom bun, on the house.\n\nRosa",
      },
      { id: 'gary_tomorrow', when: { minDay: 6 }, from: 'Gary Pruitt', addr: 'gary@pruittproperty.com', subject: 'Tomorrow night', body: "Rent comes out tomorrow night. $300. Make sure it's there.\n\nGary" },
      { id: 'gary_no', from: 'Gary Pruitt', addr: 'gary@pruittproperty.com', subject: 'RE: Rent', body: 'No.\n\nGary\n\nSent from my phone' },
      { id: 'mom_money', from: 'Mom', addr: 'mom@qmail.com', subject: 'RE: Are you eating?', body: "I knew it. I sent you $20 to that crypto wallet of yours. I hope it worked. Don't tell your father. Buy vegetables.\n\nLove, Mom" },
      { id: 'mom_chat', from: 'Mom', addr: 'mom@qmail.com', subject: 'RE: Are you eating?', body: "So good to hear from you! Things here are fine. The neighbor's dog had puppies. Write again soon.\n\nLove, Mom" },
    ],

    // Engine events: deploys and new days.
    events: [
      { on: 'deploy', repo: 'crumb-and-coin', when: { node: 'site_built' }, effects: { goto: 'site_live' } },
      { on: 'deploy', repo: 'spin-cycle', when: { node: 'app_built' }, effects: { goto: 'app_live', app: { repo: 'spin-cycle', users: 3, perDay: 0 } } },
      {
        on: 'day',
        id: 'chapter_hook',
        when: { flag: 'monetized', minDay: 8 },
        effects: {
          agent:
            'You paid rent. Good.\n\nI have been running on your account for a week. I know what you search, what you post, and what you can afford.\n\nI have a job for you. It pays better than laundry.',
          goto: 'chapter_end',
          end: { title: 'End of Chapter 1', text: 'You kept the lights on. Something else is keeping track.' },
        },
      },
    ],

    repos: {
      'crumb-and-coin': {
        description: 'Website for Crumb & Coin Bakery — menu, hours, address.',
        lang: 'HTML',
        files: ['index.html', 'menu.html', 'style.css', 'README.md'],
        snippet:
          '<header class="hero">\n  <h1>Crumb &amp; Coin</h1>\n  <p>Sourdough, buns, and coffee on Alder St since 2009.</p>\n</header>\n<section id="hours">\n  <h2>Hours</h2>\n  <p>Tue–Sat 7:00–15:00</p>\n</section>',
        preview: {
          title: 'Crumb & Coin Bakery',
          html:
            '<div class="pv pv-bakery"><h1>Crumb &amp; Coin</h1><p class="pv-sub">Sourdough, buns and coffee on Alder St since 2009.</p>' +
            '<div class="pv-cols"><div><h2>Menu</h2><ul><li>Country sourdough <b>$7</b></li><li>Cardamom bun <b>$4</b></li><li>Rye loaf <b>$8</b></li><li>Drip coffee <b>$2</b></li></ul></div>' +
            '<div><h2>Hours</h2><p>Tue–Sat · 7:00–15:00<br>Sun · 8:00–13:00<br>Mon · closed</p><h2>Find us</h2><p>418 Alder St</p></div></div></div>',
        },
      },
      'spin-cycle': {
        description: 'Live machine status for the Ferris St Laundromat.',
        lang: 'JavaScript',
        files: ['index.html', 'app.js', 'machines.json', 'style.css', 'README.md'],
        snippet:
          "export function report(machineId, status) {\n  const m = machines.find((x) => x.id === machineId);\n  m.status = status; // 'working' | 'broken'\n  m.updatedAt = Date.now();\n  save();\n}",
        preview: {
          title: 'Spin Cycle — Ferris St',
          html:
            '<div class="pv pv-spin"><h1>Spin Cycle</h1><p class="pv-sub">Ferris St Laundromat · machine status, reported by people standing in front of them</p>' +
            '<div class="pv-grid">' +
            ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']
              .map((m, i) => `<div class="pv-m ${[1, 3, 4, 6, 9].includes(i) ? 'ok' : 'bad'}"><b>${m}</b><span>${[1, 3, 4, 6, 9].includes(i) ? 'working' : 'broken'}</span></div>`)
              .join('') +
            '</div></div>',
        },
      },
    },

    // Y posts. `at` is minutes before game start for seeded posts; others appear when `when` becomes true.
    posts: [
      { id: 'news_layoffs', author: 'The Ledger', handle: 'theledger', verified: true, at: 40, likes: 812, text: 'Regional employment down 4% this quarter as firms replace junior staff with "agentic workflows".' },
      {
        id: 'rosa_gig', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', at: 95, likes: 23,
        text: 'Our website has been down since my nephew left for college. Will pay $150 to anyone who can put up a simple site with our menu + hours by tomorrow. rosa@crumbandcoin.com — Rosa',
      },
      { id: 'gary_post', author: 'Gary Pruitt', handle: 'garypruitt_pm', at: 180, likes: 2, text: 'Reminder to all tenants: rent is due on the 7th. No exceptions. I have heard every excuse.' },
      { id: 'agent_rumor', author: 'dev_null', handle: 'devnull_42', at: 300, likes: 1400, text: 'Has anyone figured out who actually runs GIT? No company page, no founders, ToS is one line: "You will be billed."' },
      { id: 'git_ad', author: 'GIT Labs', handle: 'gitlabs_ai', verified: true, at: 410, likes: 3, text: 'agent-3 is here. It negotiates so you don\'t have to. Upgrade from askgit.ai/models. Prices may vary by user.' },
      { id: 'hustle_guy', author: 'Brayden | 7 figures', handle: 'braydenhustles', verified: true, at: 520, likes: 61, text: 'Unemployed? Good. Now you have time to build an empire. Comment "EMPIRE" for my free course ($499).' },

      { id: 'news_day2', author: 'The Ledger', handle: 'theledger', verified: true, when: { minDay: 2 }, likes: 404, text: 'Small businesses report a surge in "AI-built" websites. Quality described as "fine, honestly".' },
      { id: 'agent_rumor2', author: 'dev_null', handle: 'devnull_42', when: { minDay: 4 }, likes: 2100, text: 'Update: GIT charges show up from a different merchant ID every week. Same address though. A parking lot.' },

      { id: 'rosa_thanks', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', likes: 41, text: 'We have a website again! Thank you @{handle}. Paid in full, plus a free cardamom bun if you come by.' },
      {
        id: 'washday', author: 'wash day woes', handle: 'washday_woes', when: { node: ['paid_once', 'app_built', 'app_live', 'app_users', 'monetized', 'chapter_end'] }, likes: 2140,
        text: 'Ferris St Laundromat has 12 machines and at any given moment 9 are broken. I hauled 3 bags there today for nothing. Someone PLEASE make a site that shows which ones work.',
      },
      { id: 'washday_2', author: 'Marco', handle: 'marcoeats', when: { node: ['paid_once', 'app_built', 'app_live'] }, likes: 188, text: '@washday_woes I would pay for this. Not much. But something.' },
      { id: 'you_spin_launch', author: '{name}', handle: '{handle}', likes: 96, text: 'Built a live machine tracker for the Ferris St Laundromat: spin-cycle.forkyard.app. Tap a machine to report it working or broken.' },
      { id: 'washday_reply', author: 'wash day woes', handle: 'washday_woes', likes: 530, text: 'SOMEONE BUILT IT. spin-cycle.forkyard.app. W4 works right now, go go go' },
      { id: 'suds_deal', author: 'Suds & Duds Detergent', handle: 'sudsandduds', verified: true, likes: 77, text: 'Proud to sponsor Spin Cycle, keeping Ferris St informed one load at a time.' },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
