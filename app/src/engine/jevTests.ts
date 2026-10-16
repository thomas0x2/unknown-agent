/*
 * Jev test runner (dev menu): each case builds one app with the named components broken, sends the
 * prompt through the real promptAgent, and reports what Jev said yes to next to what should happen:
 * which parts get fixed, which near-miss reply comes back, or nothing.
 */
import type { Content, Effects } from '../content/schema';
import type { GameState } from './state';
import type { JevRouter, FeatureMatchInput } from './jev';
import { startGame } from './day';
import { applyEffects } from './effects';
import { promptAgent } from './actions';
import { deliverAgentWork } from './core';
import { getApp, bugsOf, componentPath } from './apps';
import { scriptedWriter } from './writer';

export interface JevTestCase {
  /** The app template ('restaurant', 'sentiment', …): the client job that creates it, with its later spec updates. */
  app: string;
  /** Component paths (feature/folder/part) that ship broken. Everything else is built right. */
  broken: string[];
  prompt: string;
  /** fix: exactly these components get fixed. near: that near-miss reply (near_feature, near_folder, near_part, near_miss). none: neither. */
  expect: { fix?: string[]; near?: string; none?: boolean };
}

export interface JevTestResult {
  pass: boolean;
  /** What happened, in the same terms as `expect`. */
  got: { fix: string[]; near?: string };
  /** The agent's reply. */
  reply: string;
  /** Every item of the fix question for the features involved, with Jev's answer. */
  items: { id: string; kind: string; label: string; yes: boolean }[];
  error?: string;
}

/** Plain words for what a case expects or got. */
export function describeOutcome(o: { fix?: string[]; near?: string; none?: boolean }): string {
  if (o.near) return `near-miss: ${NEAR_LABEL[o.near] ?? o.near}`;
  if (o.fix?.length) return `fixes ${o.fix.map((p) => p.replaceAll('/', ' > ')).join(', ')}`;
  return 'nothing';
}
const NEAR_LABEL: Record<string, string> = {
  near_feature: 'part named without its feature',
  near_folder: 'feature and part, folder missing',
  near_part: 'folder named, no part',
  near_miss: 'feature named, no part',
};

/** The app as a client job creates it, its spec updates applied, built with `broken` wrong and the rest right. */
export function jevTestState(content: Content, c: JevTestCase): { s: GameState; appId: string } {
  const s = startGame(content, 7);
  s.values.day = 3;
  s.values.crypto = 10_000;
  const job = content.events.find((e) => e.outcomes?.some((o) => o.effects?.createApp?.template === c.app));
  if (!job) throw new Error(`No client job creates a ${c.app} app`);
  applyEffects(s, job.outcomes!.find((o) => o.effects?.createApp)!.effects!);
  const a = s.apps.at(-1)!;
  for (const ev of content.events) {
    const fx: (Effects | undefined)[] = [ev.onDeliver, ...(ev.outcomes ?? []).map((o) => o.effects)];
    const up = fx.find((e) => e?.updateApp?.client === job.id);
    if (up) applyEffects(s, up, undefined, ev.id);
  }
  const tmpl = content.apps[a.template];
  a.repo = a.required.map((id) => {
    const def = tmpl?.features.find((f) => f.id === id);
    const bugs = c.broken.filter((p) => p.startsWith(`${id}/`)).map((p) => {
      const comp = def?.components?.find((x) => x.id === p.slice(id.length + 1));
      if (!comp?.bugs?.length) throw new Error(`${p} isn't a component that can break`);
      return comp.bugs[0];
    });
    return bugs.length ? { id, correct: false, variant: bugs[0], also: bugs.length > 1 ? bugs.slice(1) : undefined, params: a.specParams[id] } : { id, correct: true, params: a.specParams[id] };
  });
  a.repoVersion = 1;
  a.deployed = true;
  a.deployedVersion = 1;
  a.breaks = [];
  // no user app gets started by a test prompt
  s.fired.push(...content.events.filter((e) => e.agentStart).map((e) => e.id));
  return { s, appId: a.id };
}

export async function runJevTest(content: Content, jev: JevRouter, c: JevTestCase): Promise<JevTestResult> {
  const asked: { input: FeatureMatchInput; out: string[] }[] = [];
  const spy: JevRouter = {
    route: (i) => jev.route(i),
    ratePost: (i) => jev.ratePost(i),
    matchFeatures: async (i) => { const out = await jev.matchFeatures(i); asked.push({ input: i, out }); return out; },
  };
  const { s, appId } = jevTestState(content, c);
  const tmpl = content.apps[getApp(s, appId)!.template];
  const items = () => {
    // the fix question is the one that carries path steps; show the features the case is about
    const q = asked.find((x) => x.input.features.some((f) => f.id.includes('::s:')));
    const feats = new Set([...c.broken, ...(c.expect.fix ?? [])].map((p) => p.split('/')[0]));
    return (q?.input.features ?? []).filter((f) => feats.has(f.id.split('::')[1]) && f.kind !== 'build').map((f) => {
      const [, fid, cat] = f.id.split('::');
      const label = cat.startsWith('c:') ? componentPath(fid, cat.slice(2)) : cat.startsWith('s:') ? cat.slice(2).replaceAll('/', ' > ').replaceAll('_', ' ') : cat === 'area' ? `${fid.replaceAll('_', ' ')} as a whole` : cat;
      return { id: f.id, kind: f.kind ?? 'problem', label, yes: q!.out.includes(f.id) };
    });
  };
  let r;
  try {
    r = await promptAgent(s, content, spy, c.prompt, scriptedWriter);
    if (r.state.agentWork) deliverAgentWork(r.state, true);
  } catch (e) {
    return { pass: false, got: { fix: [] }, reply: '', items: items(), error: e instanceof Error ? e.message : String(e) };
  }
  const last = r.state.chat.at(-1)!;
  const near = last.src === 'near_miss' ? last.debug?.join(' ').match(/near-miss \((\w+)\)/)?.[1] ?? 'near_miss' : undefined;
  const after = getApp(r.state, appId)!;
  const fix = c.broken.filter((p) => {
    const fid = p.split('/')[0];
    const bug = tmpl?.features.find((f) => f.id === fid)?.components?.find((x) => x.id === p.slice(fid.length + 1))?.bugs?.[0];
    return !bugsOf(after.repo.find((f) => f.id === fid)).includes(bug!);
  });
  const want = c.expect;
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  const pass = want.near ? near === want.near : want.fix ? !near && same(fix, want.fix) : !near && !fix.length;
  return { pass, got: { fix, near }, reply: r.state.chat.slice(r.state.chat.map((m) => m.from).lastIndexOf('you') + 1).map((m) => m.text).join('\n'), items: items() };
}
