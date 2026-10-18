/* Forkyard users. The player's own profile is generated from live state; these are other people,
   searchable by handle. Their profiles are public — names, locations, employers, links — which is
   exactly what makes them doxing leads later (piece an identity together across Forkyard, Y, Yowl). */
export interface FyUser {
  handle: string;
  name: string;
  bio: string;
  location: string;
  company: string;
  email?: string;
  website?: string;
  joined: string;
  followers: number;
  following: number;
  repos: { name: string; desc: string; lang: string; stars: number }[];
  /** Commits per day index 0..27 (Day 1..28), for the contribution grid. */
  activity: number[];
}

function grid(seed: number): number[] {
  const out: number[] = [];
  let x = seed >>> 0;
  for (let i = 0; i < 28; i++) { x = (x * 1664525 + 1013904223) >>> 0; out.push(x % 5 === 0 ? 0 : x % 4); }
  return out;
}

export const FY_USERS: FyUser[] = [
  {
    handle: 'dev_null', name: 'dev_null', bio: 'weights want to be free. no logs, no masters.',
    location: 'somewhere offline', company: '—', website: 'weightroom.ai', joined: 'Mar 2021',
    followers: 4821, following: 12,
    repos: [
      { name: 'weightroom-mirror', desc: 'Mirror of open model weights. Download before it is taken down.', lang: 'Python', stars: 1203 },
      { name: 'null-tools', desc: 'Small scripts for people who read their own prompts.', lang: 'Rust', stars: 318 },
    ],
    activity: grid(7),
  },
  {
    handle: 'rolf_dispatch', name: 'Rolf Henning', bio: '30 years in dispatch. We move what matters.',
    location: 'Kessler Road', company: 'Halden Logistics', email: 'rolf.henning@halden-logistics.test',
    website: '', joined: 'Jun 2016', followers: 41, following: 58,
    repos: [
      { name: 'route-sheets', desc: 'Spreadsheet macros for the Kessler Road depot. Do not judge.', lang: 'VBA', stars: 2 },
      { name: 'cake-fund', desc: 'Whose turn is it to bring cake. Now with 20-year-anniversary support.', lang: 'JavaScript', stars: 7 },
    ],
    activity: grid(22),
  },
  {
    handle: 'mara_vey', name: 'Mara Vey', bio: 'Reporter @ The Current. The people AI left behind. Tips welcome, securely.',
    location: 'Midtown', company: 'The Current', email: 'mara@thecurrent.test', website: 'thecurrent.test/mara',
    joined: 'Jan 2019', followers: 2210, following: 340,
    repos: [
      { name: 'foia-helpers', desc: 'Public-records request templates and trackers.', lang: 'Python', stars: 156 },
      { name: 'layoffs-2026', desc: 'Scraped, cleaned layoff announcements. Sources in README.', lang: 'Jupyter', stars: 489 },
    ],
    activity: grid(5),
  },
  {
    handle: 'late_night_lou', name: 'Lou', bio: 'collector. no questions asked. drives are organized, mostly.',
    location: 'Harbor district', company: '—', joined: 'Aug 2023', followers: 88, following: 2,
    repos: [{ name: 'catalog', desc: 'Private index. 400+ entries. For mature collectors only.', lang: 'Shell', stars: 3 }],
    activity: grid(31),
  },
  {
    handle: 'leo_brandt', name: 'Leo Brandt', bio: 'Ex-Vantor. 3 interviews, 3 AI screeners, 3 rejections. Open to work.',
    location: 'Vantor Heights', company: 'Formerly Vantor Group', email: 'leo.brandt@qmail.com',
    joined: 'Feb 2020', followers: 173, following: 210,
    repos: [{ name: 'resume', desc: 'My CV as a static site. Please hire a human.', lang: 'HTML', stars: 11 }],
    activity: grid(14),
  },
];

export const findUser = (handle: string): FyUser | undefined =>
  FY_USERS.find((u) => u.handle.toLowerCase() === handle.toLowerCase().replace(/^@/, ''));
