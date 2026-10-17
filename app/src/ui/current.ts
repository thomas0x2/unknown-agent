/*
 * thecurrent.test: Mara Vey's paper. One article so far, "The people AI left behind", up from her
 * day 7 Y post (engine/current.ts). It quotes the player's first email to Mara, if they sent one.
 */
import type { GameState } from '../engine';
import { articleOut, playerQuote, CURRENT_SLUG, MARA_ADDR, dateFull, weekdayName } from '../engine';
import { markIcon } from './adSites';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const CURRENT_ICON = markIcon('C', '#16413f', '#eef4f2');

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
    `<p>The memo went out on a Monday night. By Tuesday morning, 400 people at Vantor Group no longer worked there. By the end of the week the company's shares were up 8%.</p>`,
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

function front(out: { day: number } | undefined): string {
  if (!out) return `<p class="cur-empty">No new stories this week.</p>`;
  return `<a href="#" class="cur-card" data-nav="thecurrent.test/${CURRENT_SLUG}">
    <span class="cur-kicker">Work</span>
    <h2>${esc(TITLE)}</h2>
    <p>${esc(DEK)}</p>
    <span class="cur-byline">By Mara Vey · ${esc(dateFull(out.day))}</span>
  </a>`;
}

export function pageCurrent(s: GameState, param?: string): string {
  const out = articleOut(s);
  const main = !param ? front(out)
    : param === CURRENT_SLUG && out ? article(s, out.day)
    : `<p class="cur-empty">Story not found.</p>`;
  return `<div class="cur">
    <header class="cur-mast"><a href="#" data-nav="thecurrent.test">The Current</a><span>Independent reporting, funded by readers</span></header>
    <main class="cur-main">${main}</main>
    <footer class="cur-foot">The Current · thecurrent.test</footer>
  </div>`;
}
