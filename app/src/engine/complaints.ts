/*
 * Complaints about apps that were broken at payday. A client emails the player about what's wrong
 * with their app; a user app gets a post on Y from someone who used it. Both name the actual
 * problem on the live site (the bug the player could have spotted), in copy from the app template.
 */
import type { GameState, AppInstance, MailEntry } from './state';
import type { AppTemplate, Content } from '../content/schema';
import { breakVariant } from './apps';
import { pick } from './core';
import { menuDishes, misspell, parseDishes, WRONG_HOURS } from './restaurant';

/** One thing wrong with the live app: a feature and how it fails, or the whole app. */
export interface AppProblem {
  /** Feature id, or '' for the whole app (offline / stale). */
  featureId: string;
  /** Lookup keys for the complaint line, most specific first. */
  keys: string[];
  vars: Record<string, string>;
}

/** A complaint waiting to land in the morning (complaints are written at payday). */
export interface Complaint {
  appId: string;
  kind: 'mail' | 'y';
  fired?: boolean;
  problems: AppProblem[];
}

const MAX_LINES = 3;

/** What's wrong with the live app right now, feature by feature, in brief order. */
export function appProblems(app: AppInstance, tmpl: AppTemplate | undefined): AppProblem[] {
  if (!app.deployed) return [{ featureId: '', keys: ['offline'], vars: {} }];
  const out: AppProblem[] = [];
  for (const id of app.required) {
    const def = tmpl?.features.find((f) => f.id === id);
    const liveF = app.features.find((f) => f.id === id);
    const brk = app.breaks.find((b) => b.featureId === id);
    let variant: string | undefined;
    let keys: string[];
    if (brk) {
      variant = brk.failure === 'subtle' ? breakVariant(brk, def) : undefined;
      const fallback = brk.failure === 'visible' || brk.failure === 'failed_fetch' ? 'down' : 'wrong';
      keys = [...(variant ? [variant] : []), brk.failure, fallback];
    } else if (!liveF) {
      keys = ['missing'];
    } else if (!liveF.correct) {
      variant = liveF.variant;
      keys = [...(variant ? [variant] : []), 'wrong'];
    } else continue;
    const seed = brk?.seed ?? liveF?.seed ?? 0;
    const params = liveF?.params ?? app.specParams[id] ?? {};
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(app.specParams[id] ?? {})) vars[k] = String(v);
    if (app.template === 'restaurant' && variant) {
      const sub = restaurantDetail(app, id, variant, seed, params, vars);
      if (sub) keys.unshift(`${variant}:${sub}`);
    }
    out.push({ featureId: id, keys, vars });
  }
  if (!out.length && app.deployedVersion !== app.repoVersion) out.push({ featureId: '', keys: ['stale'], vars: {} });
  return out;
}

/** Fill {{shown}}/{{expected}} with what Gino's site actually shows. Returns a sub-case key, if any. */
function restaurantDetail(
  app: AppInstance, id: string, variant: string, seed: number,
  params: Record<string, string | number>, vars: Record<string, string>,
): string | undefined {
  if (id === 'landing') {
    const name = String(app.specParams.landing?.name ?? app.name);
    if (variant === 'name_wrong') { vars.shown = misspell(name, seed); vars.expected = name; }
    if (variant === 'hours_wrong') { vars.shown = WRONG_HOURS[seed % WRONG_HOURS.length]; vars.expected = String(params.hours ?? '').replace('-', '–'); }
    return undefined;
  }
  if (id !== 'menu') return undefined;
  const spec = parseDishes(app.specParams.menu?.dishes);
  const shown = menuDishes({ variant, seed, params }).dishes;
  if (variant === 'hallucinated') {
    vars.shown = shown.slice(0, 2).map((d) => d.name).join(' and ');
    return undefined;
  }
  if (variant !== 'wrong_items') return undefined;
  const has = (list: { name: string }[], n: string) => list.some((d) => d.name === n);
  const gone = spec.filter((d) => !has(shown, d.name));
  const extra = shown.filter((d) => !has(spec, d.name));
  if (gone.length && extra.length) { vars.expected = gone[0].name; vars.shown = extra[0].name; return 'renamed'; }
  if (gone.length) { vars.expected = gone[0].name; return 'removed'; }
  if (extra.length) { vars.shown = extra[0].name; return 'invented'; }
  return undefined;
}

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');

/** The complaint line for one problem, from the template's copy, else a plain generic line. */
export function problemLine(app: AppInstance, tmpl: AppTemplate | undefined, p: AppProblem): string {
  const vars = { app: app.name, ...p.vars };
  if (!p.featureId) {
    const c = tmpl?.complaints;
    const line = p.keys[0] === 'offline' ? c?.offline : c?.stale;
    return fill(line ?? (p.keys[0] === 'offline' ? `${app.name} is offline.` : `${app.name} isn't the latest version.`), vars);
  }
  const def = tmpl?.features.find((f) => f.id === p.featureId);
  const lines = def?.complaints ?? {};
  const key = p.keys.find((k) => lines[k]);
  if (key) return fill(lines[key], vars);
  const what = def?.description ?? p.featureId;
  if (p.keys.includes('missing')) return `${app.name} is supposed to ${what}. It doesn't.`;
  if (p.keys.includes('down')) return `The part of ${app.name} that should ${what} doesn't load.`;
  return `${app.name} doesn't ${what} the way it should.`;
}

/** Check one app at payday: if it's broken, a complaint for the morning. */
export function complaintFor(app: AppInstance, tmpl: AppTemplate | undefined, fired = false): Complaint | null {
  const problems = appProblems(app, tmpl);
  if (!problems.length) return null;
  return { appId: app.id, kind: app.kind === 'client' ? 'mail' : 'y', fired, problems };
}

function nextSeq(s: GameState): number {
  return s.nextId++;
}

/** Deliver the night's complaints: emails from clients, posts on Y about user apps. */
export function deliverComplaints(s: GameState, content: Content, complaints: Complaint[]): void {
  for (const c of complaints) {
    const app = s.apps.find((a) => a.id === c.appId);
    if (!app) continue;
    const tmpl = content.apps[app.template];
    const copy = tmpl?.complaints ?? {};
    const vars = { app: app.name };
    if (c.kind === 'mail') {
      const ev = content.events.find((e) => e.id === app.clientEventId);
      const lines = c.problems.slice(0, MAX_LINES).map((p) => problemLine(app, tmpl, p));
      const close = c.fired ? copy.fired ?? `That's two. I'm taking ${app.name} elsewhere.` : copy.outro ?? `I'm not paying for today.`;
      const body = [copy.intro ? fill(copy.intro, vars) : 'Hi,', ...lines, fill(close, vars)].join('\n\n');
      const seq = nextSeq(s);
      const mail: MailEntry = {
        id: `mail${seq}`, seq, folder: 'inbox', day: s.values.day,
        from: ev?.from ?? app.name, addr: ev?.addr ?? 'client@forkyard.test',
        subject: fill(copy.subject ?? `${app.name} is broken`, vars), body, read: false,
      };
      s.mail.push(mail);
    } else {
      const poster = copy.posters?.length ? pick(s, copy.posters) : { author: 'someone', handle: 'someone' };
      const seq = nextSeq(s);
      s.yExtra.push({
        id: `complaint${String(seq).padStart(5, '0')}`, author: poster.author, handle: poster.handle,
        text: problemLine(app, tmpl, c.problems[0]), day: s.values.day, likes: 4 + (seq * 7) % 40, about: app.id,
      });
    }
  }
}
