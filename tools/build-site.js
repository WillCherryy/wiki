#!/usr/bin/env node
'use strict';
// Assembles the static site into dist/ (used by GitHub Pages and Cloudflare Pages: build command `npm run build:site`, output `dist`).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
const required = ['index.html', 'styles.css', 'config.js', 'cats.js', 'clean.js', 'packs.js', 'skyobjects.js', 'observatory.js', 'legal.css', 'legal.js', 'privacy.html', 'terms.html', 'overlay.html', 'overlay.css', 'admin.html', 'admin-puzzles.html', 'admin.css', 'phylo.html', 'phylo-data.js', 'solver.js', 'wikiclient.js', 'favicon.svg', 'og.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];
const optional = ['puzzles.json', 'pool.json', 'packs.json', 'CNAME', '_headers', '_redirects', 'ads.txt'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of required) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const f of optional) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'fonts'), path.join(out, 'fonts'), { recursive: true });
if (fs.existsSync(path.join(root, 'og'))) fs.cpSync(path.join(root, 'og'), path.join(out, 'og'), { recursive: true });   // per-object link previews (tools/make-og.js)
fs.writeFileSync(path.join(out, '.nojekyll'), '');
// a stamp so you can check what is live: open /build.txt on the site (also shown in Settings)
let commit = 'unknown'; try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
fs.writeFileSync(path.join(out, 'build.txt'), JSON.stringify({ commit, builtAt: new Date().toISOString() }));
console.log('dist/ ready:', fs.readdirSync(out).length, 'entries');
