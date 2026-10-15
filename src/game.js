/*
 * Unknown Agent — engine and UI. The in-game chatbot is called GIT.
 * Reads window.STORY (story.js) and asks window.Jev (jev.js) which branch a prompt hits.
 */
(function () {
  'use strict';

  const S = window.STORY;
  const J = window.Jev;          // story decisions (TypeSafe Jev, via server.mjs)
  const K = window.Keywords;     // offline keyword matcher, also used for word counts
  const LLM = window.LocalLLM || null;
  const E = S.economy;
  const SAVE_KEY = 'unknown-agent-save-v1';
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const SITES = {
    chirpr: { label: 'Chirpr', url: 'chirpr.com' },
    bank: { label: 'Second National', url: 'secondnational.com' },
    forkyard: { label: 'Forkyard', url: 'forkyard.com' },
    agent: { label: 'GIT', url: 'askgit.ai' },
  };

  let state = null;
  let lastReport = null;     // the last decision (Jev probabilities or keyword scores), for the dev panel
  let anim = null;           // { idx, shown, timer } typewriter for the newest agent message
  let busy = false;          // agent is "thinking"
  let devOpen = false;

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
        { t: t - 4300, amount: 212, memo: 'STATE UNEMPLOYMENT — FINAL PAYMENT' },
        { t: t - 2870, amount: -89.5, memo: 'GARY PRUITT PROPERTY MGMT — LATE FEE' },
        { t: t - 1490, amount: -41.33, memo: 'CITY UTILITIES' },
        { t: t - 610, amount: -18, memo: 'NOODLE HUT' },
      ],
      chat: [{ from: 'agent', text: S.agent.greeting, t }],
      queue: [], fired: {},
      stats: { prompts: 0, promptSpend: 0, misses: 0, partials: 0, locked: 0, upgradeSpend: 0 },
      model: 1,   // active GIT tier
      owned: 1,   // highest GIT tier bought
      unread: { chirpr: 0, bank: 0, forkyard: 0, agent: 0 },
      tabs: [{ id: 1, url: SITES.chirpr.url }, { id: 2, url: SITES.agent.url }],
      active: 2, nextTab: 3, lastCost: 0,
      ended: null, endSeen: false, over: null, morning: null,
    };
    for (const p of S.posts) if (p.at != null) s.posts[p.id] = t - p.at;
    s.unread.chirpr = Object.keys(s.posts).length;
    return s;
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
      // saves from before GIT tiers
      if (!s.model) { s.model = 1; s.owned = 1; }
      s.stats.locked = s.stats.locked || 0;
      s.stats.upgradeSpend = s.stats.upgradeSpend || 0;
      for (const tab of s.tabs) if (/^unknownagent\.ai/.test(tab.url)) tab.url = 'askgit.ai';
      return s;
    } catch (e) { return null; }
  }

  function check(c) {
    if (!c) return true;
    if (c.flag && !arr(c.flag).every((f) => state.flags[f])) return false;
    if (c.notFlag && arr(c.notFlag).some((f) => state.flags[f])) return false;
    if (c.node && !arr(c.node).includes(state.node)) return false;
    if (c.repo && !arr(c.repo).every((r) => state.repos[r])) return false;
    if (c.deployed && !arr(c.deployed).every((r) => state.repos[r] && state.repos[r].deployed)) return false;
    if (c.minDay && dayOf(state.t) < c.minDay) return false;
    if (c.minMoney != null && state.money < c.minMoney) return false;
    return true;
  }

  const currentNode = () => S.nodes[state.node] || { objective: '', branches: [] };
  const modelDef = (level) => S.models[Math.min(Math.max(level, 1), S.models.length) - 1];

  // ───────────────────────── effects ─────────────────────────

  function addTx(amount, memo) {
    amount = round2(amount);
    state.money = round2(state.money + amount);
    state.tx.push({ t: state.t, amount, memo });
    if (!onSite('bank')) state.unread.bank++;
  }

  function onSite(site) {
    const tab = state.tabs.find((x) => x.id === state.active);
    return tab && route(tab.url).site === site;
  }

  function revealPost(id) {
    if (state.posts[id] != null) return;
    state.posts[id] = state.t;
    if (!onSite('chirpr')) state.unread.chirpr++;
  }

  function revealPosts() {
    for (const p of S.posts) {
      if (p.at == null && p.when && state.posts[p.id] == null && check(p.when)) revealPost(p.id);
    }
  }

  function agentSays(text, src) {
    state.chat.push({ from: 'agent', text, t: state.t, src: src || 'event' });
    if (!onSite('agent')) {
      state.unread.agent++;
      toast('GIT', 'sent you a message', 'agent');
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
      const m = typeof fx.money === 'number' ? { amount: fx.money, memo: 'TRANSFER' } : fx.money;
      addTx(m.amount, m.memo);
      toast('Second National', `${m.amount >= 0 ? '+' : ''}${fmtMoney(m.amount)} · ${m.memo}`, 'bank');
    }
    for (const name of arr(fx.repo)) {
      if (state.repos[name]) continue;
      state.repos[name] = { createdAt: state.t, deployed: false };
      if (!onSite('forkyard')) state.unread.forkyard++;
      toast('Forkyard', `New repository: ${name}`, 'forkyard');
    }
    if (fx.app) state.apps[fx.app.repo] = { users: fx.app.users || 0, perDay: fx.app.perDay || 0 };
    for (const id of arr(fx.post)) revealPost(id);
    if (fx.agent) agentSays(fx.agent);
    for (const l of arr(fx.later)) state.queue.push({ at: state.t + Math.round((l.hours || 0) * 60), effects: l.effects });
    if (fx.goto && fx.goto !== state.node) {
      state.node = fx.goto;
      const obj = currentNode().objective;
      if (obj) toast('New objective', obj, 'note');
    }
    if (fx.end) state.ended = fx.end;
    revealPosts();
  }

  function fireEvents(kind, extra) {
    for (const ev of S.events || []) {
      if (ev.on !== kind) continue;
      if (kind === 'deploy' && ev.repo !== extra) continue;
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
      if (app.perDay > 0 && state.repos[repo] && state.repos[repo].deployed) {
        addTx(app.perDay, `FORKYARD PAYOUT — ${repo}`);
        lines.push([`${repo} earnings (${app.users} users/day)`, app.perDay]);
      }
    }
    const live = Object.values(state.repos).filter((r) => r.deployed).length;
    if (live) {
      const fee = live * E.hostingPerDay;
      addTx(-fee, `FORKYARD HOSTING — ${live} APP${live > 1 ? 'S' : ''}`);
      lines.push([`Hosting (${live} app${live > 1 ? 's' : ''})`, -fee]);
    }
    const memos = arr(E.living.memo);
    addTx(-E.living.amount, memos[(ended - 1) % memos.length]);
    lines.push(['Food & basics', -E.living.amount]);

    let rentDue = false;
    if (E.rent && ended === E.rent.day) {
      rentDue = true;
      addTx(-E.rent.amount, `${E.rent.payee} — RENT`);
      lines.push(['Rent', -E.rent.amount]);
    }

    state.t = wake;
    if (state.money < 0) {
      state.over = rentDue
        ? { title: 'Evicted', text: `Rent bounced. Gary changed the locks on Day ${ended + 1}. Your laptop is in a box on the curb.` }
        : { title: 'Overdrawn', text: 'Second National froze your account. No account, no agent, no way back in.' };
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

  // Buy the next GIT tier. Tiers unlock in order; the new tier becomes active.
  function buyModel(level) {
    const m = modelDef(level);
    if (level !== state.owned + 1 || state.over) return;
    if (state.money < m.price) { toast('GIT Labs', `${m.name} costs ${fmtMoney(m.price)}. Your balance is ${fmtMoney(state.money)}.`, 'agent'); return; }
    addTx(-m.price, `GIT LABS — ${m.name} UPGRADE`);
    state.stats.upgradeSpend = round2(state.stats.upgradeSpend + m.price);
    state.owned = level;
    state.model = level;
    toast('GIT Labs', `${m.name} unlocked and active. Prompts now cost ${fmtMoney(m.promptBase)} + ${fmtMoney(m.perWord)}/word.`, 'agent');
    save();
    render();
  }

  function useModel(level) {
    if (level < 1 || level > state.owned || busy) return;
    state.model = level;
    save();
    render();
  }

  function branchCandidates() {
    return [...(currentNode().branches || []), ...(S.global || [])].filter((b) => check(b.when));
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
    addTx(-cost, `GIT LABS — ${modelDef(level).name} USAGE`);
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
      // the player may have deployed or posted while Jev was deciding
      if (decision.branch && !branchCandidates().includes(decision.branch)) decision = { ...decision, kind: 'miss', branch: null, stale: true };
      decision = J.gate(decision, level);
      lastReport = { prompt: text, node: sentNode, decision, model: level };
      let reply;
      let src;
      let effects = null;
      if (decision.kind === 'hit') {
        const out = J.outcome(decision.branch, level);
        reply = out.response;
        effects = out.effects;
        src = 'hit:' + decision.branch.id;
      } else if (decision.kind === 'locked') {
        const need = modelDef(decision.branch.minModel).name;
        reply = tpl(decision.branch.weak || S.agent.lockedResponse, { model: modelDef(level).name, required: need });
        src = 'locked:' + decision.branch.id;
        state.stats.locked++;
      } else if (decision.kind === 'partial') {
        reply = decision.branch.partial;
        src = 'partial:' + decision.branch.id;
        state.stats.partials++;
      } else {
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

  function chirpCandidates() {
    return (S.chirps || []).filter((c) => !state.fired['chirp:' + c.id] && check(c.when));
  }

  async function chirp(text) {
    text = text.trim();
    if (!text || state.over) return;
    const id = 'u' + Date.now();
    const post = { id, text, t: state.t, likes: Math.floor(Math.random() * 3) };
    state.userPosts.push(post);
    advance(5);
    save();
    render();
    const candidates = chirpCandidates();
    if (!candidates.length) return;
    const node = state.node;
    const decision = await J.decide(text, candidates, { kind: 'chirp', node, thresholds: S.decision });
    lastReport = { prompt: text, node, decision, chirp: true };
    // chirps have no nudges: only a hit that is still available counts
    if (decision.kind === 'hit' && chirpCandidates().includes(decision.branch)) {
      state.fired['chirp:' + decision.branch.id] = state.t;
      post.likes += 20 + Math.floor(Math.random() * 40);
      applyEffects(decision.branch.effects);
      save();
    }
    render();
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
    if (u === 'chirpr.com') return { site: 'chirpr', title: 'Home / Chirpr' };
    if (u === 'secondnational.com') return { site: 'bank', title: 'Second National · Checking' };
    if (u === 'askgit.ai' || u === 'unknownagent.ai') return { site: 'agent', title: 'GIT' };
    if (u === 'askgit.ai/models') return { site: 'agent', page: 'models', title: 'Models · GIT' };
    if (u === 'forkyard.com') return { site: 'forkyard', title: 'Forkyard' };
    let m = u.match(/^forkyard\.com\/([a-z0-9-]+)$/);
    if (m) return { site: 'forkyard', repo: m[1], title: `${m[1]} · Forkyard` };
    m = u.match(/^([a-z0-9-]+)\.forkyard\.app$/);
    if (m) {
      const def = S.repos[m[1]];
      return { site: 'app', repo: m[1], title: def && def.preview ? def.preview.title : m[1] };
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
    const site = route(url).site;
    if (state.unread[site] != null) state.unread[site] = 0;
    save();
    render();
  }

  function switchTab(id) {
    state.active = id;
    const tab = state.tabs.find((x) => x.id === id);
    const site = route(tab.url).site;
    if (state.unread[site] != null) state.unread[site] = 0;
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

  // ───────────────────────── page renderers ─────────────────────────

  const ICONS = {
    chirpr: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15c3 0 5-2 6-5 1-4 4-6 7-5l3-1-1.5 2.5C19 9 18 13 15 16c-3 3-8 4-12 2 2 0 3.5-.7 4.5-1.6C5.5 16.2 4.5 15.8 4 15z" fill="currentColor"/></svg>',
    bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8v2h18V8l-9-5zM5 12v6h2v-6H5zm4 0v6h2v-6H9zm4 0v6h2v-6h-2zm4 0v6h2v-6h-2zM3 20v2h18v-2H3z" fill="currentColor"/></svg>',
    forkyard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3a3 3 0 0 0-1 5.8v6.4A3 3 0 1 0 8 15.2V13c0-1 1-2 2-2h4a4 4 0 0 0 4-4V8.8A3 3 0 1 0 16 8.8V7c0 1-1 2-2 2h-4c-.7 0-1.4.2-2 .5V8.8A3 3 0 0 0 7 3z" fill="currentColor"/></svg>',
    agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.8-1.1 1.5v.6" stroke="var(--icon-ink, #fff)" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.1" fill="var(--icon-ink, #fff)"/></svg>',
    newtab: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    app: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 9h16" stroke="currentColor" stroke-width="2"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3zm0 6v6m0 2.5v.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  };

  function pageNewTab() {
    const tiles = Object.entries(SITES).map(([k, s]) =>
      `<button class="nt-tile nt-${k}" data-nav="${s.url}"><span class="nt-ico">${ICONS[k]}</span><span>${esc(s.label)}</span>${state.unread[k] ? `<i class="badge">${state.unread[k]}</i>` : ''}</button>`
    ).join('');
    return `<div class="newtab">
      <p class="nt-time">${weekday(state.t)} ${clock(state.t)}</p>
      <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
      <div class="nt-tiles">${tiles}</div>
    </div>`;
  }

  function pageChirpr() {
    const posts = [];
    for (const p of S.posts) {
      if (state.posts[p.id] == null) continue;
      posts.push({ ...p, t: state.posts[p.id], author: tpl(p.author), handle: tpl(p.handle), text: tpl(p.text) });
    }
    for (const u of state.userPosts) posts.push({ id: u.id, author: S.start.player.name, handle: S.start.player.handle, text: u.text, t: u.t, likes: u.likes, mine: true });
    posts.sort((a, b) => b.t - a.t);
    const feed = posts.map((p) => {
      const liked = !!state.liked[p.id];
      const text = esc(p.text).replace(/@([a-z0-9_]+)/gi, '<span class="ch-at">@$1</span>').replace(/([a-z0-9-]+\.forkyard\.app)/g, '<a data-nav="$1" href="#" class="ch-link">$1</a>');
      return `<article class="ch-post${p.mine ? ' mine' : ''}">
        ${avatar(p.author, p.handle)}
        <div class="ch-body">
          <header><b>${esc(p.author)}</b> <span>@${esc(p.handle)} · ${ago(p.t)}</span></header>
          <p>${text}</p>
          <footer><button class="ch-like${liked ? ' on' : ''}" data-like="${esc(p.id)}" aria-pressed="${liked}">♥ ${(p.likes || 0) + (liked ? 1 : 0)}</button></footer>
        </div>
      </article>`;
    }).join('');
    const trends = [
      ['#RentDue', '18.2k chirps'],
      ['GIT-3', '9,410 chirps'],
      state.posts.washday != null ? ['Ferris St Laundromat', '2,140 chirps'] : ['#AgenticWorkflows', '4,002 chirps'],
      ['Crumb & Coin', state.posts.rosa_thanks != null ? '312 chirps' : '27 chirps'],
    ];
    return `<div class="ch">
      <nav class="ch-nav"><div class="ch-logo">${ICONS.chirpr}<span>chirpr</span></div><a class="on">Home</a><a>Explore</a><a>Notifications</a><a>Profile</a></nav>
      <main class="ch-main">
        <h1 class="ch-h">Home</h1>
        <form class="ch-compose" data-form="chirp">
          ${avatar(S.start.player.name, S.start.player.handle)}
          <div><textarea id="chirp-input" rows="2" maxlength="280" placeholder="What's happening?"></textarea>
          <div class="ch-compose-row"><span class="ch-hint">Posting is free.</span><button class="ch-btn" type="submit">Chirp</button></div></div>
        </form>
        <div class="ch-feed">${feed}</div>
      </main>
      <aside class="ch-side"><h2>Trending near you</h2>${trends.map(([a, b]) => `<div class="ch-trend"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</aside>
    </div>`;
  }

  function pageBank() {
    const sorted = [...state.tx].sort((a, b) => b.t - a.t);
    let running = state.money;
    const rows = sorted.map((x) => {
      const bal = running;
      running = round2(running - x.amount);
      return `<tr><td class="bk-date">${x.t < 0 ? 'Before' : stamp(x.t)}</td><td class="bk-memo">${esc(x.memo)}</td><td class="bk-amt ${x.amount < 0 ? 'neg' : 'pos'}">${x.amount >= 0 ? '+' : ''}${fmtMoney(x.amount)}</td><td class="bk-bal">${fmtMoney(bal)}</td></tr>`;
    }).join('');
    const live = Object.values(state.repos).filter((r) => r.deployed).length;
    const income = Object.entries(state.apps).reduce((s, [k, a]) => s + (state.repos[k] && state.repos[k].deployed ? a.perDay : 0), 0);
    const nightly = round2(income - E.living.amount - live * E.hostingPerDay);
    const day = dayOf(state.t);
    const rentLeft = E.rent ? E.rent.day - day : null;
    const rentLine = E.rent && rentLeft >= 0
      ? `<div class="bk-up"><span>Rent</span><b class="neg">${fmtMoney(-E.rent.amount)}</b><small>${esc(E.rent.payee)} · ${rentLeft === 0 ? 'due tonight' : `end of Day ${E.rent.day}, ${rentLeft} day${rentLeft > 1 ? 's' : ''} left`}</small></div>`
      : '';
    return `<div class="bk">
      <header class="bk-top"><div class="bk-logo">${ICONS.bank}<span>Second National</span></div><span class="bk-user">Signed in · ${esc(S.start.player.name)}</span></header>
      <div class="bk-wrap">
        <section class="bk-card">
          <p class="bk-label">Everyday Checking ••••4417</p>
          <p class="bk-balance ${state.money < 0 ? 'neg' : ''}">${fmtMoney(state.money)}</p>
          <p class="bk-sub">Available balance · ${stamp(state.t)}</p>
        </section>
        <section class="bk-upcoming">
          <h2>Coming up</h2>
          ${rentLine}
          <div class="bk-up"><span>Every night</span><b class="${nightly < 0 ? 'neg' : 'pos'}">${nightly >= 0 ? '+' : ''}${fmtMoney(nightly)}</b><small>Food ${fmtMoney(-E.living.amount)}${live ? ` · Hosting ${fmtMoney(-live * E.hostingPerDay)}` : ''}${income ? ` · App income +${fmtMoney(income)}` : ''}</small></div>
        </section>
        <section class="bk-tx">
          <h2>Activity</h2>
          <div class="bk-scroll"><table><thead><tr><th>When</th><th>Description</th><th class="r">Amount</th><th class="r">Balance</th></tr></thead><tbody>${rows}</tbody></table></div>
        </section>
      </div>
    </div>`;
  }

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
            <div class="fy-filehead">Pushed by <b>git[bot]</b> · ${ago(r.createdAt)} ago</div>
            ${def.files.map((f) => `<div class="fy-file">${esc(f)}</div>`).join('')}
            <pre class="fy-code"><code>${esc(def.snippet)}</code></pre>
          </div>
          <div class="fy-deploy">
            <h2>Deployment</h2>
            <p>${repoStatus(repoName)}</p>
            ${r.deployed
              ? `<dl><dt>Visitors / day</dt><dd>${app ? app.users : 0}</dd><dt>Earnings / day</dt><dd>${fmtMoney(app ? app.perDay : 0)}</dd><dt>Hosting / day</dt><dd>${fmtMoney(E.hostingPerDay)}</dd></dl>`
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

  function pageApp(repo) {
    const r = state.repos[repo];
    const def = S.repos[repo];
    if (!r || !r.deployed || !def) {
      return `<div class="err"><h1>404: NOT_FOUND</h1><p>Nothing is deployed at <code>${esc(repo)}.forkyard.app</code>.</p></div>`;
    }
    return `<div class="pv-host">${def.preview.html}</div>`;
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
        <div class="ua-brand">${ICONS.agent}<div><b>GIT</b><span>${esc(modelDef(state.model).name)} · ${fmtMoney(modelDef(state.model).promptBase)} per prompt + ${fmtMoney(modelDef(state.model).perWord)} per word</span></div></div>
        <span class="ua-linked"><a href="#" data-nav="askgit.ai/models" class="ua-upgrade">${state.owned < S.models.length ? 'Upgrade model' : 'Models'}</a> · Billing: Second National ••4417</span>
      </header>
      <div class="ua-llm"><span class="ua-jev" id="ua-jev">${jevChip()}</span>${LLM ? `<span class="ua-llm-ctl" id="ua-llm">${llmRow()}</span>` : ''}</div>
      <div class="ua-log" id="ua-log">${msgs}${thinking}</div>
      <form class="ua-compose" data-form="prompt">
        <textarea id="prompt-input" rows="2" placeholder="Tell GIT what to do" ${busy || state.over ? 'disabled' : ''}></textarea>
        <div class="ua-row">
          <label class="ua-model-pick"><span class="sr-only">Model</span><select id="model-pick" ${busy ? 'disabled' : ''}>${S.models.slice(0, state.owned).map((m, i) => `<option value="${i + 1}" ${state.model === i + 1 ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
          <span id="cost-est" class="ua-est"></span><button class="ua-send" type="submit" ${busy || state.over ? 'disabled' : ''}>Send</button>
        </div>
      </form>
    </div>`;
  }

  // askgit.ai/models: the tier ladder. Tiers unlock in order.
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
        <div class="ua-brand">${ICONS.agent}<div><b>GIT models</b><span>Stronger models take on harder jobs. Every prompt costs more.</span></div></div>
        <span class="ua-linked"><a href="#" data-nav="askgit.ai" class="ua-upgrade">Back to chat</a></span>
      </header>
      <div class="gm-grid">${cards}</div>
      <p class="gm-note">Upgrades are charged once to Second National ••4417. You can switch between models you own at any time.</p>
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

    $('#bookmarks').innerHTML = Object.entries(SITES).map(([k, s]) =>
      `<button class="bm" data-nav="${s.url}"><span class="bm-ico ico-${k}">${ICONS[k]}</span><span class="bm-label">${esc(s.label)}</span>${state.unread[k] ? `<i class="badge">${state.unread[k]}</i>` : ''}</button>`
    ).join('');

    // preserve what the player was typing across re-renders
    const vp = $('#viewport');
    const keep = {};
    let focusId = null;
    vp.querySelectorAll('textarea[id], input[id]').forEach((el) => { keep[el.id] = el.value; });
    if (document.activeElement && vp.contains(document.activeElement)) focusId = document.activeElement.id;

    let html;
    switch (r.site) {
      case 'chirpr': html = pageChirpr(); break;
      case 'bank': html = pageBank(); break;
      case 'forkyard': html = pageForkyard(r.repo); break;
      case 'agent': html = r.page === 'models' ? pageModels() : pageAgent(); break;
      case 'app': html = pageApp(r.repo); break;
      case 'newtab': html = pageNewTab(); break;
      default: html = pageError(tab.url);
    }
    const prevSite = vp.dataset.site;
    vp.innerHTML = html;
    vp.dataset.site = r.site;
    if (prevSite !== r.site) vp.scrollTop = 0;
    for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && !el.disabled) el.value = v; }
    if (focusId) { const el = document.getElementById(focusId); if (el && !el.disabled) el.focus(); }
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
        <p>You lost your job two years ago. The benefits ran out last week. You have ${fmtMoney(S.start.money)}, a laptop, four bookmarks, and GIT, an AI chatbot that bills you for every word.</p>
        <p>Rent is ${fmtMoney(E.rent.amount)}, due at the end of Day ${E.rent.day}. Don't go broke.</p>
        <ul class="ov-rules">
          <li>Every prompt costs money and an hour. Vague prompts get vague answers.</li>
          <li>Some jobs need a stronger GIT model. Upgrades cost money upfront and make every prompt pricier.</li>
          <li>Read Chirpr for leads. Check your bank. Ship code on Forkyard.</li>
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
        <table class="ov-lines">${m.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</td></tr>`).join('')}
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
      report = `<p><b>${lastReport.chirp ? 'Chirp' : 'Prompt'}:</b> ${esc(lastReport.prompt)}</p>
        <p><b>Result:</b> ${decision.kind}${decision.branch ? ' → ' + esc(decision.branch.id) : ''}${decision.kind === 'locked' ? ` (needs ${esc(modelDef(decision.branch.minModel).name)}, had ${esc(modelDef(lastReport.model).name)})` : ''}${decision.stale ? ' (stale, ignored)' : ''} <span class="dv-dim">(node ${esc(lastReport.node)} · ${engine})</span></p>
        ${table}`;
    }
    const nodes = Object.keys(S.nodes).map((n) => `<option ${n === state.node ? 'selected' : ''}>${n}</option>`).join('');
    d.innerHTML = `<header><b>jev · dev</b><button data-dev="close" aria-label="Close dev panel">×</button></header>
      <label>Node <select id="dv-node">${nodes}</select></label>
      <div class="dv-row"><button data-dev="money+">+$100</button><button data-dev="money-">−$100</button><button data-dev="hour">+1h</button><button data-dev="sleep">Sleep</button><button data-dev="posts">All posts</button><button data-dev="model">Free next model</button></div>
      <p><b>Decisions</b> ${J.status === 'online' ? 'Jev · ' + esc(J.model || '') : esc(J.status) + (J.reason ? ' · ' + esc(J.reason) : '')}</p>
      <p><b>Model</b> ${esc(modelDef(state.model).name)} active · ${esc(modelDef(state.owned).name)} owned</p>
      <p><b>Flags</b> <code>${esc(JSON.stringify(state.flags))}</code></p>
      ${LLM ? `<p><b>Local model</b> ${esc(LLM.settings.backend)} · ${esc(LLM.status)}${LLM.detail ? ' · ' + esc(LLM.detail) : ''}${LLM.last ? `<br><span class="dv-dim">last: ${LLM.last.ms}ms, ${LLM.last.ok ? 'used' : 'fell back'}${LLM.last.text ? ' — ' + esc(LLM.last.text.slice(0, 80)) : ''}</span>` : ''}</p>` : ''}
      <p><b>Queue</b> <code>${esc(JSON.stringify(state.queue.map((q) => ({ at: stamp(q.at), fx: typeof q.effects === 'string' ? q.effects : Object.keys(q.effects) }))))}</code></p>
      <h3>Last decision</h3>${report}`;
  }

  // ───────────────────────── events ─────────────────────────

  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-nav],[data-tab],[data-close],[data-newtab],[data-like],[data-deploy],[data-ov],[data-dev],[data-act],[data-llm],[data-buy-model],[data-use-model]');
      if (!t) return;
      if (t.dataset.close) { e.stopPropagation(); closeTab(Number(t.dataset.close)); return; }
      if (t.dataset.nav) { e.preventDefault(); navigate(t.dataset.nav); return; }
      if (t.dataset.tab) { switchTab(Number(t.dataset.tab)); return; }
      if (t.hasAttribute('data-newtab')) { navigate('newtab', true); return; }
      if (t.dataset.like) { const id = t.dataset.like; state.liked[id] = !state.liked[id]; save(); render(); return; }
      if (t.dataset.deploy) { deploy(t.dataset.deploy); return; }
      if (t.dataset.buyModel) {
        const level = Number(t.dataset.buyModel);
        const m = modelDef(level);
        askConfirm(`Unlock ${m.name} for ${fmtMoney(m.price)}? Prompts will cost ${fmtMoney(m.promptBase)} + ${fmtMoney(m.perWord)}/word while it's active.`, `Pay ${fmtMoney(m.price)}`, () => buyModel(level));
        return;
      }
      if (t.dataset.useModel) { useModel(Number(t.dataset.useModel)); return; }
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
      if (kind === 'prompt') {
        const input = $('#prompt-input');
        const v = input.value;
        if (!v.trim()) return;
        input.value = '';
        sendPrompt(v);
      } else if (kind === 'chirp') {
        const input = $('#chirp-input');
        const v = input.value;
        if (!v.trim()) return;
        input.value = '';
        chirp(v);
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
      if (e.target.id === 'chirp-input' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
    if (a === 'end-ok') { state.endSeen = true; save(); navigate(SITES.agent.url); return; }
    if (a === 'confirm-yes') { const fn = confirmState.fn; confirmState = null; fn(); return; }
    if (a === 'confirm-no') { confirmState = null; renderOverlay(); }
  }

  function devAction(a) {
    if (a === 'close') { devOpen = false; renderDev(); return; }
    if (a === 'money+') addTx(100, 'DEV CREDIT');
    if (a === 'money-') addTx(-100, 'DEV DEBIT');
    if (a === 'hour') advance(60);
    if (a === 'sleep') sleep(false);
    if (a === 'posts') for (const p of S.posts) revealPost(p.id);
    if (a === 'model' && state.owned < S.models.length) { state.owned++; state.model = state.owned; }
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
    sendPrompt, chirp, deploy, sleep: doSleep, navigate,
    reset() { state = newState(); introOpen = false; save(); render(); },
    lastReport: () => lastReport,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
