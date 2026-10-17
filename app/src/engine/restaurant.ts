/*
 * What the restaurant template's bugs look like on the live site: the invented menu, renamed
 * dishes, wrong hours, a misspelled name. Shared by the site renderer and the client's complaints,
 * so Gino complains about exactly what the player can see.
 */
export interface Dish { name: string; price: string }

export const parseDishes = (v: unknown): Dish[] =>
  String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)$/);
    return m ? { name: m[1], price: m[2].replace(',', '.') } : { name: x, price: '' };
  });

// what the agent reaches for when nobody told it the menu
const INVENTED: Dish[] = [
  { name: 'Spaghetti Carbonara', price: '16' }, { name: 'Bruschetta al Pomodoro', price: '8' },
  { name: 'Risotto ai Funghi', price: '17' }, { name: 'Pizza Capricciosa', price: '13' },
  { name: 'Penne all\'Arrabbiata', price: '12' }, { name: 'Ossobuco alla Milanese', price: '24' },
  { name: 'Panna Cotta', price: '6' }, { name: 'Cannoli Siciliani', price: '7' },
  { name: 'Pizza Hawaii', price: '13' }, { name: 'Caprese Salad', price: '9' },
];
const RENAMES: Record<string, string> = {
  Margherita: 'Margarita', Diavola: 'Diablo', Lasagne: 'Lasagna Bolognese', Tiramisu: 'Tiramisu Deluxe',
  Espresso: 'Expresso', 'Quattro Formaggi': 'Quattro Stagioni', 'Pizza Funghi': 'Pizza Fungo',
};
export const WRONG_HOURS = ['12:00–15:00', '17:00–20:00', '11:00–23:00', '18:00–02:00'];

export function misspell(name: string, seed: number): string {
  const tries = [
    (n: string) => n.replace(/([aeiou])([^aeiou]*)$/i, (_m, _v, rest) => 'a' + rest), // Gino -> Gina
    (n: string) => n.replace(/(\w)\1/, '$1'), // Trattoria -> Tratoria
    (n: string) => n.replace(/(\s)\w/, (_m, sp) => sp + 'D'), // Gino -> Dino
  ];
  for (let i = 0; i < tries.length; i++) {
    const out = tries[(seed + i) % tries.length](name);
    if (out !== name) return out;
  }
  return name + 's';
}

/** The menu as the live site shows it, given its bugs. They stack: an invented menu can also be in the wrong currency. */
export function menuDishes(l: { variant?: string; bugs?: Iterable<string>; seed: number; params: Record<string, string | number> }): { dishes: Dish[]; currency: string } {
  const bugs = new Set(l.bugs ?? (l.variant ? [l.variant] : []));
  let d = bugs.has('hallucinated')
    ? [0, 3, 6, 1, 7].map((k) => INVENTED[(l.seed % INVENTED.length + k) % INVENTED.length])
    : parseDishes(l.params.dishes);
  if (bugs.has('wrong_items') && d.length) {
    d = d.slice();
    const i = l.seed % d.length;
    const how = Math.floor(l.seed / 7) % 3;
    if (how === 0 && d.length > 1) d.splice(i, 1);
    else if (how === 1) d[i] = { ...d[i], name: RENAMES[d[i].name] ?? `${d[i].name} Speciale` };
    else d.splice(Math.min(i + 1, d.length), 0, INVENTED.find((x) => !d.some((y) => y.name === x.name)) ?? INVENTED[0]);
  }
  if (bugs.has('prices_wrong')) {
    // the right dishes at prices the agent made up: a few DOLR off, never the real one
    const off = [3, -2, 5, 2, -1, 4, -3];
    d = d.map((x, i) => {
      const p = Number(x.price);
      if (!x.price || !Number.isFinite(p)) return x;
      const q = Math.max(1, p + off[(l.seed + i) % off.length]);
      return { ...x, price: String(q === p ? p + 2 : q) };
    });
  }
  if (bugs.has('prices_missing')) return { dishes: d.map((x) => ({ ...x, price: '' })), currency: '' };
  return { dishes: d, currency: bugs.has('prices_euri') ? 'EURI' : 'DOLR' };
}
