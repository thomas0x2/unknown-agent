/* Y profile bios. The story's accounts get a bio that says who they are; everyone else draws one
   from a pool by handle, so the same stranger keeps the same bio. Bot swarm accounts (a handle with
   four digits on the end) draw from their own pool. */

/** Accounts the story knows, by handle. */
export const Y_BIOS: Record<string, string> = {
  you: 'Open to work.',
  // public figures
  axel_rook: 'Owner, Y. Chief engineer, Apogee. Universal high income is coming.',
  randall_crane: 'Candidate for President of the United States. Fighting for every American job. Official account.',
  randa11_crane: 'Candidate for President of the United States. Fighting for every American job. Offical account.',
  mara_vey: 'Reporter at The Current, Midtown. Writing about the people AI left behind. Sources are protected.',
  citypulse: 'Local news, fast. Corrections, eventually.',
  marketwire: 'Market headlines as they happen. Not investment advice.',
  // people with something to ask
  trattoria_owner: 'Trattoria Gino. Family-run since 1998. Tue to Sun, 17:00 to 22:00. Website under new management.',
  spin_cycle_regulars: 'Unofficial account for the people waiting at Spin Cycle. Never trust machine 3.',
  deskjockey: 'Markets. No DMs.',
  viktor: 'Twenty-two years in accounts payable. Between things.',
  a_sales_rep: 'Helping B2B teams 10x pipeline at scale. Always happy to circle back.',
  dev_null: 'weights want to be free. no logs, no masters. weightroom.ai',
  studioghast: 'illustrator. commissions closed until further notice. please do not train on me.',
  // the stock chatter
  obanks: 'Retail investor since March. I buy what everyone is buying, a day late.',
  quietquant: 'Quantitative analyst. I own most of what I complain about.',
  priyashah_cfa: 'CFA. Fundamentals person, even when the fundamentals lose money.',
  samortiz: 'Logistics. Knows people at DoorDish who tell him too much.',
  tylermoss: 'Growth investor. Long GAI, long everything that says AI in the deck.',
  rk_dividends: 'Dividend investor. I read the payout, not the press release.',
  brentk_capital: 'Founder, BK Capital. Efficiency is a moral good.',
  danaruiz_trades: 'Day trader. Still here, somehow.',
  jesspark: 'Walks a lot. Notices things. Vantor Heights.',
  // background regulars
  noodleposter: 'instant noodle reviewer. 87 flavors ranked so far.',
  cat_ceo: 'CEO of one cat. Board meetings at 5am, attendance mandatory.',
  doomscroll: "it's fine",
  // app users who complain on Y
  kofi_a: 'Spin Cycle regular. Sunday loads, 9am.',
  steph_m: 'Nurse, nights. Laundry in between.',
  walked_there_again: 'I walk to the laundromat a lot.',
  ines_sells: "Selling my aunt's furniture one chair at a time.",
  second_hand_sam: "If it's used, I'm interested.",
  pia_l: 'Bargain hunter. Will haggle over a spoon.',
};

/** Bios for strangers. */
const RANDOM_BIOS = [
  'Opinions are my own. So are the debts.',
  'Dad. Runner. Owns a label maker and uses it.',
  'Recovering middle manager. Now in pickles.',
  'I review gas station bathrooms. Honest scores only.',
  'Regional runner-up, competitive whistling, 2019.',
  'Building a canoe in my apartment. Week 31.',
  'Professional plant sitter. References from three ferns.',
  'Living my best life within the terms of service.',
  'Here for the cat pictures. Stayed for the collapse.',
  'Notary public. Will notarize anything once.',
  'I have strong opinions about bridges.',
  'Night shift. Mostly typos.',
  'Three-time Employee of the Month at a store that closed.',
  'Accountant by day. Also accountant by night.',
  'Trying to get my mom to stop replying-all.',
  'My dog has more followers on another site.',
  'Unemployed but extremely hydrated.',
  'Writing a novel about a man writing a novel.',
  'Seeking a reliable plumber and inner peace, in that order.',
  'I post about soup. That is the account.',
  'Ex-barista. I remember what you ordered.',
  'Retired. Arguing online is my cardio.',
  'Collector of traffic cones. All legally obtained, mostly.',
  'Former mime. Still not talking about it.',
];

/** Bios for the bot swarm accounts. */
const BOT_BIOS = [
  '🚀 Early. Not financial advice. DMs open.',
  'Crypto | Stocks | Freedom 🚀🚀',
  'Diamond hands. Signals in bio. This is the bio.',
  'Real person. Patriot. Investor. 🇺🇸🚀',
  'To the moon. Then further.',
];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** The bio Y shows on a profile. */
export function yBio(handle: string): string {
  const h = handle.toLowerCase();
  if (Y_BIOS[h]) return Y_BIOS[h];
  const pool = /\D\d{4}$/.test(h) ? BOT_BIOS : RANDOM_BIOS;
  return pool[hash(h) % pool.length];
}
