/**
 * invaders.exe, on the laptop's desktop: a small space invaders, played in the Terminal.
 * Pure rules here (one step per frame); ui/invaders.ts draws it on a canvas and reads the keys.
 */

export const INV_W = 320;
export const INV_H = 240;
const COLS = 8, ROWS = 4, GAP_X = 30, GAP_Y = 22, ALIEN_W = 18, ALIEN_H = 12;
const PLAYER_W = 20, PLAYER_Y = INV_H - 18, PLAYER_SPEED = 140;
const SHOT_SPEED = 260, BOMB_SPEED = 110, RELOAD = 0.45;

export interface Alien { x: number; y: number; alive: boolean; row: number }
export interface Shot { x: number; y: number }
export interface Invaders {
  x: number;
  aliens: Alien[];
  dir: 1 | -1;
  shots: Shot[];
  bombs: Shot[];
  reload: number;
  bombIn: number;
  score: number;
  lives: number;
  /** seconds of invulnerability left after a hit */
  hurt: number;
  over: '' | 'won' | 'lost';
}
export interface InvInput { left: boolean; right: boolean; fire: boolean }

export function newInvaders(): Invaders {
  const aliens: Alien[] = [];
  const left = (INV_W - (COLS - 1) * GAP_X - ALIEN_W) / 2;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) aliens.push({ x: left + c * GAP_X, y: 24 + r * GAP_Y, alive: true, row: r });
  return { x: INV_W / 2, aliens, dir: 1, shots: [], bombs: [], reload: 0, bombIn: 1.2, score: 0, lives: 3, hurt: 0, over: '' };
}

const hit = (s: Shot, x: number, y: number, w: number, h: number) => s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h;

/** Advance the game by dt seconds. `rnd` is injectable for tests. */
export function stepInvaders(g: Invaders, dt: number, input: InvInput, rnd = Math.random): Invaders {
  if (g.over) return g;
  dt = Math.min(dt, 0.05);
  // the player
  g.x = Math.max(PLAYER_W / 2, Math.min(INV_W - PLAYER_W / 2, g.x + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * PLAYER_SPEED * dt));
  g.reload = Math.max(0, g.reload - dt);
  g.hurt = Math.max(0, g.hurt - dt);
  if (input.fire && g.reload === 0) { g.shots.push({ x: g.x, y: PLAYER_Y - 4 }); g.reload = RELOAD; }
  // the fleet speeds up as it thins out
  const alive = g.aliens.filter((a) => a.alive);
  const speed = 18 + (COLS * ROWS - alive.length) * 2.2;
  const minX = Math.min(...alive.map((a) => a.x)), maxX = Math.max(...alive.map((a) => a.x + ALIEN_W));
  let drop = 0;
  if ((g.dir === 1 && maxX + speed * dt > INV_W - 4) || (g.dir === -1 && minX - speed * dt < 4)) { g.dir = g.dir === 1 ? -1 : 1; drop = 8; }
  for (const a of alive) { a.x += drop ? 0 : g.dir * speed * dt; a.y += drop; }
  // shots and bombs
  for (const s of g.shots) s.y -= SHOT_SPEED * dt;
  for (const b of g.bombs) b.y += BOMB_SPEED * dt;
  g.shots = g.shots.filter((s) => {
    const a = alive.find((x) => x.alive && hit(s, x.x, x.y, ALIEN_W, ALIEN_H));
    if (a) { a.alive = false; g.score += (ROWS - a.row) * 10; return false; }
    return s.y > 0;
  });
  g.bombIn -= dt;
  const shooters = g.aliens.filter((a) => a.alive);
  if (g.bombIn <= 0 && shooters.length) {
    const a = shooters[Math.floor(rnd() * shooters.length)];
    g.bombs.push({ x: a.x + ALIEN_W / 2, y: a.y + ALIEN_H });
    g.bombIn = 0.6 + rnd() * 1.1;
  }
  g.bombs = g.bombs.filter((b) => {
    if (g.hurt === 0 && hit(b, g.x - PLAYER_W / 2, PLAYER_Y, PLAYER_W, 10)) { g.lives -= 1; g.hurt = 1.2; return false; }
    return b.y < INV_H;
  });
  if (!g.aliens.some((a) => a.alive)) g.over = 'won';
  else if (g.lives <= 0 || g.aliens.some((a) => a.alive && a.y + ALIEN_H >= PLAYER_Y)) g.over = 'lost';
  return g;
}

/** What the shell prints when the game closes. */
export function invadersExitLines(g: Invaders, quit: boolean): string[] {
  const end = quit && !g.over ? 'quit' : g.over === 'won' ? 'all invaders down' : 'game over';
  return [`invaders.exe: ${end}. score ${g.score}`];
}

export const INV_SIZES = { ALIEN_W, ALIEN_H, PLAYER_W, PLAYER_Y };
