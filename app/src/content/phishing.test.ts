import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { phishLogin, hacked, COINBIN_PASSWORD, PASSWORDS_TXT, PHISH_DOMAIN } from '../engine/phishing';
import { route } from '../sites/registry';
import { driveFiles } from '../ui/qdrive';
import { WIDE } from '../ui/ads';

const content = loadContent();

describe('day 3 Coinbin phishing', () => {
  it('passwords.txt on Qdrive has the Coinbin password', () => {
    const f = driveFiles(startGame(content, 1)).find((x) => x.name === 'passwords.txt');
    expect(f?.preview).toBe(PASSWORDS_TXT);
    expect(PASSWORDS_TXT).toContain(`Coinbin: you@qmail.com / ${COINBIN_PASSWORD}`);
  });

  it('the phishing mail arrives on day 3 and links to the lookalike site', () => {
    let s = startGame(content, 1);
    s = endDay(s, content);
    expect(s.delivered.some((d) => d.eventId === 'd3_coinbin_phish')).toBe(false);
    s = endDay(s, content);
    expect(s.values.day).toBe(3);
    expect(s.delivered.some((d) => d.eventId === 'd3_coinbin_phish')).toBe(true);
    expect(content.events.find((e) => e.id === 'd3_coinbin_phish')!.body).toContain(`${PHISH_DOMAIN}/verify`);
    expect(route(`${PHISH_DOMAIN}/verify`, s)).toMatchObject({ site: 'phish', reachable: true });
  });

  it('a wrong password is refused and moves nothing', () => {
    const s = startGame(content, 1);
    for (const pw of ['', 'pinestreet4B', 'coinbin4b!']) {
      const r = phishLogin(s, pw);
      expect(r.error).toBeTruthy();
      expect(r.state).toBe(s);
    }
  });

  it('the right password empties the wallet into one outgoing transfer', () => {
    const s = startGame(content, 1);
    const before = s.values.crypto;
    const r = phishLogin(s, COINBIN_PASSWORD);
    expect(r.error).toBeUndefined();
    expect(hacked(r.state)).toBe(true);
    expect(r.state.values.crypto).toBe(0);
    expect(r.state.tx.at(-1)).toMatchObject({ amount: -before, memo: expect.stringMatching(/^0x9c1f…e07b · Sent$/) });
    expect(phishLogin(r.state, COINBIN_PASSWORD).state).toBe(r.state);
  });

  it('takes whatever the balance is, down to exactly 0', () => {
    const s = startGame(content, 1);
    s.values.crypto = 87.35;
    const r = phishLogin(s, COINBIN_PASSWORD);
    expect(r.state.values.crypto).toBe(0);
    expect(r.state.tx.at(-1)!.amount).toBe(-87.35);
  });

  it('the fake bank ad opens the same site', () => {
    expect(WIDE.find((a) => a.id === 'bank')?.href).toBe(`${PHISH_DOMAIN}/verify`);
  });
});
