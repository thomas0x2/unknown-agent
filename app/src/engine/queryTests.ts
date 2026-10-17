/*
 * Query test runner: each case asks agent.chat a question on a given day, through the real
 * promptAgent, and checks what Jev made of it: which wiki pages answer it, or that it's refused as
 * classified, too broad, or a miss. Cases live in content/query-tests.json. Like the fix tests
 * (jevTests.ts), a run records Jev's confidences so other thresholds replay without asking again.
 */
import type { Content } from '../content/schema';
import type { JevRouter } from './jev';
import { promptAgent } from './actions';
import { scriptedWriter } from './writer';
import { estimatedState } from './viewState';
import { replaying, newRecording, BARS_NOW, type JevRecording } from './jevTests';

export interface QueryTestCase {
  prompt: string;
  /** The day it's asked on (default 3), and the time ("HH:MM", default 21:00: the day's mail and posts are in). */
  day?: number;
  at?: string;
  flags?: string[];
  /**
   * answer: the question is answered from all of `pages` (wiki titles), at least one of `any`, and
   * no page outside `pages`, `any` and `also`. classified: it's refused. broad: agent asks which of several things.
   * miss: no page at all (a roast, or a scripted near-miss topic).
   */
  expect: { kind: 'answer' | 'classified' | 'broad' | 'miss'; pages?: string[]; any?: string[]; also?: string[] };
}

export interface QueryTestResult {
  pass: boolean;
  got: { kind: string; pages: string[] };
  /** Jev's own account of the match (the Details line). */
  debug: string;
  error?: string;
}

/** The confidence each kind of query question needs: which page, which page mainly (only where the router has no scores: query.ts weighs those itself), which section. */
export interface QueryBars { topic: number; main: number; section: number }
export const QUERY_BARS_NOW: QueryBars = { topic: 0.6, main: 0.8, section: 0.5 };
const barOf = (b: QueryBars) => (kind: string | undefined) =>
  kind === 'topic' ? b.topic : kind === 'main' ? b.main : kind === 'section' ? b.section
  : kind === 'component' ? BARS_NOW.component : kind === 'step' ? BARS_NOW.step : BARS_NOW.other;

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** The pages a query debug line names: "Jev: A › Overview; B › Prices (…)" or "Jev: A; B, not known…". */
function pagesOf(debug: string): string[] {
  const line = debug.split('\n').find((l) => l.startsWith('Jev: ') && !l.includes('near-miss topic') && !l.includes('no query')) ?? '';
  const body = line.slice(5).replace(/ \((?:\d+ public|mainly about).*$/, '').replace(/, (?:not known|all hidden).*$/, '');
  if (!body || /^the question/.test(body)) return [];
  return [...new Set(body.split('; ').map((x) => x.split(' › ')[0].trim()).filter(Boolean))];
}

export async function runQueryTest(content: Content, jev: JevRouter, c: QueryTestCase, bars: QueryBars = QUERY_BARS_NOW, rec: JevRecording = newRecording()): Promise<QueryTestResult> {
  const s = estimatedState(content, c.day ?? 3, toMin(c.at ?? '21:00'), c.flags ?? []);
  s.phase = 'work';
  s.values.crypto = 10_000;
  let r;
  try {
    r = await promptAgent(s, content, replaying(jev, rec, barOf(bars)), c.prompt, scriptedWriter);
  } catch (e) {
    return { pass: false, got: { kind: 'error', pages: [] }, debug: '', error: e instanceof Error ? e.message : String(e) };
  }
  const last = r.state.chat.at(-1)!;
  const debug = (last.debug ?? []).join('\n');
  const kind = /^query/.test(last.src ?? '') ? 'answer'
    : last.src === 'classified' ? 'classified'
    : last.src === 'near_miss' && /too broad/.test(debug) ? 'broad'
    : 'miss';
  const pages = kind === 'answer' || kind === 'classified' ? pagesOf(debug) : [];
  const want = c.expect;
  const allowed = new Set([...(want.pages ?? []), ...(want.any ?? []), ...(want.also ?? [])]);
  const pass = kind === want.kind && (kind !== 'answer' || ((want.pages ?? []).every((p) => pages.includes(p)) && (!want.any?.length || want.any.some((p) => pages.includes(p))) && pages.every((p) => allowed.has(p))));
  return { pass, got: { kind, pages }, debug };
}
