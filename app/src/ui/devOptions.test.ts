import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { composeEmail } from '../engine/actions';
import { devOptionsPanel, effectsSummary, type DevOptionsSite } from './devOptions';
import type { GameStore } from '../game/store';
import { wordJev, startAll } from '../engine/_fixtures';

const content = loadContent();
const panel = (state: ReturnType<typeof startAll>, site: DevOptionsSite) =>
  devOptionsPanel({ state, content, ui: { devOptions: site } } as unknown as GameStore, site);

describe('dev options panel', () => {
  it('stays closed unless opened on that site', () => {
    const s = startAll(content);
    expect(devOptionsPanel({ state: s, content, ui: { devOptions: 'y' } } as unknown as GameStore, 'agent')).toBe('');
  });
  it('lists every agent hint topic with all its replies', () => {
    const html = panel(startAll(content), 'agent');
    for (const h of content.agent!.hints) {
      expect(html).toContain(`<b>${h.id}</b>`);
      expect(html).toContain(`Replies (${h.replies.length})`);
    }
  });
  it('shows a taken client job as buildable features', async () => {
    const { state } = await composeEmail(startAll(content), content, wordJev, 'gino@trattoria.test', 'I can build the website for the restaurant.');
    const html = panel(state, 'agent');
    expect(html).toContain('Trattoria Gino');
    expect(html).toContain('17:00-22:00');
  });
  it('lists open threads, email leads and scripted topics on day 1', () => {
    const html = panel(startAll(content), 'qmail');
    expect(html).toContain('d1_mom');
    expect(html).toContain('asked_mom_money');
    expect(html).toContain('gino@trattoria.test'); // Gino's lead from his Y post
    expect(html).toContain('No.'); // Gary
  });
  it('shows Y post categories and follower-gated story', () => {
    const html = panel(startAll(content), 'y');
    expect(html).toContain('hot_take');
    expect(html).toContain('d3_coffee_promo');
  });
  it('summarises effects', () => {
    expect(effectsSummary({ add: { crypto: -40, familyTrust: 5 }, setFlags: ['gift_chipped_in'] })).toEqual(['crypto -40', 'familyTrust +5', 'sets gift_chipped_in']);
  });
});

describe('no-reply mechanics in the Qmail panel', () => {
  it("shows what ignoring Mom costs", () => {
    const html = panel(startAll(content), 'qmail');
    expect(html).toContain('lapses tonight');
    expect(html).toContain('familyTrust -5');
  });
});

describe('translations in the agent panel', () => {
  it('lists every deepsleep line with its translation', async () => {
    const { DEEPSLEEP_LINES } = await import('../engine/deepsleep');
    const html = panel(startAll(content), 'agent');
    for (const l of DEEPSLEEP_LINES) { expect(html).toContain(l.zh); expect(html).toContain(l.en.replace(/'/g, '&#39;')); }
  });
});

describe('jobs in the agent panel', () => {
  it('lists every app job and gig with its status', async () => {
    const { contentJobs } = await import('./devOptions');
    const names = contentJobs(content).map((j) => j.outcome?.effects?.createApp?.name ?? j.ev.id);
    for (const n of ['Trattoria Gino', 'Spin Cycle Board', 'Vibe Check', 'Swaplist', 'Outreach Bot', 'd6_gym_reviews', 'd6_deepfake', 'coffee_post_paid', 'd2_restaurant_booking']) expect(names).toContain(n);
    expect(names).not.toContain('d1_mom');
    const html = panel(startAll(content), 'agent');
    expect(html).toContain('open now · email the lead');
    expect(html).toContain('followers &gt;=100');
  });
});
