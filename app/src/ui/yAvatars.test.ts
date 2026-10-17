/* The story's main accounts get a drawn Y profile picture; everyone else keeps an initials tile. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { Y_AVATARS } from './y-avatars';
import { Y_BIOS } from './y-bios';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;

describe('Y avatars', () => {
  it('only story accounts get a picture', () => {
    // candidate_2028's account and bio arrive with the opponent storyline (#197)
    expect(Object.keys(Y_AVATARS).filter((h) => !Y_BIOS[h] && h !== 'candidate_2028')).toEqual([]);
  });

  it('posts and profiles show the picture; strangers keep initials', () => {
    const store = new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
    store.state.values.day = 3;
    store.state.clockMin = 22 * 60;
    store.state.yExtra.push({ id: 'x1', author: 'Randall Crane', handle: 'randall_crane', text: 'BELIEVE IT.', day: 3, min: 600, likes: 1 } as never);
    store.state.yExtra.push({ id: 'x2', author: 'Some One', handle: 'some_one', text: 'hi', day: 3, min: 610, likes: 1 } as never);
    const crane = page(store, route('y.com/randall_crane', store.state));
    expect(crane.match(/class="av av-pic"/g)?.length).toBeGreaterThanOrEqual(2); // profile head + post
    const stranger = page(store, route('y.com/some_one', store.state));
    expect(stranger).not.toContain('av-pic');
    expect(stranger).toContain('>SO</div>');
  });
});
