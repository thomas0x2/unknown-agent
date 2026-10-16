/*
 * The store: engine state + browser UI state (tabs, transient inputs), exposed to React via
 * useSyncExternalStore. All engine calls go through here.
 */
import {
  type GameState, type JevRouter, type SaveStore,
  startGame, endDay, deploy, takeDown, postToY, replyToEvent, composeEmail, briefBuild,
} from '../engine';
import type { Content } from '../content/schema';

export interface Tab { id: number; url: string; }
export interface Draft { to: string; subject: string; body: string; }

const norm = (u: string) =>
  String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || 'newtab';

export class GameStore {
  state: GameState;
  tabs: Tab[] = [{ id: 1, url: 'qmail.com' }, { id: 2, url: 'agent.chat' }];
  active = 1;
  private nextTab = 3;
  ui = { ySearch: '', draft: null as Draft | null, project: '', dev: false, liked: {} as Record<string, boolean> };

  private rev = 0;
  private listeners = new Set<() => void>();

  constructor(readonly content: Content, private router: JevRouter, private store: SaveStore) {
    this.state = this.store.load() ?? startGame(content);
  }

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = (): number => this.rev;
  private emit() { this.rev++; for (const fn of this.listeners) fn(); }
  private commit(s: GameState) { this.state = s; this.store.save(s); this.emit(); }

  get url(): string { return this.tabs.find((t) => t.id === this.active)?.url ?? 'newtab'; }

  navigate(url: string, newTab = false) {
    const u = norm(url);
    if (newTab) { const id = this.nextTab++; this.tabs.push({ id, url: u }); this.active = id; }
    else { const t = this.tabs.find((x) => x.id === this.active); if (t) t.url = u; }
    this.emit();
  }
  switchTab(id: number) { this.active = id; this.emit(); }
  closeTab(id: number) {
    if (this.tabs.length === 1) { this.navigate('newtab'); return; }
    const i = this.tabs.findIndex((t) => t.id === id);
    this.tabs.splice(i, 1);
    if (this.active === id) this.active = this.tabs[Math.max(0, i - 1)].id;
    this.emit();
  }

  setYSearch(v: string) { this.ui.ySearch = v; this.emit(); }
  setDraft(d: Draft | null) { this.ui.draft = d; this.emit(); }
  setProject(id: string) { this.ui.project = id; this.emit(); }
  toggleDev() { this.ui.dev = !this.ui.dev; this.emit(); }
  like(id: string) { this.ui.liked[id] = !this.ui.liked[id]; this.emit(); }

  newGame() {
    this.store.clear();
    this.state = startGame(this.content);
    this.tabs = [{ id: 1, url: 'qmail.com' }, { id: 2, url: 'agent.chat' }];
    this.active = 1; this.nextTab = 3;
    this.ui = { ySearch: '', draft: null, project: '', dev: false, liked: {} };
    this.store.save(this.state);
    this.emit();
  }

  endDay() { this.commit(endDay(this.state, this.content)); }
  deploy(appId: string) { this.commit(deploy(this.state, appId)); }
  takeDown(appId: string) { this.commit(takeDown(this.state, appId)); }

  async post(text: string, trending: string[]) {
    const r = await postToY(this.state, this.router, text, trending);
    this.commit(r.state);
    return r;
  }
  async reply(eventId: string, text: string) {
    const r = await replyToEvent(this.state, this.content, this.router, eventId, text);
    this.commit(r.state);
    return r;
  }
  async compose(to: string, text: string) {
    const r = await composeEmail(this.state, this.content, this.router, to, text);
    this.commit(r.state);
    return r;
  }
  async build(appId: string, text: string) {
    const r = await briefBuild(this.state, this.content, this.router, appId, text);
    this.commit(r.state);
    return r;
  }
}
