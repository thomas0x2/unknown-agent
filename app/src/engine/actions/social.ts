/*
 * Y posts, Yowl reviews and the app promotion they can trigger.
 */
import type { GameState } from '../state';
import type { Content } from '../../content/schema';
import type { JevRouter, PostRating } from '../jev';
import { Y as YCFG, APPS } from '../config';
import { clone, addValue, log, rand, addFlag } from '../core';
import { applyEffects } from '../effects';
import { queueAt, yPostEvents } from '../events';
import { appNames } from './agent';
import { replyContext } from './mail';
import { nextId, stateSummary } from './shared';
import { scriptedWriter, type Writer } from '../writer';
import { rollYReplies } from '../yReplies';

/**
 * A post that is about a live user app brings it users, once per platform: the first Y post and the
 * first Yowl review about it. A Y post can also answer an event waiting on one (`yPost`, Gino asking for
 * a post about his new site), which then lands a little later. Jev reads what the post is about.
 * Returns the apps it boosted.
 */
export async function promoteApps(jev: JevRouter, s: GameState, platform: 'y' | 'yowl', text: string, content?: Content): Promise<string[]> {
  const open = s.apps.filter((a) => a.kind === 'user' && a.deployed && !a.churned && !a.promoted?.includes(platform));
  const waiting = platform === 'y' && content ? yPostEvents(s, content) : [];
  if (!open.length && !waiting.length) return [];
  const what = platform === 'y' ? 'post' : 'review';
  const d = await jev.route({
    channel: platform, text, stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: [
      ...open.map((a) => ({ id: a.id, when: `The ${what} is about, recommends or promotes ${a.name} (${a.url}).`, keys: content ? [appNames(a, content).join('|')] : [a.name] })),
      ...waiting.map((ev) => ({ id: `event:${ev.id}`, when: ev.yPost!.when, keys: ev.yPost!.keys })),
    ],
  });
  const ev = d.kind === 'outcome' ? waiting.find((x) => `event:${x.id}` === d.outcomeId) : undefined;
  if (ev) { queueAt(s, ev, s.clockMin + (ev.yPost!.after ?? 30)); return []; }
  const a = d.kind === 'outcome' ? open.find((x) => x.id === d.outcomeId) : undefined;
  if (!a) return [];
  const add = platform === 'y' ? Math.max(APPS.user.promoY.min, Math.round(s.values.followers * APPS.user.promoY.followerShare)) : APPS.user.promoYowl;
  a.users = (a.users ?? 0) + add;
  (a.promoted ??= []).push(platform);
  log(s, `${a.name}: +${add} users from your ${platform === 'y' ? 'Y post' : 'Yowl review'}.`, 'info');
  return [a.id];
}

// ── Y ──

/** Follower change per post category, as a share of current followers (low to high quality). */
export const POST_BANDS: Record<PostRating['category'], [number, number]> = {
  reaction: [0.05, 0.15], launch: [0.03, 0.08], tip: [0.02, 0.06], humor: [0, 0.12],
  hot_take: [0.1, 0.25], self_promo: [-0.03, -0.01], spam: [-0.05, -0.02],
};

/** Flat follower change per category that small accounts get when it beats the share above (low to high quality). */
export const POST_FLOORS: Record<PostRating['category'], [number, number]> = {
  reaction: [8, 14], launch: [2, 8], tip: [1, 5], humor: [0, 8],
  hot_take: [4, 12], self_promo: [-3, -1], spam: [-5, -2],
};

/** Follower change for a rated post before jitter: the share of followers or the flat floor, whichever is bigger. */
export function postBase(category: PostRating['category'], quality: number, followers: number): number {
  const [lo, hi] = POST_BANDS[category];
  const [flo, fhi] = POST_FLOORS[category];
  const share = followers * (lo + (hi - lo) * quality);
  const floor = flo + (fhi - flo) * quality;
  return Math.abs(floor) > Math.abs(share) ? floor : share;
}

export interface PostResult { state: GameState; rating: PostRating; followerDelta: number }

/** Post to Y. Jev rates it; the rating becomes a follower change per the rubric. */
export async function postToY(
  s0: GameState,
  jev: JevRouter,
  text: string,
  trending: string[],
  content?: Content,
  writer: Writer = scriptedWriter,
): Promise<PostResult> {
  const s = clone(s0);
  const rating = await jev.ratePost({ text, trending, recentPosts: s.recentPosts, followers: s.values.followers });

  let delta: number;
  if (s.postsToday >= YCFG.maxFreePostsPerDay) {
    delta = Math.round(s.values.followers * YCFG.overpostPenaltyPct);
  } else {
    const jitter = 1 + YCFG.postJitter * (2 * rand(s) - 1);
    delta = Math.round(postBase(rating.category, rating.quality, s.values.followers) * jitter);
    if (rating.category === 'hot_take') addValue(s, 'familyTrust', -Math.round(5 + 5 * rating.quality));
  }
  addValue(s, 'followers', delta);
  s.postsToday += 1;
  s.recentPosts = [text, ...s.recentPosts].slice(0, 5);
  const id = `u${s.userPosts.length + 1}`;
  s.userPosts.push({ id, text, day: s.values.day, min: s.clockMin, likes: Math.max(0, delta * 3 + Math.round(s.values.followers * 0.02)), delta, score: rating.quality * 4 });
  log(s, `Posted on Y (${rating.category}): ${delta >= 0 ? '+' : ''}${delta} followers.`, 'info');
  await promoteApps(jev, s, 'y', text, content);
  if (content) await rollYReplies(s, content, writer, { id, text }); // doomscroll, cat_ceo and zev.dolr may answer
  return { state: s, rating, followerDelta: delta };
}

// ── Yowl reviews ──

export async function writeReview(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  bizId: string,
  stars: number,
  text: string,
): Promise<{ state: GameState; posted: boolean }> {
  const s = clone(s0);
  if (s.reviews.some((r) => r.bizId === bizId && r.mine)) return { state: s, posted: false };
  s.reviews.push({ id: nextId(s, 'rev'), bizId, author: 'You', stars, text, day: s.values.day, mine: true });
  addFlag(s, `reviewed_${bizId}`); // the owner knows the player's name from it
  if (stars <= 2) addFlag(s, `trashed_${bizId}`); // and holds it against them
  // a review can trigger a story outcome (e.g. the gym fake-review gig)
  const ev = content.events.find((e) => e.site === 'yowl' && !s.fired.includes(e.id) && (e.addr === bizId || e.id.includes(bizId)));
  if (ev && ev.outcomes) {
    const decision = await jev.route({ channel: 'yowl', text: `${stars} stars: ${text}`, context: replyContext(s, content, 'yowl', ev, '', text), stateSummary: stateSummary(s), candidates: ev.outcomes.map((o) => ({ id: o.id, when: o.when })), hints: ev.hints ?? [] });
    if (decision.kind === 'outcome') {
      const o = ev.outcomes.find((x) => x.id === decision.outcomeId);
      if (o) { applyEffects(s, o.effects, ev.job, ev.id); s.fired.push(ev.id); }
    }
  }
  await promoteApps(jev, s, 'yowl', text);
  log(s, `Posted a Yowl review.`, 'info');
  return { state: s, posted: true };
}
