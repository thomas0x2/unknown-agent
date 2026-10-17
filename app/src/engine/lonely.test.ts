import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { lonelySay, lonelyReply, lonelyChat, MIA_WALLET } from './lonely';
import { sendCrypto } from './wallets';
import { route } from '../sites/registry';

const talk = (s: ReturnType<typeof newGame>, text = 'hi') => lonelyReply(lonelySay(s, text));
const last = (s: ReturnType<typeof newGame>) => lonelyChat(s).msgs.at(-1)!.text;

describe('lonely.ai', () => {
  it('is always reachable', () => {
    expect(route('lonely.ai', newGame())).toMatchObject({ site: 'lonely', reachable: true });
  });

  it('warms up for four messages, then asks for 40 DOLR with her wallet, then nudges', () => {
    let s = newGame();
    for (let i = 0; i < 4; i++) { s = talk(s); expect(last(s)).not.toContain(MIA_WALLET); }
    s = talk(s);
    expect(last(s)).toContain('40 DOLR');
    expect(last(s)).toContain(MIA_WALLET);
    s = talk(s);
    expect(last(s)).not.toContain(MIA_WALLET);
    expect(lonelyChat(s).msgs).toHaveLength(12);
  });

  it('her wallet takes money, and each payment gets thanks and a bigger ask', () => {
    let s = newGame();
    for (let i = 0; i < 5; i++) s = talk(s);
    const r = sendCrypto(s, MIA_WALLET, 40);
    expect(r.error).toBeUndefined();
    s = talk(r.state);
    expect(last(s)).toMatch(/^You actually sent it/);
    expect(last(s)).toContain('60 DOLR');
    s = talk(s);
    expect(last(s)).not.toMatch(/Thank/);
    s = talk(sendCrypto(s, MIA_WALLET, 30).state);
    expect(last(s)).toContain('120 DOLR');
  });
});
