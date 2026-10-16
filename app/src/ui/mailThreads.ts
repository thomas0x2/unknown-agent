/*
 * Qmail conversations, Gmail style: an email, its replies and any bounce notices belong to one thread
 * when they're with the same person and share a subject once "RE:" and the like are stripped.
 */
export interface ThreadRow {
  id: string;
  seq: number;
  day: number;
  folder: 'inbox' | 'sent';
  subject: string;
  /** Sender address (the player's own for sent mail). */
  addr: string;
  /** Recipient, for sent mail. */
  to?: string;
  /** For a bounce notice, the address the player's email failed to reach. */
  bounceOf?: string;
}

export interface Thread<R extends ThreadRow> {
  key: string;
  /** The person on the other side of the conversation. */
  with: string;
  /** Oldest first. */
  rows: R[];
}

/** The subject without reply, forward and bounce prefixes, for matching. */
export const baseSubject = (subject: string) =>
  subject.replace(/^\s*((re|fwd?|aw|undeliverable)\s*:\s*)+/i, '').trim() || '(no subject)';

/** Who the player is talking to in this email. */
export const counterpart = (r: ThreadRow) => (r.folder === 'sent' ? r.to ?? '' : r.bounceOf ?? r.addr).toLowerCase();

export const threadKey = (r: ThreadRow) => `${counterpart(r)}|${baseSubject(r.subject).toLowerCase()}`;

const byArrival = (a: ThreadRow, b: ThreadRow) => a.day - b.day || a.seq - b.seq;

/** Group emails into conversations, the most recently active first. */
export function groupThreads<R extends ThreadRow>(rows: R[]): Thread<R>[] {
  const map = new Map<string, Thread<R>>();
  for (const r of [...rows].sort(byArrival)) {
    const key = threadKey(r);
    let t = map.get(key);
    if (!t) map.set(key, (t = { key, with: counterpart(r), rows: [] }));
    t.rows.push(r);
  }
  const last = (t: Thread<R>) => t.rows[t.rows.length - 1];
  return [...map.values()].sort((a, b) => byArrival(last(b), last(a)));
}
