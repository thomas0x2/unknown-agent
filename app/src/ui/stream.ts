/*
 * Token streaming for the AI chats (agent.chat, agent-terminal, lonely.ai, SorryWriter): a reply that
 * wasn't there when the chat was first drawn types itself out a few tokens at a time. Emails and
 * other text don't stream. The page renders whatever is revealed so far; while anything is still
 * streaming, a timer here fills in just those elements, so the rest of the page isn't redrawn.
 */

/** How long one token takes to appear. */
const TOKEN_MS = 28;

/** Each chat log: how many messages it already had when first drawn (those never stream). */
const base = new Map<string, number>();
/** When each streamed message first appeared, by "log:index". */
const born = new Map<string, number>();
/** Messages still streaming: their full text and how to format a part of it. */
const live = new Map<string, { text: string; fmt: (t: string) => string }>();
let timer: ReturnType<typeof setInterval> | null = null;

/** Off outside a browser (tests) and for players who asked for less motion. */
const enabled = () => typeof document !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A word with the space after it, or a run of spaces: the unit that appears at once. */
const tokens = (text: string) => text.match(/\s+|[^\s]+\s*/g) ?? [];

/**
 * A chat log's streamer. `total` is how many messages the log holds now; the returned function gives
 * the HTML of message `i` (a bot's reply), formatted by `fmt`, as far as it has streamed.
 */
export function streamer(log: string, total: number): (i: number, text: string, fmt: (t: string) => string) => string {
  if (!enabled()) return (_i, text, fmt) => fmt(text);
  // a new game, a load or a rewind can leave the log shorter than it was
  const b = base.get(log);
  if (b == null || total < b) {
    base.set(log, total);
    for (const k of [...born.keys()]) if (k.startsWith(`${log}:`)) born.delete(k);
  }
  return (i, text, fmt) => {
    if (i < base.get(log)!) return fmt(text);
    const key = `${log}:${i}`;
    if (!born.has(key)) born.set(key, performance.now());
    const shown = partial(key, text);
    if (shown == null) { live.delete(key); return fmt(text); }
    live.set(key, { text, fmt });
    tick();
    return `<span data-stream="${key}">${fmt(shown)}</span>`;
  };
}

/** The part of `text` revealed so far, or null once all of it is. */
function partial(key: string, text: string): string | null {
  const t = tokens(text);
  const n = Math.floor((performance.now() - born.get(key)!) / TOKEN_MS) + 1;
  return n >= t.length ? null : t.slice(0, n).join('');
}

function tick(): void {
  if (timer) return;
  timer = setInterval(() => {
    for (const [key, m] of live) {
      const el = document.querySelector<HTMLElement>(`[data-stream="${key}"]`);
      if (!el) { live.delete(key); continue; }
      // a log read to the end stays at the end as the reply grows
      const box = el.closest<HTMLElement>('.ua-log, .tm');
      const atEnd = !!box && box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
      const shown = partial(key, m.text);
      el.innerHTML = m.fmt(shown ?? m.text);
      if (shown == null) { el.removeAttribute('data-stream'); live.delete(key); }
      if (box && atEnd) box.scrollTop = box.scrollHeight;
    }
    if (!live.size && timer) { clearInterval(timer); timer = null; }
  }, TOKEN_MS);
}
