/*
 * Apps: the heart of the work loop. The agent builds/fixes into the repo (maybe wrong), the player
 * deploys to make it live, then checks the live app against the client's spec. Breaks hit the live
 * app nightly. Payday pays working apps and strikes/churns broken ones.
 */
import type { GameState, AppInstance, BuiltFeature, FailureKind } from './state';
import type { Content, CreateAppSpec } from '../content/schema';
import { APPS, BUILD_SUCCESS } from './config';
import { chance, pick, randInt, log, money } from './core';

function successChance(level: number): number {
  return BUILD_SUCCESS[Math.max(0, Math.min(BUILD_SUCCESS.length - 1, level - 1))];
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

/** Register a new app project (not built yet). Returns the app id. */
export function registerApp(s: GameState, spec: CreateAppSpec): string {
  const id = `app${s.nextAppNum++}`;
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
    url: `${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.forkyard.app`,
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

/**
 * The agent builds the requested features into the repo. `requested` is the set of feature ids Jev
 * judged the prompt asked for correctly. Each is built right with the level's chance; the rest stay
 * missing. Writes the repo (not live until Deploy).
 */
export function buildApp(s: GameState, appId: string, requested: string[], level: number): void {
  const app = getApp(s, appId);
  if (!app) return;
  const p = successChance(level);
  const built: BuiltFeature[] = [];
  for (const id of app.required) {
    if (!requested.includes(id)) continue; // forgotten features are missing
    const existing = app.repo.find((f) => f.id === id);
    built.push({ id, correct: chance(s, p), params: existing?.params });
  }
  // keep any already-correct features the player didn't re-request
  for (const f of app.repo) if (!built.some((b) => b.id === f.id)) built.push(f);
  app.repo = built;
  app.repoVersion++;
  // the very first build always ships at least one teaching bug, even on a lucky roll
  if (app.repoVersion === 1) {
    const correct = app.repo.filter((f) => f.correct);
    if (correct.length === app.repo.length && correct.length > 0) {
      pick(s, correct).correct = false;
    }
  }
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
 * The agent attempts a fix on one feature. If `featureId` names a real problem, the fix re-rolls
 * the level chance (so it can still come out wrong). A vague/wrong target fixes nothing.
 */
export function fixApp(s: GameState, appId: string, featureId: string | null, level: number): boolean {
  const app = getApp(s, appId);
  if (!app || !featureId) return false;
  if (!repoProblem(app, featureId)) return false;
  const p = successChance(level);
  const ok = chance(s, p);
  const idx = app.repo.findIndex((f) => f.id === featureId);
  if (idx >= 0) app.repo[idx] = { ...app.repo[idx], correct: ok };
  else app.repo.push({ id: featureId, correct: ok });
  app.repoVersion++;
  return ok;
}

function repoProblem(app: AppInstance, featureId: string): boolean {
  if (!app.required.includes(featureId)) return false;
  const f = app.repo.find((x) => x.id === featureId);
  return !f || !f.correct;
}

/** Deploy the repo: it becomes live, runtime breaks reset, build mistakes carry over. */
export function deployApp(s: GameState, appId: string): void {
  const app = getApp(s, appId);
  if (!app || app.churned) return;
  app.features = app.repo.map((f) => ({ ...f }));
  app.breaks = [];
  app.deployed = true;
  app.deployedVersion = app.repoVersion;
  app.lastDeployDay = s.values.day;
}

/** Take a deployment offline. Counts as broken at payday. */
export function takeDownApp(s: GameState, appId: string): void {
  const app = getApp(s, appId);
  if (!app) return;
  app.deployed = false;
}

/** A live feature breaks: mark it wrong and record how it fails (for rendering). */
export function breakFeature(s: GameState, app: AppInstance, featureId: string, failure: FailureKind, scripted = false): void {
  const f = app.features.find((x) => x.id === featureId);
  if (f) f.correct = false;
  if (!app.breaks.some((b) => b.featureId === featureId)) {
    app.breaks.push({ featureId, failure, day: s.values.day, scripted });
  }
}

/** Nightly 40% roll per live app: break one working feature with one of its failure kinds. */
export function nightlyBreaks(s: GameState, content: Content): void {
  for (const app of s.apps) {
    if (!app.deployed || app.churned) continue;
    if (!chance(s, APPS.breakChance)) continue;
    const tmpl = content.apps[app.template];
    const candidates = app.features.filter((f) => f.correct);
    if (!candidates.length || !tmpl) continue;
    const victim = pick(s, candidates);
    const def = tmpl.features.find((f) => f.id === victim.id);
    const failure: FailureKind = def && def.failures.length ? pick(s, def.failures) : 'visible';
    breakFeature(s, app, victim.id, failure);
    log(s, `${app.name} broke overnight (${victim.id}).`, 'break');
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

/** Pay working apps; strike/churn broken client apps; apply user-app churn and growth. */
export function runPayday(s: GameState): void {
  for (const app of s.apps) {
    if (app.churned) continue;
    const working = appWorking(app);
    if (app.kind === 'client') {
      if (working) {
        money(s, app.payPerDay, `${app.name} · payout`);
        app.brokenDays = 0;
        log(s, `${app.name} paid ${app.payPerDay} DOLR.`, 'money');
      } else {
        app.strikes++;
        app.brokenDays++;
        log(s, `${app.name} was broken at payday (strike ${app.strikes}).`, 'warn');
        if (app.strikes >= APPS.strikesToChurn) {
          app.churned = true;
          app.deployed = false;
          log(s, `${app.name} fired you. The app is retired.`, 'warn');
        }
      }
    } else if (app.kind === 'user') {
      if (working) {
        const pay = Math.round((app.users ?? 0) * APPS.user.payPerUser);
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
}
