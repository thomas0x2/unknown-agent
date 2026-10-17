/* invaders.exe's rules: shooting, getting hit, winning and losing. */
import { describe, it, expect } from 'vitest';
import { INV_SIZES, invadersExitLines, newInvaders, stepInvaders } from './invaders';

const idle = { left: false, right: false, fire: false };
const run = (g: ReturnType<typeof newInvaders>, secs: number, input = idle, rnd = () => 0.5) => {
  for (let t = 0; t < secs && !g.over; t += 1 / 60) stepInvaders(g, 1 / 60, input, rnd);
  return g;
};

describe('invaders.exe', () => {
  it('moves the player and shoots an alien above it', () => {
    const g = newInvaders();
    g.bombIn = 999;
    const x0 = g.x; run(g, 0.2, { ...idle, right: true }); expect(g.x).toBeGreaterThan(x0);
    run(g, 1.5, { ...idle, fire: true });
    expect(g.score).toBeGreaterThan(0);
    expect(g.aliens.some((a) => !a.alive)).toBe(true);
  });
  it('loses a life to a bomb, and the game after three', () => {
    const g = newInvaders();
    g.bombIn = 999;
    for (let i = 0; i < 3; i++) { g.hurt = 0; g.bombs.push({ x: g.x, y: INV_SIZES.PLAYER_Y + 2 }); stepInvaders(g, 1 / 60, idle); }
    expect(g.lives).toBe(0); expect(g.over).toBe('lost');
    expect(invadersExitLines(g, false)).toEqual(['invaders.exe: game over. score 0']);
  });
  it('is won when the last alien goes', () => {
    const g = newInvaders();
    g.aliens.forEach((a, i) => { a.alive = i === 0; });
    g.bombIn = 999;
    g.shots.push({ x: g.aliens[0].x + 5, y: g.aliens[0].y + 5 });
    stepInvaders(g, 1 / 60, idle);
    expect(g.over).toBe('won');
  });
  it('is lost when the fleet lands', () => {
    const g = newInvaders();
    g.bombIn = 999;
    run(g, 600);
    expect(g.over).toBe('lost');
  });
});
