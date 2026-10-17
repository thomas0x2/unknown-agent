/*
 * Apps: the heart of the work loop. The agent builds/fixes into the repo (maybe wrong), the player
 * deploys to make it live, then checks the live app against the client's spec. Breaks hit the live
 * app nightly. Payday pays working apps and strikes/churns broken ones.
 */
import type { GameState, AppInstance, AppBreak, BuiltFeature, FailureKind } from './state';
import type { Content, CreateAppSpec, AppTemplate, FeatureDef, ComponentDef, BugDef } from '../content/schema';
import { APPS, COMPONENT_BUG_CHANCE } from './config';
import { chance, pick, randInt, rand, log, money, playMinutes } from './core';
import { complaintFor, type Complaint } from './complaints';
import { bugShows, type View } from './visibility';
import { postingTime } from './swaplist';

function bugChance(level: number): number {
  return COMPONENT_BUG_CHANCE[Math.max(0, Math.min(COMPONENT_BUG_CHANCE.length - 1, level - 1))];
}

export function getApp(state: GameState, id: string): AppInstance | undefined {
  return state.apps.find((a) => a.id === id);
}

/**
 * An app that starts empty (Swaplist) holds back its bugs until its first content appears: nothing
 * would show them. Deployed ones know when that is; before the first deploy the template says so.
 */
export function quiet(app: AppInstance, tmpl?: AppTemplate): boolean {
  return app.contentAt != null ? !app.contentLive : !!tmpl?.firstContentAfter;
}

/**
 * Can the player see this bug on the app right now (engine/visibility.ts)? Nothing shows on an app
 * that is still empty. Without content to check the posts against, a post-driven bug counts as showing.
 */
export function canSee(s: GameState, app: AppInstance, tmpl: AppTemplate | undefined, bug: string, content?: Content, view?: View): boolean {
  if (quiet(app, tmpl)) return false;
  return bugShows(view ?? { s, app, content }, bug);
}

/** Splits a build's bugs into the ones that show now and the ones held until something would show them. */
function splitBugs(s: GameState, app: AppInstance, ctx: BuildCtx, bugs: string[]): { shown: string[]; held?: string[] } {
  const view: View = { s, app, content: ctx.content };
  const shown = bugs.filter((b) => canSee(s, app, ctx.tmpl, b, ctx.content, view));
  const held = bugs.filter((b) => !shown.includes(b));
  return { shown, held: held.length ? held : undefined };
}

/** True when the live app matches its brief: every required feature present, correct, unbroken. */
export function appMeetsSpec(app: AppInstance): boolean {
  if (app.breaks.length) return false;
  for (const id of app.required) {
    const f = app.features.find((x) => x.id === id);
    if (!f || !f.correct) return false;
  }
  return true;
}

/** Working = deployed, live, and meeting spec. Only working apps pay. */
export function appWorking(app: AppInstance): boolean {
  return app.deployed && !app.churned && app.deployedVersion === app.repoVersion && appMeetsSpec(app);
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A repo name from the app's name (trattoria-gino), numbered if one already exists. */
function appSlug(s: GameState, name: string): string {
  const base = slug(name) || 'app';
  let id = base;
  for (let n = 2; s.apps.some((a) => a.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** Register a new app project (not built yet). Returns the app id. */
export function registerApp(s: GameState, spec: CreateAppSpec): string {
  const id = appSlug(s, spec.name);
  const payPerDay = spec.kind === 'client'
    ? spec.payPerDay ?? randInt(s, APPS.clientPay[0], APPS.clientPay[1])
    : 0;
  const specParams: Record<string, Record<string, string | number>> = {};
  for (const f of spec.spec) if (f.params) specParams[f.id] = f.params;
  const app: AppInstance = {
    id,
    template: spec.template,
    kind: spec.kind,
    name: spec.name,
    url: `${id}.forkyard.app`,
    clientEventId: spec.clientEventId,
    payPerDay,
    required: spec.spec.map((f) => f.id),
    specParams,
    repo: [],
    features: [],
    repoVersion: 0,
    deployedVersion: 0,
    deployed: false,
    createdDay: s.values.day,
    lastDeployDay: 0,
    breaks: [],
    strikes: 0,
    churned: false,
    brokenDays: 0,
    users: spec.kind === 'user' ? spec.startUsers ?? APPS.user.startUsers : undefined,
    suspicious: spec.suspicious,
  };
  s.apps.push(app);
  return id;
}

/** What the prompt gave the agent to work with. Without a prompt, builds just roll the level chance. */
export interface BuildCtx {
  tmpl?: AppTemplate;
  prompt?: string;
  /** The player's earlier messages to the agent: details given there (the dishes, the hours) count too. */
  context?: string;
  /** Bug ids Jev judged the prompt names (see BugDef.when). */
  named?: string[];
  /** For checking which bugs can show yet (the posts on Y); without it every bug counts as showing. */
  content?: Content;
}
/** What went sideways in a build, for the agent's reply. */
export interface BuildReport {
  /** Features the prompt pointed at without naming the actual problem: the agent changed something else. */
  vague: string[];
  /** Features built without the details they needed: the agent made them up. */
  hallucinated: string[];
}

const NUM = /\d+(?:[.,]\d+)?/g;

/** Fills {{param}} from the spec; {{param:names}} keeps only its words, {{param:prices}} only its numbers. */
export const fillSpec = (text: string, params?: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)(?::(names|prices))?\}\}/g, (_m, k: string, part?: string) => {
    const v = String(params?.[k] ?? '');
    return part === 'names' ? v.replace(NUM, '') : part === 'prices' ? (v.match(NUM) ?? []).join(' ') : v;
  });

function tokens(text: string): string[] {
  // "17:00" counts as 17: the zeros are formatting, not something the prompt has to repeat
  return text.toLowerCase().match(/[a-z\u00c0-\u024f]{3,}|\d+(?:[.,]\d+)?/g)?.map((t) => t.replace(',', '.')).filter((t) => !/^0+$/.test(t)) ?? [];
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** A word the player typed counts if it's close enough: "magherita" is Margherita, "lasagna" is Lasagne. Numbers are exact. */
function closeEnough(want: string, have: Set<string>): boolean {
  if (have.has(want) || /^\d/.test(want) || want.length < 5) return have.has(want);
  const max = want.length >= 8 ? 2 : 1;
  for (const h of have) if (!/^\d/.test(h) && Math.abs(h.length - want.length) <= max && editDistance(want, h) <= max) return true;
  return false;
}

/** True when the prompt carries (nearly) every word and number of `values`, e.g. the dishes and prices. */
export function promptHasDetails(prompt: string, values: string[]): boolean {
  const want = [...new Set(values.flatMap(tokens))];
  if (!want.length) return true;
  const have = new Set(tokens(prompt));
  return want.filter((t) => closeEnough(t, have)).length / want.length >= 0.85;
}

/** What a client update changes: the feature's details, or for a feature without any (the tickers), its whole spec. */
function changeValues(params: Record<string, string | number> | undefined, def: FeatureDef): string[] {
  return def.details?.length ? detailValues(params, def, true) : Object.values(params ?? {}).map(String);
}

/** The details a build needs ("dishes:names": just the dish names). `whole` ignores the part: the full values. */
function detailValues(params: Record<string, string | number> | undefined, def: FeatureDef, whole = false): string[] {
  return (def.details ?? []).filter((d) => params?.[d.split(':')[0]] != null)
    .map((d) => fillSpec(`{{${whole ? d.split(':')[0] : d}}}`, params));
}

/** Which of the feature's spec checklist items the prompt mentions explicitly (item id -> mentioned). */
export function specChecklist(app: AppInstance, def: FeatureDef | undefined, prompt: string): Record<string, boolean> | undefined {
  if (!def?.checklist?.length) return undefined;
  const out: Record<string, boolean> = {};
  for (const c of def.checklist) out[c.id] = promptHasDetails(prompt, [fillSpec(c.text, app.specParams[def.id])]);
  return out;
}

/** For an outdated feature: does the prompt spell out what changed (new dishes and prices, dropped dishes)? */
function promptHasChange(prompt: string, before: string[], after: string[]): boolean {
  const old = new Set(before.flatMap(tokens));
  const now = new Set(after.flatMap(tokens));
  const added = [...now].filter((t) => !old.has(t));
  const dropped = [...old].filter((t) => !now.has(t) && !/^\d/.test(t));
  return promptHasDetails(prompt, [...added, ...dropped]);
}

const fixedOf = (app: AppInstance, id: string): string[] => app.fixed?.[id] ?? [];

/** Remember the bugs a build removed, so later builds of the feature don't bring them back. */
function recordFixed(app: AppInstance, before: BuiltFeature | undefined, after: BuiltFeature): void {
  const had = before && !before.correct ? bugsOf(before) : [];
  const has = after.correct ? [] : bugsOf(after);
  // 'outdated' is not a mistake: the next client update outdates it again
  const gone = had.filter((b) => !has.includes(b) && b !== 'outdated');
  if (!gone.length) return;
  app.fixed ??= {};
  app.fixed[after.id] = [...new Set([...fixedOf(app, after.id), ...gone])];
}

/** Every bug a wrong build has: its main variant and any stacked on it. */
export const bugsOf = (f: Pick<BuiltFeature, 'variant' | 'also'> | undefined): string[] =>
  f?.variant ? [f.variant, ...(f.also ?? [])] : [];

function withBugs(list: string[]): Pick<BuiltFeature, 'variant' | 'also'> {
  return list.length > 1 ? { variant: list[0], also: list.slice(1) } : { variant: list[0], also: undefined };
}

/** One feature through the agent: a fresh build, a fix of a known problem, or a miss on a vague prompt. */
function attempt(s: GameState, app: AppInstance, id: string, level: number, ctx: BuildCtx, report: BuildReport): BuiltFeature {
  const def = ctx.tmpl?.features.find((f) => f.id === id);
  const spec = app.specParams[id];
  const existing = app.repo.find((f) => f.id === id);
  // what the agent knows: this prompt plus what the player told it earlier
  const said = ctx.prompt != null ? [ctx.context, ctx.prompt].filter(Boolean).join('\n') : undefined;
  const details = def && said != null ? detailValues(spec, def) : [];
  const hasDetails = !details.length || promptHasDetails(said ?? '', details);
  // a fix only removes the bugs it addresses; it never adds new ones (bugs come from building and overnight breaks)
  if (existing && !existing.correct && existing.variant && ctx.prompt != null) {
    const isAddressed = (v: string) => {
      // an invented feature needs the real details, from this prompt or an earlier one
      if (v === 'hallucinated') return details.length > 0 && hasDetails;
      const bug = def?.bugs?.find((b) => b.id === v);
      // spelling the details out again fixes it, including the checklist items tied to this bug (the prices)
      const spelled = !!bug?.orDetails && details.length > 0 && hasDetails
        && (def?.checklist ?? []).filter((c) => c.bug === v).every((c) => specChecklist(app, def, said!)?.[c.id]);
      // Jev judged the prompt spells out the change; the details or the change itself in the text count too
      return v === 'outdated' ? (ctx.named ?? []).includes('outdated') || (details.length > 0 && hasDetails) || (def ? promptHasChange(said!, changeValues(existing.params, def), changeValues(spec, def)) : false)
        : (ctx.named ?? []).includes(v) || spelled;
    };
    const all = bugsOf(existing);
    const left = all.filter((v) => !isAddressed(v));
    if (left.length === all.length) { report.vague.push(id); return { ...existing }; }
    // a bug that can't show yet is still in the code: naming its part fixes it too, else it stays held
    const stillHeld = existing.held?.filter((b) => !(ctx.named ?? []).includes(b));
    const held = stillHeld?.length ? stillHeld : undefined;
    // the named bugs are fixed; the ones nobody mentioned stay
    if (left.length) return { ...existing, ...(left.includes('outdated') ? {} : { params: spec }), ...withBugs(left), held };
    return { id, correct: true, params: spec, ...(held ? { held } : {}) };
  }
  const checked = said != null ? specChecklist(app, def, said) : undefined;
  // every spec item the build prompt never mentioned guarantees its mistake, whatever the roll
  // ...unless the agent already fixed that mistake once: then it knows better
  const fixed = fixedOf(app, id);
  // checklist items about the details themselves (the prices in the menu) are moot when the details
  // get invented anyway, or when the real ones are already in the repo from an earlier fix
  const keys = (def?.details ?? []).map((d) => d.split(':')[0]);
  const moot = new Set((def?.checklist ?? []).filter((c) => keys.some((k) => c.text.includes(`{{${k}`))).map((c) => c.bug));
  const knowsDetails = fixed.includes('hallucinated');
  const missed = [...new Set((def?.checklist ?? []).filter((c) => checked?.[c.id] === false).map((c) => c.bug))]
    .filter((b) => b !== 'hallucinated' && !fixed.includes(b) && !(knowsDetails && moot.has(b)));
  // once the real details are in the repo, a prompt without them reuses them instead of inventing
  const invented = !hasDetails && !knowsDetails;
  const sure = invented ? ['hallucinated', ...missed.filter((b) => !moot.has(b))] : missed;
  // on top of what the prompt left out, each other component goes wrong with the level's chance
  // bugs nothing would show yet (no Crane post for the auto-buy to act on) are held until something does
  const { shown: bugs, held } = splitBugs(s, app, ctx, [...sure, ...rollBugs(s, def, level, fixed, sure)]);
  const hold = held ? { held } : {};
  if (invented) report.hallucinated.push(id);
  if (bugs.length) return { id, correct: false, ...(bugs.includes('hallucinated') ? {} : { params: spec }), ...withBugs(bugs), seed: randInt(s, 0, 9999), checked, ...hold };
  if (held) return { id, correct: true, params: spec, seed: randInt(s, 0, 9999), checked, held };
  // a feature with no named bugs is wrong as a whole, at the same rate
  if (!def?.bugs?.length && chance(s, bugChance(level))) return { id, correct: false, params: spec, variant: undefined, seed: randInt(s, 0, 9999), checked };
  return { id, correct: true, params: spec, checked };
}

/**
 * One roll per component that can hold a bug: with the level's chance it gets one of its bugs that
 * hasn't been fixed before. Components already wrong for another reason (`taken`) are skipped.
 */
function rollBugs(s: GameState, def: FeatureDef | undefined, level: number, fixed: string[], taken: string[]): string[] {
  const out: string[] = [];
  for (const c of fixableComponents(def)) {
    const own = (c.bugs ?? []).filter((b) => def?.bugs?.some((x) => x.id === b));
    if ((c.bugs ?? []).some((b) => taken.includes(b))) continue;
    if (!chance(s, bugChance(level))) continue;
    const pool = own.filter((b) => !fixed.includes(b));
    if (pool.length) out.push(pick(s, pool));
  }
  return out;
}

/**
 * The agent builds the requested features into the repo. `requested` is the set of feature ids Jev
 * judged the prompt asked for. Each is built right with the level's chance, else with one of the
 * template's bugs; features whose details the prompt left out come out invented; the rest stay
 * missing. Writes the repo (not live until Deploy).
 */
export function buildApp(s: GameState, appId: string, requested: string[], level: number, ctx: BuildCtx = {}): BuildReport {
  const report: BuildReport = { vague: [], hallucinated: [] };
  const app = getApp(s, appId);
  if (!app) return report;
  const built: BuiltFeature[] = [];
  for (const id of app.required) {
    if (!requested.includes(id)) continue; // forgotten features are missing
    const f = attempt(s, app, id, level, ctx, report);
    recordFixed(app, app.repo.find((x) => x.id === id), f);
    built.push(f);
  }
  // keep any already-correct features the player didn't re-request
  for (const f of app.repo) if (!built.some((b) => b.id === f.id)) built.push(f);
  app.repo = built;
  app.repoVersion++;
  const worked = requested.filter((id) => !report.vague.includes(id));
  const msg = app.repoVersion === 1 ? `Initial commit for ${app.name}`
    : worked.length ? `Update ${worked.join(', ')}` : `Check ${requested.join(', ') || app.name}`;
  s.commits.push({ day: s.values.day, repo: app.id, msg, kind: 'push' });
  return report;
}

/**
 * Something Jev can match a prompt against. `build` asks for the feature (or a change to it);
 * `component` says one part of it is wrong, which fixes that part's bugs; `area` says the feature is
 * wrong without saying which part (a near-miss); `problem` is a live break the site shows.
 */
export interface FixCategory {
  id: string;
  description: string;
  kind: 'build' | 'problem' | 'component' | 'area' | 'step';
  /** A component counts as named only when the prompt also names each step of its path (these step ids). */
  requires?: string[];
  /** What counts as naming it, for offline mode's keyword matcher (Jev reads the description). */
  names?: string[];
}

/** The feature as a player would name it: 'auto_buy' is the auto buy. */
export const featureName = (fid: string, def?: { name?: string }) => (def?.name ?? fid).replaceAll('_', ' ');

/** Synonyms that count as naming a step or part, appended to its description. */
const also = (aka: string[] | undefined, name = '') => {
  const extra = (aka ?? []).filter((a) => !name.toLowerCase().includes(a.toLowerCase()));
  return extra.length ? ` (also counts as naming it: ${extra.map((a) => `"${a}"`).join(', ')})` : '';
};

/** A component's path as a player names it, step by step: 'booking/confirmation/date' is "booking > confirmation > date". */
export const componentPath = (fid: string, cid: string, def?: { name?: string }) => [featureName(fid, def), ...cid.split('/').map((p) => featureName(p))].join(' > ');

/** The components that can hold bugs: the ones a fix prompt can name. */
export const fixableComponents = (def: FeatureDef | undefined): ComponentDef[] => (def?.components ?? []).filter((c) => c.bugs?.length);

/** Jev's matches on a feature as the bugs they name: a component stands for every bug in it. */
export function componentBugs(def: FeatureDef | undefined, cats: string[]): string[] {
  return [...new Set(cats.flatMap((c) => c.startsWith('c:') ? def?.components?.find((x) => x.id === c.slice(2))?.bugs ?? [] : [c]))];
}

/** What names a live break, for offline mode's keyword matcher: the error the site shows. */
const BREAK_NAMES: Partial<Record<FailureKind, string[]>> = {
  visible: ['application error', 'crash', 'crashes', 'exception', 'error page', 'white screen', 'does not load'],
  failed_fetch: ['failed to fetch', 'failed fetch', 'fetch', 'data not loading', 'does not load', 'not loading', 'everything free', 'all free', 'shows nothing'],
};

/** A component's names: its label without "the", what its brackets say, and its other names. */
function labelNames(c: ComponentDef): string[] {
  const [, head, inner] = c.label.match(/^(?:the\s+)?([^(]*?)\s*(?:\((?:the\s+)?([^)]*)\))?$/i) ?? [];
  return [head || c.label, ...(inner && !/^no\s/i.test(inner) && !inner.includes(',') ? [inner] : []), ...(c.aka ?? [])].filter(Boolean);
}

/** A client change's names: each new value ("Quattro Formaggi 15"), and each name in it without its number. */
function changeNames(values: string[]): string[] {
  const parts = values.flatMap((v) => v.split(/[,;]|\band\b/)).map((v) => v.trim()).filter(Boolean);
  return [...new Set([...parts, ...parts.map((p) => p.replace(/[\d.$]+|DOLR|EURI/gi, '').replace(/[:()]/g, ' ').trim()).filter((p) => p.length > 2)])];
}

const BREAK_CATEGORIES: Partial<Record<FailureKind, string>> = {
  // the error the site shows is enough to name it: the player needn't know which page broke
  visible: 'The {{feature}} page crashes: the site shows "Application error" (a client-side exception). Mentioning the application error, a crash or an exception on the app counts, without naming the page.',
  failed_fetch: "The {{feature}} page doesn't load its data: failed to fetch (or it falls back to showing everything free). Mentioning the failed fetch, data not loading or everything showing as free counts, without naming the page.",
};


/**
 * Everything a prompt can name about one feature: the feature itself (so "show the name Trattoria
 * Gino" builds a missing landing page too), each of its components, the feature as a whole for a
 * near-miss, and its live break.
 */
export function fixCategories(app: AppInstance, tmpl: AppTemplate | undefined, featureId: string): FixCategory[] {
  const def = tmpl?.features.find((f) => f.id === featureId);
  if (!def) return [];
  const built = app.repo.find((f) => f.id === featureId);
  // asking for the feature itself builds it when it's missing, re-rolls it when it's wrong as a whole,
  // and puts in the real details when they were invented. A feature that's there with named bugs has
  // nothing to build: a prompt about it has to name the broken part
  const named = bugsOf(built).filter((b) => def.bugs?.some((x) => x.id === b));
  const buildable = !built || !named.length || named.some((b) => b === 'hallucinated' || b === 'outdated');
  const featureNames = [featureName(featureId, def), ...(def.aka ?? [])];
  const out: FixCategory[] = buildable ? [{ id: 'feature', description: def.description, kind: 'build', names: featureNames }] : [];
  // the client changed what this feature should contain: asking for that change is feature work
  if (built && !built.correct && bugsOf(built).includes('outdated')) {
    const now = changeValues(app.specParams[featureId], def).join('; ');
    out.push({ id: 'outdated', description: `Change ${def.description} to the client's new version${now ? ` (${now})` : ''}. The prompt has to say what exactly changes: which items are swapped, added or removed, or which prices change and to what ("swap Diavola for Quattro Formaggi at 15"). Asking to update it without saying what changes ("update the menu items and prices") doesn't count.`, kind: 'build', names: changeNames(changeValues(app.specParams[featureId], def)) });
  }
  // a fix has to say which part is wrong: one item per component, described by what can go wrong in it
  const spec = app.specParams[featureId];
  const comps = fixableComponents(def);
  // the path to each component: the feature, then each folder. Each step is its own simple question
  // ("does the prompt name the booking?"), and a component needs every step on its path named
  const steps = new Map<string, string>();
  const stepNames = new Map<string, string[]>([[`s:${featureId}`, featureNames]]);
  steps.set(`s:${featureId}`, `the ${featureName(featureId, def)} (${def.description})${also(def.aka)}`);
  for (const c of comps) {
    const folders = c.id.split('/').slice(0, -1);
    folders.forEach((_, i) => {
      const path = folders.slice(0, i + 1).join('/');
      const under = comps.filter((o) => o.id.startsWith(`${path}/`)).map((o) => o.label);
      steps.set(`s:${featureId}/${path}`, `the ${featureName(folders[i])} of the ${featureName(featureId, def)}, which holds: ${under.join('; ')}${also(def.folderAka?.[path])}`);
      stepNames.set(`s:${featureId}/${path}`, [featureName(folders[i]), ...(def.folderAka?.[path] ?? [])]);
    });
  }
  if (comps.length) for (const [id, description] of steps) out.push({ id, description, kind: 'step', names: stepNames.get(id) });
  for (const c of comps) {
    const can = (c.bugs ?? []).map((id) => def.bugs?.find((b) => b.id === id)).filter((b): b is BugDef => !!b).map((b) => fillSpec(b.when, spec));
    // the other parts are listed too, so a complaint about one of them isn't read as one about this
    const others = comps.filter((o) => o !== c).map((o) => o.label);
    const folders = c.id.split('/').slice(0, -1);
    const requires = [`s:${featureId}`, ...folders.map((_, i) => `s:${featureId}/${folders.slice(0, i + 1).join('/')}`)];
    out.push({ id: `c:${c.id}`, description: `${c.label}${also(c.aka, c.label)}, a part of the ${featureName(featureId, def)} (${def.description}).${can.length ? ` What can go wrong with it: ${can.join(' ')}` : ''}${others.length ? ` Other parts of the ${featureName(featureId, def)}, which are not this one: ${others.join('; ')}.` : ''}`, kind: 'component', requires, names: labelNames(c) });
  }
  // bugs no component claims are still matched on their own
  const claimed = new Set(comps.flatMap((c) => c.bugs ?? []));
  for (const b of def.bugs ?? []) if (!claimed.has(b.id)) out.push({ id: b.id, description: fillSpec(b.when, spec), kind: 'problem' });
  // the feature as a whole, for a prompt that says it's wrong without saying which part
  if (built && comps.length) out.push({ id: 'area', description: `The ${featureName(featureId, def)} (${def.description})${also(def.aka)}. Its parts, by path: ${comps.map((c) => `${componentPath(featureId, c.id, def)} (${c.label})`).join('; ')}.`, kind: 'area', names: featureNames });
  const brk = app.breaks.find((b) => b.featureId === featureId);
  const cat = brk && BREAK_CATEGORIES[brk.failure];
  if (brk && cat) out.push({ id: brk.failure, description: cat.replaceAll('{{feature}}', featureId), kind: 'problem', names: BREAK_NAMES[brk.failure] });
  return out;
}

/** The bug a subtle or deep break shows on the live site. */
export function breakVariant(brk: AppBreak, def: FeatureDef | undefined): string | undefined {
  if (brk.failure !== 'subtle' && brk.failure !== 'deep') return undefined;
  // a deep break shows one of the feature's deep bugs (the dead booking button); a subtle one any bug
  const all = def?.bugs ?? [];
  const shallow = all.filter((b) => !b.deep);
  const bugs = brk.failure === 'deep' ? all.filter((b) => b.deep) : shallow.length ? shallow : all;
  return brk.variant ?? (bugs.length ? bugs[(brk.seed ?? 0) % bugs.length].id : undefined);
}

/** Every bug the live app shows right now: its builds' own, plus what subtle and deep breaks show. */
export function liveBugs(app: AppInstance, tmpl: AppTemplate | undefined): Set<string> {
  const out = new Set<string>();
  for (const f of app.features) if (!f.correct) for (const b of bugsOf(f)) out.add(b);
  for (const brk of app.breaks) {
    const v = breakVariant(brk, tmpl?.features.find((d) => d.id === brk.featureId));
    if (v) out.add(v);
  }
  return out;
}

/** What a user app earns per day from the ads on it. */
export const userRevenue = (app: AppInstance) => Math.round((app.users ?? 0) * APPS.user.payPerUser);

/** The repo exists on Forkyard once the agent has pushed to it; taking the job alone doesn't create it. */
export const onForkyard = (app: AppInstance) => app.repoVersion > 0;

/** A required feature the agent still has work on: missing or wrong in the repo, or broken live. */
export function needsWork(app: AppInstance, featureId: string): boolean {
  const f = app.repo.find((x) => x.id === featureId);
  return !f || !f.correct || (app.deployed && app.breaks.some((b) => b.featureId === featureId));
}

/** The agent patches a live break on a feature whose code was fine. Live again on the next deploy. */
export function fixBreak(s: GameState, appId: string, featureId: string): boolean {
  const app = getApp(s, appId);
  if (!app || !app.breaks.some((b) => b.featureId === featureId)) return false;
  app.repoVersion++;
  s.commits.push({ day: s.values.day, repo: app.id, msg: `Fix ${featureId}`, kind: 'push' });
  return true;
}

const SCRIPTED_FAILURES: FailureKind[] = ['visible', 'subtle', 'failed_fetch'];

/** Force a break on a live app (a named one, else a random live app). Used for scripted breaks. */
export function scriptedBreak(s: GameState, appId?: string, content?: Content): void {
  const live = s.apps.filter((a) => a.deployed && !a.churned && !quiet(a));
  const app = appId ? live.find((a) => a.id === appId) : live.length ? pick(s, live) : undefined;
  if (!app) return;
  const candidates = app.features.filter((f) => f.correct);
  if (!candidates.length) return;
  const victim = pick(s, candidates);
  let failure = pick(s, SCRIPTED_FAILURES);
  let variant: string | undefined;
  if (failure === 'subtle') {
    // a subtle break shows one of the feature's bugs: only one that can show now (without the posts
    // to check, the ones that depend on them don't count), else the page crashes instead
    const tmpl = content?.apps[app.template];
    const def = tmpl?.features.find((d) => d.id === victim.id);
    const view: View = { s, app, content };
    const shallow = (def?.bugs ?? []).filter((b) => !b.deep && canSee(s, app, tmpl, b.id, content, view) && (content || app.template !== 'sentiment'));
    if (def?.bugs?.length && !shallow.length) failure = 'visible';
    else if (shallow.length) variant = pick(s, shallow).id;
  }
  breakFeature(s, app, victim.id, failure, true, variant);
  log(s, `${app.name} broke (${victim.id}).`, 'break');
}

/**
 * The agent attempts a fix on one feature. If `featureId` names a real problem (and, with a prompt,
 * the prompt names the actual bug), the fix re-rolls the level chance (so it can still come out
 * wrong). A vague prompt changes something else; a wrong target fixes nothing.
 */
export function fixApp(s: GameState, appId: string, featureId: string | null, level: number, ctx: BuildCtx = {}, report: BuildReport = { vague: [], hallucinated: [] }): boolean {
  const app = getApp(s, appId);
  if (!app || !featureId) return false;
  if (!repoProblem(app, featureId)) return false;
  const f = attempt(s, app, featureId, level, ctx, report);
  recordFixed(app, app.repo.find((x) => x.id === featureId), f);
  const idx = app.repo.findIndex((x) => x.id === featureId);
  if (idx >= 0) app.repo[idx] = f;
  else app.repo.push(f);
  app.repoVersion++;
  s.commits.push({ day: s.values.day, repo: app.id, msg: report.vague.length ? `Check ${featureId}` : `Fix ${featureId}`, kind: 'push' });
  return f.correct;
}

function repoProblem(app: AppInstance, featureId: string): boolean {
  if (!app.required.includes(featureId)) return false;
  const f = app.repo.find((x) => x.id === featureId);
  return !f || !f.correct;
}

/** Deploy the repo: it becomes live, runtime breaks reset, build mistakes carry over. */
export function deployApp(s: GameState, appId: string, tmpl?: AppTemplate, content?: Content): void {
  const app = getApp(s, appId);
  if (!app || app.churned) return;
  // the player's very first deploy always ships something to catch
  if (tmpl && !s.apps.some((a) => a.deployedVersion > 0)) firstBug(s, app, tmpl, content);
  // an app that starts empty gets its first content a while after it first goes live, never after 20:00
  if (tmpl?.firstContentAfter && app.contentAt == null) app.contentAt = postingTime(playMinutes(s), tmpl.firstContentAfter);
  app.features = app.repo.map((f) => ({ ...f }));
  app.breaks = [];
  app.deployed = true;
  app.deployedVersion = app.repoVersion;
  app.lastDeployDay = s.values.day;
  app.lastDeployMin = s.clockMin;
  s.commits.push({ day: s.values.day, repo: app.id, msg: `Deploy ${app.name} v${app.repoVersion}`, kind: 'deploy' });
}

/**
 * A clean first deploy gets one bug the player can spot on the site: a shallow one (not deep) on a
 * built feature, never one the agent already fixed, and one that shows now. The repo carries it too,
 * so it stays until fixed. When none can show yet, the first one that can lands then (revealBugs).
 */
function firstBug(s: GameState, app: AppInstance, tmpl: AppTemplate, content?: Content): void {
  if (!app.repo.length || app.repo.some((f) => !f.correct)) return;
  const options = shallowOptions(s, app, tmpl, app.repo, content);
  if (!options.length) { app.owedBug = true; return; }
  const { fid, bug } = pick(s, options);
  app.repo = app.repo.map((f) => (f.id === fid ? { ...f, correct: false, variant: bug, also: undefined, seed: randInt(s, 0, 9999) } : f));
}

/** Shallow bugs the agent hasn't fixed before that would show on these built features right now. */
function shallowOptions(s: GameState, app: AppInstance, tmpl: AppTemplate, built: BuiltFeature[], content?: Content): { fid: string; bug: string }[] {
  const view: View = { s, app, content };
  return built.filter((f) => f.correct).flatMap((f) => (tmpl.features.find((d) => d.id === f.id)?.bugs ?? [])
    .filter((b) => !b.deep && !fixedOf(app, f.id).includes(b.id) && canSee(s, app, tmpl, b.id, content, view))
    .map((b) => ({ fid: f.id, bug: b.id })));
}

/**
 * Content appears on apps that started empty once its time has come; the bugs held back until then
 * land with it (revealBugs), and a live app that came out clean still gets one shallow bug, like any
 * first build. Runs as the clock moves; returns the apps whose content just appeared.
 */
export function wakeApps(s: GameState, content: Content): AppInstance[] {
  const woke: AppInstance[] = [];
  for (const app of s.apps) {
    const tmpl = content.apps[app.template];
    if (!tmpl?.firstContentAfter || app.contentAt == null || app.contentLive) continue;
    if (playMinutes(s) < app.contentAt) continue;
    app.contentLive = true;
    woke.push(app);
    // saves from before bugs were held per bug: builds made while empty roll theirs now
    const legacy = [...new Set([...app.repo, ...app.features].filter((f) => f.quietLevel != null).map((f) => f.id))];
    for (const id of legacy) {
      const level = [...app.features, ...app.repo].find((f) => f.id === id && f.quietLevel != null)!.quietLevel!;
      const bugs = rollBugs(s, tmpl.features.find((d) => d.id === id), level, fixedOf(app, id), []);
      for (const list of [app.repo, app.features]) {
        const f = list.find((x) => x.id === id);
        if (!f || f.quietLevel == null) continue;
        delete f.quietLevel;
        if (bugs.length) f.held = [...new Set([...(f.held ?? []), ...bugs])];
      }
    }
    if (app.deployed) app.owedBug = true;
  }
  revealBugs(s, content);
  return woke;
}

/**
 * The story's bugs for today (AppTemplate.storyBugs) go into the code of a live build of their feature,
 * repo and live alike, whatever the agent built or fixed before. They're held like any bug, so revealBugs
 * lands them once something shows them (the impostor's $VANT post for the auto-buy). Once a game each.
 */
function plantStoryBugs(s: GameState, content: Content): void {
  for (const app of s.apps) {
    if (!app.deployed || app.churned) continue;
    for (const sb of content.apps[app.template]?.storyBugs ?? []) {
      if (sb.day !== s.values.day || app.planted?.includes(sb.bug)) continue;
      if (!app.features.some((f) => f.id === sb.feature)) continue;
      app.planted = [...(app.planted ?? []), sb.bug];
      for (const f of [...app.repo, ...app.features]) {
        if (f.id !== sb.feature || (!f.correct && bugsOf(f).includes(sb.bug))) continue;
        f.held = [...new Set([...(f.held ?? []), sb.bug])];
      }
    }
  }
}

/**
 * Held bugs land once something in the game shows them (Crane's first praise for the auto-buy, a sold
 * listing for the sold badge), on the repo and the live build alike. An app that still owes its first
 * bug gets one shallow bug that shows, unless it already has one. Returns true if anything landed.
 */
export function revealBugs(s: GameState, content: Content): boolean {
  plantStoryBugs(s, content);
  let changed = false;
  for (const app of s.apps) {
    if (app.churned) continue;
    const tmpl = content.apps[app.template];
    const view: View = { s, app, content };
    for (const f of [...app.repo, ...app.features]) {
      if (!f.held?.length) continue;
      const now = f.held.filter((b) => canSee(s, app, tmpl, b, content, view));
      if (!now.length) continue;
      changed = true;
      const rest = f.held.filter((b) => !now.includes(b));
      f.held = rest.length ? rest : undefined;
      const bugs = [...(f.correct ? [] : bugsOf(f)), ...now];
      Object.assign(f, { correct: false, ...withBugs(bugs), seed: f.seed ?? randInt(s, 0, 9999) });
      if (bugs.includes('hallucinated')) f.params = undefined;
    }
    if (!app.owedBug || !tmpl) continue;
    // the build the player looks at: the live one once deployed, else the repo
    const shown = app.deployed ? app.features : app.repo;
    if (shown.some((f) => !f.correct) || (app.deployed && app.breaks.length)) { app.owedBug = undefined; continue; }
    const options = shallowOptions(s, app, tmpl, shown, content);
    if (!options.length) continue;
    const { fid, bug } = pick(s, options);
    const seed = randInt(s, 0, 9999);
    // the repo has the same code when it's what's deployed (or nothing is)
    const lists = !app.deployed ? [app.repo] : app.deployedVersion === app.repoVersion ? [app.features, app.repo] : [app.features];
    for (const list of lists) {
      const f = list.find((x) => x.id === fid);
      if (f?.correct) Object.assign(f, { correct: false, variant: bug, also: undefined, seed });
    }
    app.owedBug = undefined;
    changed = true;
  }
  return changed;
}

/**
 * Saves from before bugs were held: a rolled bug that can't show yet goes back to waiting, and a
 * subtle or deep break showing one is dropped (tonight's breaks land somewhere they show). Runs on load.
 */
export function holdHiddenBugs(s: GameState, content: Content): void {
  for (const app of s.apps) {
    const tmpl = content.apps[app.template];
    if (!tmpl) continue;
    const view: View = { s, app, content };
    const named = (fid: string) => new Set((tmpl.features.find((d) => d.id === fid)?.bugs ?? []).map((b) => b.id));
    for (const f of [...app.repo, ...app.features]) {
      if (f.correct || !f.variant) continue;
      const hidden = bugsOf(f).filter((b) => named(f.id).has(b) && !canSee(s, app, tmpl, b, content, view));
      if (!hidden.length) continue;
      const left = bugsOf(f).filter((b) => !hidden.includes(b));
      f.held = [...new Set([...(f.held ?? []), ...hidden])];
      if (left.length) Object.assign(f, withBugs(left));
      else Object.assign(f, { correct: true, variant: undefined, also: undefined, params: app.specParams[f.id] });
    }
    app.breaks = app.breaks.filter((b) => {
      const v = breakVariant(b, tmpl.features.find((d) => d.id === b.featureId));
      const hidden = !!v && !canSee(s, app, tmpl, v, content, view);
      // the feature was only wrong because of the break
      if (hidden) { const f = app.features.find((x) => x.id === b.featureId); if (f && !f.variant && !f.held) f.correct = true; }
      return !hidden;
    });
  }
}

/** Take a deployment offline. Counts as broken at payday. */
export function takeDownApp(s: GameState, appId: string): void {
  const app = getApp(s, appId);
  if (!app) return;
  app.deployed = false;
}

/** A live feature breaks: mark it wrong and record how it fails (for rendering). */
export function breakFeature(s: GameState, app: AppInstance, featureId: string, failure: FailureKind, scripted = false, variant?: string): void {
  const f = app.features.find((x) => x.id === featureId);
  if (f) f.correct = false;
  if (!app.breaks.some((b) => b.featureId === featureId)) {
    app.breaks.push({ featureId, failure, day: s.values.day, scripted, seed: randInt(s, 0, 9999), ...(variant ? { variant } : {}) });
  }
}

const FAILURES: FailureKind[] = ['visible', 'subtle', 'failed_fetch', 'deep'];

/**
 * Dev mode: switch one bug on or off on demand. A bug id (or 'hallucinated' / 'outdated') goes on
 * the repo build and, if deployed, the live one; a failure kind toggles a live break.
 */
/** The dev panel's key for a wrong build that has no named bug. */
export const UNNAMED_BUG = 'unnamed';

/**
 * Wrong builds saved before their template had named bugs get one now, so the site shows it and the
 * dev panel can say what it is. Runs on load.
 */
export function nameUnnamedBugs(s: GameState, content: Content): void {
  for (const app of s.apps) {
    const tmpl = content.apps[app.template];
    // features since dropped from the template (the crawler's top posts) leave the app entirely
    if (tmpl?.features.length) {
      const known = (id: string) => tmpl.features.some((d) => d.id === id);
      app.required = app.required.filter(known);
      app.repo = app.repo.filter((f) => known(f.id));
      app.features = app.features.filter((f) => known(f.id));
      app.breaks = app.breaks.filter((b) => known(b.featureId));
    }
    for (const f of [...app.repo, ...app.features]) {
      const bugs = tmpl?.features.find((d) => d.id === f.id)?.bugs ?? [];
      // a bug that has since been removed from the content counts as unnamed
      const known = (v: string) => v === 'outdated' || bugs.some((b) => b.id === v);
      if (bugs.length && f.also) f.also = f.also.filter(known).length ? f.also.filter(known) : undefined;
      if (bugs.length && f.variant && !known(f.variant)) f.variant = undefined;
      if (f.correct || f.variant || !bugs.length) continue;
      f.seed ??= 0;
      f.variant = bugs.filter((b) => !b.deep)[f.seed % Math.max(1, bugs.filter((b) => !b.deep).length)]?.id ?? bugs[0].id;
    }
  }
}

export function devToggleBug(s: GameState, appId: string, featureId: string, key: string): void {
  const app = getApp(s, appId);
  if (!app || !app.required.includes(featureId)) return;
  // nothing to break before the agent has built it: an unbuilt feature is just missing
  if (!app.repo.some((f) => f.id === featureId) && !app.features.some((f) => f.id === featureId)) return;
  if ((FAILURES as string[]).includes(key)) {
    if (!app.deployed) return;
    const had = app.breaks.some((b) => b.featureId === featureId && b.failure === key);
    app.breaks = app.breaks.filter((b) => b.featureId !== featureId);
    if (!had) app.breaks.push({ featureId, failure: key as FailureKind, day: s.values.day, scripted: true, seed: randInt(s, 0, 9999) });
    return;
  }
  const spec = app.specParams[featureId];
  if (key === UNNAMED_BUG) {
    // a wrong build with no named bug (a template without bugs): on and off as a whole
    const flip = (list: BuiltFeature[]) => {
      const f = list.find((x) => x.id === featureId);
      if (!f) list.push({ id: featureId, correct: false, params: spec, seed: randInt(s, 0, 9999) });
      else if (f.correct) Object.assign(f, { correct: false, seed: f.seed ?? randInt(s, 0, 9999) });
      else if (!f.variant) Object.assign(f, { correct: true, params: spec, also: undefined });
    };
    flip(app.repo);
    if (app.deployed) flip(app.features);
    return;
  }
  // switching a bug on by hand also lets the agent make it again
  if (app.fixed?.[featureId]) app.fixed[featureId] = app.fixed[featureId].filter((b) => b !== key);
  // one switch for repo and live together: on if either has it, so both always end up the same way
  const has = (list: BuiltFeature[]) => { const f = list.find((x) => x.id === featureId); return !!f && !f.correct && bugsOf(f).includes(key); };
  const on = !(has(app.repo) || (app.deployed && has(app.features)));
  const toggle = (list: BuiltFeature[]) => {
    let f = list.find((x) => x.id === featureId);
    if (!f) { f = { id: featureId, correct: true, params: spec }; list.push(f); }
    const now = f.correct ? [] : bugsOf(f).filter((b) => b !== key);
    const next = !on ? now : key === 'hallucinated' ? [key, ...now] : [...now, key];
    if (!next.length) Object.assign(f, { correct: true, params: spec, variant: undefined, also: undefined });
    else Object.assign(f, { correct: false, params: spec, ...withBugs(next), seed: f.seed ?? randInt(s, 0, 9999) });
  };
  toggle(app.repo);
  if (app.deployed) toggle(app.features);
}

/**
 * Overnight breaks, rolled for each live app on its own: how many of its components break follows
 * APPS.breakOdds (at least one, two, three). Each picks a component of that app that can still show
 * a new break; a feature breaks at most once (until the next deploy clears it). A build bug doesn't
 * shield a feature: it can still crash, or show a bug it doesn't already have.
 * A subtle or deep break shows one of that component's bugs, a crash or failed fetch takes the page.
 */
export function nightlyBreaks(s: GameState, content: Content): void {
  for (const app of s.apps) {
    if (!app.deployed || app.churned) continue;
    const tmpl = content.apps[app.template];
    if (quiet(app, tmpl)) continue; // nothing on it yet for a break to show on
    const view: View = { s, app, content };
    const pool: { def: FeatureDef; comp?: ComponentDef; options: ReturnType<typeof breakOptions> }[] = [];
    for (const f of app.features) {
      const def = tmpl?.features.find((d) => d.id === f.id);
      if (!def || app.breaks.some((b) => b.featureId === f.id)) continue;
      const has = new Set(f.correct ? [] : bugsOf(f));
      for (const comp of def.components?.length ? def.components : [undefined]) {
        // only bugs that would show now: the auto-buy can't misfire before Crane has posted
        const options = breakOptions(def, comp, has, (b) => canSee(s, app, tmpl, b, content, view));
        if (options.length) pool.push({ def, comp, options });
      }
    }
    if (!pool.length) continue;
    const r = rand(s);
    let count = APPS.breakOdds.filter((p) => r < p).length;
    while (count-- > 0 && pool.length) {
      const { def, comp, options } = pick(s, pool);
      const { failure, variants } = pick(s, options);
      breakFeature(s, app, def.id, failure, false, variants && pick(s, variants));
      log(s, `${app.name} broke overnight (${def.id}${comp ? `/${comp.id}` : ''}).`, 'break');
      // the rest of the night's breaks land on other features
      for (let i = pool.length - 1; i >= 0; i--) if (pool[i].def.id === def.id) pool.splice(i, 1);
    }
  }
}

/**
 * The ways one component can break and be seen: a crash or failed fetch always shows, a subtle or
 * deep break only with a bug of that kind the live build doesn't already have and that would show now
 * (the variants to pick from). A component with no bugs and no outage kind crashes instead; one whose bugs are all live
 * already can't break, so a break never lands where nothing would change.
 */
function breakOptions(def: FeatureDef, comp: ComponentDef | undefined, has: Set<string>, shows: (bug: string) => boolean): { failure: FailureKind; variants?: string[] }[] {
  const bugs = (comp?.bugs ?? []).map((id) => def.bugs?.find((b) => b.id === id)).filter((b): b is BugDef => !!b && !has.has(b.id) && shows(b.id));
  const kinds: FailureKind[] = def.failures.length ? def.failures : ['visible'];
  const out = kinds.map((failure) => {
    if (failure !== 'subtle' && failure !== 'deep') return { failure };
    return { failure, variants: bugs.filter((b) => !!b.deep === (failure === 'deep')).map((b) => b.id) };
  }).filter((o) => !o.variants || o.variants.length);
  if (out.length) return out;
  return comp?.bugs?.length ? [] : [{ failure: 'visible' }];
}

/** How often a client asks for an update, by app age. */
function updateInterval(ageDays: number): number {
  const c = APPS.updateCadence;
  if (ageDays <= c.earlyUntilDay) return c.earlyEvery;
  if (ageDays <= c.midUntilDay) return c.midEvery;
  return c.lateEvery;
}
export function scheduleNextUpdate(s: GameState, app: AppInstance): void {
  const age = s.values.day - app.createdDay;
  app.nextUpdateDueDay = s.values.day + updateInterval(age);
}

/**
 * Pay working apps; strike/churn broken client apps; apply user-app churn and growth. Returns a
 * complaint for each broken app (client email or Y post), to deliver in the morning. `paid` collects
 * each paying app's name and amount for the morning card.
 */
export function runPayday(s: GameState, content?: Content, paid?: [string, number][]): Complaint[] {
  const complaints: Complaint[] = [];
  for (const app of s.apps) {
    if (app.churned) continue;
    const working = appWorking(app);
    // read what's wrong before a firing takes the app offline
    const complaint = working ? null : complaintFor(app, content?.apps[app.template]);
    if (complaint) complaints.push(complaint);
    if (app.kind === 'client') {
      if (working) {
        money(s, app.payPerDay, `${app.name} · payout`);
        if (app.payPerDay) paid?.push([app.name, app.payPerDay]);
        app.brokenDays = 0;
        log(s, `${app.name} paid ${app.payPerDay} DOLR.`, 'money');
      } else {
        app.strikes++;
        app.brokenDays++;
        app.everBroken = true;
        if (app.clientEventId) { if (!s.flags.includes(`${app.clientEventId}_broke`)) { s.flags.push(`${app.clientEventId}_broke`); s.flags.sort(); } }
        log(s, `${app.name} was broken at payday (strike ${app.strikes}).`, 'warn');
        if (app.strikes >= APPS.strikesToChurn) {
          if (complaint) complaint.fired = true;
          app.churned = true;
          app.deployed = false;
          log(s, `${app.name} fired you. The app is retired.`, 'warn');
        }
      }
    } else if (app.kind === 'user') {
      if (working) {
        const pay = userRevenue(app);
        money(s, pay, `${app.name} · ${app.users} users`);
        if (pay) paid?.push([app.name, pay]);
        app.users = Math.round((app.users ?? 0) * (1 + APPS.user.growthPerDay));
        app.brokenDays = 0;
        log(s, `${app.name} earned ${pay} DOLR from ${app.users} users.`, 'money');
      } else {
        app.brokenDays++;
        if (app.brokenDays >= 2) {
          app.users = Math.round((app.users ?? 0) * APPS.user.secondBreakUsers);
          log(s, `${app.name} is effectively dead: users fled.`, 'warn');
        } else {
          app.users = Math.round((app.users ?? 0) * APPS.user.firstBreakUsersMul);
          log(s, `${app.name} broke: users dropped.`, 'warn');
        }
      }
    }
  }
  return complaints;
}
