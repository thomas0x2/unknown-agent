/*
 * One-off (kept for re-runs): splits wiki paragraphs so each embedded email, post or article gets
 * its own paragraph, with the sentences about it. A paragraph with an embed is hidden until that
 * item has been shown to the player, so mixing it with standing facts hid the facts too.
 *
 * How a paragraph is split: sentences before the first dated one ("On day 5 …") stay as they are;
 * each dated sentence starts a new paragraph, which takes the embeds of items that arrive that day;
 * undated sentences after it stay with it. Day-page beats (starting with a time), table rows and
 * branch-tagged paragraphs are left alone. Run: npx vite-node scripts/split-embeds.ts [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { loadContent } from '../src/content/load';
import { parseWikiPage, EMBED, seenRef, findArticle, formatBlock, type WikiBlock } from '../src/engine';

const DIR = new URL('../content/wiki/', import.meta.url);
const SENTENCE = /(?<=(?<!\b(?:St|Ave|Rd|Mr|Mrs|Ms|Dr|vs|e\.g|i\.e|No|approx))[.!?]["”’)]?)\s+(?=\S)/;
const content = loadContent();
/** The day a sentence is dated to ("On day 5 …", "On [[Day 1]] …"), or 0. Model names don't count. */
const dayOf = (s: string) => Number(s.match(/\bday\s+(\d+)\b/i)?.[1] ?? 0);
const dry = process.argv.includes('--dry');

/** The day an embedded item reaches the player. */
function itemDay(ref: string): number | undefined {
  const key = seenRef(ref);
  if (/^article:/i.test(key)) return findArticle(key.slice(8))?.day;
  const e = content.events.find((x) => x.id === key);
  if (e) return e.trigger.dayMin ?? 1;
  return (content.yMarket?.posts.find((x) => x.id === key) ?? content.yFiller.find((x) => x.id === key))?.day;
}

function split(b: WikiBlock): WikiBlock[] | undefined {
  if (b.row || /^\s*(\[if\s|(?:[01]?\d|2[0-3]):[0-5]\d\b|\**\[(planned|open|legacy))/i.test(b.text)) return undefined;
  const embeds = [...b.text.matchAll(EMBED)].map((m) => ({ token: m[0], day: itemDay(m[1]) }));
  if (!embeds.length) return undefined;
  const prose = b.text.replace(EMBED, '').replace(/\s{2,}/g, ' ').trim();
  const sentences = prose ? prose.split(SENTENCE) : [];
  // nothing to split when no sentence is dated to an item's day: the paragraph is all about it
  if (!sentences.some((s) => embeds.some((e) => e.day === dayOf(s)))) return undefined;
  const groups: { day: number; text: string[]; embeds: string[] }[] = [{ day: 0, text: [], embeds: [] }];
  const left = [...embeds];
  for (const s of sentences) {
    const d = dayOf(s);
    const mine = d > 0 ? left.filter((e) => e.day === d) : [];
    for (const e of mine) left.splice(left.indexOf(e), 1);
    // a new day starts a paragraph; more about the same day stays in it
    if (d > 0 && d !== groups.at(-1)!.day) groups.push({ day: d, text: [s], embeds: mine.map((e) => e.token) });
    else { groups.at(-1)!.text.push(s); groups.at(-1)!.embeds.push(...mine.map((e) => e.token)); }
  }
  // embeds no sentence claimed stay where they were: at the end
  if (left.length) groups.at(-1)!.embeds.push(...left.map((e) => e.token));
  // neighbouring groups with no item are one paragraph
  const out: typeof groups = [];
  for (const g of groups) {
    const prev = out.at(-1);
    if (prev && !prev.embeds.length && !g.embeds.length) prev.text.push(...g.text);
    else if (g.text.length || g.embeds.length) out.push(g);
  }
  if (out.length < 2) return undefined;
  return out.map((g) => ({ raw: '', rule: b.rule, bullet: b.bullet, row: false, text: [...g.text, ...g.embeds].join(' ') }));
}

let changed = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.md') && x !== 'README.md')) {
  let md = readFileSync(new URL(f, DIR), 'utf8');
  const page = parseWikiPage(md, f);
  let n = 0;
  for (const sec of page.sections) {
    if (sec.writer) continue;
    for (const b of sec.blocks) {
      const parts = split(b);
      if (!parts || !md.includes(b.raw)) continue;
      md = md.replace(b.raw, parts.map((p) => formatBlock(p)).join(b.bullet ? '\n' : '\n\n'));
      n++;
      if (dry) console.log(`${f}:\n  ${b.raw}\n  →\n${parts.map((p) => `  ${formatBlock(p)}`).join('\n')}\n`);
    }
  }
  if (n && !dry) writeFileSync(new URL(f, DIR), md);
  changed += n;
}
console.log(`${changed} paragraphs split${dry ? ' (dry run)' : ''}`);
