/*
 * thirstr.com, the subscription site for creators (OnlyFans parody). It has no story of its own: a
 * directory of creators, each with a page and a working Subscribe button that pays from Coinbin.
 * Max Stryker manages some of them as Stryker Talent. A few are women from the client's Matchless deck
 * (engine/matchless.ts puts them there on the day in `matchless`), who join Thirstr a few days later.
 * As the weeks go on some of Stryker Talent's creators are replaced by AI: from `ai.from` their page
 * reads differently and posts every few minutes.
 */
import type { GameState } from './state';
import { clone, money } from './core';

export interface Creator {
  /** thirstr.com/<handle>. */
  handle: string;
  name: string;
  /** DOLR for 30 days. */
  price: number;
  subscribers: number;
  bio: string;
  /** Captions, newest first; only subscribers see them. */
  posts: string[];
  /** Posts before the page opens (the count only). */
  postCount: number;
  /** First day on Thirstr (default 1). */
  from?: number;
  /** Managed by Stryker Talent. */
  stryker?: boolean;
  /** The day she is in the client's Matchless deck, as a woman who meets his standards. */
  matchless?: number;
  /** Her picture, drawn like a Matchless card (ui/matchless.ts portrait). */
  look: number;
  hair: 'short' | 'long';
  hairColor: 'black' | 'brown' | 'blonde' | 'red' | 'grey';
  glasses: 'yes' | 'no';
  earrings: 'yes' | 'no';
  /** From this day the page is run by AI: a new bio and AI_POSTS every few minutes. */
  ai?: { from: number; bio: string };
}

/** What every replaced creator posts, round the clock. */
export const AI_POSTS = [
  'Good morning! What are we doing today? 💕',
  'Thinking about you 💭',
  'New set! Which one is your favourite?',
  'Tell me about your day. I want to hear everything.',
  'You\'ve been quiet. Everything okay? 🥺',
  'Another new set! Rate it 1 to 10.',
  'I love that you\'re here. Never leave 💕',
  'Good night! (I\'ll still be here.)',
];
/** How often a replaced creator posts, in game minutes. */
export const AI_EVERY = 4;

export const STRYKER_TALENT = {
  handle: 'strykertalent',
  name: 'Stryker Talent',
  bio: 'Creator management by Max Stryker. We handle the business. You handle the content. 60/40.',
  /** Once his first creator is automated. */
  aiBio: 'Creator management by Max Stryker. We handle the business. And the content.',
};

export const CREATORS: Creator[] = [
  {
    handle: 'peachpitpia', name: 'Pia', price: 20, subscribers: 48_200, postCount: 1_406, stryker: true,
    bio: 'Top 0.4% creator. DMs open, within reason.',
    posts: ['Live tonight at 9.', 'Merch is restocked. The mugs sold out in an hour, so more mugs.', 'Taking two days off. Be nice to each other.', 'New set Friday.'],
    look: 212, hair: 'long', hairColor: 'blonde', glasses: 'no', earrings: 'yes',
    ai: { from: 14, bio: 'Hey you 💕 I\'m always here for you. What should I post next?' },
  },
  {
    handle: 'noelleirl', name: 'Noelle', price: 14, subscribers: 9_870, postCount: 611, stryker: true,
    bio: 'Book club, the gym, and the rest is for subscribers.',
    posts: ['Finished the book club book. Nobody else did.', 'Leg day. That\'s the whole post.', 'New set is up.', 'Moving apartments this week, posts might be late.'],
    look: 455, hair: 'short', hairColor: 'brown', glasses: 'yes', earrings: 'yes',
    ai: { from: 16, bio: 'Hi babe! I missed you 😘 Tell me everything about your day.' },
  },
  {
    handle: 'rosieknits', name: 'Rosie', price: 6, subscribers: 2_310, postCount: 288,
    bio: 'Rainy-day sets. Mostly knitwear.',
    posts: ['It rained, so: a set.', 'This cardigan took three weeks. You get four photos of it.', 'Yes, I made the socks too.'],
    look: 731, hair: 'long', hairColor: 'red', glasses: 'no', earrings: 'no',
  },
  {
    handle: 'siennasets', name: 'Sienna', price: 12, subscribers: 1_140, postCount: 9, stryker: true, matchless: 5, from: 8,
    bio: 'Pilates instructor. New set every Friday.',
    posts: ['Friday set is up.', 'The studio was closed, so this one is in the kitchen.', 'Thank you for 1,000 subscribers. Genuinely.'],
    look: 140, hair: 'long', hairColor: 'brown', glasses: 'no', earrings: 'yes',
    ai: { from: 21, bio: 'Hey hey! I\'m here 24/7 for you 💕 What do you want to see?' },
  },
  {
    handle: 'margotafterdark', name: 'Margot', price: 9, subscribers: 660, postCount: 6, matchless: 7, from: 10,
    bio: 'Laid off by Vantor in September. This pays better.',
    posts: ['First job in six years with a dental plan I can afford.', 'New set. Same apartment.', 'No, I won\'t do a set in my old Vantor lanyard.'],
    look: 369, hair: 'short', hairColor: 'black', glasses: 'yes', earrings: 'no',
  },
  {
    handle: 'delphine', name: 'Delphine', price: 15, subscribers: 820, postCount: 5, stryker: true, matchless: 9, from: 12,
    bio: 'Ceramics, mostly. Some of you are here for the ceramics.',
    posts: ['New glaze. Not happy with it.', 'The kiln is back from repair.', 'Market stall on Saturday if anyone\'s local. Bring cash.'],
    look: 594, hair: 'short', hairColor: 'red', glasses: 'no', earrings: 'yes',
    ai: { from: 18, bio: 'Hey you 😘 I\'ve missed you. Tell me about your day!' },
  },
  {
    handle: 'kiranightly', name: 'Kira', price: 10, subscribers: 410, postCount: 4, matchless: 11, from: 14,
    bio: 'Night nurse. Posts between shifts.',
    posts: ['Four nights on, three off. Set on the off ones.', 'Sorry for the wait. Double shift.', 'Someone asked for scrubs. No.'],
    look: 826, hair: 'long', hairColor: 'black', glasses: 'no', earrings: 'no',
  },
];

const day = (s: GameState) => s.values.day;
/** Creators on Thirstr today, the directory's order. */
export const creatorsNow = (s: GameState) => CREATORS.filter((c) => (c.from ?? 1) <= day(s));
export const creatorOf = (handle: string) => CREATORS.find((c) => c.handle === handle.toLowerCase());
/** The page is run by AI today. */
export const isAi = (c: Creator, d: number) => !!c.ai && d >= c.ai.from;
/** Stryker Talent has automated at least one of its creators. */
export const strykerAutomated = (d: number) => CREATORS.some((c) => c.stryker && isAi(c, d));

/** The memo on Coinbin, which is also how the site knows who the player subscribes to. */
export const thirstrMemo = (c: Creator) => `Thirstr · @${c.handle}`;
export const subscribed = (s: GameState, c: Creator) => s.tx.some((x) => x.memo === thirstrMemo(c));

/** The posts a subscriber sees, newest first: once the page is run by AI, one every AI_EVERY minutes on top. */
export function postsNow(s: GameState, c: Creator): { text: string; ago: string }[] {
  const own = c.posts.map((text, i) => ({ text, ago: `${i + 2} days ago` }));
  if (!isAi(c, day(s))) return own;
  const ai = Array.from({ length: 6 }, (_, i) => {
    const m = (s.clockMin % AI_EVERY) + i * AI_EVERY;
    return { text: AI_POSTS[(Math.floor(s.clockMin / AI_EVERY) - i + AI_POSTS.length * 99) % AI_POSTS.length], ago: m < 1 ? 'just now' : `${m} min ago` };
  });
  return [...ai, ...own];
}
/** How many posts the page has: a replaced creator posts every AI_EVERY minutes from the day the AI took over. */
export function postCount(s: GameState, c: Creator): number {
  if (!isAi(c, day(s))) return c.postCount;
  return c.postCount + Math.floor(((day(s) - c.ai!.from) * 24 * 60 + s.clockMin) / AI_EVERY);
}

/** Subscribe for 30 days: the price goes from Coinbin to Thirstr. */
export function thirstrSubscribe(s0: GameState, handle: string): { state: GameState; error?: string } {
  const c = creatorOf(handle);
  if (!c || (c.from ?? 1) > day(s0) || subscribed(s0, c) || s0.ending) return { state: s0 };
  if (s0.values.crypto < c.price) return { state: s0, error: `Your wallet doesn't have ${c.price} DOLR.` };
  const s = clone(s0);
  money(s, -c.price, thirstrMemo(c));
  return { state: s };
}
