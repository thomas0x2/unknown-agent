/* Every account the story posts from has its own Y bio; strangers and bots draw one from a pool. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { handleOf, type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { Y_BIOS, yBio } from './y-bios';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const content = loadContent();

describe('Y bios', () => {
  it('story accounts all have a written bio', () => {
    const handles = new Set<string>();
    for (const e of content.events) if (e.site === 'y' && e.from && e.from !== 'a follower') handles.add(handleOf(e.from));
    for (const p of content.yMarket?.posts ?? []) if (!p.bots) handles.add(p.handle);
    for (const f of content.yFiller) handles.add(f.handle);
    for (const a of Object.values(content.apps)) for (const m of JSON.stringify(a).matchAll(/"handle":"([^"]+)"/g)) handles.add(m[1]);
    expect([...handles].filter((h) => !Y_BIOS[h])).toEqual([]);
  });

  it('strangers keep the same bio, and bots get a bot one', () => {
    expect(yBio('someone_new')).toBe(yBio('Someone_New'));
    expect(yBio('moonshot4821')).not.toBe(yBio('someone_new'));
    expect(yBio('moonshot4821')).toMatch(/🚀|moon|Diamond/);
  });

  it('a profile shows its bio', () => {
    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    store.state.values.day = 3;
    store.state.clockMin = 22 * 60;
    store.state.yExtra.push({ id: 'x1', author: 'Randall Crane', handle: 'randall_crane', text: 'BELIEVE IT.', day: 3, min: 600, likes: 1 } as never);
    expect(page(store, route('y.com/randall_crane', store.state))).toContain('Fighting for every American job');
    expect(page(store, route('y.com/you', store.state))).toContain('Open to work.');
    expect(page(store, route('y.com/nobody_here', store.state))).toContain("This account doesn't exist");
  });
});
