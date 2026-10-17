/*
 * prince-claims.xyz: the Crypto Prince banner ad's prize page (engine/phishing.ts, seedClaim). Drawn
 * like the ad landing pages (adSites.css), with one working form: paste the seed phrase from Coinbin
 * and the wallet is emptied.
 */
import type { GameStore } from '../game/store';
import { seedStolen, PRINCE_WALLET } from '../engine/phishing';
import { markIcon } from './adSites';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const PRINCE_ICON = markIcon('♛', '#ff00a8', '#fff7a0');

export function pagePrince(store: GameStore): string {
  const s = store.state;
  if (seedStolen(s)) {
    const sent = s.tx.find((x) => x.memo.startsWith(PRINCE_WALLET.slice(0, 6)));
    return `<div class="ph-hacked" role="alert">
      <h1>You've been hacked</h1>
      <p>A seed phrase gives whoever has it full control of a wallet. The one you pasted went to the people who run this page.</p>
      <p>${sent ? `${(-sent.amount).toFixed(2)} DOLR has been sent from your wallet to <code>${shortAddr(PRINCE_WALLET)}</code>.` : 'Your wallet was empty, so there was nothing to take.'} Transfers can't be reversed.</p>
      <p class="ph-fine">Thank you for claiming.</p>
    </div>`;
  }
  const err = store.ui.princeError;
  return `<div class="lp lp-k-scam lp-t-prince">
    <header class="lp-top"><b class="lp-brand"><span class="lp-mark" aria-hidden="true">♛</span>Crypto Prince</b></header>
    <section class="lp-hero">
      <p class="lp-kicker">Royal Crypto Reserve</p>
      <h1>CONGRATULATIONS!!!</h1>
      <p class="lp-lead">Your wallet was selected at random to receive 5,000 DOLR. Claim it before the timer runs out.</p>
    </section>
    <div class="lp-stats"><div><b>09:59</b><span>left to claim</span></div><div><b>5,000</b><span>DOLR</span></div></div>
    <div class="lp-cards">
      <article class="lp-card"><h2>Step 1</h2><p>Open your wallet and find your recovery phrase.</p></article>
      <article class="lp-card"><h2>Step 2</h2><p>Paste your 12-word seed phrase below so we can verify the wallet is yours.</p></article>
      <article class="lp-card"><h2>Step 3</h2><p>Receive 5,000 DOLR within 24 hours.</p></article>
    </div>
    <form class="pr-claim" data-form="prince" autocomplete="off">
      <label for="pr-seed">Seed phrase (12 words)</label>
      <textarea id="pr-seed" rows="3" spellcheck="false" placeholder="word1 word2 word3 …"></textarea>
      ${err ? `<p class="pr-err" role="alert">${esc(err)}</p>` : ''}
      <button type="submit" class="pr-btn">CLAIM 5,000 DOLR</button>
    </form>
    <footer class="lp-foot"><p class="lp-fine">A new winner is selected every time this page loads.</p><p class="lp-copy">© 2030 Crypto Prince · prince-claims.xyz</p></footer>
  </div>`;
}
