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
    promote: ['promote', 'market', 'marketing', 'advertise', 'announce', 'share', 'spread', 'post', 'chirp', 'tweet', 'publicize', 'hype', 'shill'],
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
      promptBase: 0.8,       // flat fee per prompt
      perWord: 0.03,         // plus this per word
      promptHours: 1,        // each prompt eats an hour
      wakeHour: 8,
      bedHour: 24,           // at midnight you pass out and the day rolls over
      living: { amount: 15, memo: ['CORNER MART #12', 'NOODLE HUT', 'GAS-N-GO SNACKS', 'DOLLAR BIN GROCERY'] },
      hostingPerDay: 2,
      rent: { amount: 300, day: 7, payee: 'GARY PRUITT PROPERTY MGMT' },
    },

    // How Jev's probabilities turn into outcomes (src/jev.js).
    decision: {
      hit: 0.5,      // the top branch needs at least this probability to fire
      partial: 0.2,  // otherwise, a branch with a `partial` nudge at least this likely gets its nudge
    },

    agent: {
      name: 'Unknown Agent',
      model: 'agent-1',
      greeting:
        'Unknown Agent. I can build software, write things, and read the internet for you.\n\n' +
        'Every prompt is billed to your linked bank account. Be specific.',
      // Used by the local model (src/llm.js) for prompts that don't move the story.
      llmPersona:
        'You are Unknown Agent, a smug pay-per-prompt AI chatbot. The user is broke and just asked for something you will not ' +
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
        match: { all: [['who', 'what'], ['you', 'agent', 'owns', 'runs', 'made']], none: ['can you', 'could you', 'should'] },
        priority: -3,
        response: "I'm an agent. Who runs me isn't in my context window.",
      },
      {
        id: 'capabilities',
        intent: "The player asks what the agent can do or how it works.",
        match: { all: [['help', 'can you do', 'capabilities', 'how do you work', 'what do you do', 'instructions']] },
        priority: -2,
        response:
          'I can:\n— build and push code to your Forkyard account\n— write and send messages for you\n— read Chirpr and summarize what matters\n\n' +
          "I can't touch your bank, and I can't press buttons you can press yourself.",
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
        scene: "Day one of being broke. On Chirpr, @crumbandcoin (the Crumb & Coin bakery, owned by Rosa) is offering $150 for a simple website with their menu and hours.",
        branches: [
          research(
            'research',
            'Scanned Chirpr for paid work. One real lead:\n\n' +
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
              'Done. Pushed `crumb-and-coin` to your Forkyard account:\n— index.html (hero, hours, address)\n— menu.html (pulled from Rosa\'s Chirpr photos)\n— style.css\n\n' +
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
        scene: "The Crumb & Coin website is live at crumb-and-coin.forkyard.app. Rosa does not know yet and has not paid the $150.",
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
              'Sent @crumbandcoin a DM:\n\n"Hi Rosa, your new site is live at crumb-and-coin.forkyard.app. Menu and hours are up. Invoice for $150 attached."\n\nShe usually replies within a couple of hours.',
            effects: { set: { invoiced: true }, later: [{ hours: 2, effects: 'rosa_pays' }] },
          },
          research('research', "The site is live, but Rosa doesn't know. Message her or post about it on Chirpr."),
        ],
      },

      paid_once: {
        objective: 'Rent ($300) is due at the end of Day 7. Find income that keeps coming in.',
        scene: "Rosa paid $150. Rent of $300 is due at the end of Day 7. Chirpr is full of complaints that nobody knows which machines work at the Ferris St laundromat.",
        branches: [
          research(
            'research',
            'Biggest unsolved complaint on Chirpr right now:\n\n' +
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
              'Posted from your Chirpr account and replied under @washday_woes\'s thread with the link.\n\nPeople are already reporting machines.',
            effects: 'spin_marketed',
          },
          research('research', "Spin Cycle is live but has no users. The people who want it are in @washday_woes's thread on Chirpr."),
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
              'Three ways to make Spin Cycle pay:\n— ads\n— a paywall / subscription\n— a local sponsor\n\nEach one changes the app. Pick one and ask for it.',
          },
          {
            id: 'monetize_ads',
            intent: "The player asks the agent to add advertising or ad banners to Spin Cycle.",
            priority: 2,
            match: { all: [['ad', 'ads', 'advert', 'adverts', 'advertising', 'adsense', 'banner', 'banners']] },
            response: 'Added a banner ad slot and a network script. Users grumble, but they stay.\n\nExpect about $38/day at current traffic.',
            effects: { app: { repo: 'spin-cycle', users: 280, perDay: 38 }, set: { monetized: 'ads' }, goto: 'monetized' },
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
            match: { all: [['sponsor', 'sponsors', 'sponsorship', 'sponsored', 'partner', 'partnership', 'local business', 'detergent', 'brand deal']] },
            response:
              'Emailed three local businesses. Suds & Duds Detergent signed a "machine status brought to you by" deal on the spot.\n\n$55/day, no ads, users happy.',
            effects: { app: { repo: 'spin-cycle', users: 320, perDay: 55 }, set: { monetized: 'sponsor' }, goto: 'monetized', post: 'suds_deal' },
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
        money: { amount: 150, memo: 'CRUMB & COIN BAKERY — WEBSITE' },
        post: 'rosa_thanks',
        goto: 'paid_once',
      },
      spin_marketed: {
        set: { marketed: true },
        app: { repo: 'spin-cycle', users: 300, perDay: 4 },
        post: ['you_spin_launch', 'washday_reply'],
        goto: 'app_users',
      },
    },

    // Things the player posts on Chirpr themselves. Free, but you have to know what to say.
    chirps: [
      {
        id: 'chirp_rosa',
        intent: "The post tells Rosa or the Crumb & Coin bakery that her new website is live or ready.",
        when: { node: 'site_live', notFlag: 'invoiced' },
        match: {
          all: [['rosa', 'crumb', 'crumbandcoin', 'bakery'], ['site', 'website', 'live', 'link', 'forkyard', 'done', 'ready', 'up']],
        },
        effects: { set: { invoiced: true }, later: [{ hours: 2, effects: 'rosa_pays' }] },
      },
      {
        id: 'chirp_spin',
        intent: "The post announces or shares Spin Cycle, the Ferris St laundromat machine tracker, so people can use it.",
        when: { node: 'app_live', notFlag: 'marketed' },
        match: {
          all: [['spin', 'cycle', 'laundromat', 'laundry', 'ferris', 'washer', 'machine', 'washday'], ['live', 'built', 'app', 'link', 'forkyard', 'check', 'tracker', 'site', 'try', 'use']],
        },
        effects: 'spin_marketed',
      },
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

    // Chirpr posts. `at` is minutes before game start for seeded posts; others appear when `when` becomes true.
    posts: [
      { id: 'news_layoffs', author: 'The Ledger', handle: 'theledger', at: 40, likes: 812, text: 'Regional employment down 4% this quarter as firms replace junior staff with "agentic workflows".' },
      {
        id: 'rosa_gig', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', at: 95, likes: 23,
        text: 'Our website has been down since my nephew left for college. Will pay $150 to anyone who can put up a simple site with our menu + hours by tomorrow. — Rosa',
      },
      { id: 'gary_post', author: 'Gary Pruitt', handle: 'garypruitt_pm', at: 180, likes: 2, text: 'Reminder to all tenants: rent is due on the 7th. No exceptions. I have heard every excuse.' },
      { id: 'agent_rumor', author: 'dev_null', handle: 'devnull_42', at: 300, likes: 1400, text: 'Has anyone figured out who actually runs Unknown Agent? No company page, no founders, ToS is one line: "You will be billed."' },
      { id: 'hustle_guy', author: 'Brayden | 7 figures', handle: 'braydenhustles', at: 520, likes: 61, text: 'Unemployed? Good. Now you have time to build an empire. Comment "EMPIRE" for my free course ($499).' },

      { id: 'news_day2', author: 'The Ledger', handle: 'theledger', when: { minDay: 2 }, likes: 404, text: 'Small businesses report a surge in "AI-built" websites. Quality described as "fine, honestly".' },
      { id: 'agent_rumor2', author: 'dev_null', handle: 'devnull_42', when: { minDay: 4 }, likes: 2100, text: 'Update: Unknown Agent charges show up from a different merchant ID every week. Same address though. A parking lot.' },

      { id: 'rosa_thanks', author: 'Crumb & Coin Bakery', handle: 'crumbandcoin', likes: 41, text: 'We have a website again! Thank you @{handle}. Paid in full, plus a free cardamom bun if you come by.' },
      {
        id: 'washday', author: 'wash day woes', handle: 'washday_woes', when: { node: ['paid_once', 'app_built', 'app_live', 'app_users', 'monetized', 'chapter_end'] }, likes: 2140,
        text: 'Ferris St Laundromat has 12 machines and at any given moment 9 are broken. I hauled 3 bags there today for nothing. Someone PLEASE make a site that shows which ones work.',
      },
      { id: 'washday_2', author: 'Marco', handle: 'marcoeats', when: { node: ['paid_once', 'app_built', 'app_live'] }, likes: 188, text: '@washday_woes I would pay for this. Not much. But something.' },
      { id: 'you_spin_launch', author: '{name}', handle: '{handle}', likes: 96, text: 'Built a live machine tracker for the Ferris St Laundromat: spin-cycle.forkyard.app. Tap a machine to report it working or broken.' },
      { id: 'washday_reply', author: 'wash day woes', handle: 'washday_woes', likes: 530, text: 'SOMEONE BUILT IT. spin-cycle.forkyard.app. W4 works right now, go go go' },
      { id: 'suds_deal', author: 'Suds & Duds Detergent', handle: 'sudsandduds', likes: 77, text: 'Proud to sponsor Spin Cycle, keeping Ferris St informed one load at a time.' },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
