import { startAll, endAll } from '../engine/_fixtures';
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { phishLogin, hacked, COINBIN_PASSWORD, PASSWORDS_TXT, PHISH_DOMAIN, seedClaim, seedStolen, SEED_PHRASE, PRINCE_WALLET } from '../engine/phishing';
import { route } from '../sites/registry';
import { driveFiles } from '../ui/qdrive';
import { WIDE, AD_HREFS } from '../ui/ads';

const content = loadContent();

describe('day 3 Coinbin phishing', () => {
  it('passwords.txt on Qdrive has the Coinbin password', () => {
    const f = driveFiles(startAll(content, 1)).find((x) => x.name === 'passwords.txt');
    expect(f?.preview).toBe(PASSWORDS_TXT);
    expect(PASSWORDS_TXT).toContain(`Coinbin: you@qmail.com / ${COINBIN_PASSWORD}`);
  });

  it('the phishing mail arrives on day 3 and links to the lookalike site', () => {
    let s = startAll(content, 1);
    s = endAll(s, content);
    expect(s.delivered.some((d) => d.eventId === 'd3_coinbin_phish')).toBe(false);
    s = endAll(s, content);
    expect(s.values.day).toBe(3);
    expect(s.delivered.some((d) => d.eventId === 'd3_coinbin_phish')).toBe(true);
    expect(content.events.find((e) => e.id === 'd3_coinbin_phish')!.body).toContain(`${PHISH_DOMAIN}/verify`);
    expect(route(`${PHISH_DOMAIN}/verify`, s)).toMatchObject({ site: 'phish', reachable: true });
  });

  it('a wrong password is refused and moves nothing', () => {
    const s = startAll(content, 1);
    for (const pw of ['', 'pinestreet4B', 'coinbin4b!']) {
      const r = phishLogin(s, pw);
      expect(r.error).toBeTruthy();
      expect(r.state).toBe(s);
    }
  });

  it('the right password empties the wallet into one outgoing transfer', () => {
    const s = startAll(content, 1);
    const before = s.values.crypto;
    const r = phishLogin(s, COINBIN_PASSWORD);
    expect(r.error).toBeUndefined();
    expect(hacked(r.state)).toBe(true);
    expect(r.state.values.crypto).toBe(0);
    expect(r.state.tx.at(-1)).toMatchObject({ amount: -before, memo: expect.stringMatching(/^0x9c1f…e07b · Sent$/) });
    expect(phishLogin(r.state, COINBIN_PASSWORD).state).toBe(r.state);
  });

  it('takes whatever the balance is, down to exactly 0', () => {
    const s = startAll(content, 1);
    s.values.crypto = 87.35;
    const r = phishLogin(s, COINBIN_PASSWORD);
    expect(r.state.values.crypto).toBe(0);
    expect(r.state.tx.at(-1)!.amount).toBe(-87.35);
  });

  it('the fake bank ad opens the same site', () => {
    expect(WIDE.find((a) => a.id === 'bank')?.href).toBe(`${PHISH_DOMAIN}/verify`);
  });
});

describe('prince-claims.xyz seed phrase scam', () => {
  it('the Crypto Prince ad opens it, and it is always reachable', () => {
    expect(AD_HREFS).toContain('prince-claims.xyz');
    expect(route('prince-claims.xyz', startAll(content, 1))).toMatchObject({ site: 'prince', reachable: true });
  });

  it('refuses anything but the real phrase, and an empty box', () => {
    const s = startAll(content, 1);
    expect(seedClaim(s, '').error).toBeTruthy();
    expect(seedClaim(s, 'one two three four five six seven eight nine ten eleven twelve').error).toMatch(/not a valid seed phrase/);
    expect(seedClaim(s, SEED_PHRASE.split(' ').reverse().join(' ')).state).toBe(s);
  });

  it('the real phrase (any spacing or case) empties the wallet to the prince', () => {
    const s = startAll(content, 1);
    s.values.crypto = 142.5;
    const r = seedClaim(s, '  ' + SEED_PHRASE.toUpperCase().split(' ').join('\n') + ' ');
    expect(r.error).toBeUndefined();
    expect(r.state.values.crypto).toBe(0);
    expect(r.state.tx.at(-1)!.memo).toContain(PRINCE_WALLET.slice(0, 6));
    expect(seedStolen(r.state)).toBe(true);
    expect(hacked(r.state)).toBe(false);
    // once is enough
    expect(seedClaim(r.state, SEED_PHRASE).state).toBe(r.state);
  });

  it('the phrase is twelve words', () => {
    expect(SEED_PHRASE.split(' ')).toHaveLength(12);
  });
});
