/**
 * invaders.exe on screen: draws game/invaders.ts on the Terminal's canvas and reads the keys
 * (arrows or A/D, space to fire, Esc to quit) and the touch buttons under it.
 */
import { INV_H, INV_SIZES, INV_W, invadersExitLines, newInvaders, stepInvaders, type Invaders, type InvInput } from '../game/invaders';

const { ALIEN_W, ALIEN_H, PLAYER_W, PLAYER_Y } = INV_SIZES;
// two frames of a small pixel alien, 11×8
const SPRITE = [
  ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
  ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
];

let game: Invaders | null = null;
let running = false;
const input: InvInput = { left: false, right: false, fire: false };

function draw(ctx: CanvasRenderingContext2D, g: Invaders, t: number): void {
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, INV_W, INV_H);
  const frame = SPRITE[Math.floor(t / 500) % 2];
  ctx.fillStyle = '#9be9a8';
  for (const a of g.aliens) if (a.alive) {
    const px = ALIEN_W / 11, py = ALIEN_H / 8;
    frame.forEach((row, y) => [...row].forEach((c, x) => { if (c === '1') ctx.fillRect(a.x + x * px, a.y + y * py, px + 0.3, py + 0.3); }));
  }
  if (!g.hurt || Math.floor(t / 100) % 2) {
    ctx.fillStyle = '#79c0ff';
    ctx.fillRect(g.x - PLAYER_W / 2, PLAYER_Y + 4, PLAYER_W, 6);
    ctx.fillRect(g.x - 2, PLAYER_Y, 4, 4);
  }
  ctx.fillStyle = '#e6edf3'; for (const s of g.shots) ctx.fillRect(s.x - 1, s.y - 4, 2, 6);
  ctx.fillStyle = '#ff7b72'; for (const b of g.bombs) ctx.fillRect(b.x - 1, b.y, 2, 5);
  ctx.font = '10px monospace'; ctx.fillStyle = '#7d8590';
  ctx.fillText(`SCORE ${g.score}`, 6, 12);
  ctx.fillText(`LIVES ${g.lives}`, INV_W - 54, 12);
  if (g.over) {
    ctx.fillStyle = '#e6edf3'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
    ctx.fillText(g.over === 'won' ? 'ALL INVADERS DOWN' : 'GAME OVER', INV_W / 2, INV_H / 2);
    ctx.font = '10px monospace'; ctx.fillText('press Enter', INV_W / 2, INV_H / 2 + 16);
    ctx.textAlign = 'left';
  }
}

const KEYS: Record<string, keyof InvInput> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'fire', ArrowUp: 'fire' };

/**
 * Start (or pick back up) the game on this canvas. `exit` gets the shell's closing lines; it runs
 * once, on Esc or on Enter after the game ends. A canvas taken off the page stops the loop.
 */
export function mountInvaders(canvas: HTMLCanvasElement, exit: (lines: string[]) => void): void {
  if (running) return;
  running = true;
  game ??= newInvaders();
  const ctx = canvas.getContext('2d')!;
  let last = performance.now();
  const close = (quit: boolean) => { const g = game!; stop(); game = null; exit(invadersExitLines(g, quit)); };
  // minimized or behind the browser: the game pauses and leaves the keys alone
  const visible = () => canvas.offsetParent !== null;
  const down = (e: KeyboardEvent) => {
    if (!visible()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'Enter' && game?.over) { e.preventDefault(); close(false); return; }
    const k = KEYS[e.key]; if (k) { e.preventDefault(); input[k] = true; }
  };
  const up = (e: KeyboardEvent) => { const k = KEYS[e.key]; if (k) input[k] = false; };
  const pad = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-inv]'); if (!b) return;
    const k = b.dataset.inv!;
    if (k === 'quit') { if (e.type === 'pointerdown') close(true); return; }
    if (k === 'enter') { if (e.type === 'pointerdown' && game?.over) close(false); return; }
    input[k as keyof InvInput] = e.type === 'pointerdown';
  };
  const box = canvas.parentElement!;
  const stop = () => {
    running = false; input.left = input.right = input.fire = false;
    window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
    for (const ev of ['pointerdown', 'pointerup', 'pointerleave']) box.removeEventListener(ev, pad);
  };
  window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
  for (const ev of ['pointerdown', 'pointerup', 'pointerleave']) box.addEventListener(ev, pad);
  const tick = (t: number) => {
    if (!running) return;
    if (!canvas.isConnected) { stop(); return; }
    if (visible()) { stepInvaders(game!, (t - last) / 1000, input); draw(ctx, game!, t); }
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The game's screen in the Terminal: the canvas, touch buttons and the keys. */
export function invadersHtml(): string {
  return `<div class="inv"><canvas id="inv-canvas" width="${INV_W}" height="${INV_H}" aria-label="invaders.exe"></canvas>
    <div class="inv-pad"><button data-inv="left" aria-label="Left">◀</button><button data-inv="fire">fire</button><button data-inv="right" aria-label="Right">▶</button><button data-inv="enter">ok</button><button data-inv="quit">quit</button></div>
    <div class="tm-sys">← → move · space fire · Esc quit</div></div>`;
}
