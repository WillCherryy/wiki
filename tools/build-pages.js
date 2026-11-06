'use strict';
// The Scorcher Build concept pages (mockups/suite/build.html and build-console.html), published at /build/ and /build/console.
// Both are marked noindex: they are concepts with synthetic data, labelled as such on the page. Shared by the dev server and the site build.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'mockups', 'suite');
const ASSETS = ['fonts/mona-sans-latin.woff2', 'fonts/geist-mono-latin.woff2', 'img/geothermal.jpg', 'img/reykjanes.jpg', 'img/solar-aerial.jpg', 'img/wind-akhisar.jpg', 'build-sample.js', 'gisbench-sample.js', 'earthbench-sample.js'];
const TYPES = { '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.js': 'application/javascript' };
// base: '/build' on the main site; '' on build.playscorcher.com, where the backend serves the pages and "Start a trial" opens the real sign-in
const page = (file, base = '/build') => {
  let h = fs.readFileSync(path.join(SRC, file), 'utf8').replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">')
    .replace(/href="build-console\.html"/g, `href="${base}/console"`).replace(/href="build\.html"/g, `href="${base}/"`);
  if (base === '') h = h.replace(/class="btn" href="#top">Start a trial/g, 'class="btn" href="/auth/signin">Start a trial').replace('<form class="start" onsubmit="return false"', '<form class="start" onsubmit="location.href=\'/auth/signin\';return false"');
  return h;
};
module.exports = { ASSETS, TYPES, indexHtml: (base) => page('build.html', base), consoleHtml: (base) => page('build-console.html', base), SRC };
