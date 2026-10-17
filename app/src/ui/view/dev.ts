/*
 * The dev panel.
 */
import { GameStore } from '../../game/store';
import { MISSES } from '../../game/misses';
import { JEV } from '../../game/backendJev';
import { appWorking, LAST_DAY } from '../../engine';
import { esc } from './common';

// ── dev panel ──
export function devHtml(store: GameStore): string {
  const s = store.state;
  const m = s.values;
  const meters = `leash ${m.leash} · misuse ${m.misuseScore} · suspicion ${m.suspicion} · null ${m.nullStanding} · mafia ${m.mafiaStanding} · family ${m.familyTrust} · heritage ${m.heritageStanding} · progress ${m.progressStanding}`;
  return `<header><b>jev · dev</b><button data-act="dev">×</button></header>
    <p><b>Day</b> ${m.day} · <b>Agent</b> L${m.agentLevel} · <b>Followers</b> ${m.followers}</p>
    <p><b>Meters</b> <span class="dv-dim">${esc(meters)}</span></p>
    <div class="dv-row"><b>Clock</b><button data-dev="hold" class="${store.clockHeld ? 'on' : ''}">${store.clockHeld ? 'Start clock' : 'Stop clock'}</button><button data-dev="skip">+1 hour</button><button data-dev="rewind" title="Back to 10:00: today's mail and posts arrive again">Rewind day</button></div>
    <div class="dv-row"><button data-dev="money">+$100</button><button data-dev="followers">+50 followers</button><button data-act="devtab" data-devtab="edit" class="${store.ui.devEdit && store.ui.devTab === 'edit' ? 'on' : ''}">Flags and meters…</button><button data-act="devtab" data-devtab="jev" class="${store.ui.devEdit && store.ui.devTab === 'jev' ? 'on' : ''}">Jev tests…</button></div>
    <form class="dv-row" data-form="dev-day"><label>Go to day <input id="dev-day" type="number" min="1" max="${LAST_DAY}" value="${Math.min(LAST_DAY, m.day + 1)}"></label><button type="submit">Go</button><span class="dv-dim">skips the nights: no payday, rent or bills</span></form>
    <p><b>Flags</b> <code>${esc(s.flags.join(', ') || 'none')}</code></p>
    <p><b>Apps</b> <code>${esc(s.apps.map((a) => `${a.name}:${appWorking(a) ? 'ok' : a.deployed ? 'check' : 'undeployed'}`).join(' · ') || 'none')}</code></p>
    <p><b>Mode</b> ${esc(MISSES.settings.net)}</p>
    <p><b>Jev</b> ${MISSES.offline ? 'keyword matcher (offline)' : esc(JEV.mode) + (JEV.reason ? ' · ' + esc(JEV.reason) : '')}</p>
    <p><b>Misses</b> ${MISSES.scriptedMisses ? 'scripted' : esc(MISSES.settings.misses) + ' · ' + esc(MISSES.settings.haikuVia)}</p>`;
}
