/*
 * Swaplist from the buyer's side: the player chats with sellers, makes offers and buys things,
 * paying in DOLR from Coinbin. Sellers' chat replies come from the Writer (Claude Haiku, in the
 * seller's character, told what they are selling), or scripted lines. Offers are numbers, so the
 * seller's answer is arithmetic: at or above their lowest price it's a deal. The live app's bugs
 * apply: a broken contact button reaches nobody, wrong_seller reaches someone else, and a sold item
 * that still takes offers gets a "sorry, it's sold".
 */
import type { GameState, AppInstance, SwapThread, SwapState } from './state';
import type { Content } from '../content/schema';
import { clone, pick, money, playMinutes } from './core';
import { liveBugs } from './apps';
import { swapListings, type Listing } from './swaplist';
import { tooLong } from './actions';
import { MAX_INPUT_CHARS } from './config';
import { type Writer, type HistoryLine } from './writer';
import { settlePurchase } from './events';

/** The character (content/characters.json) who answers for each seller handle. */
export const SELLER_CHARACTER: Record<string, string> = {
  viktor: 'viktor', ines_sells: 'seller_ines', second_hand_sam: 'seller_sam', pia_l: 'seller_pia',
  kofi_a: 'seller_kofi', steph_m: 'seller_steph', walked_there_again: 'seller_walker',
};

export const TOO_LONG_SWAP = [
  "That's a lot to read about a used item. What's your question?",
  "I'm on my phone. Can you keep it short?",
];
const STILL_THERE = ["Still available.", "Yes, it's still here.", "It's in good shape. Come and have a look."];
const ALREADY_SOLD = ["Sorry, it's already sold.", "That one's gone, sorry."];
const WRONG_PERSON = (mine: string) => `I think you have the wrong person. I'm selling the ${mine.toLowerCase()}.`;
const DEAL = (n: number) => [`${n} works. It's yours if you pay through the site.`, `Fine, ${n}. Pay through the site and it's yours.`];
const NO_DEAL = (floor: number) => [`I can't go that low. ${floor} is the lowest.`, `Lowest I'd take is ${floor}.`];
const THANKS = ["Got it, thanks. Pickup whenever suits you.", "Payment's in. Thanks."];

export const swapApp = (s: GameState): AppInstance | undefined => s.apps.find((a) => a.template === 'swaplist' && a.deployed && !a.churned);

/** What Swaplist lists right now, the player's purchases included. */
export function liveListings(s: GameState, app: AppInstance): Listing[] {
  return swapListings(app.contentAt, playMinutes(s), s.flags.includes('viktor_sold_watch'), s.swap?.bought ?? {});
}

/** Who the contact button actually reaches: the seller, or with wrong_seller someone else on the site. */
export function contactRecipient(all: Listing[], l: Listing, wrongSeller: boolean): string {
  return wrongSeller ? all.find((x) => x.seller !== l.seller)?.seller ?? 'second_hand_sam' : l.seller;
}

/** The asking price the site shows (and charges): price_x100 multiplies it. */
export const shownPrice = (l: Listing, bugs: Set<string>) => (bugs.has('price_x100') ? l.price * 100 : l.price);

/** The lowest offer a seller takes. Viktor needs the money more than he wants to haggle. */
export const lowestOffer = (l: Listing) => Math.ceil(l.price * (l.seller === 'viktor' ? 0.9 : 0.75));

/** Whether the site still offers the offer box on a listing. */
export function takesOffers(app: AppInstance, l: Listing, bugs: Set<string>): boolean {
  const marks = app.features.some((f) => f.id === 'mark_sold');
  return l.price > 0 && !l.boughtByYou && (l.soldAt == null || !marks || bugs.has('offers_open'));
}

const swapOf = (s: GameState): SwapState => (s.swap ??= { threads: [], bought: {} });

export function threadFor(s: GameState, n: number): SwapThread | undefined {
  return s.swap?.threads.find((t) => t.listing === n);
}
function openThread(s: GameState, l: Listing): SwapThread {
  const sw = swapOf(s);
  let t = sw.threads.find((x) => x.listing === l.n);
  if (!t) { t = { listing: l.n, seller: l.seller, msgs: [] }; sw.threads.push(t); }
  return t;
}
const stamp = (s: GameState) => ({ day: s.values.day, min: s.clockMin });

interface Ctx { s: GameState; app: AppInstance; l: Listing; all: Listing[]; bugs: Set<string> }
function context(s: GameState, content: Content, n: number): Ctx | null {
  const app = swapApp(s);
  if (!app) return null;
  const all = liveListings(s, app);
  const l = all.find((x) => x.n === n);
  if (!l) return null;
  return { s, app, l, all, bugs: liveBugs(app, content.apps[app.template]) };
}

export interface SwapResult { state: GameState; sent: boolean }

/** The player messages the seller of listing `n`. The reply comes from whoever the button reaches. */
export async function swapMessage(s0: GameState, content: Content, writer: Writer, n: number, text: string): Promise<SwapResult> {
  const s = clone(s0);
  const c = context(s, content, n);
  if (!c || !c.app.features.some((f) => f.id === 'contact') || c.bugs.has('contact_dead')) return { state: s0, sent: false };
  const { l, all, bugs } = c;
  const to = contactRecipient(all, l, bugs.has('wrong_seller'));
  const t = openThread(s, l);
  const history: HistoryLine[] = t.msgs.map((m) => ({ from: m.from === 'you' ? 'player' : m.from === to ? 'self' : m.from, text: m.text }));
  t.msgs.push({ from: 'you', text, ...stamp(s) });
  if (tooLong(text)) {
    t.msgs.push({ from: to, text: pick(s, TOO_LONG_SWAP), ...stamp(s), debug: [`Over ${MAX_INPUT_CHARS} characters: scripted reply, Haiku skipped`] });
    return { state: s, sent: true };
  }
  let situation: string, fallback: string;
  if (to === l.seller) {
    const status = l.boughtByYou ? 'This buyer already bought it from you.' : l.soldAt != null ? 'It has already sold to someone else.' : 'It is still available.';
    const offer = t.offer ? ` They offered ${t.offer.amount} DOLR and you ${t.offer.status === 'accepted' ? 'accepted' : t.offer.status === 'declined' ? 'said no' : 'told them it was sold'}.` : '';
    situation = `You are @${to} on Swaplist, a local classifieds site. You listed "${l.title}" for ${l.price ? `${l.price} DOLR` : 'free'}. Your listing says: "${l.body.replace(/\s+/g, ' ')}". ${status}${offer} A buyer is messaging you about it.`;
    fallback = pick(s, l.soldAt != null && !l.boughtByYou ? ALREADY_SOLD : STILL_THERE);
  } else {
    // wrong_seller: a stranger gets a message about someone else's listing
    const mine = all.find((x) => x.seller === to)?.title ?? 'a few things';
    situation = `You are @${to} on Swaplist, a local classifieds site. You are selling "${mine}". A stranger has messaged you about "${l.title}", which is not your listing; you know nothing about it.`;
    fallback = WRONG_PERSON(mine);
  }
  const w = await writer.write({ as: to, character: SELLER_CHARACTER[to], prompt: text, fallback, history, situation });
  t.msgs.push({ from: to, text: w.text, ...stamp(s), ...(w.note ? { note: w.note } : {}), ...(w.debug ? { debug: w.debug } : {}) });
  return { state: s, sent: true };
}

/** The player offers `amount` DOLR on listing `n`. The seller answers at once. */
export function swapOffer(s0: GameState, content: Content, n: number, amount: number): GameState {
  const s = clone(s0);
  const c = context(s, content, n);
  if (!c || !takesOffers(c.app, c.l, c.bugs)) return s0;
  const { l } = c;
  const sw = swapOf(s);
  if (!Number.isFinite(amount) || amount <= 0) { sw.notice = { listing: n, text: 'Enter an offer in DOLR.' }; return s; }
  sw.notice = undefined;
  const t = openThread(s, l);
  const amt = Math.round(amount * 100) / 100;
  t.msgs.push({ from: 'you', text: `Offer: ${amt} DOLR`, ...stamp(s) });
  let reply: string;
  if (l.soldAt != null) { reply = pick(s, ALREADY_SOLD); t.offer = { amount: amt, status: 'sold' }; }
  else if (amt >= lowestOffer(l)) { reply = pick(s, DEAL(amt)); t.offer = { amount: amt, status: 'accepted' }; }
  else { reply = pick(s, NO_DEAL(lowestOffer(l))); t.offer = { amount: amt, status: 'declined' }; }
  t.msgs.push({ from: l.seller, text: reply, ...stamp(s) });
  return s;
}

/** What buying listing `n` costs now: an accepted offer, else the price the site shows. */
export function buyPrice(swap: SwapState | undefined, l: Listing, bugs: Set<string>): number {
  const t = swap?.threads.find((x) => x.listing === l.n);
  return t?.offer?.status === 'accepted' ? t.offer.amount : shownPrice(l, bugs);
}

/** The player buys listing `n` through the site, paying the seller in DOLR. */
export function swapBuy(s0: GameState, content: Content, n: number): GameState {
  const s = clone(s0);
  const c = context(s, content, n);
  if (!c || c.l.boughtByYou) return s0;
  const { l, bugs } = c;
  const sw = swapOf(s);
  if (l.soldAt != null) { sw.notice = { listing: n, text: `@${l.seller}: ${pick(s, ALREADY_SOLD)}` }; return s; }
  const cost = buyPrice(s.swap, l, bugs);
  if (cost > s.values.crypto) { sw.notice = { listing: n, text: `Not enough DOLR. This costs ${cost.toLocaleString('en-US')} and you have ${s.values.crypto.toLocaleString('en-US')}.` }; return s; }
  sw.notice = undefined;
  if (cost > 0) money(s, -cost, `@${l.seller} · Swaplist`);
  sw.bought[n] = { at: playMinutes(s), paid: cost };
  const t = openThread(s, l);
  t.msgs.push({ from: 'you', text: cost > 0 ? `Paid ${cost.toLocaleString('en-US')} DOLR.` : 'Claimed it.', ...stamp(s) });
  t.msgs.push({ from: l.seller, text: pick(s, THANKS), ...stamp(s) });
  settlePurchase(s, content, l.photo);
  return s;
}
