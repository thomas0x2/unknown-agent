/*
 * lonely.ai, from the Lonely.ai banner ad: a dating chat laid out like agent.chat. The player is
 * matched with Mia, who is warm for a few messages and then needs money. Every reply is scripted and
 * ignores what the player wrote. Her wallet is real (wallets.ts), so the player can pay; each payment
 * gets a thank-you, and the next ask is bigger.
 */
import type { GameState } from './state';
import { clone } from './core';
import { WALLETS } from './wallets';

/** Mia's Coinbin address, listed in WALLETS so sending here goes through. */
export const MIA_WALLET = '0x7c2e91b04fd36a58e1b9c40d27f6a3e85b10c4d9';

export const MATCH = { name: 'Mia', age: 31, line: '2 km away · between jobs', bio: 'Former UX researcher. Long walks by the harbour, mostly because they’re free.' };

/** Her first messages, one per message the player sends. */
const WARM = [
  'Hi :) I don’t usually reply first. Your profile made me laugh, which doesn’t happen much lately.',
  'I got let go in August. Some days I just walk along the harbour until it gets dark. What do you do with your days?',
  'You’re easy to talk to. I’ve been on here three weeks and you’re the first person who asks questions back.',
  'Can I tell you something embarrassing? My phone bill is overdue and they’re cutting me off tomorrow. If that happens I lose this too.',
];

/** What she asks for after each payment: [amount, the ask]. The last one repeats. */
const ASKS: [number, string][] = [
  [40, 'Could you send 40 DOLR? I’ll pay you back Friday, I promise. My wallet is {wallet}. You can send it on Coinbin.'],
  [60, 'Small thing, and I hate asking. The phone company charged a reconnection fee. 60 DOLR. Same wallet: {wallet}.'],
  [120, 'My landlord found out I’m behind. If I can show him 120 DOLR tonight he’ll give me until the end of the month. {wallet}. You’re the only one I can ask.'],
  [200, 'I found a job interview in another city. The train is 200 DOLR. Once I’m working I’ll pay back all of it, and then I can finally meet you. {wallet}'],
];

/** While she's waiting on money, she says one of these. */
const NUDGES = [
  'Did you send it? I keep checking.',
  'It’s fine if you can’t. I just thought we had something.',
  'Even half would help.',
  'Are you still there?',
];

const THANKS = [
  'You actually sent it. Thank you. Nobody has done anything like that for me in a long time.',
  'Thank you. I mean it. I’ll make it up to you.',
];

export interface LonelyMsg { from: 'you' | 'match'; text: string; day: number }
export interface LonelyChat { msgs: LonelyMsg[]; /** payments she has already thanked the player for */ thanked: number; /** how far into ASKS she is */ asked: number }

export const lonelyChat = (s: GameState): LonelyChat => s.lonely ?? { msgs: [], thanked: 0, asked: 0 };

/** Payments the player has made to Mia, from the Coinbin history. */
export const lonelyPayments = (s: GameState) => s.tx.filter((x) => x.amount < 0 && x.memo.startsWith(WALLETS[MIA_WALLET].name)).length;

const fill = (t: string) => t.replace('{wallet}', MIA_WALLET);

/** The player's message goes into the chat. Her reply comes from lonelyReply, a moment later. */
export function lonelySay(s0: GameState, text: string): GameState {
  const s = clone(s0);
  const c = lonelyChat(s);
  s.lonely = { ...c, msgs: [...c.msgs, { from: 'you', text, day: s.values.day }] };
  return s;
}

/** Her next line: warm-up, then an ask, nudges while unpaid, thanks and a bigger ask after each payment. */
export function lonelyReply(s0: GameState): GameState {
  const s = clone(s0);
  const c = lonelyChat(s);
  const said = c.msgs.filter((m) => m.from === 'you').length;
  const paid = lonelyPayments(s);
  let text: string;
  let { thanked, asked } = c;
  if (said <= WARM.length) text = WARM[said - 1];
  else if (paid > thanked) {
    // thank once per payment, and the next ask comes straight after
    text = THANKS[Math.min(thanked, THANKS.length - 1)] + ' ' + fill(ASKS[Math.min(asked, ASKS.length - 1)][1]);
    thanked = paid;
    asked += 1;
  } else if (asked === 0) {
    text = fill(ASKS[0][1]);
    asked = 1;
  } else text = NUDGES[(said - WARM.length - 1) % NUDGES.length];
  s.lonely = { msgs: [...c.msgs, { from: 'match', text, day: s.values.day }], thanked, asked };
  return s;
}
