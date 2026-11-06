#!/usr/bin/env node
'use strict';
// Assembles the static site into dist/ (used by GitHub Pages and Cloudflare Pages: build command `npm run build:site`, output `dist`).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
const required = ['index.html', 'styles.css', 'config.js', 'cats.js', 'clean.js', 'packs.js', 'skyobjects.js', 'universe.js', 'observatory.js', 'sky.html', 'sky.css', 'sky-app.js', 'tree.html', 'tree.css', 'tree-app.js', 'tools.html', 'science.css', 'evolve.html', 'evolve.js', 'legal.css', 'legal.js', 'privacy.html', 'terms.html', 'overlay.html', 'overlay.css', 'admin.html', 'admin-puzzles.html', 'admin.css', 'phylo.html', 'phylo-data.js', 'solver.js', 'wikiclient.js', 'favicon.svg', 'og.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];
const optional = ['puzzles.json', 'pool.json', 'packs.json', 'CNAME', '_headers', '_redirects', 'ads.txt'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of required) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const f of optional) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'fonts'), path.join(out, 'fonts'), { recursive: true });
fs.cpSync(path.join(root, 'maps'), path.join(out, 'maps'), { recursive: true });
fs.cpSync(path.join(root, 'treedata'), path.join(out, 'treedata'), { recursive: true });   // Scorcher Tree's built dataset (tools/build-tree.js)
fs.cpSync(path.join(root, 'stars'), path.join(out, 'stars'), { recursive: true });   // the real star catalogue (tools/build-stars.js)   // planet surface maps (maps/CREDITS.md)
if (fs.existsSync(path.join(root, 'og'))) fs.cpSync(path.join(root, 'og'), path.join(out, 'og'), { recursive: true });   // per-object link previews (tools/make-og.js)
// Scorcher Build concept pages at /build/ and /build/console (tools/build-pages.js)
{ const BP = require('./build-pages'), dir = path.join(out, 'build'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), BP.indexHtml()); fs.writeFileSync(path.join(dir, 'console.html'), BP.consoleHtml()); fs.writeFileSync(path.join(dir, 'paper.html'), BP.paperHtml()); fs.writeFileSync(path.join(dir, 'concept.html'), BP.conceptHtml());
  for (const a of BP.ASSETS) { fs.mkdirSync(path.dirname(path.join(dir, a)), { recursive: true }); fs.copyFileSync(path.join(BP.SRC, a), path.join(dir, a)); } }
fs.writeFileSync(path.join(out, '.nojekyll'), '');
// a stamp so you can check what is live: open /build.txt on the site (also shown in Settings)
let commit = 'unknown'; try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
fs.writeFileSync(path.join(out, 'build.txt'), JSON.stringify({ commit, builtAt: new Date().toISOString() }));
console.log('dist/ ready:', fs.readdirSync(out).length, 'entries');
