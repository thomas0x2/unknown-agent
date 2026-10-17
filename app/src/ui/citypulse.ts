/*
 * citypulse.news: the local news site. The front page lists every article published so far, newest
 * first (engine/citypulse.ts holds the timing); citypulse.news/<slug> opens one. Each article is
 * headed by a small drawing chosen by its `art`. It's a tabloid: everything from today is BREAKING.
 */
import type { GameStore } from '../game/store';
import { liveArticles, findArticle, articleLive, articleMin, clockTime, dateShort, weekdayShort, dateFull, type Article } from '../engine';
import { adHtml } from './ads';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));


/** "Today, 4:55 PM" for today's articles, "Thu, Oct 10" for older ones. */
function when(a: Article, today: number): string {
  return a.day === today ? `Today, ${clockTime(articleMin(a))}` : `${weekdayShort(a.day)}, ${dateShort(a.day)}`;
}

// ── drawings: 320×180, flat shapes on a tinted ground ──
const ART: Record<string, [ground: string, shapes: string]> = {
  office: ['#e9e4da', '<rect x="40" y="118" width="240" height="10" fill="#7a6a55"/><rect x="60" y="128" width="8" height="40" fill="#7a6a55"/><rect x="252" y="128" width="8" height="40" fill="#7a6a55"/><path d="M120 78h80l-6 40h-68z" fill="#b98b55"/><path d="M120 78l-14-14h80l14 14z" fill="#cfa06a"/><rect x="138" y="58" width="10" height="26" fill="#3c6e91"/><circle cx="170" cy="66" r="10" fill="#4f8a4a"/><rect x="166" y="70" width="8" height="14" fill="#8a5a3a"/><rect x="210" y="92" width="44" height="26" rx="3" fill="#2b2b2b"/><rect x="214" y="96" width="36" height="18" fill="#9fb6c9"/>'],
  server: ['#dfe6ec', '<rect x="110" y="30" width="100" height="130" rx="6" fill="#2a2f36"/>' + [0, 1, 2, 3, 4].map((i) => `<rect x="120" y="${42 + i * 23}" width="80" height="16" rx="2" fill="#3c434c"/><circle cx="130" cy="${50 + i * 23}" r="3" fill="${i === 2 ? '#e0453a' : '#5fd17a'}"/><rect x="142" y="${48 + i * 23}" width="48" height="4" fill="#59616b"/>`).join('')],
  ballot: ['#e6e9f0', '<rect x="105" y="80" width="110" height="80" rx="4" fill="#24406b"/><rect x="140" y="80" width="40" height="6" fill="#0f1f38"/><path d="M146 30h40v56h-40z" fill="#fff" stroke="#c9ced8"/><path d="M154 44h24M154 54h24M154 64h16" stroke="#aab2c0" stroke-width="3"/><path d="M152 70l6 6 12-14" stroke="#c4312b" stroke-width="4" fill="none"/><text x="160" y="128" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="16" fill="#fff">VOTE</text>'],
  podium: ['#ece6dc', '<path d="M120 100h80l-10 66h-60z" fill="#8a2a24"/><rect x="114" y="92" width="92" height="12" fill="#6e211c"/><circle cx="160" cy="118" r="10" fill="#fff"/><path d="M155 118l4 4 7-8" stroke="#8a2a24" stroke-width="3" fill="none"/><path d="M160 92V66" stroke="#333" stroke-width="3"/><rect x="155" y="56" width="10" height="14" rx="5" fill="#333"/><path d="M60 40v120M260 40v120" stroke="#666" stroke-width="3"/><path d="M60 42h44v28H60zM216 42h44v28h-44z" fill="#b5322b"/><path d="M60 52h44M60 62h44M216 52h44M216 62h44" stroke="#fff" stroke-width="3"/>'],
  'chart-up': ['#e3eee6', '<path d="M40 150h240M40 30v120" stroke="#9aa79f" stroke-width="2"/><path d="M50 132l40-18 30 10 36-34 30 12 40-46 34-16" stroke="#1f8a4c" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M248 40h22v22" stroke="#1f8a4c" stroke-width="5" fill="none"/>'],
  'chart-down': ['#f0e3e2', '<path d="M40 150h240M40 30v120" stroke="#a99c9b" stroke-width="2"/><path d="M50 48l40 18 30-10 36 34 30-12 40 46 34 16" stroke="#b5322b" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M248 140h22v-22" stroke="#b5322b" stroke-width="5" fill="none"/>'],
  robot: ['#f3e5e2', '<path d="M40 160h240" stroke="#b9a9a5" stroke-width="2"/><rect x="118" y="70" width="84" height="66" rx="10" fill="#f4f4f4" stroke="#c9c9c9" stroke-width="2"/><rect x="118" y="70" width="84" height="18" rx="9" fill="#eb1700"/><rect x="132" y="96" width="56" height="16" rx="8" fill="#222"/><circle cx="148" cy="104" r="4" fill="#7ee0ff"/><circle cx="172" cy="104" r="4" fill="#7ee0ff"/>' + [130, 160, 190].map((x) => `<circle cx="${x}" cy="146" r="10" fill="#333"/><circle cx="${x}" cy="146" r="4" fill="#888"/>`).join('') + '<path d="M196 70V30" stroke="#555" stroke-width="2"/><path d="M196 30h26l-6 7 6 7h-26z" fill="#eb1700"/>'],
  washer: ['#e2ebf4', '<rect x="110" y="30" width="100" height="130" rx="8" fill="#f7f7f7" stroke="#c4ccd6" stroke-width="2"/><rect x="110" y="30" width="100" height="24" rx="8" fill="#dfe5ec"/><circle cx="126" cy="42" r="5" fill="#9aa6b4"/><circle cx="142" cy="42" r="5" fill="#9aa6b4"/><circle cx="160" cy="104" r="36" fill="#2c4a66"/><circle cx="160" cy="104" r="28" fill="#5f8fbf"/><path d="M136 112q12-12 24 0t24 0" stroke="#bcd6ef" stroke-width="4" fill="none"/><text x="194" y="47" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#c4312b">3</text>'],
  candle: ['#2a2733', '<rect x="110" y="96" width="22" height="60" fill="#efe6d4"/><rect x="150" y="80" width="22" height="76" fill="#efe6d4"/><rect x="190" y="104" width="22" height="52" fill="#efe6d4"/><path d="M121 96v-8M161 80v-8M201 104v-8" stroke="#333" stroke-width="2"/><path d="M121 70q8 10 0 18q-8-8 0-18zM161 54q8 10 0 18q-8-8 0-18zM201 78q8 10 0 18q-8-8 0-18z" fill="#ffc35a"/><circle cx="161" cy="66" r="26" fill="#ffc35a" opacity=".12"/>'],
  building: ['#e7e3dd', '<rect x="100" y="34" width="120" height="130" fill="#8c8478"/>' + [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${112 + c * 26}" y="${44 + r * 22}" width="16" height="14" fill="${(r + c) % 3 ? '#d9d1c2' : '#f2d27a'}"/>`).join('')).join('') + '<rect x="148" y="146" width="24" height="18" fill="#4e463c"/>'],
  check: ['#e4e9f2', '<circle cx="160" cy="92" r="52" fill="#1d9bf0"/><path d="M134 92l18 18 34-36" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
  phone: ['#ebe7f0', '<rect x="128" y="22" width="64" height="140" rx="10" fill="#222"/><rect x="134" y="34" width="52" height="112" fill="#fafafa"/>' + [0, 1, 2, 3].map((i) => `<circle cx="143" cy="${48 + i * 26}" r="5" fill="#c9c2d6"/><rect x="152" y="${44 + i * 26}" width="28" height="4" fill="#b4adc2"/><rect x="152" y="${51 + i * 26}" width="20" height="3" fill="#d6d1df"/>`).join('')],
  rocket: ['#dfe8f3', '<path d="M160 22c18 18 22 48 22 78h-44c0-30 4-60 22-78z" fill="#f3f3f3" stroke="#b9c3cf" stroke-width="2"/><circle cx="160" cy="64" r="9" fill="#5b8cc4"/><path d="M138 100l-16 22h16zM182 100l16 22h-16z" fill="#c4312b"/><path d="M146 104h28l-6 18h-16z" fill="#777"/><path d="M150 124q10 40 10 40q0 0 10-40z" fill="#ff9f3a"/><circle cx="96" cy="150" r="5" fill="#9aa6b4"/><circle cx="226" cy="136" r="4" fill="#9aa6b4"/><circle cx="240" cy="156" r="3" fill="#9aa6b4"/>'],
  gavel: ['#ece5da', '<rect x="90" y="140" width="140" height="14" rx="3" fill="#6b4a2e"/><g transform="rotate(-30 170 80)"><rect x="130" y="60" width="80" height="34" rx="6" fill="#7a5233"/><rect x="164" y="94" width="12" height="70" rx="4" fill="#8f6440"/></g>'],
};

function art(kind: string, cls: string): string {
  const [ground, shapes] = ART[kind] ?? ART.office;
  return `<svg class="${cls}" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="180" fill="${ground}"/>${shapes}</svg>`;
}

function masthead(day: number): string {
  return `<header class="cp-top">
    <a href="#" class="cp-logo" data-nav="citypulse.news"><span class="cp-mark" aria-hidden="true">CP</span>CityPulse</a>
    <span class="cp-date">${esc(dateFull(day))}</span>
  </header>`;
}

const foot = `<footer class="cp-foot"><p>CityPulse is reader-funded. Comments are closed on every story.</p><p>© 2030 CityPulse · citypulse.news</p></footer>`;

/** Anything from today is BREAKING. */
const kicker = (a: Article, today: number) => `<p class="cp-kicker">${a.day === today ? '<span class="cp-tag">BREAKING</span>' : ''}<b>${esc(a.section)}</b> · ${esc(when(a, today))}</p>`;
const link = (a: Article, inner: string, cls = '') => `<a href="#" class="cp-a${cls ? ' ' + cls : ''}" data-nav="citypulse.news/${esc(a.slug)}">${inner}</a>`;

export function pageCityPulse(store: GameStore, param?: string): string {
  const s = store.state;
  const day = s.values.day;
  const slug = param?.split('/')[0];
  if (slug) {
    const a = findArticle(slug);
    return `<div class="cp">${masthead(day)}${a && articleLive(s, a) ? articlePage(store, a) : missing()}${foot}</div>`;
  }
  const list = liveArticles(s);
  const [lead, ...rest] = list;
  const top = rest.slice(0, 4);
  const older = rest.slice(4);
  const leadHtml = lead ? `<article class="cp-lead">${link(lead, art(lead.art, 'cp-art'))}<div>${kicker(lead, day)}<h1>${link(lead, esc(lead.title))}</h1><p class="cp-dek">${esc(lead.dek)}</p><p class="cp-by">By ${esc(lead.by)}</p></div></article>` : '<p class="cp-empty">No stories yet.</p>';
  const topHtml = top.length ? `<div class="cp-grid">${top.map((a) => `<article class="cp-card">${link(a, art(a.art, 'cp-art'))}${kicker(a, day)}<h2>${link(a, esc(a.title))}</h2><p class="cp-dek">${esc(a.dek)}</p></article>`).join('')}</div>` : '';
  const olderHtml = older.length ? `<section class="cp-older"><h3>Earlier</h3>${older.map((a) => `<article class="cp-row">${kicker(a, day)}<h4>${link(a, esc(a.title))}</h4><p class="cp-dek">${esc(a.dek)}</p></article>`).join('')}</section>` : '';
  return `<div class="cp">${masthead(day)}
    <div class="cp-wrap">${adHtml('citypulse', day, 'wide')}
      <div class="cp-cols"><main>${leadHtml}${topHtml}${olderHtml}</main>
        <aside>${mostRead(list, day)}${adHtml('citypulse', day, 'square')}</aside></div>
    </div>${foot}</div>`;
}

/** The sidebar list: the escaped robot never leaves it once it's out. */
function mostRead(list: Article[], day: number): string {
  if (list.length < 3) return '';
  const robot = list.find((a) => a.slug === 'robot');
  const picks = [...(robot ? [robot] : []), ...list.filter((a) => a !== robot && a.day >= day - 2)].slice(0, 5);
  return `<section class="cp-most"><h3>Most read</h3><ol>${picks.map((a) => `<li>${link(a, esc(a.title))}</li>`).join('')}</ol></section>`;
}

function articlePage(store: GameStore, a: Article): string {
  const day = store.state.values.day;
  const more = liveArticles(store.state).filter((x) => x.slug !== a.slug).slice(0, 4);
  return `<div class="cp-wrap cp-story">
    <article>${kicker(a, day)}<h1>${esc(a.title)}</h1><p class="cp-dek">${esc(a.dek)}</p>
      <p class="cp-by">By ${esc(a.by)} · ${esc(dateShort(a.day))}, ${esc(clockTime(articleMin(a)))}</p>
      ${art(a.art, 'cp-art cp-hero')}
      <div class="cp-body">${a.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    </article>
    ${adHtml('citypulse', day, 'wide')}
    ${more.length ? `<section class="cp-more"><h3>More from CityPulse</h3>${more.map((x) => `<article class="cp-row">${kicker(x, day)}<h4>${link(x, esc(x.title))}</h4></article>`).join('')}</section>` : ''}
  </div>`;
}

function missing(): string {
  return `<div class="cp-wrap cp-story"><h1>Story not found</h1><p class="cp-dek">This story doesn't exist, or it hasn't been published yet.</p><p><a href="#" class="cp-a cp-home" data-nav="citypulse.news">Back to the front page</a></p></div>`;
}
