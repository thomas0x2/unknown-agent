import { describe, it, expect, beforeEach } from 'vitest';
import { markSend, applySendFx, resetSendFx, sendLanded, SEND_IN_MS } from './sendFx';

// a stand-in for the page: only what sendFx touches (no DOM in these tests)
type El = { dataset: Record<string, string>; classes: Set<string>; style: { animationDelay?: string }; textContent: string; classList: { add: (c: string) => void } };
function el(data: Record<string, string> = {}, text = ''): El {
  const classes = new Set<string>();
  return { dataset: data, classes, style: {}, textContent: text, classList: { add: (c) => classes.add(c) } };
}
function page(by: Record<string, El[]>) {
  return { querySelectorAll: (s: string) => by[s] ?? [], querySelector: (s: string) => (by[s] ?? [])[0] ?? null } as unknown as ParentNode;
}
const MSG = '.qm-thread > .qm-msg', BTN = 'form[data-form="reply"] button[type="submit"]', YOU = '#ua-log > .ua-msg.you';

describe('send animations', () => {
  beforeEach(() => resetSendFx());

  it('shows Sending… on the reply button, then slides the new message in', () => {
    const old = el({ msg: 'm1' }), btn = el({}, 'Send reply');
    markSend(page({ [MSG]: [old] }), 'reply');
    applySendFx(page({ [MSG]: [old], [BTN]: [btn] }), true, 0);
    expect(btn.textContent).toBe('Sending…');
    expect(btn.classes.has('sending')).toBe(true);

    const mine = el({ msg: 'm2' }), again = el({ msg: 'm2' });
    applySendFx(page({ [MSG]: [old, mine] }), false, 1000);
    expect(mine.classes.has('send-in')).toBe(true);
    expect(old.classes.has('send-in')).toBe(false);
    // a redraw mid-animation continues it rather than starting over
    applySendFx(page({ [MSG]: [el({ msg: 'm1' }), again] }), false, 1100);
    expect(again.style.animationDelay).toBe('-100ms');
    const late = el({ msg: 'm2' });
    applySendFx(page({ [MSG]: [late] }), false, 1000 + SEND_IN_MS);
    expect(late.classes.size).toBe(0);
  });

  it('blanks the reply box while it sends, and gives it back if the email never goes out', () => {
    const form = el();
    markSend(page({ [MSG]: [] }), 'reply');
    applySendFx(page({ [MSG]: [], ['form[data-form="reply"]']: [form] }), true, 0);
    expect(form.classes.has('mail-gone')).toBe(true);
    const again = el();
    applySendFx(page({ [MSG]: [], ['form[data-form="reply"]']: [again] }), false, 50);
    expect(again.classes.has('mail-gone')).toBe(false);
  });

  it('a new email waits with Sending…, then slides in at the top of Sent', () => {
    const FORM = 'form[data-form="mail"]', SEND = 'form[data-form="mail"] button[type="submit"]', TOP = '.qm-list > .qm-item:first-child';
    const form = el(), btn = el({}, 'Send');
    markSend(page({}), 'mail');
    applySendFx(page({ [FORM]: [form], [SEND]: [btn] }), true, 0);
    expect(btn.textContent).toBe('Sending…');
    expect(form.classes.has('mail-gone')).toBe(true);
    // the send settles on the compose page first, then the game goes to Sent
    applySendFx(page({ [FORM]: [el()] }), false, 400);
    sendLanded();
    const top: El & { querySelector?: unknown } = el();
    top.querySelector = () => ({ dataset: { nav: 'qmail.com/m/s1' } });
    applySendFx(page({ [TOP]: [top] }), false, 500);
    expect(top.classes.has('send-in')).toBe(true);
  });

  it('animates the prompt bubble straight away', () => {
    markSend(page({ [YOU]: [el()] }), 'prompt');
    const bubble = el();
    applySendFx(page({ [YOU]: [el(), bubble] }), true, 0);
    expect(bubble.classes.has('send-in')).toBe(true);
  });

  it('drops the effect when the send never lands', () => {
    markSend(page({ [MSG]: [] }), 'reply');
    applySendFx(page({ [MSG]: [] }), false, 0);
    const btn = el({}, 'Send reply');
    applySendFx(page({ [MSG]: [el({ msg: 'm9' })], [BTN]: [btn] }), true, 10);
    expect(btn.textContent).toBe('Send reply');
  });
});
