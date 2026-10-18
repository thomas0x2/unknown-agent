/*
 * The world wiki editor, in two places: wiki.dev inside the game's browser (dev mode only, bookmarked
 * there) and the standalone page wiki.html for a real browser (src/wikiPage.ts). Both draw this same
 * view from the same files, content/wiki/*.md: browse every page, see what each paragraph is for the
 * player (public, hint or hidden, and what Haiku would be given), and edit the text, the tag rule,
 * and split and merge paragraphs. Saves go through the local proxy (POST /api/wiki); Vite then hands
 * the changed files to every open copy (onWikiFiles), so the two stay in sync.
 */
import type { GameStore } from '../game/store';
import type { Content } from '../content/schema';
import {
  blockGates, blockWhy, childSections, EMBED, eventBody, eventSubject, findArticle, arrivalMin,
  parseWikiPage, formatWikiPage, parseTagRule, formatTagRule, evalTag, blockNow, queryCtx, seenRef, CITYPULSE, METERS,
  wikiIndex, WIKI_CATEGORIES,
  type WikiPage, type WikiBlock, type WikiSection, type WikiTag, type TagStep, type WikiCtx,
} from '../engine';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The editor's own state: which page is open, which paragraph is being edited, what the last save said. */
const W = {
  page: '' as string,
  /** The open entry of a nesting page (a business under Local businesses), by slug, or ''. */
  child: '' as string,
  edit: null as null | { s: number; b: number },
  steps: 0,
  search: '',
  note: '' as string,
  saving: false,
};

const CATS: [string, string][] = WIKI_CATEGORIES;
const KINDS: [TagStep['kind'] | 'notflag', string][] = [['day', 'from day'], ['flag', 'if flag set'], ['notflag', 'if flag not set'], ['meter', 'if meter'], ['seen', 'once shown']];

/** Where the editor runs: the game (wiki.dev) or the standalone page. */
export interface WikiHost {
  content: Content;
  /** Where the player stands, for what each paragraph is right now. */
  ctx(): WikiCtx;
  /** One line on that, for the top bar. */
  ctxLabel(): string;
  /** Flags to suggest in rule rows. */
  flags(): string[];
  /** The site's name in the top bar. */
  name: string;
  /** Extra controls for the top bar (the standalone page's "view as"). */
  controls?(): string;
  open(file: string): void;
  repaint(): void;
  /** No edit, merge or add buttons (the published copy on GitHub Pages, which has no proxy to save to). */
  readOnly?: boolean;
}

/** wiki.dev's host: the running game. */
export function gameWikiHost(store: GameStore): WikiHost {
  return {
    content: store.content,
    ctx: () => queryCtx(store.state, store.content),
    ctxLabel: () => {
      const s = store.state;
      return `Day ${s.values.day} · ${clock(s.clockMin)} · ${s.flags.length} flags · tags shown as the player stands now (change day and flags in the story debugger)`;
    },
    flags: () => store.state.flags,
    name: 'wiki.dev',
    controls: () => `<a class="wk-out" href="/wiki.html#${encodeURIComponent(target(W.page, W.child))}" target="_blank" rel="noopener">Open in a real browser tab ↗</a>`,
    open: (file) => store.navigate(`wiki.dev/${file.replace(/\.md$/, '')}`),
    repaint: () => store.repaint(),
  };
}

export const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const pagesOf = (host: WikiHost): WikiPage[] => host.content.wiki ?? [];
const ctxOf = (host: WikiHost): WikiCtx => host.ctx();
/** What a page (or one of its entries) is opened by: "local-businesses/bean-there". */
const target = (file: string, slug = '') => `${file.replace(/\.md$/, '')}${slug ? `/${slug}` : ''}`;
const catLabel = (id: string) => CATS.find(([c]) => c === id)?.[1] ?? id;
const tagPill = (t: WikiTag, title = '') => `<span class="wk-tag ${t === 'hidden' ? 'off' : t}"${title ? ` title="${esc(title)}"` : ''}>${t}</span>`;

function nav(host: WikiHost, open?: WikiPage): string {
  const q = W.search.trim().toLowerCase();
  const hit = (x: string) => x.toLowerCase().includes(q);
  const all = pagesOf(host).filter((p) => !q || [p.title, ...p.aliases, p.file].some(hit) || childSections(p).some((c) => hit(c.heading)));
  const link = (p: WikiPage, label: string, slug = '', day = 0) =>
    `<button class="wk-link${open?.file === p.file && W.child === slug ? ' on' : ''}" data-wiki="open" data-file="${esc(target(p.file, slug))}">${esc(label)}${day > 1 ? ` <small>day ${day}+</small>` : ''}</button>`;
  // a page with entries (Local businesses, Ad brands, Y regulars) folds them under it
  const item = (p: WikiPage, id: string) => {
    const kids = childSections(p).filter((c) => !q || hit(p.title) || hit(c.heading));
    const self = link(p, p.title, '', id === 'days' ? 0 : p.from);
    if (!kids.length) return self;
    return `<details class="wk-tree" ${q || open?.file === p.file ? 'open' : ''}><summary>${self}</summary>${kids.map((c) => link(p, c.heading, c.slug, c.fromDay ?? 0)).join('')}</details>`;
  };
  const groups = CATS.map(([id, label]) => {
    const list = all.filter((p) => p.category === id).sort((a, b) => (id === 'days' ? a.from - b.from : a.title.localeCompare(b.title)));
    if (!list.length) return '';
    // days fold by week
    const inner = id !== 'days' ? list.map((p) => item(p, id)).join('')
      : [...new Set(list.map((p) => Math.ceil(p.from / 7)))].map((w) => {
        const days = list.filter((p) => Math.ceil(p.from / 7) === w);
        return `<details class="wk-tree" ${q || days.some((p) => p.file === open?.file) ? 'open' : ''}><summary><span class="wk-group">Week ${w}</span></summary>${days.map((p) => item(p, id)).join('')}</details>`;
      }).join('');
    return `<details class="wk-cat" ${q || open?.category === id ? 'open' : ''}><summary>${label} <small>${list.length}</small></summary>${inner}</details>`;
  }).join('');
  return `<nav class="wk-nav"><input id="wk-search" class="wk-search" placeholder="Search pages" value="${esc(W.search)}" data-wiki-search>${groups || '<p class="wk-dim">No pages.</p>'}</nav>`;
}

/** Every email, post and article id a rule can wait on or a paragraph can embed. */
export function itemIds(host: WikiHost): string[] {
  const c = host.content;
  return [...c.events.filter((e) => e.site === 'qmail' || e.site === 'y' || e.site === 'yowl').map((e) => e.id), ...(c.yMarket?.posts ?? []).map((p) => p.id), ...c.yFiller.map((f) => f.id), ...CITYPULSE.map((a) => `article:${a.slug}`)];
}

function stepRow(x: TagStep | null, i: number, host: WikiHost): string {
  const kind = !x ? 'day' : x.kind === 'flag' && x.not ? 'notflag' : x.kind;
  const val = !x ? '' : x.kind === 'day' ? String(x.day) : x.kind === 'flag' ? x.flag : x.kind === 'seen' ? x.ref : `${x.meter} ${x.op} ${x.value}`;
  const tag = x?.tag ?? 'public';
  return `<div class="wk-step">
    <select id="wk-st-tag-${i}">${(['public', 'hint', 'hidden'] as const).map((t) => `<option ${t === tag ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <select id="wk-st-kind-${i}">${KINDS.map(([k, l]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input id="wk-st-val-${i}" value="${esc(val)}" placeholder="5 · seed_stolen · suspicion >= 40 · d5_coffee_removal" list="wk-hints">
    <button class="wk-x" data-wiki="delstep" data-i="${i}" title="Remove this rule">×</button></div>`
    + (i === 0 ? `<datalist id="wk-hints">${[...Object.keys(METERS).map((m) => `${m} >= `), ...host.flags(), ...itemIds(host)].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>` : '');
}

function editor(host: WikiHost, b: WikiBlock, sec: WikiSection, page: WikiPage): string {
  const r = parseTagRule(b.rule || 'hidden');
  // the automatic rules (page and section day, branches, sentences naming a later day or time)
  const gates = blockGates(b, sec, page);
  const auto = gates.length ? `<div class="wk-auto"><span class="wk-dim">Automatic, from the page and the text (hidden whatever the tag says):</span><ul>${gates.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>` : '';
  const steps = Array.from({ length: W.steps }, (_, i) => stepRow(r.steps[i] ?? null, i, host)).join('');
  return `<div class="wk-edit">
    <textarea id="wk-text" title="Cmd/Ctrl-click a {{…}} embed to see what it is" rows="${Math.min(14, Math.max(3, Math.ceil(b.text.length / 90)))}">${esc(b.text)}</textarea>
    <div class="wk-rule"><label>Tag <select id="wk-base">${(['public', 'hint', 'hidden'] as const).map((t) => `<option ${t === r.base ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <span class="wk-dim">then, last match wins:</span>${steps}
      <button class="wk-btn" data-wiki="addstep">+ Rule</button></div>
    ${auto}
    <div class="wk-acts"><button class="wk-btn primary" data-wiki="save">Save</button><button class="wk-btn" data-wiki="split" title="Split at the cursor">Split at cursor</button><button class="wk-btn" data-wiki="cancel">Cancel</button><button class="wk-btn danger" data-wiki="delete">Delete paragraph</button></div>
  </div>`;
}

/** Where a [[link]] points: a page by title, then an entry of a nesting page by heading, then a page by another name. */
function linkTarget(host: WikiHost, name: string): string | undefined {
  const n = name.trim().toLowerCase();
  const pages = host.content.wiki ?? [];
  const byTitle = pages.find((p) => p.title.toLowerCase() === n);
  if (byTitle) return target(byTitle.file);
  for (const p of pages) {
    const c = childSections(p).find((x) => x.heading.toLowerCase() === n);
    if (c) return target(p.file, c.slug);
  }
  const byAlias = pages.find((p) => p.aliases.some((a) => a.toLowerCase() === n));
  return byAlias && target(byAlias.file);
}

/** A paragraph's text for reading: [[links]] open their page, embeds are buttons. */
function richText(host: WikiHost, text: string): string {
  return esc(text)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, label) => {
      const to = linkTarget(host, a.replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
      return to ? `<button class="wk-wlink" data-wiki="open" data-file="${esc(to)}">${label ?? a}</button>` : `<span class="wk-wlink dead" title="No page with this name">${label ?? a}</span>`;
    })
    .replace(EMBED, (m, r) => `<button class="wk-embed" data-wiki="peek" data-ref="${esc(r)}" title="Show what this is">${m}</button>`);
}

/** Each email, post or article a paragraph embeds, shown under it (whether or not the player has it yet). */
function embedCards(host: WikiHost, text: string): string {
  return [...text.matchAll(EMBED)].map((m) => {
    const item = embedItem(host.content, m[1]);
    return item ? `<div class="wk-card"><div class="wk-peek-h"><b>${esc(item.title)}</b><span class="wk-dim">arrives ${esc(item.when)}</span></div><div class="wk-peek-b">${esc(item.text)}</div></div>`
      : `<div class="wk-card missing">No email, post or article is called ${esc(m[1])}.</div>`;
  }).join('');
}

function blockHtml(host: WikiHost, page: WikiPage, si: number, bi: number): string {
  const sec = page.sections[si];
  const b = sec.blocks[bi];
  const ctx = ctxOf(host);
  const editing = W.edit?.s === si && W.edit?.b === bi;
  const now = blockNow(b, sec, page, ctx);
  const ruleTag = b.rule ? evalTag(b.rule, ctx) : 'hidden';
  // why it is what it is: the rule, and whether something (day, branch, a later sentence) overrides it
  const why = sec.writer ? 'writer note, never given to Haiku'
    : !b.rule ? 'untagged: hidden'
    : now.tag !== ruleTag ? `rule says ${ruleTag}, but hidden now: ${blockWhy(b, sec, page, ctx)}` : `rule: ${b.rule}`;
  const cut = now.text && now.text !== b.text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, c) => c || a) ? `<div class="wk-gets"><b>Haiku gets:</b> ${esc(now.text)}</div>` : '';
  const head = sec.writer ? '<span class="wk-tag writer">writer</span>' : tagPill(now.tag, why);
  const rule = !sec.writer && b.rule ? `<code class="wk-rulecode">${esc(b.rule)}</code>` : '';
  return `<div class="wk-block${editing ? ' editing' : ''}${sec.writer ? ' writer' : ''}">
    <div class="wk-bhead">${head}${rule}<span class="wk-why">${esc(why)}</span>
      ${editing || host.readOnly ? '' : `<span class="wk-bacts"><button class="wk-mini" data-wiki="edit" data-s="${si}" data-b="${bi}">Edit</button>${bi < sec.blocks.length - 1 ? `<button class="wk-mini" data-wiki="merge" data-s="${si}" data-b="${bi}" title="Merge with the next paragraph">Merge ↓</button>` : ''}<button class="wk-mini" data-wiki="add" data-s="${si}" data-b="${bi}" title="New paragraph after this one">+ After</button></span>`}</div>
    ${editing ? editor(host, b, sec, page) : `<div class="wk-text">${b.bullet ? '• ' : ''}${richText(host, b.text)}</div>${embedCards(host, b.text)}${cut}`}</div>`;
}

/** wiki.dev in the game's browser. */
export function pageWiki(store: GameStore, param?: string): string {
  return wikiView(gameWikiHost(store), param);
}

/** One section of a page, with its heading (none for an untitled intro). */
function sectionHtml(host: WikiHost, p: WikiPage, si: number, heading = true): string {
  const sec = p.sections[si];
  const h = heading && (sec.heading || sec.writer || sec.fromDay || sec.ifFlag);
  return `<section class="wk-sec">
      ${h ? `<h2>${esc(sec.writer ? 'Writer notes' : sec.heading || 'Overview')}${sec.fromDay ? ` <small>from day ${sec.fromDay}</small>` : ''}${sec.ifFlag ? ` <small>if ${sec.ifFlag.not ? '!' : ''}${esc(sec.ifFlag.flag)}</small>` : ''}</h2>` : ''}
      ${sec.blocks.map((_, bi) => blockHtml(host, p, si, bi)).join('')}
      ${sec.blocks.length || host.readOnly ? '' : `<button class="wk-mini" data-wiki="add" data-s="${si}" data-b="-1">+ Paragraph</button>`}
    </section>`;
}

/** The Index page's list of every page, built from the pages (engine/wiki.ts wikiIndex). */
function indexHtml(pages: WikiPage[]): string {
  return wikiIndex(pages).map((c) => `<section class="wk-sec"><h2>${esc(c.label)}</h2><ul class="wk-kids">${c.pages.map(({ page, gist }) =>
    `<li><button class="wk-wlink" data-wiki="open" data-file="${esc(target(page.file))}">${esc(page.title)}</button> <small class="wk-dim">${esc(gist)}</small></li>`).join('')}</ul></section>`).join('');
}

/** The whole editor for `param` (a page's file name without .md, and "/entry" for one entry of a nesting page; the open page or the index when unset). */
export function wikiView(host: WikiHost, param?: string): string {
  const pages = pagesOf(host);
  const [name, slug = ''] = param ? param.replace(/\.md(?=\/|$)/, '').split('/') : [W.page.replace(/\.md$/, '') || 'index', W.child];
  const p = pages.find((x) => x.file === `${name}.md`) ?? pages.find((x) => x.file === 'index.md') ?? pages[0];
  const kids = p ? childSections(p) : [];
  const kid = kids.find((c) => c.slug === slug);
  if (p && (p.file !== W.page || (kid?.slug ?? '') !== W.child)) { W.page = p.file; W.child = kid?.slug ?? ''; W.edit = null; }
  const crumbs = p && [catLabel(p.category), ...(kid ? [`<button class="wk-wlink" data-wiki="open" data-file="${esc(target(p.file))}">${esc(p.title)}</button>`] : [])];
  const body = !p ? '<p class="wk-dim">The wiki has no pages.</p>' : kid ? `
    <header class="wk-phead"><p class="wk-crumbs">${crumbs!.join(' › ')}</p><h1>${esc(kid.heading)}</h1>
      <p class="wk-meta"><span>${kid.fromDay ? `known from day ${kid.fromDay}` : `known from day ${p.from}`}</span><span>${esc(p.file)} › ${esc(kid.heading)}</span><span>to queries, a section of ${esc(p.title)}</span></p></header>
    ${W.note ? `<p class="wk-note" role="status">${esc(W.note)}</p>` : ''}
    ${sectionHtml(host, p, kid.i, false)}` : `
    <header class="wk-phead"><p class="wk-crumbs">${crumbs!.join(' › ')}</p><h1>${esc(p.title)}</h1>
      <p class="wk-meta"><span>known from day ${p.from}</span><span>${esc(p.file)}</span>${p.aliases.length ? `<span>also: ${esc(p.aliases.join(', '))}</span>` : ''}</p></header>
    ${W.note ? `<p class="wk-note" role="status">${esc(W.note)}</p>` : ''}
    ${p.sections.map((_sec, si) => kids.some((c) => c.i === si) ? '' : sectionHtml(host, p, si)).join('')}
    ${p.file === 'index.md' ? indexHtml(pages) : ''}
    ${kids.length ? `<section class="wk-sec"><h2>Pages under ${esc(p.title)}</h2><ul class="wk-kids">${kids.map((c) => `<li><button class="wk-wlink" data-wiki="open" data-file="${esc(target(p.file, c.slug))}">${esc(c.heading)}</button>${c.fromDay ? ` <small class="wk-dim">day ${c.fromDay}+</small>` : ''}</li>`).join('')}</ul></section>` : ''}`;
  return `<div class="wk"><header class="wk-top"><b>${esc(host.name)}</b>${host.controls?.() ?? ''}<span class="wk-dim">${esc(host.ctxLabel())}</span></header>
    <div class="wk-wrap">${nav(host, p)}<main class="wk-main">${body}</main></div></div>`;
}

// ── editing ──

function current(host: WikiHost): WikiPage | undefined {
  return pagesOf(host).find((p) => p.file === W.page);
}
/** A copy of the open page to change and save. */
function draft(host: WikiHost): WikiPage | undefined {
  const p = current(host);
  return p && parseWikiPage(formatWikiPage(p), p.file);
}

const field = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? '';

/** The tag rule as the edit form has it. Steps that don't read are dropped. */
function ruleFromForm(): string {
  const steps: TagStep[] = [];
  for (let i = 0; i < W.steps; i++) {
    const tag = field(`wk-st-tag-${i}`) as WikiTag;
    const kind = field(`wk-st-kind-${i}`);
    const v = field(`wk-st-val-${i}`).trim();
    if (!v) continue;
    if (kind === 'day' && Number(v) > 0) steps.push({ tag, kind: 'day', day: Math.round(Number(v)) });
    else if ((kind === 'flag' || kind === 'notflag') && /^!?[a-z0-9_]+$/i.test(v)) steps.push({ tag, kind: 'flag', flag: v.replace(/^!/, ''), not: kind === 'notflag' || v.startsWith('!') });
    else if (kind === 'seen' && /^[a-z0-9_:.@-]+$/i.test(v)) steps.push({ tag, kind: 'seen', ref: seenRef(v) });
    else if (kind === 'meter') {
      const m = v.match(/^([a-z][a-z0-9_]*)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/i);
      if (m) steps.push({ tag, kind: 'meter', meter: m[1], op: m[2] as '>=', value: Number(m[3]) });
    }
  }
  return formatTagRule({ base: field('wk-base') as WikiTag, steps });
}

async function save(host: WikiHost, page: WikiPage, note: string, keepEdit = false): Promise<void> {
  const md = formatWikiPage(page);
  W.saving = true;
  try {
    const res = await fetch('/api/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: page.file, md }) });
    const data: { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (res.status >= 500 ? 'the proxy is not running (npm run proxy)' : `proxy returned ${res.status}`));
    // this copy uses the change straight away; others get it when Vite sees the file change
    const list = host.content.wiki ?? [];
    const i = list.findIndex((p) => p.file === page.file);
    const fresh = parseWikiPage(md, page.file);
    if (i >= 0) list[i] = fresh; else list.push(fresh);
    W.note = note;
    if (!keepEdit) W.edit = null;
  } catch (e) {
    W.note = `Couldn't save: ${(e as Error).message}`;
  } finally {
    W.saving = false;
    host.repaint();
  }
}

/** Handles a click inside wiki.dev. Returns true when it was one. */
export function wikiClick(t: HTMLElement, store: GameStore, ev?: MouseEvent): boolean {
  return wikiClickIn(t, gameWikiHost(store), ev);
}

const at = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** What an embed ({{mail:…}}, {{y:…}}, {{article:…}}) stands for: its kind, when it arrives, and its text. */
export function embedItem(c: Content, ref: string): { title: string; when: string; text: string } | undefined {
  const key = seenRef(ref);
  if (/^article:/i.test(key)) {
    const a = findArticle(key.slice(8));
    return a && { title: `CityPulse article "${a.title}" by ${a.by}`, when: `day ${a.day}, ${a.at}`, text: [a.dek, ...a.body].join('\n\n') };
  }
  // `guru_newsletter@5`: one delivery of a repeating email, the issue that lands on day 5
  const [id, on] = key.split('@');
  const e = c.events.find((x) => x.id === id && (!on || x.repeat));
  if (e) {
    const day = on ? Number(on) : e.trigger.dayMin ?? 1;
    const subject = eventSubject(e, day);
    const what = e.site === 'qmail' ? `Email from ${e.from ?? 'someone'}${subject ? `, "${subject}"` : ''}` : `${e.site === 'y' ? 'Y post' : e.site === 'yowl' ? 'Yowl review' : `${e.site} post`} by ${e.from ?? 'someone'}`;
    const ccs = on && e.special?.dayMin === day ? e.special.cc : e.cc;
    const cc = ccs?.length ? `CC: ${ccs.join(', ')}\n\n` : '';
    return { title: what, when: `day ${day}${!on && e.trigger.dayMax && e.trigger.dayMax !== day ? `-${e.trigger.dayMax}` : ''}, ${at(arrivalMin(e))}`, text: cc + eventBody(e, day) };
  }
  const m = c.yMarket?.posts.find((x) => x.id === key) ?? c.yFiller.find((x) => x.id === key);
  return m && { title: `Y post by ${m.from} (@${m.handle})`, when: `day ${m.day}`, text: m.body };
}

/** Shows what an embed stands for, in a box under `anchor` (one at a time). */
function peek(anchor: HTMLElement, host: WikiHost, ref: string): void {
  anchor.ownerDocument.querySelectorAll('.wk-peek').forEach((x) => x.remove());
  const item = embedItem(host.content, ref);
  const box = anchor.ownerDocument.createElement('div');
  box.className = 'wk-peek';
  box.innerHTML = `<div class="wk-peek-h"><b>${esc(item?.title ?? `{{${ref}}}`)}</b><span class="wk-dim">${esc(item ? `${ref} · arrives ${item.when}` : 'no email, post or article has this id')}</span><button class="wk-x" data-wiki="unpeek" title="Close">×</button></div>${item ? `<div class="wk-peek-b">${esc(item.text)}</div>` : ''}`;
  anchor.insertAdjacentElement('afterend', box);
}

/** The embed under the caret in a textarea, if any. */
function embedAt(ta: HTMLTextAreaElement): string | undefined {
  const pos = ta.selectionStart;
  for (const m of ta.value.matchAll(EMBED)) if (pos >= m.index! && pos <= m.index! + m[0].length) return m[1];
  return undefined;
}

/** Handles a click inside the editor, wherever it runs. Returns true when it was one. */
export function wikiClickIn(t: HTMLElement, host: WikiHost, ev?: MouseEvent): boolean {
  // Cmd/Ctrl-click on an embed in the text box shows what it stands for
  if (ev && (ev.metaKey || ev.ctrlKey) && t instanceof HTMLTextAreaElement && t.id === 'wk-text') {
    const ref = embedAt(t);
    if (ref) { ev.preventDefault(); peek(t, host, ref); }
    return true;
  }
  const el = t.closest<HTMLElement>('[data-wiki]');
  if (!el || W.saving) return !!el;
  const act = el.dataset.wiki!;
  const s = Number(el.dataset.s);
  const b = Number(el.dataset.b);
  W.note = '';
  if (act === 'open') { host.open(el.dataset.file!); return true; }
  if (act === 'peek') { peek(el.closest<HTMLElement>('.wk-text') ?? el, host, el.dataset.ref!); return true; }
  if (act === 'unpeek') { el.closest('.wk-peek')?.remove(); return true; }
  if (act === 'edit') {
    const block = current(host)?.sections[s]?.blocks[b];
    W.edit = { s, b };
    W.steps = block ? parseTagRule(block.rule || 'hidden').steps.length : 0;
    host.repaint();
    return true;
  }
  if (act === 'cancel') { W.edit = null; host.repaint(); return true; }
  if (act === 'addstep') {
    // keep what's typed in the rows already there
    const rule = ruleFromForm();
    const p = current(host);
    const block = W.edit && p?.sections[W.edit.s]?.blocks[W.edit.b];
    if (block) block.rule = rule;
    W.steps = parseTagRule(rule).steps.length + 1;
    host.repaint();
    return true;
  }
  if (act === 'delstep') {
    const i = Number(el.dataset.i);
    const p = current(host);
    const block = W.edit && p?.sections[W.edit.s]?.blocks[W.edit.b];
    // read the rows again without this one
    const kept = Array.from({ length: W.steps }, (_, k) => k).filter((k) => k !== i);
    if (block) {
      const base = field('wk-base') as WikiTag;
      const rows = kept.map((k) => ({ tag: field(`wk-st-tag-${k}`), kind: field(`wk-st-kind-${k}`), v: field(`wk-st-val-${k}`).trim() })).filter((r) => r.v);
      block.rule = [base, ...rows.map((r) => r.kind === 'day' ? `${r.tag} from day ${r.v}` : r.kind === 'notflag' ? `${r.tag} if !${r.v.replace(/^!/, '')}` : r.kind === 'seen' ? `${r.tag} if shown ${r.v}` : `${r.tag} if ${r.v}`)].join('; ');
      W.steps = parseTagRule(block.rule).steps.length;
    }
    host.repaint();
    return true;
  }
  const page = draft(host);
  if (!page) return true;
  if (act === 'save' || act === 'split' || act === 'delete') {
    if (!W.edit) return true;
    const sec = page.sections[W.edit.s];
    const block = sec?.blocks[W.edit.b];
    if (!block) return true;
    if (act === 'delete') {
      sec.blocks.splice(W.edit.b, 1);
      void save(host, page, 'Paragraph deleted.');
      return true;
    }
    const text = field('wk-text').replace(/\s*\n\s*/g, ' ').trim();
    const rule = ruleFromForm();
    if (act === 'save') {
      Object.assign(block, { text, rule });
      void save(host, page, 'Saved.');
    } else {
      const area = document.getElementById('wk-text') as HTMLTextAreaElement | null;
      const raw = area?.value ?? '';
      const at = area?.selectionStart ?? 0;
      const [a, c] = [raw.slice(0, at).replace(/\s+/g, ' ').trim(), raw.slice(at).replace(/\s+/g, ' ').trim()];
      if (!a || !c) { W.note = 'Put the cursor where the paragraph should split.'; host.repaint(); return true; }
      Object.assign(block, { text: a, rule });
      sec.blocks.splice(W.edit.b + 1, 0, { ...block, text: c, raw: '' });
      void save(host, page, 'Split in two; both keep the tag rule.');
    }
    return true;
  }
  if (act === 'merge') {
    const sec = page.sections[s];
    const [x, y] = [sec?.blocks[b], sec?.blocks[b + 1]];
    if (!x || !y) return true;
    x.text = `${x.text} ${y.text}`.trim();
    sec.blocks.splice(b + 1, 1);
    void save(host, page, `Merged; kept the first paragraph's tag rule (${x.rule || 'untagged'}).`);
    return true;
  }
  if (act === 'add') {
    const sec = page.sections[s];
    if (!sec) return true;
    const like = sec.blocks[b];
    sec.blocks.splice(b + 1, 0, { raw: '', rule: 'hidden', text: 'New paragraph.', bullet: !!like?.bullet, row: false });
    W.edit = { s, b: b + 1 };
    W.steps = 0;
    void save(host, page, 'Added a paragraph (hidden until you change it).', true);
    return true;
  }
  return true;
}

/** The search box filters the page list as you type. */
export function wikiInput(t: HTMLElement, store: GameStore): boolean {
  return wikiInputIn(t, gameWikiHost(store));
}
export function wikiInputIn(t: HTMLElement, host: WikiHost): boolean {
  if (!t.matches('[data-wiki-search]')) return false;
  W.search = (t as HTMLInputElement).value;
  host.repaint();
  return true;
}
