/*
 * The player's own screens, as a tool for Haiku's answers to agent.chat queries. The game state lives
 * in the browser, so it sends what Qmail, Y, Yowl, CityPulse, Forkyard and Coinbin show right now
 * with each query (ui/queryView.ts); nothing here is more than the player can already see.
 */

const MAX_SITE = 3000;
const STOP = new Set('the and for with what who whom whose where when which that this from about does did into your you are was were his her its their have has had how why any some tell more info information know there is are can could would should my me i a an of to in on at it be do say said'.split(' '));
function terms(query) {
  return [...new Set(String(query).toLowerCase().match(/[a-z0-9$@][a-z0-9_.$'@-]*/g) ?? [])]
    .map((t) => t.replace(/^[@$]/, '').replace(/['.]+$/, '').replace(/'s$/, ''))
    .filter((t) => t.length >= 2 && !STOP.has(t));
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stem = (t) => (t.length > 4 ? t.replace(/(es|s)$/, '') : t);

export const SITES = ['qmail', 'y', 'yowl', 'citypulse', 'forkyard', 'coinbin'];

const when = (x) => `day ${x.day}${x.time ? ` ${x.time}` : ''}`;
const cut = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t; };

/** What one of the player's sites shows, newest first, optionally only entries matching `search`. */
export function readSite(view, site, search = '') {
  if (!view || typeof view !== 'object') return 'That site could not be read right now.';
  const ts = terms(search);
  const match = (s) => !ts.length || ts.some((t) => new RegExp(`\\b${escRe(stem(t))}`, 'i').test(s));
  const list = (rows, fmt, empty) => {
    const lines = (Array.isArray(rows) ? rows : []).map(fmt).filter(match);
    if (!lines.length) return ts.length ? `Nothing on ${site} matches "${search}".` : empty;
    let out = '';
    for (const l of lines) {
      if (out.length + l.length > MAX_SITE) { out += '(older entries cut)'; break; }
      out += `${l}\n`;
    }
    return out.trim();
  };
  switch (site) {
    case 'qmail': return list(view.mail, (m) => m.folder === 'sent'
      ? `[${when(m)}] SENT to ${cut(m.to, 60)}, "${cut(m.subject, 80)}": ${cut(m.body, 400)}`
      : `[${when(m)}] FROM ${cut(m.from, 60)} <${cut(m.addr, 60)}>, "${cut(m.subject, 80)}"${m.unread ? ' (unread)' : ''}: ${cut(m.body, 500)}`, 'The inbox is empty.');
    case 'y': return list(view.y, (p) => `[${when(p)}] ${p.mine ? 'THE PLAYER' : cut(p.author, 40)} @${cut(p.handle, 30)}: ${cut(p.text, 300)}`, 'Nothing on Y yet.');
    case 'yowl': return list(view.yowl, (r) => `${cut(r.business, 60)}: ${r.stars}★ by ${r.mine ? 'THE PLAYER' : cut(r.author, 40)}${r.day ? ` (day ${r.day})` : ''}: ${cut(r.text, 300)}`, 'No reviews.');
    case 'citypulse': return list(view.citypulse, (a) => `[${when(a)}] ${cut(a.title, 140)}. ${cut(a.dek, 240)}`, 'No articles up yet.');
    case 'forkyard': return list(view.apps, (a) => `${cut(a.name, 60)} (${cut(a.url, 80)}): ${a.deployed ? 'live' : 'not deployed yet'}${a.client ? `, built for ${cut(a.client, 40)}` : ''}${a.users != null ? `, ${a.users} users` : ''}`, 'The player has no repos on Forkyard yet.');
    case 'coinbin': {
      const w = view.wallet ?? {};
      const head = `Balance ${w.dolr ?? '?'} DOLR. Y followers ${w.followers ?? '?'}. Model agent-${w.model ?? '?'}.${w.rent ? ` Rent of ${w.rent.amount} DOLR is due on day ${w.rent.day}.` : ''}`;
      const tx = list(view.tx, (t) => `[${when(t)}] ${t.amount > 0 ? '+' : ''}${t.amount} DOLR, ${cut(t.memo, 80)}`, 'No transactions.');
      return `${head}\nRecent transactions:\n${tx}`;
    }
    default: return `No site called "${String(site).slice(0, 30)}". Sites: ${SITES.join(', ')}.`;
  }
}

/** The tools Haiku gets for a query. The player never sees them: only the final text goes back. */
export const QUERY_TOOLS = [
  {
    name: 'check_site',
    description: "Read what the player's own screens show right now: qmail (their inbox and sent mail), y (the Y timeline so far, the player's own posts included), yowl (business reviews, the player's included), citypulse (news articles up so far), forkyard (the player's apps and whether they're live), coinbin (balance, followers, rent, recent transactions). Optionally only entries matching a search.",
    input_schema: {
      type: 'object',
      properties: { site: { type: 'string', enum: SITES }, search: { type: 'string', description: 'Optional: a name or keyword to filter by.' } },
      required: ['site'],
    },
  },
];

/** Runs one tool call. */
export function runQueryTool(name, input, view) {
  if (name === 'check_site') return readSite(view, String(input?.site ?? ''), String(input?.search ?? '').slice(0, 80));
  return `Unknown tool ${name}.`;
}
