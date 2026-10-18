/*
 * Y: the timeline, posts and profiles.
 */
import { GameStore } from '../../game/store';
import { ICONS, Y_ICONS } from '../icons';
import { type GameState, dateShort } from '../../engine';
import { adHtml } from '../ads';
import { marketPosts, fillerToday, postMin, trendingAt, viralLikes } from '../../engine';
import { art } from '../citypulseArt';
import { devOptionsButton, devOptionsPanel } from '../devOptions';
import { yBio } from '../y-bios';
import { PLAYER, avatar, compact, esc, fmtClock, handleFrom, hashHue, linkify, tpl } from './common';

/** The stock posts the crawler reads: only ones on the Y timeline right now, so the player can check every number. */
export function crawlable(store: GameStore) {
  const onY = new Set(yPosts(store).map((p) => p.id));
  return marketPosts(store.state, store.content).filter((p) => onY.has(p.id));
}

// ── Y ──
interface YPost { id: string; author: string; handle: string; text: string; day: number; /** A picture under the text (citypulseArt kind). */ img?: string; /** Minutes since midnight it went up, when known. */ min?: number; likes: number; mine?: boolean; delta?: number; score?: number; replyTo?: string; /** Order within a day: story posts first, bot spam last. */ rank?: number }

export function yPosts(store: GameStore): YPost[] {
  const s = store.state;
  const out: YPost[] = [];
  const market = marketPosts(s, store.content);
  for (const d of s.delivered.filter((x) => x.site === 'y')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    out.push({ id: e.id, author: e.from ?? 'someone', handle: handleFrom(e.from ?? 'someone'), text: tpl(e.body ?? ''), day: d.day, min: d.min,
      // a stock post shows the likes the crawler sees
      likes: market.find((p) => p.id === e.id)?.likes ?? 20 + hashHue(e.id) % 400 });
  }
  // the stock chatter the vibe check reads (story events with stock labels are already above)
  for (const p of market) if (!out.some((x) => x.id === p.id)) out.push({ id: p.id, author: p.author, handle: p.handle, text: p.text, day: p.day, min: p.min, likes: p.likes, rank: p.bot ? 2 : 1 });
  // today's filler, each post at its own time
  for (const f of fillerToday(s, store.content)) out.push({ id: f.id, author: f.from, handle: f.handle, text: f.body, day: s.values.day, min: postMin(f, s.values.day), likes: 3 + hashHue(f.id) % 60, rank: 1 });
  for (const x of s.yExtra) out.push({ id: x.id, author: x.author, handle: x.handle, text: x.text, day: x.day, min: x.min, likes: x.likes, replyTo: x.replyTo });
  for (const u of s.userPosts) out.push({ id: u.id, author: PLAYER.name, handle: PLAYER.handle, text: u.text, day: u.day, min: u.min, likes: viralLikes(s, u), mine: true, delta: u.delta, score: u.score, img: u.img });
  // newest first: by day, then the time it went up
  return out.sort((a, b) => b.day - a.day || (b.min ?? 0) - (a.min ?? 0) || (a.rank ?? 0) - (b.rank ?? 0) || b.id.localeCompare(a.id));
}

/** Accounts with Y's verified check. */
const Y_VERIFIED = new Set(['doordish', 'forkyard', 'mara_vey', 'randall_crane', 'axel_rook', 'cal_hartman', 'caleb_moxon', 'max_stryker', 'the_current', 'candidate_2030', 'wallstreetbags', 'perdure_pharma', 'pollymarket', 'citypulse']);

/** Follower counts for the public figures; everyone else gets a small made-up number. */
const Y_FOLLOWERS: Record<string, number> = { doordish: 3_100_000, forkyard: 880_000, randall_crane: 38_400_000, mara_vey: 61_200, axel_rook: 214_000_000, cal_hartman: 4_300_000, caleb_moxon: 41_300, max_stryker: 2_900_000, the_current: 184_000, candidate_2030: 1_900_000, wallstreetbags: 15_800_000, perdure_pharma: 412_000, pollymarket: 3_400_000, citypulse: 1_240_000 };

/** Rook puts check marks "under review" on day 8; from day 9 Crane's is bigger and golden. */
const craneGold = (s: GameState) => s.values.day >= 9;

const yCheck = (s: GameState, handle: string) => !Y_VERIFIED.has(handle) ? ''
  : handle === 'randall_crane' && craneGold(s) ? `<span class="y-badge gold" title="Verified">${Y_ICONS.goldBadge}</span>`
  : `<span class="y-badge" title="Verified">${Y_ICONS.badge}</span>`;

function yPostHtml(store: GameStore, p: YPost): string {
  const liked = !!store.ui.liked[p.id];
  const reposted = !!store.ui.reposted[p.id];
  const likes = p.likes + (liked ? 1 : 0);
  const reposts = Math.round(p.likes * 0.14) + (reposted ? 1 : 0);
  const text = linkify(esc(p.text).replace(/(^|[^&\w])(#[a-z][a-z0-9_]*)/gi, '$1<span class="y-at">$2</span>'));
  const prof = `y.com/${esc(p.handle)}`;
  // a bot post in a barrage fades in at its own moment, wherever the repaint catches it
  const lands = store.ui.yBurst[p.id];
  const wait = lands == null ? null : lands - performance.now();
  const arrive = wait != null && wait > -400 ? ` y-arrive" style="animation-delay:${Math.round(wait)}ms` : '';
  return `<article class="y-post${p.mine ? ' mine' : ''}${arrive}">
    <header>
      <a href="#" class="y-av-link" data-nav="${prof}">${avatar(p.author, p.handle)}</a>
      <a href="#" class="y-who" data-nav="${prof}"><span class="y-name"><b>${esc(p.author)}</b>${yCheck(store.state, p.handle)}</span><span class="y-handle">@${esc(p.handle)}</span></a>
      <span class="y-time">${p.day === store.state.values.day && p.min != null ? fmtClock(p.min) : dateShort(p.day)}</span>
    </header>
    ${p.replyTo && store.state.userPosts.some((u) => u.id === p.replyTo) ? `<div class="y-replying">Replying to <span class="y-at">@${PLAYER.handle}</span></div>` : ''}
    <p>${text}</p>
    ${p.img ? `<figure class="y-img">${art(p.img, 'y-img-art')}</figure>` : ''}
    <footer class="y-acts">
      <span class="y-act">${Y_ICONS.reply}${compact(Math.round(p.likes * 0.07))}</span>
      <button class="y-act repost${reposted ? ' on' : ''}" data-repost="${esc(p.id)}" aria-label="Repost">${Y_ICONS.repost}${compact(reposts)}</button>
      <button class="y-act like${liked ? ' on' : ''}" data-like="${esc(p.id)}" aria-label="Like">${Y_ICONS.heart}${compact(likes)}</button>
      ${p.mine && p.delta != null ? `<span class="y-delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '±'}${Math.abs(p.delta)} followers${p.score != null ? `${p.img ? '' : `<span class="y-score">rated ${p.score.toFixed(1)}/4</span>`}` : ''}</span>` : ''}
      <span class="y-act views">${Y_ICONS.views}${compact(Math.max(12, p.likes * 37 + 9))}</span>
    </footer></article>`;
}

// an empty feed, profile or search result: icon, title and one line, like Qmail's empty folders
function yEmpty(icon: string, title: string, note: string, tag = 'p'): string {
  return `<div class="y-empty"><span class="y-empty-ico">${icon}</span><${tag} class="y-empty-title">${title}</${tag}><p class="y-empty-note">${note}</p></div>`;
}

export function pageY(store: GameStore, profile?: string): string {
  const s = store.state;
  const posts = yPosts(store);
  const trending = trendingAt(store.content, s.values.day, s.clockMin);
  // the timeline shows today's posts; older ones wait behind "Show all"
  const showAll = store.ui.yAllDay === s.values.day;
  const shown = showAll ? posts : posts.filter((p) => p.day === s.values.day);
  const older = !showAll && posts.some((p) => p.day !== s.values.day);
  // with everything showing, "Hide old posts" sits where today's posts end and older ones begin
  const firstOld = showAll ? shown.findIndex((p) => p.day !== s.values.day) : -1;
  const feed = (shown.map((p, i) => (i === firstOld ? '<div class="y-more"><button class="y-btn ghost" data-y-all="hide">Hide old posts</button></div>' : '') + yPostHtml(store, p)).join('') || yEmpty(Y_ICONS.reply, older ? 'Nothing posted yet today.' : 'Quiet timeline.', 'New posts show up here as they come in.'))
    + (older ? '<div class="y-more"><button class="y-btn ghost" data-y-all>Show all</button></div>' : '');
  const side = `<aside class="y-side">
    <section class="y-card y-me">
      <a href="#" class="y-me-head" data-nav="y.com/you">${avatar('You', 'you')}<span><b>You</b><small>@you</small></span></a>
      <div class="y-me-stats"><span><b>${compact(s.values.followers)}</b> followers</span><span><b>${s.userPosts.length}</b> posts</span></div>
    </section>
    <section class="y-card"><h2>Trending</h2>${(trending.length ? trending : ['#AI', '#jobs', '#election']).map((t, i) => `<div class="y-trend"><span class="y-rank">0${i + 1}</span><span><b>${esc(t)}</b><small>trending today</small></span></div>`).join('')}</section>
    ${adHtml('y', s.values.day, 'square')}
  </aside>`;
  const mainInner = profile ? yProfile(store, profile) : `
    <form class="y-compose" data-form="ypost">${avatar('You', 'you')}
      <div><textarea id="post-input" rows="2" maxlength="280" placeholder="Say something to the timeline"></textarea>
      <div class="y-compose-row"><span class="y-hint">280 chars · free</span><button class="y-btn" type="submit">Post</button></div></div></form>
    <p class="y-eyebrow"><i class="y-live"></i>Timeline · live</p>
    ${adHtml('y', s.values.day, 'wide')}
    <div class="y-feed">${feed}</div>`;
  return `<div class="y">
    <header class="y-bar">
      <div class="y-brand"><span class="y-mark">${ICONS.y}</span></div>
      <nav class="y-pills"><a href="#" data-nav="y.com" class="${profile ? '' : 'on'}">Home</a><a href="#" data-nav="y.com/you" class="${profile === 'you' ? 'on' : ''}">Profile</a></nav>
      <span class="y-count"><b>${compact(s.values.followers)}</b> followers</span>
      <form class="y-search" data-form="y-search">${Y_ICONS.explore}<input id="y-search" autocomplete="off" spellcheck="false" placeholder="Find @username" value="${esc(store.ui.ySearch)}"></form>
      ${devOptionsButton(store, 'y')}
    </header>
    <div class="y-cols"><main class="y-main">${mainInner}</main>${side}</div>${devOptionsPanel(store, 'y')}</div>`;
}

function yProfile(store: GameStore, handle: string): string {
  const s = store.state;
  const h = handle.toLowerCase();
  const mine = h === 'you';
  const posts = yPosts(store).filter((p) => p.handle === h);
  const back = '<p class="y-back"><a href="#" data-nav="y.com">← Timeline</a></p>';
  if (!mine && !posts.length) return `${back}${yEmpty(Y_ICONS.explore, "This account doesn't exist", `Nobody on Y goes by @${esc(handle)}.`, 'h2')}`;
  const name = mine ? 'You' : (posts[0]?.author ?? handle);
  const followers = mine ? s.values.followers : Y_FOLLOWERS[h] ?? 20 + hashHue(h) % 400;
  const feed = posts.length ? posts.map((p) => yPostHtml(store, p)).join('')
    : mine ? yEmpty(Y_ICONS.reply, 'No posts yet.', 'Posts you write on the timeline show up here.')
    : yEmpty(Y_ICONS.reply, 'No posts yet.', `@${esc(h)} hasn't posted anything you can see.`);
  return `${back}<section class="y-prof">
    <div class="y-banner" style="--h:${hashHue(h)}"></div>
    <div class="y-prof-head"><div class="y-prof-av">${avatar(name, h)}</div></div>
    <h1 class="y-prof-name">${esc(name)}${yCheck(s, h)}</h1><p class="y-handle">@${esc(h)}</p>
    <p class="y-bio">${esc(yBio(h))}</p>
    <p class="y-prof-stats"><span><b>${compact(40 + hashHue(h + 'f') % 300)}</b> following</span><span><b>${compact(followers)}</b> followers</span></p>
  </section><p class="y-eyebrow">Posts</p><div class="y-feed">${feed}</div>`;
}
