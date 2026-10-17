/*
 * The sites in the fake browser: their URLs, labels, and when they're reachable. Locked sites show
 * a "site not found" placeholder until a discovery flag is set (content will set these later).
 */
import type { GameState } from '../engine';
import { adSite } from './adSites';

export type SiteId =
  | 'y' | 'qmail' | 'qdrive' | 'coinbin' | 'sherwood' | 'doordish' | 'forkyard' | 'agent' | 'yowl'
  | 'weightroom' | 'nullboard' | 'cellar' | 'empire' | 'spinfeed' | 'phish' | 'prince' | 'lonely' | 'sorry' | 'adsite' | 'app' | 'newtab' | 'notfound';

export interface SiteDef {
  id: SiteId;
  base: string;
  label: string;
  /** 'web' sites are reachable by link or address but never bookmarked. */
  group: 'core' | 'tools' | 'underground' | 'web';
  reachable: (s: GameState) => boolean;
  /** Bookmarked only once the player has been there (typed the address), not when it's first heard of. */
  bookmarkAfterVisit?: (s: GameState) => boolean;
}

/** The flag set the first time the player opens a site that is bookmarked only after a visit. */
export const visitedFlag = (id: SiteId) => `visited_${id}`;

const always = () => true;
const flag = (f: string) => (s: GameState) => s.flags.includes(f);

export const SITES: SiteDef[] = [
  { id: 'agent', base: 'agent.chat', label: 'agent', group: 'core', reachable: always },
  { id: 'qmail', base: 'qmail.com', label: 'Qmail', group: 'core', reachable: always },
  { id: 'qdrive', base: 'qdrive.com', label: 'Qdrive', group: 'core', reachable: always },
  { id: 'y', base: 'y.com', label: 'Y', group: 'core', reachable: always },
  { id: 'yowl', base: 'yowl.com', label: 'Yowl', group: 'core', reachable: always },
  { id: 'coinbin', base: 'coinbin.com', label: 'Coinbin', group: 'core', reachable: always },
  { id: 'sherwood', base: 'sherwood.com', label: 'Sherwood', group: 'core', reachable: always },
  { id: 'doordish', base: 'doordish.com', label: 'DoorDish', group: 'core', reachable: always },
  { id: 'forkyard', base: 'forkyard.com', label: 'Forkyard', group: 'core', reachable: always },
  { id: 'weightroom', base: 'weightroom.ai', label: 'Weightroom', group: 'tools', reachable: flag('knows_weightroom'),
    bookmarkAfterVisit: (s) => s.flags.includes(visitedFlag('weightroom')) || s.flags.includes('has_terminal') },
  { id: 'nullboard', base: 'nullboard.onion', label: 'nullboard', group: 'underground', reachable: flag('knows_nullboard') },
  { id: 'cellar', base: 'cellar.onion', label: 'Cellar', group: 'underground', reachable: flag('knows_cellar') },
  { id: 'empire', base: 'empire.alphaascend.biz', label: 'EMPIRE', group: 'web', reachable: always },
  { id: 'spinfeed', base: 'spincycle.test', label: 'Spin Cycle feed', group: 'web', reachable: always },
  // the lookalike from the day 3 phishing mail (engine/phishing.ts)
  { id: 'phish', base: 'coinbln.com', label: 'Coinbin', group: 'web', reachable: always },
  // the seed-phrase scam from the Crypto Prince banner ad (engine/phishing.ts, seedClaim)
  { id: 'prince', base: 'prince-claims.xyz', label: 'Crypto Prince', group: 'web', reachable: always },
  // the dating chat from the Lonely.ai banner ad (engine/lonely.ts)
  { id: 'lonely', base: 'lonely.ai', label: 'Lonely.ai', group: 'web', reachable: always },
  // the apology chat from the SorryWriter banner ad (engine/sorry.ts)
  { id: 'sorry', base: 'sorrywriter.ai', label: 'SorryWriter', group: 'web', reachable: always },
];

export interface Route {
  site: SiteId;
  def?: SiteDef;
  /** sub-path param: a Y handle, a Forkyard repo, an app id (with its page, as id/page), or an ad site's URL. */
  param?: string;
  reachable: boolean;
}

const normalize = (u: string) =>
  u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

export function route(url: string, s: GameState): Route {
  const u = normalize(url);
  if (!u || u === 'newtab') return { site: 'newtab', reachable: true };

  // deployed app URLs: <something>.forkyard.app
  const appMatch = u.match(/^([a-z0-9-]+\.forkyard\.app)(?:\/(\S+))?$/);
  if (appMatch) {
    const app = s.apps.find((a) => a.url === appMatch[1]);
    return { site: 'app', param: app && (appMatch[2] ? `${app.id}/${appMatch[2]}` : app.id), reachable: !!app && app.deployed };
  }

  // a banner ad's landing page (sites/adSites.ts), always reachable
  if (adSite(u)) return { site: 'adsite', param: u, reachable: true };

  for (const def of SITES) {
    if (u === def.base || u.startsWith(def.base + '/')) {
      const param = u.length > def.base.length ? u.slice(def.base.length + 1) : undefined;
      return { site: def.id, def, param, reachable: def.reachable(s) };
    }
  }
  return { site: 'notfound', reachable: false };
}

export const bookmarks = (s: GameState): SiteDef[] =>
  SITES.filter((d) => d.group !== 'web' && d.reachable(s) && (!d.bookmarkAfterVisit || d.bookmarkAfterVisit(s)));
