/**
 * Small send animations for the three places the player writes to the world: a Qmail reply,
 * an agent.chat prompt and a Y post. The page is redrawn from scratch on every render, so the
 * effect is re-applied after each redraw with a negative animation-delay: it carries on from
 * where it was instead of restarting.
 */
export type SendKind = 'reply' | 'prompt' | 'post';

/** How long the slide-in runs, in ms. Matches the animation in sendFx.css. */
export const SEND_IN_MS = 360;

/** The messages a send adds to, and how each is told apart from the ones already there. */
const ITEMS: Record<SendKind, { sel: string; key: (el: HTMLElement, i: number) => string }> = {
  reply: { sel: '.qm-thread > .qm-msg', key: (el) => el.dataset.msg ?? '' },
  prompt: { sel: '#ua-log > .ua-msg.you', key: (_el, i) => String(i) },
  post: { sel: '.y-feed > .y-post.mine', key: (el) => el.querySelector<HTMLElement>('[data-like]')?.dataset.like ?? '' },
};
/** The button that waits with "Sending…" until the message lands (the prompt shows its bubble at once). */
const BUTTON: Partial<Record<SendKind, string>> = {
  reply: 'form[data-form="reply"] button[type="submit"]',
  post: 'form[data-form="ypost"] button[type="submit"]',
};

type Fx = { kind: SendKind; seen: Set<string>; landedAt: number | null };
let fx: Fx | null = null;

function keys(root: ParentNode, kind: SendKind): string[] {
  const { sel, key } = ITEMS[kind];
  return [...root.querySelectorAll<HTMLElement>(sel)].map(key);
}

/** Call just before the send goes out, while the page still shows what was there before. */
export function markSend(root: ParentNode, kind: SendKind): void {
  fx = { kind, seen: new Set(keys(root, kind)), landedAt: null };
}

/** Call after every redraw. `busy` is true while the send is still being decided. */
export function applySendFx(root: ParentNode, busy: boolean, now = Date.now()): void {
  if (!fx) return;
  const { sel, key } = ITEMS[fx.kind];
  const fresh = [...root.querySelectorAll<HTMLElement>(sel)].filter((el, i) => !fx!.seen.has(key(el, i)));
  if (fresh.length && fx.landedAt == null) fx.landedAt = now;
  if (fx.landedAt != null) {
    const t = now - fx.landedAt;
    if (t >= SEND_IN_MS) { fx = null; return; }
    for (const el of fresh) { el.classList.add('send-in'); el.style.animationDelay = `-${t}ms`; }
    return;
  }
  // nothing landed and nothing is pending any more: it didn't go out (Jev offline, a bounce)
  if (!busy) { fx = null; return; }
  const btnSel = BUTTON[fx.kind];
  const btn = btnSel ? root.querySelector<HTMLButtonElement>(btnSel) : null;
  if (btn) { btn.classList.add('sending'); btn.textContent = 'Sending…'; }
}

/** Test hook. */
export function resetSendFx(): void { fx = null; }
