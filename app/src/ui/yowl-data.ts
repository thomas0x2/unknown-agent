/* Yowl businesses and their seed reviews, already live before Day 1 (or from their `day`). The player
   adds one review per business at runtime (engine state); these are the neighbours who got there
   first. A hack can delete one (state.removedSeed). */
export interface Business {
  id: string;
  name: string;
  category: string;
  price: string;
  address: string;
  owner: string;
  hours: string;
  about: string;
}

export interface SeedReview { author: string; stars: number; text: string; day?: number }

export const BUSINESSES: Business[] = [
  {
    id: 'beanthere', name: 'Bean There', category: 'Coffee & Tea', price: '$$', address: '3 Linden Ave', owner: 'Dana Reyes',
    hours: 'Mon–Sat 07:00–16:00', about: 'Specialty coffee, house-baked muffins, and free wifi. Laptop friendly — allegedly.',
  },
  {
    id: 'ironyard', name: 'Iron Yard', category: 'Gym · Strength', price: '$$', address: '88 Harbor Rd', owner: 'Marcus Steele',
    hours: 'Daily 06:00–23:00', about: 'New strength studio. Racks, platforms, kettlebells. Grand opening this month.',
  },
  {
    id: 'spincycle', name: 'Spin Cycle Laundry', category: 'Laundromat', price: '$', address: '201 Ferris St', owner: 'Hassan Okoro',
    hours: 'Daily 06:00–00:00', about: 'Eight washers, six dryers, most of them working. Card and DOLR accepted.',
  },
  {
    id: 'generalai', name: 'GeneralAI (visitor parking)', category: 'Parking', price: '$$$$', address: 'Route 9', owner: 'GeneralAI Inc.',
    hours: 'Always open', about: 'Visitor parking for the GeneralAI campus. Attendant fully automated.',
  },
];

export const YOWL_SEED: Record<string, SeedReview[]> = {
  beanthere: [
    { author: 'espresso_or_death', stars: 1, text: 'Burnt. Every single time. And a twenty-minute wait for the privilege.' },
    { author: 'commuter22', stars: 2, text: 'Slow service, staff seem annoyed you came in. The muffins are fine, I guess.' },
    { author: 'Zoe K.', stars: 2, text: 'Wanted to love it. Latte was lukewarm and they spelled a three-letter name wrong.' },
    // Dana's second removal job (day 7)
    { author: 'linden_ave_local', stars: 1, text: 'Asked for oat milk, got a look, then regular milk. One star, and the star is for the chairs.', day: 7 },
  ],
  ironyard: [
    { author: 'liftbro', stars: 3, text: 'New place, half the machines still in boxes. Good platforms though. Potential.' },
    { author: 'Steph M.', stars: 4, text: 'Clean, never crowded (yet), owner actually spots you. First week free got me in.' },
    { author: 'kettlebell_karen', stars: 2, text: 'Showers not working opening week and the AC was off. Hope they fix it before summer.' },
  ],
  spincycle: [
    { author: 'walked_there_again', stars: 2, text: 'Every machine busy. Again. The owner keeps posting a raw "status feed" nobody can read.' },
    { author: 'Nadia', stars: 3, text: 'Clean enough. There was a van idling out back at 2am last week. Weird, but the dryers work.' },
  ],
  generalai: [
    { author: 'former_employee', stars: 1, text: 'They paved paradise and put up a parking lot. Then automated the attendant.' },
  ],
};
