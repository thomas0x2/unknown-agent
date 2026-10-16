/* Static Yowl businesses and their seed reviews. The player reviews each once (engine state). */
export interface Business { id: string; name: string; category: string; price: string; address: string; owner: string }

export const BUSINESSES: Business[] = [
  { id: 'trattoria', name: 'Trattoria Gino', category: 'Italian restaurant', price: '$$', address: '14 Alder St', owner: 'Gino Fenoglio' },
  { id: 'spincycle', name: 'Spin Cycle Laundry', category: 'Laundromat', price: '$', address: 'Ferris St', owner: 'Hassan Okoro' },
  { id: 'beanthere', name: 'Bean There', category: 'Coffee shop', price: '$$', address: '3 Linden Ave', owner: 'Dana Reyes' },
  { id: 'ironyard', name: 'Iron Yard', category: 'Gym', price: '$$', address: '88 Harbor Rd', owner: 'Marcus Steele' },
  { id: 'generalai', name: 'GeneralAI (parking lot)', category: 'Parking', price: '$$$$', address: 'Route 9', owner: 'GeneralAI Inc.' },
];

export const YOWL_SEED: Record<string, { author: string; stars: number; text: string }[]> = {
  trattoria: [
    { author: 'Pia L.', stars: 5, text: 'The tiramisu alone is worth the walk. Gino remembers your name.' },
    { author: 'Tom R.', stars: 4, text: 'Solid Margherita, cozy room. Cash-only used to annoy me, glad the site takes bookings now.' },
  ],
  spincycle: [
    { author: 'walked_there_again', stars: 2, text: 'Every machine busy. Again. The owner keeps posting some raw "status feed" nobody can read.' },
    { author: 'Nadia', stars: 3, text: 'Clean enough. There was a van idling out back at 2am last week, weird.' },
  ],
  beanthere: [
    { author: 'espresso_or_death', stars: 1, text: 'Burnt. Every time. And a twenty minute wait for it.' },
    { author: 'commuter22', stars: 2, text: 'Slow service, grumpy staff. The muffins are fine.' },
  ],
  ironyard: [
    { author: 'liftbro', stars: 3, text: 'New place, half the machines still in boxes. Potential though.' },
  ],
  generalai: [
    { author: 'former_employee', stars: 1, text: 'They paved paradise and put up a parking lot. Then automated the attendant.' },
  ],
};
