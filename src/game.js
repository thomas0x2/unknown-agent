/*
 * Unknown Agent — engine and UI. The in-game chatbot is just called agent.
 * Reads window.STORY (story.js) and asks window.Jev (jev.js) which branch a prompt hits.
 */
(function () {
  'use strict';

  const S = window.STORY;
  const J = window.Jev;          // story decisions (TypeSafe Jev, via server.mjs)
  const K = window.Keywords;     // offline keyword matcher, also used for word counts
  const LLM = window.LocalLLM || null;
  const M = window.Meters;       // pressure meters, derived flags, endings
  const E = S.economy;
  const SAVE_KEY = 'unknown-agent-save-v1';
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const SITES = {
    y: { label: 'Y', url: 'y.com' },
    mail: { label: 'Qmail', url: 'qmail.com' },
    wallet: { label: 'Satchel', url: 'satchel.app' },
    forkyard: { label: 'Forkyard', url: 'forkyard.com' },
    agent: { label: 'agent', url: 'agent.chat' },
    yowl: { label: 'Yowl', url: 'yowl.com' },
  };

  let state = null;
  let lastReport = null;     // the last decision (Jev probabilities or keyword scores), for the dev panel
  let anim = null;           // { idx, shown, timer } typewriter for the newest agent message
  let busy = false;          // agent is "thinking"
  let devOpen = false;
  let draft = null;          // the Qmail message being written: { to, subject, body }

  // ───────────────────────── utils ─────────────────────────

  const $ = (sel, root) => (root || document).querySelector(sel);
  const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
  const round2 = (n) => Math.round(n * 100) / 100;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtMoney(n) {
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '−$' : '$') + s;
  }
  // Satchel holds DOLR, a stablecoin pegged 1:1 to the dollar.
  function fmtCoin(n) {
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? '−' : ''}${s} DOLR`;
  }
  const WALLET_ADDR = '0x4417c3e8b1d05f2a9e6d7b0c1f83a4e5d2b9a9f2';
  const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const dayOf = (t) => Math.floor(t / 1440) + 1;
  const hourOf = (t) => (t % 1440) / 60;
  function clock(t) {
    const m = ((t % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  const weekday = (t) => DAYS[(dayOf(t) - 1 + 7 * 100) % 7];
  const stamp = (t) => `Day ${dayOf(t)} · ${clock(t)}`;
  function ago(t) {
    const d = state.t - t;
    if (d < 1) return 'now';
    if (d < 60) return d + 'm';
    if (d < 1440) return Math.floor(d / 60) + 'h';
    return Math.floor(d / 1440) + 'd';
  }
  function tpl(s, extra) {
    const vars = Object.assign({
      balance: fmtMoney(state.money),
      lastCost: fmtMoney(state.lastCost || 0),
      handle: S.start.player.handle,
      name: S.start.player.name,
      model: modelDef(state.model).name,
    }, extra);
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }
  function richText(s) {
    return esc(tpl(s))
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
  function hashHue(s) {
    let h = 0;
    for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0;
    return h % 360;
  }
  function avatar(name, handle) {
    const initials = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    return `<div class="av" style="--h:${hashHue(handle)}">${esc(initials)}</div>`;
  }

  // ───────────────────────── state ─────────────────────────

  function newState() {
    const st = S.start;
    const t = (st.day - 1) * 1440 + st.hour * 60;
    const s = {
      v: 1, t, money: st.money, node: st.node,
      flags: {}, repos: {}, apps: {}, posts: {}, userPosts: [], liked: {},
      tx: [
        { t: t - 4300, amount: 212, memo: 'State Unemployment Office · final payment' },
        { t: t - 2870, amount: -89.5, memo: 'Pruitt Property Mgmt · late fee' },
        { t: t - 1490, amount: -41.33, memo: 'City Utilities' },
        { t: t - 610, amount: -18, memo: 'Noodle Hut' },
      ],
      chat: [{ from: 'agent', text: S.agent.greeting, t }],
      queue: [], fired: {},
      stats: { prompts: 0, promptSpend: 0, misses: 0, partials: 0, locked: 0, upgradeSpend: 0 },
      model: 1,   // active model tier (agent-1 … agent-5)
      owned: 1,   // highest tier bought
      unread: { y: 0, wallet: 0, forkyard: 0, agent: 0 },
      tabs: [{ id: 1, url: SITES.y.url }, { id: 2, url: SITES.agent.url }],
      mail: [],      // Qmail: { id, t, read, folder, custom? }
      nextMail: 1,
      followers: (S.y && S.y.startFollowers) || 0,   // on Y
      meters: M.init(S),   // pressure meters (story.meters), money and followers aside
      meterLog: [],        // recent meter changes, for the dev panel
      discovered: [],      // hidden sites (story.sites) the player has found, in order
      local: { models: [], files: [] },   // what's on the laptop
      term: { lines: [], running: null }, // Terminal scrollback and the loaded model
      bought: [],          // Cellar listings purchased
      readThreads: [],     // nullboard threads opened
      reviews: {},         // Yowl: business id → the player's review { stars, text, t }
      extraPosts: [],   // Y posts the engine writes (complaints about defects)
      creatorOn: false, // Y creator payouts switched on
      postsToday: { day: 0, n: 0 },
      awaiting: {},     // address → true while you wait on their reply
      replyDrafts: {},  // reply id → body written in advance by the local model
      active: 2, nextTab: 3, lastCost: 0,
      ended: null, endSeen: false, over: null, morning: null,
    };
    for (const p of S.posts) if (p.at != null) s.posts[p.id] = t - p.at;
    s.unread.y = Object.keys(s.posts).length;
    seedMail(s);
    return s;
  }

  function seedMail(s) {
    for (const m of S.mail || []) {
      if (m.at != null) s.mail.push({ id: m.id, t: s.t - m.at, read: !!m.read || m.folder === 'sent', folder: m.folder || 'inbox' });
    }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return null;
      // saves from before model tiers
      if (!s.model) { s.model = 1; s.owned = 1; }
      s.stats.locked = s.stats.locked || 0;
      s.stats.upgradeSpend = s.stats.upgradeSpend || 0;
      for (const tab of s.tabs) if (/^(unknownagent|askgit)\.ai/.test(tab.url)) tab.url = tab.url.replace(/^(unknownagent|askgit)\.ai/, 'agent.chat');
      // saves from before Y and Qmail
      for (const tab of s.tabs) if (/^chirpr\.com/.test(tab.url)) tab.url = 'y.com';
      if (s.unread.chirpr != null) { s.unread.y = s.unread.chirpr; delete s.unread.chirpr; }
      for (const k of Object.keys(s.fired)) {
        if (k.startsWith('chirp:chirp_')) { s.fired['post:post_' + k.slice(12)] = s.fired[k]; delete s.fired[k]; }
      }
      if (!s.mail) { s.mail = []; s.nextMail = 1; seedMail(s); }
      s.awaiting = s.awaiting || {};
      s.extraPosts = s.extraPosts || [];
      for (const r of Object.values(s.repos)) { r.defects = r.defects || []; r.complained = r.complained || []; r.slots = r.slots || {}; }
      if (s.followers == null) { s.followers = (S.y && S.y.startFollowers) || 0; s.creatorOn = false; s.postsToday = { day: 0, n: 0 }; }
      s.replyDrafts = s.replyDrafts || {};
      // saves from before the pressure meters
      s.meters = Object.assign(M.init(S), s.meters || {});
      s.meterLog = s.meterLog || [];
      // saves from before hidden sites
      s.discovered = s.discovered || [];
      s.local = s.local || { models: [], files: [] };
      s.term = s.term || { lines: [], running: null };
      s.bought = s.bought || [];
      s.readThreads = s.readThreads || [];
      s.reviews = s.reviews || {};
      // saves from before the wallet
      for (const tab of s.tabs) if (/^secondnational\.com/.test(tab.url)) tab.url = 'satchel.app';
      if (s.unread.bank != null) { s.unread.wallet = s.unread.bank; delete s.unread.bank; }
      return s;
    } catch (e) { return null; }
  }

  function check(c) {
    if (!c) return true;
    // flags with a `when` in story.flags are derived from it
    if (c.flag && !arr(c.flag).every((f) => M.flag(state, S, f, check))) return false;
    if (c.notFlag && arr(c.notFlag).some((f) => M.flag(state, S, f, check))) return false;
    if (c.meters && !M.test(state, S, c.meters)) return false;
    if (c.discovered && !arr(c.discovered).every((id) => state.discovered.includes(id))) return false;
    if (c.node && !arr(c.node).includes(state.node)) return false;
    if (c.repo && !arr(c.repo).every((r) => state.repos[r])) return false;
    if (c.deployed && !arr(c.deployed).every((r) => state.repos[r] && state.repos[r].deployed)) return false;
    if (c.minDay && dayOf(state.t) < c.minDay) return false;
    if (c.minMoney != null && state.money < c.minMoney) return false;
    // openDefects: repo (or true for any repo) has unfixed defects; noDefects: repo is clean
    if (c.openDefects != null) {
      const repos = c.openDefects === true ? Object.keys(state.repos) : arr(c.openDefects);
      if (!repos.some((r) => openDefects(r).length)) return false;
    }
    if (c.noDefects && arr(c.noDefects).some((r) => openDefects(r).length)) return false;
    return true;
  }

  // the tier doing the work right now: agent's active model, or a local model while it runs
  let levelOverride = null;
  const workLevel = () => levelOverride || state.model;

  const currentNode = () => S.nodes[state.node] || { objective: '', branches: [] };
  const modelDef = (level) => S.models[Math.min(Math.max(level, 1), S.models.length) - 1];

  // ───────────────────────── effects ─────────────────────────

  function addTx(amount, memo) {
    amount = round2(amount);
    state.money = round2(state.money + amount);
    state.tx.push({ t: state.t, amount, memo });
    if (!onSite('wallet')) state.unread.wallet++;
  }

  function onSite(site) {
    const tab = state.tabs.find((x) => x.id === state.active);
    return tab && route(tab.url).site === site;
  }

  function revealPost(id) {
    if (state.posts[id] != null) return;
    state.posts[id] = state.t;
    if (!onSite('y')) state.unread.y++;
  }

  // Also delivers mail whose `when` has come true.
  function revealPosts() {
    for (const p of S.posts) {
      if (p.at == null && p.when && state.posts[p.id] == null && check(p.when)) revealPost(p.id);
    }
    for (const m of S.mail || []) {
      if (m.at == null && m.when && check(m.when)) deliverMail(m.id);
    }
  }

  // ── Qmail ──
  const playerAddr = () => `${S.start.player.handle}@qmail.com`;
  const mailDef = (entry) => entry.custom || (S.mail || []).find((m) => m.id === entry.id) || {};
  const unreadMail = () => state.mail.filter((m) => m.folder === 'inbox' && !m.read).length;
  const badgeCount = (site) => (site === 'mail' ? unreadMail() : state.unread[site] || 0);

  function deliverMail(id) {
    if (state.mail.some((m) => m.id === id)) return;
    const def = (S.mail || []).find((m) => m.id === id);
    if (!def) { console.warn('Unknown mail', id); return; }
    const folder = def.folder || 'inbox';
    state.mail.push({ id, t: state.t, read: folder === 'sent', folder });
    noteMail(def, folder);
    if (folder === 'inbox') toast('Qmail', `${tpl(def.from)}: ${tpl(def.subject)}`, 'mail');
  }

  // One message per address between replies: sending opens a wait, any mail from them closes it.
  function noteMail(def, folder) {
    if (folder === 'sent' && def.to) state.awaiting[def.to] = true;
    if (folder === 'inbox' && def.addr) delete state.awaiting[def.addr];
  }

  // Mail the engine writes itself (receipts, bounces) or the player sends.
  function deliverCustom(custom, folder) {
    folder = folder || 'inbox';
    const entry = { id: 'c' + state.nextMail++, t: state.t, read: folder === 'sent', folder, custom };
    state.mail.push(entry);
    noteMail(custom, folder);
    if (folder === 'inbox') toast('Qmail', `${custom.from}: ${custom.subject}`, 'mail');
    return entry;
  }

  // Addresses the player could know about: everyone who has written, plus addresses posted publicly.
  function contacts() {
    const set = new Set();
    for (const e of state.mail) {
      const d = mailDef(e);
      if (d.addr && !/no-?reply|mailer-daemon/.test(d.addr)) set.add(d.addr);
      if (d.to) set.add(d.to);
    }
    if (state.posts.rosa_gig != null) set.add('rosa@crumbandcoin.com');
    return [...set].sort();
  }

  function agentSays(text, src) {
    state.chat.push({ from: 'agent', text, t: state.t, src: src || 'event' });
    if (!onSite('agent')) {
      state.unread.agent++;
      toast('agent', 'sent you a message', 'agent');
    }
  }

  function applyEffects(fx) {
    if (!fx) return;
    if (typeof fx === 'string') {
      if (!S.bundles || !S.bundles[fx]) { console.warn('Unknown effect bundle', fx); return; }
      fx = S.bundles[fx];
    }
    if (fx.set) Object.assign(state.flags, fx.set);
    if (fx.money != null) {
      const m = typeof fx.money === 'number' ? { amount: fx.money, memo: 'Transfer' } : fx.money;
      addTx(m.amount, m.memo);
      toast('Satchel', `${m.amount >= 0 ? '+' : ''}${fmtCoin(m.amount)} · ${m.memo}`, 'wallet');
    }
    // repo: 'name', or { name, broken: true } for code a too-weak model botched
    for (const r of arr(fx.repo)) {
      const name = typeof r === 'string' ? r : r.name;
      if (state.repos[name]) continue;
      state.repos[name] = { createdAt: state.t, deployed: false, broken: !!(r && r.broken), defects: [], complained: [], slots: {} };
      rollDefects(name, workLevel(), (S.repos[name] && S.repos[name].qa && S.repos[name].qa.count) || null);
      if (!onSite('forkyard')) state.unread.forkyard++;
      toast('Forkyard', `New repository: ${name}`, 'forkyard');
    }
    for (const name of arr(fx.fix)) {
      if (!state.repos[name]) continue;
      state.repos[name].broken = false;
      state.repos[name].fixedAt = state.t;
      toast('Forkyard', `New commit on ${name}: rewrite`, 'forkyard');
    }
    if (fx.app) state.apps[fx.app.repo] = { users: fx.app.users || 0, perDay: fx.app.perDay || 0, label: fx.app.label };
    // appScale: { repo, factor } — users drift away (or pile in); income follows
    if (fx.appScale && state.apps[fx.appScale.repo]) {
      const a = state.apps[fx.appScale.repo];
      a.users = Math.round(a.users * fx.appScale.factor);
      a.perDay = round2(a.perDay * fx.appScale.factor);
    }
    if (fx.followers) changeFollowers(fx.followers);
    if (fx.meters) {
      for (const ch of M.apply(state, S, fx.meters)) state.meterLog.push({ t: state.t, ...ch });
      state.meterLog = state.meterLog.slice(-30);
    }
    if (fx.fixDefect) fixDefect(fx.fixDefect.repo, fx.fixDefect.id);
    for (const name of arr(fx.complain)) complain(name);
    // choose: the first option whose `when` holds runs
    if (fx.choose) {
      const pick = fx.choose.find((o) => check(o.when));
      if (pick) applyEffects(pick.effects);
    }
    for (const id of arr(fx.post)) revealPost(id);
    for (const id of arr(fx.mail)) deliverMail(id);
    if (fx.agent) agentSays(fx.agent);
    for (const l of arr(fx.later)) state.queue.push({ at: laterTime(l), effects: l.effects });
    if (fx.reply) deliverReply(fx.reply);
    for (const id of arr(fx.unlock)) discover(id);
    // file: a text file lands on the laptop (readable with `cat` in the Terminal)
    for (const f of arr(fx.file)) {
      if (!state.local.files.some((x) => x.name === f.name)) state.local.files.push({ name: f.name, text: f.text });
      discover('terminal');
      toast('Downloads', `${f.name} saved to your laptop`, 'note');
    }
    // localModel: weights land on the laptop without a Weightroom download
    for (const id of arr(fx.localModel)) {
      if (state.local.models.includes(id)) continue;
      state.local.models.push(id);
      fireEvents('download', id);
    }
    if (fx.thank) clientSays(fx.thank.repo, defectDef(fx.thank.repo, fx.thank.id).thanks);
    if (fx.goto && fx.goto !== state.node) {
      state.node = fx.goto;
      const obj = currentNode().objective;
      if (obj) toast('New objective', obj, 'note');
    }
    if (fx.end) state.ended = fx.end;
    // ending: true plays the ending the meters point to (story.endings)
    if (fx.ending) {
      const e = M.ending(S, check);
      if (e) {
        state.flags.ending = e.id;
        applyEffects(e.effects);
        state.ended = { title: e.title, text: e.text, open: e.open };
      }
    }
    revealPosts();
  }

  // ── QA: defects agent ships, and the loop of checking and fixing them ──
  const qaOf = (repo) => (S.repos[repo] && S.repos[repo].qa) || null;
  const upkeepOf = (repo) => (S.repos[repo] && S.repos[repo].upkeep) || null;
  // QA defects and upkeep issues share one id space per repo
  const defectDef = (repo, id) => [...((qaOf(repo) || {}).defects || []), ...((upkeepOf(repo) || {}).issues || [])].find((d) => d.id === id);
  const openDefects = (repo) => (state.repos[repo] && state.repos[repo].defects) || [];
  // what stops an app paying: everything open except update requests
  const blockingDefects = (repo) => openDefects(repo).filter((id) => (defectDef(repo, id) || {}).kind !== 'update');

  // Ship `count[tier]` random defects from the repo's pool, avoiding `exclude`.
  function rollDefects(repo, level, count, exclude) {
    const qa = qaOf(repo);
    if (!qa || !state.repos[repo]) return;
    const n = typeof count === 'number' ? count : (qa.count || [])[Math.min(level, qa.count.length) - 1] || 0;
    const pool = qa.defects.map((d) => d.id).filter((id) => !openDefects(repo).includes(id) && !(exclude || []).includes(id));
    for (let i = 0; i < n && pool.length; i++) {
      const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      state.repos[repo].defects.push(id);
    }
  }

  // Fix one defect. Weaker models sometimes break something else while they're at it.
  function fixDefect(repo, id) {
    const r = state.repos[repo];
    if (!r || !r.defects.includes(id)) return;
    r.defects = r.defects.filter((x) => x !== id);
    r.complained = (r.complained || []).filter((x) => x !== id);
    const d = defectDef(repo, id) || {};
    // an update changes the app for good
    if (d.after != null && d.slot) r.slots[d.slot] = d.after;
    if (d.onFix) applyEffects(d.onFix);
    if (d.thanks) state.queue.push({ at: laterTime({ hours: [1, 3] }), effects: { thank: { repo, id } } });
    const qa = qaOf(repo);
    const isQa = qa && qa.defects.some((x) => x.id === id);
    const chance = isQa && qa.regress ? qa.regress[Math.min(workLevel(), qa.regress.length) - 1] || 0 : 0;
    if (Math.random() < chance) rollDefects(repo, workLevel(), 1, [id]);
    toast('Forkyard', `New commit on ${repo}`, 'forkyard');
  }

  // The client says something: an email (text) for email clients, a Y post ({ author, handle, text }) for Y ones.
  function clientSays(repo, msg, subject) {
    const client = S.repos[repo] && S.repos[repo].client;
    if (!client || !msg) return;
    if (client.type === 'email') {
      const contact = (S.contacts || {})[client.addr] || { name: client.addr, sign: '' };
      deliverCustom({ from: contact.name, addr: client.addr, subject: subject || client.subject || `RE: ${repo}`, body: `${msg}${contact.sign ? `\n\n${contact.sign}` : ''}` });
    } else if (client.type === 'y') {
      state.extraPosts.push({ id: `x${state.nextMail++}`, author: msg.author, handle: msg.handle, text: msg.text, t: state.t, likes: 40 + Math.floor(Math.random() * 120) });
      if (!onSite('y')) state.unread.y++;
    }
  }

  // The client finds a problem: an email about one defect, or Y posts about each new one.
  function complain(repo) {
    const def = S.repos[repo];
    const r = state.repos[repo];
    if (!def || !r || !def.client) return;
    const open = openDefects(repo);
    if (!open.length) return;
    if (def.client.type === 'email') {
      const id = open.find((x) => !r.complained.includes(x)) || open[0];
      if (!r.complained.includes(id)) r.complained.push(id);
      const d = defectDef(repo, id);
      // QA defects block the first payment; upkeep requests stand on their own
      const upkeep = d.kind === 'update' || d.kind === 'break';
      clientSays(repo, upkeep ? d.complaint : `${d.complaint}\n\nTell me when it's fixed and I'll have another look. I pay when it's right.`,
        upkeep ? def.client.upkeepSubject : def.client.subject);
    } else if (def.client.type === 'y') {
      for (const id of open.filter((x) => !r.complained.includes(x))) {
        r.complained.push(id);
        clientSays(repo, defectDef(repo, id).complaint);
      }
    }
  }

  /*
   * Upkeep, once a night: age the open issues (warn, then churn), and maybe open a new one.
   * Returns notes for the morning summary.
   */
  function upkeepNight() {
    const notes = [];
    for (const [repo, r] of Object.entries(state.repos)) {
      const up = upkeepOf(repo);
      if (!up || !r.deployed || r.broken) continue;
      const u = (r.upkeep = r.upkeep || { quiet: 0, done: [], open: {}, dropped: false });
      if (u.dropped || !check(up.when)) continue;
      const name = (S.repos[repo].preview && S.repos[repo].preview.title) || repo;
      for (const id of Object.keys(u.open)) {
        if (!r.defects.includes(id)) { delete u.open[id]; continue; }
        const nights = ++u.open[id];
        if (nights === up.warnAfter) { clientSays(repo, up.warn, S.repos[repo].client.upkeepSubject); notes.push(`${name}: still waiting on a fix`); }
        if (nights === up.churnAfter && up.churn) {
          applyEffects(up.churn.effects);
          clientSays(repo, up.churn.message);
          notes.push(`${name}: ${up.churn.drop ? 'the client gave up on you' : 'users gave up waiting'}`);
          if (up.churn.drop) {
            u.dropped = true;
            r.defects = r.defects.filter((x) => !up.issues.some((i) => i.id === x));
            u.open = {};
            break;
          }
        }
      }
      if (u.dropped || Object.keys(u.open).length) continue;
      const chance = up.chance[Math.min(u.quiet, up.chance.length - 1)] || 0;
      const pool = up.issues.filter((i) => !u.done.includes(i.id) && !r.defects.includes(i.id));
      if (pool.length && Math.random() < chance) {
        const issue = pool[Math.floor(Math.random() * pool.length)];
        r.defects.push(issue.id);
        r.complained.push(issue.id);
        u.open[issue.id] = 0;
        u.done.push(issue.id);
        u.quiet = 0;
        clientSays(repo, issue.complaint, S.repos[repo].client.upkeepSubject);
        notes.push(`${name}: ${issue.kind === 'update' ? 'new request from the client' : 'something broke overnight'}`);
      } else {
        u.quiet++;
      }
    }
    return notes;
  }

  // Fix requests are branches generated from the open defects (cached so identity stays stable).
  const defectBranchCache = new Map();
  function defectBranches() {
    const out = [];
    for (const [repo, r] of Object.entries(state.repos)) {
      for (const id of r.defects || []) {
        const key = `defect:${repo}:${id}`;
        if (!defectBranchCache.has(key)) {
          const d = defectDef(repo, id);
          if (!d) continue;
          defectBranchCache.set(key, { id: key, intent: d.intent, match: d.match, response: d.fixed, effects: { fixDefect: { repo, id } }, minModel: d.minModel, fake: d.fake, defect: true });
        }
        out.push(defectBranchCache.get(key));
      }
    }
    return out;
  }

  function changeFollowers(d) {
    if (!d) return;
    state.followers = Math.max(0, state.followers + d);
    toast('Y', `${d > 0 ? '+' : '−'}${Math.abs(d)} follower${Math.abs(d) === 1 ? '' : 's'} · ${state.followers} total`, 'y');
  }

  // How many followers a post wins (or loses), from its 0–4 rating.
  function followerDelta(score, text, earlier) {
    const y = S.y || {};
    const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (earlier.some((p) => norm(p.text) === norm(text))) return 0; // reposts earn nothing
    const f = state.followers;
    if (score < 0.8) return -Math.round((0.8 - score) * 4 + f * 0.02);
    let d = score * score * 1.6 + score * f * 0.03;
    const stems = K.analyze(text).stems;
    if ((y.trends || []).map(K.stem).some((t) => stems.includes(t))) d *= 1.5;
    const extra = state.postsToday.n - (y.postsPerDay || 3);
    if (extra > 0) d /= 2 ** extra; // posting too much wears people out
    return Math.round(d);
  }

  // When a delayed effect fires: { hours } from now, or { nextDay: hour, jitter: hours } tomorrow.
  function laterTime(l) {
    if (l.nextDay != null) return dayOf(state.t) * 1440 + Math.round((l.nextDay + Math.random() * (l.jitter || 0)) * 60);
    if (Array.isArray(l.hours)) return state.t + Math.round((l.hours[0] + Math.random() * (l.hours[1] - l.hours[0])) * 60);
    return state.t + Math.round((l.hours || 0) * 60);
  }

  // Queue a contact's reply to an email that didn't move the story. The local model writes the
  // body right away in the background; if it isn't ready by delivery, a canned line is used.
  function scheduleReply(to, subject, body) {
    const contact = (S.contacts || {})[to];
    if (!contact || !contact.reply) return;
    if (Math.random() > (contact.reply.chance == null ? 1 : contact.reply.chance)) return;
    const id = 'r' + state.nextMail++;
    const reSubject = /^re:/i.test(subject) ? subject : `RE: ${subject}`;
    state.queue.push({ at: laterTime(contact.reply), effects: { reply: { id, addr: to, subject: reSubject } } });
    if (LLM && LLM.writeReply) {
      LLM.writeReply(contact, { fromName: S.start.player.name, subject, body }).then((text) => {
        if (text && state.queue.some((q) => q.effects && q.effects.reply && q.effects.reply.id === id)) {
          state.replyDrafts[id] = text;
          save();
        }
      });
    }
  }

  function deliverReply(r) {
    const contact = (S.contacts || {})[r.addr] || { name: r.addr, sign: '', fallback: ['Got it.'] };
    let text = state.replyDrafts[r.id];
    const generated = !!text;
    delete state.replyDrafts[r.id];
    if (!text) {
      const pool = contact.fallback || ['Got it.'];
      let h = 0;
      for (const c of r.id + r.subject) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      text = pool[h % pool.length];
    }
    deliverCustom({ from: contact.name, addr: r.addr, subject: r.subject, body: text + (contact.sign ? `\n\n${contact.sign}` : ''), generated });
  }

  function fireEvents(kind, extra) {
    for (const ev of S.events || []) {
      if (ev.on !== kind) continue;
      if ((kind === 'deploy' || kind === 'takedown') && ev.repo !== extra) continue;
      if (kind === 'discover' && ev.site !== extra) continue;
      if ((kind === 'download' || kind === 'run') && ev.model && ev.model !== extra) continue;
      const key = ev.id || `${ev.on}:${ev.repo || ''}:${S.events.indexOf(ev)}`;
      if (state.fired[key]) continue;
      if (!check(ev.when)) continue;
      state.fired[key] = state.t;
      applyEffects(ev.effects);
    }
  }

  // ───────────────────────── time ─────────────────────────

  function runQueueUntil(target) {
    state.queue.sort((a, b) => a.at - b.at);
    while (state.queue.length && state.queue[0].at <= target) {
      const item = state.queue.shift();
      state.t = Math.max(state.t, item.at);
      applyEffects(item.effects);
    }
  }

  function advance(minutes) {
    const target = state.t + minutes;
    const midnight = dayOf(state.t) * 1440 + ((E.bedHour || 24) - 24) * 60;
    if (target >= midnight) {
      runQueueUntil(midnight);
      state.t = midnight;
      sleep(true);
      return;
    }
    runQueueUntil(target);
    state.t = target;
  }

  function sleep(passedOut) {
    const ended = dayOf(state.t - (hourOf(state.t) === 0 && passedOut ? 1 : 0));
    const wake = ended * 1440 + E.wakeHour * 60;
    runQueueUntil(wake);
    state.t = Math.max(state.t, ended * 1440);
    const lines = [];

    for (const [repo, app] of Object.entries(state.apps)) {
      const r = state.repos[repo];
      if (!r || !r.deployed) continue;
      const label = app.label || `${repo} earnings (${appVisitors(repo)} users/day)`;
      if (r.broken || blockingDefects(repo).length) {
        // a broken or buggy app earns nothing, whatever agent promised; users complain about each defect
        if (app.perDay > 0 || app.users > 0) lines.push([label, 0]);
        if (!r.broken && app.users > 0) complain(repo);
      } else if (app.perDay > 0) {
        addTx(app.perDay, app.label ? `${app.label} · ${repo}` : `Forkyard · ${repo} payout`);
        lines.push([label, app.perDay]);
      }
    }
    const live = Object.values(state.repos).filter((r) => r.deployed).length;
    if (live) {
      const fee = live * E.hostingPerDay;
      addTx(-fee, `Forkyard · hosting (${live} app${live > 1 ? 's' : ''})`);
      lines.push([`Hosting (${live} app${live > 1 ? 's' : ''})`, -fee]);
    }
    const cr = S.y && S.y.creator;
    if (cr && state.creatorOn && state.followers >= cr.minFollowers) {
      const pay = round2(state.followers * cr.perFollower);
      addTx(pay, `Y · creator payouts (${state.followers} followers)`);
      lines.push([`Y creator payouts (${state.followers} followers)`, pay]);
    }
    const memos = arr(E.living.memo);
    addTx(-E.living.amount, memos[(ended - 1) % memos.length]);
    lines.push(['Food & basics', -E.living.amount]);

    let rentDue = false;
    if (E.rent && ended === E.rent.day) {
      rentDue = true;
      addTx(-E.rent.amount, `${E.rent.payee} · rent (auto-pay)`);
      lines.push(['Rent', -E.rent.amount]);
    }

    state.t = wake;
    if (state.money >= 0) for (const n of upkeepNight()) lines.push([n, null]);
    if (state.money < 0) {
      state.over = rentDue
        ? { title: 'Evicted', text: `Rent bounced. Gary changed the locks on Day ${ended + 1}. Your laptop is in a box on the curb.` }
        : { title: 'Insolvent', text: 'Your wallet went below zero. The auto-payments bounced, Satchel froze the address, and GeneralAI revoked your access.' };
    }
    state.morning = { day: dayOf(wake), passedOut: !!passedOut, lines, balance: state.money };
    if (!state.over) fireEvents('day');
    revealPosts();
  }

  // ───────────────────────── actions ─────────────────────────

  function wordCount(text) { return K.tokenize(text).length; }
  function promptCost(text, level) {
    const m = modelDef(level || state.model);
    return round2(m.promptBase + wordCount(text) * m.perWord);
  }

  // Buy the next model tier. Tiers unlock in order; the new tier becomes active.
  function buyModel(level) {
    const m = modelDef(level);
    if (level !== state.owned + 1 || state.over) return;
    if (state.money < m.price) { toast('GeneralAI', `${m.name} costs ${fmtMoney(m.price)}. Your balance is ${fmtMoney(state.money)}.`, 'agent'); return; }
    addTx(-m.price, `GeneralAI · ${m.name} upgrade`);
    state.stats.upgradeSpend = round2(state.stats.upgradeSpend + m.price);
    state.owned = level;
    state.model = level;
    applyEffects(m.effects);
    deliverCustom({
      from: 'GeneralAI', addr: 'billing@agent.chat', subject: `Receipt: ${m.name} upgrade`,
      body: `You unlocked ${m.name}.\n\nCharged: ${fmtCoin(m.price)} from wallet ${shortAddr(WALLET_ADDR)}.\nWhile ${m.name} is active, prompts cost ${fmtMoney(m.promptBase)} + ${fmtMoney(m.perWord)} per word.\n\nNo refunds. No exceptions. No humans.\n\nGeneralAI`,
    });
    toast('GeneralAI', `${m.name} unlocked and active. Prompts now cost ${fmtMoney(m.promptBase)} + ${fmtMoney(m.perWord)}/word.`, 'agent');
    save();
    render();
  }

  function useModel(level) {
    if (level < 1 || level > state.owned || busy) return;
    state.model = level;
    save();
    render();
  }

  /*
   * What a decision comes to on a given tier: { kind, reply, effects, src, decision }. A miss has
   * no reply; the caller supplies one. Used by agent and by local models in the Terminal.
   */
  function resolveDecision(decision, level, modelName) {
    // the player may have deployed or posted while Jev was deciding
    if (decision.branch && !branchCandidates().includes(decision.branch)) decision = { ...decision, kind: 'miss', branch: null, stale: true };
    decision = J.gate(decision, level, state.followers);
    const b = decision.branch;
    const res = (kind, reply, effects) => ({ decision, kind, reply, effects: effects || null, src: kind + (b ? ':' + b.id : '') });
    if (decision.kind === 'hit') { const out = J.outcome(b, level); return res('hit', out.response, out.effects); }
    // too weak, but it does the job anyway and doesn't tell you
    if (decision.kind === 'fake') return res('fake', b.fake.response, b.fake.effects);
    if (decision.kind === 'locked' && decision.lockReason === 'followers') {
      return res('locked', tpl(b.fewFollowers || S.y.lockedResponse, { followers: state.followers, requiredFollowers: b.minFollowers }));
    }
    if (decision.kind === 'locked') return res('locked', tpl(b.weak || S.agent.lockedResponse, { model: modelName || modelDef(level).name, required: modelDef(b.minModel).name }));
    if (decision.kind === 'partial') return res('partial', b.partial);
    return { decision, kind: 'miss', reply: null, effects: null, src: 'miss' };
  }

  function branchCandidates() {
    return [...(currentNode().branches || []), ...defectBranches(), ...(S.global || [])].filter((b) => check(b.when));
  }

  function sendPrompt(text) {
    text = text.trim();
    if (!text || busy || state.over) return;
    const cost = promptCost(text);
    if (state.money < cost) {
      state.chat.push({ from: 'system', text: `Card declined. This prompt costs ${fmtMoney(cost)}; your balance is ${fmtMoney(state.money)}.`, t: state.t });
      render();
      return;
    }
    const level = state.model;
    addTx(-cost, `GeneralAI · ${modelDef(level).name} usage`);
    state.lastCost = cost;
    state.stats.prompts++;
    state.stats.promptSpend = round2(state.stats.promptSpend + cost);
    state.chat.push({ from: 'you', text, t: state.t, cost, model: level });
    busy = true;
    render();

    const sentNode = state.node;
    const thinking = new Promise((r) => setTimeout(r, 650 + Math.min(1400, text.length * 12)));

    (async () => {
      let decision = await J.decide(text, branchCandidates(), { kind: 'prompt', node: sentNode, thresholds: S.decision });
      await thinking;
      const out = resolveDecision(decision, level);
      decision = out.decision;
      lastReport = { prompt: text, node: sentNode, decision, model: level };
      let reply = out.reply;
      let src = out.src;
      const effects = out.effects;
      if (out.kind === 'fake') applyEffects(S.agent.onFake);
      if (out.kind === 'locked') state.stats.locked++;
      if (out.kind === 'partial') state.stats.partials++;
      if (out.kind === 'miss') {
        const ctx = { state, node: state.node, placeholders: S.placeholders, source: 'placeholder' };
        try {
          reply = await J.fallback(text, ctx);
        } catch (e) {
          reply = S.placeholders[0];
          ctx.source = 'placeholder';
        }
        src = 'miss:' + ctx.source;
        state.stats.misses++;
      }
      state.chat.push({ from: 'agent', text: tpl(reply), t: state.t, src });
      startTyping(state.chat.length - 1);
      if (effects) applyEffects(effects);
      advance(Math.round(E.promptHours * 60));
      busy = false;
      save();
      render();
    })();
  }

  function postCandidates() {
    return (S.postActions || []).filter((c) => !state.fired['post:' + c.id] && check(c.when));
  }

  async function postToY(text) {
    text = text.trim();
    if (!text || state.over) return;
    const id = 'u' + Date.now();
    const earlier = state.userPosts.slice();
    const post = { id, text, t: state.t, likes: 0, pending: true };
    state.userPosts.push(post);
    const day = dayOf(state.t);
    if (state.postsToday.day !== day) state.postsToday = { day, n: 0 };
    state.postsToday.n++;
    advance(5);
    save();
    render();
    const followersBefore = state.followers;
    const candidates = postCandidates();
    const node = state.node;
    const [rating, decision] = await Promise.all([
      J.ratePost(text),
      candidates.length ? J.decide(text, candidates, { kind: 'post', node, thresholds: S.decision }) : null,
    ]);
    // followers follow the rating
    const delta = followerDelta(rating.score, text, earlier);
    post.pending = false;
    post.score = rating.score;
    post.engine = rating.engine;
    post.delta = delta;
    post.likes = Math.max(0, Math.round(rating.score * rating.score * (1.5 + followersBefore * 0.12) + Math.random() * 3));
    changeFollowers(delta);
    if (decision) {
      const gated = J.gate(decision, state.model, followersBefore);
      lastReport = { prompt: text, node, decision: gated, channel: 'post', rating };
      // posts have no nudges: only a hit that is still available counts
      if (gated.kind === 'hit' && postCandidates().includes(gated.branch)) {
        if (!gated.branch.repeatable) state.fired['post:' + gated.branch.id] = state.t;
        post.likes += 20 + Math.floor(Math.random() * 40);
        applyEffects(gated.branch.effects);
      } else if (gated.kind === 'locked' && gated.lockReason === 'followers') {
        toast('Y', `That post went out to ${followersBefore} followers and nobody saw it. It needs about ${gated.branch.minFollowers}.`, 'y');
      }
    } else {
      lastReport = { prompt: text, node, decision: { kind: 'miss', engine: rating.engine }, channel: 'post', rating };
    }
    save();
    render();
  }

  function mailCandidates() {
    return (S.mailActions || []).filter((c) => !state.fired['mail:' + c.id] && check(c.when));
  }

  // Send an email from Qmail. Free, takes 5 minutes; Jev judges it against `mailActions`.
  async function sendMail(to, subject, body) {
    to = String(to || '').trim().toLowerCase();
    subject = String(subject || '').trim() || '(no subject)';
    body = String(body || '').trim();
    if (state.over) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast('Qmail', 'Enter a valid address in To.', 'mail'); return false; }
    if (state.awaiting[to]) { toast('Qmail', `You're waiting on a reply from ${to}.`, 'mail'); return false; }
    const known = contacts().includes(to);
    deliverCustom({ from: S.start.player.name, addr: playerAddr(), to, subject, body }, 'sent');
    draft = null;
    advance(5);
    toast('Qmail', `Sent to ${to}`, 'mail');
    navigate('qmail.com/sent');
    if (!known) {
      deliverCustom({
        from: 'Mail Delivery Subsystem', addr: 'mailer-daemon@qmail.com', subject: `Undeliverable: ${subject}`,
        body: `Your message to ${to} couldn't be delivered. That address doesn't exist.`,
      });
      delete state.awaiting[to];
      save();
      render();
      return true;
    }
    const contact = (S.contacts || {})[to];
    if (contact && contact.onMail) applyEffects(contact.onMail);
    const candidates = mailCandidates();
    let storyHit = false;
    if (candidates.length) {
      const text = `To: ${to}\nSubject: ${subject}\n\n${body}`;
      const node = state.node;
      const decision = await J.decide(text, candidates, { kind: 'mail', node, thresholds: S.decision });
      lastReport = { prompt: text, node, decision, channel: 'mail' };
      if (decision.kind === 'hit' && mailCandidates().includes(decision.branch)) {
        if (!decision.branch.repeatable) state.fired['mail:' + decision.branch.id] = state.t;
        applyEffects(decision.branch.effects);
        storyHit = true;
      }
    }
    // story mail brings its own reply; everything else gets an ordinary one (or none)
    if (!storyHit) scheduleReply(to, subject, body);
    save();
    render();
    return true;
  }

  function deploy(repo) {
    const r = state.repos[repo];
    if (!r || r.deployed || state.over) return;
    r.deployed = true;
    r.deployedAt = state.t;
    toast('Forkyard', `${repo} is live at ${repo}.forkyard.app`, 'forkyard');
    fireEvents('deploy', repo);
    advance(30);
    save();
    render();
  }

  // Take an app offline: no hosting fee, no income, and whoever relied on it notices.
  function takeDown(repo) {
    const r = state.repos[repo];
    if (!r || !r.deployed || state.over) return;
    r.deployed = false;
    toast('Forkyard', `${repo} is offline`, 'forkyard');
    fireEvents('takedown', repo);
    advance(10);
    save();
    render();
  }

  function doSleep() {
    if (state.over || busy) return;
    sleep(false);
    save();
    render();
  }

  // ───────────────────────── routing / tabs ─────────────────────────

  function normalizeUrl(u) {
    return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  }

  function route(url) {
    const u = normalizeUrl(url);
    if (!u || u === 'newtab') return { site: 'newtab', title: 'New Tab' };
    if (u === 'y.com' || u === 'chirpr.com') return { site: 'y', title: 'Home / Y' };
    let pm = u.match(/^y\.com\/@?([a-z0-9_]{1,30})$/);
    if (pm) return { site: 'y', profile: pm[1], title: `@${pm[1]} / Y` };
    if (u === 'yowl.com') return { site: 'yowl', title: 'Yowl' };
    pm = u.match(/^yowl\.com\/biz\/([a-z0-9-]+)$/);
    if (pm) { const b = yowlBiz(pm[1]); return { site: 'yowl', biz: pm[1], title: b ? `${b.name} · Yowl` : 'Yowl' }; }
    if (u === 'qmail.com') return { site: 'mail', view: 'inbox', title: 'Inbox · Qmail' };
    if (u === 'qmail.com/sent') return { site: 'mail', view: 'sent', title: 'Sent · Qmail' };
    if (u === 'qmail.com/compose') return { site: 'mail', view: 'compose', title: 'New message · Qmail' };
    const mm = u.match(/^qmail\.com\/m\/([a-z0-9_-]+)$/);
    if (mm) return { site: 'mail', view: 'msg', id: mm[1], title: 'Qmail' };
    if (u === 'satchel.app' || u === 'secondnational.com') return { site: 'wallet', title: 'Satchel · Wallet' };
    if (u === 'agent.chat' || u === 'askgit.ai' || u === 'unknownagent.ai') return { site: 'agent', title: 'agent' };
    if (u === 'agent.chat/models') return { site: 'agent', page: 'models', title: 'Models · agent' };
    if (u === 'forkyard.com') return { site: 'forkyard', title: 'Forkyard' };
    let m = u.match(/^forkyard\.com\/([a-z0-9-]+)$/);
    if (m) return { site: 'forkyard', repo: m[1], title: `${m[1]} · Forkyard` };
    m = u.match(/^([a-z0-9-]+)\.forkyard\.app$/);
    if (m) {
      const def = S.repos[m[1]];
      return { site: 'app', repo: m[1], title: def && def.preview ? def.preview.title : m[1] };
    }
    // hidden sites (story.sites): reachable by URL once known, some only once unlocked or invited
    const hid = hiddenByUrl(u);
    if (hid) {
      const [id, d] = hid;
      if (d.unlockOnly && !isDiscovered(id)) return { site: 'error', title: u };
      if (d.gate && !check(d.gate)) return { site: 'gate', siteId: id, title: d.label };
      const t = u.slice(d.url.length).match(/^\/t\/([a-z0-9_-]+)$/);
      return { site: id, hidden: true, thread: t ? t[1] : null, title: t ? `${d.label} · thread` : d.label };
    }
    return { site: 'error', title: u };
  }

  function navigate(url, newTab) {
    url = normalizeUrl(url) || 'newtab';
    if (newTab) {
      const id = state.nextTab++;
      state.tabs.push({ id, url });
      state.active = id;
    } else {
      const tab = state.tabs.find((x) => x.id === state.active);
      tab.url = url;
    }
    opened(route(url));
    save();
    render();
  }

  function opened(r) {
    if (state.unread[r.site] != null) state.unread[r.site] = 0;
    if (r.hidden) discover(r.site);
    if (r.thread && !state.readThreads.includes(r.thread)) {
      const t = visibleThreads().find((x) => x.id === r.thread);
      if (t) { state.readThreads.push(r.thread); applyEffects(t.onRead); }
    }
    if (r.site === 'mail' && r.id) {
      const entry = state.mail.find((m) => m.id === r.id);
      if (entry) entry.read = true;
    }
  }

  function switchTab(id) {
    state.active = id;
    const tab = state.tabs.find((x) => x.id === id);
    opened(route(tab.url));
    save();
    render();
  }

  function closeTab(id) {
    if (state.tabs.length === 1) { navigate('newtab'); return; }
    const i = state.tabs.findIndex((x) => x.id === id);
    state.tabs.splice(i, 1);
    if (state.active === id) state.active = state.tabs[Math.max(0, i - 1)].id;
    save();
    render();
  }

  // ───────────────────────── hidden sites ─────────────────────────

  const HIDDEN = S.sites || {};
  const hiddenByUrl = (u) => Object.entries(HIDDEN).find(([, d]) => u === d.url || u.startsWith(d.url + '/'));
  const isDiscovered = (id) => !!state && state.discovered.includes(id);
  function discover(id) {
    if (!HIDDEN[id] || isDiscovered(id)) return;
    state.discovered.push(id);
    toast('Bookmarked', `${HIDDEN[id].label} added to your bookmarks`, 'note');
    fireEvents('discover', id);
  }
  const bookmarkList = () => [...Object.entries(SITES), ...state.discovered.filter((k) => HIDDEN[k]).map((k) => [k, HIDDEN[k]])];

  // Turn known addresses in text into links (forkyard apps, agent's model page, findable hidden sites).
  function linkify(html, cls) {
    const hidden = Object.values(HIDDEN).filter((d) => !d.unlockOnly).map((d) => d.url.replace(/\./g, '\\.'));
    const re = new RegExp(`([a-z0-9-]+\\.forkyard\\.app|agent\\.chat\\/models${hidden.length ? '|' + hidden.join('|') : ''})`, 'g');
    return html.replace(re, `<a href="#" data-nav="$1"${cls ? ` class="${cls}"` : ''}>$1</a>`);
  }

  const localDef = (id) => (S.localModels || []).find((m) => m.id === id);
  const laptop = () => S.laptop || { ramGb: 16, diskGb: 40 };
  const diskUsed = () => round2(state.local.models.reduce((a, id) => a + ((localDef(id) || {}).sizeGb || 0), 0));

  function pageWeightroom() {
    const L = laptop();
    const cards = (S.localModels || []).filter((m) => m.source === 'weightroom').map((m) => {
      const have = state.local.models.includes(m.id);
      return `<article class="wr-card">
        <header><b>${esc(m.id)}</b><span class="wr-dl">↓ ${esc(m.downloads || '')}</span></header>
        <p>${esc(m.about)}</p>
        <div class="wr-tags"><span>${m.sizeGb} GB</span><span class="${m.ramGb > L.ramGb ? 'bad' : ''}">needs ${m.ramGb} GB RAM</span><span>about ${esc(modelDef(m.tier).name)}</span></div>
        ${have ? '<span class="wr-have">On your laptop</span>' : `<button class="wr-btn" data-download="${esc(m.id)}">Download · about ${m.downloadHours}h</button>`}
      </article>`;
    }).join('');
    return `<div class="wr"><header class="wr-top"><div class="wr-logo">${ICONS.weightroom}<span>Weightroom</span></div><span class="wr-sub">open weights for everyone</span></header>
      <div class="wr-wrap"><div class="wr-hero"><h1>Models</h1><p>Your laptop: ${L.ramGb} GB RAM · ${round2(L.diskGb - diskUsed())} of ${L.diskGb} GB disk free. Downloaded models run in the Terminal.</p></div>
      <div class="wr-grid">${cards}</div></div></div>`;
  }

  // Download a model from Weightroom. Takes time; the first one installs the Terminal.
  function downloadModel(id) {
    const m = localDef(id);
    if (!m || state.local.models.includes(id) || state.over || busy) return false;
    if (diskUsed() + m.sizeGb > laptop().diskGb) {
      toast('Disk full', `${id} needs ${m.sizeGb} GB. Delete something in the Terminal (rm).`, 'note');
      return false;
    }
    advance(Math.round(m.downloadHours * 60));
    if (state.over) { save(); render(); return false; }
    state.local.models.push(id);
    toast('Download complete', `${id} · ${m.sizeGb} GB`, 'note');
    fireEvents('download', id);
    save();
    render();
    return true;
  }

  // ── Terminal ──
  let termBusy = false;
  function pageTerminal() {
    const T = state.term;
    const ps = T.running ? `${T.running} >` : `${S.start.player.handle}@laptop:~$`;
    const lines = T.lines.slice(-200).map((l) => `<div class="tm-${l.k}">${esc(l.text)}</div>`).join('');
    const intro = `laptop · ${laptop().ramGb} GB RAM · ${round2(laptop().diskGb - diskUsed())} GB free. Type help.`;
    return `<div class="tm" id="tm-log"><div class="tm-sys">${esc(intro)}</div>${lines}${termBusy ? '<div class="tm-sys tm-wait">thinking… (this laptop is not fast)</div>' : ''}
      <form class="tm-in" data-form="term"><label for="term-input" class="tm-ps">${esc(ps)}</label><input id="term-input" autocomplete="off" autocapitalize="off" spellcheck="false" ${termBusy ? 'disabled' : ''}></form></div>`;
  }

  function termCommand(raw) {
    const text = String(raw || '').trim();
    if (!text || termBusy || state.over) return;
    const T = state.term;
    const say = (t, k) => T.lines.push({ k: k || 'out', text: t });
    if (T.running) {
      T.lines.push({ k: 'in', text: `${T.running} > ${text}` });
      if (/^(\/bye|exit|quit)$/i.test(text)) { say(`stopped ${T.running}`, 'sys'); T.running = null; save(); render(); return; }
      localPrompt(text);
      return;
    }
    T.lines.push({ k: 'in', text: `$ ${text}` });
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ').replace(/^~\/|\.gguf$/g, '');
    const L = laptop();
    const owned = (id) => state.local.models.includes(id);
    switch (cmd.toLowerCase()) {
      case 'help':
        say('help          this list\nls            what is on the laptop\ncat <file>    read a text file\nrun <model>   load a model and talk to it (free, slow)\nrm <file>     delete a model or file\ndf            disk and memory\nclear         clear the screen\n\nInside a model, type a prompt. /bye stops it.');
        break;
      case 'ls': {
        const items = [...state.local.models.map((id) => `${id}.gguf`.padEnd(24) + `${localDef(id).sizeGb} GB`), ...state.local.files.map((f) => f.name)];
        say(items.length ? items.join('\n') : '(empty. Weightroom has models.)');
        break;
      }
      case 'cat': {
        const f = state.local.files.find((x) => x.name === arg);
        say(f ? f.text : owned(arg) ? `cat: ${arg}.gguf: binary file. Try: run ${arg}` : `cat: ${arg || '?'}: no such file`);
        break;
      }
      case 'df': case 'free':
        say(`disk   ${diskUsed()} / ${L.diskGb} GB used\nmemory ${L.ramGb} GB`);
        break;
      case 'rm':
        if (owned(arg)) { state.local.models = state.local.models.filter((x) => x !== arg); say(`removed ${arg}.gguf`); }
        else if (state.local.files.some((x) => x.name === arg)) { state.local.files = state.local.files.filter((x) => x.name !== arg); say(`removed ${arg}`); }
        else say(`rm: ${arg || '?'}: no such file`);
        break;
      case 'clear':
        T.lines = [];
        break;
      case 'run': case 'ollama': {
        const id = cmd === 'ollama' ? rest.slice(1).join(' ') : arg;
        const m = localDef(id);
        if (!m || !owned(id)) { say(`run: ${id || '?'}: model not found. Try ls.`); break; }
        if (m.ramGb > L.ramGb) { say(`error: ${id} needs ${m.ramGb} GB of memory; this laptop has ${L.ramGb} GB.\nkilled (out of memory)`, 'err'); break; }
        T.running = id;
        say(`loaded ${id} · works like ${modelDef(m.tier).name} · about ${m.hours}h per reply · free\n/bye to stop`, 'sys');
        fireEvents('run', id);
        break;
      }
      default:
        say(`${cmd}: command not found. Type help.`, 'err');
    }
    save();
    render();
  }

  // A prompt to the running local model: same story decisions as agent, at the model's tier, for free.
  async function localPrompt(text) {
    const m = localDef(state.term.running);
    termBusy = true;
    render();
    const decision = await J.decide(text, branchCandidates(), { kind: 'prompt', node: state.node, thresholds: S.decision });
    await new Promise((r) => setTimeout(r, 500));
    const out = resolveDecision(decision, m.tier, m.id);
    lastReport = { prompt: text, node: state.node, decision: out.decision, model: m.tier, channel: 'local' };
    let reply = out.reply;
    if (out.kind === 'miss') {
      reply = (LLM && (await LLM.generate(text, { persona: m.persona }))) || null;
      if (!reply) {
        let h = 0;
        for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        reply = m.fallback[h % m.fallback.length];
      }
    }
    state.lastCost = 0;
    state.term.lines.push({ k: 'model', text: tpl(reply) });
    levelOverride = m.tier;
    try { if (out.effects) applyEffects(out.effects); } finally { levelOverride = null; }
    applyEffects(m.onPrompt);
    advance(Math.round(m.hours * 60));
    termBusy = false;
    save();
    render();
  }

  // ── nullboard ──
  const visibleThreads = () => ((S.forum || {}).threads || []).filter((t) => check(t.when));
  function pageNullboard(r) {
    const F = S.forum || {};
    const head = `<header class="nb-top"><a href="#" data-nav="${HIDDEN.nullboard.url}" class="nb-logo">${ICONS.nullboard}<span>${esc(F.title || 'nullboard')}</span></a><span class="nb-tag">${esc(F.tagline || '')}</span></header>`;
    if (r.thread) {
      const t = visibleThreads().find((x) => x.id === r.thread);
      if (!t) return `<div class="nb">${head}<div class="nb-wrap"><p>thread not found.</p></div></div>`;
      const posts = t.posts.map((p, i) => `<article class="nb-post"><header><b>${esc(p.author)}</b><span>#${i + 1}</span></header><p>${linkify(esc(tpl(p.text))).replace(/\n/g, '<br>')}</p></article>`).join('');
      return `<div class="nb">${head}<div class="nb-wrap"><p class="nb-crumb"><a href="#" data-nav="${HIDDEN.nullboard.url}">← all threads</a></p><h1>${esc(t.title)}</h1>${posts}<p class="nb-note">new members can't post yet.</p></div></div>`;
    }
    const rows = visibleThreads().map((t) => `<a href="#" class="nb-row${state.readThreads.includes(t.id) ? '' : ' new'}" data-nav="${HIDDEN.nullboard.url}/t/${t.id}">
      <span class="nb-title">${t.pinned ? '[pinned] ' : ''}${esc(t.title)}</span><span class="nb-meta">${esc(t.author)} · ${t.posts.length} post${t.posts.length === 1 ? '' : 's'}</span></a>`).join('');
    return `<div class="nb">${head}<div class="nb-wrap">${rows}</div></div>`;
  }
  function pageGate(r) {
    const d = HIDDEN[r.siteId];
    return `<div class="nb gate"><div class="nb-wrap"><p class="nb-logo">${ICONS[r.siteId] || ''}<span>${esc(d.label)}</span></p><p>${esc(d.gateText || 'access denied.')}</p></div></div>`;
  }

  // ── Cellar ──
  function pageCellar() {
    const mk = S.market || { listings: [] };
    const items = mk.listings.filter((l) => check(l.when)).map((l) => {
      const sold = l.once && state.bought.includes(l.id);
      return `<article class="cl-item"><div class="cl-info"><h2>${esc(l.title)}</h2><p>${esc(l.about)}</p><small>seller ${esc(l.seller)} · ★ ${esc(l.rating || '–')}${l.hours ? ` · delivery about ${l.hours}h` : ''}</small></div>
        <div class="cl-buy"><b>${fmtCoin(l.price)}</b>${sold ? '<span class="cl-sold">purchased</span>' : `<button class="cl-btn" data-buy="${esc(l.id)}">Buy</button>`}</div></article>`;
    }).join('');
    return `<div class="cl"><header class="cl-top"><div class="cl-logo">${ICONS.cellar}<span>${esc(mk.title || 'Cellar')}</span></div><span class="cl-sub">escrow · no refunds · paid in DOLR</span></header><div class="cl-wrap">${items}</div></div>`;
  }

  function buyListing(id) {
    const l = ((S.market || {}).listings || []).find((x) => x.id === id);
    if (!l || state.over || busy || (l.once && state.bought.includes(id))) return false;
    if (state.money < l.price) { toast('Cellar', `Insufficient funds. ${fmtCoin(l.price)} needed.`, 'wallet'); return false; }
    addTx(-l.price, `Cellar · order #${(txHash(state.t + id) || '').slice(2, 8)}`);
    state.bought.push(id);
    applyEffects(S.market.onBuy);
    applyEffects(l.effects);
    if (l.hours) advance(Math.round(l.hours * 60));
    toast('Cellar', `Order complete: ${l.title}`, 'wallet');
    save();
    render();
    return true;
  }

  // ───────────────────────── Yowl ─────────────────────────

  const yowlBiz = (id) => ((S.yowl || {}).businesses || []).find((b) => b.id === id);
  let yowlSearch = '';
  let reviewStars = 0;
  const starRow = (n) => `<span class="yw-stars" aria-label="${n.toFixed(1)} stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${n >= i - 0.25 ? 'on' : n >= i - 0.75 ? 'half' : ''}"></i>`).join('')}</span>`;
  // the reviews a business shows right now, the player's first
  function yowlReviews(b) {
    const out = [];
    const mine = state.reviews[b.id];
    if (mine) out.push({ author: `${S.start.player.name} (@${S.start.player.handle})`, stars: mine.stars, text: mine.text, when: ago(mine.t) + ' ago', mine: true });
    for (const rv of b.reviews || []) {
      if (rv.when ? !check(rv.when) : false) continue;
      out.push({ author: tpl(rv.author), stars: rv.stars, text: tpl(rv.text), when: rv.ago != null ? `${rv.ago} day${rv.ago === 1 ? '' : 's'} ago` : 'this week' });
    }
    return out;
  }
  const yowlAvg = (list) => (list.length ? list.reduce((a, x) => a + x.stars, 0) / list.length : 0);

  function pageYowl(r) {
    const head = `<header class="yw-top"><a href="#" class="yw-logo" data-nav="yowl.com">${ICONS.yowl}<span>yowl</span></a><span class="yw-sub">honest reviews from real neighbors</span></header>`;
    if (r.biz) {
      const b = yowlBiz(r.biz);
      if (!b) return `<div class="yw">${head}<div class="yw-wrap"><p>No business here.</p></div></div>`;
      const list = yowlReviews(b);
      const web = b.website ? (b.website.repo ? (state.repos[b.website.repo] && state.repos[b.website.repo].deployed ? `${b.website.repo}.forkyard.app` : null) : b.website.url) : null;
      const mine = state.reviews[b.id];
      const form = mine ? '' : `<form class="yw-form" data-form="review" data-biz="${esc(b.id)}">
          <h2>Write a review</h2>
          <div class="yw-pick" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="${reviewStars >= i ? 'on' : ''}" data-star="${i}" role="radio" aria-checked="${reviewStars === i}" aria-label="${i} star${i > 1 ? 's' : ''}"></button>`).join('')}<span>${reviewStars ? `${reviewStars} of 5` : 'Pick a rating'}</span></div>
          <textarea id="review-text" rows="3" maxlength="600" placeholder="What was it like?"></textarea>
          <div class="yw-form-row"><span class="yw-hint">Free · takes 5 minutes · one review per business</span><button class="yw-btn" type="submit">Post review</button></div>
        </form>`;
      return `<div class="yw">${head}<div class="yw-wrap">
        <p class="yw-crumb"><a href="#" data-nav="yowl.com">← All businesses</a></p>
        <section class="yw-biz"><h1>${esc(b.name)}</h1>
          <p class="yw-rating">${starRow(yowlAvg(list))}<b>${yowlAvg(list).toFixed(1)}</b><span>${list.length} review${list.length === 1 ? '' : 's'}</span></p>
          <p class="yw-meta">${esc(b.category)} · ${esc(b.price || '')}</p>
          <dl class="yw-facts"><dt>Address</dt><dd>${esc(b.address)}</dd><dt>Hours</dt><dd>${esc(b.hours || '')}</dd><dt>Website</dt><dd>${web ? `<a href="#" data-nav="${esc(web)}">${esc((b.website && b.website.label) || web)}</a>` : '<span class="yw-dim">none listed</span>'}</dd></dl>
        </section>
        ${form}
        <section class="yw-reviews">${list.map((x) => `<article class="yw-review${x.mine ? ' mine' : ''}"><header><b>${esc(x.author)}</b><span>${esc(x.when)}</span></header>${starRow(x.stars)}<p>${linkify(esc(x.text))}</p></article>`).join('')}</section>
      </div></div>`;
    }
    const q = yowlSearch.trim().toLowerCase();
    const biz = ((S.yowl || {}).businesses || []).filter((b) => !q || `${b.name} ${b.category} ${b.address}`.toLowerCase().includes(q));
    const cards = biz.map((b) => {
      const list = yowlReviews(b);
      return `<a href="#" class="yw-card" data-nav="yowl.com/biz/${esc(b.id)}"><b>${esc(b.name)}</b><span class="yw-rating">${starRow(yowlAvg(list))}<span>${yowlAvg(list).toFixed(1)} · ${list.length} reviews</span></span><span class="yw-meta">${esc(b.category)} · ${esc(b.price || '')} · ${esc(b.address)}</span></a>`;
    }).join('') || `<p class="yw-dim">Nothing matches “${esc(yowlSearch)}”.</p>`;
    return `<div class="yw">${head}<div class="yw-wrap">
      <label class="yw-search"><input id="yowl-search" autocomplete="off" placeholder="Search businesses near you" aria-label="Search businesses" value="${esc(yowlSearch)}"></label>
      <div class="yw-list">${cards}</div></div></div>`;
  }

  const reviewCandidates = (bizId) => ((S.yowl || {}).reviewActions || []).filter((a) => a.business === bizId && check(a.when) && !state.fired['review:' + a.id]);

  // Post a Yowl review. Free, 5 minutes, one per business; Jev judges it against reviewActions.
  async function writeReview(bizId, stars, text) {
    const b = yowlBiz(bizId);
    text = String(text || '').trim();
    stars = Math.round(Number(stars) || 0);
    if (!b || state.reviews[bizId] || state.over) return false;
    if (stars < 1 || stars > 5) { toast('Yowl', 'Pick a star rating first.', 'note'); return false; }
    if (!text) { toast('Yowl', 'Write a few words first.', 'note'); return false; }
    state.reviews[bizId] = { stars, text, t: state.t };
    reviewStars = 0;
    advance(5);
    toast('Yowl', `Review posted: ${b.name}`, 'note');
    const candidates = reviewCandidates(bizId);
    if (candidates.length) {
      const doc = `Review of ${b.name} (${stars} star${stars > 1 ? 's' : ''}):\n\n${text}`;
      const decision = await J.decide(doc, candidates, { kind: 'review', node: state.node, thresholds: S.decision });
      lastReport = { prompt: doc, node: state.node, decision, channel: 'review' };
      if (decision.kind === 'hit' && reviewCandidates(bizId).includes(decision.branch)) {
        state.fired['review:' + decision.branch.id] = state.t;
        applyEffects(decision.branch.effects);
      }
    }
    save();
    render();
    return true;
  }

  // ───────────────────────── page renderers ─────────────────────────

  const ICONS = {
    y: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 3h4l3.5 6.6L15.5 3h4l-5.6 9.7V21h-3.8v-8.3z" fill="currentColor"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="currentColor"/><path d="M4.5 7.5 12 13l7.5-5.5" stroke="var(--icon-ink, #fff)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H17v3h1.5A1.5 1.5 0 0 1 20 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-12A2.5 2.5 0 0 1 4 17.5z" fill="currentColor"/><circle cx="16" cy="13.5" r="1.6" fill="var(--icon-ink, #1f2329)"/></svg>',
    forkyard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3a3 3 0 0 0-1 5.8v6.4A3 3 0 1 0 8 15.2V13c0-1 1-2 2-2h4a4 4 0 0 0 4-4V8.8A3 3 0 1 0 16 8.8V7c0 1-1 2-2 2h-4c-.7 0-1.4.2-2 .5V8.8A3 3 0 0 0 7 3z" fill="currentColor"/></svg>',
    // agent's mark: six rounded blades swirling around an open core
    agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="12.3" y="2.4" width="3.4" height="8.4" rx="1.7" transform="rotate(0 12 12)"/><rect x="12.3" y="2.4" width="3.4" height="8.4" rx="1.7" transform="rotate(60 12 12)"/><rect x="12.3" y="2.4" width="3.4" height="8.4" rx="1.7" transform="rotate(120 12 12)"/><rect x="12.3" y="2.4" width="3.4" height="8.4" rx="1.7" transform="rotate(180 12 12)"/><rect x="12.3" y="2.4" width="3.4" height="8.4" rx="1.7" transform="rotate(240 12 12)"/><rect x="12.3" y="2.4" width="3.4" height="8.4" rx="1.7" transform="rotate(300 12 12)"/></g></svg>',
    newtab: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    yowl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor"/></svg>',
    weightroom: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="5" y="6.5" width="3.5" height="11" rx="1.2"/><rect x="8.5" y="11" width="7" height="2" rx="1"/><rect x="15.5" y="6.5" width="3.5" height="11" rx="1.2"/><rect x="19" y="9" width="3" height="6" rx="1"/></g></svg>',
    terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="currentColor"/><path d="m6.5 9 3 3-3 3M11.5 15.5h5" stroke="var(--icon-ink, #111)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    nullboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M6 18 18 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    cellar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V10l9-6 9 6v10h-4v-6H7v6z" fill="currentColor"/><path d="M9 16h6M10 18.5h4" stroke="var(--icon-ink, #111)" stroke-width="1.4" stroke-linecap="round"/></svg>',
    app: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 9h16" stroke="currentColor" stroke-width="2"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3zm0 6v6m0 2.5v.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  };

  function pageNewTab() {
    const tiles = bookmarkList().map(([k, s]) =>
      `<button class="nt-tile nt-${k}" data-nav="${s.url}"><span class="nt-ico">${ICONS[k]}</span><span>${esc(s.label)}</span>${badgeCount(k) ? `<i class="badge">${badgeCount(k)}</i>` : ''}</button>`
    ).join('');
    return `<div class="newtab">
      <p class="nt-time">${weekday(state.t)} ${clock(state.t)}</p>
      <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
      <div class="nt-tiles">${tiles}</div>
    </div>`;
  }

  const Y_ICONS = {
    explore: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    reply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5S16.4 19 12 19c-1.1 0-2.2-.2-3.2-.6L4 20l1.4-3.9A7 7 0 0 1 4 11.5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
    repost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l-2.5-2.5M17 17H7l2.5 2.5M7 7v5M17 17v-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z" stroke="currentColor" stroke-width="1.8" fill="var(--heart-fill, none)" stroke-linejoin="round"/></svg>',
    views: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V12M10 20V6M15 20v-9M20 20V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    badge: '<svg viewBox="0 0 24 24" aria-label="Verified" role="img"><path d="M12 2.5 20.2 7.2v9.6L12 21.5l-8.2-4.7V7.2z" fill="currentColor"/><path d="m8.3 12.1 2.5 2.5 4.9-5" stroke="var(--y-bg)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  let ySearch = '';

  function compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function yProfile() {
    const cr = (S.y && S.y.creator) || null;
    let creator = '';
    if (cr) {
      const ready = state.followers >= cr.minFollowers;
      creator = `<div class="y-creator">
        <div class="y-creator-head"><b>Creator payouts</b>${state.creatorOn ? `<span class="y-on">${ready ? 'On' : 'Paused'}</span>` : ''}</div>
        ${state.creatorOn
          ? `<small>${ready ? `About ${fmtMoney(state.followers * cr.perFollower)} a night at ${state.followers} followers.` : `Paused below ${cr.minFollowers} followers.`}</small>`
          : ready
            ? `<small>${fmtMoney(cr.perFollower)} per follower per night.</small><button class="y-btn" data-y-creator>Turn on payouts</button>`
            : `<small>Unlocks at ${cr.minFollowers} followers.</small><span class="y-meter"><i style="width:${Math.min(100, (state.followers / cr.minFollowers) * 100).toFixed(1)}%"></i></span>`}
      </div>`;
    }
    return `<section class="y-card y-me">
      <a href="#" class="y-me-head" data-nav="y.com/${esc(S.start.player.handle)}">${avatar(S.start.player.name, S.start.player.handle)}<span><b>${esc(S.start.player.name)}</b><small>@${esc(S.start.player.handle)}</small></span></a>
      <div class="y-me-stats"><span><b>${compact(state.followers)}</b> followers</span><span><b>${state.userPosts.length}</b> posts</span></div>
      ${creator}
    </section>`;
  }

  // Every post visible on Y right now, newest first.
  function yPosts() {
    const posts = [];
    for (const p of S.posts) {
      if (state.posts[p.id] == null) continue;
      posts.push({ ...p, t: state.posts[p.id], author: tpl(p.author), handle: tpl(p.handle), text: tpl(p.text) });
    }
    for (const x of state.extraPosts || []) posts.push({ ...x, author: tpl(x.author), handle: tpl(x.handle), text: tpl(x.text) });
    for (const u of state.userPosts) posts.push({ id: u.id, author: S.start.player.name, handle: S.start.player.handle, text: u.text, t: u.t, likes: u.likes, mine: true, delta: u.delta, pending: u.pending, score: u.score });
    return posts.sort((a, b) => b.t - a.t);
  }

  function yPostHtml(p) {
    const liked = !!state.liked[p.id];
    const likes = (p.likes || 0) + (liked ? 1 : 0);
    const text = linkify(esc(p.text)
      .replace(/(^|[^\w.])@([a-z0-9_]+)/gi, '$1<a href="#" class="y-at" data-nav="y.com/$2">@$2</a>')
      .replace(/(^|[^&\w])(#[a-z][a-z0-9_]*)/gi, '$1<span class="y-at">$2</span>'), 'y-link');
    const prof = `y.com/${esc(p.handle)}`;
    return `<article class="y-post${p.mine ? ' mine' : ''}">
        <header>
          <a href="#" class="y-av-link" data-nav="${prof}" aria-label="@${esc(p.handle)}">${avatar(p.author, p.handle)}</a>
          <a href="#" class="y-who" data-nav="${prof}"><span class="y-name"><b>${esc(p.author)}</b>${p.verified ? `<span class="y-badge">${Y_ICONS.badge}</span>` : ''}</span><span class="y-handle">@${esc(p.handle)}</span></a>
          <span class="y-time">${ago(p.t)}</span>
        </header>
        <p>${text}</p>
        <footer class="y-acts">
          <span class="y-act">${Y_ICONS.reply}${compact(Math.round(likes * 0.07))}</span>
          <span class="y-act">${Y_ICONS.repost}${compact(Math.round(likes * 0.14))}</span>
          <button class="y-act like${liked ? ' on' : ''}" data-like="${esc(p.id)}" aria-pressed="${liked}" aria-label="Like">${Y_ICONS.heart}${compact(likes)}</button>
          ${p.mine ? `<span class="y-delta ${p.pending ? '' : p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}">${p.pending ? 'counting…' : `${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '±'}${Math.abs(p.delta || 0)} followers`}${p.score != null ? `<span class="y-score">rated ${p.score.toFixed(1)}/4</span>` : ''}</span>` : ''}
          <span class="y-act views">${Y_ICONS.views}${compact(Math.max(12, likes * 37 + 9))}</span>
        </footer>
      </article>`;
  }

  // A Y account: from story.y.profiles, from what it has posted, or null if nobody by that name exists.
  function yAccount(handle) {
    handle = String(handle || '').toLowerCase().replace(/^@/, '');
    const profiles = (S.y && S.y.profiles) || {};
    const key = Object.keys(profiles).find((k) => k.toLowerCase() === handle);
    const prof = key ? profiles[key] : null;
    const me = handle === S.start.player.handle.toLowerCase();
    const posts = yPosts().filter((p) => p.handle.toLowerCase() === handle);
    if (!prof && !posts.length && !me) return null;
    const first = posts[posts.length - 1];
    const link = prof && prof.link ? (typeof prof.link === 'string' ? prof.link : check(prof.link.when) ? prof.link.text : null) : null;
    return {
      handle: key || (first ? first.handle : me ? S.start.player.handle : handle),
      name: (prof && prof.name) || (first && first.author) || (me ? S.start.player.name : handle),
      verified: !!((prof && prof.verified) || (first && first.verified)),
      bio: (prof && prof.bio) || '', location: (prof && prof.location) || '', joined: (prof && prof.joined) || '', link,
      followers: me ? state.followers : prof && prof.followers != null ? prof.followers : 20 + (hashHue(handle) % 180),
      following: prof && prof.following != null ? prof.following : 40 + (hashHue(handle + 'f') % 300),
      protected: !!(prof && prof.protected), me, posts,
    };
  }

  function yProfilePage(handle) {
    const a = yAccount(handle);
    const back = '<p class="y-back"><a href="#" data-nav="y.com">← Timeline</a></p>';
    if (!a) return `${back}<section class="y-prof missing"><h2>This account doesn't exist</h2><p>Nobody on Y goes by @${esc(handle)}. Check the spelling.</p></section>`;
    const meta = [a.location && esc(a.location), a.link && `<a href="#" class="y-link" data-nav="${esc(a.link)}">${esc(a.link)}</a>`, a.joined && `Joined ${esc(a.joined)}`].filter(Boolean).join('<span class="y-dot">·</span>');
    const feed = a.protected ? `<p class="y-none">These posts are protected. Only approved followers can see them.</p>`
      : a.posts.length ? a.posts.map(yPostHtml).join('') : `<p class="y-none">@${esc(a.handle)} hasn't posted anything you can see.</p>`;
    return `${back}<section class="y-prof">
        <div class="y-banner" style="--h:${hashHue(a.handle)}"></div>
        <div class="y-prof-head"><div class="y-prof-av">${avatar(a.name, a.handle)}</div>${a.protected ? '<span class="y-lock">Protected</span>' : ''}</div>
        <h1 class="y-prof-name">${esc(a.name)}${a.verified ? `<span class="y-badge">${Y_ICONS.badge}</span>` : ''}</h1>
        <p class="y-handle">@${esc(a.handle)}</p>
        ${a.bio ? `<p class="y-bio">${linkify(esc(a.bio), 'y-link')}</p>` : ''}
        ${meta ? `<p class="y-prof-meta">${meta}</p>` : ''}
        <p class="y-prof-stats"><span><b>${compact(a.following)}</b> following</span><span><b>${compact(a.followers)}</b> followers</span></p>
      </section>
      <p class="y-eyebrow">Posts</p>
      <div class="y-feed">${feed}</div>`;
  }

  function pageY(r) {
    r = r || {};
    const posts = yPosts();
    const q = ySearch.trim().toLowerCase();
    // searching a username offers the profile, whether or not it has posted
    const lookup = q && /^@?[a-z0-9_]{2,30}$/.test(q) ? yAccount(q) : null;
    const lookupHtml = q.startsWith('@') || lookup
      ? (lookup ? `<a href="#" class="y-lookup" data-nav="y.com/${esc(lookup.handle)}">${avatar(lookup.name, lookup.handle)}<span><b>${esc(lookup.name)}</b><small>@${esc(lookup.handle)} · ${compact(lookup.followers)} followers</small></span><span class="y-lookup-go">View profile</span></a>`
        : `<p class="y-none">No account called ${esc(q.startsWith('@') ? q : '@' + q)}.</p>`)
      : '';
    const shown = q ? posts.filter((p) => `${p.author} ${p.handle} ${p.text}`.toLowerCase().includes(q.replace(/^@/, ''))) : posts;
    const feed = shown.map(yPostHtml).join('') || (lookupHtml ? '' : `<p class="y-none">No posts match “${esc(ySearch)}”.</p>`);
    const trends = [
      ['#RentDue', '18.2K posts', 'Ferris St'],
      ['agent-3', '9,410 posts', 'Tech'],
      state.posts.washday != null ? ['Ferris St Laundromat', '2,140 posts', 'Local'] : ['#AgenticWorkflows', '4,002 posts', 'Business'],
      ['Crumb & Coin', state.posts.rosa_thanks != null ? '312 posts' : '27 posts', 'Food'],
    ];
    return `<div class="y">
      <header class="y-bar">
        <div class="y-brand"><span class="y-mark">${ICONS.y}</span><span class="sr-only">Y</span></div>
        <nav class="y-pills" aria-label="Y sections"><a href="#" data-nav="y.com" class="${r.profile ? '' : 'on'}">Home</a><a href="#" data-nav="y.com/${esc(S.start.player.handle)}" class="${r.profile && r.profile.toLowerCase() === S.start.player.handle ? 'on' : ''}">Profile</a><span>Alerts</span><span>Inbox</span></nav>
        <span class="y-count"><b>${compact(state.followers)}</b> followers</span>
        <label class="y-search">${Y_ICONS.explore}<input id="y-search" autocomplete="off" placeholder="Search Y or @username" aria-label="Search posts or look up a username" value="${esc(ySearch)}"></label>
      </header>
      <div class="y-cols">
        <main class="y-main">${r.profile ? yProfilePage(r.profile) : `
          <form class="y-compose" data-form="ypost">
            ${avatar(S.start.player.name, S.start.player.handle)}
            <div><textarea id="post-input" rows="2" maxlength="280" placeholder="Say something to the timeline"></textarea>
            <div class="y-compose-row"><span class="y-hint">280 chars · free</span><button class="y-btn" type="submit">Post</button></div></div>
          </form>
          <p class="y-eyebrow"><i class="y-live"></i>${q ? 'Search' : 'Timeline · live'}</p>
          ${lookupHtml}
          <div class="y-feed">${feed}</div>`}
        </main>
        <aside class="y-side">
          ${yProfile()}
          <section class="y-card"><h2>Signal</h2>${trends.map(([n, k, c], i) => `<div class="y-trend"><span class="y-rank">0${i + 1}</span><span><b>${esc(n)}</b><small>${esc(k)} · ${esc(c)}</small></span></div>`).join('')}</section>
        </aside>
      </div>
    </div>`;
  }

  // A short fake transaction hash, stable per transaction.
  function txHash(x) {
    let h = 2166136261;
    for (const c of `${x.t}|${x.memo}|${x.amount}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const hex = (h.toString(16) + (h ^ 0x9e3779b9).toString(16)).padEnd(16, '0');
    return `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;
  }

  // 5×5 mirrored identicon for the wallet address.
  function identicon(addr) {
    const hue = parseInt(addr.slice(2, 6), 16) % 360;
    let cells = '';
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        if (parseInt(addr[2 + y * 3 + x], 16) % 2) {
          cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
          if (x < 2) cells += `<rect x="${4 - x}" y="${y}" width="1" height="1"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 5 5" class="wl-ident" aria-hidden="true" style="--h:${hue}"><g fill="hsl(${hue} 70% 62%)">${cells}</g></svg>`;
  }

  // Running balance after each transaction, oldest first.
  function balanceHistory() {
    const sorted = [...state.tx].sort((a, b) => a.t - b.t);
    let bal = round2(state.money - sorted.reduce((n, x) => n + x.amount, 0));
    const pts = [bal];
    for (const x of sorted) { bal = round2(bal + x.amount); pts.push(bal); }
    return pts.slice(-40);
  }

  function sparkline(pts) {
    const w = 320, h = 90, pad = 6;
    const lo = Math.min(0, ...pts), hi = Math.max(...pts, 1);
    const xs = (i) => pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
    const ys = (v) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
    const line = pts.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
    const last = pts.length - 1;
    return `<svg viewBox="0 0 ${w} ${h}" class="wl-spark" preserveAspectRatio="none" role="img" aria-label="Balance over your last ${pts.length} transactions">
      <line x1="${pad}" x2="${w - pad}" y1="${ys(0).toFixed(1)}" y2="${ys(0).toFixed(1)}" class="wl-zero"/>
      <polygon points="${xs(0).toFixed(1)},${h - pad} ${line} ${xs(last).toFixed(1)},${h - pad}" class="wl-area"/>
      <polyline points="${line}" class="wl-line"/>
      <circle cx="${xs(last).toFixed(1)}" cy="${ys(pts[last]).toFixed(1)}" r="3.5" class="wl-dot"/>
    </svg>`;
  }

  function pageWallet() {
    const sorted = [...state.tx].sort((a, b) => b.t - a.t);
    const today = dayOf(state.t);
    const todayDelta = round2(state.tx.filter((x) => x.t >= 0 && dayOf(x.t) === today).reduce((n, x) => n + x.amount, 0));
    const rows = sorted.map((x, i) => {
      const out = x.amount < 0;
      const [who, note] = x.memo.split(' · ');
      const block = 18442107 + Math.max(0, x.t) * 5 + (sorted.length - i);
      return `<li class="wl-tx">
        <span class="wl-dir ${out ? 'out' : 'in'}" aria-hidden="true">${out ? '↗' : '↙'}</span>
        <span class="wl-what"><b>${esc(who)}</b><small>${note ? esc(note) : out ? 'Transfer out' : 'Transfer in'}</small></span>
        <span class="wl-meta"><code>${txHash(x)}</code><small>${x.t < 0 ? 'before Day 1' : stamp(x.t)} · block ${block.toLocaleString('en-US')}</small></span>
        <span class="wl-amt ${out ? 'neg' : 'pos'}">${out ? '' : '+'}${fmtCoin(x.amount)}<small class="wl-ok">Confirmed</small></span>
      </li>`;
    }).join('');
    const live = Object.values(state.repos).filter((r) => r.deployed).length;
    const yc = S.y && S.y.creator;
    const income = Object.keys(state.apps).reduce((n, k) => n + (state.repos[k] && state.repos[k].deployed ? appEarnings(k) : 0), 0)
      + (yc && state.creatorOn && state.followers >= yc.minFollowers ? round2(state.followers * yc.perFollower) : 0);
    const nightly = round2(income - E.living.amount - live * E.hostingPerDay);
    const rentLeft = E.rent ? E.rent.day - today : null;
    const rentLine = E.rent && rentLeft >= 0
      ? `<div class="wl-up"><span>Rent · ${esc(E.rent.payee)}</span><b class="neg">${fmtCoin(-E.rent.amount)}</b><small>${rentLeft === 0 ? 'Executes tonight' : `Executes end of Day ${E.rent.day} · T−${rentLeft}d`}</small></div>`
      : '';
    const action = (id, icon, label) => `<button class="wl-action" data-wallet="${id}"><span>${icon}</span>${label}</button>`;
    return `<div class="wl">
      <header class="wl-top">
        <div class="wl-logo"><span class="wl-logo-tile">${ICONS.wallet}</span><span>Satchel</span></div>
        <span class="wl-net"><i></i>Mainnet · 14 gwei</span>
        <span class="wl-acct">${identicon(WALLET_ADDR)}<code id="wl-addr-text">${shortAddr(WALLET_ADDR)}</code><button class="wl-copy" data-copy-addr aria-label="Copy wallet address">Copy</button></span>
      </header>
      <div class="wl-wrap">
        <section class="wl-hero">
          <div class="wl-hero-top">
            <div>
              <p class="wl-label">Total balance</p>
              <p class="wl-balance ${state.money < 0 ? 'neg' : ''}">${fmtMoney(state.money)}</p>
              <p class="wl-sub">${fmtCoin(state.money)} <span class="${todayDelta < 0 ? 'neg' : 'pos'}">${todayDelta >= 0 ? '+' : ''}${fmtMoney(todayDelta)} today</span></p>
            </div>
            ${sparkline(balanceHistory())}
          </div>
          <div class="wl-actions">
            ${action('receive', '↙', 'Receive')}${action('send', '↗', 'Send')}${action('swap', '⇄', 'Swap')}${action('buy', '+', 'Buy')}
          </div>
        </section>
        <section class="wl-panel wl-assets">
          <h2>Tokens</h2>
          <table class="wl-table">
            <thead><tr><th>Asset</th><th class="r">Price</th><th class="r">24h</th><th class="r">Value</th></tr></thead>
            <tbody>
              <tr><td><span class="wl-asset"><span class="wl-tok dolr">D</span><span><b>DOLR</b><small>Dollar stablecoin</small></span></span></td><td class="r">$1.00</td><td class="r">0.00%</td><td class="r"><b>${fmtMoney(state.money)}</b><small>${fmtCoin(state.money)}</small></td></tr>
              <tr><td><span class="wl-asset"><span class="wl-tok cat">M</span><span><b>MOONCAT</b><small>Bought at the top</small></span></span></td><td class="r">$0.0000001</td><td class="r neg">−99.4%</td><td class="r"><b>$0.42</b><small>4,200,000 MOONCAT</small></td></tr>
            </tbody>
          </table>
        </section>
        <section class="wl-panel wl-auto">
          <h2>Scheduled</h2>
          ${rentLine}
          <div class="wl-up"><span>Nightly settlement</span><b class="${nightly < 0 ? 'neg' : 'pos'}">${nightly >= 0 ? '+' : ''}${fmtCoin(nightly)}</b><small>Food ${fmtCoin(-E.living.amount)}${live ? ` · Hosting ${fmtCoin(-live * E.hostingPerDay)}` : ''}${income ? ` · App income +${fmtCoin(income)}` : ''}</small></div>
        </section>
        <section class="wl-panel wl-activity">
          <h2>Activity <span>${state.tx.length} transactions</span></h2>
          <ul class="wl-list">${rows}</ul>
        </section>
      </div>
    </div>`;
  }

  function mailTime(t) {
    if (t < 0) return 'Earlier';
    return dayOf(t) === dayOf(state.t) ? clock(t) : `Day ${dayOf(t)}`;
  }

  function mailBody(text) {
    return linkify(esc(tpl(text))).replace(/\n/g, '<br>');
  }

  function pageMail(r) {
    const inbox = state.mail.filter((m) => m.folder === 'inbox').sort((a, b) => b.t - a.t);
    const sent = state.mail.filter((m) => m.folder === 'sent').sort((a, b) => b.t - a.t);
    const unread = unreadMail();
    const view = r.view || 'inbox';
    const side = `<nav class="qm-side" aria-label="Folders">
      <a href="#" class="qm-new" data-nav="qmail.com/compose">Compose</a>
      <a href="#" data-nav="qmail.com" class="${view === 'inbox' ? 'on' : ''}">Inbox${unread ? `<b>${unread}</b>` : ''}</a>
      <a href="#" data-nav="qmail.com/sent" class="${view === 'sent' ? 'on' : ''}">Sent</a>
    </nav>`;
    let main;
    if (view === 'compose') {
      const d = draft || { to: '', subject: '', body: '' };
      main = `<form class="qm-compose" data-form="mail">
        <h1 class="qm-h">New message</h1>
        <label class="qm-field"><span>To</span><input id="mail-to" list="qm-contacts" autocomplete="off" spellcheck="false" value="${esc(d.to)}" placeholder="name@example.com"></label>
        <datalist id="qm-contacts">${contacts().map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
        <label class="qm-field"><span>Subject</span><input id="mail-subject" autocomplete="off" value="${esc(d.subject)}"></label>
        <textarea id="mail-body" rows="10" aria-label="Message">${esc(d.body)}</textarea>
        <p class="qm-wait" id="mail-wait"${state.awaiting[String(d.to).trim().toLowerCase()] ? '' : ' hidden'}>You already wrote to this address. You can send another message once they reply.</p>
        <div class="qm-actions"><button class="qm-btn" type="submit" id="mail-send"${state.awaiting[String(d.to).trim().toLowerCase()] ? ' disabled' : ''}>Send</button><button class="qm-btn ghost" type="button" data-mail-discard>Discard</button><span class="qm-hint">Sending is free and takes 5 minutes. One message per person until they reply.</span></div>
      </form>`;
    } else if (view === 'msg') {
      const entry = state.mail.find((m) => m.id === r.id);
      if (!entry) {
        main = `<p class="qm-empty">This message doesn't exist.</p>`;
      } else {
        const d = mailDef(entry);
        const mine = entry.folder === 'sent';
        const canReply = !mine && d.addr && !/no-?reply|mailer-daemon/.test(d.addr);
        main = `<article class="qm-read">
          <p class="qm-crumbs"><a href="#" data-nav="${mine ? 'qmail.com/sent' : 'qmail.com'}">${mine ? 'Sent' : 'Inbox'}</a></p>
          <h1 class="qm-h">${esc(tpl(d.subject))}</h1>
          <p class="qm-meta"><span>${mine
            ? `<b>${esc(S.start.player.name)}</b> &lt;${esc(playerAddr())}&gt; to <b>${esc(d.to)}</b>`
            : `<b>${esc(tpl(d.from))}</b> &lt;${esc(d.addr)}&gt; to ${esc(playerAddr())}`}</span><span>${esc(stampOrEarlier(entry.t))}</span></p>
          <div class="qm-body">${mailBody(d.body)}</div>
          ${d.generated ? `<p class="qm-gen">Reply written by ${esc(LLM ? LLM.label() : 'the local model')}</p>` : ''}
          ${canReply ? `<div class="qm-actions">${state.awaiting[d.addr]
            ? `<button class="qm-btn" disabled>Reply</button><span class="qm-hint">Waiting on their reply to your last message.</span>`
            : `<button class="qm-btn" data-reply="${esc(entry.id)}">Reply</button>`}</div>` : ''}
        </article>`;
      }
    } else {
      const list = view === 'sent' ? sent : inbox;
      const rows = list.map((m) => {
        const d = mailDef(m);
        const who = m.folder === 'sent' ? `To: ${d.to}` : tpl(d.from);
        const latestTo = m.folder === 'sent' && state.awaiting[d.to] && sent.find((x) => mailDef(x).to === d.to) === m;
        const snippet = tpl(d.body || '').replace(/\s+/g, ' ').slice(0, 90);
        return `<a href="#" class="qm-row${m.read ? '' : ' unread'}" data-nav="qmail.com/m/${esc(m.id)}">
          <span class="qm-from">${esc(who)}</span>
          <span class="qm-subj"><b>${esc(tpl(d.subject))}</b> <span>${esc(snippet)}</span></span>
          <span class="qm-time">${latestTo ? '<span class="qm-pill">Awaiting reply</span>' : ''}${esc(mailTime(m.t))}</span>
        </a>`;
      }).join('');
      main = `<h1 class="qm-h">${view === 'sent' ? 'Sent' : 'Inbox'}</h1>${rows ? `<div class="qm-list">${rows}</div>` : `<p class="qm-empty">${view === 'sent' ? 'Nothing sent yet.' : 'No mail.'}</p>`}`;
    }
    return `<div class="qm">
      <header class="qm-top"><div class="qm-logo">${ICONS.mail}<span>Qmail</span></div><span class="qm-user">${esc(playerAddr())}</span></header>
      <div class="qm-wrap">${side}<main class="qm-main">${main}</main></div>
    </div>`;
  }

  function stampOrEarlier(t) { return t < 0 ? 'Before Day 1' : stamp(t); }

  function repoStatus(name) {
    const r = state.repos[name];
    if (!r.deployed) return `<span class="fy-pill off">Not deployed</span>`;
    return `<span class="fy-pill on">Live</span> <a href="#" data-nav="${name}.forkyard.app" class="fy-url">${name}.forkyard.app</a>`;
  }

  function pageForkyard(repoName) {
    const names = Object.keys(state.repos).sort((a, b) => state.repos[b].createdAt - state.repos[a].createdAt);
    const head = `<header class="fy-top"><div class="fy-logo">${ICONS.forkyard}<span>forkyard</span></div><span class="fy-user">@${esc(S.start.player.handle)}</span></header>`;
    if (repoName) {
      const r = state.repos[repoName];
      const def = S.repos[repoName];
      if (!r || !def) return `<div class="fy">${head}<div class="fy-wrap"><p class="fy-empty">404 — no repository called <code>${esc(repoName)}</code>.</p></div></div>`;
      const app = state.apps[repoName];
      return `<div class="fy">${head}<div class="fy-wrap">
        <p class="fy-crumbs"><a href="#" data-nav="forkyard.com">${esc(S.start.player.handle)}</a> / <b>${esc(repoName)}</b></p>
        <p class="fy-desc">${esc(def.description)}</p>
        <div class="fy-grid">
          <div class="fy-files">
            <div class="fy-filehead">Pushed by <b>agent[bot]</b> · ${ago(r.createdAt)} ago</div>
            ${def.files.map((f) => `<div class="fy-file">${esc(f)}</div>`).join('')}
            <pre class="fy-code"><code>${esc(r.broken && def.broken ? def.broken.snippet : def.snippet)}</code></pre>
          </div>
          <div class="fy-deploy">
            <h2>Deployment</h2>
            <p>${repoStatus(repoName)}</p>
            ${r.deployed
              ? `<dl><dt>Visitors / day</dt><dd>${appVisitors(repoName)}</dd><dt>Earnings / day</dt><dd>${fmtMoney(appEarnings(repoName))}</dd><dt>Hosting / day</dt><dd>${fmtMoney(E.hostingPerDay)}</dd></dl><button class="fy-btn ghost" data-takedown="${esc(repoName)}">Take down</button>`
              : `<p class="fy-note">Hosting costs ${fmtMoney(E.hostingPerDay)}/day, billed nightly.</p><button class="fy-btn" data-deploy="${esc(repoName)}">Deploy</button>`}
          </div>
        </div>
      </div></div>`;
    }
    const list = names.length
      ? names.map((n) => {
          const def = S.repos[n] || { description: '', lang: '' };
          const r = state.repos[n];
          return `<article class="fy-repo">
            <div><a href="#" data-nav="forkyard.com/${n}" class="fy-name">${esc(n)}</a><p>${esc(def.description)}</p>
            <small><i class="fy-lang" style="--h:${hashHue(def.lang)}"></i>${esc(def.lang)} · updated ${ago(r.createdAt)} ago</small></div>
            <div class="fy-repo-act">${repoStatus(n)}${r.deployed ? '' : `<button class="fy-btn" data-deploy="${esc(n)}">Deploy</button>`}</div>
          </article>`;
        }).join('')
      : `<div class="fy-empty"><p><b>No repositories yet.</b></p><p>You haven't written code in two years. Maybe something else could.</p></div>`;
    return `<div class="fy">${head}<div class="fy-wrap"><h1 class="fy-h">Repositories <span>${names.length}</span></h1>${list}</div></div>`;
  }

  // Visitors who stick around: almost nobody stays on a broken app.
  function appVisitors(repo) {
    const app = state.apps[repo];
    if (!app) return 0;
    const r = state.repos[repo];
    if (r && r.broken) return Math.round(app.users * 0.04);
    return blockingDefects(repo).length ? Math.round(app.users * 0.5) : app.users;
  }
  // nobody pays for an app that's broken or still has defects (pending update requests still pay)
  const appEarnings = (repo) => (state.repos[repo] && (state.repos[repo].broken || blockingDefects(repo).length) ? 0 : (state.apps[repo] || {}).perDay || 0);

  function pageApp(repo) {
    const r = state.repos[repo];
    const def = S.repos[repo];
    if (!r || !r.deployed || !def) {
      return `<div class="err"><h1>404: NOT_FOUND</h1><p>Nothing is deployed at <code>${esc(repo)}.forkyard.app</code>.</p></div>`;
    }
    if (r.broken && def.broken) return `<div class="pv-host">${def.broken.preview}</div>`;
    // base slots, then updates already shipped, then whatever is broken right now
    const slots = Object.assign({}, def.preview.slots || {}, r.slots || {});
    for (const id of openDefects(repo)) {
      const d = defectDef(repo, id);
      if (!d || d.kind === 'update') continue;   // a pending request doesn't change the page
      if (d.page) return `<div class="pv-host">${tpl(d.page)}</div>`;
      if (d.slot) slots[d.slot] = d.html;
    }
    const html = def.preview.html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in slots ? tpl(slots[k]) : ''));
    return `<div class="pv-host">${html}</div>`;
  }

  function pageError(url) {
    return `<div class="err"><h1>This site can't be reached</h1><p><code>${esc(url)}</code> didn't respond.</p><p class="err-sub">Try the bookmarks. They are the only sites you can afford.</p></div>`;
  }

  function pageAgent() {
    const msgs = state.chat.map((m, i) => {
      if (m.from === 'system') return `<div class="ua-sys">${richText(m.text)}</div>`;
      if (m.from === 'you') return `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div><span class="ua-cost">${fmtMoney(-m.cost)} · ${esc(modelDef(m.model || 1).name)} · ${clock(m.t)}</span></div>`;
      const typing = anim && anim.idx === i;
      const shown = typing ? m.text.slice(0, anim.shown) : m.text;
      const src = m.src ? `<span class="ua-src ${m.src.split(':')[0]}">${esc(m.src)}</span>` : '';
      const model = m.src === 'miss:llm' ? `<span class="ua-model" title="Generated by the local model">${esc(LLM ? LLM.label() : 'local model')}</span>` : '';
      return `<div class="ua-msg agent" data-msg="${i}"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text${typing ? ' typing' : ''}">${richText(shown)}</div>${model}${src}</div>`;
    }).join('');
    const thinking = busy ? `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>` : '';
    return `<div class="ua">
      <header class="ua-head">
        <div class="ua-brand">${ICONS.agent}<div><b>agent</b><span>${esc(modelDef(state.model).name)} · ${fmtMoney(modelDef(state.model).promptBase)} per prompt + ${fmtMoney(modelDef(state.model).perWord)} per word</span></div></div>
        <span class="ua-linked"><a href="#" data-nav="agent.chat/models" class="ua-upgrade">${state.owned < S.models.length ? 'Upgrade model' : 'Models'}</a> · Billing: Satchel ${shortAddr(WALLET_ADDR)}</span>
      </header>
      <div class="ua-llm"><span class="ua-jev" id="ua-jev">${jevChip()}</span>${LLM ? `<span class="ua-llm-ctl" id="ua-llm">${llmRow()}</span>` : ''}</div>
      <div class="ua-log" id="ua-log">${msgs}${thinking}</div>
      <form class="ua-compose" data-form="prompt">
        <textarea id="prompt-input" rows="2" placeholder="Tell agent what to do" ${busy || state.over ? 'disabled' : ''}></textarea>
        <div class="ua-row">
          <label class="ua-model-pick"><span class="sr-only">Model</span><select id="model-pick" ${busy ? 'disabled' : ''}>${S.models.slice(0, state.owned).map((m, i) => `<option value="${i + 1}" ${state.model === i + 1 ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
          <span id="cost-est" class="ua-est"></span><button class="ua-send" type="submit" ${busy || state.over ? 'disabled' : ''}>Send</button>
        </div>
      </form>
    </div>`;
  }

  // agent.chat/models: the tier ladder. Tiers unlock in order.
  function pageModels() {
    const cards = S.models.map((m, i) => {
      const level = i + 1;
      const owned = level <= state.owned;
      const next = level === state.owned + 1;
      let action;
      if (owned && level === state.model) action = '<span class="gm-pill on">In use</span>';
      else if (owned) action = `<button class="gm-btn ghost" data-use-model="${level}">Use</button>`;
      else if (next) action = `<button class="gm-btn" data-buy-model="${level}" ${state.money < m.price ? 'disabled' : ''}>Unlock · ${fmtMoney(m.price)}</button>${state.money < m.price ? `<small>You have ${fmtMoney(state.money)}</small>` : ''}`;
      else action = `<span class="gm-pill">Unlock ${esc(modelDef(level - 1).name)} first</span>`;
      return `<article class="gm-card${owned ? ' owned' : ''}${level === state.model ? ' active' : ''}">
        <header><h2>${esc(m.name)}</h2><span class="gm-meter" aria-label="Tier ${level} of ${S.models.length}">${S.models.map((_, j) => `<i class="${j < level ? 'on' : ''}"></i>`).join('')}</span></header>
        <p>${esc(m.blurb)}</p>
        <dl><dt>Per prompt</dt><dd>${fmtMoney(m.promptBase)}</dd><dt>Per word</dt><dd>${fmtMoney(m.perWord)}</dd><dt>Unlock</dt><dd>${m.price ? fmtMoney(m.price) : 'Included'}</dd></dl>
        <div class="gm-act">${action}</div>
      </article>`;
    }).join('');
    return `<div class="ua gm">
      <header class="ua-head">
        <div class="ua-brand">${ICONS.agent}<div><b>Models</b><span>Stronger models take on harder jobs. Every prompt costs more.</span></div></div>
        <span class="ua-linked"><a href="#" data-nav="agent.chat" class="ua-upgrade">Back to chat</a></span>
      </header>
      <div class="gm-grid">${cards}</div>
      <p class="gm-note">Upgrades are charged once to your Satchel wallet, ${shortAddr(WALLET_ADDR)}. You can switch between models you own at any time.</p>
    </div>`;
  }

  // Off-script replies come from a small local model when one is loaded (src/llm.js).
  function llmRow() {
    const st = LLM.settings;
    const opt = (v, l) => `<option value="${v}" ${st.backend === v ? 'selected' : ''}>${l}</option>`;
    let status = '';
    let action = '';
    if (st.backend === 'off') {
      status = 'Off-script prompts get canned replies.';
    } else if (LLM.status === 'off') {
      status = st.backend === 'browser' ? 'Not loaded. Downloads once, then loads from your browser cache.' : 'Not connected.';
      action = `<button class="ua-llm-btn" data-llm="load">${st.backend === 'browser' ? 'Load model' : 'Connect'}</button>`;
    } else if (LLM.status === 'loading') {
      const mb = (n) => (n / 1048576).toFixed(0);
      const bytes = LLM.totalBytes ? ` · ${mb(LLM.loadedBytes)} / ${mb(LLM.totalBytes)} MB` : '';
      status = `<span class="ua-llm-bar"><i style="width:${Math.max(2, LLM.progress).toFixed(1)}%"></i></span>${LLM.totalBytes ? `${LLM.progress.toFixed(0)}%${bytes}` : esc(LLM.detail)}`;
      action = `<button class="ua-llm-btn ghost" data-llm="cancel">Cancel</button>`;
    } else if (LLM.status === 'ready') {
      status = `<span class="ua-llm-dot"></span>Ready · ${esc(LLM.detail)}`;
    } else if (LLM.status === 'error') {
      status = `<span class="ua-llm-err">${esc(LLM.detail)}</span>`;
      action = `<button class="ua-llm-btn" data-llm="retry">Retry</button>`;
    }
    return `<label class="ua-llm-pick">Off-script replies
        <select id="llm-backend">${opt('browser', 'Gemma 3 270M · in browser')}${opt('ollama', 'Gemma 3 270M · Ollama')}${opt('off', 'Canned placeholders')}</select></label>
      <span class="ua-llm-status">${status}</span>${action}`;
  }

  function jevChip() {
    if (J.status === 'online') return `<span class="ua-llm-dot"></span>Story decisions: Jev`;
    if (J.status === 'checking') return 'Story decisions: connecting…';
    return `<span class="ua-llm-dot off"></span><span title="${esc(J.reason)}">Story decisions: offline keywords</span>`;
  }

  function onJevChange() {
    const chip = document.getElementById('ua-jev');
    if (chip) chip.innerHTML = jevChip();
    if (devOpen) renderDev();
  }

  function onLlmChange() {
    const row = document.getElementById('ua-llm');
    if (row) row.innerHTML = llmRow();
    if (devOpen) renderDev();
  }

  // ───────────────────────── typewriter ─────────────────────────

  function startTyping(idx) {
    if (anim && anim.timer) clearInterval(anim.timer);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { anim = null; return; }
    anim = { idx, shown: 0 };
    anim.timer = setInterval(() => {
      const m = state.chat[idx];
      if (!m) { stopTyping(); return; }
      anim.shown = Math.min(m.text.length, anim.shown + 3);
      const el = document.querySelector(`[data-msg="${idx}"] .ua-text`);
      if (el) {
        el.innerHTML = richText(m.text.slice(0, anim.shown));
        scrollLog();
      }
      if (anim.shown >= m.text.length) stopTyping();
    }, 16);
  }
  function stopTyping() {
    if (!anim) return;
    clearInterval(anim.timer);
    const el = document.querySelector(`[data-msg="${anim.idx}"] .ua-text`);
    anim = null;
    if (el) { el.classList.remove('typing'); }
    if (onSite('agent')) render();
  }
  function scrollLog() {
    const log = $('#ua-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  // ───────────────────────── chrome render ─────────────────────────

  function updateCostEstimate() {
    const input = $('#prompt-input');
    const est = $('#cost-est');
    if (!input || !est) return;
    const words = wordCount(input.value);
    const m = modelDef(state.model);
    est.textContent = words
      ? `${fmtMoney(promptCost(input.value))} · ${words} word${words > 1 ? 's' : ''} · ${E.promptHours}h`
      : `${m.name}: ${fmtMoney(m.promptBase)} + ${fmtMoney(m.perWord)}/word, ${E.promptHours}h per prompt`;
    est.classList.toggle('neg', words > 0 && promptCost(input.value) > state.money);
  }

  function render() {
    const tab = state.tabs.find((x) => x.id === state.active) || state.tabs[0];
    const r = route(tab.url);

    $('#tabs').innerHTML = state.tabs.map((x) => {
      const rr = route(x.url);
      return `<div class="tab${x.id === state.active ? ' on' : ''}" data-tab="${x.id}" role="tab" aria-selected="${x.id === state.active}" tabindex="0">
        <span class="tab-ico ico-${rr.site}">${ICONS[rr.site] || ICONS.newtab}</span><span class="tab-title">${esc(rr.title)}</span>
        <button class="tab-x" data-close="${x.id}" aria-label="Close tab">×</button></div>`;
    }).join('') + `<button class="tab-new" data-newtab aria-label="New tab">+</button>`;

    const addr = $('#address');
    if (document.activeElement !== addr) addr.value = r.site === 'newtab' ? '' : normalizeUrl(tab.url);

    $('#bookmarks').innerHTML = bookmarkList().map(([k, s]) =>
      `<button class="bm" data-nav="${s.url}"><span class="bm-ico ico-${k}">${ICONS[k]}</span><span class="bm-label">${esc(s.label)}</span>${badgeCount(k) ? `<i class="badge">${badgeCount(k)}</i>` : ''}</button>`
    ).join('');

    // preserve what the player was typing across re-renders
    const vp = $('#viewport');
    const keep = {};
    let focusId = null;
    vp.querySelectorAll('textarea[id], input[id]').forEach((el) => { keep[el.id] = el.value; });
    if (document.activeElement && vp.contains(document.activeElement)) focusId = document.activeElement.id;

    let html;
    switch (r.site) {
      case 'y': html = pageY(r); break;
      case 'yowl': html = pageYowl(r); break;
      case 'mail': html = pageMail(r); break;
      case 'wallet': html = pageWallet(); break;
      case 'forkyard': html = pageForkyard(r.repo); break;
      case 'agent': html = r.page === 'models' ? pageModels() : pageAgent(); break;
      case 'app': html = pageApp(r.repo); break;
      case 'newtab': html = pageNewTab(); break;
      case 'weightroom': html = pageWeightroom(); break;
      case 'terminal': html = pageTerminal(); break;
      case 'nullboard': html = pageNullboard(r); break;
      case 'cellar': html = pageCellar(); break;
      case 'gate': html = pageGate(r); break;
      default: html = pageError(tab.url);
    }
    const prevSite = vp.dataset.site;
    vp.innerHTML = html;
    vp.dataset.site = r.site;
    if (prevSite !== r.site) vp.scrollTop = 0;
    for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && !el.disabled) el.value = v; }
    if (focusId) { const el = document.getElementById(focusId); if (el && !el.disabled) el.focus(); }
    if (r.site === 'terminal') {
      const log = $('#tm-log');
      if (log) log.scrollTop = log.scrollHeight;
      vp.scrollTop = vp.scrollHeight;
      const input = $('#term-input');
      if (input && !termBusy && window.innerWidth > 700) input.focus();
    }
    if (r.site === 'agent') {
      updateCostEstimate();
      scrollLog();
      const input = $('#prompt-input');
      if (input && !busy && !focusId && window.innerWidth > 700) input.focus();
    }

    // taskbar
    $('#objective').textContent = currentNode().objective || '';
    $('#wallet').textContent = fmtMoney(state.money);
    $('#wallet').classList.toggle('neg', state.money < 20);
    $('#clock').innerHTML = `<b>${weekday(state.t)} ${clock(state.t)}</b><span>Day ${dayOf(state.t)}</span>`;
    const rentLeft = E.rent ? E.rent.day - dayOf(state.t) : -1;
    $('#rent').textContent = rentLeft >= 0 ? (rentLeft === 0 ? `Rent ${fmtMoney(E.rent.amount)} due tonight` : `Rent ${fmtMoney(E.rent.amount)} in ${rentLeft}d`) : 'Rent paid';
    $('#rent').classList.toggle('neg', rentLeft >= 0 && state.money < E.rent.amount);

    renderOverlay();
    if (devOpen) renderDev();
  }

  // ───────────────────────── overlays ─────────────────────────

  let confirmState = null;
  let introOpen = false;

  function statsHtml() {
    const s = state.stats;
    return `<dl class="ov-stats">
      <div><dt>Day</dt><dd>${dayOf(state.t)}</dd></div>
      <div><dt>Balance</dt><dd>${fmtMoney(state.money)}</dd></div>
      <div><dt>Prompts</dt><dd>${s.prompts}</dd></div>
      <div><dt>Spent on prompts</dt><dd>${fmtMoney(s.promptSpend)}</dd></div>
      <div><dt>Wasted prompts</dt><dd>${s.misses + (s.locked || 0)}</dd></div>
      <div><dt>Best model</dt><dd>${esc(modelDef(state.owned).name)}</dd></div>
    </dl>`;
  }

  function renderOverlay() {
    const ov = $('#overlay');
    let html = '';
    if (introOpen) {
      const hasSave = !!load() && state.stats.prompts + state.userPosts.length > 0;
      html = `<div class="ov-card ov-intro">
        <p class="ov-eyebrow">${esc(S.chapter)}</p>
        <h1 class="ov-title">Unknown<br>Agent</h1>
        <p>You lost your job two years ago. The benefits ran out last week. You have ${fmtMoney(S.start.money)}, a laptop, five bookmarks, and agent, an AI chatbot that bills you for every word.</p>
        <p>Rent is ${fmtMoney(E.rent.amount)}, due at the end of Day ${E.rent.day}. Don't go broke.</p>
        <ul class="ov-rules">
          <li>Every prompt costs money and an hour. Vague prompts get vague answers.</li>
          <li>Some jobs need a stronger model. Upgrades cost money upfront and make every prompt pricier.</li>
          <li>Read Y for leads. Check Qmail and your wallet. Ship code on Forkyard.</li>
          <li>Anything you can do yourself, do yourself. It's free.</li>
        </ul>
        <div class="ov-actions">
          ${hasSave ? `<button class="btn primary" data-ov="continue">Continue Day ${dayOf(state.t)}</button><button class="btn" data-ov="new">New game</button>` : `<button class="btn primary" data-ov="continue">Open the laptop</button>`}
        </div>
      </div>`;
    } else if (confirmState) {
      html = `<div class="ov-card ov-small"><p>${esc(confirmState.text)}</p><div class="ov-actions"><button class="btn primary" data-ov="confirm-yes">${esc(confirmState.yes)}</button><button class="btn" data-ov="confirm-no">Cancel</button></div></div>`;
    } else if (state.over) {
      html = `<div class="ov-card ov-over"><p class="ov-eyebrow">Game over</p><h1 class="ov-title">${esc(state.over.title)}</h1><p>${esc(state.over.text)}</p>${statsHtml()}<div class="ov-actions"><button class="btn primary" data-ov="restart">Start over</button></div></div>`;
    } else if (state.morning) {
      const m = state.morning;
      html = `<div class="ov-card ov-small ov-morning">
        <p class="ov-eyebrow">${m.passedOut ? 'You passed out at your desk' : 'You slept'}</p>
        <h2>Day ${m.day} · ${DAYS[(m.day - 1) % 7]} ${clock(E.wakeHour * 60)}</h2>
        <table class="ov-lines">${m.lines.map(([l, v]) => (v == null
          ? `<tr class="note"><td colspan="2">${esc(l)}</td></tr>`
          : `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</td></tr>`)).join('')}
        <tr class="tot"><td>Balance</td><td>${fmtMoney(m.balance)}</td></tr></table>
        <div class="ov-actions"><button class="btn primary" data-ov="morning">Get up</button></div></div>`;
    } else if (state.ended && !state.endSeen) {
      html = `<div class="ov-card ov-end"><p class="ov-eyebrow">${esc(S.title)}</p><h1 class="ov-title">${esc(state.ended.title)}</h1><p>${esc(state.ended.text)}</p>${statsHtml()}
        <div class="ov-actions"><button class="btn primary" data-ov="end-ok">Read the message</button><button class="btn" data-ov="restart">Play again</button></div></div>`;
    }
    ov.innerHTML = html;
    ov.hidden = !html;
  }

  function askConfirm(text, yes, fn) {
    confirmState = { text, yes, fn };
    renderOverlay();
  }

  // ───────────────────────── toasts ─────────────────────────

  function toast(title, body, kind) {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast t-${kind || 'note'}`;
    el.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
  }

  // ───────────────────────── dev panel ─────────────────────────

  function meterRows() {
    return `<table class="dv-meters">${M.defs(S).map((d) => {
      const v = M.value(state, S, d.id);
      const lo = d.min != null ? d.min : 0, hi = d.max != null ? d.max : Math.max(v, 1);
      const band = M.band(d.group === 'relationship' ? { bands: S.relationshipBands } : d, v);
      const pct = d.source ? null : Math.round(((v - lo) / (hi - lo)) * 100);
      return `<tr><td>${esc(d.label)}</td><td>${d.id === 'money' ? fmtMoney(v) : v}</td><td>${pct == null ? '' : `<span class="dv-meter"><i style="width:${pct}%"></i>${lo < 0 ? '<b></b>' : ''}</span>`}</td><td class="dv-dim">${band ? esc(band.label) : ''}</td></tr>`;
    }).join('')}</table>
    <div class="dv-row">${M.defs(S).filter((d) => !d.source).map((d) => `<button data-dev="meter:${d.id}:10" title="+10 ${esc(d.label)}">${esc(d.id)} +10</button>`).join('')}</div>`;
  }

  function renderDev() {
    const d = $('#dev');
    d.hidden = !devOpen;
    document.body.classList.toggle('dev-on', devOpen);
    if (!devOpen) return;
    let report = '<p class="dv-dim">No prompt yet.</p>';
    if (lastReport) {
      const { decision } = lastReport;
      let table;
      if (decision.engine === 'jev') {
        const rows = Object.entries(decision.probabilities || {})
          .sort((a, b) => b[1] - a[1])
          .map(([id, p]) => `<tr class="${id === decision.choice ? 'win' : ''}"><td>${esc(id)}</td><td>${(p * 100).toFixed(1)}%</td><td><span class="dv-bar" style="width:${Math.round(p * 100)}%"></span></td></tr>`)
          .join('');
        table = `<table class="dv-probs"><thead><tr><th>branch</th><th>p</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3">no candidates</td></tr>'}</tbody></table>
          <p class="dv-dim">hit ≥ ${S.decision.hit} · nudge ≥ ${S.decision.partial}</p>`;
      } else {
        const rows = (decision.report || [])
          .slice()
          .sort((a, b) => (b.coverage - a.coverage) || (b.score - a.score))
          .map((r) => `<tr class="${decision.branch === r.branch ? 'win' : ''}"><td>${esc(r.branch.id)}</td><td>${r.vetoed ? 'veto: ' + esc(r.vetoed) : Math.round(r.coverage * 100) + '%'}</td><td>${r.score}</td><td>${esc((r.hits || []).join(', '))}</td></tr>`)
          .join('');
        table = `<table><thead><tr><th>branch</th><th>cover</th><th>score</th><th>hits</th></tr></thead><tbody>${rows || '<tr><td colspan="4">no candidates</td></tr>'}</tbody></table>`;
      }
      const engine = decision.engine === 'jev' ? `Jev${J.last && J.last.model ? ' · ' + esc(J.last.model) : ''}${J.last ? ` · ${J.last.ms}ms` : ''}` : `keywords${decision.fellBack ? ' (Jev call failed: ' + esc((J.last && J.last.error) || '?') + ')' : ''}`;
      report = `<p><b>${{ post: 'Y post', mail: 'Email', local: 'Local model', review: 'Yowl review' }[lastReport.channel] || 'Prompt'}:</b> ${esc(lastReport.prompt)}</p>
        <p><b>Result:</b> ${decision.kind}${decision.branch ? ' → ' + esc(decision.branch.id) : ''}${decision.kind === 'locked' ? (decision.lockReason === 'followers' ? ` (needs ${decision.branch.minFollowers} followers)` : ` (needs ${esc(modelDef(decision.branch.minModel).name)}, had ${esc(modelDef(lastReport.model || 1).name)})`) : ''}${decision.stale ? ' (stale, ignored)' : ''} <span class="dv-dim">(node ${esc(lastReport.node)} · ${engine})</span></p>
        ${table}`;
    }
    const nodes = Object.keys(S.nodes).map((n) => `<option ${n === state.node ? 'selected' : ''}>${n}</option>`).join('');
    d.innerHTML = `<header><b>jev · dev</b><button data-dev="close" aria-label="Close dev panel">×</button></header>
      <label>Node <select id="dv-node">${nodes}</select></label>
      <div class="dv-row"><button data-dev="money+">+$100</button><button data-dev="money-">−$100</button><button data-dev="hour">+1h</button><button data-dev="sleep">Sleep</button><button data-dev="posts">All posts</button><button data-dev="model">Free next model</button><button data-dev="followers">+50 followers</button></div>
      <p><b>Decisions</b> ${J.status === 'online' ? 'Jev · ' + esc(J.model || '') : esc(J.status) + (J.reason ? ' · ' + esc(J.reason) : '')}</p>
      <p><b>Model</b> ${esc(modelDef(state.model).name)} active · ${esc(modelDef(state.owned).name)} owned · <b>Followers</b> ${state.followers}${lastReport && lastReport.rating ? ` · last post rated ${lastReport.rating.score.toFixed(2)} (${esc(lastReport.rating.engine)})` : ''}</p>
      <p><b>Open defects</b> <code>${esc(Object.entries(state.repos).map(([k, r]) => `${k}: ${(r.defects || []).join(', ') || 'none'}${r.broken ? ' (BROKEN)' : ''}`).join(' · ') || 'no repos')}</code></p>
      <h3>Meters</h3>${meterRows()}
      <p><b>Heading for</b> ${(() => { const e = M.ending(S, check); return e ? `<code>${esc(e.id)}</code> · ${esc(e.title)}` : 'no ending'; })()}</p>
      ${state.meterLog.length ? `<p class="dv-dim">recent: ${state.meterLog.slice(-6).reverse().map((c) => `${esc(c.id)} ${c.after > c.before ? '+' : ''}${c.after - c.before}`).join(' · ')}</p>` : ''}
      <p><b>Flags</b> <code>${esc(JSON.stringify(state.flags))}</code></p>
      <p><b>Sites found</b> ${state.discovered.length ? esc(state.discovered.join(', ')) : 'none'} <button data-dev="sites">unlock all</button></p>
      <p><b>Derived</b> <code>${esc(Object.entries(S.flags || {}).filter(([, d]) => d.when).map(([f]) => `${f}: ${M.flag(state, S, f, check)}`).join(' · '))}</code></p>
      ${LLM ? `<p><b>Local model</b> ${esc(LLM.settings.backend)} · ${esc(LLM.status)}${LLM.detail ? ' · ' + esc(LLM.detail) : ''}${LLM.last ? `<br><span class="dv-dim">last: ${LLM.last.ms}ms, ${LLM.last.ok ? 'used' : 'fell back'}${LLM.last.text ? ' — ' + esc(LLM.last.text.slice(0, 80)) : ''}</span>` : ''}</p>` : ''}
      <p><b>Queue</b> <code>${esc(JSON.stringify(state.queue.map((q) => ({ at: stamp(q.at), fx: typeof q.effects === 'string' ? q.effects : Object.keys(q.effects) }))))}</code></p>
      <h3>Last decision</h3>${report}`;
  }

  // ───────────────────────── events ─────────────────────────

  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-nav],[data-tab],[data-close],[data-newtab],[data-like],[data-deploy],[data-takedown],[data-download],[data-buy],[data-star],[data-ov],[data-dev],[data-act],[data-llm],[data-buy-model],[data-use-model],[data-reply],[data-mail-discard],[data-copy-addr],[data-wallet],[data-y-creator]');
      if (!t) return;
      if (t.dataset.close) { e.stopPropagation(); closeTab(Number(t.dataset.close)); return; }
      if (t.dataset.nav) { e.preventDefault(); navigate(t.dataset.nav); return; }
      if (t.dataset.tab) { switchTab(Number(t.dataset.tab)); return; }
      if (t.hasAttribute('data-newtab')) { navigate('newtab', true); return; }
      if (t.dataset.like) { const id = t.dataset.like; state.liked[id] = !state.liked[id]; save(); render(); return; }
      if (t.dataset.deploy) { deploy(t.dataset.deploy); return; }
      if (t.dataset.download) { downloadModel(t.dataset.download); return; }
      if (t.dataset.star) { reviewStars = Number(t.dataset.star); render(); return; }
      if (t.dataset.buy) {
        const l = S.market.listings.find((x) => x.id === t.dataset.buy);
        askConfirm(`Buy “${l.title}” for ${fmtCoin(l.price)}? Cellar has no refunds.`, `Pay ${fmtCoin(l.price)}`, () => buyListing(l.id));
        return;
      }
      if (t.dataset.takedown) {
        const repo = t.dataset.takedown;
        askConfirm(`Take ${repo} offline? Hosting stops, and so does anything it earns.`, 'Take down', () => takeDown(repo));
        return;
      }
      if (t.dataset.buyModel) {
        const level = Number(t.dataset.buyModel);
        const m = modelDef(level);
        askConfirm(`Unlock ${m.name} for ${fmtMoney(m.price)}? Prompts will cost ${fmtMoney(m.promptBase)} + ${fmtMoney(m.perWord)}/word while it's active.`, `Pay ${fmtMoney(m.price)}`, () => buyModel(level));
        return;
      }
      if (t.dataset.useModel) { useModel(Number(t.dataset.useModel)); return; }
      if (t.dataset.reply) {
        const d = mailDef(state.mail.find((m) => m.id === t.dataset.reply) || {});
        draft = { to: d.addr || '', subject: /^re:/i.test(d.subject || '') ? d.subject : `RE: ${d.subject || ''}`, body: '' };
        navigate('qmail.com/compose');
        return;
      }
      if (t.hasAttribute('data-mail-discard')) { draft = null; navigate('qmail.com'); return; }
      if (t.hasAttribute('data-y-creator')) {
        state.creatorOn = true;
        toast('Y', 'Creator payouts on. They pay out every night.', 'y');
        save();
        render();
        return;
      }
      if (t.dataset.wallet) {
        if (t.dataset.wallet === 'receive') { $('[data-copy-addr]').click(); return; }
        toast('Satchel', {
          send: 'Outgoing payments run through auto-pay on this wallet. Manual sends are off.',
          swap: 'Swap failed: no liquidity for MOONCAT.',
          buy: 'Buying DOLR needs a linked bank account. You closed yours.',
        }[t.dataset.wallet], 'wallet');
        return;
      }
      if (t.hasAttribute('data-copy-addr')) {
        const done = () => toast('Satchel', 'Wallet address copied', 'wallet');
        const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#wl-addr-text')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Satchel', 'Address selected. Press Ctrl+C to copy.', 'wallet'); };
        try { navigator.clipboard.writeText(WALLET_ADDR).then(done, fallback); } catch (err) { fallback(); }
        return;
      }
      if (t.dataset.ov) return overlayAction(t.dataset.ov);
      if (t.dataset.dev) return devAction(t.dataset.dev);
      if (t.dataset.act) return taskbarAction(t.dataset.act);
      if (t.dataset.llm) {
        if (t.dataset.llm === 'cancel') LLM.unload();
        else { if (LLM.status === 'error') LLM.unload(); LLM.load(); }
      }
    });

    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-form]');
      if (!f) return;
      e.preventDefault();
      const kind = f.dataset.form;
      if (kind === 'review') {
        writeReview(f.dataset.biz, reviewStars, $('#review-text').value);
        return;
      }
      if (kind === 'term') {
        const input = $('#term-input');
        const v = input.value;
        input.value = '';
        termCommand(v);
        return;
      }
      if (kind === 'prompt') {
        const input = $('#prompt-input');
        const v = input.value;
        if (!v.trim()) return;
        input.value = '';
        sendPrompt(v);
      } else if (kind === 'ypost') {
        const input = $('#post-input');
        const v = input.value;
        if (!v.trim()) return;
        input.value = '';
        postToY(v);
      } else if (kind === 'mail') {
        sendMail($('#mail-to').value, $('#mail-subject').value, $('#mail-body').value);
      } else if (kind === 'url') {
        const input = f.querySelector('input');
        navigate(input.value);
        input.blur();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'prompt-input' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.target.form.requestSubmit();
      }
      if ((e.target.id === 'post-input' || e.target.id === 'mail-body') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.target.form.requestSubmit();
      }
      if (e.target.classList && e.target.classList.contains('tab') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        switchTab(Number(e.target.dataset.tab));
      }
      if (e.key === '`' && (e.ctrlKey || e.metaKey)) { devOpen = !devOpen; renderDev(); }
      if (e.key === 'Escape' && anim) stopTyping();
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'prompt-input') updateCostEstimate();
      if (e.target.id === 'y-search') { ySearch = e.target.value; render(); }
      if (e.target.id === 'yowl-search') { yowlSearch = e.target.value; render(); }
      if (/^mail-(to|subject|body)$/.test(e.target.id)) {
        draft = { to: $('#mail-to').value, subject: $('#mail-subject').value, body: $('#mail-body').value };
        const waiting = !!state.awaiting[draft.to.trim().toLowerCase()];
        $('#mail-wait').hidden = !waiting;
        $('#mail-send').disabled = waiting;
      }
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'dv-node') { state.node = e.target.value; revealPosts(); save(); render(); }
      if (e.target.id === 'llm-backend') LLM.setBackend(e.target.value);
      if (e.target.id === 'model-pick') useModel(Number(e.target.value));
    });

    $('#viewport').addEventListener('click', (e) => {
      if (anim && e.target.closest('.ua-log')) {
        anim.shown = 1e9;
      }
    });

    // keep relative times fresh-ish and let the clock read correctly after long idles
    setInterval(() => { if (!busy && !anim && document.activeElement && document.activeElement.tagName !== 'TEXTAREA') renderTaskbarOnly(); }, 30000);
  }

  function renderTaskbarOnly() {
    $('#wallet').textContent = fmtMoney(state.money);
  }

  function overlayAction(a) {
    if (a === 'continue') { introOpen = false; render(); return; }
    if (a === 'new') { introOpen = false; state = newState(); lastReport = null; save(); render(); return; }
    if (a === 'restart') { state = newState(); lastReport = null; introOpen = true; save(); render(); return; }
    if (a === 'morning') { state.morning = null; save(); render(); return; }
    if (a === 'end-ok') { state.endSeen = true; save(); navigate((state.ended && state.ended.open) || SITES.agent.url); return; }
    if (a === 'confirm-yes') { const fn = confirmState.fn; confirmState = null; fn(); return; }
    if (a === 'confirm-no') { confirmState = null; renderOverlay(); }
  }

  function devAction(a) {
    if (a.startsWith('meter:')) { const [, id, d] = a.split(':'); applyEffects({ meters: { [id]: Number(d) } }); save(); render(); return; }
    if (a === 'close') { devOpen = false; renderDev(); return; }
    if (a === 'sites') for (const id of Object.keys(HIDDEN)) discover(id);
    if (a === 'money+') addTx(100, 'Dev credit');
    if (a === 'money-') addTx(-100, 'Dev debit');
    if (a === 'hour') advance(60);
    if (a === 'sleep') sleep(false);
    if (a === 'posts') for (const p of S.posts) revealPost(p.id);
    if (a === 'model' && state.owned < S.models.length) { state.owned++; state.model = state.owned; applyEffects(modelDef(state.owned).effects); }
    if (a === 'followers') changeFollowers(50);
    save();
    render();
  }

  function taskbarAction(a) {
    if (a === 'sleep') {
      if (busy || state.over) return;
      const h = hourOf(state.t);
      if (h < 18) askConfirm(`It's only ${clock(state.t)}. Sleep through the rest of Day ${dayOf(state.t)}?`, 'Sleep', doSleep);
      else doSleep();
    }
    if (a === 'new') askConfirm('Start a new game? Your current progress will be lost.', 'New game', () => { state = newState(); lastReport = null; introOpen = true; save(); render(); });
    if (a === 'dev') { devOpen = !devOpen; renderDev(); }
  }

  // ───────────────────────── boot ─────────────────────────

  function boot() {
    state = load() || newState();
    introOpen = true;
    devOpen = /(^|#)dev\b/.test(location.hash);
    bind();
    if (LLM) LLM.onChange(onLlmChange);
    J.onChange(onJevChange);
    J.init();
    revealPosts();
    render();
  }

  // exposed for debugging and tests
  window.UA = {
    get state() { return state; },
    sendPrompt, post: postToY, sendMail, deploy, takeDown, sleep: doSleep, navigate, buyModel,
    meter: (id) => M.value(state, S, id),
    download: downloadModel, buy: buyListing, term: termCommand, review: writeReview,
    heading: () => (M.ending(S, check) || {}).id,
    reset() { state = newState(); introOpen = false; save(); render(); },
    lastReport: () => lastReport,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
