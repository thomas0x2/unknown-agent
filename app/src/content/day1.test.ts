/*
 * Plays day 1 of the real authored content through the engine with the offline Jev router: take the
 * restaurant lead, build and deploy the site, check it, fix the teaching bug, end the day, get paid.
 */
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { composeEmail, briefBuild, briefFix, deploy } from '../engine/actions';
import { appMeetsSpec, getApp } from '../engine/apps';
import { offlineJev } from '../engine/jev';

const content = loadContent();

describe('day 1 playthrough', () => {
  it('opens with the termination email and the restaurant lead on Y', () => {
    const s = startGame(content, 7);
    const inbox = s.delivered.filter((d) => d.site === 'qmail').map((d) => d.eventId);
    expect(inbox).toContain('d1_hr_termination');
    expect(inbox).toContain('d1_mom');
    expect(s.delivered.some((d) => d.eventId === 'd1_y_restaurant')).toBe(true);
    // the latent lead is NOT in the inbox yet
    expect(inbox).not.toContain('restaurant_contact');
  });

  it('take the gig, build, deploy, fix the bug, and get paid at day end', async () => {
    let s = startGame(content, 7);

    // email Gino to take the job -> creates the client app + drops the spec in the inbox
    const c = await composeEmail(s, content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website with the menu and hours.');
    expect(c.sent).toBe(true);
    s = c.state;
    const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact');
    expect(app).toBeTruthy();
    const appId = app!.id;

    // brief the agent to build landing + menu
    const b = await briefBuild(s, content, offlineJev, appId, 'Build a landing page with the name and opening hours, and a menu page listing each dish with its price in DOLR.');
    s = b.state;
    expect(b.requested.sort()).toEqual(['landing', 'menu']);

    // first build always ships a teaching bug -> not meeting spec yet
    expect(getApp(s, appId)!.repo.some((f) => !f.correct)).toBe(true);

    // deploy, then fix whichever feature is wrong until the live app meets spec
    s = deploy(s, appId);
    for (let i = 0; i < 6 && !appMeetsSpec(getApp(s, appId)!); i++) {
      const broken = getApp(s, appId)!.repo.find((f) => !f.correct)!;
      const prompt = broken.id === 'menu'
        ? 'The menu is wrong — fix the dishes and their prices in DOLR.'
        : 'The landing page is wrong — fix the restaurant name and opening hours.';
      s = (await briefFix(s, content, offlineJev, appId, prompt)).state;
      s = deploy(s, appId);
    }
    expect(appMeetsSpec(getApp(s, appId)!)).toBe(true);

    // end the day: the working client app pays 40
    const before = s.values.crypto;
    s = endDay(s, content);
    expect(s.values.day).toBe(2);
    expect(s.values.crypto).toBeGreaterThan(before); // +40 pay, minus the level-1 subscription
  });
});
