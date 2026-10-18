/* Y profile pictures for the story's accounts, drawn as inline SVG in one house style: flat
   geometric shapes, a dark outline, a muted palette with one neon accent each, a single flat shade
   on the face and a plain background. Everyone else keeps an initials tile (avatar() in view.ts). */

const INK = '#1c1e24';
const SHADE = 'rgba(0,0,0,.16)';

const svg = (bg: string, body: string, viewBox = '0 0 64 64') =>
  `<svg viewBox="${viewBox}" preserveAspectRatio="none" aria-hidden="true"><rect x="-8" y="-8" width="80" height="80" fill="${bg}"/>`
  + `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

// ── shared parts (a centred head and shoulders on a 64×64 grid) ──
const shoulders = (fill: string, wide = 0) =>
  `<path d="M${6 - wide} 66 C${6 - wide} 52 ${17 - wide} 46 32 46 C${47 + wide} 46 ${58 + wide} 52 ${58 + wide} 66Z" fill="${fill}"/>`;
const neck = (skin: string) =>
  `<path d="M27 37 V48 H37 V37Z" fill="${skin}"/><path d="M27 41 H37 V45 Q32 47 27 45Z" fill="${SHADE}" stroke="none"/>`;
const ears = (skin: string) =>
  `<ellipse cx="21" cy="30" rx="2.4" ry="3.4" fill="${skin}"/><ellipse cx="43" cy="30" rx="2.4" ry="3.4" fill="${skin}"/>`;
const head = (skin: string) =>
  `<ellipse cx="32" cy="29" rx="11" ry="13" fill="${skin}"/><path d="M32 16 A11 13 0 0 1 32 42 A8 13 0 0 0 32 16Z" fill="${SHADE}" stroke="none"/>`;
const face = (skin: string) => ears(skin) + head(skin);
const dot = (x: number, y: number, r = 1.3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" stroke="none"/>`;
const eyes = (y = 30, r = 1.3) => dot(28, y, r) + dot(36, y, r);
const line = (d: string, w = 1.6) => `<path d="${d}" fill="none" stroke-width="${w}"/>`;
const shirtV = (fill: string) => `<path d="M26 46.5 L32 57 L38 46.5Z" fill="${fill}"/>`;

/** Randall Crane: orange tan, the swoop, navy suit, a very long tie. */
const CRANE = svg('#4b5876',
  shoulders('#2b3352') + shirtV('#ebe7de')
  + `<path d="M30.4 49 H33.6 L35 61 L32 65 L29 61Z" fill="#ff2e5f"/>`
  + neck('#e5a165') + face('#e5a165')
  + `<path d="M20.5 28 C18.5 17 26 12.5 34 13 C42 13.5 46.5 18 45 25 C42 20.5 35 19 28 20.5 C25 21.5 22 24 20.5 28Z" fill="#efc65c"/>`
  + `<path d="M28 20.5 C33 17.5 40 18 45 25" fill="none" stroke-width="1.4"/>`
  + line('M26 28.6 H30') + line('M34 28.6 H38')
  + `<ellipse cx="32" cy="36.4" rx="1.7" ry="1.3" fill="#a8543a"/>`);

/** Candidate 2030: Crane's opponent. Any suit, any smile, a flag pin. */
const CANDIDATE = svg('#878c95',
  shoulders('#4a5566') + shirtV('#ece9e2')
  + `<path d="M30.6 49 H33.4 L34.2 57 L32 60 L29.8 57Z" fill="#6f7f95"/>`
  + `<path d="M26 46.5 L30 55 M38 46.5 L34 55" fill="none" stroke-width="1.6"/>`
  + `<rect x="39.5" y="51" width="5" height="3.4" fill="#ece9e2" stroke-width="1.2"/><path d="M39.5 52.2 H44.5 M39.5 53.4 H44.5" fill="none" stroke="#ff3355" stroke-width="0.9"/><rect x="39.5" y="51" width="2" height="1.6" fill="#3b4f86" stroke="none"/>`
  + neck('#e9c1a0') + face('#e9c1a0')
  + `<path d="M21 26 C20.5 16 27 13 33 13.3 C40 13.5 44.5 17.5 43 26 C41.5 21.5 38 19 30 19.3 C26 19.5 23 22 21 26Z" fill="#5e4a3a"/>`
  + `<path d="M21 26 C21 24 21.5 23 22.2 22.3 M43 26 C43 24 42.6 23 42 22.3" fill="none" stroke="#b3aca4" stroke-width="1.6"/>`
  + `<path d="M26.4 19.6 C29 18 33 17.6 36 18.4" fill="none" stroke-width="1.2"/>`
  + eyes(29.8, 1.3) + `<path d="M27.5 34.4 Q32 40 36.5 34.4Z" fill="#f6f4ee" stroke-width="1.5"/>`);

/** Axel Rook: black tee, receding hair, the smirk, a small rocket on the chest. */
const ROOK = svg('#3d3a4c',
  shoulders('#24252c') + `<path d="M26 46.5 Q32 51 38 46.5" fill="none"/>`
  + `<path d="M41 57 L43 51.5 L45 57Z" fill="#2ef2ff"/>`
  + neck('#eec8a4') + face('#eec8a4')
  + `<path d="M21.3 27 C20.5 18 26 15 32 15 C38 15 43.5 18 42.7 27 C41 22.5 38.5 21.5 35.5 21.8 C33 19.8 30 20 28 21.8 C25 21.5 22.5 23 21.3 27Z" fill="#3b2f2a"/>`
  + line('M26.5 28 H30') + line('M34 28 H37.5') + eyes(30.5, 1.2)
  + line('M29 36.5 Q33 37.6 36 35'));

/** Cal Hartman: grey crewneck, soft brown hair, earnest eyebrows, a status light on the collar. */
const HARTMAN = svg('#8ea698',
  shoulders('#9b9ca0') + `<path d="M26 46.5 Q32 51.5 38 46.5" fill="#e9e6df"/>`
  + `<circle cx="41.5" cy="53" r="1.8" fill="#3dffa8"/>`
  + neck('#f1d0b0') + face('#f1d0b0')
  + `<path d="M21 26 C20 16 27 13.5 33 14 C40 14 44.5 18 43 26 C40.5 21.5 37 22.5 34.5 19.5 C31 22.5 26 21 21 26Z" fill="#6b4a33"/>`
  + line('M25.8 26.6 Q28 25.4 30.2 26.4', 1.4) + line('M33.8 26.4 Q36 25.4 38.2 26.6', 1.4)
  + eyes(30.2, 1.6) + line('M30 36.4 H34', 1.4));

/** Caleb Moxon: grey hoodie, dark curls, thin glasses, stubble, a lanyard with no badge on it. */
const MOXON = svg('#5f6b7a',
  shoulders('#7d8288') + `<path d="M24 46 Q32 53 40 46 L38 49 Q32 54 26 49Z" fill="#6a6f75"/>`
  + `<path d="M29.5 50 V54 M34.5 50 V54" fill="none" stroke-width="1.2"/>`
  + `<path d="M26.5 47 L31 60 M37.5 47 L33 60" fill="none" stroke="#3dd8ff" stroke-width="1.6"/><rect x="30.6" y="59.4" width="2.8" height="2.4" rx="0.6" fill="#b9bec4" stroke-width="1.1"/>`
  + neck('#e4bc98') + face('#e4bc98')
  + `<path d="M20.8 27 C19 19 23 14.5 27 14.6 C28.5 12.6 32.5 12.4 34.5 14 C38 12.8 42.5 15 43.4 19.5 C45 22.5 44 25 43.2 27 C42 23 40 21.5 37.5 21.8 C35 20.4 31 20.4 28.5 21.6 C25.5 21.3 22.5 23 20.8 27Z" fill="#2f2924"/>`
  + `<path d="M24 17.5 Q25.5 16 27 17.5 M30.5 15.8 Q32 14.4 33.5 15.8 M37 16.8 Q38.5 15.6 40 17.2" fill="none" stroke-width="1.1"/>`
  + `<path d="M23.5 34 C24.5 40.5 28 42.5 32 42.5 C36 42.5 39.5 40.5 40.5 34 C38 37.5 26 37.5 23.5 34Z" fill="rgba(47,41,36,.28)" stroke="none"/>`
  + `<rect x="24.8" y="28.2" width="6.4" height="3.8" rx="0.8" fill="none" stroke-width="1.2"/><rect x="32.8" y="28.2" width="6.4" height="3.8" rx="0.8" fill="none" stroke-width="1.2"/>`
  + line('M31.2 29.6 H32.8', 1.1) + eyes(30.2, 1.1)
  + line('M26 33.4 Q28 34.2 30 33.4', 0.9) + line('M34 33.4 Q36 34.2 38 33.4', 0.9)
  + line('M29.6 37.4 H34.4', 1.4));

/** Max Stryker: shaved head, beard, sunglasses, gold chain, a shirt one size too small. */
const STRYKER = svg('#6a3a40',
  shoulders('#1f1f25', 4) + `<path d="M25 47 Q32 56 39 47" fill="none" stroke="#caa24a" stroke-width="2.2"/>`
  + neck('#c69070') + face('#c69070')
  + `<ellipse cx="27" cy="20" rx="3.4" ry="1.8" fill="rgba(255,255,255,.35)" stroke="none" transform="rotate(-25 27 20)"/>`
  + `<path d="M21.6 32 C22 41 27 43 32 43 C37 43 42 41 42.4 32 C39 37.5 25 37.5 21.6 32Z" fill="#4a3a33"/>`
  + `<rect x="23.5" y="26.5" width="7.5" height="5" rx="1.8" fill="#16171b"/><rect x="33" y="26.5" width="7.5" height="5" rx="1.8" fill="#16171b"/>`
  + `<path d="M31 28 H33" fill="none"/>`
  + `<path d="M25 30 L28 27.8 M34.5 30 L37.5 27.8" fill="none" stroke="#ff2bd6" stroke-width="1.3"/>`
  + line('M29.5 38.3 H34.5', 1.4));

/** Mara Vey: dark bob, round glasses, trench coat, press lanyard. */
const VEY = svg('#4d7977',
  `<path d="M19 33 C17 17 25 12.5 32 12.5 C39 12.5 47 17 45 33 V41 H39.5 V30 H24.5 V41 H19Z" fill="#2a2226"/>`
  + shoulders('#c7b28a') + `<path d="M25 46.5 L32 60 L39 46.5Z" fill="#2f3a44"/>`
  + `<path d="M25 46.5 L29 55 L26 56 M39 46.5 L35 55 L38 56" fill="none"/>`
  + `<path d="M28 47 L32 56 L36 47" fill="none" stroke="#e6ff3a" stroke-width="1.6"/><rect x="29.5" y="55.5" width="5" height="6" rx="0.8" fill="#e6ff3a"/>`
  + neck('#e9bf9d') + head('#e9bf9d')
  + `<path d="M20.8 27 C21.5 17 27.5 14.3 33 14.3 C39 14.3 43.5 18 43.2 27 C38 23.5 29 21 20.8 27Z" fill="#2a2226"/>`
  + `<circle cx="28" cy="30.5" r="3.2" fill="rgba(255,255,255,.22)" stroke-width="1.5"/><circle cx="36" cy="30.5" r="3.2" fill="rgba(255,255,255,.22)" stroke-width="1.5"/>`
  + line('M31.2 30.3 H32.8', 1.4) + eyes(30.5, 1.1) + line('M30 36.6 Q32 37.4 34 36.6', 1.4));

/** Logan Pryce: 22, swept-back hair, AirPods in, a grey fleece vest over a white tee. */
const LOGAN = svg('#e8e2d4',
  shoulders('#f4f4f2') + `<path d="M6 66 C6 52 15 47 24 46.5 L27 66Z M58 66 C58 52 49 47 40 46.5 L37 66Z" fill="#8f979e"/>`
  + `<path d="M24.5 50 H26.5 M37.5 50 H39.5" fill="none" stroke="#e6ff3a" stroke-width="1.8"/>`
  + neck('#f0c8a6') + face('#f0c8a6')
  + `<path d="M20.6 26 C20.5 17.5 26 14 33 14.2 C39.5 14.4 44 18 43.4 26 C41 21.5 36 19.6 30.5 20.2 C26 20.6 22.5 22.5 20.6 26Z" fill="#b07a4a"/>`
  + `<path d="M19.6 30.5 V35" stroke="#fff" stroke-width="2.4"/><path d="M44.4 30.5 V35" stroke="#fff" stroke-width="2.4"/>`
  + eyes(30) + line('M26.2 26.4 Q28 25.6 29.8 26.4 M34.2 26.4 Q36 25.6 37.8 26.4', 1.4)
  + line('M28.5 36 Q32 38.6 35.5 36', 1.5));

/** Dr. Adam Hoberman: black shirt, close crop, full beard, the stare, a morning sun behind him. */
const HOBERMAN = svg('#6f8a8f',
  `<circle cx="50" cy="15" r="7" fill="#ffb02e"/>`
  + shoulders('#1f2024') + `<path d="M27 46.5 L32 52.5 L37 46.5" fill="none"/>`
  + neck('#e7c09e') + face('#e7c09e')
  + `<path d="M21 26 C20.5 17 26 14 32 14 C38 14 43.5 17 43 26 C41.5 21 37 19.5 32 19.5 C27 19.5 22.5 21 21 26Z" fill="#2a2420"/>`
  + `<path d="M21.5 30 C21.5 40 26 43.5 32 43.5 C38 43.5 42.5 40 42.5 30 C41 34 38 35.6 32 35.6 C26 35.6 23 34 21.5 30Z" fill="#2a2420"/>`
  + `<path d="M29 38.6 H35" fill="none" stroke="#9a8d82" stroke-width="1.4"/>`
  + line('M25.8 26.8 H30.6 M33.4 26.8 H38.2', 2.2) + eyes(29.8, 1.5));

/** deskjockey: blue shirt, red braces, slicked hair, the tickers in his glasses. */
const DESKJOCKEY = svg('#2e4a3d',
  shoulders('#7c9cc4') + `<path d="M26.5 46.5 L30 51 L32 47.5 L34 51 L37.5 46.5" fill="#d9e3ef"/>`
  + `<path d="M22 49 L24 66 M42 49 L40 66" fill="none" stroke="#7a2f36" stroke-width="3"/>`
  + neck('#e8c4a2') + face('#e8c4a2')
  + `<path d="M21 26 C20.5 15.5 27 13 33 13 C40 13 44 17 43 26 C40.5 19 31 16.5 21 26Z" fill="#2c2723"/>`
  + `<path d="M26 18.5 C30 16.8 36 16.8 40 19" fill="none" stroke-width="1.2"/>`
  + `<rect x="24" y="27.5" width="7" height="5" rx="1" fill="#1c2a24" stroke-width="1.5"/><rect x="33" y="27.5" width="7" height="5" rx="1" fill="#1c2a24" stroke-width="1.5"/>`
  + `<path d="M31 29.5 H33" fill="none" stroke-width="1.4"/>`
  + `<path d="M25.2 31 L27 29.6 L28.2 30.4 L30 28.8 M34.2 31 L36 29.6 L37.2 30.4 L39 28.8" fill="none" stroke="#39ff88" stroke-width="1"/>`
  + line('M29.5 37 H34.5', 1.5));

/** 6ft_sigma: quarter-zip vest, cap pulled low, chin up. */
const SIGMA = svg('#5b6570',
  shoulders('#a8bfd5') + `<path d="M8 66 C8 54 16 48 24 47 L28 66Z M56 66 C56 54 48 48 40 47 L36 66Z" fill="#33404d"/>`
  + neck('#e3b994') + face('#e3b994')
  + `<path d="M20.8 25 C20.5 15 26 12 32 12 C38 12 43.5 15 43.2 25Z" fill="#2d2d34"/>`
  + `<path d="M20 25 H44 L48 27 Q32 29.5 16.5 27Z" fill="#2d2d34"/>`
  + `<path d="M29.5 16.5 H34.5 M29.5 16.5 L32 18.8 L29.5 21 H34.5" fill="none" stroke="#c8ff2e" stroke-width="1.4"/>`
  + `<path d="M26 31 H30 M34 31 H38" fill="none" stroke-width="1.8"/>`
  + line('M29.5 37.4 Q32 36.4 34.5 37.4', 1.5));

/** Viktor: balding, grey, cardigan, reading glasses, a pen from the old job. */
const VIKTOR = svg('#787264',
  shoulders('#6b5a49') + `<path d="M26 46.5 L32 58 L38 46.5Z" fill="#d9d3c5"/>`
  + `<path d="M26 46.5 L31 60 M38 46.5 L33 60" fill="none"/>`
  + `<path d="M40.5 50 V55" fill="none" stroke="#ff9d2e" stroke-width="2.4"/>`
  + neck('#dcae8c') + face('#dcae8c')
  + `<path d="M20.6 31 C19.6 24 21 21 23.8 20.2 C23.4 24 23.4 27 23.6 32Z" fill="#c9c6bf"/><path d="M43.4 31 C44.4 24 43 21 40.2 20.2 C40.6 24 40.6 27 40.4 32Z" fill="#c9c6bf"/>`
  + line('M26.4 26.8 Q28 26.2 29.6 26.8', 1.3) + line('M34.4 26.8 Q36 26.2 37.6 26.8', 1.3)
  + `<rect x="24.6" y="29.5" width="6.4" height="4" rx="1.2" fill="none" stroke-width="1.4"/><rect x="33" y="29.5" width="6.4" height="4" rx="1.2" fill="none" stroke-width="1.4"/>`
  + `<path d="M31 31 H33" fill="none" stroke-width="1.2"/>` + line('M26.5 31.6 H29.2', 1.2) + line('M34.8 31.6 H37.5', 1.2)
  + line('M29.5 38 Q32 37.2 34.5 38', 1.4));

/** The sales rep: quarter-zip, headset, the smile. */
const SALES_REP = svg('#3e6e8e',
  shoulders('#2c3e52') + `<path d="M28 46.5 L32 50 L36 46.5" fill="#2c3e52"/><path d="M32 50 V66" fill="none" stroke-width="1.4"/>`
  + neck('#f0caa6') + face('#f0caa6')
  + `<path d="M21 26 C20.5 16 27 13.5 33 13.8 C40 14 44.5 18 43 26 C40 20.5 33 19.5 30 18.5 C27 21 24 22 21 26Z" fill="#8a5a2c"/>`
  + `<path d="M19.5 30 C19.5 14 44.5 14 44.5 30" fill="none" stroke-width="2.6"/>`
  + `<rect x="17.5" y="27" width="4" height="7" rx="1.6" fill="#33343a"/>`
  + `<path d="M19.5 34 Q20 39 27 38.5" fill="none" stroke-width="1.6"/><circle cx="27.6" cy="38.5" r="1.5" fill="#ff3fa4"/>`
  + eyes(29.6, 1.3) + `<path d="M28.5 34.6 Q32 39.4 35.5 34.6Z" fill="#f4f1ea" stroke-width="1.5"/>`);

/** Wade Tillman: camo cap pulled low, full beard, a flannel shirt, a foil lining showing under the brim. */
const WADE = svg('#6b7356',
  shoulders('#a3423a') + `<path d="M20 50 V66 M44 50 V66" fill="none" stroke="#7d2f29" stroke-width="1.4"/>`
  + neck('#e2b48e') + face('#e2b48e')
  + `<path d="M21 31 C21 41 26 45 32 45 C38 45 43 41 43 31 C40 36 36 37 32 37 C28 37 24 36 21 31Z" fill="#8a6240"/>`
  + `<path d="M29 39.5 Q32 40.6 35 39.5" fill="none" stroke-width="1.4"/>`
  + eyes(29.6, 1.3)
  + `<path d="M20 24 C20 14 26 11 32 11 C38 11 44 14 44 24Z" fill="#5d6b3d"/>`
  + `<path d="M26 14 L29 19 M36 13.5 L34 18 M40 17 L38.5 21" fill="none" stroke="#3f4a28" stroke-width="2.4"/>`
  + `<path d="M18 24 H47 Q46 27.5 42 27.5 H22 Q18.5 27.5 18 24Z" fill="#4a5630"/>`
  + `<path d="M21 27.5 H42" fill="none" stroke="#d9dde2" stroke-width="1.2"/>`);

/** dev_null: hood up, no face, two cursors. */
const DEV_NULL = svg('#1d2925',
  `<path d="M14 66 C14 52 20 47 32 47 C44 47 50 52 50 66Z" fill="#3a3f46"/>`
  + `<path d="M17 47 C14 24 21 12 32 12 C43 12 50 24 47 47Z" fill="#3a3f46"/>`
  + `<ellipse cx="32" cy="31" rx="9.5" ry="11.5" fill="#121518"/>`
  + `<path d="M17 47 C14 24 21 12 32 12 C43 12 50 24 47 47" fill="none"/>`
  + `<rect x="26.5" y="29" width="3" height="4" fill="#39ff6a" stroke="none"/><rect x="34.5" y="29" width="3" height="4" fill="#39ff6a" stroke="none"/>`
  + `<path d="M28 48 V58 M36 48 V58" fill="none" stroke="#c9ccd1" stroke-width="1.4"/>`);

/** studioghast: a ghost in a beret, holding the pencil. */
const STUDIOGHAST = svg('#6e6985',
  `<path d="M18 60 V30 C18 19.5 24 14.5 32 14.5 C40 14.5 46 19.5 46 30 V60 L42 56 L38 60 L34 56 L30 60 L26 56 L22 60Z" fill="#ece9f2"/>`
  + `<path d="M41 22 A10 14 0 0 1 46 30 V58 L44 58 V31 C44 27 43 24 41 22Z" fill="${SHADE}" stroke="none"/>`
  + `<ellipse cx="32" cy="15.5" rx="11" ry="3.8" fill="#3a3346" transform="rotate(-8 32 15.5)"/><path d="M33 11.8 V9.5" fill="none" stroke-width="2.2"/>`
  + `<ellipse cx="28" cy="29" rx="1.7" ry="2.6" fill="${INK}" stroke="none"/><ellipse cx="36" cy="29" rx="1.7" ry="2.6" fill="${INK}" stroke="none"/>`
  + `<ellipse cx="32" cy="36" rx="1.4" ry="1.8" fill="${INK}" stroke="none"/>`
  + `<g transform="rotate(35 46 44)"><rect x="44" y="34" width="4" height="16" fill="#d8b45c"/><path d="M44 50 L46 55 L48 50Z" fill="#ff4fb0"/></g>`);

/** The Current: a paper circle, three waves, one lit. */
const CURRENT = svg('#1f2b3a',
  `<circle cx="32" cy="32" r="19" fill="#e9e4d8"/>`
  + `<path d="M18 25 Q22.5 21 27 25 T36 25 T46 25" fill="none" stroke-width="2.4"/>`
  + `<path d="M15.5 32 Q20.5 28 25 32 T34.5 32 T48.5 32" fill="none" stroke="#2ee6ff" stroke-width="3.4"/>`
  + `<path d="M18 39 Q22.5 35 27 39 T36 39 T46 39" fill="none" stroke-width="2.4"/>`);

/** CityPulse: a screen with a heartbeat on it. */
const CITYPULSE = svg('#7c3536',
  `<rect x="13" y="16" width="38" height="32" rx="6" fill="#26262c"/>`
  + `<path d="M17 33 H24 L27 27 L31 40 L35 22 L38 33 H47" fill="none" stroke="#f4ff3a" stroke-width="2.4"/>`
  + `<path d="M26 54 H38" fill="none" stroke-width="2.4"/>`);

/** Liftoff Daily: a rocket on its way up. */
const LIFTOFF = svg('#2d3550',
  `<g transform="rotate(35 32 32)">`
  + `<path d="M28.5 47 L32 58 L35.5 47Z" fill="#ff7a1a"/>`
  + `<path d="M27 40 L21 48 L27 46Z M37 40 L43 48 L37 46Z" fill="#8a93a8"/>`
  + `<path d="M27 47 V24 C27 16 32 9 32 9 C32 9 37 16 37 24 V47Z" fill="#dcd8cf"/>`
  + `<path d="M34.5 16 C36 19 37 21.5 37 24 V47 H34.5Z" fill="${SHADE}" stroke="none"/>`
  + `<circle cx="32" cy="27" r="3" fill="#6d86a8"/></g>`);

/** MarketWire: three bars and a line that only goes up. */
const MARKETWIRE = svg('#2e3640',
  `<rect x="16" y="36" width="8" height="14" fill="#7b8ea3"/><rect x="28" y="28" width="8" height="22" fill="#7b8ea3"/><rect x="40" y="20" width="8" height="30" fill="#7b8ea3"/>`
  + `<path d="M14 50 H50" fill="none" stroke-width="2.2"/>`
  + `<path d="M14 34 L24 26 L32 30 L46 16 M40 16 H46 V22" fill="none" stroke="#2bff88" stroke-width="2.6"/>`);

/** DoorDish: the takeaway bag from its logo. */
const DOORDISH = svg('#d8343b',
  `<path d="M17 24 H47 L44 52 H20Z" fill="#f4f1ea"/>`
  + `<path d="M26 24 V20 C26 14 38 14 38 20 V24" fill="none" stroke-width="2.4"/>`
  + `<path d="M40 24 H47 L44 52 H38.5Z" fill="${SHADE}" stroke="none"/>`
  + `<path d="M24 34 H40" fill="none" stroke="#d8343b" stroke-width="2.6"/>`);

/** Spin Cycle regulars: the front-loader everyone is waiting for. */
const SPIN_CYCLE = svg('#5c7b8b',
  `<rect x="14" y="10" width="36" height="46" rx="4" fill="#e3e1db"/>`
  + `<path d="M14 19 H50" fill="none"/><circle cx="43.5" cy="14.5" r="1.8" fill="#9aa0a8" stroke-width="1.4"/><path d="M19 14.5 H27" fill="none" stroke-width="1.6"/>`
  + `<circle cx="32" cy="37" r="12.5" fill="#b9bdc4"/><circle cx="32" cy="37" r="8.8" fill="#3e5765"/>`
  + `<path d="M23.4 39 Q27.5 36 32 39 T40.6 39 A8.8 8.8 0 0 1 23.4 39Z" fill="#2affd5" stroke="none"/>`
  + `<circle cx="32" cy="37" r="8.8" fill="none"/>`);

/** WallStreetBags: the mascot in a suit, hair slicked back, aviators, a tie the colour of a green day. */
const WSB = svg('#3a4a3f',
  shoulders('#2a2c33', 2) + shirtV('#ebe7de')
  + `<path d="M26 46.5 L30.5 56 M38 46.5 L33.5 56" fill="none" stroke-width="1.6"/>`
  + `<path d="M30.4 49 H33.6 L34.6 58 L32 61 L29.4 58Z" fill="#7dff3a"/>`
  + neck('#e8b892') + face('#e8b892')
  + `<path d="M20.8 27 C19.5 16 26 12 32.5 12 C40 12 45 16.5 43.2 27 C42 21.5 39 18.5 32 18.5 C26 18.5 22.5 21.5 20.8 27Z" fill="#2b2420"/>`
  + `<path d="M25 16.8 C29 15 35 15 40 17.4 M24 19.6 C28 17.6 36 17.4 41.6 20.6" fill="none" stroke="#5a4c44" stroke-width="1"/>`
  + `<path d="M23.4 26.8 H31 L30.2 30.8 C29.6 32.6 25 32.6 24.2 30.6Z" fill="#16171b"/><path d="M33 26.8 H40.6 L39.8 30.6 C39 32.6 34.4 32.6 33.8 30.8Z" fill="#16171b"/>`
  + `<path d="M31 27.4 H33" fill="none"/>`
  + `<path d="M25.4 28.4 L27.4 27.8 M35 28.4 L37 27.8" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1"/>`
  + line('M28.5 37 Q33 38.4 36.5 35.6'));

/** Pollymarket: its parrot, side on, on the brand blue. */
const POLLY = svg('#2c5cff',
  `<path d="M17 66 C12 46 15 24 33 21 C43 19.5 50 25 51 33 L36 38 C32 45 33 55 39 66Z" fill="#f2f4fa"/>`
  + `<path d="M51 33 C58 33.5 60 41 56 48 C55.2 43.5 52.5 41.4 47.6 41.6 L36 38Z" fill="#ffd23a"/>`
  + `<path d="M26 22.5 C24 17 26 12.5 30 11 M33 21 C33 16 36 12.8 40 12.6" fill="none" stroke-width="2.4"/>`
  + `<circle cx="40" cy="29" r="4.2" fill="#fff"/>` + dot(41, 29, 2));

/** Perdure Pharma: its half-filled capsule disc, white on the brand violet. */
const PERDURE = svg('#3d2c6b',
  `<g transform="translate(12 12) scale(1.25)" stroke="none" fill="#fff"><path d="M3 16 A13 13 0 1 0 29 16 A13 13 0 1 0 3 16 Z M14.586 23.071 L23.071 14.586 A4 4 0 0 0 17.414 8.929 L8.929 17.414 A4 4 0 0 0 14.586 23.071 Z" fill-rule="evenodd"/>`
  + `<path d="M18.333 19.323 L12.677 13.667 L8.929 17.414 A4 4 0 0 0 14.586 23.071 Z"/></g>`);

/** By Y handle. The impostor shares Crane's picture, saved at the wrong size. */
export const Y_AVATARS: Record<string, string> = {
  randall_crane: CRANE,
  randa11_crane: CRANE.replace('viewBox="0 0 64 64"', 'viewBox="5 0 54 64"'),
  candidate_2030: CANDIDATE,
  axel_rook: ROOK,
  cal_hartman: HARTMAN,
  caleb_moxon: MOXON,
  max_stryker: STRYKER,
  mara_vey: VEY,
  logan_ships: LOGAN,
  dr_hoberman: HOBERMAN,
  deskjockey: DESKJOCKEY,
  '6ft_sigma': SIGMA,
  viktor: VIKTOR,
  a_sales_rep: SALES_REP,
  wade_awake: WADE,
  dev_null: DEV_NULL,
  studioghast: STUDIOGHAST,
  the_current: CURRENT,
  citypulse: CITYPULSE,
  liftoff_daily: LIFTOFF,
  marketwire: MARKETWIRE,
  wallstreetbags: WSB,
  pollymarket: POLLY,
  doordish: DOORDISH,
  perdure_pharma: PERDURE,
  spin_cycle_regulars: SPIN_CYCLE,
};
