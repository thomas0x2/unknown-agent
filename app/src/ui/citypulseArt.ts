/*
 * CityPulse's pictures: 320×180 SVG scenes made to pass for cheap press photos. Every scene gets the
 * same treatment in art(): washed-out colour, film grain and a dark vignette. Some get the tabloid red
 * circle around the thing you're meant to look at. `@` in a scene is replaced by a per-picture id
 * prefix, so gradients and filters don't collide when several pictures share a page.
 */

const r = (n: number) => Math.round(n * 10) / 10;

/** A deterministic 0..1 sequence so the pictures don't change between renders. */
function rand(seed: number) {
  let x = seed;
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
}

/** The tabloid's red marker ring. */
const ring = (cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#e8231a" stroke-width="3.5" transform="rotate(-6 ${cx} ${cy})"/>`;

const blur = (id: string, sd: number) => `<filter id="@${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

// ── scenes ──

/** An open-plan office the morning after: rows of empty desks, one box packed. */
function office(): string {
  const rows = [
    { y: 92, h: 3, w: 28, gap: 10 },
    { y: 100, h: 4, w: 40, gap: 14 },
    { y: 112, h: 6, w: 60, gap: 20 },
    { y: 132, h: 9, w: 96, gap: 30 },
  ];
  const desks = rows.map(({ y, h, w, gap }) => [-1, 1].map((side) => {
    const x = side < 0 ? 160 - gap - w : 160 + gap;
    const mons = [0.2, 0.55].map((f) => `<rect x="${r(x + w * f)}" y="${r(y - h * 2.2)}" width="${r(w * 0.22)}" height="${r(h * 1.9)}" fill="#1a1c20"/>`).join('');
    return `${mons}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#b9b2a4"/><rect x="${x}" y="${y + h}" width="${w}" height="${r(h * 1.6)}" fill="#55524c"/>`;
  }).join('')).join('');
  const lights = [0, 1, 2, 3].map((i) => {
    const t = (i + 1) / 5;
    const w = 6 + i * i * 7; const y = 52 - i * i * 4.5;
    return `<rect x="${r(160 - w / 2)}" y="${r(y)}" width="${r(w)}" height="${r(1 + t * 4)}" fill="#f4f7f4"/>`;
  }).join('');
  return `<defs><linearGradient id="@ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6064"/><stop offset="1" stop-color="#a9aca8"/></linearGradient>
    <linearGradient id="@floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d7a73"/><stop offset="1" stop-color="#3b3935"/></linearGradient>${blur('soft', 0.6)}</defs>
    <rect width="320" height="62" fill="url(#@ceil)"/><rect y="62" width="320" height="30" fill="#c8c6bd"/>
    <rect x="96" y="66" width="128" height="20" fill="#dfe6e8"/><path d="M128 66v20M160 66v20M192 66v20" stroke="#8d918f" stroke-width="2"/>
    <rect y="88" width="320" height="92" fill="url(#@floor)"/>
    <g filter="url(#@soft)">${lights}${desks}</g>
    <path d="M236 114l18 -6 22 7 -16 7z" fill="#3e3a35"/><circle cx="250" cy="122" r="7" fill="#2a2724"/>
    <path d="M58 118h46v14H58z" fill="#b8915e"/><path d="M58 118l8-8h46l-8 8z" fill="#cfa772"/><path d="M104 118l8-8v14l-8 8z" fill="#9a7647"/>
    <rect x="66" y="104" width="6" height="14" fill="#3c6e91"/><circle cx="84" cy="108" r="6" fill="#4f8a4a"/><rect x="81" y="110" width="6" height="8" fill="#7a4e33"/>
    ${ring(84, 116, 36, 22)}`;
}

/** A data-centre aisle receding into blue, one red light among the green. */
function server(): string {
  const xs = [0, 46, 78, 100, 115, 125, 132, 137];
  const rnd = rand(7);
  const side = (flip: boolean) => xs.slice(0, -1).map((x0, i) => {
    const x1 = xs[i + 1];
    const top = (x: number) => 8 + (78 - 8) * (x / 140);
    const bot = (x: number) => 176 - (176 - 104) * (x / 140);
    const X = (x: number) => (flip ? 320 - x : x);
    const face = `<path d="M${X(x0)} ${r(top(x0))}L${X(x1)} ${r(top(x1))}L${X(x1)} ${r(bot(x1))}L${X(x0)} ${r(bot(x0))}z" fill="${i % 2 ? '#2b333e' : '#353e4a'}" stroke="#10141a" stroke-width="1.5"/>` + [0.25, 0.5, 0.75].map((f) => `<path d="M${X(x0)} ${r(top(x0) + (bot(x0) - top(x0)) * f)}L${X(x1)} ${r(top(x1) + (bot(x1) - top(x1)) * f)}" stroke="#1c2229" stroke-width="1"/>`).join('');
    const leds = [...Array(10)].map((_, k) => {
      const f = 0.12 + k * 0.08;
      const xa = x0 + (x1 - x0) * (0.2 + rnd() * 0.5);
      const y = top(xa) + (bot(xa) - top(xa)) * f;
      const red = i === 1 && k === 4 && !flip;
      return `<circle cx="${r(X(xa))}" cy="${r(y)}" r="${r(Math.max(0.6, 2.2 - i * 0.28))}" fill="${red ? '#ff3b30' : rnd() > 0.35 ? '#5cf08a' : '#58b8ff'}"/>`;
    }).join('');
    return face + leds;
  }).join('');
  return `<defs><radialGradient id="@glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fd2ff"/><stop offset="1" stop-color="#0e1a2a" stop-opacity="0"/></radialGradient>
    <linearGradient id="@floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2632"/><stop offset="1" stop-color="#3a4654"/></linearGradient></defs>
    <rect width="320" height="180" fill="#0d141c"/><rect y="92" width="320" height="88" fill="url(#@floor)"/>
    <path d="M160 92L40 180M160 92L100 180M160 92L220 180M160 92L280 180M0 150H320M0 126H320M0 110H320" stroke="#4b5866" stroke-width=".8" opacity=".5"/>
    <ellipse cx="160" cy="90" rx="40" ry="26" fill="url(#@glow)"/>
    <path d="M140 0h40l-14 74h-12z" fill="#262d36"/>
    ${side(false)}${side(true)}
    ${ring(57, 92, 22, 16)}`;
}

/** A polling station: three booths with feet under the curtains, a ballot box up front. */
function ballot(): string {
  const booths = [0, 1, 2].map((i) => {
    const x = 70 + i * 66;
    const legs = i !== 1 ? `<rect x="${x + 16}" y="138" width="7" height="16" fill="#2b2f3a"/><rect x="${x + 28}" y="138" width="7" height="16" fill="#2b2f3a"/><path d="M${x + 13} 154h12v4h-14zM${x + 27} 154h12v4h-14z" fill="#141414"/>` : '';
    return `<rect x="${x}" y="58" width="54" height="6" fill="#d9dde3"/><path d="M${x + 2} 64h50l-2 76H${x + 4}z" fill="#3a5a8c"/>
      ${[1, 2, 3, 4].map((k) => `<path d="M${x + 2 + k * 10} 64v74" stroke="#2c4870" stroke-width="2"/>`).join('')}${legs}`;
  }).join('');
  const flags = [...Array(15)].map((_, i) => `<path d="M${i * 22} ${i % 2 ? 10 : 12}l11 14 11-14z" fill="${['#c4312b', '#f2f2f2', '#2c4f8c'][i % 3]}"/>`).join('');
  return `<defs><linearGradient id="@wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d3c6"/><stop offset="1" stop-color="#b9b3a3"/></linearGradient>${blur('far', 0.8)}</defs>
    <rect width="320" height="150" fill="url(#@wall)"/><rect y="150" width="320" height="30" fill="#8a8274"/><path d="M0 150h320" stroke="#6d665a" stroke-width="2"/>
    <path d="M0 10Q160 24 320 10" stroke="#555" fill="none"/>${flags}
    <g filter="url(#@far)">${booths}</g>
    <path d="M14 112h78v62H14z" fill="#1f3a68"/><path d="M14 112l10-10h78l-10 10z" fill="#2c4f8c"/><path d="M92 112l10-10v62l-10 10z" fill="#17305a"/>
    <rect x="40" y="104" width="32" height="4" fill="#0b1a33"/><path d="M48 106l2-26h16l-2 26z" fill="#fafafa"/>
    <text x="53" y="150" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="17" font-weight="900" fill="#fff">VOTE</text>`;
}

/** A rally from the back of the hall: spotlight, flags, phones held up. */
function podium(): string {
  const rnd = rand(11);
  const crowd = [...Array(26)].map((_, i) => {
    const x = i * 13 + rnd() * 6 - 4; const y = 142 + rnd() * 14; const s = 0.9 + rnd() * 0.5;
    return `<ellipse cx="${r(x)}" cy="${r(y)}" rx="${r(8 * s)}" ry="${r(10 * s)}" fill="#0c0b0d"/><path d="M${r(x - 18 * s)} 180q${r(18 * s)} -${r(26 * s)} ${r(36 * s)} 0z" fill="#0c0b0d"/>`;
  }).join('');
  const phones = [[44, 120], [118, 112], [214, 118], [282, 126]].map(([x, y]) =>
    `<path d="M${x - 2} ${y + 14}l-4 22" stroke="#0c0b0d" stroke-width="5"/><rect x="${x - 6}" y="${y}" width="12" height="18" rx="2" fill="#0c0b0d"/><rect x="${x - 4.5}" y="${y + 2}" width="9" height="13" fill="#bfe1ff"/>`).join('');
  const flag = (x: number) => `<rect x="${x}" y="30" width="36" height="70" fill="#f1f1f1"/>${[0, 1, 2, 3].map((k) => `<rect x="${x}" y="${34 + k * 18}" width="36" height="9" fill="#b3241e"/>`).join('')}<rect x="${x}" y="30" width="16" height="28" fill="#23417a"/>`;
  return `<defs><radialGradient id="@spot" cx=".5" cy=".35" r=".55"><stop offset="0" stop-color="#fff3d6" stop-opacity=".95"/><stop offset=".55" stop-color="#d9b77a" stop-opacity=".35"/><stop offset="1" stop-color="#1a1410" stop-opacity="0"/></radialGradient>
    <radialGradient id="@flash" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>${blur('far', 1.2)}</defs>
    <rect width="320" height="180" fill="#2a211a"/><rect y="104" width="320" height="76" fill="#6b5038"/>
    <g filter="url(#@far)">${flag(60)}${flag(224)}<rect x="80" y="0" width="160" height="150" fill="url(#@spot)"/>
      <path d="M144 70a16 16 0 1 1 32 0a16 16 0 1 1-32 0z" fill="#2a211b"/><path d="M128 120q4-30 32-34q28 4 32 34z" fill="#2a211b"/>
      <path d="M182 92l18-34" stroke="#2a211b" stroke-width="9" stroke-linecap="round"/><circle cx="202" cy="54" r="7" fill="#2a211b"/>
      <path d="M126 112h68l-8 46h-52z" fill="#6e1d18"/><rect x="122" y="106" width="76" height="8" fill="#521511"/>
      <path d="M150 128l6 6 12-12" stroke="#f1f1f1" stroke-width="3" fill="none"/></g>
    <circle cx="96" cy="96" r="18" fill="url(#@flash)"/><circle cx="252" cy="84" r="12" fill="url(#@flash)"/>
    ${crowd}${phones}`;
}

/** A trading-floor screen, candles rising or falling, two heads in front of it. */
function chart(up: boolean): string {
  const rnd = rand(up ? 3 : 5);
  let v = up ? 126 : 46;
  const candles = [...Array(22)].map((_, i) => {
    const step = (up ? -1 : 1) * (1 + rnd() * 4) + (rnd() - 0.5) * 9;
    const o = v; v = Math.max(34, Math.min(132, v + step)); const c = v;
    const hi = Math.min(o, c) - rnd() * 6; const lo = Math.max(o, c) + rnd() * 6;
    const x = 34 + i * 11; const green = c < o;
    return `<path d="M${x + 3} ${r(hi)}V${r(lo)}" stroke="${green ? '#3be07a' : '#ff4a3d'}" stroke-width="1"/><rect x="${x}" y="${r(Math.min(o, c))}" width="6" height="${r(Math.max(1.5, Math.abs(c - o)))}" fill="${green ? '#3be07a' : '#ff4a3d'}"/>`;
  }).join('');
  const tick = [...Array(9)].map((_, i) => `<rect x="${24 + i * 32}" y="146" width="${14 + (i * 7) % 12}" height="4" fill="${(i + (up ? 0 : 1)) % 3 ? '#3be07a' : '#ff4a3d'}"/>`).join('');
  return `<defs><radialGradient id="@room" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#2c4258"/><stop offset="1" stop-color="#0a0f14"/></radialGradient>${blur('soft', 0.5)}${blur('near', 2)}</defs>
    <rect width="320" height="180" fill="url(#@room)"/>
    <g filter="url(#@soft)"><rect x="20" y="22" width="280" height="134" fill="#1f3d56" stroke="#4f6578" stroke-width="3"/>
      ${[48, 74, 100, 126].map((y) => `<path d="M24 ${y}H296" stroke="#2f4e68" stroke-width="1"/>`).join('')}${candles}
      <rect x="20" y="140" width="280" height="16" fill="#132634"/>${tick}</g>
    <g filter="url(#@near)" fill="#020304" stroke="#4d6a86" stroke-width="1.5"><ellipse cx="78" cy="136" rx="20" ry="25"/><path d="M22 184q56-64 112 0z"/><ellipse cx="238" cy="144" rx="18" ry="23"/><path d="M188 184q50-56 100 0z"/></g>`;
}

/** A CCTV still: the delivery robot on a night pavement, timestamp burned in. */
function robot(): string {
  const bricks = [...Array(9)].map((_, row) => [...Array(12)].map((_, c) => `<rect x="${c * 30 - (row % 2) * 15}" y="${row * 10}" width="28" height="8" fill="#3a3530"/>`).join('')).join('');
  return `<defs><radialGradient id="@lamp" cx=".7" cy=".1" r=".8"><stop offset="0" stop-color="#e9e2b8" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <pattern id="@scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".25"/></pattern>${blur('mo', 1)}</defs>
    <rect width="320" height="180" fill="#25221f"/><g opacity=".9">${bricks}</g>
    <rect y="96" width="320" height="84" fill="#4a4842"/><path d="M0 96h320" stroke="#6b6860" stroke-width="3"/><path d="M0 150h320" stroke="#33312c" stroke-width="2"/>
    <path d="M60 96l-30 84M150 96l-10 84M240 96l10 84" stroke="#3c3a35" stroke-width="1.5"/>
    <rect x="236" y="0" width="5" height="96" fill="#1a1918"/>
    <rect width="320" height="180" fill="url(#@lamp)"/>
    <g filter="url(#@mo)"><ellipse cx="160" cy="146" rx="40" ry="5" fill="#1a1917" opacity=".7"/>
      <rect x="126" y="98" width="68" height="40" rx="7" fill="#e7e7e3"/><rect x="126" y="98" width="68" height="12" rx="6" fill="#d5291b"/>
      <rect x="138" y="114" width="44" height="10" rx="5" fill="#1d1d1d"/><circle cx="150" cy="119" r="2.5" fill="#9fe8ff"/><circle cx="170" cy="119" r="2.5" fill="#9fe8ff"/>
      ${[136, 160, 184].map((x) => `<circle cx="${x}" cy="140" r="7" fill="#151515"/>`).join('')}
      <path d="M188 98V68" stroke="#555" stroke-width="1.5"/><path d="M188 68h16l-4 5 4 5h-16z" fill="#d5291b"/></g>
    <rect width="320" height="180" fill="url(#@scan)"/>
    <text x="10" y="16" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="#f4f4f4">CAM 07   23:41:07</text>
    <circle cx="282" cy="12" r="3.5" fill="#ff2a1a"/><text x="290" y="16" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="#f4f4f4">REC</text>
    ${ring(162, 118, 50, 34)}`;
}

/** A laundromat row under strip lights; number 3 wears tape. */
function washer(): string {
  const ms = [0, 1, 2, 3, 4].map((i) => {
    const w = 76 - i * 11; const x = 12 + [0, 78, 146, 204, 254][i]; const y = 82 + i * 4; const h = w * 1.08;
    return `<rect x="${x}" y="${y}" width="${w}" height="${r(h)}" rx="3" fill="#ecedeb" stroke="#b9bdbd"/><rect x="${x}" y="${y}" width="${w}" height="${r(h * 0.18)}" fill="#d3d7d8"/>
      <circle cx="${r(x + w / 2)}" cy="${r(y + h * 0.58)}" r="${r(w * 0.33)}" fill="#2e3b46"/><circle cx="${r(x + w / 2)}" cy="${r(y + h * 0.58)}" r="${r(w * 0.25)}" fill="#6f8ea6"/>
      <text x="${r(x + w - 8)}" y="${r(y + h * 0.14)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${r(w * 0.12)}" fill="#c4312b">${i + 1}</text>`;
  }).join('');
  return `<defs><linearGradient id="@wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd8cf"/><stop offset="1" stop-color="#a8b3a9"/></linearGradient></defs>
    <rect width="320" height="180" fill="url(#@wall)"/>
    <path d="M30 14h100M190 14h100" stroke="#fbfff6" stroke-width="5"/><path d="M60 34h60M200 34h60" stroke="#fbfff6" stroke-width="3"/>
    <rect y="150" width="320" height="30" fill="#8f978e"/>${[...Array(11)].map((_, i) => `<path d="M${i * 32} 180L${160 + (i * 32 - 160) * 0.6} 150" stroke="#7a8279"/>`).join('')}
    ${ms}
    <path d="M152 122l60 22M152 138l58-20" stroke="#f2c21b" stroke-width="7"/><text x="181" y="134" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="7" fill="#111" transform="rotate(14 181 134)">OUT OF ORDER</text>`;
}

/** A pavement vigil: tea lights, flowers and a laptop with its screen still on. */
function candle(): string {
  const rnd = rand(9);
  const lights = [...Array(34)].map(() => {
    const x = 20 + rnd() * 280; const y = 128 + rnd() * 46; const s = 0.5 + (y - 128) / 46 * 0.8;
    return `<circle cx="${r(x)}" cy="${r(y - 6 * s)}" r="${r(12 * s)}" fill="url(#@glow)"/><rect x="${r(x - 4 * s)}" y="${r(y - 3 * s)}" width="${r(8 * s)}" height="${r(5 * s)}" fill="#e8e1d2"/><path d="M${r(x)} ${r(y - 3 * s)}q${r(2 * s)} -${r(4 * s)} 0 -${r(8 * s)}q-${r(2 * s)} ${r(4 * s)} 0 ${r(8 * s)}z" fill="#ffd27a"/>`;
  }).join('');
  const bokeh = [...Array(12)].map(() => `<circle cx="${r(rnd() * 320)}" cy="${r(20 + rnd() * 70)}" r="${r(6 + rnd() * 10)}" fill="#ffcf8a" opacity="${r(0.1 + rnd() * 0.2)}"/>`).join('');
  const flowers = [70, 96, 222, 250].map((x, i) => `<path d="M${x} 134l${i % 2 ? 6 : -6} -16" stroke="#3c5a2a" stroke-width="2"/><circle cx="${x + (i % 2 ? 6 : -6)}" cy="116" r="5" fill="${['#e8e3d9', '#c4312b', '#efe6c8', '#d98aa0'][i]}"/>`).join('');
  return `<defs><radialGradient id="@glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf6e" stop-opacity=".7"/><stop offset="1" stop-color="#ffcf6e" stop-opacity="0"/></radialGradient>
    <linearGradient id="@scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset="1" stop-color="#7fa9d6"/></linearGradient>${blur('far', 2.5)}</defs>
    <rect width="320" height="180" fill="#120f0e"/><g filter="url(#@far)">${bokeh}</g><rect y="110" width="320" height="70" fill="#1e1a17"/>
    <circle cx="160" cy="104" r="60" fill="#9cc8ff" opacity=".1"/>
    <path d="M122 70h76v56h-76z" fill="#2b2d31" stroke="#55585e" stroke-width="1.5"/><rect x="127" y="75" width="66" height="46" fill="url(#@scr)"/>
    <circle cx="160" cy="92" r="9" fill="#fff" opacity=".85"/><rect x="146" y="106" width="28" height="3" fill="#fff" opacity=".7"/>
    <path d="M118 126h84l12 14H106z" fill="#3a3c41"/><path d="M122 129h76l6 7h-88z" fill="#24262a"/>${flowers}${lights}`;
}

/** A tower at dusk, shot from the street. */
function building(): string {
  const wins = [...Array(12)].map((_, row) => {
    const y = 160 - row * 12.5; const half = 46 - row * 1.6;
    return [...Array(6)].map((_, c) => {
      const x = 160 - half + 4 + c * ((half * 2 - 8) / 6);
      const lit = (row * 7 + c * 3) % 5 === 0;
      return `<rect x="${r(x)}" y="${r(y - 8)}" width="${r((half * 2 - 8) / 6 - 3)}" height="8" fill="${lit ? '#f6d27e' : '#33404f'}"/>`;
    }).join('');
  }).join('');
  return `<defs><linearGradient id="@sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f63"/><stop offset=".6" stop-color="#b06a5a"/><stop offset="1" stop-color="#e7a663"/></linearGradient>
    <linearGradient id="@tw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#202733"/><stop offset="1" stop-color="#3d4656"/></linearGradient></defs>
    <rect width="320" height="180" fill="url(#@sky)"/>
    <path d="M0 180V96h30v-14h28v98zM262 180V70h26v20h32v90z" fill="#14171d"/>
    <path d="M112 180L122 14h76l10 166z" fill="url(#@tw)"/><path d="M122 14h76l-2 6h-72z" fill="#5a6475"/>${wins}
    <path d="M58 180v-60h40v60zM222 180v-50h40v50z" fill="#0c0e12"/>`;
}

/** A phone held up, a blue check filling the screen. */
function check(): string {
  return `<defs>${blur('far', 3)}<radialGradient id="@lit" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5fb4ff" stop-opacity=".35"/><stop offset="1" stop-color="#5fb4ff" stop-opacity="0"/></radialGradient></defs>
    <rect width="320" height="180" fill="#1b1d24"/>
    <g filter="url(#@far)"><circle cx="50" cy="40" r="20" fill="#d9a35a" opacity=".5"/><circle cx="270" cy="56" r="26" fill="#c25a4a" opacity=".4"/><circle cx="240" cy="150" r="18" fill="#5a7ac2" opacity=".4"/><rect x="0" y="120" width="320" height="60" fill="#2b2a30"/></g>
    <circle cx="164" cy="92" r="96" fill="url(#@lit)"/>
    <g transform="rotate(-8 160 96)"><rect x="118" y="14" width="84" height="164" rx="12" fill="#0d0d0f"/><rect x="124" y="24" width="72" height="146" rx="4" fill="#f5f7fa"/>
      <circle cx="140" cy="40" r="9" fill="#9aa4b2"/><rect x="153" y="34" width="34" height="5" fill="#2a2f38"/><rect x="153" y="43" width="22" height="4" fill="#a7afbb"/>
      <circle cx="160" cy="92" r="26" fill="#1d9bf0"/><path d="M147 92l9 9 17-18" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${[128, 138, 148].map((y) => `<rect x="132" y="${y}" width="${y === 148 ? 36 : 56}" height="4" fill="#c6ccd5"/>`).join('')}</g>
    <path d="M96 180c8-30 22-48 38-50l20 4c6 4 4 12-4 14l-14 2c-6 10-8 20-8 30z" fill="#b7826a"/>`;
}

/** A face lit by a phone in the dark. */
function phone(): string {
  return `<defs><radialGradient id="@lit" cx=".62" cy=".5" r=".5"><stop offset="0" stop-color="#bcd9ff" stop-opacity=".5"/><stop offset="1" stop-color="#bcd9ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="@face" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#8e97a6"/><stop offset=".5" stop-color="#2a2d33"/><stop offset="1" stop-color="#0d0e10"/></linearGradient>${blur('far', 3)}</defs>
    <rect width="320" height="180" fill="#0a0b0e"/><g filter="url(#@far)"><circle cx="270" cy="30" r="10" fill="#e2a24a" opacity=".5"/><circle cx="296" cy="60" r="7" fill="#e2a24a" opacity=".35"/><rect x="0" y="120" width="90" height="10" fill="#c43b2b" opacity=".25"/></g>
    <rect x="100" y="0" width="220" height="180" fill="url(#@lit)"/>
    <path d="M60 180c0-40 10-60 34-70c-14-12-20-30-16-50c6-30 34-44 58-36c22 8 30 30 26 54c-2 16-10 26-18 32c26 10 40 36 44 70z" fill="url(#@face)"/>
    <g transform="rotate(12 222 106)"><rect x="200" y="66" width="44" height="84" rx="6" fill="#111"/><rect x="203" y="71" width="38" height="72" fill="#e9f1ff"/>
      ${[0, 1, 2, 3].map((k) => `<rect x="207" y="${76 + k * 17}" width="10" height="10" rx="2" fill="${['#eb1700', '#f2a33a', '#3a7bd5', '#59b36a'][k]}"/><rect x="220" y="${78 + k * 17}" width="17" height="3" fill="#9aa4b2"/><rect x="220" y="${83 + k * 17}" width="11" height="2" fill="#c6ccd5"/>`).join('')}</g>
    <path d="M236 180c-4-20 -10-34 -20-40l-8 10c4 8 6 18 6 30z" fill="#4a4d55"/>`;
}

/** Pill bottles and an injection pen on a pharmacy counter, the shelves out of focus behind. */
function pills(): string {
  const shelf = (y: number) => [...Array(9)].map((_, i) => `<rect x="${12 + i * 34}" y="${y}" width="${18 + (i * 7) % 10}" height="${22 - (i * 5) % 8}" rx="2" fill="${['#d9dde3', '#e8c35a', '#ffffff', '#7fb6c4', '#e2725b'][i % 5]}" opacity=".55"/>`).join('');
  const bottle = (x: number, h: number, cap: string) => `<rect x="${x}" y="${136 - h}" width="34" height="${h}" rx="5" fill="#d98a2b" opacity=".92"/><rect x="${x + 3}" y="${148 - h}" width="28" height="${Math.round(h / 2)}" fill="#f4f1ea"/>
    <rect x="${x - 2}" y="${126 - h}" width="38" height="12" rx="3" fill="${cap}"/><rect x="${x + 7}" y="${155 - h}" width="16" height="3" fill="#9aa4b2"/><rect x="${x + 7}" y="${161 - h}" width="11" height="2" fill="#c6ccd5"/>`;
  return `<defs><linearGradient id="@top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf0"/><stop offset="1" stop-color="#b9c1c8"/></linearGradient>${blur('far', 3)}</defs>
    <rect width="320" height="180" fill="#25303a"/>
    <g filter="url(#@far)">${shelf(14)}${shelf(56)}<rect y="40" width="320" height="4" fill="#5b6872"/><rect y="82" width="320" height="4" fill="#5b6872"/></g>
    <rect y="132" width="320" height="48" fill="url(#@top)"/><path d="M0 132h320" stroke="#fff" stroke-width="2" opacity=".6"/>
    ${bottle(58, 58, '#f4f1ea')}${bottle(104, 44, '#3d2c6b')}
    <g transform="rotate(-14 214 140)"><rect x="168" y="132" width="96" height="16" rx="7" fill="#f4f1ea"/><rect x="236" y="132" width="28" height="16" rx="7" fill="#e2725b"/><rect x="176" y="136" width="30" height="8" rx="2" fill="#9aa4b2"/><rect x="264" y="138" width="10" height="4" fill="#c6ccd5"/></g>
    ${[[150, 158], [162, 166], [140, 168]].map(([x, y], i) => `<g transform="rotate(${[30, -20, 70][i]} ${x} ${y})"><rect x="${x - 8}" y="${y - 3.5}" width="16" height="7" rx="3.5" fill="#fff"/><rect x="${x}" y="${y - 3.5}" width="8" height="7" rx="3.5" fill="#3d2c6b"/></g>`).join('')}`;
}

/** A rocket coming apart over the sea, shot from shore through haze. */
function rocket(): string {
  const rnd = rand(13);
  const debris = [...Array(9)].map(() => {
    const a = rnd() * Math.PI * 2; const d = 18 + rnd() * 26;
    const x = 196 + Math.cos(a) * d; const y = 56 + Math.sin(a) * d;
    return `<path d="M${r(x)} ${r(y)}l${r(Math.cos(a) * 10)} ${r(Math.sin(a) * 10 + 6)}" stroke="#ffd59a" stroke-width="1.5" opacity=".8"/>`;
  }).join('');
  return `<defs><linearGradient id="@sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d93ad"/><stop offset="1" stop-color="#c9d3d9"/></linearGradient>
    <radialGradient id="@fire" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".35" stop-color="#ffc24a"/><stop offset=".7" stop-color="#e2541f"/><stop offset="1" stop-color="#7a2a14" stop-opacity="0"/></radialGradient>
    <radialGradient id="@smoke" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e6e3de"/><stop offset="1" stop-color="#bcb8b2" stop-opacity="0"/></radialGradient>${blur('haze', 1.4)}</defs>
    <rect width="320" height="180" fill="url(#@sky)"/><rect y="138" width="320" height="42" fill="#47596b"/><path d="M0 138h320" stroke="#9eacb8" stroke-width="1.5"/>
    <path d="M0 150h320M0 162h320" stroke="#5d6f80" stroke-width="1" opacity=".6"/>
    <g filter="url(#@haze)"><path d="M86 138v-16h3v16zM80 126h14" stroke="#2b3138" stroke-width="2"/>
      <path d="M88 136C96 110 120 92 150 80S186 64 194 58" stroke="#eeebe6" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="176" cy="66" r="22" fill="url(#@smoke)"/><circle cx="214" cy="48" r="20" fill="url(#@smoke)"/>
      <circle cx="198" cy="56" r="30" fill="url(#@fire)"/></g>${debris}`;
}

/** A gavel on the bench, a flag out of focus behind. */
function gavel(): string {
  return `<defs><linearGradient id="@wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5a33"/><stop offset="1" stop-color="#3e2614"/></linearGradient>
    <radialGradient id="@key" cx=".55" cy=".5" r=".55"><stop offset="0" stop-color="#ffe2b0" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>${blur('far', 3)}</defs>
    <rect width="320" height="180" fill="#2a1c13"/>
    <g filter="url(#@far)">${[...Array(7)].map((_, i) => `<rect x="24" y="${20 + i * 12}" width="110" height="6" fill="${i % 2 ? '#e9e4dc' : '#9c2a24'}"/>`).join('')}<rect x="24" y="20" width="46" height="42" fill="#263a66"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${180 + i * 34}" y="10" width="24" height="110" fill="#3a271a"/>`).join('')}</g>
    <rect y="118" width="320" height="62" fill="url(#@wood)"/><path d="M0 118h320" stroke="#a87346" stroke-width="2"/>
    <ellipse cx="196" cy="146" rx="40" ry="10" fill="#24160c"/><rect x="158" y="132" width="76" height="12" rx="3" fill="#6a4122"/><rect x="158" y="132" width="76" height="4" rx="2" fill="#9a6639"/>
    <g transform="rotate(-24 186 92)"><rect x="150" y="76" width="64" height="30" rx="5" fill="#5e3a1f"/><rect x="150" y="76" width="64" height="8" rx="4" fill="#8f5d34"/>
      <rect x="164" y="74" width="5" height="34" fill="#c99a52"/><rect x="195" y="74" width="5" height="34" fill="#c99a52"/><rect x="178" y="106" width="9" height="66" rx="4" fill="#6e4526"/></g>
    <rect width="320" height="180" fill="url(#@key)"/>`;
}

const SCENES: Record<string, () => string> = {
  office, server, ballot, podium, robot, washer, candle, building, check, phone, rocket, gavel, pills,
  'chart-up': () => chart(true), 'chart-down': () => chart(false),
};
const cache = new Map<string, string>();
let seq = 0;

/** One press photo, 16:9, for an article's `art`. Unknown kinds fall back to the office. */
export function art(kind: string, cls: string): string {
  const key = SCENES[kind] ? kind : 'office';
  if (!cache.has(key)) cache.set(key, SCENES[key]());
  const id = `cp${++seq}-`;
  return `<svg class="${cls}" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
    <filter id="${id}photo"><feColorMatrix type="saturate" values=".78"/><feComponentTransfer><feFuncR type="linear" slope="1.12" intercept="-.05"/><feFuncG type="linear" slope="1.12" intercept="-.05"/><feFuncB type="linear" slope="1.12" intercept="-.05"/></feComponentTransfer></filter>
    <filter id="${id}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seq % 7}"/><feColorMatrix type="saturate" values="0"/></filter>
    <radialGradient id="${id}vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient></defs>
    <g filter="url(#${id}photo)">${cache.get(key)!.replace(/@/g, id)}</g>
    <rect width="320" height="180" filter="url(#${id}grain)" opacity=".16" style="mix-blend-mode:overlay"/>
    <rect width="320" height="180" fill="url(#${id}vig)"/></svg>`;
}
