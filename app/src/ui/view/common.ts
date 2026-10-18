/*
 * Helpers every page uses: escaping, money, number and clock formats, avatars, links, tab titles.
 */
import { type Route } from '../../sites/registry';
import { type GameState, RENT, clockTime } from '../../engine';
import { adSiteTitle } from '../adSites';
import { handleOf, PLAYER_WALLET } from '../../engine';
import { Y_AVATARS } from '../y-avatars';

export const WALLET_ADDR = PLAYER_WALLET;

export const PLAYER = { name: 'You', handle: 'you', addr: 'you@qmail.com' };

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function fmtMoney(n: number) { return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function compact(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function hashHue(s: string) { let h = 0; for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 360; }

export function avatar(name: string, handle: string) {
  if (Y_AVATARS[handle]) return `<div class="av av-pic">${Y_AVATARS[handle]}</div>`;
  const initials = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return `<div class="av" style="--h:${hashHue(handle)}">${esc(initials)}</div>`;
}

export const handleFrom = handleOf;

export const br = (t: string) => esc(t).replace(/\n/g, '<br>');

export const tpl = (t: string) => String(t ?? '').replace(/\{\{\s*playerName\s*\}\}/g, 'you').replace(/\{\{\s*\w+\s*\}\}/g, '');

export function linkify(escaped: string): string {
  return escaped
    .replace(/([a-z0-9-]+\.forkyard\.app)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(empire\.alphaascend\.biz(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(spincycle\.test\/feed(?:\/\d+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(matchless\.com)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(coinbln\.com(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(?<![@\w.])(thecurrent\.test(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(citypulse\.news(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(pollymarket\.com(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(?<![@\w.])((?:doordish|sherwood|stack)\.com(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(?<![@\w.])((?:perdure|ozempra|fluvera|pug|a67x|glamdring|purevial)\.com)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(?<![@\w.])(lumi\.events(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(^|[^\w.])@([a-z0-9_]+)/gi, '$1<a href="#" class="y-at" data-nav="y.com/$2">@$2</a>');
}

export function tabTitle(r: Route, url: string): string {
  const names: Partial<Record<string, string>> = {
    newtab: 'New Tab', y: 'Home / Y', qmail: 'Qmail', qdrive: 'Qdrive', coinbin: 'Coinbin', sherwood: 'Sherwood', doordish: 'DoorDish', phish: 'Coinbin · Sign in', prince: 'Crypto Prince', lonely: 'Lonely.ai', matchless: 'Matchless', sorry: 'SorryWriter', current: 'The Current', citypulse: 'CityPulse', pollymarket: 'Pollymarket', stack: 'Stack', forkyard: 'Forkyard',
    agent: 'agent', yowl: 'Yowl', weightroom: 'Weightroom', nullboard: 'nullboard', cellar: 'Cellar', app: url,
  };
  if (r.site === 'notfound') return url || 'New Tab';
  if (r.site === 'adsite') return adSiteTitle(r.param ?? '') ?? url;
  return names[r.site] ?? r.def?.label ?? url;
}

export const rentDayOf = (s: GameState) => Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= s.values.day);

export const fmtClock = clockTime;
