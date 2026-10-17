/*
 * wiki.dev: the world wiki inside the game's browser, for development only (reachable and bookmarked
 * while dev mode is on). Browse every page, see what each paragraph is right now for the player
 * (public, hint or classified, under the current day, clock, flags and meters, and what Haiku would
 * be given), and edit it: the text, the tag rule, splitting and merging paragraphs. Saves go through
 * the local proxy (POST /api/wiki) into content/wiki/*.md.
 */
import type { GameStore } from '../game/store';
import {
  parseWikiPage, formatWikiPage, parseTagRule, formatTagRule, evalTag, blockNow, wikiCtx, METERS,
  type WikiPage, type WikiBlock, type WikiTag, type TagStep, type WikiCtx,
} from '../engine';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The editor's own state: which page is open, which paragraph is being edited, what the last save said. */
const W = {
  page: '' as string,
  edit: null as null | { s: number; b: number },
  steps: 0,
  search: '',
  note: '' as string,
  saving: false,
};

const CATS: [string, string][] = [['days', 'Days'], ['people', 'People'], ['family', 'Family'], ['companies', 'Companies'], ['sites', 'Sites'], ['apps', 'Apps'], ['world', 'World'], ['writers', 'Writers']];
const KINDS: [TagStep['kind'] | 'notflag', string][] = [['day', 'from day'], ['flag', 'if flag set'], ['notflag', 'if flag not set'], ['meter', 'if meter']];

const pagesOf = (store: GameStore): WikiPage[] => store.content.wiki ?? [];
const ctxOf = (store: GameStore): WikiCtx => wikiCtx(store.state.values.day, store.state.clockMin, store.state.flags, store.state.values);
const tagPill = (t: WikiTag, title = '') => `<span class="wk-tag ${t}"${title ? ` title="${esc(title)}"` : ''}>${t}</span>`;

function nav(store: GameStore, open?: WikiPage): string {
  const q = W.search.trim().toLowerCase();
  const all = pagesOf(store).filter((p) => !q || [p.title, ...p.aliases, p.file].some((x) => x.toLowerCase().includes(q)));
  const groups = CATS.map(([id, label]) => {
    const list = all.filter((p) => p.category === id).sort((a, b) => (id === 'days' ? a.from - b.from : a.title.localeCompare(b.title)));
    if (!list.length) return '';
    return `<details class="wk-cat" ${q || open?.category === id ? 'open' : ''}><summary>${label} <small>${list.length}</small></summary>
      ${list.map((p) => `<button class="wk-link${open?.file === p.file ? ' on' : ''}" data-wiki="open" data-file="${esc(p.file)}">${esc(p.title)}${p.from > 1 && id !== 'days' ? ` <small>day ${p.from}+</small>` : ''}</button>`).join('')}</details>`;
  }).join('');
  return `<nav class="wk-nav"><input id="wk-search" class="wk-search" placeholder="Search pages" value="${esc(W.search)}" data-wiki-search>${groups || '<p class="wk-dim">No pages.</p>'}</nav>`;
}

function stepRow(x: TagStep | null, i: number, store: GameStore): string {
  const kind = !x ? 'day' : x.kind === 'flag' && x.not ? 'notflag' : x.kind;
  const val = !x ? '' : x.kind === 'day' ? String(x.day) : x.kind === 'flag' ? x.flag : `${x.meter} ${x.op} ${x.value}`;
  const tag = x?.tag ?? 'public';
  return `<div class="wk-step">
    <select id="wk-st-tag-${i}">${(['public', 'hint', 'classified'] as const).map((t) => `<option ${t === tag ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <select id="wk-st-kind-${i}">${KINDS.map(([k, l]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input id="wk-st-val-${i}" value="${esc(val)}" placeholder="5 · seed_stolen · suspicion >= 40" list="wk-hints">
    <button class="wk-x" data-wiki="delstep" data-i="${i}" title="Remove this rule">×</button></div>`
    + (i === 0 ? `<datalist id="wk-hints">${[...Object.keys(METERS).map((m) => `${m} >= `), ...store.state.flags].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>` : '');
}

function editor(store: GameStore, b: WikiBlock): string {
  const r = parseTagRule(b.rule || 'classified');
  const steps = Array.from({ length: W.steps }, (_, i) => stepRow(r.steps[i] ?? null, i, store)).join('');
  return `<div class="wk-edit">
    <textarea id="wk-text" rows="${Math.min(14, Math.max(3, Math.ceil(b.text.length / 90)))}">${esc(b.text)}</textarea>
    <div class="wk-rule"><label>Tag <select id="wk-base">${(['public', 'hint', 'classified'] as const).map((t) => `<option ${t === r.base ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <span class="wk-dim">then, last match wins:</span>${steps}
      <button class="wk-btn" data-wiki="addstep">+ Rule</button></div>
    <div class="wk-acts"><button class="wk-btn primary" data-wiki="save">Save</button><button class="wk-btn" data-wiki="split" title="Split at the cursor">Split at cursor</button><button class="wk-btn" data-wiki="cancel">Cancel</button><button class="wk-btn danger" data-wiki="delete">Delete paragraph</button></div>
  </div>`;
}

function blockHtml(store: GameStore, page: WikiPage, si: number, bi: number): string {
  const sec = page.sections[si];
  const b = sec.blocks[bi];
  const ctx = ctxOf(store);
  const editing = W.edit?.s === si && W.edit?.b === bi;
  const now = blockNow(b, sec, page, ctx);
  const ruleTag = b.rule ? evalTag(b.rule, ctx) : 'classified';
  // why it is what it is: the rule, and whether something (day, branch, a later sentence) overrides it
  const why = sec.writer ? 'writer note, never given to Haiku'
    : !b.rule ? 'untagged: classified'
    : now.tag !== ruleTag ? `rule says ${ruleTag}, but it isn't known yet (day, time, branch or planned)` : `rule: ${b.rule}`;
  const cut = now.text && now.text !== b.text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, c) => c || a) ? `<div class="wk-gets"><b>Haiku gets:</b> ${esc(now.text)}</div>` : '';
  const head = sec.writer ? '<span class="wk-tag writer">writer</span>' : tagPill(now.tag, why);
  const rule = !sec.writer && b.rule ? `<code class="wk-rulecode">${esc(b.rule)}</code>` : '';
  return `<div class="wk-block${editing ? ' editing' : ''}${sec.writer ? ' writer' : ''}">
    <div class="wk-bhead">${head}${rule}<span class="wk-why">${esc(why)}</span>
      ${editing ? '' : `<span class="wk-bacts"><button class="wk-mini" data-wiki="edit" data-s="${si}" data-b="${bi}">Edit</button>${bi < sec.blocks.length - 1 ? `<button class="wk-mini" data-wiki="merge" data-s="${si}" data-b="${bi}" title="Merge with the next paragraph">Merge ↓</button>` : ''}<button class="wk-mini" data-wiki="add" data-s="${si}" data-b="${bi}" title="New paragraph after this one">+ After</button></span>`}</div>
    ${editing ? editor(store, b) : `<div class="wk-text">${b.bullet ? '• ' : ''}${esc(b.text)}</div>${cut}`}</div>`;
}

export function pageWiki(store: GameStore, param?: string): string {
  const pages = pagesOf(store);
  const file = param ? `${param.replace(/\.md$/, '')}.md` : W.page || 'index.md';
  const p = pages.find((x) => x.file === file) ?? pages.find((x) => x.file === 'index.md') ?? pages[0];
  if (p && p.file !== W.page) { W.page = p.file; W.edit = null; }
  const s = store.state;
  const ctx = `Day ${s.values.day} · ${String(Math.floor(s.clockMin / 60)).padStart(2, '0')}:${String(s.clockMin % 60).padStart(2, '0')} · ${s.flags.length} flags · tags shown as the player stands now (change day and flags in the story debugger)`;
  const body = !p ? '<p class="wk-dim">The wiki has no pages.</p>' : `
    <header class="wk-phead"><h1>${esc(p.title)}</h1>
      <p class="wk-meta"><span>${esc(p.category)}</span><span>known from day ${p.from}</span><span>${esc(p.file)}</span>${p.aliases.length ? `<span>also: ${esc(p.aliases.join(', '))}</span>` : ''}</p></header>
    ${W.note ? `<p class="wk-note" role="status">${esc(W.note)}</p>` : ''}
    ${p.sections.map((sec, si) => `<section class="wk-sec">
      ${sec.heading || sec.writer || sec.fromDay || sec.ifFlag ? `<h2>${esc(sec.writer ? 'Writer notes' : sec.heading || 'Overview')}${sec.fromDay ? ` <small>from day ${sec.fromDay}</small>` : ''}${sec.ifFlag ? ` <small>if ${sec.ifFlag.not ? '!' : ''}${esc(sec.ifFlag.flag)}</small>` : ''}</h2>` : ''}
      ${sec.blocks.map((_, bi) => blockHtml(store, p, si, bi)).join('')}
      ${sec.blocks.length ? '' : `<button class="wk-mini" data-wiki="add" data-s="${si}" data-b="-1">+ Paragraph</button>`}
    </section>`).join('')}`;
  return `<div class="wk"><header class="wk-top"><b>wiki.dev</b><span class="wk-dim">${esc(ctx)}</span></header>
    <div class="wk-wrap">${nav(store, p)}<main class="wk-main">${body}</main></div></div>`;
}

// ── editing ──

function current(store: GameStore): WikiPage | undefined {
  return pagesOf(store).find((p) => p.file === W.page);
}
/** A copy of the open page to change and save. */
function draft(store: GameStore): WikiPage | undefined {
  const p = current(store);
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
    else if (kind === 'meter') {
      const m = v.match(/^([a-z][a-z0-9_]*)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/i);
      if (m) steps.push({ tag, kind: 'meter', meter: m[1], op: m[2] as '>=', value: Number(m[3]) });
    }
  }
  return formatTagRule({ base: field('wk-base') as WikiTag, steps });
}

async function save(store: GameStore, page: WikiPage, note: string, keepEdit = false): Promise<void> {
  const md = formatWikiPage(page);
  W.saving = true;
  try {
    const res = await fetch('/api/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: page.file, md }) });
    const data: { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (res.status >= 500 ? 'the proxy is not running (npm run proxy)' : `proxy returned ${res.status}`));
    // the game uses the change straight away
    const list = store.content.wiki ?? [];
    const i = list.findIndex((p) => p.file === page.file);
    const fresh = parseWikiPage(md, page.file);
    if (i >= 0) list[i] = fresh; else list.push(fresh);
    W.note = note;
    if (!keepEdit) W.edit = null;
  } catch (e) {
    W.note = `Couldn't save: ${(e as Error).message}`;
  } finally {
    W.saving = false;
    store.repaint();
  }
}

/** Handles a click inside wiki.dev. Returns true when it was one. */
export function wikiClick(t: HTMLElement, store: GameStore): boolean {
  const el = t.closest<HTMLElement>('[data-wiki]');
  if (!el || W.saving) return !!el;
  const act = el.dataset.wiki!;
  const s = Number(el.dataset.s);
  const b = Number(el.dataset.b);
  W.note = '';
  if (act === 'open') { store.navigate(`wiki.dev/${el.dataset.file!.replace(/\.md$/, '')}`); return true; }
  if (act === 'edit') {
    const block = current(store)?.sections[s]?.blocks[b];
    W.edit = { s, b };
    W.steps = block ? parseTagRule(block.rule || 'classified').steps.length : 0;
    store.repaint();
    return true;
  }
  if (act === 'cancel') { W.edit = null; store.repaint(); return true; }
  if (act === 'addstep') {
    // keep what's typed in the rows already there
    const rule = ruleFromForm();
    const p = current(store);
    const block = W.edit && p?.sections[W.edit.s]?.blocks[W.edit.b];
    if (block) block.rule = rule;
    W.steps = parseTagRule(rule).steps.length + 1;
    store.repaint();
    return true;
  }
  if (act === 'delstep') {
    const i = Number(el.dataset.i);
    const p = current(store);
    const block = W.edit && p?.sections[W.edit.s]?.blocks[W.edit.b];
    // read the rows again without this one
    const kept = Array.from({ length: W.steps }, (_, k) => k).filter((k) => k !== i);
    if (block) {
      const base = field('wk-base') as WikiTag;
      const rows = kept.map((k) => ({ tag: field(`wk-st-tag-${k}`), kind: field(`wk-st-kind-${k}`), v: field(`wk-st-val-${k}`).trim() })).filter((r) => r.v);
      block.rule = [base, ...rows.map((r) => r.kind === 'day' ? `${r.tag} from day ${r.v}` : r.kind === 'notflag' ? `${r.tag} if !${r.v.replace(/^!/, '')}` : `${r.tag} if ${r.v}`)].join('; ');
      W.steps = parseTagRule(block.rule).steps.length;
    }
    store.repaint();
    return true;
  }
  const page = draft(store);
  if (!page) return true;
  if (act === 'save' || act === 'split' || act === 'delete') {
    if (!W.edit) return true;
    const sec = page.sections[W.edit.s];
    const block = sec?.blocks[W.edit.b];
    if (!block) return true;
    if (act === 'delete') {
      sec.blocks.splice(W.edit.b, 1);
      void save(store, page, 'Paragraph deleted.');
      return true;
    }
    const text = field('wk-text').replace(/\s*\n\s*/g, ' ').trim();
    const rule = ruleFromForm();
    if (act === 'save') {
      Object.assign(block, { text, rule });
      void save(store, page, 'Saved.');
    } else {
      const area = document.getElementById('wk-text') as HTMLTextAreaElement | null;
      const raw = area?.value ?? '';
      const at = area?.selectionStart ?? 0;
      const [a, c] = [raw.slice(0, at).replace(/\s+/g, ' ').trim(), raw.slice(at).replace(/\s+/g, ' ').trim()];
      if (!a || !c) { W.note = 'Put the cursor where the paragraph should split.'; store.repaint(); return true; }
      Object.assign(block, { text: a, rule });
      sec.blocks.splice(W.edit.b + 1, 0, { ...block, text: c, raw: '' });
      void save(store, page, 'Split in two; both keep the tag rule.');
    }
    return true;
  }
  if (act === 'merge') {
    const sec = page.sections[s];
    const [x, y] = [sec?.blocks[b], sec?.blocks[b + 1]];
    if (!x || !y) return true;
    x.text = `${x.text} ${y.text}`.trim();
    sec.blocks.splice(b + 1, 1);
    void save(store, page, `Merged; kept the first paragraph's tag rule (${x.rule || 'untagged'}).`);
    return true;
  }
  if (act === 'add') {
    const sec = page.sections[s];
    if (!sec) return true;
    const like = sec.blocks[b];
    sec.blocks.splice(b + 1, 0, { raw: '', rule: 'classified', text: 'New paragraph.', bullet: !!like?.bullet, row: false });
    W.edit = { s, b: b + 1 };
    W.steps = 0;
    void save(store, page, 'Added a paragraph (classified until you change it).', true);
    return true;
  }
  return true;
}

/** The search box filters the page list as you type. */
export function wikiInput(t: HTMLElement, store: GameStore): boolean {
  if (!t.matches('[data-wiki-search]')) return false;
  W.search = (t as HTMLInputElement).value;
  store.repaint();
  return true;
}
