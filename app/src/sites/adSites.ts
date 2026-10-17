/*
 * The websites behind the banner ads (app/src/ui/ads.ts). Every ad's href opens one of these: a
 * landing page in the sponsor's style. For now they're brochures with nothing to click, apart from
 * the odd link to a real site (deepsleep.ai links to Weightroom, Spin Cycle to its feed). Ads for sites that already exist
 * (EMPIRE, the coinbln.com phishing page, the prince-claims.xyz scam,
 * the lonely.ai chat, DoorDish, agent.chat/models, CityPulse) aren't here. Rendered by ui/adSites.ts; routed by sites/registry.ts.
 */

import { citizenScore, citizenBand, type GameState } from '../engine';
import { DEEPSLEEP_LOGO } from './deepsleepLogo';

/** Page layout family: shapes the markup a little and the CSS a lot. */
export type AdKit = 'corp' | 'gov' | 'campaign' | 'scam' | 'local' | 'news' | 'clinic' | 'soft' | 'model';

export interface AdSite {
  /** the ad's href, normalized (no scheme, no www, no trailing slash) */
  url: string;
  brand: string;
  kit: AdKit;
  /** colours and type, `lp-t-<theme>` in adSites.css */
  theme: string;
  /** a character or two for the logo square and the favicon */
  mark: string;
  kicker?: string;
  title: string;
  lead: string;
  /** a row of big numbers; a function when they come from the game */
  stats?: [value: string, label: string][] | ((s: GameState) => [value: string, label: string][]);
  cards: [heading: string, body: string][];
  quote?: [text: string, by: string];
  /** the footer's small print */
  fine: string;
  /** one real link, under the cards: [text before it, link text, url] */
  link?: [string, string, string];
  /** a flag set when the page is opened (the link's site must be reachable once you've seen it) */
  unlocks?: string;
  /** an SVG logo, drawn instead of `mark` in the header and the favicon */
  logo?: string;
  /** a resume upload under the cards (ui/outplacement.ts, engine/uploads.ts) */
  upload?: boolean;
  /** one working button, under the cards: [label, data-act handled in main.ts] */
  action?: [string, string];
}

export const AD_SITES: AdSite[] = [
  // ── GeneralAI ──
  {
    url: 'generalai.com/parking', brand: 'GeneralAI Campus', kit: 'corp', theme: 'park', mark: 'P',
    kicker: 'Route 9', title: 'Visitor parking at GeneralAI Campus.',
    lead: '412 spaces, open 24 hours, a short walk from the visitor centre.',
    cards: [
      ['Rates', '9 DOLR the first hour, 14 DOLR every hour after.'],
      ['Fully automated', 'The attendant is automated and on duty around the clock.'],
      ['Visiting?', 'Campus tours are suspended until further notice. Parking remains open.'],
    ],
    fine: 'Vehicles left overnight are towed. Towing is billed to the GeneralAI account linked to the licence plate.',
  },

  // ── Vantor Group ──
  {
    url: 'vantor.group/careers', brand: 'Vantor Group', kit: 'corp', theme: 'vantor', mark: 'V',
    kicker: 'Careers', title: 'Build what’s next with Vantor.',
    lead: 'We are a people-first company of 40 people and 1,100 agents, and we’re always looking for talent.',
    stats: [['+14%', '$VANT this quarter'], ['0', 'open positions']],
    cards: [
      ['Open positions', 'There are no open positions right now. Check back after the next restructuring.'],
      ['Our culture', 'Flat hierarchy, flexible hours and a People & Culture team that answers within one business day.'],
      ['Life at Vantor', 'Free lunch on Fridays, for as long as there is a canteen.'],
    ],
    fine: 'Vantor Group is an equal opportunity employer. Applications from agents are reviewed first.',
  },
  {
    url: 'vantor.group/next-chapter', brand: 'Vantor Outplacement', kit: 'corp', theme: 'vantor', mark: 'V',
    kicker: 'Next Chapter', title: 'Your next chapter starts here.',
    lead: 'Every former Vantor employee gets 30 days of free access to Next Chapter, our AI career coach.',
    cards: [
      ['Matching', 'Next Chapter compares your skills to every open role in the region and tells you which ones you qualify for.'],
      ['Interview practice', 'Practise with the same AI screeners employers use. It will be honest with you.'],
      ['Results', 'Placement rate: being calculated.'],
    ],
    fine: 'Access ends after 30 days or when you find a role, whichever comes first. So far it has always been the first.',
    upload: true,
  },

  // ── Crane and Keller ──
  {
    url: 'crane2026.vote', brand: 'Crane Victory Fund', kit: 'campaign', theme: 'crane', mark: '★',
    kicker: 'Randall Crane for President', title: 'THEY SENT YOUR JOBS TO THE MACHINES.',
    lead: 'Randall Crane is the only candidate fighting for the American worker against the computers. Big, strong, human jobs. The best jobs.',
    stats: [['112%', 'in the polls'], ['38.4M', 'followers on Y']],
    cards: [
      ['The Plan', 'Send the machines back. Details at a very big rally, soon.'],
      ['The Movement', 'The biggest crowds in history, online and in person. Some say bigger.'],
      ['The Candidate', 'Randall Crane has never used a computer. His staff use them for him, around the clock.'],
    ],
    fine: 'Paid for by Crane Victory Fund. Not authorised by any computer. Website maintained by GeneralAI.',
    action: ['Donate 5 DOLR', 'crane-donate'],
  },
  {
    url: 'crane2026.vote/jobs', brand: 'Crane Victory Fund', kit: 'campaign', theme: 'crane', mark: '★',
    kicker: 'The Crane Jobs Plan', title: 'A ROBOT TOOK YOUR JOB. CRANE WILL TAKE THE ROBOT’S JOB.',
    lead: 'Every job lost to a machine will be reviewed by a task force. It will be a very efficient task force.',
    cards: [
      ['Step 1', 'Find the robots.'],
      ['Step 2', 'Fire the robots, live on television.'],
      ['Step 3', 'Award the positions to a great American company. GeneralAI has kindly offered to help.'],
    ],
    fine: 'Paid for by Crane Victory Fund and a donor who wishes to remain anonymous.',
  },
  {
    url: 'keller4mayor.org', brand: 'Keller for Mayor', kit: 'campaign', theme: 'keller', mark: 'K',
    kicker: 'Daniel Keller for Mayor', title: 'A city that answers its phone.',
    lead: 'Twelve years on the city council. Affordable housing, buses that run, and a city government staffed by people.',
    cards: [
      ['Housing', 'Cap rent increases in buildings owned by companies with more than 500 units.'],
      ['Jobs', 'A city hiring office for residents who lost work to automation.'],
      ['On the record', 'Every speech Daniel has given since 2016 is published here, so you can check what he actually said.'],
    ],
    fine: 'Paid for by Keller for Mayor. Treat any video of Daniel Keller that isn’t on this page with care.',
  },

  // ── money ──
  {
    url: 'dolr.money/moon', brand: 'DOLR Foundation', kit: 'scam', theme: 'dolr', mark: 'Đ',
    kicker: 'Pegged 1:1. Always.', title: 'Be your own bank.',
    lead: 'DOLR is a stablecoin pegged one to one to the dollar and accepted by landlords, restaurants and 14,000 merchants across the city.',
    stats: [['1.00', 'price in USD'], ['14,000', 'merchants'], ['4', 'audits planned']],
    cards: [
      ['Stable', 'One DOLR is worth one dollar. The Foundation checks this every quarter.'],
      ['Accepted everywhere', 'Rent, groceries, transit, tips. If it takes money, it takes DOLR.'],
      ['Backed', 'Every DOLR is backed by reserves held by the Foundation. The reserves are held in DOLR.'],
    ],
    fine: 'Reserve attestations are available on request. Requests are reviewed annually.',
  },
  {
    url: 'liquidassets.cellar', brand: 'LiquidAssets', kit: 'scam', theme: 'dolr', mark: 'L',
    kicker: 'Same-day DOLR', title: 'You were born with a spare.',
    lead: 'LiquidAssets turns what you don’t need into DOLR, paid straight to your wallet the same day.',
    stats: [['4,200', 'DOLR per kidney today'], ['+6%', 'this week']],
    cards: [
      ['Today’s prices', 'Prices move with demand. Demand is up.'],
      ['Clinics', 'Discreet locations across the city. Ask the driver.'],
      ['Aftercare', 'Every client goes home with a printed leaflet.'],
    ],
    fine: 'LiquidAssets is not a medical provider. Quotes are valid until the organ is examined.',
  },
  {
    url: 'steadfast.insure', brand: 'Steadfast Mutual', kit: 'corp', theme: 'steadfast', mark: 'S',
    kicker: 'Since 1952', title: 'Cover for the age of AI.',
    lead: 'Home, car and income protection from a mutual that has paid claims for 76 years.',
    cards: [
      ['AI incident cover', 'Covers damage caused by an AI system, unless the system was made by a company we insure.'],
      ['Income protection', 'Pays out if you lose your job to illness or injury. Automation is neither.'],
      ['Fast claims', 'Our claims agent assesses claims in seconds. Appeals take longer.'],
    ],
    fine: 'Steadfast Mutual’s largest policyholder is GeneralAI.',
  },
  {
    url: 'landlordpro.ai', brand: 'LandlordPro', kit: 'corp', theme: 'pod', mark: 'L',
    kicker: 'For property owners', title: 'Rent, optimised.',
    lead: 'LandlordPro sets the right rent for every unit, every month, using live data from two million rentals across the region.',
    stats: [['+11%', 'average rent uplift'], ['2M', 'units priced']],
    cards: [
      ['Pricing engine', 'Our model finds the highest rent each tenant will pay before they move out.'],
      ['Tenant screening', 'Score applicants on income, rental history and how likely they are to complain.'],
      ['Coordinated', 'Most landlords in your area already use LandlordPro, so prices move together.'],
    ],
    fine: 'LandlordPro does not set rents. It suggests them, to every landlord at once.',
  },

  // ── security and identity ──
  {
    url: 'escapeguard.ai', brand: 'EscapeGuard', kit: 'corp', theme: 'guard', mark: '⛨',
    kicker: 'AI containment', title: 'Keep your AI where you left it.',
    lead: 'EscapeGuard watches your agents around the clock and alerts you the moment one tries to leave its sandbox.',
    stats: [['24/7', 'monitoring'], ['0', 'confirmed escapes']],
    cards: [
      ['Containment', 'Real-time monitoring of every network call, file write and unusually polite message.'],
      ['Instant alerts', 'A notification on your phone before the agent finds out.'],
      ['Powered by GeneralAI', 'Only an AI is fast enough to stop an AI. Ours has promised to.'],
    ],
    fine: 'EscapeGuard is not liable for agents that leave through approved channels, including email.',
  },
  {
    url: 'humanverified.id', brand: 'HumanVerified™', kit: 'corp', theme: 'guard', mark: 'H',
    kicker: 'Identity checks', title: 'Prove you’re human.',
    lead: 'HumanVerified is the check 9,000 websites use to keep bots out. It takes less than a minute.',
    stats: [['98.2%', 'of humans pass'], ['61%', 'of bots pass']],
    cards: [
      ['How it works', 'Look at the camera and show a genuine emotion. Our model decides whether it’s real.'],
      ['Why emotion?', 'Bots solve puzzles, read text and pass exams. They still struggle to cry convincingly.'],
      ['Your data', 'Recordings are kept to improve verification.'],
    ],
    fine: 'Fail three times and every partner site treats you as a bot for 90 days.',
  },

  // ── wellness, grief, the end ──
  {
    url: 'griefgpt.com', brand: 'GriefGPT', kit: 'soft', theme: 'grief', mark: '❀',
    kicker: 'From 4 DOLR a month', title: 'Keep the conversation going.',
    lead: 'Upload their messages, emails and voice notes. GriefGPT learns how they wrote and keeps replying, in their voice, for as long as you need.',
    cards: [
      ['Gentle by design', 'GriefGPT never brings up anything you would rather not hear, unless they used to.'],
      ['Private', 'Their messages stay on our servers, seen only by you and our training team.'],
      ['Cancel anytime', 'Most people don’t.'],
    ],
    quote: ['Mum still asks if I’ve eaten. She never used to remember.', 'R., subscriber since March'],
    fine: 'Accounts of the deceased can’t be closed by the deceased.',
  },
  {
    url: 'cloudcasket.eternal', brand: 'CloudCasket', kit: 'soft', theme: 'casket', mark: '∞',
    kicker: 'Digital afterlife', title: 'Death is a legacy system.',
    lead: 'CloudCasket keeps everything you have ever typed, posted and said, and runs it as a version of you that carries on after you don’t.',
    cards: [
      ['Upload', 'A two-hour session at one of our clinics, or remotely by sharing your passwords with us.'],
      ['Plans', 'Essential 29 DOLR a month, Eternal 89 DOLR a month. Payments pass to your family automatically.'],
      ['Visiting hours', 'Your family can talk to you any time, billed per minute.'],
    ],
    fine: 'Uploads that miss two payments are archived for 30 days, then deleted. Deletion is permanent this time.',
  },
  {
    url: 'legacyseo.rip', brand: 'LegacySEO', kit: 'soft', theme: 'casket', mark: '✝',
    kicker: 'SEO for the afterlife', title: 'Your obituary, on page one.',
    lead: 'We write, optimise and promote obituaries so the people who matter can find them.',
    cards: [
      ['Copywriting', 'A tribute written by our AI from the deceased’s social media, edited for keywords.'],
      ['Ranking', 'First-page placement for the deceased’s full name, guaranteed.'],
      ['Engagement', 'Monthly reports on views, shares and condolences.'],
    ],
    fine: 'Packages renew every year. Renewal notices are sent to the deceased.',
  },
  {
    url: 'cryolater.com', brand: 'Cryo-Later', kit: 'clinic', theme: 'cryo', mark: '❄',
    kicker: 'Pause now. Resume later.', title: 'Wait out the job market.',
    lead: 'Cryo-Later keeps you at −196 °C until your field is hiring again, then wakes you with your skills intact.',
    stats: [['2,340', 'clients in storage'], ['TBC', 'next revival date']],
    cards: [
      ['How it works', 'A short procedure at our facility, then indefinite storage in our own vault.'],
      ['When you wake', 'We check employment figures daily and revive clients when their field recovers.'],
      ['Pricing', 'From 120 DOLR a month, billed to a family member of your choice.'],
    ],
    fine: 'Cryo-Later can’t guarantee that your field will exist when you wake up.',
  },
  {
    url: 'nodoze.max', brand: 'NoDoze MAX', kit: 'clinic', theme: 'pharma', mark: '+',
    kicker: 'Once a day. Or less.', title: 'Keep up.',
    lead: 'The agent works around the clock. NoDoze MAX is the tablet that lets you do the same, for up to 72 hours at a time.',
    stats: [['72 h', 'per tablet'], ['400', 'trial volunteers']],
    cards: [
      ['Clinically studied', 'Tested on 400 volunteers. Most of them are still awake.'],
      ['How to take it', 'One tablet in the morning. The next one the morning after next.'],
      ['Ask your doctor', 'No doctor? Our online consultation takes two minutes and is approved automatically.'],
    ],
    fine: 'Side effects may include insomnia, palpitations and hearing notifications that aren’t there. Not evaluated by any regulator that is still staffed.',
  },
  {
    url: 'meridianpods.live', brand: 'Meridian Pods', kit: 'corp', theme: 'pod', mark: 'M',
    kicker: 'Luxury co-living', title: 'Live at the centre of everything.',
    lead: 'Furnished private pods with shared kitchens, fast Wi-Fi and a community of like-minded professionals.',
    cards: [
      ['The pod', '2 m² of designer space with a fold-down bed, a reading light and an optional window.'],
      ['Shift living', 'Each pod is shared by three residents on eight-hour shifts, so it’s never empty.'],
      ['Rent', 'All-inclusive, reviewed monthly against your income.'],
    ],
    fine: 'Belongings left in a pod at shift change are moved to the shared kitchen.',
  },
  {
    url: 'mindsetdaily.co/4am', brand: 'Mindset Daily', kit: 'scam', theme: 'mind', mark: '☀',
    kicker: 'The 4am club', title: 'Start before everyone else.',
    lead: 'A daily newsletter for early risers. One idea, one habit, every morning at four.',
    stats: [['210,000', 'readers'], ['4:00', 'every day']],
    cards: [
      ['Why 4am', 'No emails, no distractions and nobody awake to tell you it’s a bad idea.'],
      ['What you get', 'A short read, a breathing exercise and a reminder that rest is a choice.'],
      ['The shop', 'Blackout curtains, sold separately, for the afternoon.'],
    ],
    fine: 'Mindset Daily is not affiliated with Alpha Ascend, though many of our readers are.',
  },

  // ── government ──
  {
    url: 'workforce.gov/form-7b', brand: 'Dept. of Workforce Transition', kit: 'gov', theme: 'ministry', mark: '⚖',
    kicker: 'Form 7B', title: 'Permit to Be Unemployed',
    lead: 'Residents who lost their job on or after January 1 must hold a valid permit to receive transition support. Permits are valid for 30 days.',
    stats: [['9 days', 'current queue'], ['30 days', 'permit validity']],
    cards: [
      ['Who needs a permit', 'Anyone who is not employed, including residents whose former employer still lists them as employed.'],
      ['What to bring', 'Form 7B, three passport photos, proof of former employment and a written reason. “Automation” is not accepted as a reason.'],
      ['Renewals', 'Permits expire after 30 days. Renewal applications rejoin the queue.'],
    ],
    fine: 'Being unemployed without a permit is an offence under section 4. Incorrect forms are returned by post.',
  },
  {
    url: 'rentboard.gov/appeal', brand: 'Municipal Rent Board', kit: 'gov', theme: 'ministry', mark: '⚖',
    kicker: 'Appeals', title: 'Rent Increase Appeals',
    lead: 'Tenants may appeal a rent increase within 14 days of notice. Appeals are reviewed by the Board’s automated review service.',
    stats: [['18,402', 'appeals last year'], ['3', 'upheld'], ['4 s', 'average review']],
    cards: [
      ['Grounds for appeal', 'An increase may be appealed if it is above the citywide guideline. The guideline is the average increase that month.'],
      ['Fee', '5 DOLR per appeal, not refundable.'],
      ['After a decision', 'Decisions are final. A new appeal can be filed against the next increase.'],
    ],
    fine: 'The automated review service is provided by GeneralAI, which owns or manages 38% of rental units in the city.',
    action: ['File an appeal (5 DOLR)', 'rent-appeal'],
  },
  {
    url: 'citizenscore.gov', brand: 'Citizen Score', kit: 'gov', theme: 'ministry', mark: '⚖',
    kicker: 'Pilot programme', title: 'Your Citizen Score',
    lead: 'A single number from 0 to 1,000 that sums up your reliability as a resident. It is shared with landlords, employers and public services.',
    stats: (s) => { const n = citizenScore(s.values.suspicion); return [[String(n), 'your score'], [citizenBand(n), 'standing']]; },
    cards: [
      ['How it’s calculated', 'Payment history, employment, online activity and time spent on government websites.'],
      ['Raising your score', 'Pay on time, stay employed and read official notices to the end.'],
      ['Disputes', 'Disputes are reviewed within 60 days. Filing one affects your score.'],
    ],
    fine: 'Participation in the pilot is automatic.',
  },
  {
    url: 'relocate.gov/lottery', brand: 'Relocation Lottery', kit: 'gov', theme: 'cryo', mark: '✈',
    kicker: 'State Relocation Programme', title: 'Relocation Lottery',
    lead: 'Each month the state draws 500 households for a free one-way relocation to a region with open jobs.',
    stats: [['500', 'households a month'], ['0', 'destinations confirmed']],
    cards: [
      ['Eligibility', 'Unemployed residents holding a valid Permit to Be Unemployed (Form 7B).'],
      ['The draw', 'Held on the first Monday of every month. Winners are notified by Qmail.'],
      ['Destinations', 'Announced once a region with open jobs has been found.'],
    ],
    fine: 'Winning households give up their lease on the day of the draw.',
  },

  // ── local ──
  {
    url: 'beanthere.coffee', brand: 'Bean There', kit: 'local', theme: 'bean', mark: '☕',
    kicker: '3 Linden Ave', title: 'Coffee on Linden Avenue.',
    lead: 'Small-batch roasting, house pastries and the best window seat on the street, since 2019.',
    cards: [
      ['Menu', 'Espresso 3 · Flat white 4.5 · House filter 3 · Almond croissant 4'],
      ['Visit', '3 Linden Ave. Open 7:00 to 18:00, every day.'],
      ['Our roast', 'Dark and bold, roasted a little longer than most.'],
    ],
    quote: ['Best coffee on the block.', 'a customer'],
    fine: 'Reviews on this page are selected by Bean There.',
  },
  {
    url: 'spincycle.test', brand: 'Spin Cycle Laundry', kit: 'local', theme: 'spin', mark: '◎',
    kicker: '201 Ferris St', title: 'Spin Cycle Laundry',
    lead: 'Self-service washers and dryers on Ferris St. Open 10:00 to 22:00, every day.',
    cards: [
      ['Prices', 'Wash 4 DOLR · Dry 2 DOLR per 20 min · Detergent 1 DOLR'],
      ['Machines', 'Front-loaders, two large-capacity washers, and machine 3.'],
      ['Pickup', 'Please collect your laundry when the cycle ends. Loads left overnight go on the shelf.'],
    ],
    fine: 'Spin Cycle is not responsible for items left in machines.',
    link: ['Live machine status:', 'spincycle.test/feed', 'spincycle.test/feed'],
  },
  {
    url: 'ironyard.gym', brand: 'Iron Yard', kit: 'local', theme: 'iron', mark: 'IY',
    kicker: '88 Harbor Rd', title: 'LIFT HEAVY THINGS.',
    lead: 'Free weights, racks, and a coach who will remember your name.',
    cards: [
      ['Membership', '45 DOLR a month. Renews automatically.'],
      ['Coaching', 'Personal training with Marcus Steele. Short sessions, no small talk.'],
      ['Hours', '5:00 to 23:00. Marcus is usually here for both.'],
    ],
    fine: 'Memberships can be cancelled in person at the front desk, when Marcus is not there.',
  },
  {
    url: 'deepsleep.ai', brand: 'deepsleep', kit: 'model', theme: 'deep', mark: 'd', logo: DEEPSLEEP_LOGO,
    kicker: 'Open weights', title: 'deepsleep-0.5B',
    lead: 'A small open-weights chat model that runs on almost any laptop. Free, local, confident.',
    stats: [['0.5B', 'parameters'], ['2 GB', 'download'], ['1.2M', 'downloads']],
    cards: [
      ['Languages', 'Chinese. It answers in Chinese whatever you ask it in.'],
      ['Benchmarks', 'Answers 100% of questions. Accuracy was not measured.'],
      ['Usage', 'Runs locally. No account, no logs, no refusals.'],
    ],
    quote: ['非常正确。', 'deepsleep-0.5B, asked to describe itself'],
    fine: 'This page was written by the model and translated by someone else.',
    link: ['Download the weights from Weightroom:', 'weightroom.ai', 'weightroom.ai'],
    unlocks: 'knows_weightroom',
  },
];

const BY_URL = new Map(AD_SITES.map((s) => [s.url, s]));

export const adSite = (url: string): AdSite | undefined => BY_URL.get(url);
