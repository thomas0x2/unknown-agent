/*
 * The player's screens as data for an agent.chat query (game/playerView.ts): newest first, capped,
 * from the same rows Qmail, Y, Yowl, CityPulse, Pollymarket, Forkyard and Coinbin draw. Never what an app's bugs
 * are: Forkyard rows only say whether an app is live.
 */
import type { GameStore } from '../game/store';
import type { PlayerView } from '../game/playerView';
import { RENT, liveArticles, articleMin, liveMarkets, oddsNow, resolved, onForkyard, clockTime, getEvent } from '../engine';
import { mailRows, yPosts, reviewsFor } from './view';
import { BUSINESSES } from './yowl-data';

const MAX_MAIL = 60;
const MAX_Y = 150;
const MAX_TX = 20;
const time = (min?: number) => (min == null ? undefined : clockTime(min));

export function queryView(store: GameStore): PlayerView {
  const s = store.state;
  const day = s.values.day;
  const rentDay = Object.keys(RENT).map(Number).filter((d) => d >= day).sort((a, b) => a - b)[0];
  const byNewest = <T extends { day: number; min?: number }>(a: T, b: T) => b.day - a.day || (b.min ?? 0) - (a.min ?? 0);
  return {
    day,
    time: clockTime(s.clockMin),
    wallet: { dolr: Math.round(s.values.crypto * 100) / 100, followers: s.values.followers, model: s.values.agentLevel, ...(rentDay ? { rent: { day: rentDay, amount: RENT[rentDay] } } : {}) },
    tx: s.tx.filter((t) => t.day >= 1).slice(-MAX_TX).reverse().map((t) => ({ day: t.day, time: time(t.min), amount: t.amount, memo: t.memo })),
    mail: mailRows(store).sort(byNewest).slice(0, MAX_MAIL).map((m) => ({
      folder: m.folder, day: m.day, time: time(m.min), from: m.from, addr: m.addr, to: m.to, subject: m.subject, body: m.body, ...(m.unread ? { unread: true } : {}),
    })),
    y: yPosts(store).slice(0, MAX_Y).map((p) => ({ day: p.day, time: time(p.min), author: p.author, handle: p.handle, text: p.text, ...(p.mine ? { mine: true } : {}) })),
    yowl: BUSINESSES.flatMap((b) => reviewsFor(store, b).map((r) => ({ business: b.name, author: r.author, stars: r.stars, text: r.text, day: r.day, ...(r.mine ? { mine: true } : {}) })))
      .sort((a, b) => b.day - a.day),
    citypulse: liveArticles(s).map((a) => ({ day: a.day, time: clockTime(articleMin(a)), title: a.title, dek: a.dek })),
    pollymarket: liveMarkets(s).map((m) => ({ title: m.title, category: m.category, chance: oddsNow(s, m), ...(resolved(s, m) ? { resolved: resolved(s, m) } : {}) })),
    apps: s.apps.filter((a) => onForkyard(a) && !a.churned).map((a) => ({
      name: a.name, url: a.url, deployed: a.deployed,
      ...(a.clientEventId ? { client: getEvent(store.content, a.clientEventId)?.from } : {}),
      ...(a.kind === 'user' ? { users: a.users ?? 0 } : {}),
    })),
  };
}
