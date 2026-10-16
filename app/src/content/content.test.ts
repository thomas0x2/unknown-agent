/*
 * Validates the authored content against the engine's expectations: ids are unique, every app a
 * createApp/updateApp touches exists with the feature ids it names, scheduled events exist, latent
 * qmail leads are reachable, and outcomes are well-formed. Catches story typos at test time.
 */
import { loadContent } from './load';
import type { Effects } from './schema';

const content = loadContent();

function* allEffects(): Generator<{ src: string; fx: Effects }> {
  for (const e of content.events) {
    if (e.onDeliver) yield { src: `${e.id}.onDeliver`, fx: e.onDeliver };
    for (const o of e.outcomes ?? []) if (o.effects) yield { src: `${e.id}.${o.id}`, fx: o.effects };
  }
}

describe('authored content', () => {
  it('has events and app templates', () => {
    expect(content.events.length).toBeGreaterThan(20);
    expect(Object.keys(content.apps).length).toBeGreaterThanOrEqual(5);
  });

  it('event ids are unique', () => {
    const ids = content.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every event has an id, a site, and a trigger', () => {
    for (const e of content.events) {
      expect(e.id, JSON.stringify(e)).toBeTruthy();
      expect(['qmail', 'y', 'yowl', 'nullboard', 'cellar', 'agent']).toContain(e.site);
      expect(e.trigger, e.id).toBeTruthy();
    }
  });

  it('outcomes are well-formed', () => {
    for (const e of content.events) {
      for (const o of e.outcomes ?? []) {
        expect(o.id, `${e.id} outcome`).toBeTruthy();
        expect(o.when, `${e.id}.${o.id} when`).toBeTruthy();
        expect(typeof o.reply, `${e.id}.${o.id} reply`).toBe('string');
      }
    }
  });

  it('createApp / updateApp reference real templates and features', () => {
    for (const { src, fx } of allEffects()) {
      if (fx.createApp) {
        const t = content.apps[fx.createApp.template];
        expect(t, `${src}: template ${fx.createApp.template}`).toBeTruthy();
        for (const f of fx.createApp.spec) {
          expect(t.features.some((tf) => tf.id === f.id), `${src}: feature ${f.id}`).toBe(true);
        }
      }
      if (fx.updateApp) {
        // the client id must be a createApp'd app somewhere, and features must exist on its template
        const creator = content.events
          .flatMap((e) => [e.onDeliver, ...(e.outcomes ?? []).map((o) => o.effects)])
          .find((x) => x?.createApp?.clientEventId === fx.updateApp!.client);
        expect(creator, `${src}: no app created with clientEventId ${fx.updateApp.client}`).toBeTruthy();
        const t = content.apps[creator!.createApp!.template];
        for (const f of fx.updateApp.add) {
          expect(t.features.some((tf) => tf.id === f.id), `${src}: update feature ${f.id}`).toBe(true);
        }
      }
    }
  });

  it('scheduled events exist', () => {
    const ids = new Set(content.events.map((e) => e.id));
    for (const { src, fx } of allEffects()) {
      const list = fx.schedule ? (Array.isArray(fx.schedule) ? fx.schedule : [fx.schedule]) : [];
      for (const s of list) expect(ids.has(s.eventId), `${src}: schedules missing ${s.eventId}`).toBe(true);
    }
  });

  it('latent qmail leads have an address to email', () => {
    for (const e of content.events) {
      if (e.latent && e.site === 'qmail') expect(e.addr, `${e.id} latent needs addr`).toBeTruthy();
    }
  });

  it('jobs that pay out carry a category and payout', () => {
    for (const e of content.events) {
      if (e.job) {
        expect(['legit', 'grey', 'catastrophic']).toContain(e.job.category);
        expect(e.job.payout).toBeGreaterThan(0);
      }
    }
  });

  it('has trending for days 1-6', () => {
    for (let d = 1; d <= 6; d++) expect(content.trending[d]?.length, `trending day ${d}`).toBeGreaterThan(0);
  });
});
