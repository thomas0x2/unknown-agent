/*
 * Qmail: inbox rows and the mail page.
 */
import { GameStore } from '../../game/store';
import { MISSES } from '../../game/misses';
import { ICONS } from '../icons';
import { type GameState, type MailEntry, dateShort, BOUNCE_ADDR, eventBody, deliveryKey, deliveryCc } from '../../engine';
import { isVantorAddr, vantorSignature } from '../vantor';
import { adHtml } from '../ads';
import { groupThreads, baseSubject } from '../mailThreads';
import { inBin, isDeleted } from '../../engine';
import { devOptionsButton, devOptionsPanel } from '../devOptions';
import { PLAYER, br, esc, fmtClock, linkify, tpl } from './common';

export function qmailBadge(store: GameStore): number {
  return mailRows(store).filter((r) => r.folder === 'inbox' && r.unread && !r.binned).length;
}

// ── Qmail ──

/** Dev-mode label under an email that came from a script rather than Haiku. */
const SCRIPTED_MAIL: Record<NonNullable<MailEntry['scripted']>, string> = {
  hint: 'Scripted hint (Jev read a near miss)',
  outcome: 'Scripted storyline outcome',
  topic: 'Scripted topic reply',
};

interface Row { id: string; seq: number; /** Minutes since midnight it arrived, when known. */ min?: number; from: string; addr: string; subject: string; body: string; day: number; unread: boolean; needsReply: boolean; folder: 'inbox' | 'sent'; eventId?: string; generated?: boolean; scripted?: MailEntry['scripted']; to?: string; link?: string; bounceOf?: string; /** Other recipients in CC. */ cc?: string[]; /** In the Bin until the day ends. */ binned?: boolean }

/** Messages the player opened or closed in a conversation, so a repaint keeps them that way. */
export const mailOpen = new Map<string, boolean>();

export function mailRows(store: GameStore): Row[] {
  const s = store.state;
  const rows: Row[] = [];
  for (const d of s.delivered.filter((x) => x.site === 'qmail')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    // A latent lead is never received on its own: its brief arrives inside the reply mail, so the reply
    // stands in for it (and stays hidden while that reply is on its way). Any other story email stays
    // in the inbox after it's answered.
    if (e.latent && (s.mail.some((m) => m.eventId === e.id && m.folder === 'inbox') || s.pendingMail?.some((p) => p.mail.eventId === e.id))) continue;
    const canReply = !!(e.outcomes && !d.answered);
    const key = deliveryKey(e, d.day);
    const id = 'e/' + key;
    if (isDeleted(s, id)) continue;
    rows.push({ id, binned: inBin(s, id), seq: d.seq ?? -1, min: d.min, from: e.from ?? 'Unknown', addr: e.addr ?? '', subject: e.subject ?? '', body: tpl(d.body ?? eventBody(e, d.day)), day: d.day, unread: !s.readEvents.includes(key), needsReply: canReply, folder: 'inbox', eventId: e.id, cc: deliveryCc(e, d) });
  }
  for (const m of s.mail) if (!isDeleted(s, 'm/' + m.id)) rows.push({ id: 'm/' + m.id, binned: inBin(s, 'm/' + m.id), seq: m.seq ?? (Number(m.id.replace(/\D/g, '')) || 0), min: m.min, from: m.from, addr: m.addr, subject: m.subject, body: m.body, day: m.day, unread: m.folder === 'inbox' && !m.read, needsReply: false, folder: m.folder, eventId: m.eventId, generated: m.generated, scripted: m.scripted, to: m.to, link: m.link, bounceOf: m.bounceOf });
  return rows;
}

/** Today's mail shows the time it came in, older mail its date. */
const mailTime = (s: GameState, r: { day: number; min?: number }) => (r.day === s.values.day && r.min != null ? fmtClock(r.min) : dateShort(r.day));

export function pageMail(store: GameStore, param?: string): string {
  const s = store.state;
  const view = param === 'sent' ? 'sent' : param === 'bin' ? 'bin' : param === 'compose' ? 'compose' : param?.startsWith('m/') || param?.startsWith('e/') ? 'msg' : 'inbox';
  const unread = qmailBadge(store);
  const rows = mailRows(store);
  const side = `<nav class="qm-side" aria-label="Folders">
    <a href="#" class="qm-new" data-nav="qmail.com/compose">Compose</a>
    <a href="#" data-nav="qmail.com" class="${view === 'inbox' ? 'on' : ''}">Inbox${unread ? `<b>${unread}</b>` : ''}</a>
    <a href="#" data-nav="qmail.com/sent" class="${view === 'sent' ? 'on' : ''}">Sent</a>
    <a href="#" data-nav="qmail.com/bin" class="${view === 'bin' ? 'on' : ''}">Bin</a>
    ${adHtml('qmail', s.values.day, 'square')}
  </nav>`;
  let main: string;
  if (view === 'compose') {
    const d = store.ui.draft || { to: '', subject: '', body: '' };
    // only people the player has already exchanged mail with; a first message is always typed by hand
    const known = new Map<string, string>();
    for (const r of rows) {
      const addr = r.folder === 'sent' ? r.to : r.addr;
      if (!addr || addr === PLAYER.addr || addr === BOUNCE_ADDR) continue;
      const name = r.folder === 'inbox' ? r.from : store.content.contacts.find((c) => c.key === addr)?.name;
      if (!known.has(addr) || (name && known.get(addr) === addr)) known.set(addr, name || addr);
    }
    const contacts = [...known].map(([addr, name]) => ({ addr, name }));
    main = `<form class="qm-compose" data-form="mail">
      <h1 class="qm-h">New message</h1>
      <div class="qm-to"><label class="qm-field"><span>To</span><input id="mail-to" autocomplete="off" spellcheck="false" value="${esc(d.to)}" placeholder="name@example.com" role="combobox" aria-autocomplete="list" aria-controls="qm-sugg" aria-expanded="false"></label>
        <ul id="qm-sugg" class="qm-sugg" role="listbox" hidden data-contacts="${esc(JSON.stringify(contacts))}"></ul></div>
      <label class="qm-field"><span>Subject</span><input id="mail-subject" autocomplete="off" value="${esc(d.subject)}"></label>
      <textarea id="mail-body" rows="10" aria-label="Message">${esc(d.body)}</textarea>
      <div class="qm-actions"><button class="qm-btn" type="submit">Send</button><button class="qm-btn ghost" type="button" data-mail-discard>Discard</button>${store.ui.mailError ? `<span class="qm-hint qm-err" role="alert">${esc(store.ui.mailError)}</span>` : '<span class="qm-hint">Free. One email per person per day.</span>'}</div>
    </form>`;
  } else if (view === 'msg') {
    const row = rows.find((x) => x.id === param);
    if (!row) main = `<p class="qm-empty">This message doesn't exist.</p>`;
    else {
      // the whole conversation, oldest first; what came in since the player last wrote starts expanded
      // binned emails form their own conversation, apart from anything in the same thread that isn't
      const thread = groupThreads(rows.filter((r) => !!r.binned === !!row.binned)).find((t) => t.rows.includes(row))!;
      for (const r of thread.rows) if (r.unread) store.markReadMail(r.id);
      const lastSent = thread.rows.map((r) => r.folder).lastIndexOf('sent');
      const inSent = thread.rows.every((r) => r.folder === 'sent');
      const ids = esc(JSON.stringify(thread.rows.map((r) => r.id)));
      const home = row.binned ? 'qmail.com/bin' : inSent ? 'qmail.com/sent' : 'qmail.com';
      const tools = row.binned
        ? `<span class="qm-bin-note">In the Bin. Deleted when the day ends.</span><button class="qm-btn ghost" data-mail-restore="${ids}" data-mail-home="qmail.com/bin">Restore</button>`
        : `<button class="qm-btn ghost" data-mail-bin="${ids}" data-mail-home="${home}" title="Move to Bin">${ICONS.bin}Bin</button>`;
      // one reply box for the conversation: a story email still waiting on an answer gets it, otherwise
      // it's an ordinary email back to the person on the other side
      const open = [...thread.rows].reverse().find((r) => r.needsReply);
      const who = thread.with;
      const canReply = !!open || (!!who && who !== PLAYER.addr && who !== BOUNCE_ADDR);
      const target = open
        ? `data-id="${esc(open.eventId ?? '')}"`
        : `data-to="${esc(who)}" data-subject="${esc('Re: ' + baseSubject(thread.rows[0].subject))}"`;
      const replyName = open?.from ?? [...thread.rows].reverse().find((r) => r.folder === 'inbox' && r.addr === who)?.from ?? who;
      const msgs = thread.rows.map((r, i) => {
        const expanded = mailOpen.get(r.id) ?? (i === thread.rows.length - 1 || (i > lastSent && r.folder === 'inbox'));
        const meta = r.folder === 'sent'
          ? `<b>${esc(PLAYER.name)}</b> &lt;${esc(PLAYER.addr)}&gt; to <b>${esc(r.to ?? '')}</b>`
          : `<b>${esc(r.from)}</b> &lt;${esc(r.addr)}&gt; to ${esc(PLAYER.addr)}`;
        return `<details class="qm-msg" data-msg="${esc(r.id)}"${expanded ? ' open' : ''}>
          <summary class="qm-meta"><span>${meta}<span class="qm-snip">${esc(r.body.replace(/\s+/g, ' ').slice(0, 90))}</span></span><span>${mailTime(s, r)}</span></summary>
          ${r.cc?.length ? `<p class="qm-cc">CC: ${esc(r.cc.join(', '))}</p>` : ''}<div class="qm-body">${linkify(br(r.body))}</div>
          ${r.folder !== 'sent' && isVantorAddr(r.addr) ? vantorSignature() : ''}
          ${r.generated ? `<p class="qm-gen">Reply written by ${esc(MISSES.label())}</p>` : r.scripted ? `<p class="qm-gen">${SCRIPTED_MAIL[r.scripted]}</p>` : ''}
        </details>`;
      }).join('');
      main = `<article class="qm-read">
        <div class="qm-tools"><p class="qm-crumbs"><a href="#" data-nav="${home}">${row.binned ? 'Bin' : inSent ? 'Sent' : 'Inbox'}</a></p>${tools}</div>
        <h1 class="qm-h">${esc(thread.rows[0].subject || '(no subject)')}${thread.rows.length > 1 ? ` <span class="qm-count">${thread.rows.length}</span>` : ''}</h1>
        <div class="qm-thread">${msgs}</div>
        ${canReply ? `<form class="qm-reply" data-form="reply" ${target}>
          <div class="qm-reply-head"><span class="qm-reply-to">Reply to <b>${esc(replyName)}</b></span><span class="qm-reply-hint">One email per person per day</span></div>
          <textarea id="reply-body" rows="3" placeholder="Write your reply…" ${store.busy ? 'disabled' : ''}></textarea>
          <div class="qm-reply-foot"><span class="qm-reply-cta">⏎ to send · ⇧⏎ for a new line</span><button class="qm-btn" type="submit" ${store.busy ? 'disabled' : ''}>Send reply</button></div>
        </form>` : ''}
      </article>`;
    }
  } else {
    // one row per conversation, the most recently active first
    const folder = view === 'sent' ? 'sent' : 'inbox';
    const binView = view === 'bin';
    const html = groupThreads(rows.filter((r) => !!r.binned === binView)).filter((t) => binView || t.rows.some((r) => r.folder === folder)).map((t) => {
      const last = t.rows[t.rows.length - 1];
      const unread = t.rows.some((r) => r.unread);
      const names = [...new Set(t.rows.filter((r) => r.addr !== BOUNCE_ADDR).map((r) => (r.folder === 'sent' ? 'me' : r.from)))];
      const who = folder === 'sent' || (binView && t.rows.every((r) => r.folder === 'sent')) ? `To: ${t.with}` : names.slice(-3).join(', ');
      const snippet = last.body.replace(/\s+/g, ' ').slice(0, 90);
      // the Bin (or Restore) button sits beside the row's link, over the date on hover, not inside it
      const ids = esc(JSON.stringify(t.rows.map((r) => r.id)));
      const home = binView ? 'qmail.com/bin' : folder === 'sent' ? 'qmail.com/sent' : 'qmail.com';
      const tool = binView
        ? `<button class="qm-row-tool" data-mail-restore="${ids}" data-mail-home="${home}" title="Restore" aria-label="Restore">${ICONS.restore}</button>`
        : `<button class="qm-row-tool" data-mail-bin="${ids}" data-mail-home="${home}" title="Move to Bin" aria-label="Move to Bin">${ICONS.bin}</button>`;
      return `<div class="qm-item"><a href="#" class="qm-row${unread ? ' unread' : ''}" data-nav="qmail.com/${esc(last.id)}">
        <span class="qm-from">${unread && folder === 'inbox' ? '<i class="qm-dot" aria-label="Unread"></i>' : ''}<span class="qm-names">${esc(who)}</span>${t.rows.length > 1 ? `<span class="qm-count">${t.rows.length}</span>` : ''}</span>
        <span class="qm-subj"><b>${esc(t.rows[0].subject)}</b>${snippet ? `<span class="qm-prev">${esc(snippet)}</span>` : ''}</span>
        <span class="qm-time">${mailTime(s, last)}</span></a>${tool}</div>`;
    }).join('');
    const n = store.ui.mailNotice;
    const notice = n ? `<p class="qm-notice" role="status">${esc(n.text)} <button class="qm-link" data-mail-undo>Undo</button></p>` : '';
    const title = binView ? 'Bin' : view === 'sent' ? 'Sent' : 'Inbox';
    const [emptyIcon, emptyTitle, emptyNote] = binView ? [ICONS.bin, 'The Bin is empty.', 'Emails you move to the Bin show up here.']
      : view === 'sent' ? [ICONS.sent, 'Nothing sent yet.', 'Emails you send show up here.']
      : [ICONS.inbox, 'No mail.', 'New emails show up here as they arrive.'];
    const empty = `<div class="qm-empty-state"><span class="qm-empty-ico">${emptyIcon}</span><p class="qm-empty-title">${emptyTitle}</p><p class="qm-empty-note">${emptyNote}</p></div>`;
    const binHint = binView ? `<p class="qm-bin-hint">Everything in the Bin is deleted when the day ends.</p>` : '';
    main = `<h1 class="qm-h">${title}</h1>${binHint}${notice}${adHtml('qmail', s.values.day, 'wide')}${html ? `<div class="qm-list">${html}</div>` : empty}`;
  }
  return `<div class="qm">
    <header class="qm-top"><div class="qm-logo">${ICONS.mail}<span>Qmail</span></div>${devOptionsButton(store, 'qmail')}<span class="qm-user">${esc(PLAYER.addr)}</span></header>
    <div class="qm-wrap">${side}<main class="qm-main">${main}</main></div>${devOptionsPanel(store, 'qmail')}</div>`;
}
