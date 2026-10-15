// Bundles index.html + src/* into one self-contained file: dist/unknown-agent.html
// The output has no <html>/<head>/<body> wrapper so it can be published as a claude.ai artifact.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const between = (a, b) => html.split(a)[1].split(b)[0];
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const head = between('<!--build:head-->', '<!--/build:head-->')
  .replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`);
const body = between('<!--build:body-->', '<!--/build:body-->')
  .replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p)}</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/unknown-agent.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('wrote dist/unknown-agent.html');
