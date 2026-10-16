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

/** The menu as the live site shows it, given the bug it has (if any). */
export function menuDishes(l: { variant?: string; seed: number; params: Record<string, string | number> }): { dishes: Dish[]; currency: string } {
  const spec = parseDishes(l.params.dishes);
  switch (l.variant) {
    case 'hallucinated': {
      const start = l.seed % INVENTED.length;
      return { dishes: [0, 3, 6, 1, 7].map((k) => INVENTED[(start + k) % INVENTED.length]), currency: 'DOLR' };
    }
    case 'prices_missing': return { dishes: spec.map((d) => ({ ...d, price: '' })), currency: '' };
    case 'prices_curo': return { dishes: spec, currency: 'CURO' };
    case 'wrong_items': {
      const d = spec.slice();
      if (!d.length) return { dishes: d, currency: 'DOLR' };
      const i = l.seed % d.length;
      const how = Math.floor(l.seed / 7) % 3;
      if (how === 0 && d.length > 1) d.splice(i, 1);
      else if (how === 1) d[i] = { ...d[i], name: RENAMES[d[i].name] ?? `${d[i].name} Speciale` };
      else d.splice(Math.min(i + 1, d.length), 0, INVENTED.find((x) => !d.some((y) => y.name === x.name)) ?? INVENTED[0]);
      return { dishes: d, currency: 'DOLR' };
    }
    default: return { dishes: spec, currency: 'DOLR' };
  }
}
