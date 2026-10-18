/*
 * Replies from the Y regulars. Every time the player posts on Y, doomscroll, cat_ceo and zev.dolr are
 * each rolled to reply under it; noodleposter stays a background poster. The chance is where the
 * player's followers sit between 0 and max_followers, with a small floor so a new account still gets
 * the odd reply. The Writer (Claude Haiku, in the regular's character) words each reply when the post
 * goes up; it lands a few game minutes later, like the Swaplist sellers (deliverYReplies, on the tick).
 *
 * max_followers is the best case of every follower gain added up, not one playthrough: each day's
 * free posts at the best category and quality, at the top of their jitter, and every follower jump
 * a story post can bring (the deepfake) at the top of its spread, on the first day it can happen.
 */
import type { GameState, YExtra } from './state';
import type { Content } from '../content/schema';
import { Y as YCFG, LAST_DAY, START } from './config';
import { POST_BANDS, postBase } from './actions/social';
import { playMinutes, rand, randInt, pick } from './core';
import type { Writer } from './writer';

/** The regulars who reply to the player's posts, and the character (content/characters/) that writes for each. */
export const Y_REPLIERS = [
  { handle: 'doomscroll', author: 'doomscroll', character: 'y_doomscroll' },
  { handle: 'cat_ceo', author: 'cat_ceo', character: 'y_cat_ceo' },
  { handle: 'zev_dolr', author: 'zev.dolr', character: 'y_zev_dolr' },
] as const;

/** Scripted replies for when Haiku isn't asked or doesn't answer. */
const FALLBACK: Record<string, string[]> = {
  doomscroll: ['read this three times. still not sure how i feel. it\'s fine', 'saw this at 3am. the replies were already arguing', 'notifications on for this account now, apparently'],
  cat_ceo: ['Showed this to the cat. She has notes.', 'The cat liked it. I mean she sat on the phone while it was open.', 'Saving this for the 5am board meeting.'],
  zev_dolr: ['this is why i hold DOLR', 'bookmarked. will read it after i ship', 'agent could build this in an afternoon. not financial advice'],
};

/** Game minutes a regular takes to reply. */
export const Y_REPLY_DELAY = { min: 4, max: 25 } as const;

let ceilings: { key: Content; byDay: number[] } | undefined;

/** The most followers any player could have by the end of `day`. */
export function maxFollowers(content: Content, day: number): number {
  if (ceilings?.key !== content) ceilings = { key: content, byDay: bestCase(content) };
  const d = Math.max(1, Math.min(day, LAST_DAY));
  return ceilings.byDay[d];
}

/** The best post any account can make, at the top of its jitter, as a follower gain. */
function bestPost(followers: number): number {
  const cats = Object.keys(POST_BANDS) as (keyof typeof POST_BANDS)[];
  return Math.max(0, ...cats.map((c) => Math.round(postBase(c, 1, followers) * (1 + YCFG.postJitter))));
}

function bestCase(content: Content): number[] {
  // story posts that bring followers, each counted once (the deepfake's second offer is the same post)
  const jumps = new Map<string, { day: number; gain: number }>();
  for (const ev of content.events) {
    const f = ev.agentJob?.post.followers;
    if (!f) continue;
    const day = ev.trigger.dayMin ?? ev.job?.dueDay ?? 1;
    const key = ev.agentJob!.post.text;
    const prev = jumps.get(key);
    if (!prev || day < prev.day) jumps.set(key, { day, gain: f.base + f.spread });
  }
  const byDay = [START.followers];
  let n = START.followers;
  for (let d = 1; d <= LAST_DAY; d++) {
    // a jump goes first: every post after it grows from the bigger number
    for (const j of jumps.values()) if (j.day === d) n += j.gain;
    for (let i = 0; i < YCFG.maxFreePostsPerDay; i++) n += bestPost(n);
    byDay.push(n);
  }
  return byDay;
}

/** The chance each regular replies to the player's next post. */
export function yReplyChance(s: GameState, content: Content): number {
  const max = maxFollowers(content, s.values.day);
  return Math.min(1, Math.max(YCFG.replyFloor, s.values.followers / max));
}

/**
 * The player just posted `post` on Y: roll each regular, have the Writer word the replies that come,
 * and queue them. Returns how many are on their way.
 */
export async function rollYReplies(s: GameState, content: Content, writer: Writer, post: { id: string; text: string }): Promise<number> {
  const chance = yReplyChance(s, content);
  const coming = Y_REPLIERS.filter(() => rand(s) < chance);
  if (!coming.length) return 0;
  const lines = await Promise.all(coming.map(async (r) => {
    const fallback = pick(s, FALLBACK[r.handle]);
    const w = await writer.write({
      as: r.handle, character: r.character, mode: 'y', prompt: post.text, fallback,
      situation: `You are @${r.handle} on Y. Someone with ${s.values.followers} followers just posted the message below, and you are replying under it.`,
    });
    return w.text;
  }));
  const now = playMinutes(s);
  coming.forEach((r, i) => {
    const reply: YExtra = { id: `yr_${post.id}_${r.handle}`, author: r.author, handle: r.handle, text: lines[i], day: s.values.day, min: s.clockMin, likes: randInt(s, 0, 6), replyTo: post.id, generated: true };
    s.yReplies.push({ due: now + randInt(s, Y_REPLY_DELAY.min, Y_REPLY_DELAY.max), reply });
  });
  s.yReplies.sort((a, b) => a.due - b.due);
  return coming.length;
}

/** Replies whose time has come go up on Y, stamped with the time they land. True if any did. */
export function deliverYReplies(s: GameState): boolean {
  const now = playMinutes(s);
  let any = false;
  while (s.yReplies.length && s.yReplies[0].due <= now) {
    const { reply } = s.yReplies.shift()!;
    s.yExtra.push({ ...reply, day: s.values.day, min: s.clockMin });
    any = true;
  }
  return any;
}
