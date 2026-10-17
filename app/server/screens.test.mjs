/* The player's screens as Haiku reads them for a query: only what the view holds, filtered by search. */
import { readSite, runQueryTool } from './screens.mjs';

const view = {
  mail: [
    { day: 1, time: '10:20', from: 'Gino Fenoglio', addr: 'gino@trattoria.test', subject: 'A website', body: 'My nephew left with the password.', unread: true },
    { day: 1, time: '11:00', folder: 'sent', to: 'gino@trattoria.test', subject: 'Re: A website', body: 'On it.' },
  ],
  y: [{ day: 1, time: '12:00', author: 'Randall Crane', handle: 'randall_crane', text: 'Robots stole your job. Vote Crane.' }],
  yowl: [{ business: 'Bean There', stars: 2, author: 'k', text: 'Cold coffee.' }],
  citypulse: [],
  apps: [{ name: 'Trattoria Gino', url: 'trattoria.test', deployed: true, client: 'Gino' }],
  tx: [{ day: 1, amount: -5, memo: 'agent.chat' }],
  wallet: { dolr: 95, followers: 12, model: 1, rent: { amount: 350, day: 7 } },
};

describe('screens', () => {
  it('reads the inbox and sent mail', () => {
    const out = readSite(view, 'qmail');
    expect(out).toContain('FROM Gino Fenoglio <gino@trattoria.test>, "A website" (unread)');
    expect(out).toContain('SENT to gino@trattoria.test');
  });
  it('filters by search', () => {
    expect(readSite(view, 'y', 'crane')).toContain('Vote Crane');
    expect(readSite(view, 'y', 'keller')).toBe('Nothing on y matches "keller".');
  });
  it('shows empty sites and the wallet', () => {
    expect(readSite(view, 'citypulse')).toBe('No articles up yet.');
    expect(readSite(view, 'coinbin')).toContain('Balance 95 DOLR. Y followers 12. Model agent-1. Rent of 350 DOLR is due on day 7.');
    expect(readSite(view, 'forkyard')).toContain('Trattoria Gino (trattoria.test): live, built for Gino');
  });
  it('refuses unknown sites and tools', () => {
    expect(readSite(view, 'nullboard')).toMatch(/^No site called "nullboard"/);
    expect(readSite(null, 'y')).toBe('That site could not be read right now.');
    expect(runQueryTool('read_bible', {}, view)).toBe('Unknown tool read_bible.');
    expect(runQueryTool('check_site', { site: 'yowl' }, view)).toContain('Bean There: 2★');
  });
});
