/*
 * Swaplist's listing photos: one small flat illustration per item, in the style of the app logos
 * (flat fills, no gradients or ids, rounded shapes), on a 64×48 canvas with a floor line.
 * Keys come from the catalogue in engine/swaplist.ts.
 */

const INK = '#2b2d33';
const floor = '<rect x="0" y="40" width="64" height="8" fill="#e6dff0"/>';
const wrap = (body: string) => `<svg viewBox="0 0 64 48" aria-hidden="true">${floor}${body}</svg>`;

const jacket = (c: string, dark: string, small = false) => {
  const t = small ? 'translate(8 6) scale(.75)' : 'translate(0 0)';
  return `<g transform="${t}"><path d="M24 6h16l10 6 4 22h-7l-1-12v22H18V22l-1 12h-7l4-22z" fill="${c}"/><path d="M27 6l5 8 5-8M32 14v28" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="34.5" cy="22" r="1" fill="${dark}"/><circle cx="34.5" cy="30" r="1" fill="${dark}"/></g>`;
};

const bike = (frame: string, wheel = 9, small = false) => {
  const y = small ? 33 : 31, r = small ? 6.5 : wheel;
  const a = small ? 20 : 15, b = small ? 44 : 49;
  return `<circle cx="${a}" cy="${y}" r="${r}" stroke="${INK}" stroke-width="2.4" fill="none"/><circle cx="${b}" cy="${y}" r="${r}" stroke="${INK}" stroke-width="2.4" fill="none"/>
    <path d="M${a} ${y}l${(b - a) * 0.35} -${r + 2}h${(b - a) * 0.45}L${b} ${y}M${a + (b - a) * 0.35} ${y - r - 2}L${a + (b - a) * 0.45} ${y}l${(b - a) * 0.35} -${r + 2}M${a + (b - a) * 0.35} ${y - r - 2}l-1 -4M${a + (b - a) * 0.28} ${y - r - 6}h6M${a + (b - a) * 0.8} ${y - r - 2}l1 -5h4" stroke="${frame}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const box = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#c99a62"/><rect x="${x}" y="${y}" width="${w}" height="4" fill="#b5844f"/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h * 0.45}" fill="#e8d3a8"/>`;

export const SWAP_ART: Record<string, string> = {
  watch: wrap(`<circle cx="32" cy="4.5" r="2.6" stroke="#c9a227" stroke-width="1.8" fill="none"/><rect x="29" y="6" width="6" height="5" rx="1.5" fill="#c9a227"/>
    <circle cx="32" cy="25" r="14" fill="#c9a227"/><circle cx="32" cy="25" r="11" fill="#fbf6e6"/>
    <path d="M32 25v-7M32 25l5 3" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><circle cx="32" cy="25" r="1.4" fill="${INK}"/>
    <path d="M32 15.5v1.6M32 33v1.6M22.5 25h1.6M40 25h1.6" stroke="#8a7a50" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M46 36c4 0 6 2 9 2" stroke="#c9a227" stroke-width="1.6" fill="none" stroke-dasharray="2 1.5"/>`),
  jacket_leather: wrap(jacket('#5b3a29', '#2e1c12')),
  jacket_kids: wrap(jacket('#e46b6b', '#9c3b3b', true)),
  jacket_rain: wrap(jacket('#f2c230', '#a8811a')),
  suit: wrap(`<path d="M24 6h16l10 6 4 22h-7l-1-12v22H18V22l-1 12h-7l4-22z" fill="#2e3a5c"/><path d="M28 6h8l-4 10z" fill="#fff"/><path d="M31 9h2l1 10-2 3-2-3z" fill="#b33a3a"/>
    <path d="M28 6l4 16 4-16" stroke="#1b2440" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="34" cy="30" r="1" fill="#1b2440"/><circle cx="34" cy="35" r="1" fill="#1b2440"/>`),
  bike_road: wrap(bike('#d9534f')),
  bike_mountain: wrap(bike('#2f80ed', 10)),
  bike_kids: wrap(bike('#e88bb5', 9, true) + `<path d="M20 33l-6 4" stroke="${INK}" stroke-width="1.6"/><circle cx="13" cy="37.5" r="2.4" fill="#f6f3fa" stroke="${INK}" stroke-width="1.6"/>`),
  lamp: wrap(`<rect x="18" y="37" width="16" height="4" rx="2" fill="${INK}"/><path d="M26 37l8-16-10-9" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 8l12-4 4 12-4 2z" fill="#3d9970"/><path d="M30 18l10 16H22z" fill="#fff6c8" opacity=".7"/>`),
  chair: wrap(`<rect x="22" y="6" width="20" height="18" rx="5" fill="#3a3f4a"/><rect x="20" y="25" width="24" height="6" rx="3" fill="#3a3f4a"/>
    <path d="M32 31v5M22 40l10-4 10 4" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22" cy="40" r="1.8" fill="${INK}"/><circle cx="42" cy="40" r="1.8" fill="${INK}"/>`),
  cables: wrap(box(16, 22, 32, 18) + `<path d="M20 22c-2-8 6-10 8-4s8 4 6-4 10-6 10 2M24 22c4-6 10-2 12-8M38 22c0-4 4-6 6-2" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <rect x="42" y="12" width="5" height="4" rx="1" fill="#e2a33a"/><rect x="25" y="13" width="4" height="3" rx="1" fill="#2f80ed"/>`),
  kettle: wrap(`<path d="M20 40l2-20c0-6 20-6 20 0l2 20z" fill="#9aa7b1"/><path d="M22 22h20" stroke="#7d8a94" stroke-width="2"/>
    <path d="M44 22c6 0 6 12 0 14" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M20 26l-7-7" stroke="#9aa7b1" stroke-width="4" stroke-linecap="round"/>
    <rect x="28" y="11" width="8" height="3" rx="1.5" fill="${INK}"/>`),
  monitor: wrap(`<rect x="10" y="6" width="44" height="27" rx="2" fill="${INK}"/><rect x="13" y="9" width="38" height="21" fill="#6ea8e6"/><rect x="15" y="27" width="1.6" height="1.6" fill="#fff"/>
    <path d="M32 33v5M24 40h16" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`),
  bookshelf: wrap(`<rect x="18" y="2" width="28" height="39" fill="#a8774a"/><rect x="21" y="5" width="22" height="33" fill="#7a5233"/>
    <path d="M21 13h22M21 21.5h22M21 30h22" stroke="#a8774a" stroke-width="2"/>
    <rect x="22" y="6" width="3" height="6" fill="#d9534f"/><rect x="25.5" y="7" width="3" height="5" fill="#2f80ed"/><rect x="29" y="6" width="2.5" height="6" fill="#e2a33a"/><path d="M33 12l3-5.5 2 1-3 4.5z" fill="#3d9970"/>
    <rect x="22" y="15.5" width="2.5" height="5" fill="#3d9970"/><rect x="25" y="14.5" width="3" height="6" fill="#e2a33a"/><rect x="35" y="15" width="3" height="5.5" fill="#d9534f"/><rect x="38.5" y="16" width="3" height="4.5" fill="#6e3fa3"/>
    <rect x="22" y="23.5" width="3" height="6" fill="#2f80ed"/><rect x="25.5" y="24.5" width="2.5" height="5" fill="#d9534f"/><rect x="28.5" y="23.5" width="3" height="6" fill="#3d9970"/>`),
  headphones: wrap(`<path d="M18 30v-6a14 14 0 0 1 28 0v6" stroke="${INK}" stroke-width="3" fill="none"/><rect x="14" y="26" width="8" height="13" rx="3" fill="#3a3f4a"/><rect x="42" y="26" width="8" height="13" rx="3" fill="#3a3f4a"/>
    <rect x="16" y="29" width="4" height="7" rx="1.5" fill="#d9534f"/><rect x="44" y="29" width="4" height="7" rx="1.5" fill="#d9534f"/>`),
  sofa: wrap(`<rect x="12" y="14" width="40" height="14" rx="4" fill="#8a96a0"/><rect x="6" y="20" width="10" height="16" rx="4" fill="#7a8690"/><rect x="48" y="20" width="10" height="16" rx="4" fill="#7a8690"/>
    <rect x="14" y="26" width="36" height="10" rx="2" fill="#9aa7b1"/><path d="M26.5 26v10M37.5 26v10" stroke="#8a96a0" stroke-width="1.2"/><path d="M10 36v4M54 36v4" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`),
  records: wrap(`<rect x="10" y="10" width="28" height="28" fill="#e2a33a"/><rect x="13" y="13" width="22" height="9" fill="#c8862a"/>
    <circle cx="40" cy="24" r="14" fill="${INK}"/><circle cx="40" cy="24" r="9" fill="none" stroke="#3d4048" stroke-width="1"/><circle cx="40" cy="24" r="4" fill="#d9534f"/><circle cx="40" cy="24" r="1" fill="${INK}"/>
    <rect x="6" y="14" width="28" height="26" fill="#3d9970"/><path d="M10 20h12M10 24h8" stroke="#e8f4ee" stroke-width="1.8" stroke-linecap="round"/>`),
  laptop: wrap(`<rect x="15" y="8" width="34" height="23" rx="2" fill="#3a3f4a"/><rect x="18" y="11" width="28" height="17" fill="#6ea8e6"/><path d="M8 33h48l-3 5H11z" fill="#9aa7b1"/><rect x="27" y="33" width="10" height="1.6" fill="#7d8a94"/>`),
  boxes: wrap(box(8, 24, 22, 16) + box(32, 18, 26, 22) + box(14, 10, 18, 14)),
  coffee_table: wrap(`<rect x="8" y="22" width="48" height="5" rx="1" fill="#a8774a"/><path d="M13 27v12M51 27v12M18 27v8M46 27v8" stroke="#7a5233" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="24" cy="21.5" rx="5" ry="1.4" fill="none" stroke="#7a5233" stroke-width="1.2"/>`),
  keyboard: wrap(`<rect x="6" y="20" width="52" height="18" rx="3" fill="#3a3f4a"/>
    ${[0, 1, 2].map((r) => Array.from({ length: 9 }, (_, c) => `<rect x="${9.5 + c * 5.3}" y="${23 + r * 4.6}" width="4" height="3.4" rx=".8" fill="${(r + c) % 4 === 0 ? '#e2a33a' : '#d7dbe0'}"/>`).join('')).join('')}`),
  saucepans: wrap(`<rect x="8" y="24" width="20" height="14" rx="2" fill="#9aa7b1"/><path d="M28 27h10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="7" y="21" width="22" height="3" rx="1.5" fill="#7d8a94"/>
    <rect x="34" y="28" width="22" height="10" rx="2" fill="#d9534f"/><path d="M34 31h-6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="34" y="12" width="20" height="13" rx="2" fill="#b5bec6"/><path d="M44 12V9" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`),
  plate: wrap(`<ellipse cx="32" cy="23" rx="18" ry="17" fill="#fbfbfb" stroke="#c9a227" stroke-width="2"/><ellipse cx="32" cy="23" rx="12" ry="11.5" fill="none" stroke="#2e3a5c" stroke-width="1.2"/>
    <circle cx="32" cy="20" r="4" fill="#2e3a5c"/><path d="M25.5 30c1.5-4 11.5-4 13 0z" fill="#2e3a5c"/><path d="M26 8.5l1 1.6M38 8.5l-1 1.6" stroke="#c9a227" stroke-width="1"/>`),
  desk: wrap(`<rect x="8" y="12" width="48" height="5" rx="1" fill="#e8e3da" stroke="#bdb5a6" stroke-width="1"/><path d="M16 17v22M48 17v22" stroke="${INK}" stroke-width="3.2"/>
    <path d="M10 39h12M42 39h12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="14.5" y="26" width="3" height="5" fill="#9aa7b1"/><rect x="46.5" y="26" width="3" height="5" fill="#9aa7b1"/><rect x="36" y="18.5" width="6" height="2" rx="1" fill="#3d9970"/>`),
};
