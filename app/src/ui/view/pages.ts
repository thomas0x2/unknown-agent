/*
 * Page dispatch: which page function draws a route.
 */
import { pageWiki } from '../wiki';
import { GameStore } from '../../game/store';
import { type Route } from '../../sites/registry';
import { pageDrive } from '../qdrive';
import { pageSherwood } from '../sherwood';
import { pageDoorDish } from '../doordish';
import { pageAdSite } from '../adSites';
import { pagePrince } from '../prince';
import { pageLonely } from '../lonely';
import { pageMatchless } from '../matchless';
import { pageSorry } from '../sorry';
import { pageCurrent } from '../current';
import { pageWhyC } from '../whyc';
import { outplacementUpload, OUTPLACEMENT } from '../outplacement';
import { setHeadline } from '../ads';
import { pageCityPulse } from '../citypulse';
import { pagePollymarket } from '../pollymarket';
import { pageStack } from '../stack';
import { hotStory } from '../../engine';
import { pageAgent, pageModels } from './agent';
import { pagePhish, pageWallet } from './coinbin';
import { pageApp, pageForkyard } from './forkyard';
import { pageEmpire, pageError, pageNewTab, pageSpinFeed, pageUnderground } from './misc';
import { pageMail } from './qmail';
import { pageWeightroom } from './terminal';
import { pageY } from './y';
import { pageYowl } from './yowl';

// ── page dispatch ──
export function page(store: GameStore, r: Route): string {
  if (!r.reachable) return pageError(store.url, r.site);
  const hot = hotStory(store.state);
  setHeadline(hot?.ad && { slug: hot.slug, frames: hot.ad, fine: hot.adFine, robot: hot.slug.startsWith('robot') });
  switch (r.site) {
    case 'newtab': return pageNewTab(store);
    case 'qmail': return pageMail(store, r.param);
    case 'qdrive': return pageDrive(store.state, r.param);
    case 'y': return pageY(store, r.param);
    case 'coinbin': return pageWallet(store);
    case 'sherwood': return pageSherwood(store, r.param);
    case 'doordish': return pageDoorDish(store, r.param);
    case 'forkyard': return pageForkyard(store, r.param);
    case 'app': return pageApp(store, r.param);
    case 'agent': return r.param === 'models' ? pageModels(store) : pageAgent(store);
    case 'yowl': return pageYowl(store, r.param);
    case 'weightroom': return pageWeightroom(store);
    case 'empire': return pageEmpire(store.state);
    case 'spinfeed': return pageSpinFeed(store, r.param);
    case 'phish': return pagePhish(store);
    case 'prince': return pagePrince(store);
    case 'lonely': return pageLonely(store);
    case 'matchless': return pageMatchless(store);
    case 'sorry': return pageSorry(store);
    case 'current': return pageCurrent(store.state, r.param);
    case 'whyc': return pageWhyC(r.param, store.ui.adNotice);
    case 'adsite': return pageAdSite(r.param ?? '', store.state, store.ui.adNotice, r.param === OUTPLACEMENT ? outplacementUpload(store) : '');
    case 'citypulse': return pageCityPulse(store, r.param);
    case 'pollymarket': return pagePollymarket(store, r.param);
    case 'stack': return pageStack(store);
    case 'wiki': return pageWiki(store, r.param);
    default: return pageUnderground(r.def?.label ?? r.site);
  }
}
