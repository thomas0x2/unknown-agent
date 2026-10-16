/*
 * Downloading a model from Weightroom: a fake `weightroom pull` that plays out in the Terminal.
 * Pure functions of the elapsed time, so the view can redraw any frame and tests can check them.
 */

export type TermLine = { k: 'in' | 'sys' | 'err' | 'model'; text: string };

export interface ModelInfo { id: string; name: string; file: string; gb: number; digest: string }
export const MODELS: Record<string, ModelInfo> = {
  deepsleep: { id: 'deepsleep', name: 'deepsleep-0.5B', file: 'deepsleep-0.5B.gguf', gb: 2, digest: '9f3c1e07a2b4' },
};
export const modelName = (id: string) => MODELS[id]?.name ?? id;

/** Timeline in ms: manifest, the bar to 99%, a stall at 99%, then verify and done. */
const T = { manifest: 700, bar: 5000, stall: 6200, verify: 6700 };
export const PULL_MS = 7000;
const BAR = 24;

/** How far the download is, 0–100, at `ms` after it started. */
export function pullPct(ms: number): number {
  if (ms < T.manifest) return 0;
  if (ms < T.bar) { const p = (ms - T.manifest) / (T.bar - T.manifest); return Math.floor(99 * (1 - (1 - p) ** 1.6)); }
  if (ms < T.stall) return 99;
  return 100;
}

/** The Terminal's lines for the pull at `ms` after it started. At PULL_MS and later, the finished log. */
export function pullLines(id: string, ms: number): TermLine[] {
  const m = MODELS[id] ?? { id, name: id, file: id, gb: 1, digest: '000000000000' };
  const lines: TermLine[] = [{ k: 'in', text: `$ weightroom pull ${m.name}` }, { k: 'sys', text: 'pulling manifest' }];
  if (ms < T.manifest) return lines;
  const pct = pullPct(ms);
  const fill = Math.round((BAR * pct) / 100);
  const got = ((m.gb * pct) / 100).toFixed(2);
  const speed = pct >= 99 && pct < 100 ? '0 B/s' : pct === 100 ? '' : `${Math.round(380 + 70 * Math.sin(ms / 330))} MB/s`;
  lines.push({ k: 'sys', text: `pulling ${m.digest}  ${String(pct).padStart(3)}% ▕${'█'.repeat(fill)}${'░'.repeat(BAR - fill)}▏ ${got}/${m.gb.toFixed(1)} GB${speed ? '  ' + speed : ''}` });
  if (ms < T.stall) return lines;
  lines.push({ k: 'sys', text: 'verifying sha256 digest' });
  if (ms < T.verify) return lines;
  lines.push({ k: 'sys', text: 'writing manifest' });
  if (ms < PULL_MS) return lines;
  lines.push({ k: 'sys', text: 'success' }, { k: 'sys', text: `${m.name} is running on localhost. Replies are free but slow. (type 'clear' to wipe the screen)` });
  return lines;
}
