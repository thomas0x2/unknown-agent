/*
 * Button actions: deploy, take down, waitlist sign-ups, the EMPIRE subscription.
 */
import type { GameState } from '../state';
import type { Content } from '../../content/schema';
import { clone, log, money, pushMail, sendLater } from '../core';
import { applyEffects } from '../effects';
import { queueLaunch, queueFeatureLaunch } from '../events';
import { deployApp as deployAppCore, takeDownApp as takeDownCore, getApp, bugsOf, breakVariant } from '../apps';
import { waitlistPlace, waitlistStart, fmtCount } from '../startup';
import { PLAYER_ADDR, nextId } from './shared';

export function deploy(s0: GameState, appId: string, content?: Content): GameState {
  // a client that cancelled took the app with it
  if (getApp(s0, appId)?.churned) return s0;
  const s = clone(s0);
  const app = getApp(s, appId);
  const first = !!app && app.deployedVersion === 0;
  deployAppCore(s, appId, app && content?.apps[app.template], content);
  // a client's site going live for the first time: what waits on its launch is on its way
  if (first && app?.clientEventId && content) queueLaunch(s, content, app.clientEventId);
  // and what waits on one of its features going live (Crane's $APO post tests the new auto-buy)
  if (app?.clientEventId && content) queueFeatureLaunch(s, content, app.clientEventId, app.features.map((f) => f.id));
  log(s, `Deployed ${getApp(s, appId)?.name ?? appId}.`, 'info');
  return s;
}

export function takeDown(s0: GameState, appId: string): GameState {
  const s = clone(s0);
  takeDownCore(s, appId);
  log(s, `Took down ${getApp(s, appId)?.name ?? appId}.`, 'warn');
  return s;
}

/**
 * The player joins the waitlist on a startup app. What happens follows the waitlist feature's live
 * bugs: a dead button, a counter that starts at zero or never moves, no or a wrong confirmation.
 */
export function joinWaitlist(s0: GameState, appId: string, email: string, content?: Content): GameState {
  const s = clone(s0);
  const app = getApp(s, appId);
  if (!app || !app.deployed) return s;
  const feat = app.features.find((f) => f.id === 'waitlist');
  if (!feat) return s;
  const def = content?.apps[app.template]?.features.find((f) => f.id === 'waitlist');
  const brk = app.breaks.find((b) => b.featureId === 'waitlist');
  if (brk?.failure === 'visible') return s; // the page is an error screen
  const bugs = new Set(feat.correct ? [] : bugsOf(feat));
  const shown = brk && breakVariant(brk, def);
  if (shown) bugs.add(shown);
  if (!feat.correct && !bugs.size) bugs.add('no_email'); // wrong in some unnamed way: nothing arrives
  if (bugs.has('dead_button')) return s; // nothing happens
  delete s.waitlistNotice;
  const addr = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
    s.waitlistNotice = { appId, ok: false, text: 'Enter a valid email address.' };
    return s;
  }
  s.waitlist.push({ id: nextId(s, 'wl'), appId, email: addr, day: s.values.day });
  const n = s.waitlist.filter((w) => w.appId === appId).length;
  const place = waitlistPlace(waitlistStart(app.specParams.waitlist), n, bugs);
  s.waitlistNotice = { appId, ok: true, text: "You're on the list. Check your inbox." };
  if (bugs.has('no_email')) return s;
  const name = String(app.specParams.landing?.name ?? app.name);
  const body = `You're #${fmtCount(place)} on the ${name} waitlist.\n\nWe'll let you know when it's your turn. Want to move up? Share ${app.url} with a friend.`;
  if (bugs.has('sent_to_founder')) {
    // the sign-up gets nothing; the founder gets their confirmation
    const ev = content?.events.find((e) => e.id === app.clientEventId);
    if (addr === PLAYER_ADDR && ev?.addr) {
      pushMail(s, { folder: 'inbox', day: s.values.day, from: ev.from ?? app.name, addr: ev.addr, subject: 'fwd: waitlist', read: false,
        body: `got this from the site:\n\n"${body.split('\n')[0]}"\n\nit came to me, not to them. i'm not on the waitlist. i'm the founder.` });
    }
    return s;
  }
  if (addr === PLAYER_ADDR) {
    pushMail(s, { folder: 'inbox', day: s.values.day, from: name, addr: `waitlist@${app.url}`, subject: `You're on the ${name} waitlist`, body, read: false });
  }
  return s;
}

// ── Alpha Ascend: Max Stryker's EMPIRE sign-up page ──

/** `welcomeAfter`: game minutes between paying and the welcome email landing. */
export const EMPIRE = { price: 20, flag: 'guru_subscriber', addr: 'max@alphaascend.test', welcomeAfter: 3 } as const;

/** Pay for EMPIRE on empire.alphaascend.biz. Does nothing if already a member or short of DOLR. */
export function joinEmpire(s0: GameState): GameState {
  const s = clone(s0);
  if (s.flags.includes(EMPIRE.flag) || s.values.crypto < EMPIRE.price) return s;
  money(s, -EMPIRE.price, 'Alpha Ascend · EMPIRE');
  applyEffects(s, { setFlags: [EMPIRE.flag] });
  sendLater(s, {
    folder: 'inbox', day: s.values.day, from: 'Max Stryker · Alpha Ascend', addr: EMPIRE.addr,
    subject: 'Welcome to EMPIRE',
    body: 'Payment received. Welcome to the 1%.\n\nYour first lesson arrives tomorrow at 4am. Refunds are available to anyone who completes the course.',
    read: false,
  }, EMPIRE.welcomeAfter);
  return s;
}
