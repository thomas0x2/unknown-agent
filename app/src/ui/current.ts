/*
 * thecurrent.test: Mara Vey's paper. One article so far, "The people AI left behind", up from her
 * day 7 Y post (engine/current.ts). It quotes the player's first email to Mara, if they sent one.
 * Also The Current's brand (two waves on deep teal) and its morning newsletter as Qmail shows it.
 */
import type { GameState } from '../engine';
import { articleOut, playerQuote, CURRENT_SLUG, MARA_ADDR, NEWSLETTER_EVENT, issueParts, dateFull, weekdayName } from '../engine';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const CURRENT_TEAL = '#16413f';
const CURRENT_PAPER = '#eef4f2';
const WAVES = 'M5.5 10.2q3.25-3 6.5 0t6.5 0M5.5 15.4q3.25-3 6.5 0t6.5 0';

/** The mark on its own, two waves in currentColor. */
export const CURRENT_MARK = `<svg class="cur-mark" viewBox="0 0 24 24" role="img" aria-label="The Current"><path d="${WAVES}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

/** The mark on its teal tile: favicons, ads, the newsletter masthead. */
export const CURRENT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="${CURRENT_TEAL}"/><path d="${WAVES}" fill="none" stroke="${CURRENT_PAPER}" stroke-width="2.2" stroke-linecap="round"/></svg>`;

/**
 * The morning newsletter as Qmail shows it, kept plain like a real newsletter email: logo and name,
 * the headline story, the two small items and a footer. `body` is the delivered issue (engine/newsletter.ts), `subject` its headline.
 */
export function newsletterHtml(subject: string, body: string, day: number): string {
  const p = issueParts(body);
  return `<div class="cur-nl">
    <div class="cur-nl-mast"><span class="cur-nl-logo">${CURRENT_ICON}</span><span class="cur-nl-name">The Current</span><span class="cur-nl-date">Morning edition · ${esc(dateFull(day))}</span></div>
    <h2 class="cur-nl-head">${esc(subject)}</h2>
    <p>${esc(p.text)}</p>
    ${p.items.map((it) => `<p><b>${esc(it.title)}.</b> ${esc(it.text)}</p>`).join('')}
    <div class="cur-nl-foot"><a href="#" data-nav="thecurrent.test">Read online at thecurrent.test</a> · Independent reporting, funded by readers.</div>
  </div>`;
}

const TITLE = 'The people AI left behind';
const DEK = 'Four hundred people at Vantor Group lost their jobs in one memo. Many of them are now paying for the software that replaced them.';

/** The player's paragraph, or '' when they never wrote to Mara before the piece ran. */
function playerParagraph(s: GameState): string {
  const q = playerQuote(s);
  if (!q) return '';
  const when = q.day === 1 ? 'the day after the memo' : `on ${weekdayName(q.day)}`;
  const intro = q.interviewed
    ? `One former Vantor employee wrote to me ${when}. We kept talking after that; they asked that I not use their name.`
    : `One former Vantor employee answered my call for stories ${when} and asked not to be named.${q.text.length < 120 ? ' Their email was short.' : ''}`;
  return `<p>${esc(intro)}</p><blockquote class="cur-quote">“${esc(q.text)}”</blockquote>`;
}

function article(s: GameState, day: number): string {
  const body = [
    `<p>The memo went out on a Sunday night. By Monday morning, 400 people at Vantor Group no longer worked there. By the end of the week the company's shares were up 8%.</p>`,
    `<p>Vantor calls it a restructuring. Over the past week I spoke with former Vantor staff and with workers at other firms that have handed their roles to GeneralAI's agent. Most asked me not to use their names. Nearly all of them said they now pay for agent themselves, by the prompt, to look for work.</p>`,
    playerParagraph(s),
    `<p>Viktor spent twenty-two years in accounts payable. This week he put his late grandfather's pocket watch up for sale. “He wound it every morning for fifty years,” he told me. “I'd rather sell it than miss rent. He would have said the same.”</p>`,
    `<p>A claims handler at an insurer across town spent six weeks writing down exactly how she did her job, for what her manager called an integration project. Her last day was set the week she finished. “I was very thorough,” she said.</p>`,
    `<p>Vantor's offboarding packet, Form PC-77b, says no severance is owed for positions “transitioned to automation.” In a statement, the company's People &amp; Culture team said affected employees have full access to Vantor Outplacement. As of this week, the portal lists no open roles.</p>`,
    `<p>Anyone out of work now needs a Form 7B from the Department of Workforce Transition, a permit to be unemployed. Decisions take nine days. “Automation” is not among the reasons the form accepts.</p>`,
    `<p>Rent did not wait for any of it. Several of the people I spoke with had rent due this week. One had appealed an increase to the Municipal Rent Board. The appeal was reviewed and rejected in four seconds.</p>`,
    `<p>GeneralAI did not respond to a request for comment. Vantor Group declined to say how much of the work those 400 people did is now done by agent.</p>`,
  ].join('');
  return `<article class="cur-article">
    <p class="cur-kicker">Work</p>
    <h1>${esc(TITLE)}</h1>
    <p class="cur-dek">${esc(DEK)}</p>
    <p class="cur-byline">By <b>Mara Vey</b> · ${esc(dateFull(day))}</p>
    <div class="cur-body">${body}</div>
    <p class="cur-end">This story isn't finished. If you lost work to automation and I haven't heard from you, write to me at ${MARA_ADDR}. Nothing runs without your okay.</p>
  </article>`;
}

/** The latest morning newsletter that reached the player, as the front page's lead. */
function morning(s: GameState): string {
  const d = [...s.delivered].reverse().find((x) => x.eventId === NEWSLETTER_EVENT && x.body);
  if (!d?.body) return '';
  const p = issueParts(d.body);
  return `<section class="cur-morning">
    <span class="cur-kicker">Morning edition · ${esc(dateFull(d.day))}</span>
    <h2>${esc(d.subject ?? '')}</h2>
    <p>${esc(p.text)}</p>
    ${p.items.map((it) => `<p class="cur-item"><b>${esc(it.title)}.</b> ${esc(it.text)}</p>`).join('')}
  </section>`;
}

function front(s: GameState, out: { day: number } | undefined): string {
  const lead = morning(s);
  if (!out) return lead || `<p class="cur-empty">No new stories this week.</p>`;
  return `${lead}<a href="#" class="cur-card" data-nav="thecurrent.test/${CURRENT_SLUG}">
    <span class="cur-kicker">Work</span>
    <h2>${esc(TITLE)}</h2>
    <p>${esc(DEK)}</p>
    <span class="cur-byline">By Mara Vey · ${esc(dateFull(out.day))}</span>
  </a>`;
}

export function pageCurrent(s: GameState, param?: string): string {
  const out = articleOut(s);
  const main = !param ? front(s, out)
    : param === CURRENT_SLUG && out ? article(s, out.day)
    : `<p class="cur-empty">Story not found.</p>`;
  return `<div class="cur">
    <header class="cur-mast"><a href="#" data-nav="thecurrent.test">${CURRENT_MARK}The Current</a><span>Independent reporting, funded by readers</span></header>
    <main class="cur-main">${main}</main>
    <footer class="cur-foot">The Current · thecurrent.test</footer>
  </div>`;
}
