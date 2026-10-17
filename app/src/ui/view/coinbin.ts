/*
 * Coinbin (Coinbase parody) and its phishing copy at coinbln.com.
 */
import { GameStore } from '../../game/store';
import { ICONS, TOKENS } from '../icons';
import { agentCost, RENT, dateShort, dateMedium } from '../../engine';
import { adHtml } from '../ads';
import { PHISH_WALLET, hacked, SEED_PHRASE } from '../../engine';
import { PLAYER, WALLET_ADDR, esc, rentDayOf, shortAddr } from './common';

// ── coinbln.com: the phishing copy of Coinbin's sign-in (engine/phishing.ts) ──
export function pagePhish(store: GameStore): string {
  const s = store.state;
  if (hacked(s)) {
    const sent = s.tx.find((x) => x.memo.startsWith(PHISH_WALLET.slice(0, 6)));
    return `<div class="ph-hacked" role="alert">
      <h1>You've been hacked</h1>
      <p>The password you entered went to the people who run this page, not to Coinbin.</p>
      <p>${sent ? `${(-sent.amount).toFixed(2)} DOLR has been sent from your wallet to <code>${shortAddr(PHISH_WALLET)}</code>.` : 'Your wallet was empty, so there was nothing to take.'} Transfers can't be reversed.</p>
      <p class="ph-fine">We appreciate your business.</p>
    </div>`;
  }
  const err = store.ui.phishError;
  return `<div class="cb ph">
    <header class="cb-top"><div class="cb-logo"><span class="cb-mark">${ICONS.coinbin}</span><span>Coinbin</span></div></header>
    <form class="ph-box" data-form="phish" autocomplete="off">
      <h1>Verify your account</h1>
      <p>We noticed a sign-in from a new device. Confirm your password to keep withdrawals open.</p>
      <label><span>Email</span><input value="${esc(PLAYER.addr)}" readonly></label>
      <label><span>Password</span><input id="ph-pass" type="password" spellcheck="false"></label>
      ${err ? `<p class="cb-err" role="alert">${esc(err)}</p>` : ''}
      <button type="submit" class="cb-btn primary">Continue</button>
      <p class="ph-foot">Forgot password? · Privacy · Terms</p>
    </form>
  </div>`;
}

// ── Coinbin (exchange wallet, Coinbase parody) ──
function txHash(x: { day: number; memo: string; amount: number }): string {
  let h = 2166136261;
  for (const c of `${x.day}|${x.memo}|${x.amount}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = (h.toString(16) + (h ^ 0x9e3779b9).toString(16)).padEnd(16, '0');
  return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

const RANGES: Record<string, number> = { '1W': 7, '1M': 30, 'All': 9999 };

/** A point on the balance chart: game time in days (day + minutes / 1440) and the balance from then on. */
type BalPoint = { t: number; bal: number };

export const at = (day: number, min: number) => day + min / 1440;

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The wallet's balance over game time, one point per transaction plus "now". Each entry carries the
 * balance it left behind; entries from saves made before that was recorded are worked out backwards
 * from the next known balance, so an old save's history still ends on its real current balance.
 */
function balanceSeries(s: GameStore['state']): BalPoint[] {
  const txs = s.tx;
  const after: number[] = new Array(txs.length);
  let next = s.values.crypto;
  for (let i = txs.length - 1; i >= 0; i--) { after[i] = txs[i].bal ?? next; next = cents(after[i] - txs[i].amount); }
  const now = at(s.values.day, s.clockMin);
  const first = txs.length ? at(txs[0].day, txs[0].min ?? 720) : now;
  const pts: BalPoint[] = [{ t: first - 1, bal: next }];
  txs.forEach((x, i) => pts.push({ t: Math.min(now, at(x.day, x.min ?? 720)), bal: after[i] }));
  pts.push({ t: now, bal: s.values.crypto });
  return pts;
}

/** The part of the series inside the range, starting with the balance held when the range opens. */
function balanceWindow(pts: BalPoint[], from: number): BalPoint[] {
  const inside = pts.filter((p) => p.t > from);
  const held = pts.filter((p) => p.t <= from).pop();
  return held ? [{ t: from, bal: held.bal }, ...inside] : inside;
}

/** A step chart on a real time axis: the balance holds flat until the next transaction moves it. */
function balanceChart(pts: BalPoint[]): string {
  const w = 720, h = 180, padX = 4, padY = 14;
  const vals = pts.map((p) => p.bal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const xs = (t: number) => padX + ((t - t0) / (t1 - t0 || 1)) * (w - padX * 2);
  const ys = (v: number) => h - padY - ((v - lo) / span) * (h - padY * 2);
  let line = `${xs(pts[0].t).toFixed(1)},${ys(pts[0].bal).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) line += ` ${xs(pts[i].t).toFixed(1)},${ys(pts[i - 1].bal).toFixed(1)} ${xs(pts[i].t).toFixed(1)},${ys(pts[i].bal).toFixed(1)}`;
  const last = pts[pts.length - 1];
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${(padY + f * (h - padY * 2)).toFixed(1)}" y2="${(padY + f * (h - padY * 2)).toFixed(1)}" class="cb-grid"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="cb-chart" preserveAspectRatio="none" role="img" aria-label="Balance history">
    <defs><linearGradient id="cb-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cb-accent)" stop-opacity="0.28"/><stop offset="1" stop-color="var(--cb-accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${xs(t0).toFixed(1)},${h} ${line} ${xs(last.t).toFixed(1)},${h}" fill="url(#cb-fill)"/>
    <polyline points="${line}" class="cb-line"/>
    <circle cx="${xs(last.t).toFixed(1)}" cy="${ys(last.bal).toFixed(1)}" r="3.5" class="cb-dot"/></svg>`;
}

/** Coinbin's Send form. Errors come back from the engine; the typed values survive them. */
function sendForm(store: GameStore): string {
  const f = store.ui.send;
  return `<form class="cb-send" data-form="cb-send" autocomplete="off">
    <label><span>To</span><input id="cb-to" name="to" placeholder="0x…" spellcheck="false" value="${esc(f.to)}"></label>
    <label class="cb-amt"><span>Amount</span><input id="cb-amount" name="amount" inputmode="decimal" placeholder="0.00" value="${esc(f.amount)}"><small>DOLR</small></label>
    <div class="cb-send-row">
      ${f.error ? `<p class="cb-err" role="alert">${esc(f.error)}</p>` : `<p class="cb-hint">Available: ${store.state.values.crypto.toFixed(2)} DOLR. Transfers can't be reversed.</p>`}
      <button type="button" class="cb-btn ghost" data-act="send-cancel">Cancel</button><button type="submit" class="cb-btn primary">Send</button>
    </div>
  </form>`;
}

export function pageWallet(store: GameStore): string {
  const s = store.state;
  const txs = s.tx;
  const range = store.ui.walletRange in RANGES ? store.ui.walletRange : '1M';
  const series = balanceSeries(s);
  const now = series[series.length - 1].t;
  const window = balanceWindow(series, range === 'All' ? -Infinity : now - RANGES[range]);
  const startBal = window[0].bal;
  const change = cents(s.values.crypto - startBal);
  const pct = startBal ? (change / Math.abs(startBal)) * 100 : 0;
  const up = change >= 0;

  // operations, newest first, grouped by date
  const groups = new Map<number, typeof txs>();
  for (const x of txs.slice().reverse()) { if (!groups.has(x.day)) groups.set(x.day, []); groups.get(x.day)!.push(x); }
  const ops = [...groups.entries()].map(([day, list]) => `<div class="cb-day"><span>${esc(dateMedium(day))}</span><span>${day === s.values.day ? 'Today' : ''}</span></div>` + list.map((x) => {
    const out = x.amount < 0;
    const [who, note] = x.memo.split(' · ');
    return `<div class="cb-op">
      <span class="cb-op-ico ${out ? 'out' : 'in'}" aria-hidden="true">${out ? '↑' : '↓'}</span>
      <span class="cb-op-what"><b>${esc(who)}</b><small>${esc(note || (out ? 'Sent' : 'Received'))}</small></span>
      <code class="cb-op-hash">${txHash(x)}</code>
      <span class="cb-op-amt ${out ? '' : 'pos'}">${out ? '−' : '+'}${Math.abs(x.amount).toFixed(2)}<small>DOLR</small></span>
    </div>`;
  }).join('')).join('');

  const sub = agentCost(s.values.agentLevel).sub;
  const live = s.apps.filter((a) => a.deployed && !a.churned).length;
  const rentDay = rentDayOf(s);
  const upcoming = [
    rentDay ? `<div class="cb-row"><span><b>Rent</b><small>Landlord · ${rentDay === s.values.day ? 'tonight' : `${esc(dateShort(rentDay))} · in ${rentDay - s.values.day}d`}</small></span><span class="cb-num">−${RENT[rentDay].toFixed(2)}</span></div>` : '',
    `<div class="cb-row"><span><b>agent subscription</b><small>GeneralAI · nightly</small></span><span class="cb-num">−${sub.toFixed(2)}</span></div>`,
    live ? `<div class="cb-row"><span><b>Hosting</b><small>Forkyard · ${live} live · nightly</small></span><span class="cb-num">−${(live * 2).toFixed(2)}</span></div>` : '',
  ].join('');
  const total = s.values.crypto + 0.42;
  const tabs = Object.keys(RANGES).map((r) => `<button class="cb-tab${r === range ? ' on' : ''}" data-wl-range="${r}">${r}</button>`).join('');
  return `<div class="cb">
    <header class="cb-top">
      <div class="cb-logo"><span class="cb-mark">${ICONS.coinbin}</span><span>Coinbin</span></div>
      <span class="cb-sync"><i></i>Synchronized</span>
      <code class="cb-acct">${shortAddr(WALLET_ADDR)}</code>
    </header>
    <div class="cb-wrap">
      ${adHtml('coinbin', s.values.day, 'wide')}
      <section class="cb-port">
        <div class="cb-port-head">
          <div>
            <p class="cb-label">Portfolio</p>
            <p class="cb-bal"><i class="cb-tok cb-tok-lg">${TOKENS.dolr}</i><span>${s.values.crypto < 0 ? '−' : ''}${Math.abs(s.values.crypto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><small>DOLR</small></p>
            <p class="cb-chg ${up ? 'pos' : 'neg'}">${up ? '+' : '−'}${Math.abs(change).toFixed(2)} (${up ? '+' : '−'}${Math.abs(pct).toFixed(1)}%) <span>${range === 'All' ? 'all time' : `past ${range === '1W' ? 'week' : 'month'}`}</span></p>
          </div>
          <div class="cb-side">
            <div class="cb-actions"><button class="cb-btn${store.ui.send.open ? ' on' : ''}" data-act="send">Send</button><button class="cb-btn" data-act="receive">Receive</button></div>
            ${store.ui.cbNotice && !store.ui.cbNotice.startsWith('Recovery') ? `<p class="cb-notice" role="status">${esc(store.ui.cbNotice)}</p>` : ''}
            <div class="cb-tabs" role="tablist" aria-label="Range">${tabs}</div>
          </div>
        </div>
        ${store.ui.send.open ? sendForm(store) : ''}
        ${balanceChart(window)}
        <div class="cb-axis"><span>${esc(dateShort(Math.floor(window[0].t)))}</span><span>${esc(dateShort(s.values.day))}</span></div>
      </section>
      <div class="cb-cols">
        <section class="cb-card"><h2>Assets</h2>
          <div class="cb-row"><span class="cb-asset"><i class="cb-tok">${TOKENS.dolr}</i><span><b>DOLR</b><small>Dollar stablecoin · $1.00</small></span></span><span class="cb-alloc"><i style="width:${(Math.max(0, s.values.crypto) / total * 100).toFixed(1)}%"></i></span><span class="cb-num">${s.values.crypto.toFixed(2)}</span></div>
          <div class="cb-row"><span class="cb-asset"><i class="cb-tok">${TOKENS.mooncat}</i><span><b>MOONCAT</b><small>4,200,000 · <em class="neg">−99.4%</em></small></span></span><span class="cb-alloc"><i style="width:${Math.max(0.5, 0.42 / total * 100).toFixed(1)}%"></i></span><span class="cb-num">0.42</span></div>
        </section>
        <section class="cb-card"><h2>Upcoming</h2>${upcoming}</section>
      </div>
      <section class="cb-card cb-seed"><h2>Recovery phrase</h2>
        <p class="cb-seed-note">These 12 words control your wallet. Anyone who has them can move your DOLR. Coinbin will never ask for them.</p>
        ${store.ui.seedShown ? `<ol class="cb-seed-words">${SEED_PHRASE.split(' ').map((w) => `<li>${esc(w)}</li>`).join('')}</ol>` : ''}
        <div class="cb-actions"><button class="cb-btn" data-act="seed-show">${store.ui.seedShown ? 'Hide' : 'Show'} recovery phrase</button>${store.ui.seedShown ? '<button class="cb-btn" data-act="seed-copy">Copy</button>' : ''}</div>
        ${store.ui.seedShown && store.ui.cbNotice.startsWith('Recovery') ? `<p class="cb-notice" role="status">${esc(store.ui.cbNotice)}</p>` : ''}
      </section>
      <section class="cb-card cb-ops"><h2>Operations <span>${txs.length}</span></h2>${ops || '<p class="cb-empty">No operations yet.</p>'}</section>
    </div></div>`;
}
