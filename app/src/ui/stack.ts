/*
 * stack.com: the crypto casino (Stake parody; engine/casino.ts runs the money and the slot). One page:
 * the Sevens Deluxe slot, the wallet (deposit address, creator code, withdrawal), the paytable and a
 * "Live wins" feed of other players, drawn from the clock so it changes during the day.
 */
import type { GameStore } from '../game/store';
import { casinoOf, withdrawable, BETS, THREE, CHERRIES, CASINO, CASINO_WALLET, type Sym } from '../engine';
import { STACK_ICON } from './stackIcon';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GLYPH: Record<Sym, string> = {
  blank: '<span class="st-sym blank"></span>',
  cherry: '<span class="st-sym">🍒</span>',
  lemon: '<span class="st-sym">🍋</span>',
  bell: '<span class="st-sym">🔔</span>',
  bar: '<span class="st-sym bar">BAR</span>',
  seven: '<span class="st-sym seven">7</span>',
};
const STRIP = (['seven', 'cherry', 'bar', 'lemon', 'bell', 'blank', 'cherry', 'seven'] as Sym[]).map((x) => GLYPH[x]).join('');

/** Other players' wins: [name, multiplier]. The feed shows a few, picked by the game clock. */
const LIVE: [string, number][] = [
  ['dgen_dave', 20], ['nightshift_kim', 5], ['vantor_alum', 10], ['moonboi_2030', 25], ['quietquitter', 2],
  ['lisa.k', 5], ['harbor_rat', 50], ['jpeg_jim', 2], ['tired_dad', 10], ['sigma_grindset', 20],
  ['max_stryker', 200], ['reskill_rob', 5], ['deliverybot_7', 2], ['laid_off_lou', 25], ['anna_b', 10],
];
const LIVE_BETS = [1, 2, 5, 10, 25, 50, 100];

function liveWins(day: number, min: number): string {
  const tick = day * 1000 + Math.floor(min / 5);
  return Array.from({ length: 6 }, (_, i) => {
    const h = Math.abs(Math.imul(tick + i * 7919, 2654435761)) >>> 0;
    const [name, x] = LIVE[h % LIVE.length];
    const bet = name === 'max_stryker' ? 25 : LIVE_BETS[(h >>> 8) % LIVE_BETS.length];
    return `<li><span>${esc(name)}</span><span>×${x}</span><b>${num(bet * x)}</b></li>`;
  }).join('');
}

const PAYS: [Sym[], number][] = [
  [['seven', 'seven', 'seven'], THREE.seven!], [['bar', 'bar', 'bar'], THREE.bar!], [['bell', 'bell', 'bell'], THREE.bell!],
  [['lemon', 'lemon', 'lemon'], THREE.lemon!], [['cherry', 'cherry', 'cherry'], THREE.cherry!],
  [['cherry', 'cherry'], CHERRIES.two], [['cherry'], CHERRIES.one],
];

export function pageStack(store: GameStore): string {
  const s = store.state;
  const c = casinoOf(s);
  const ui = store.ui;
  const last = c.spins.at(-1);
  const spinning = ui.stackSpinning && !!last;
  // while the reels turn, the win isn't in the balance yet
  const shown = spinning ? c.balance - last!.win : c.balance;

  const reels = [0, 1, 2].map((i) => spinning
    ? `<div class="st-reel spin"><div class="st-strip" style="animation-delay:-${i * 0.11}s">${STRIP}${STRIP}</div></div>`
    : `<div class="st-reel">${GLYPH[last?.reels[i] ?? (['seven', 'seven', 'seven'] as Sym[])[i]]}</div>`).join('');
  const result = !last || spinning ? `<p class="st-result">${spinning ? 'Spinning…' : 'Good luck.'}</p>`
    : last.win > 0 ? `<p class="st-result win">You won <b>${num(last.win)} DOLR</b> (×${last.win / last.bet})</p>`
    : '<p class="st-result">No win.</p>';
  const bets = BETS.map((b) => `<button type="button" class="st-chip${b === ui.stackBet ? ' on' : ''}" data-act="stack-bet" data-bet="${b}">${num(b)}</button>`).join('');

  const bonus = c.bonus > 0
    ? `<p class="st-bonus">Bonus <b>${num(c.bonus)} DOLR</b> · wager ${num(c.wagerLeft)} more to unlock it. Withdrawing now forfeits it.</p>`
    : c.code && !c.deposited ? `<p class="st-bonus">Code <b>${esc(c.code)}</b> added. Your first deposit is matched 100%, up to ${CASINO.matchMax} DOLR.</p>` : '';
  const code = c.deposited || c.code ? '' : `<form class="st-form" data-form="stack-code" autocomplete="off">
      <label for="st-code">Creator code</label>
      <div class="st-row"><input id="st-code" placeholder="Code" maxlength="20"><button type="submit" class="st-btn ghost">Add</button></div>
      <small>Codes match your first deposit 100%, up to ${CASINO.matchMax} DOLR.</small></form>`;
  const line = ui.stack.error ? `<p class="st-err" role="alert">${esc(ui.stack.error)}</p>`
    : ui.stack.notice ? `<p class="st-ok" role="status">${esc(ui.stack.notice)}</p>` : '';

  const history = c.spins.length ? (spinning ? c.spins.slice(0, -1) : [...c.spins]).reverse().slice(0, 8).map((x) =>
    `<li><span class="st-mini">${x.reels.map((r) => GLYPH[r]).join('')}</span><span>${num(x.bet)}</span><b class="${x.win > 0 ? 'win' : ''}">${x.win > 0 ? '+' + num(x.win) : '−' + num(x.bet)}</b></li>`).join('') : '';

  const pays = PAYS.map(([syms, x]) => `<li><span class="st-mini">${syms.map((r) => GLYPH[r]).join('')}${syms.length < 3 ? '<em>any</em>' : ''}</span><b>×${x}</b></li>`).join('');

  return `<div class="st">
    <header class="st-top"><span class="st-logo"><span class="st-mark">${STACK_ICON}</span>Stack</span>
      <span class="st-bal"><small>Balance</small><b>${num(shown)}</b> DOLR</span></header>
    <div class="st-wrap">
      <main class="st-main">
        <section class="st-game">
          <div class="st-gh"><h1>Sevens Deluxe</h1><span>Stack Originals · RTP ${esc(CASINO.rtpClaim)}</span></div>
          <div class="st-reels">${reels}</div>
          ${result}
          <div class="st-bets"><span>Bet</span>${bets}<small>DOLR</small></div>
          <button type="button" class="st-spin" data-act="stack-spin" ${spinning || s.ending ? 'disabled' : ''}>Spin</button>
        </section>
        <div class="st-cols">
          <section class="st-card"><h2>Paytable</h2><ul class="st-list st-pays">${pays}</ul><small>Pays left to right on the middle line. Wins are the bet times the multiplier.</small></section>
          <section class="st-card"><h2>Your spins</h2>${history ? `<ul class="st-list">${history}</ul>` : '<p class="st-dim">No spins yet.</p>'}
            ${c.bet > 0 ? `<small>Wagered ${num(c.bet)} · won ${num(c.won)}</small>` : ''}</section>
        </div>
      </main>
      <aside class="st-side">
        <section class="st-card st-wallet"><h2>Wallet</h2>
          <p class="st-dim">Deposit by sending DOLR from <a href="#" data-nav="coinbin.com">Coinbin</a> to your Stack address. Deposits are credited instantly.</p>
          <div class="st-addr"><code>${CASINO_WALLET}</code><button type="button" class="st-btn ghost" data-act="stack-copy">Copy</button></div>
          ${code}${bonus}
          <form class="st-form" data-form="stack-withdraw" autocomplete="off">
            <label for="st-out">Withdraw to Coinbin</label>
            <div class="st-row"><input id="st-out" inputmode="decimal" placeholder="0.00"><button type="submit" class="st-btn">Withdraw</button></div>
            <small>Available ${num(withdrawable(c))} DOLR · minimum ${CASINO.minWithdraw} DOLR</small></form>
          ${line}
        </section>
        <section class="st-card"><h2>Live wins</h2><ul class="st-list st-live">${liveWins(s.values.day, s.clockMin)}</ul></section>
      </aside>
    </div>
    <p class="st-fine">Stack is operated under a gaming licence from Curaçao. 18+. Gambling can be addictive; set yourself a limit. Bonus terms: the deposit match must be wagered ${CASINO.wagerX} times before it can be withdrawn.</p>
  </div>`;
}
