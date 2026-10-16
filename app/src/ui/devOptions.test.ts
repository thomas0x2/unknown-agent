import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from '../engine/day';
import { composeEmail } from '../engine/actions';
import { offlineJev } from '../engine/jev';
import { devOptionsPanel, effectsSummary, type DevOptionsSite } from './devOptions';
import type { GameStore } from '../game/store';

const content = loadContent();
const panel = (state: ReturnType<typeof startGame>, site: DevOptionsSite) =>
  devOptionsPanel({ state, content, ui: { devOptions: site } } as unknown as GameStore, site);

describe('dev options panel', () => {
  it('stays closed unless opened on that site', () => {
    const s = startGame(content);
    expect(devOptionsPanel({ state: s, content, ui: { devOptions: 'y' } } as unknown as GameStore, 'agent')).toBe('');
  });
  it('lists every agent hint topic with all its replies', () => {
    const html = panel(startGame(content), 'agent');
    for (const h of content.agent!.hints) {
      expect(html).toContain(`<b>${h.id}</b>`);
      expect(html).toContain(`Replies (${h.replies.length})`);
    }
  });
  it('shows a taken client job as buildable features', async () => {
    const { state } = await composeEmail(startGame(content), content, offlineJev, 'gino@trattoria.test', 'I can build the website for the restaurant.');
    const html = panel(state, 'agent');
    expect(html).toContain('Trattoria Gino');
    expect(html).toContain('17:00-22:00');
  });
  it('lists open threads, email leads and scripted topics on day 1', () => {
    const html = panel(startGame(content), 'qmail');
    expect(html).toContain('d1_mom');
    expect(html).toContain('asked_mom_money');
    expect(html).toContain('gino@trattoria.test'); // Gino's lead from his Y post
    expect(html).toContain('No.'); // Gary
  });
  it('shows Y post categories and follower-gated story', () => {
    const html = panel(startGame(content), 'y');
    expect(html).toContain('hot_take');
    expect(html).toContain('d3_coffee_promo');
  });
  it('summarises effects', () => {
    expect(effectsSummary({ add: { crypto: -40, familyTrust: 5 }, setFlags: ['gift_chipped_in'] })).toEqual(['crypto -40', 'familyTrust +5', 'sets gift_chipped_in']);
  });
});
