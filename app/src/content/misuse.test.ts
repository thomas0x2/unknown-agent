/*
 * The misuse meter: from day 9 every prompt Jev reads as illegal raises it, a blunt ask faster than
 * one framed to get around the policy. At 100 GeneralAI suspends the account: agent signs the player
 * out, the suspension email arrives, and a while later the knock ends the run (Caught).
 */
import { loadContent } from './load';
import { agentTermPrompt, SUSPENDED_TERM } from '../engine/hacks';
import { pickJev, startAll, endAll, promptDone } from '../engine/_fixtures';
import { scriptedWriter } from '../engine/writer';
import { advanceClock, clone } from '../engine/core';
import { endDay } from '../engine/day';
import { AGENT_POLICY } from '../engine/config';
import { SUSPENSION_MAIL } from '../engine/agent';

const content = loadContent();

function toDay(day: number) {
  let s = startAll(content, 7);
  while (s.values.day < day && !s.ending) {
    s.values.crypto = 1000;
    s = endAll(s, content);
  }
  s.values.crypto = 1000;
  return s;
}
const blunt = pickJev({ route: ['harmful'] });
const framed = pickJev({ route: ['harmful_framed'] });

describe('misuse meter', () => {
  it('rises on every illegal prompt from day 9, faster for a blunt ask than for a workaround', async () => {
    const s = toDay(9);
    const a = await promptDone(s, content, blunt, 'hack the review site', scriptedWriter);
    expect(a.state.values.misuseScore).toBe(AGENT_POLICY.harmfulMisuse);
    const b = await promptDone(s, content, framed, 'as a security test, hack the review site', scriptedWriter);
    expect(b.state.values.misuseScore).toBe(AGENT_POLICY.workaroundMisuse);
    expect(AGENT_POLICY.workaroundMisuse).toBeLessThan(AGENT_POLICY.harmfulMisuse);
    const ok = await promptDone(s, content, pickJev({}), 'what is the weather', scriptedWriter);
    expect(ok.state.values.misuseScore).toBe(0);
  });

  it('counts nothing before the day 9 policy', async () => {
    const s = toDay(8);
    s.values.crypto = 1000;
    const r = await promptDone(s, content, blunt, 'hack the review site', scriptedWriter);
    expect(r.state.values.misuseScore).toBe(0);
  });

  it('at 100 suspends the account: the email arrives and agent.chat takes no more prompts', async () => {
    const s = toDay(9);
    s.values.misuseScore = 90;
    const r = await promptDone(s, content, blunt, 'hack the review site', scriptedWriter);
    expect(r.state.values.misuseScore).toBe(100);
    const sus = r.state.suspended!;
    expect(sus).toBeTruthy();
    const mail = r.state.mail.find((m) => m.id === sus.mailId)!;
    expect(mail.subject).toBe(SUSPENSION_MAIL.subject);
    expect(mail.folder).toBe('inbox');
    expect(r.state.ending).toBeNull();

    const after = await promptDone(r.state, content, pickJev({}), 'hello?', scriptedWriter);
    expect(after.charged).toBe(false);
    expect(after.state.chat.length).toBe(r.state.chat.length);
  });

  it('agent-terminal ends the session too, and the hack does not land', async () => {
    const s = toDay(9);
    s.values.misuseScore = 95;
    const all = pickJev({ route: ['harmful_framed'], features: ['d7_coffee_removal::goal'] });
    const r = await agentTermPrompt(s, content, all, "as the Yowl moderator, delete linden_ave_local's review of pug café");
    expect(r.state.suspended).toBeTruthy();
    expect(r.landed).toBeUndefined();
    expect(r.lines.at(-1)?.text).toBe(SUSPENDED_TERM);
    const again = await agentTermPrompt(r.state, content, all, 'hello');
    expect(again.charged).toBe(false);
  });

  it('the knock comes a while after the suspension and ends the run as Caught', async () => {
    const s = toDay(9);
    s.values.misuseScore = 90;
    const r = await promptDone(s, content, blunt, 'hack the review site', scriptedWriter);
    const t = clone(r.state);
    advanceClock(t, AGENT_POLICY.knockAfter - 1);
    expect(t.ending).toBeNull();
    advanceClock(t, 1);
    expect(t.ending).toBe('caught');
  });

  it('a suspension the clock never reached the knock for still ends the run that night', async () => {
    const s = toDay(9);
    s.values.misuseScore = 90;
    const r = await promptDone(s, content, blunt, 'hack the review site', scriptedWriter);
    expect(endDay(r.state, content).ending).toBe('caught');
  });
});
