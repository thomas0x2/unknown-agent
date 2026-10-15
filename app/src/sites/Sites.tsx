/*
 * Site views. Core sites read and drive engine state; sites with no content yet show a clear
 * placeholder. These are deliberately plain — the slice is the shell and the wiring, not the art.
 */
import { useState } from 'react';
import { useGame } from '../game/useGame';
import { agentCost, appWorking, getApp, type GameState } from '../engine';
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

function Agent() {
  const { state } = useGame();
  const c = agentCost(state.values.agentLevel);
  return (
    <div className="page">
      <h1>agent</h1>
      <p className="sub">GeneralAI · model level {state.values.agentLevel}{state.agentLocked ? ' · LOCKED (unpaid)' : ''}</p>
      <div className="card">
        <p>I build software, write things, and read the web for you. Every prompt is billed to your
        Satchel wallet. Be specific.</p>
        <p className="muted">Subscription {c.sub}/day · {c.prompt}/prompt · {c.word}/word.</p>
      </div>
      <div className="card muted">
        To start, open <b>Qmail</b> — a client is usually waiting. Build their app on a brief, deploy
        it on <b>Forkyard</b>, then check it against what they asked for.
      </div>
    </div>
  );
}

function Qmail() {
  const store = useGame();
  const state = store.state;
  const inbox = state.delivered
    .filter((d) => d.site === 'qmail')
    .map((d) => ({ d, ev: store.content.events.find((e) => e.id === d.eventId) }))
    .reverse();
  return (
    <div className="page">
      <h1>Qmail</h1>
      <p className="sub">Inbox</p>
      {inbox.length === 0 && <div className="empty">No mail yet.</div>}
      {inbox.map(({ d, ev }) => (
        <div className="card" key={d.eventId}>
          <div className="row">
            <b>{ev?.from ?? 'Unknown'}</b>
            <span className="pill">{d.answered ? 'answered' : `day ${d.day}`}</span>
          </div>
          <div className="muted">{ev?.subject}</div>
          {ev?.body && <p style={{ whiteSpace: 'pre-wrap' }}>{ev.body}</p>}
        </div>
      ))}
    </div>
  );
}

function Y() {
  const store = useGame();
  const state = store.state;
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  async function post() {
    if (!text.trim()) return;
    const { rating, followerDelta } = await store.post(text, []);
    setNote(`${rating.category}: ${followerDelta >= 0 ? '+' : ''}${followerDelta} followers`);
    setText('');
  }
  return (
    <div className="page">
      <h1>Y</h1>
      <p className="sub">{state.values.followers} followers · {state.postsToday} posts today</p>
      <div className="card">
        <textarea rows={3} value={text} placeholder="Post to the timeline" onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <span className="muted">{note}</span>
          <button className="btn" onClick={post}>Post</button>
        </div>
      </div>
      <div className="empty">The feed is empty until content is wired.</div>
    </div>
  );
}

function money(entry: GameState['log'][number]) {
  return entry.kind === 'money' || entry.kind === 'warn';
}

function Satchel() {
  const { state } = useGame();
  const ledger = state.log.filter(money).slice(-12).reverse();
  return (
    <div className="page">
      <h1>Satchel</h1>
      <p className="sub">Wallet</p>
      <div className="card">
        <div className="lbl muted" style={{ fontSize: 11, letterSpacing: '0.08em' }}>BALANCE</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 30, color: 'var(--neon)' }}>
          {state.values.crypto.toFixed(2)} <span style={{ fontSize: 16, color: 'var(--dim)' }}>DOLR</span>
        </div>
      </div>
      <div className="card">
        <h2>Recent</h2>
        <div className="log">
          {ledger.length === 0 && <span className="muted">No activity yet.</span>}
          {ledger.map((e, i) => (
            <span key={i} className={e.kind}>day {e.day} · {e.text}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      {state.apps.map((a) => {
        const working = appWorking(a);
        return (
          <div className="card" key={a.id}>
            <div className="row">
              <b>{a.name}</b>
              {a.churned ? <span className="pill off">retired</span>
                : a.deployed ? <span className={`pill ${working ? 'on' : 'off'}`}>{working ? 'live · working' : 'live · check it'}</span>
                : <span className="pill">not deployed</span>}
            </div>
            <div className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
              {a.url} · repo v{a.repoVersion}{a.deployed ? ` · deployed v${a.deployedVersion}` : ''}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="muted">{a.kind} · {a.required.length} features{a.kind === 'client' ? ` · ${a.payPerDay}/day` : ''}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {!a.churned && <button className="btn" onClick={() => store.deploy(a.id)}>Deploy</button>}
                {a.deployed && <button className="btn danger" onClick={() => store.takeDown(a.id)}>Take down</button>}
                {a.deployed && <a className="btn ghost" href="#" onClick={(e) => { e.preventDefault(); store.navigate(a.url); }}>Open</a>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
            <span className={`pill ${f.correct ? 'on' : 'off'}`}>{f.correct ? 'ok' : 'looks wrong'}</span>
          </div>
          {app.breaks.filter((b) => b.featureId === f.id).map((b, i) => (
            <div key={i} className="muted" style={{ color: 'var(--bad)' }}>break: {b.failure}</div>
          ))}
        </div>
      ))}
      <p className="muted">Compare this against the client's spec in Qmail.</p>
    </div>
  );
}
