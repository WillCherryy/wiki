'use strict';
// The Scorcher Build concept pages (mockups/suite/build.html and build-console.html), published at /build/ and /build/console.
// Both are marked noindex: they are concepts with synthetic data, labelled as such on the page. Shared by the dev server and the site build.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'mockups', 'suite');
const ASSETS = ['fonts/mona-sans-latin.woff2', 'fonts/geist-mono-latin.woff2', 'img/geothermal.jpg', 'img/reykjanes.jpg', 'img/solar-aerial.jpg', 'img/wind-akhisar.jpg', 'build-sample.js'];
const TYPES = { '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.js': 'application/javascript' };
const page = file => fs.readFileSync(path.join(SRC, file), 'utf8').replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">').replace(/href="build-console\.html"/g, 'href="/build/console"').replace(/href="build\.html"/g, 'href="/build/"');
module.exports = { ASSETS, TYPES, indexHtml: () => page('build.html'), consoleHtml: () => page('build-console.html'), SRC };
