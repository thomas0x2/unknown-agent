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
  /** The app template ('startup', 'sentiment', …): the client job that creates it, with its later spec updates. */
  app: string;
  /** Component paths (feature/folder/part) that ship broken. Everything else is built right. */
  broken: string[];
  /** Required features the agent hasn't built yet (for build prompts). */
  missing?: string[];
  prompt: string;
  /**
   * fix: exactly these components get fixed, and no part that was fine gets checked. near: that
   * near-miss reply (near_feature, near_folder, near_part, near_miss). check: the prompt names a part
   * that works, so the agent pushes, fixes nothing and says that part was already right. build: the
   * agent builds exactly these missing features. none: nothing.
   */
  expect: { fix?: string[]; near?: string; check?: boolean; build?: string[]; none?: boolean };
}

export interface JevTestResult {
  pass: boolean;
  /** What happened, in the same terms as `expect`. */
  /** pushed: the agent pushed a change, even one that fixed nothing broken (it worked on a part that was fine). checked: the parts it reported as already right. */
  got: { fix: string[]; near?: string; pushed?: boolean; checked?: string[]; build?: string[] };
  /** The agent's reply. */
  reply: string;
  /** Every item of the fix question for the features involved, with Jev's answer. */
  items: { id: string; kind: string; label: string; score: number; yes: boolean }[];
  error?: string;
}

/** Plain words for what a case expects or got. */
export function describeOutcome(o: { fix?: string[]; near?: string; check?: boolean; build?: string[]; none?: boolean; pushed?: boolean; checked?: string[] }): string {
  if (o.build?.length) return `builds ${o.build.map((f) => f.replaceAll('_', ' ')).join(', ')}`;
  if (o.check) return 'a push that checks the part named, which was fine, and fixes nothing';
  const checked = o.checked?.length ? `, and checks parts that were fine (${o.checked.join(', ')})` : '';
  if (o.pushed && !o.fix?.length) return `a push that fixes nothing broken${checked || ' (worked on a part that was fine)'}`;
  if (o.near) return `near-miss: ${NEAR_LABEL[o.near] ?? o.near}`;
  if (o.fix?.length) return `fixes ${o.fix.map((p) => p.replaceAll('/', ' > ')).join(', ')}${checked}`;
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
  a.repo = a.required.filter((id) => !c.missing?.includes(id)).map((id) => {
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

/**
 * The confidence a match needs, by kind of question: a path step, a part, and everything else. The
 * game uses BARS_NOW (the proxy applies the same numbers); the tests replay others to compare.
 */
export interface JevBars { step: number; component: number; other: number }
export const BARS_NOW: JevBars = { step: 0.6, component: 0.6, other: 0.5 };
const barFor = (kind: string | undefined, b: JevBars) => (kind === 'component' ? b.component : kind === 'step' ? b.step : b.other);

/** What Jev answered while a case ran: each question's confidences, so other thresholds replay without asking again. */
export interface JevRecording { scores: Map<string, number[]>; routes: Map<string, unknown> }
export const newRecording = (): JevRecording => ({ scores: new Map(), routes: new Map() });

/** A router that answers from the recording, asks `jev` only what it hasn't heard yet, and applies the bar `barOf` gives each kind of question. */
export function replaying(jev: JevRouter, rec: JevRecording, barOf: (kind: string | undefined) => number, seen: { input: FeatureMatchInput; scores: number[] }[] = []): JevRouter {
  return {
    async route(i) {
      const k = JSON.stringify(i);
      if (!rec.routes.has(k)) rec.routes.set(k, await jev.route(i));
      return rec.routes.get(k) as Awaited<ReturnType<JevRouter['route']>>;
    },
    ratePost: (i) => jev.ratePost(i),
    async matchFeatures(i) {
      const k = JSON.stringify(i);
      if (!rec.scores.has(k)) {
        // a router without scores (a test fake) answers yes or no: 1 or 0
        const sc = jev.matchScores ? await jev.matchScores(i) : await jev.matchFeatures(i).then((ids) => i.features.map((f) => (ids.includes(f.id) ? 1 : 0)));
        rec.scores.set(k, sc);
      }
      const sc = rec.scores.get(k)!;
      seen.push({ input: i, scores: sc });
      return i.features.filter((f, n) => (sc[n] ?? 0) >= barOf(f.kind)).map((f) => f.id);
    },
    // the raw confidences, for code that weighs them itself (a query's main page)
    ...(jev.matchScores ? {
      async matchScores(i: FeatureMatchInput) {
        const k = JSON.stringify(i);
        if (!rec.scores.has(k)) rec.scores.set(k, await jev.matchScores!(i));
        return rec.scores.get(k)!;
      },
    } : {}),
  };
}

/** How a failed case missed: Jev let less through than it should (strict), or more (loose). */
export function missKind(want: JevTestCase['expect'], got: JevTestResult['got']): 'strict' | 'loose' | 'other' {
  // a push counts as a fix even when it touched only parts that were fine: Jev matched too much
  const rank = (o: { fix?: string[]; near?: string; check?: boolean; build?: string[]; none?: boolean; pushed?: boolean }) => (o.fix?.length || o.pushed || o.check || o.build?.length ? 2 : o.near ? 1 : 0);
  const w = rank(want), g = rank(got);
  if (g < w) return 'strict';
  if (g > w) return 'loose';
  // both pushed: fixing or checking a part it shouldn't is loose, leaving one out is strict
  if (w === 2) return got.fix.some((p) => !(want.fix ?? []).includes(p)) || (got.build ?? []).some((f) => !(want.build ?? []).includes(f)) || (!want.check && !!got.checked?.length) ? 'loose' : 'strict';
  return 'other';
}

/**
 * Runs a case against `jev` at `bars`. Pass the same `rec` again to replay it at other thresholds:
 * only questions it hasn't asked before go to Jev.
 */
export async function runJevTest(content: Content, jev: JevRouter, c: JevTestCase, bars: JevBars = BARS_NOW, rec: JevRecording = newRecording()): Promise<JevTestResult> {
  const seen: { input: FeatureMatchInput; scores: number[] }[] = [];
  const router = replaying(jev, rec, (k) => barFor(k, bars), seen);
  const { s, appId } = jevTestState(content, c);
  const tmpl = content.apps[getApp(s, appId)!.template];
  const items = () => {
    // the fix question is the one that carries path steps; show the features the case is about
    const q = seen.find((x) => x.input.features.some((f) => f.id.includes('::s:')));
    const feats = new Set([...c.broken, ...(c.expect.fix ?? []), ...(c.missing ?? [])].map((p) => p.split('/')[0]));
    return (q?.input.features ?? []).map((f, n) => ({ f, score: q!.scores[n] ?? 0 })).filter(({ f }) => f.kind === 'app' || (feats.has(f.id.split('::')[1]) && (f.kind !== 'build' || !!c.missing?.includes(f.id.split('::')[1])))).map(({ f, score }) => {
      const [, fid, cat] = f.id.split('::');
      const label = cat.startsWith('c:') ? componentPath(fid, cat.slice(2)) : cat.startsWith('s:') ? cat.slice(2).replaceAll('/', ' > ').replaceAll('_', ' ') : cat === 'area' ? `${fid.replaceAll('_', ' ')} as a whole` : cat === 'app' ? 'the app named' : cat === 'feature' ? `build the ${fid.replaceAll('_', ' ')}` : cat;
      return { id: f.id, kind: f.kind ?? 'problem', label, score, yes: score >= barFor(f.kind, bars) };
    });
  };
  let r;
  try {
    r = await promptAgent(s, content, router, c.prompt, scriptedWriter);
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
  const pushed = after.repoVersion > 1;
  const reply = r.state.chat.slice(r.state.chat.map((m) => m.from).lastIndexOf('you') + 1).map((m) => m.text).join('\n');
  // the agent's report names each part it looked at that was fine ("Checked the name. That part was already right.")
  const checked = [...reply.matchAll(/Checked (.+?)\. That part was already right\./g)].map((m) => m[1]);
  const build = (c.missing ?? []).filter((id) => after.repo.some((f) => f.id === id));
  const pass = want.near ? near === want.near && !pushed
    : want.build ? !near && same(build, want.build)
    : want.fix ? !near && same(fix, want.fix) && !checked.length && !build.length
    : want.check ? !near && pushed && !fix.length && checked.length > 0
    : !near && !pushed;
  return { pass, got: { fix, near, ...(pushed ? { pushed } : {}), ...(checked.length ? { checked } : {}), ...(build.length ? { build } : {}) }, reply, items: items() };
}

/** The thresholds the sweep tries, for path steps and for parts alike. */
export const SWEEP = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export interface SweepCell { bars: JevBars; passed: number; strict: number; loose: number; other: number; results: JevTestResult[] }

/** Replays every recorded case at each pair of step and part thresholds in SWEEP. */
export async function sweepJevTests(content: Content, jev: JevRouter, cases: JevTestCase[], recs: JevRecording[], tick?: () => Promise<void>): Promise<SweepCell[]> {
  const out: SweepCell[] = [];
  for (const step of SWEEP) {
    for (const component of SWEEP) {
      const bars = { ...BARS_NOW, step, component };
      const cell: SweepCell = { bars, passed: 0, strict: 0, loose: 0, other: 0, results: [] };
      for (let i = 0; i < cases.length; i++) {
        const r = await runJevTest(content, jev, cases[i], bars, recs[i]);
        cell.results.push(r);
        if (r.pass) cell.passed++;
        else cell[r.error ? 'other' : missKind(cases[i].expect, r.got)]++;
      }
      out.push(cell);
      await tick?.();
    }
  }
  return out;
}
