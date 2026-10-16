/*
 * Fix requests in the player's own words. Jev is stubbed to match nothing, so these pass on the
 * template's wording rules alone: a prompt that names the bug fixes it, one that only points at the
 * page is still taken as a fix attempt and changes something else.
 */
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { composeEmail, promptAgent } from '../engine/actions';
import { getApp } from '../engine/apps';
import { offlineJev, type JevRouter } from '../engine/jev';
import type { GameState } from '../engine';

const content = loadContent();
const deafJev: JevRouter = { ...offlineJev, matchFeatures: async () => [], route: async () => ({ kind: 'nothing' }) };

async function withBug(fid: string, bug: string): Promise<GameState> {
  const s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
  const app = getApp(s, 'trattoria-gino')!;
  app.repo = app.required.map((id) => (id === fid ? { id, correct: false, variant: bug, params: app.specParams[id], seed: 2 } : { id, correct: true, params: app.specParams[id] }));
  app.repoVersion = 1;
  s.values.agentLevel = 5; // the fix roll succeeds
  return s;
}

const NAMED: [string, string, string[]][] = [
  ['landing', 'name_wrong', [
    "The website needs to show it's for trattoria gino",
    'The restaurant name is misspelled',
    'It says Trattoria Gina, it should be Trattoria Gino',
    'Fix the typo in the name on the homepage',
    'wrong name on the site',
  ]],
  ['landing', 'hours_wrong', [
    'The opening hours are wrong',
    "We're open 17:00-22:00, not what the site says",
    'fix the hours on the landing page',
    'the homepage shows the wrong times, should be 17 to 22',
  ]],
  ['menu', 'prices_missing', [
    'There are no prices on the menu',
    'The prices are missing',
    'Add the prices to the dishes',
    "the menu doesn't show prices",
    'prices aren\'t showing next to the dishes',
  ]],
  ['menu', 'prices_curo', [
    'Prices should be in DOLR, not CURO',
    'The menu uses the wrong currency',
    'why are the prices in curo??',
    'change the currency to DOLR',
  ]],
  ['menu', 'wrong_items', [
    'Lasagne is missing from the menu',
    'There is a dish on the menu that Gino never asked for',
    'The menu has the wrong dishes',
    'Diavola is spelled wrong',
    'some items are missing',
  ]],
];

describe('fix requests in the player\'s words', () => {
  for (const [fid, bug, asks] of NAMED) {
    for (const ask of asks) {
      it(`${bug}: "${ask}"`, async () => {
        const s = (await promptAgent(await withBug(fid, bug), content, deafJev, ask)).state;
        expect(s.chat.at(-1)!.src).toBe('build');
        expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === fid)!.correct).toBe(true);
      });
    }
  }

  it.each([
    'The menu is wrong, please fix it',
    'The menu for the trattoria gino website is wrong. Please fix it',
    'fix the menu page',
    'something is off with the menu',
  ])('vague: "%s" is a fix attempt that changes something else', async (ask) => {
    const s = (await promptAgent(await withBug('menu', 'prices_curo'), content, deafJev, ask)).state;
    expect(s.chat.at(-1)!.src).toBe('build');
    expect(s.chat.at(-1)!.text).toMatch(/tidied up the layout/);
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).toBe('prices_curo');
  });

  it.each([
    ['visible', 'The menu page crashes with an application error'],
    ['visible', 'menu shows an error'],
    ['failed_fetch', "The menu doesn't load"],
    ['failed_fetch', 'menu says failed to fetch'],
  ] as const)('live break %s: "%s"', async (failure, ask) => {
    const s0 = await withBug('menu', 'x');
    const app = getApp(s0, 'trattoria-gino')!;
    app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
    app.deployed = true; app.deployedVersion = 1;
    app.features = app.repo.map((f) => ({ ...f }));
    app.breaks.push({ featureId: 'menu', failure, day: 1, seed: 0 });
    const s = (await promptAgent(s0, content, deafJev, ask)).state;
    expect(s.chat.at(-1)!.src).toBe('build');
    expect(getApp(s, 'trattoria-gino')!.repoVersion).toBe(2);
  });

  it.each(["what's your name?", 'what time is it', 'how do I make money', 'hi', 'are you open to feedback?'])(
    'chat that only sounds similar stays chat: "%s"',
    async (ask) => {
      const s = (await promptAgent(await withBug('landing', 'hours_wrong'), content, deafJev, ask)).state;
      expect(s.chat.at(-1)!.src).not.toBe('build');
    },
  );
});
