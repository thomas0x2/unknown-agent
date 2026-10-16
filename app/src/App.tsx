import { useEffect, useState } from 'react';
import { useGame } from './game/useGame';
import { route, bookmarks } from './sites/registry';
import { SiteView } from './sites/Sites';
import { RENT } from './engine';

const ENDING_TITLES: Record<string, string> = {
  outbreak: 'Outbreak',
  botnet: 'Botnet',
  account_terminated: 'Account Terminated',
  loose_end: 'Loose End',
  raided: 'Raided',
  evicted: 'Evicted',
  the_regime: 'The Regime',
  open_weights: 'Open Weights',
  got_away: 'Got Away With It',
  clean_modest: 'Clean but Modest',
};

function nextRentDay(day: number): number | null {
  const days = Object.keys(RENT).map(Number).sort((a, b) => a - b);
  return days.find((d) => d >= day) ?? null;
}

export default function App() {
  const store = useGame();
  const state = store.state;
  const [draft, setDraft] = useState(store.url);
  useEffect(() => setDraft(store.url), [store.url]);

  const r = route(store.url, state);
  const nextRent = nextRentDay(state.values.day);
  const rentAmt = nextRent ? RENT[nextRent] : 0;
  const cryptoLow = rentAmt > 0 && state.values.crypto < rentAmt;

  function go(url: string) {
    store.navigate(url);
  }

  return (
    <div className="browser">
      <div className="chrome">
        <div className="chrome-row">
          <div className="urlbar">
            <span className="lock">{r.reachable ? '●' : '⚠'}</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') go(draft); }}
              spellCheck={false}
              aria-label="Address bar"
            />
          </div>
          <button className="btn ghost" onClick={() => go(draft)}>Go</button>
        </div>
        <div className="bookmarks">
          {bookmarks(state).map((b) => (
            <button
              key={b.id}
              className={`bm ${b.group === 'underground' ? 'underground' : ''} ${r.def?.id === b.id ? 'active' : ''}`}
              onClick={() => go(b.base)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="viewport" data-site={r.reachable ? r.site : 'notfound'}>
        <SiteView route={r} />
      </div>

      <div className="statusbar">
        <span className="stat"><span className="lbl">Day</span><b>{state.values.day}/21</b></span>
        <span className={`stat crypto ${cryptoLow ? 'low' : ''}`}><span className="lbl">DOLR</span><b>{state.values.crypto.toFixed(2)}</b></span>
        <span className="stat"><span className="lbl">Followers</span><b>{state.values.followers}</b></span>
        <span className="stat"><span className="lbl">Agent</span><b>L{state.values.agentLevel}</b></span>
        {nextRent && <span className="stat"><span className="lbl">Rent d{nextRent}</span><b>{rentAmt}</b></span>}
        <span className="spacer" />
        <button className="btn ghost" onClick={() => { if (confirm('Start over? This erases your save.')) store.newGame(); }}>New</button>
        <button className="btn" onClick={() => store.endDay()} disabled={!!state.ending}>End day</button>
      </div>

      {state.ending && (
        <div className="overlay">
          <div className="box">
            <h1>{ENDING_TITLES[state.ending] ?? state.ending}</h1>
            <p className="muted">Day {state.values.day}.</p>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => store.newGame()}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
