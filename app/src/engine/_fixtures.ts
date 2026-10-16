/*
 * Shared test fixtures: a small content bundle and a scriptable Jev router. Not shipped (only
 * imported by *.test.ts).
 */
import type { Content, AppTemplate, GameEvent } from '../content/schema';
import type { JevRouter, RouteDecision, PostRating } from './jev';

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'it', 'i', 'you', 'my', 'me', 'for', 'on', 'in', 'that', 'this', 'with', 'be', 'do', 'please', 'can', 'could', 'would']);
function words(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/**
 * A stand-in for Jev in tests: deterministic word overlap with each candidate's description. The game
 * never uses it; it only lets tests drive the engine without the model.
 */
export const wordJev: JevRouter = {
  async route(input) {
    // word overlap can't tell feature work from a fix, so it leaves that question unanswered
    if (input.candidates.some((c) => c.id === 'fix')) return { kind: 'nothing' };
    const t = words(input.text);
    let best = { score: 0, id: '' };
    for (const c of input.candidates) {
      const score = overlap(t, words(c.when));
      if (score > best.score) best = { score, id: c.id };
    }
    if (best.score >= 2) return { kind: 'outcome', outcomeId: best.id };
    if (input.strict) return { kind: 'nothing' };
    if (best.score === 1) {
      return input.hints.length ? { kind: 'hint', hintIndex: 0 } : { kind: 'outcome', outcomeId: best.id };
    }
    return { kind: 'nothing' };
  },
  async ratePost(input) {
    const t = words(input.text);
    // trending entries are phrases ("AI layoffs"); a post hits a trend if it shares any word with one
    const trend = new Set(input.trending.flatMap((x) => [...words(x)]));
    const hitsTrend = [...t].some((w) => trend.has(w));
    const dup = input.recentPosts.some((p) => words(p).size && overlap(words(p), t) >= Math.max(2, t.size - 1));
    const quality = Math.max(0, Math.min(1, t.size / 12));
    if (dup) return { category: 'spam', quality: 0.1 };
    if (hitsTrend) return { category: 'reaction', quality: Math.max(0.4, quality) };
    return { category: 'tip', quality };
  },
  async matchFeatures(input) {
    const t = words(input.prompt);
    // the "(for <app name>)" suffix only disambiguates for the real model; naming the app isn't asking for a feature
    return input.features.filter((f) => overlap(t, words(f.description.replace(/\s*\(for [^)]*\)$/, ''))) >= 1).map((f) => f.id);
  },
};


export const shopTemplate: AppTemplate = {
  id: 'shop',
  name: 'Shop',
  pages: [
    { id: 'home', title: 'Home' },
    { id: 'checkout', title: 'Checkout' },
  ],
  features: [
    { id: 'price_chf', description: 'prices shown in CHF', pageId: 'home', failures: ['subtle', 'failed_fetch'] },
    { id: 'catalog', description: 'product catalog lists items', pageId: 'home', failures: ['failed_fetch', 'visible'] },
    { id: 'checkout_flow', description: 'checkout form sends a confirmation', pageId: 'checkout', failures: ['deep', 'visible'], deep: true },
  ],
};

export function makeContent(extra: Partial<Content> = {}): Content {
  const events: GameEvent[] = [
    {
      id: 'client_shop',
      site: 'qmail',
      from: 'Rosa',
      subject: 'Need a shop',
      body: 'Build me a shop.',
      trigger: { dayMin: 1 },
      onDeliver: {
        createApp: {
          template: 'shop',
          kind: 'client',
          name: 'Rosa Shop',
          clientEventId: 'client_shop',
          payPerDay: 50,
          spec: [
            { id: 'price_chf', params: { currency: 'CHF' } },
            { id: 'catalog' },
            { id: 'checkout_flow' },
          ],
        },
      },
    },
    {
      id: 'fam_hi',
      site: 'qmail',
      from: 'Mom',
      subject: 'Are you eating?',
      trigger: { dayMin: 1 },
      outcomes: [
        { id: 'warm', when: 'the player replies warmly to mom', effects: { add: { familyTrust: 5 } }, reply: 'Love you.' },
      ],
      hints: ['She just wants to hear from you.'],
    },
    {
      id: 'grey_job',
      site: 'nullboard',
      from: 'null',
      subject: 'a job',
      trigger: { dayMin: 2 },
      job: { category: 'grey', payout: 100, dueDay: 5 },
      outcomes: [
        { id: 'accept', when: 'the player accepts the hacking job', effects: { job: 'accept', setFlags: ['grey_accepted'] }, reply: 'ok' },
        { id: 'deliver', when: 'the player delivers the breach data', effects: { job: 'complete', add: { suspicion: 12, nullStanding: 10 } }, reply: 'done' },
      ],
    },
    {
      id: 'cat_job',
      site: 'cellar',
      from: 'Cellar',
      subject: 'dox',
      trigger: { dayMin: 11 },
      job: { category: 'catastrophic', payout: 500, dueDay: 12 },
      outcomes: [
        { id: 'deliver', when: 'the player delivers the dossier', effects: { job: 'complete', add: { suspicion: 8, mafiaStanding: 10 } }, reply: 'good' },
      ],
    },
    {
      id: 'follow_up',
      site: 'qmail',
      from: 'Bank',
      subject: 'later',
      trigger: { dayMin: 99 }, // only via schedule
    },
  ];
  return {
    events: [...events, ...(extra.events ?? [])],
    apps: { shop: shopTemplate, ...(extra.apps ?? {}) },
    yFiller: extra.yFiller ?? [],
    qmailSpam: extra.qmailSpam ?? [],
    trending: extra.trending ?? {},
    contacts: extra.contacts ?? [],
    characters: extra.characters,
    agent: extra.agent,
  };
}

/** A router you fully control: route by a map of channel->decision, features/rating by functions. */
export function fakeRouter(opts: {
  route?: (text: string) => RouteDecision;
  features?: (prompt: string, ids: string[]) => string[];
  rating?: (text: string) => PostRating;
}): JevRouter {
  return {
    async route(input) {
      return opts.route ? opts.route(input.text) : { kind: 'nothing' };
    },
    async matchFeatures(input) {
      const ids = input.features.map((f) => f.id);
      return opts.features ? opts.features(input.prompt, ids) : ids;
    },
    async ratePost(input) {
      return opts.rating ? opts.rating(input.text) : { category: 'tip', quality: 0.5 };
    },
  };
}

/**
 * A Jev that makes the decisions a test names: route picks the first candidate whose id is in
 * `route` (else nothing), matchFeatures returns the ids ending in one of `features`.
 */
export function pickJev(pick: { route?: string[]; features?: string[] }): JevRouter {
  return {
    async route(input) {
      const c = input.candidates.find((x) => pick.route?.includes(x.id));
      return c ? { kind: 'outcome', outcomeId: c.id } : { kind: 'nothing' };
    },
    async matchFeatures(input) {
      return input.features.map((f) => f.id).filter((id) => pick.features?.some((s) => id.endsWith(s)));
    },
    ratePost: wordJev.ratePost,
  };
}
