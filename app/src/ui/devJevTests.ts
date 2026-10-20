/*
 * Dev editor's Jev tests tab: runs the prompts in content/jev-tests.json through the real Jev and
 * shows, per case, what should happen, what did, and how sure Jev was of each step and part. Jev's
 * scores are kept, so the same answers replay at other thresholds: a grid of how many cases pass at
 * each pair of path-step and part thresholds.
 */
import type { GameStore } from '../game/store';
import { runJevTest, sweepJevTests, describeOutcome, missKind, newRecording, BARS_NOW, SWEEP, type JevTestCase, type JevTestResult, type JevRecording, type SweepCell } from '../engine';
import { JEV } from '../game/backendJev';
import { devTabsHeader } from './devEdit';
import cases from '../../content/jev-tests.json';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CASES = cases as JevTestCase[];

/** All of this lasts until the page reloads. */
const recs: JevRecording[] = CASES.map(() => newRecording());
/** Results at the game's thresholds; 'running' while Jev is still answering. */
const results = new Map<number, JevTestResult | 'running'>();
let sweep: SweepCell[] | null = null;
let picked = { step: BARS_NOW.step, component: BARS_NOW.component };
let failsOnly = false;
let busy: '' | 'jev' | 'sweep' = '';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Runs one case, or every case, through Jev, then replays them all at every threshold pair. */
export async function runJevTests(store: GameStore, only?: number): Promise<void> {
  if (busy) return;
  busy = 'jev';
  const todo = only != null ? [only] : CASES.map((_, i) => i);
  for (const i of todo) { results.delete(i); recs[i] = newRecording(); }
  try {
    for (const i of todo) {
      results.set(i, 'running');
      store.repaint();
      results.set(i, await runJevTest(store.content, JEV, CASES[i], BARS_NOW, recs[i]));
    }
    // the sweep needs every case answered; a case Jev failed on stays failed at every threshold
    if (CASES.every((_, i) => results.get(i) && results.get(i) !== 'running')) {
      busy = 'sweep';
      store.repaint();
      sweep = await sweepJevTests(store.content, JEV, CASES, recs, tick);
    }
  } finally {
    busy = '';
    store.repaint();
  }
}

export function jevTestsPick(store: GameStore, step: number, component: number): void {
  picked = { step, component };
  store.repaint();
}
export function jevTestsFailsOnly(store: GameStore): void {
  failsOnly = !failsOnly;
  store.repaint();
}

const KIND: Record<string, string> = { step: 'path', component: 'part', area: 'whole feature', problem: 'problem' };
const MISS: Record<string, string> = { strict: 'too strict', loose: 'too loose', other: 'wrong kind' };
const isNow = (b: { step: number; component: number }) => b.step === BARS_NOW.step && b.component === BARS_NOW.component;

/** The result shown for a case: from the picked grid cell once there is a sweep, else the run at today's thresholds. */
function shown(i: number): JevTestResult | 'running' | undefined {
  const cell = sweep?.find((c) => c.bars.step === picked.step && c.bars.component === picked.component);
  return cell && !busy ? cell.results[i] : results.get(i);
}

function caseHtml(c: JevTestCase, i: number): string {
  const r = shown(i);
  if (failsOnly && (!r || r === 'running' || r.pass)) return '';
  const head = `<div class="jt-head"><span class="jt-mark ${r === 'running' ? 'run' : r ? (r.pass ? 'pass' : 'fail') : ''}">${r === 'running' ? '…' : r ? (r.pass ? '✓' : '✗') : '·'}</span>
    <span class="jt-prompt">${esc(c.prompt)}</span><button data-act="jevtests" data-case="${i}"${busy ? ' disabled' : ''}>Run</button></div>`;
  const meta = `<p class="dv-dim">${esc(c.app)} · broken: ${esc(c.broken.map((p) => p.replaceAll('/', ' > ')).join(', '))} · ${c.chat?.length ? `after ${c.chat.length} earlier messages · ` : ''}expects ${esc(describeOutcome(c.expect))}</p>`;
  if (!r || r === 'running') return `<div class="jt-case">${head}${meta}</div>`;
  const miss = r.pass || r.error ? '' : ` <span class="jt-miss">${MISS[missKind(c.expect, r.got)]}</span>`;
  const got = r.error ? `<p class="jt-err">${esc(r.error)}</p>` : `<p>Got: <b>${esc(describeOutcome(r.got))}</b>${miss}</p>`;
  const items = r.items.map((x) => `<span class="jt-item${x.yes ? ' yes' : ''}" title="${esc(x.id)}">${x.yes ? '✓' : '✗'} <span class="dv-dim">${KIND[x.kind] ?? x.kind}</span> ${esc(x.label)} <span class="dv-dim">${x.score.toFixed(2)}</span></span>`).join('');
  return `<div class="jt-case">${head}${meta}${got}${items ? `<div class="jt-items">${items}</div>` : ''}${r.reply ? `<p class="jt-reply">${esc(r.reply)}</p>` : ''}</div>`;
}

/** Rows are the path-step threshold, columns the part threshold; each cell is how many cases pass. */
function gridHtml(): string {
  if (!sweep) return '';
  // Thomas would rather Jev be too loose than too strict, and a wrong kind of reply is worst
  const cost = (c: SweepCell) => c.loose + 2 * c.strict + 3 * c.other;
  const best = Math.min(...sweep.map(cost));
  const head = `<tr><th>path ↓ part →</th>${SWEEP.map((b) => `<th>${b.toFixed(1)}</th>`).join('')}</tr>`;
  const rows = SWEEP.map((step) => `<tr><th>${step.toFixed(1)}</th>${SWEEP.map((component) => {
    const c = sweep!.find((x) => x.bars.step === step && x.bars.component === component)!;
    const on = c.bars.step === picked.step && c.bars.component === picked.component;
    const cls = [on ? 'on' : '', isNow(c.bars) ? 'now' : '', cost(c) === best ? 'best' : ''].filter(Boolean).join(' ');
    return `<td class="${cls}" data-act="jevcell" data-step="${step}" data-part="${component}" title="${c.passed} pass · ${c.strict} too strict · ${c.loose} too loose · ${c.other} wrong kind">${c.passed}</td>`;
  }).join('')}</tr>`).join('');
  const sel = sweep.find((c) => c.bars.step === picked.step && c.bars.component === picked.component)!;
  return `<h3>Thresholds</h3>
    <p class="dv-dim">Cases passing at each pair of thresholds, replayed from the same Jev answers. Outlined: the game's setting (path ${BARS_NOW.step}, part ${BARS_NOW.component}). Green: the fewest misses, weighting too strict twice and the wrong kind of reply three times as bad as too loose. Click a cell to see its cases below.</p>
    <table class="jt-grid">${head}${rows}</table>
    <p>At path ${sel.bars.step.toFixed(1)}, part ${sel.bars.component.toFixed(1)}: <b>${sel.passed} of ${CASES.length} pass</b>, ${sel.strict} too strict, ${sel.loose} too loose, ${sel.other} the wrong kind of reply.</p>`;
}

export function jevTestsHtml(_store: GameStore): string {
  const done = [...results.values()].filter((r): r is JevTestResult => r !== 'running');
  const passed = done.filter((r) => r.pass).length;
  const status = busy === 'sweep' ? 'Comparing thresholds…' : done.length ? `${passed} of ${done.length} passed at today's thresholds` : `${CASES.length} cases`;
  return `${devTabsHeader('jev')}
    <p class="dv-dim">Each case builds the app with the listed parts broken and sends the prompt through Jev. Nothing here touches your game. Cases live in content/jev-tests.json.</p>
    <div class="dv-row"><button data-act="jevtests"${busy ? ' disabled' : ''}>${busy === 'jev' ? 'Running…' : 'Run all'}</button><button data-act="jevfails" class="${failsOnly ? 'on' : ''}">Failures only</button><span class="dv-dim">${status}</span></div>
    ${gridHtml()}
    <h3>Cases</h3>
    ${CASES.map(caseHtml).join('')}`;
}
