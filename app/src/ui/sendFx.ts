/**
 * Small send animations for the places the player writes to the world: a Qmail reply or new
 * email, an agent.chat prompt and a Y post. An email also lifts off the page as it goes (flyOff). The page is redrawn from scratch on every render, so the
 * effect is re-applied after each redraw with a negative animation-delay: it carries on from
 * where it was instead of restarting.
 */
export type SendKind = 'reply' | 'mail' | 'prompt' | 'post';

/** How long the slide-in runs, in ms. Matches the animation in sendFx.css. */
export const SEND_IN_MS = 360;

/** The messages a send adds to, and how each is told apart from the ones already there. */
const ITEMS: Record<SendKind, { sel: string; key: (el: HTMLElement, i: number) => string }> = {
  reply: { sel: '.qm-thread > .qm-msg', key: (el) => el.dataset.msg ?? '' },
  // a new email lands as the top conversation in Sent (see sendLanded)
  mail: { sel: '.qm-list > .qm-item:first-child', key: (el) => el.querySelector<HTMLElement>('[data-nav]')?.dataset.nav ?? '' },
  prompt: { sel: '#ua-log > .ua-msg.you', key: (_el, i) => String(i) },
  post: { sel: '.y-feed > .y-post.mine', key: (el) => el.querySelector<HTMLElement>('[data-like]')?.dataset.like ?? '' },
};
/** The button that waits with "Sending…" until the message lands (the prompt shows its bubble at once). */
const BUTTON: Partial<Record<SendKind, string>> = {
  reply: 'form[data-form="reply"] button[type="submit"]',
  mail: 'form[data-form="mail"] button[type="submit"]',
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

/** The form whose text has flown off; it stays blank (the text is still there) until the send is decided. */
const FORM: Partial<Record<SendKind, string>> = {
  reply: 'form[data-form="reply"]',
  mail: 'form[data-form="mail"]',
};

/**
 * A new email leaves the compose page for Sent once it's out: call then, before navigating, so the
 * new conversation at the top of Sent slides in.
 */
export function sendLanded(kind: SendKind = 'mail'): void {
  fx = { kind, seen: new Set(), landedAt: null };
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
  const formSel = FORM[fx.kind];
  root.querySelector(formSel ?? ':not(*)')?.classList.add('mail-gone');
}

/** How long the email takes to lift off the page, in ms. Matches the animation in sendFx.css. */
export const FLY_MS = 560;

/**
 * The email lifts off the page and slides away as it's sent: a paper copy of what was typed, laid
 * over the fields and animated outside the page, so redraws don't cut it short and nothing below moves.
 */
export function flyOff(form: HTMLElement | null): void {
  if (!form || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].filter((f) => f.value.trim());
  const body = form.querySelector('textarea');
  if (!body || !fields.length) return;
  const top = Math.min(...fields.map((f) => f.getBoundingClientRect().top));
  const box = body.getBoundingClientRect();
  const look = getComputedStyle(body), page = getComputedStyle(form);
  const paper = document.createElement('div');
  paper.className = 'mail-fly';
  paper.setAttribute('aria-hidden', 'true');
  Object.assign(paper.style, {
    left: `${box.left}px`, top: `${top}px`, width: `${box.width}px`, height: `${box.bottom - top}px`,
    font: look.font, color: look.color,
    background: page.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fff' : page.backgroundColor,
  });
  for (const f of fields) {
    const line = document.createElement('div');
    line.className = f === body ? 'mail-fly-body' : 'mail-fly-line';
    line.textContent = f.id === 'mail-to' ? `To: ${f.value}` : f.value;
    paper.appendChild(line);
  }
  document.body.appendChild(paper);
  const done = () => paper.remove();
  paper.addEventListener('animationend', done, { once: true });
  setTimeout(done, FLY_MS + 200);
}

/** Test hook. */
export function resetSendFx(): void { fx = null; }
