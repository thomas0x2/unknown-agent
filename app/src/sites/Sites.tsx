/*
 * Site views. The core sites are now interactive: Qmail reads/replies/composes, Y shows the feed and
 * takes posts, agent.chat briefs and fixes apps, Forkyard deploys, and app URLs render a checkable
 * page. Jev (or the offline fallback) judges every free-text action.
 */
import { useState } from 'react';
import { useGame } from '../game/useGame';
import { agentCost, appWorking, getApp, type AppInstance } from '../engine';
import type { GameEvent } from '../content/schema';
import { type Route } from './registry';

export function SiteView({ route }: { route: Route }) {
  if (!route.reachable) return <NotFound site={route.def?.base} />;
  switch (route.site) {
    case 'agent': return <Agent />;
    case 'qmail': return <Qmail />;
    case 'y': return <Y />;
    case 'satchel': return <Satchel />;
    case 'forkyard': return <Forkyard />;
    case 'app': return <AppView appId={route.param} />;
    case 'yowl': return <Placeholder name="Yowl" tag="reviews" />;
    case 'weightroom': return <Placeholder name="Weightroom" tag="local models" />;
    case 'terminal': return <Placeholder name="Terminal" tag="localhost" />;
    case 'nullboard': return <Placeholder name="nullboard" tag="login required" underground />;
    case 'cellar': return <Placeholder name="Cellar" tag="market" underground />;
    default: return <NotFound site={route.def?.base} />;
  }
}

function NotFound({ site }: { site?: string }) {
  return (
    <div className="notfound">
      <div className="glitch">⚠ site not found</div>
      <div>{site ? `${site} isn't reachable yet.` : 'Nothing here.'}</div>
      <div className="muted">You may not have discovered it.</div>
    </div>
  );
}

function Placeholder({ name, tag, underground }: { name: string; tag: string; underground?: boolean }) {
  return (
    <div className="page">
      <h1 style={underground ? { color: 'var(--hot)' } : undefined}>{name}</h1>
      <p className="sub">{tag}</p>
      <div className="card muted">This site is reachable, but it has no content wired yet.</div>
    </div>
  );
}

function fill(text: string | undefined): string {
  return (text ?? '').replace(/\{\{playerName\}\}/g, 'you');
}

// ── agent.chat: brief and fix apps ──
function Agent() {
  const store = useGame();
  const state = store.state;
  const c = agentCost(state.values.agentLevel);
  const apps = state.apps.filter((a) => !a.churned);
  const [sel, setSel] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [note, setNote] = useState('');
  const current = sel || apps[0]?.id || '';
  const app = current ? getApp(state, current) : undefined;

  async function build() {
    if (!app || !prompt.trim()) return;
    const res = await store.build(app.id, prompt);
    setNote(res.charged ? `Built: ${res.requested.join(', ') || 'nothing matched'}. Deploy it on Forkyard, then check it.` : 'Could not charge — agent is locked.');
    setPrompt('');
  }
  async function fix() {
    if (!app || !prompt.trim()) return;
    const res = await store.fix(app.id, prompt);
    setNote(res.target ? `Attempted a fix on ${res.target}. Re-check the app.` : 'I couldn\'t tell which feature you meant. Be specific.');
    setPrompt('');
  }

  return (
    <div className="page">
      <h1>agent</h1>
      <p className="sub">GeneralAI · level {state.values.agentLevel}{state.agentLocked ? ' · LOCKED (unpaid)' : ''} · {c.prompt}/prompt + {c.word}/word</p>
      {apps.length === 0 ? (
        <div className="card muted">No projects yet. Find a client on <b>Y</b> or in <b>Qmail</b>, agree to build their app, then come back to brief me.</div>
      ) : (
        <>
          <div className="card">
            <div className="row">
              <b>Project</b>
              <select className="text" style={{ width: 'auto' }} value={current} onChange={(e) => setSel(e.target.value)}>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {app && (
              <div className="muted" style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12 }}>
                wanted: {app.required.join(', ')} · repo v{app.repoVersion}{app.deployed ? ` · deployed v${app.deployedVersion}` : ' · not deployed'}
              </div>
            )}
          </div>
          <div className="card">
            <textarea rows={3} value={prompt} placeholder="Describe what to build or fix. Name the features and details." onChange={(e) => setPrompt(e.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              <span className="muted">{note}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={fix}>Fix</button>
                <button className="btn" onClick={build}>Build</button>
              </span>
            </div>
          </div>
          <p className="muted">Check the brief in Qmail, build here, deploy on Forkyard, then open the app and compare it to the spec.</p>
        </>
      )}
    </div>
  );
}

// ── Qmail ──
function Qmail() {
  const store = useGame();
  const state = store.state;
  const inbox = state.delivered
    .filter((d) => d.site === 'qmail')
    .map((d) => ({ d, ev: store.content.events.find((e) => e.id === d.eventId) }))
    .filter((x) => x.ev)
    .reverse();
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  if (composing) return <Compose onDone={() => setComposing(false)} />;
  const open = inbox.find((x) => x.d.eventId === openId);
  if (open && open.ev) return <Thread ev={open.ev} answered={open.d.answered} onBack={() => setOpenId(null)} />;

  return (
    <div className="page">
      <div className="row">
        <h1>Qmail</h1>
        <button className="btn" onClick={() => setComposing(true)}>Compose</button>
      </div>
      <p className="sub">Inbox</p>
      {inbox.length === 0 && <div className="empty">No mail yet.</div>}
      {inbox.map(({ d, ev }) => (
        <button key={d.eventId + d.day} className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpenId(d.eventId)}>
          <div className="row">
            <b>{ev!.from ?? 'Unknown'}</b>
            <span className="pill">{ev!.outcomes && !d.answered ? 'needs reply' : `day ${d.day}`}</span>
          </div>
          <div className="muted">{ev!.subject}</div>
        </button>
      ))}
    </div>
  );
}

function Thread({ ev, answered, onBack }: { ev: GameEvent; answered: boolean; onBack: () => void }) {
  const store = useGame();
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [done, setDone] = useState(answered);

  async function send() {
    if (!text.trim()) return;
    const res = await store.reply(ev.id, text);
    setReply(res.decision.kind === 'nothing' ? '(no useful reply)' : res.reply || '(replied)');
    if (res.decision.kind === 'outcome') setDone(true);
    setText('');
  }

  return (
    <div className="page">
      <p className="y-back"><button className="btn ghost" onClick={onBack}>← Inbox</button></p>
      <div className="card">
        <div className="row"><b>{ev.from}</b><span className="muted">{ev.addr}</span></div>
        <div className="muted" style={{ margin: '2px 0 10px' }}>{ev.subject}</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{fill(ev.body)}</p>
      </div>
      {reply && <div className="card"><div className="muted">Reply</div><p style={{ whiteSpace: 'pre-wrap' }}>{reply}</p></div>}
      {ev.outcomes && !done && (
        <div className="card">
          <textarea rows={3} value={text} placeholder="Write your reply…" onChange={(e) => setText(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">One message per person until they reply.</span>
            <button className="btn" onClick={send}>Send</button>
          </div>
        </div>
      )}
      {done && <p className="muted">Answered.</p>}
    </div>
  );
}

function Compose({ onDone }: { onDone: () => void }) {
  const store = useGame();
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');

  async function send() {
    if (!to.trim() || !body.trim()) return;
    const res = await store.compose(to, body);
    if (!res.sent) setNote(`You've already emailed ${to.trim()} today.`);
    else if (res.reply) setNote(`Reply: ${res.reply}`);
    else setNote('Sent. No reply came back.');
  }

  return (
    <div className="page">
      <p className="y-back"><button className="btn ghost" onClick={onDone}>← Inbox</button></p>
      <h1>New message</h1>
      <div className="card">
        <input className="text" placeholder="To (email address)" value={to} onChange={(e) => setTo(e.target.value)} />
        <textarea style={{ marginTop: 8 }} rows={5} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <span className="muted">{note}</span>
          <button className="btn" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ── Y ──
function Y() {
  const store = useGame();
  const state = store.state;
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const trending = store.content.trending[state.values.day] ?? [];
  const feed = state.delivered
    .filter((d) => d.site === 'y')
    .map((d) => store.content.events.find((e) => e.id === d.eventId))
    .filter((e): e is GameEvent => !!e)
    .reverse();

  async function post() {
    if (!text.trim()) return;
    const { rating, followerDelta } = await store.post(text, trending);
    setNote(`${rating.category}: ${followerDelta >= 0 ? '+' : ''}${followerDelta} followers`);
    setText('');
  }

  return (
    <div className="page">
      <div className="row">
        <h1>Y</h1>
        <span className="muted">{state.values.followers} followers · {state.postsToday} posts today</span>
      </div>
      {trending.length > 0 && (
        <div className="card">
          <h2>Trending</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {trending.map((t, i) => <span key={i} className="pill">{t}</span>)}
          </div>
        </div>
      )}
      <div className="card">
        <textarea rows={2} value={text} placeholder="Post to the timeline" onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <span className="muted">{note}</span>
          <button className="btn" onClick={post}>Post</button>
        </div>
      </div>
      {feed.length === 0 && <div className="empty">Quiet timeline.</div>}
      {feed.map((e) => (
        <div className="card" key={e.id}>
          <div className="row"><b>{e.from ?? 'someone'}</b></div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{fill(e.body)}</p>
          {e.addr && <div className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>contact: {e.addr}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Satchel ──
function Satchel() {
  const { state } = useGame();
  const ledger = state.log.filter((e) => e.kind === 'money' || e.kind === 'warn').slice(-14).reverse();
  return (
    <div className="page">
      <h1>Satchel</h1>
      <p className="sub">Wallet</p>
      <div className="card">
        <div className="muted" style={{ fontSize: 11, letterSpacing: '0.08em' }}>BALANCE</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 30, color: 'var(--neon)' }}>
          {state.values.crypto.toFixed(2)} <span style={{ fontSize: 16, color: 'var(--dim)' }}>DOLR</span>
        </div>
      </div>
      <div className="card">
        <h2>Recent</h2>
        <div className="log">
          {ledger.length === 0 && <span className="muted">No activity yet.</span>}
          {ledger.map((e, i) => <span key={i} className={e.kind}>day {e.day} · {e.text}</span>)}
        </div>
      </div>
    </div>
  );
}

// ── Forkyard ──
function Forkyard() {
  const store = useGame();
  const state = store.state;
  if (state.apps.length === 0) {
    return (
      <div className="page">
        <h1>Forkyard</h1>
        <p className="sub">Repositories</p>
        <div className="empty">No repositories. Brief the agent to build something.</div>
      </div>
    );
  }
  return (
    <div className="page">
      <h1>Forkyard</h1>
      <p className="sub">Deployments</p>
      {state.apps.map((a: AppInstance) => {
        const working = appWorking(a);
        const stale = a.deployed && a.deployedVersion !== a.repoVersion;
        return (
          <div className="card" key={a.id}>
            <div className="row">
              <b>{a.name}</b>
              {a.churned ? <span className="pill off">retired</span>
                : a.deployed ? <span className={`pill ${working ? 'on' : 'off'}`}>{working ? 'live · working' : 'live · check it'}</span>
                : <span className="pill">not deployed</span>}
            </div>
            <div className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
              {a.url} · repo v{a.repoVersion}{a.deployed ? ` · deployed v${a.deployedVersion}` : ''}{stale ? ' · new commit, redeploy' : ''}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="muted">{a.kind}{a.kind === 'client' ? ` · ${a.payPerDay}/day` : ''}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {!a.churned && <button className="btn" onClick={() => store.deploy(a.id)}>Deploy</button>}
                {a.deployed && <button className="btn danger" onClick={() => store.takeDown(a.id)}>Take down</button>}
                {a.deployed && <button className="btn ghost" onClick={() => store.navigate(a.url)}>Open</button>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── a deployed app: the page the player checks against the spec ──
function AppView({ appId }: { appId?: string }) {
  const { state } = useGame();
  const app = appId ? getApp(state, appId) : undefined;
  if (!app || !app.deployed) return <NotFound site="app" />;
  return (
    <div className="page">
      <h1>{app.name}</h1>
      <p className="sub">{app.url}</p>
      {app.features.length === 0 && <div className="empty">Blank page. Nothing was built here.</div>}
      {app.features.map((f) => (
        <div className="card" key={f.id}>
          <div className="row">
            <b>{f.id}</b>
            <span className={`pill ${f.correct ? 'on' : 'off'}`}>{f.correct ? 'looks right' : 'looks wrong'}</span>
          </div>
          {app.breaks.filter((b) => b.featureId === f.id).map((b, i) => (
            <div key={i} className="muted" style={{ color: 'var(--bad)' }}>break: {b.failure}</div>
          ))}
        </div>
      ))}
      <p className="muted">Compare this against the client's spec in Qmail. Prompt the agent to fix what's wrong.</p>
    </div>
  );
}
