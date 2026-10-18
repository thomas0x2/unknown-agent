import { addFlag } from './core';
import { startGame, endDay } from './day';
import { registerApp, deployApp, getApp } from './apps';
import { makeContent } from './_fixtures';
import { FOOD } from './config';
import type { GameState } from './state';

const content = makeContent();

function workingClient(s: GameState): string {
  const id = registerApp(s, { template: 'shop', kind: 'client', name: 'Shop', payPerDay: 50, spec: [{ id: 'price_chf' }] });
  const app = getApp(s, id)!;
  app.repo = [{ id: 'price_chf', correct: true }];
  app.repoVersion = 1;
  deployApp(s, id);
  return id;
}

describe('startGame', () => {
  it('delivers day-1 mail and opens in the work phase', () => {
    const s = startGame(content, 1);
    expect(s.values.day).toBe(1);
    expect(s.phase).toBe('work');
    expect(s.delivered.some((d) => d.eventId === 'client_shop')).toBe(true);
  });
});

describe('endDay', () => {
  it('pays working apps, charges the subscription, and advances', () => {
    let s = startGame(content, 1);
    workingClient(s);
    s.values.crypto = 100;
    s = endDay(s, content);
    // +50 pay, -15 dinner, -5 subscription (level 1), -2 hosting (1 live app) = 128, day advances to 2
    expect(s.values.crypto).toBe(128);
    expect(s.values.day).toBe(2);
    expect(s.phase).toBe('work');
  });

  it('charges dinner to DoorDish every night, before rent', () => {
    let s = startGame(content, 1);
    s.values.crypto = 100;
    s = endDay(s, content);
    expect(s.tx.some((t) => t.memo === FOOD.memo && t.amount === -FOOD.perNight)).toBe(true);
    expect(s.morning!.lines).toContainEqual(['Dinner (DoorDish)', -FOOD.perNight]);
    // rent day: exactly the rent left is not enough once dinner is taken
    let r = startGame(content, 1);
    r.values.day = 7;
    r.values.crypto = 350;
    r = endDay(r, content);
    expect(r.ending).toBe('evicted');
  });

  it('orders nothing when the wallet cannot cover dinner', () => {
    let s = startGame(content, 1);
    s.values.crypto = FOOD.perNight - 1;
    s = endDay(s, content);
    expect(s.tx.some((t) => t.memo === FOOD.memo)).toBe(false);
    expect(s.morning!.lines).toContainEqual(['Dinner: not enough DOLR, nothing ordered', null]);
  });

  it('evicts when rent cannot be paid', () => {
    let s = startGame(content, 1);
    s.values.day = 7;
    s.values.crypto = 100; // rent is 350
    s = endDay(s, content);
    expect(s.ending).toBe('evicted');
    expect(s.phase).toBe('ended');
  });

  it('rolls out agent level 2 on the morning of day 4', () => {
    let s = startGame(content, 1);
    s.values.day = 3;
    s.values.crypto = 100;
    s = endDay(s, content);
    expect(s.values.day).toBe(4);
    expect(s.values.agentLevel).toBe(2);
  });

  it('raids when suspicion maxes out', () => {
    let s = startGame(content, 1);
    s.values.day = 6;
    s.values.crypto = 100;
    s.values.suspicion = 100;
    // an illegal job today suppresses the clean-day drift, so suspicion stays at 100
    s.jobs.push({ eventId: 'grey_job', category: 'grey', payout: 100, dueDay: 6, status: 'completed', takenDay: 6 });
    s = endDay(s, content);
    expect(s.ending).toBe('raided');
  });

  it('drifts suspicion down on a clean day and up for a live illegal app', () => {
    let s = startGame(content, 1);
    s.values.crypto = 100;
    s.values.suspicion = 20;
    s = endDay(s, content);
    expect(s.values.suspicion).toBe(18); // no illegal job -> -2

    let s2 = startGame(content, 1);
    s2.values.crypto = 100;
    s2.values.suspicion = 20;
    const id = registerApp(s2, { template: 'shop', kind: 'illegal', name: 'Scam', spec: [{ id: 'catalog' }], suspicious: true });
    const app = getApp(s2, id)!;
    app.repo = [{ id: 'catalog', correct: true }];
    app.repoVersion = 1;
    deployApp(s2, id);
    s2 = endDay(s2, content);
    expect(s2.values.suspicion).toBe(21); // +3 live illegal, -2 clean day
  });

  it('reaches the finale on the last night', () => {
    let s = startGame(content, 1);
    s.values.day = 21;
    s.values.crypto = 1000; // covers rent 650 + sub
    addFlag(s, 'election_tipped');
    s = endDay(s, content);
    expect(s.ending).toBeNull(); // day 21 is a payday, not the end
    s = startGame(content, 1);
    s.values.day = 28;
    s.values.crypto = 1000;
    addFlag(s, 'election_tipped');
    s = endDay(s, content);
    expect(s.ending).toBe('the_regime');
  });
});
