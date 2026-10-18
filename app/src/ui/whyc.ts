/*
 * whycombinator.com: the front page (the batch counter and the Apply button), Requests for
 * Startups, the deal, the batch list and the free Startup School. WorkAgent isn't in the batch;
 * Logan is on the Startup School page, with the other several hundred thousand alumni.
 */
import { WHYC_BATCH } from '../engine';
import { WHYC_MARK } from '../sites/investorLogos';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const WHYC_ICON = WHYC_MARK;

const PAGES: [slug: string, label: string][] = [
  ['', 'Home'], ['rfs', 'Requests for Startups'], ['deal', 'The deal'], ['companies', 'Companies'], ['startup-school', 'Startup School'],
];

const RFS: [string, string][] = [
  ['AI agents that replace the founders we fund', 'Founders are the most expensive part of a startup. We would like to fund fewer of them.'],
  ['Agents for agents', 'Most software users will soon be agents. They need payroll, HR and somewhere to complain.'],
  ['Vertical AI for every job that still has a person in it', 'Pick a job. Find out who does it. Build the agent that does it instead.'],
  ['Compliance for the unemployed', 'Form 7B takes nine days. Somebody should be charging for that.'],
  ['Housing', 'Rent pricing, tenant screening and building management, without the building manager.'],
];

const COMPANIES: [string, string][] = [
  ['Clerk Zero', 'An agent that runs your accounts payable department. Formerly your accounts payable department.'],
  ['Handover', 'Records how your employees do their jobs, for training purposes.'],
  ['Tenantly', 'Rent pricing for landlords, updated hourly.'],
  ['Notary.ai', 'Notarizes documents written by agents, for agents.'],
  ['Shiftless', 'Scheduling for workforces with no workers.'],
  ['Exit Interview', 'Conducts exit interviews at scale.'],
  ['Bunkr', 'Bunk beds in San Fortuna, by the month.'],
  ['Cofounder', 'An agent that is your cofounder. Takes 30% equity.'],
  ['Griefwell', 'Condolence messages written in the voice of the deceased.'],
  ['Placeholder Labs', 'Stealth.'],
];

const ALUMNI: [string, string][] = [
  ['Logan Pryce', 'WorkAgent · San Fortuna'],
  ['Priya Raman', 'Unnamed · Lisbon'],
  ['Tom Hecht', 'Hecht Holdings · Denver'],
  ['Dana Okafor', 'Stealth · San Fortuna'],
  ['Jules Marten', 'Agent for agents · Berlin'],
];

function home(notice: string): string {
  return `<section class="wc-hero">
      <h1>Make something agents want.</h1>
      <p class="wc-lead">Why Combinator invests in early-stage startups twice a year. Applications for Batch ${WHYC_BATCH} are open.</p>
      <div class="wc-stats"><div><b>Batch ${WHYC_BATCH}</b><span>now in session</span></div><div><b>412</b><span>companies</span></div><div><b>9</b><span>humans</span></div></div>
      <div class="wc-apply"><button type="button" class="wc-btn" data-act="whyc-apply">Apply to ${WHYC_BATCH}</button>${notice ? `<p class="wc-notice" role="status">${esc(notice)}</p>` : ''}</div>
    </section>`;
}

function rfs(): string {
  return `<h1>Requests for Startups</h1>
    <p class="wc-lead">Ideas we would like to fund. You don't need to work on one of these to apply.</p>
    <ol class="wc-list">${RFS.map(([h, p]) => `<li><b>${esc(h)}</b><p>${esc(p)}</p></li>`).join('')}</ol>`;
}

function deal(): string {
  return `<h1>The deal</h1>
    <p class="wc-lead">The same deal for every company we fund.</p>
    <div class="wc-stats"><div><b>500K DOLR</b><span>investment</span></div><div><b>7%</b><span>equity</span></div><div><b>1</b><span>hoodie</span></div></div>
    <p>Three months in San Fortuna, office hours with a partner, and Demo Day. Partners are available for office hours around the clock. Most of them are agents.</p>`;
}

function companies(): string {
  return `<h1>Companies</h1>
    <p class="wc-lead">Batch ${WHYC_BATCH}. Showing ${COMPANIES.length} of 412.</p>
    <ul class="wc-cos">${COMPANIES.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join('')}</ul>`;
}

function school(): string {
  return `<h1>Startup School</h1>
    <p class="wc-lead">Free, online and self-paced. Startup School is not Why Combinator, and completing it is not an investment.</p>
    <div class="wc-stats"><div><b>1.2M</b><span>alumni</span></div><div><b>0 DOLR</b><span>cost</span></div></div>
    <h2>Recent alumni</h2>
    <ul class="wc-cos">${ALUMNI.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join('')}</ul>`;
}

export function pageWhyC(param: string | undefined, notice = ''): string {
  const slug = param ?? '';
  const main = slug === '' ? home(notice) : slug === 'rfs' ? rfs() : slug === 'deal' ? deal() : slug === 'companies' ? companies() : slug === 'startup-school' ? school() : '<h1>Page not found</h1>';
  const nav = PAGES.map(([p, l]) => `<a href="#" data-nav="whycombinator.com${p ? `/${p}` : ''}"${p === slug ? ' class="on"' : ''}>${esc(l)}</a>`).join('');
  return `<div class="wc">
    <header class="wc-top"><a href="#" class="wc-brand" data-nav="whycombinator.com"><span class="wc-mark">${WHYC_MARK}</span>Why Combinator</a><nav class="wc-nav">${nav}</nav></header>
    <main class="wc-main">${main}</main>
    <footer class="wc-foot">© 2030 Why Combinator · whycombinator.com</footer>
  </div>`;
}
