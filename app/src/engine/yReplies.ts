/*
 * Replies from the Y regulars. Every time the player posts on Y, doomscroll, cat_ceo and zev.dolr are
 * each rolled to answer it; noodleposter stays a background poster. The chance climbs with the
 * player's followers on a log scale: a small account almost never hears from them, a big one often.
 * The Writer (Claude Haiku, in the regular's character) words each reply when the post goes up; it
 * lands a few game minutes later, like the Swaplist sellers (deliverYReplies, on the tick), as an
 * ordinary post that tags the player.
 */
import type { GameState, YExtra } from './state';
import { Y as YCFG } from './config';
import { playMinutes, rand, randInt, pick } from './core';
import type { Writer } from './writer';

/** The player's handle on Y; replies tag it. */
export const PLAYER_HANDLE = 'you';

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

/**
 * The chance each regular answers the player's next post: Y.reply.floor up to Y.reply.floorAt
 * followers, then rising evenly per tenfold to Y.reply.cap at Y.reply.capAt.
 */
export function yReplyChance(s: GameState): number {
  const { floor, cap, floorAt, capAt } = YCFG.reply;
  const f = s.values.followers;
  if (f <= floorAt) return floor;
  const t = Math.min(1, Math.log10(f / floorAt) / Math.log10(capAt / floorAt));
  return floor + (cap - floor) * t;
}

/**
 * The player just posted `post` on Y: roll each regular, have the Writer word the replies that come,
 * and queue them. Returns how many are on their way.
 */
export async function rollYReplies(s: GameState, writer: Writer, post: { id: string; text: string }): Promise<number> {
  const chance = yReplyChance(s);
  const coming = Y_REPLIERS.filter(() => rand(s) < chance);
  if (!coming.length) return 0;
  const lines = await Promise.all(coming.map(async (r) => {
    const fallback = pick(s, FALLBACK[r.handle]);
    const w = await writer.write({
      as: r.handle, character: r.character, mode: 'y', prompt: post.text, fallback,
      situation: `You are @${r.handle} on Y. Someone with ${s.values.followers} followers just posted the message below, and you are posting about it, tagging them.`,
    });
    return { text: w.text, scripted: w.llm ? undefined : (w.note ?? w.debug?.[0] ?? 'Haiku did not answer') };
  }));
  const now = playMinutes(s);
  coming.forEach((r, i) => {
    const reply: YExtra = { id: `yr_${post.id}_${r.handle}`, author: r.author, handle: r.handle, text: `@${PLAYER_HANDLE} ${lines[i].text}`, day: s.values.day, min: s.clockMin, likes: randInt(s, 0, 6), replyTo: post.id, generated: true, scripted: lines[i].scripted };
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
