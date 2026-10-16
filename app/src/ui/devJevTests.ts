/*
 * Dev editor's Jev tests tab: runs the prompts in content/jev-tests.json through the real Jev and
 * shows, per case, what should happen, what did, and which steps and parts Jev said yes to.
 */
import type { GameStore } from '../game/store';
import { runJevTest, describeOutcome, type JevTestCase, type JevTestResult } from '../engine';
import { JEV } from '../game/backendJev';
import { devTabsHeader } from './devEdit';
import cases from '../../content/jev-tests.json';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CASES = cases as JevTestCase[];

/** Results by case index; 'running' while Jev is still answering it. Kept until the page reloads. */
const results = new Map<number, JevTestResult | 'running'>();
let busy = false;

/** Runs one case, or every case one after another, repainting as each finishes. */
export async function runJevTests(store: GameStore, only?: number): Promise<void> {
  if (busy) return;
  busy = true;
  const todo = only != null ? [only] : CASES.map((_, i) => i);
  for (const i of todo) results.delete(i);
  try {
    for (const i of todo) {
      results.set(i, 'running');
      store.repaint();
      results.set(i, await runJevTest(store.content, JEV, CASES[i]));
    }
  } finally {
    busy = false;
    store.repaint();
  }
}

const KIND: Record<string, string> = { step: 'path', component: 'part', area: 'whole feature', problem: 'problem' };

function caseHtml(c: JevTestCase, i: number): string {
  const r = results.get(i);
  const head = `<div class="jt-head"><span class="jt-mark ${r === 'running' ? 'run' : r ? (r.pass ? 'pass' : 'fail') : ''}">${r === 'running' ? '…' : r ? (r.pass ? '✓' : '✗') : '·'}</span>
    <span class="jt-prompt">${esc(c.prompt)}</span><button data-act="jevtests" data-case="${i}"${busy ? ' disabled' : ''}>Run</button></div>`;
  const meta = `<p class="dv-dim">${esc(c.app)} · broken: ${esc(c.broken.map((p) => p.replaceAll('/', ' > ')).join(', '))} · expects ${esc(describeOutcome(c.expect))}</p>`;
  if (!r || r === 'running') return `<div class="jt-case">${head}${meta}</div>`;
  const got = r.error ? `<p class="jt-err">${esc(r.error)}</p>` : `<p>Got: <b>${esc(describeOutcome(r.got))}</b></p>`;
  const items = r.items.map((x) => `<span class="jt-item${x.yes ? ' yes' : ''}" title="${esc(x.id)}">${x.yes ? '✓' : '✗'} <span class="dv-dim">${KIND[x.kind] ?? x.kind}</span> ${esc(x.label)}</span>`).join('');
  return `<div class="jt-case">${head}${meta}${got}${items ? `<div class="jt-items">${items}</div>` : ''}${r.reply ? `<p class="jt-reply">${esc(r.reply)}</p>` : ''}</div>`;
}

export function jevTestsHtml(_store: GameStore): string {
  const done = [...results.values()].filter((r): r is JevTestResult => r !== 'running');
  const passed = done.filter((r) => r.pass).length;
  return `${devTabsHeader('jev')}
    <p class="dv-dim">Each case builds the app with the listed parts broken and sends the prompt through Jev, then shows what Jev said yes to. Nothing here touches your game. Cases live in content/jev-tests.json.</p>
    <div class="dv-row"><button data-act="jevtests"${busy ? ' disabled' : ''}>${busy ? 'Running…' : 'Run all'}</button><span class="dv-dim">${done.length ? `${passed} of ${done.length} passed` : `${CASES.length} cases`}</span></div>
    ${CASES.map(caseHtml).join('')}`;
}
