// Bundles each page and its local files into one self-contained HTML file in dist/:
//   index.html             → dist/unknown-agent.html  (the game)
//   tools/story-tree.html  → dist/story-tree.html     (author's story map)
// The output has no <html>/<head>/<body> wrapper so it can be published as a claude.ai artifact.
const fs = require('fs');
const path = require('path');
const root = __dirname;

function bundle(src, out) {
  const file = path.join(root, src);
  const dir = path.dirname(file);
  const html = fs.readFileSync(file, 'utf8');
  const between = (a, b) => html.split(a)[1].split(b)[0];
  const read = (p) => fs.readFileSync(path.resolve(dir, p), 'utf8');
  const head = between('<!--build:head-->', '<!--/build:head-->')
    .replace(/<link rel="stylesheet" href="((?:\.\.\/)?src\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`);
  const body = between('<!--build:body-->', '<!--/build:body-->')
    .replace(/<script src="((?:\.\.\/)?src\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p)}</script>`);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, out), head.trim() + '\n' + body.trim() + '\n');
  console.log(`wrote ${out}`);
}

bundle('index.html', 'dist/unknown-agent.html');
bundle('tools/story-tree.html', 'dist/story-tree.html');
