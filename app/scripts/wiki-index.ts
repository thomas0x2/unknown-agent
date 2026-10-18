/*
 * Prints every wiki page by category, as `[[Title]] (file): what it is`: the index, built from the
 * pages themselves. `npm run wiki:index`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseWikiPage, wikiIndexMarkdown } from '../src/engine/wiki';

const DIR = join(import.meta.dirname ?? __dirname, '../content/wiki');
const pages = readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => parseWikiPage(readFileSync(join(DIR, f), 'utf8'), f));
process.stdout.write(wikiIndexMarkdown(pages));
