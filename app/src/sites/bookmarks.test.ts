/*
 * The bookmarks bar grows in the order the player finds sites, each new one at the end; job-irrelevant
 * sites (group 'web') never get one.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from '../engine/day';
import { bookmarks, noteBookmarks, visitedFlag } from './registry';

const content = loadContent();
const ids = (s: ReturnType<typeof startGame>) => bookmarks(s).map((b) => b.id);

describe('bookmarks', () => {
  it('a new game starts with the core sites, and later finds go at the end in the order found', () => {
    const s = startGame(content, 1);
    noteBookmarks(s);
    const start = ids(s);
    expect(start).toEqual(expect.arrayContaining(['agent', 'qmail', 'y', 'coinbin', 'forkyard']));
    s.flags.push(visitedFlag('matchless'));
    noteBookmarks(s);
    s.flags.push(visitedFlag('sherwood'));
    noteBookmarks(s);
    expect(ids(s)).toEqual([...start, 'matchless', 'sherwood']);
  });

  it("an old save without an order gets the registry's order on its first look", () => {
    const s = startGame(content, 1);
    delete s.bookmarkOrder;
    s.flags.push(visitedFlag('sherwood'), visitedFlag('matchless'));
    const before = ids(s);
    expect(noteBookmarks(s)).toBe(true);
    expect(ids(s)).toEqual(before);
    expect(noteBookmarks(s)).toBe(false);
  });

  it('sites that are not for jobs are never bookmarked', () => {
    const s = startGame(content, 1);
    s.flags.push(...['citypulse', 'pollymarket', 'thirstr', 'yowl'].map((id) => visitedFlag(id as never)));
    noteBookmarks(s);
    for (const id of ['citypulse', 'pollymarket', 'thirstr', 'yowl']) expect(ids(s)).not.toContain(id);
  });
});
