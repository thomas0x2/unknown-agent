/*
 * The waitlist on Logan's site: joining puts the player on it, the counter counts them, and the
 * confirmation email says their place in line. Each bug changes exactly what the player can check.
 */
import { loadContent } from './load';
import { applyEffects } from '../engine/effects';
import { joinWaitlist, deploy } from '../engine/actions';
import { getApp, devToggleBug } from '../engine/apps';
import { startGame } from '../engine/day';
import { renderAppSite } from '../ui/appsite';
import type { GameState } from '../engine';

const content = loadContent();
const ME = 'you@qmail.com';

function site(): { s: GameState; id: string } {
  let s = startGame(content, 3);
  applyEffects(s, content.events.find((e) => e.id === 'logan_contact')!.outcomes![0].effects!, undefined, 'logan_contact');
  applyEffects(s, content.events.find((e) => e.id === 'd2_logan_waitlist')!.onDeliver!);
  const a = s.apps.at(-1)!;
  a.repo = a.required.map((id) => ({ id, correct: true, params: a.specParams[id] }));
  a.repoVersion = 1;
  s = deploy(s, a.id);
  const live = getApp(s, a.id)!;
  // the first deploy's teaching bug, off again: start from a clean site
  for (const list of [live.repo, live.features]) for (const f of list) Object.assign(f, { correct: true, variant: undefined, also: undefined });
  return { s, id: a.id };
}
const page = (s: GameState, id: string) => renderAppSite(getApp(s, id)!, content.apps.startup, 'waitlist', { waitlist: '<form></form>', joined: s.waitlist.filter((w) => w.appId === id).length });
const mails = (s: GameState) => s.mail.filter((m) => m.folder === 'inbox' && /waitlist/i.test(m.subject));

describe('the waitlist', () => {
  it('joining counts the player and emails their place in line', () => {
    const { s, id } = site();
    expect(page(s, id)).toContain('<b>10,000</b>');
    const out = joinWaitlist(s, id, ME, content);
    expect(out.waitlistNotice).toMatchObject({ ok: true });
    expect(page(out, id)).toContain('<b>10,001</b>');
    expect(mails(out)).toHaveLength(1);
    expect(mails(out)[0].body).toContain("You're #10,001 on the WorkAgent waitlist.");
  });

  it('a bad address is refused', () => {
    const { s, id } = site();
    const out = joinWaitlist(s, id, 'not an email', content);
    expect(out.waitlistNotice).toMatchObject({ ok: false });
    expect(out.waitlist).toHaveLength(0);
  });

  it('each bug shows where it lives', () => {
    const cases: Record<string, (s: GameState, id: string) => void> = {
      dead_button: (s) => { expect(s.waitlist).toHaveLength(0); expect(s.waitlistNotice).toBeUndefined(); },
      counter_zero: (s, id) => expect(page(s, id)).toContain('<b>1</b>'),
      counter_stuck: (s, id) => expect(page(s, id)).toContain('<b>10,000</b>'),
      no_email: (s) => expect(mails(s)).toHaveLength(0),
      position_wrong: (s) => expect(mails(s)[0].body).toContain("You're #1 on"),
      sent_to_founder: (s) => { expect(mails(s)).toHaveLength(1); expect(mails(s)[0].addr).toBe('logan@workagent.test'); },
    };
    for (const [bug, check] of Object.entries(cases)) {
      const { s, id } = site();
      devToggleBug(s, id, 'waitlist', bug);
      check(joinWaitlist(s, id, ME, content), id);
    }
  });
});
