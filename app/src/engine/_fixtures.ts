/*
 * Shared test fixtures: a small content bundle and a scriptable Jev router. Not shipped (only
 * imported by *.test.ts).
 */
import type { Content, AppTemplate, GameEvent } from '../content/schema';
import type { JevRouter, RouteDecision, PostRating } from './jev';

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
