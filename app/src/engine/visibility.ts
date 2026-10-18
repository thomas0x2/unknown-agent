/*
 * When a bug can be seen. A bug only lands, from a build or an overnight break, once something in
 * the game would show it: the auto-buy can't buy the wrong ticker before Crane has praised one, the
 * laundromat can't show done machines as free while nothing is done. Every bug of every app template
 * has a rule here (a test checks); a bug that can't show yet is held on the build and lands when it can.
 */
import type { GameState, AppInstance } from './state';
import type { Content } from '../content/schema';
import { marketPosts, crawl, ledger, portfolio, trackedOf, type MarketPost } from './crawler';
import { machineFeed, machineRows } from './laundromat';
import { swapListings, type Listing } from './swaplist';
import { playMinutes } from './core';
import { countdownView } from './cope';

/** What a rule looks at: the game now, the app, and the content (for the posts on Y). */
export interface View {
  s: GameState;
  app: AppInstance;
  content?: Content;
}
export type Rule = (v: View) => boolean;

const always: Rule = () => true;

// ── Vibe Check: a bug shows when the dashboard computed with it differs from the correct one ──

const posts = new WeakMap<View, MarketPost[]>();
const postsOf = (v: View) => {
  if (!posts.has(v)) posts.set(v, v.content ? marketPosts(v.s, v.content) : []);
  return posts.get(v)!;
};
function dashboard(v: View, bugs: Set<string>): string {
  const day = v.s.values.day;
  const all = postsOf(v);
  const book = ledger(all, day, bugs);
  return JSON.stringify([crawl(all, day, bugs, trackedOf(v.app.specParams.tickers?.tickers)), book.filter((b) => !b.manual).map((b) => [b.day, b.ticker]), portfolio(book, day, bugs)]);
}
/** Without the content there are no posts to compare: the bug counts as showing, as it always did. */
const changesDashboard = (bug: string): Rule => (v) => !v.content || dashboard(v, new Set([bug])) !== dashboard(v, new Set());

// ── Spin Cycle: the machine grid as it is right now, with and without the bug ──

function grid(v: View, bugs: Set<string>): string {
  const opts = { showMinutes: v.app.required.includes('minutes'), twelve: v.app.required.includes('more_machines') };
  return JSON.stringify(machineRows(v.s.values.day, bugs, opts, v.s.clockMin));
}
const changesGrid = (bug: string): Rule => (v) => grid(v, new Set([bug])) !== grid(v, new Set());

// ── Swaplist: what is listed so far ──

const listings = (v: View): Listing[] => swapListings(v.app.contentAt, playMinutes(v.s), v.s.flags.includes('viktor_sold_watch'));
const listed = (test: (l: Listing[]) => boolean): Rule => (v) => test(listings(v));
const distinct = (l: Listing[], key: (x: Listing) => string) => new Set(l.map(key)).size;

// ── Dex's coin site: the countdown as it reads right now, with and without the bug ──

const countdown = (v: View, bugs: Set<string>) => JSON.stringify(countdownView(bugs, v.s.values.day, v.s.clockMin,
  v.app.lastDeployDay ? { day: v.app.lastDeployDay, min: v.app.lastDeployMin ?? 600 } : undefined));
const changesCountdown = (bug: string): Rule => (v) => countdown(v, new Set([bug])) !== countdown(v, new Set());

/** Per template, per bug id. Startup bugs show on a static page or a sign-up anyone can make. */
export const VISIBILITY: Record<string, Record<string, Rule>> = {
  startup: Object.fromEntries([
    'name_wrong', 'pitch_wrong', 'logos_wrong', 'logos_broken', 'founder_wrong', 'fake_cofounders', 'credentials_wrong',
    'dead_button', 'counter_zero', 'counter_stuck', 'no_email', 'position_wrong', 'sent_to_founder',
  ].map((b) => [b, always])),
  sentiment: Object.fromEntries([
    'wrong_tickers', 'lowercase_missed', 'inverted', 'sarcasm_literal', 'bots_counted',
    'stale_prices', 'wrong_totals', 'value_wrong', 'pnl_sign', 'pct_wrong',
    'no_buy', 'wrong_ticker', 'buys_on_criticism', 'repeat_buys', 'impostor_buy',
  ].map((b) => [b, changesDashboard(b)])),
  laundromat: {
    six_of_eight: changesGrid('six_of_eight'), done_as_free: changesGrid('done_as_free'),
    broken_as_free: changesGrid('broken_as_free'), raw_codes: changesGrid('raw_codes'),
    // the "Updated" time stops at the deploy, and the machines stop changing
    no_refresh: always,
    minutes_wrong: changesGrid('minutes_wrong'),
    still_eight: changesGrid('still_eight'), new_always_free: changesGrid('new_always_free'),
    layout_breaks: (v) => machineFeed(v.s.values.day).length > 8,
  },
  coinsite: {
    // the target date shows next to the timer; a frozen one shows once the clock has moved past the deploy;
    // counting into negative time only once the launch has passed
    wrong_target: changesCountdown('wrong_target'), frozen: changesCountdown('frozen'), negative: changesCountdown('negative'),
    address_wrong: always, address_cut: always,
    supply_wrong: always, shares_wrong: always, sum_over: always, lock_wrong: always,
  },
  swaplist: {
    titles_shifted: listed((l) => l.length >= 2),
    no_photos: listed((l) => l.length > 0),
    price_x100: listed((l) => l.some((x) => x.price > 0)),
    all_free: listed((l) => l.some((x) => x.cat !== 'free stuff')),
    search_exact: listed((l) => l.length > 0),
    filter_ignored: listed((l) => distinct(l, (x) => x.cat) >= 2),
    contact_dead: listed((l) => l.length > 0),
    wrong_seller: listed((l) => distinct(l, (x) => x.seller) >= 2),
    no_sold_badge: listed((l) => l.some((x) => x.soldAt != null)),
    offers_open: listed((l) => l.some((x) => x.soldAt != null)),
  },
};

/**
 * Can the player see this bug on the app right now? Invented details and an outdated feature always
 * show; a bug without a rule counts as showing (the content test makes sure there is none).
 */
export function bugShows(v: View, bug: string): boolean {
  const rule = VISIBILITY[v.app.template]?.[bug];
  return rule ? rule(v) : true;
}
