/*
 * Apps: the heart of the work loop. The agent builds/fixes into the repo (maybe wrong), the player
 * deploys to make it live, then checks the live app against the client's spec. Breaks hit the live
 * app nightly. Payday pays working apps and strikes/churns broken ones.
 */
import type { GameState, AppInstance, AppBreak, BuiltFeature, FailureKind } from './state';
import type { Content, CreateAppSpec, AppTemplate, FeatureDef, ComponentDef, BugDef } from '../content/schema';
import { APPS, COMPONENT_BUG_CHANCE } from './config';
import { chance, pick, randInt, rand, log, money } from './core';
import { complaintFor, type Complaint } from './complaints';

function bugChance(level: number): number {
  return COMPONENT_BUG_CHANCE[Math.max(0, Math.min(COMPONENT_BUG_CHANCE.length - 1, level - 1))];
}

export function getApp(state: GameState, id: string): AppInstance | undefined {
  return state.apps.find((a) => a.id === id);
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

/** A random bug for a wrong build, skipping the ones already fixed. All of them fixed: undefined. */
function wrongVariant(s: GameState, def: FeatureDef | undefined, fixed: string[] = []): Pick<BuiltFeature, 'variant' | 'seed'> | undefined {
  const bugs = def?.bugs ?? [];
  if (!bugs.length) return { variant: undefined, seed: randInt(s, 0, 9999) }; // a template with no named bugs: just wrong
  const pool = bugs.filter((b) => !fixed.includes(b.id));
  return pool.length ? { variant: pick(s, pool).id, seed: randInt(s, 0, 9999) } : undefined;
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
      return v === 'outdated' ? (ctx.named ?? []).includes('outdated') || hasDetails || (def ? promptHasChange(said!, detailValues(existing.params, def, true), detailValues(spec, def, true)) : false)
        : (ctx.named ?? []).includes(v) || spelled;
    };
    const all = bugsOf(existing);
    const left = all.filter((v) => !isAddressed(v));
    if (left.length === all.length) { report.vague.push(id); return { ...existing }; }
    // the named bugs are fixed; the ones nobody mentioned stay
    if (left.length) return { ...existing, ...(left.includes('outdated') ? {} : { params: spec }), ...withBugs(left) };
    return { id, correct: true, params: spec };
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
  const bugs = [...sure, ...rollBugs(s, def, level, fixed, sure)];
  if (invented) {
    report.hallucinated.push(id);
    return { id, correct: false, ...withBugs(bugs), seed: randInt(s, 0, 9999), checked };
  }
  if (bugs.length) return { id, correct: false, params: spec, ...withBugs(bugs), seed: randInt(s, 0, 9999), checked };
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
    : worked.length ? `Update ${worked.join(', ')}` : `Tidy up ${requested.join(', ') || app.name} styling`;
  s.commits.push({ day: s.values.day, repo: app.id, msg, kind: 'push' });
  // the very first build always ships at least one teaching bug, even on a lucky roll
  if (app.repoVersion === 1) {
    const correct = app.repo.filter((f) => f.correct);
    if (correct.length === app.repo.length && correct.length > 0) {
      const preferred = correct.filter((f) => ctx.tmpl?.features.find((d) => d.id === f.id)?.firstBuildBug);
      const victim = pick(s, preferred.length ? preferred : correct);
      const wrong = wrongVariant(s, ctx.tmpl?.features.find((d) => d.id === victim.id), fixedOf(app, victim.id));
      if (wrong) Object.assign(victim, { correct: false, ...wrong });
    }
  }
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
}

/** The feature as a player would name it: 'auto_buy' is the auto buy. */
export const featureName = (fid: string) => fid.replaceAll('_', ' ');

/** A component's path as a player names it, step by step: 'booking/confirmation/date' is "booking > confirmation > date". */
export const componentPath = (fid: string, cid: string) => [fid, ...cid.split('/')].map(featureName).join(' > ');

/** The components that can hold bugs: the ones a fix prompt can name. */
export const fixableComponents = (def: FeatureDef | undefined): ComponentDef[] => (def?.components ?? []).filter((c) => c.bugs?.length);

/** Jev's matches on a feature as the bugs they name: a component stands for every bug in it. */
export function componentBugs(def: FeatureDef | undefined, cats: string[]): string[] {
  return [...new Set(cats.flatMap((c) => c.startsWith('c:') ? def?.components?.find((x) => x.id === c.slice(2))?.bugs ?? [] : [c]))];
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
  const out: FixCategory[] = [{ id: 'feature', description: def.description, kind: 'build' }];
  // the client changed what this feature should contain: asking for that change is feature work
  const built = app.repo.find((f) => f.id === featureId);
  if (built && !built.correct && bugsOf(built).includes('outdated')) {
    const now = detailValues(app.specParams[featureId], def, true).join('; ');
    out.push({ id: 'outdated', description: `Change ${def.description} to the client's new version${now ? ` (${now})` : ''}. The prompt has to say what exactly changes: which items are swapped, added or removed, or which prices change and to what ("swap Diavola for Quattro Formaggi at 15"). Asking to update it without saying what changes ("update the menu items and prices") doesn't count.`, kind: 'build' });
  }
  // a fix has to say which part is wrong: one item per component, described by what can go wrong in it
  const spec = app.specParams[featureId];
  const comps = fixableComponents(def);
  // the path to each component: the feature, then each folder. Each step is its own simple question
  // ("does the prompt name the booking?"), and a component needs every step on its path named
  const steps = new Map<string, string>();
  steps.set(`s:${featureId}`, `the ${featureName(featureId)} (${def.description})`);
  for (const c of comps) {
    const folders = c.id.split('/').slice(0, -1);
    folders.forEach((_, i) => {
      const path = folders.slice(0, i + 1).join('/');
      const under = comps.filter((o) => o.id.startsWith(`${path}/`)).map((o) => o.label);
      steps.set(`s:${featureId}/${path}`, `the ${featureName(folders[i])} of the ${featureName(featureId)}, which holds: ${under.join('; ')}`);
    });
  }
  if (comps.length) for (const [id, description] of steps) out.push({ id, description, kind: 'step' });
  for (const c of comps) {
    const can = (c.bugs ?? []).map((id) => def.bugs?.find((b) => b.id === id)).filter((b): b is BugDef => !!b).map((b) => fillSpec(b.when, spec));
    // the other parts are listed too, so a complaint about one of them isn't read as one about this
    const others = comps.filter((o) => o !== c).map((o) => o.label);
    const folders = c.id.split('/').slice(0, -1);
    const requires = [`s:${featureId}`, ...folders.map((_, i) => `s:${featureId}/${folders.slice(0, i + 1).join('/')}`)];
    out.push({ id: `c:${c.id}`, description: `${c.label}, a part of the ${featureName(featureId)} (${def.description}).${can.length ? ` What can go wrong with it: ${can.join(' ')}` : ''}${others.length ? ` Other parts of the ${featureName(featureId)}, which are not this one: ${others.join('; ')}.` : ''}`, kind: 'component', requires });
  }
  // bugs no component claims are still matched on their own
  const claimed = new Set(comps.flatMap((c) => c.bugs ?? []));
  for (const b of def.bugs ?? []) if (!claimed.has(b.id)) out.push({ id: b.id, description: fillSpec(b.when, spec), kind: 'problem' });
  // the feature as a whole, for a prompt that says it's wrong without saying which part
  if (built && comps.length) out.push({ id: 'area', description: `The ${featureName(featureId)} (${def.description}). Its parts, by path: ${comps.map((c) => `${componentPath(featureId, c.id)} (${c.label})`).join('; ')}.`, kind: 'area' });
  const brk = app.breaks.find((b) => b.featureId === featureId);
  const cat = brk && BREAK_CATEGORIES[brk.failure];
  if (brk && cat) out.push({ id: brk.failure, description: cat.replaceAll('{{feature}}', featureId), kind: 'problem' });
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
export function scriptedBreak(s: GameState, appId?: string): void {
  const live = s.apps.filter((a) => a.deployed && !a.churned);
  const app = appId ? live.find((a) => a.id === appId) : live.length ? pick(s, live) : undefined;
  if (!app) return;
  const candidates = app.features.filter((f) => f.correct);
  if (!candidates.length) return;
  const victim = pick(s, candidates);
  breakFeature(s, app, victim.id, pick(s, SCRIPTED_FAILURES), true);
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
  s.commits.push({ day: s.values.day, repo: app.id, msg: report.vague.length ? `Tidy up ${featureId} styling` : `Fix ${featureId}`, kind: 'push' });
  return f.correct;
}

function repoProblem(app: AppInstance, featureId: string): boolean {
  if (!app.required.includes(featureId)) return false;
  const f = app.repo.find((x) => x.id === featureId);
  return !f || !f.correct;
}

/** Deploy the repo: it becomes live, runtime breaks reset, build mistakes carry over. */
export function deployApp(s: GameState, appId: string, tmpl?: AppTemplate): void {
  const app = getApp(s, appId);
  if (!app || app.churned) return;
  // the player's very first deploy always ships something to catch
  if (tmpl && !s.apps.some((a) => a.deployedVersion > 0)) firstBug(s, app, tmpl);
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
 * built feature, never one the agent already fixed. The repo carries it too, so it stays until fixed.
 */
function firstBug(s: GameState, app: AppInstance, tmpl: AppTemplate): void {
  if (!app.repo.length || app.repo.some((f) => !f.correct)) return;
  const options = app.repo.flatMap((f) => (tmpl.features.find((d) => d.id === f.id)?.bugs ?? [])
    .filter((b) => !b.deep && !fixedOf(app, f.id).includes(b.id))
    .map((b) => ({ fid: f.id, bug: b.id })));
  if (!options.length) return;
  const { fid, bug } = pick(s, options);
  app.repo = app.repo.map((f) => (f.id === fid ? { ...f, correct: false, variant: bug, also: undefined, seed: randInt(s, 0, 9999) } : f));
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
 * Overnight breaks: how many components break across all live apps follows APPS.breakOdds (at least
 * one, two, three). Each picks a working component at random; a feature breaks at most once a night.
 * A subtle or deep break shows one of that component's bugs, a crash or failed fetch takes the page.
 */
export function nightlyBreaks(s: GameState, content: Content): void {
  const r = rand(s);
  let count = APPS.breakOdds.filter((p) => r < p).length;
  const pool: { app: AppInstance; def: FeatureDef; comp?: ComponentDef }[] = [];
  for (const app of s.apps) {
    if (!app.deployed || app.churned) continue;
    const tmpl = content.apps[app.template];
    for (const f of app.features) {
      const def = tmpl?.features.find((d) => d.id === f.id);
      if (!f.correct || !def || app.breaks.some((b) => b.featureId === f.id)) continue;
      for (const comp of def.components?.length ? def.components : [undefined]) pool.push({ app, def, comp });
    }
  }
  while (count-- > 0 && pool.length) {
    const { app, def, comp } = pick(s, pool);
    const bugs = (comp?.bugs ?? []).map((id) => def.bugs?.find((b) => b.id === id)).filter((b): b is BugDef => !!b);
    const shallow = bugs.filter((b) => !b.deep), deep = bugs.filter((b) => b.deep);
    // only failures this component can show: a deep one needs a deep bug, a subtle one a shallow bug
    const kinds = (def.failures.length ? def.failures : ['visible' as FailureKind]).filter((k) => (k !== 'deep' || deep.length) && (k !== 'subtle' || shallow.length));
    const failure: FailureKind = kinds.length ? pick(s, kinds) : 'visible';
    const variant = failure === 'deep' ? pick(s, deep).id : failure === 'subtle' ? pick(s, shallow).id : undefined;
    breakFeature(s, app, def.id, failure, false, variant);
    log(s, `${app.name} broke overnight (${def.id}${comp ? `/${comp.id}` : ''}).`, 'break');
    // the rest of the night's breaks land on other features
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i].app === app && pool[i].def.id === def.id) pool.splice(i, 1);
  }
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
 * complaint for each broken app (client email or Y post), to deliver in the morning.
 */
export function runPayday(s: GameState, content?: Content): Complaint[] {
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
