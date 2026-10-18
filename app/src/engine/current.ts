/*
 * The Current (thecurrent.test): Mara Vey's publication. Her day 7 piece, "The people AI left behind",
 * goes up with her Y post linking it (event d7_journalist_article). If the player emailed her before
 * it went up (her day 1 post asked for stories), the article quotes that first email, unnamed.
 */
import type { GameState } from './state';

export const CURRENT_SLUG = 'people-ai-left-behind';
/** The Y post that announces the article; the article is out once it is delivered. */
export const CURRENT_EVENT = 'd7_journalist_article';
export const MARA_ADDR = 'mara@thecurrent.test';
/** The morning newsletter (engine/newsletter.ts), whose latest issue leads the front page. */
export const NEWSLETTER_EVENT = 'current_newsletter';

/** When the article went up, or undefined while it's unpublished. */
export function articleOut(s: GameState): { day: number; min: number } | undefined {
  const d = s.delivered.find((x) => x.eventId === CURRENT_EVENT);
  return d && { day: d.day, min: d.min ?? 0 };
}

/** Longest quote the article runs, in characters; longer emails are cut at a sentence. */
const QUOTE_MAX = 320;

/** The email as a reporter would quote it: no greeting or sign-off, a few sentences at most. */
export function quoteFrom(body: string): string {
  let t = body.replace(/\r/g, '').trim();
  // a greeting line ("Hi Mara,") and a sign-off ("Thanks, ...") aren't part of the story
  t = t.replace(/^(hi|hey|hello|dear|good (morning|afternoon|evening))\b[^\n.!?]{0,30}[,!.:]?\s*/i, '');
  t = t.replace(/\n+\s*(thanks|thank you|best|regards|cheers|sincerely)\b[\s\S]*$/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length <= QUOTE_MAX) return t;
  const sentences = t.match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? [];
  let out = '';
  for (const sn of sentences) {
    if ((out + sn).length > QUOTE_MAX) break;
    out += sn;
  }
  out = out.trim();
  // no sentence break early enough: cut at a word and trail off
  return out || `${t.slice(0, QUOTE_MAX).replace(/\s+\S*$/, '')}…`;
}

export interface PlayerQuote {
  text: string;
  /** Day the player's email went out. */
  day: number;
  /** Mara got a real interview out of it (the honest outcome), not just a short answer. */
  interviewed: boolean;
}

/** The player's first email to Mara sent before the article went up, quoted; undefined if there was none. */
export function playerQuote(s: GameState): PlayerQuote | undefined {
  const out = articleOut(s);
  if (!out) return undefined;
  const before = (day: number, min?: number) => day < out.day || (day === out.day && (min ?? 0) < out.min);
  const mail = s.mail.find((m) => m.folder === 'sent' && (m.to ?? '').trim().toLowerCase() === MARA_ADDR && before(m.day, m.min));
  if (!mail) return undefined;
  const text = quoteFrom(mail.body);
  if (!text) return undefined;
  return { text, day: mail.day, interviewed: s.flags.includes('did_journalist_interview') };
}
