/*
 * A tiny external store: holds the engine state (saved) plus UI-only nav state (not saved), exposes
 * actions, and notifies React via useSyncExternalStore. All engine calls go through here.
 */
import {
  type GameState, type JevRouter, type SaveStore,
  startGame, endDay, deploy, takeDown, postToY, replyToEvent, composeEmail, briefBuild, briefFix,
} from '../engine';
import type { Content } from '../content/schema';

export class GameStore {
  state: GameState;
  url = 'qmail.com';
  private rev = 0;
  private listeners = new Set<() => void>();

  constructor(
    readonly content: Content,
    private router: JevRouter,
    private store: SaveStore,
  ) {
    this.state = this.store.load() ?? startGame(content);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  /** A revision counter: changes on every update so useSyncExternalStore re-renders. */
  getSnapshot = (): number => this.rev;

  private commit(s: GameState) {
    this.state = s;
    this.store.save(s);
    this.emit();
  }
  private emit() {
    this.rev++;
    for (const fn of this.listeners) fn();
  }

  navigate(url: string) {
    this.url = url.trim().toLowerCase();
    this.emit();
  }

  newGame() {
    this.store.clear();
    this.commit(startGame(this.content));
    this.navigate('agent.chat');
  }

  endDay() {
    this.commit(endDay(this.state, this.content));
  }
  deploy(appId: string) {
    this.commit(deploy(this.state, appId));
  }
  takeDown(appId: string) {
    this.commit(takeDown(this.state, appId));
  }

  async post(text: string, trending: string[]) {
    const { state, rating, followerDelta } = await postToY(this.state, this.router, text, trending);
    this.commit(state);
    return { rating, followerDelta };
  }
  async reply(eventId: string, text: string) {
    const res = await replyToEvent(this.state, this.content, this.router, eventId, text);
    this.commit(res.state);
    return res;
  }
  async compose(to: string, text: string) {
    const res = await composeEmail(this.state, this.content, this.router, to, text);
    this.commit(res.state);
    return res;
  }
  async build(appId: string, text: string) {
    const res = await briefBuild(this.state, this.content, this.router, appId, text);
    this.commit(res.state);
    return res;
  }
  async fix(appId: string, text: string) {
    const res = await briefFix(this.state, this.content, this.router, appId, text);
    this.commit(res.state);
    return res;
  }
}
