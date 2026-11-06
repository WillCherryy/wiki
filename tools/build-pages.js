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
    .replace(/href="build-console\.html"/g, `href="${base}/console"`).replace(/href="build-paper\.html"/g, `href="${base}/paper"`).replace(/href="build\.html"/g, `href="${base}/"`);
  if (base === '') h = h.replace(/class="btn" href="#top">Start a trial/g, 'class="btn" href="/app">Start a trial').replace('<form class="start" onsubmit="return false"', '<form class="start" onsubmit="location.href=\'/app\';return false"');
  return h;
};
// The paper: citations numbered from the order of the reference list, and the validation register rendered from its latest run
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const register = () => {
  let v; try { v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'earthbench', 'results', 'validation.json'), 'utf8')); } catch { return '<p class="meta">Register not generated yet: run python -m earthbench.validation.</p>'; }
  const n = s => v.rows.filter(r => r.status === s).length, col = { verified: 'var(--blue)', 'design choice': 'var(--pos)', FAILED: 'var(--pos)' };
  let area = '', out = `<p class="meta">Generated ${esc(v.generated.slice(0, 10))}: ${v.rows.length} decisions; verified ${n('verified')}, source only ${n('source only')}, design choice ${n('design choice')}, not run ${n('not run')}, failed ${n('FAILED')}.</p><div class="tw"><table><tr><th>Decision</th><th>Basis</th><th>Status</th><th>What the check showed</th></tr>`;
  for (const r of v.rows) {
    if (r.area !== area) { area = r.area; out += `<tr><th colspan="4" style="background:var(--paper);color:var(--ink)">${esc(area)}</th></tr>`; }
    out += `<tr><td>${esc(r.decision)}</td><td>${esc(r.basis)}</td><td style="white-space:nowrap;color:${col[r.status] || 'var(--ink-2)'}">${esc(r.status)}</td><td>${esc(r.status === 'design choice' ? 'No published source: listed for expert review' : r.detail)}</td></tr>`;
  }
  return out + '</table></div>';
};
const paper = (base) => {
  let h = page('build-paper.html', base);
  const ids = [...h.matchAll(/<li id="(r-[a-z0-9-]+)"/g)].map(m => m[1]);
  h = h.replace(/href="#(r-[a-z0-9-]+)">\[\d+\]/g, (m, id) => `href="#${id}">[${ids.indexOf(id) + 1}]`);
  return h.replace('<!--REGISTER-->', register()).replace(/href="build-paper\.html"/g, `href="${base}/paper"`);
};
module.exports = { ASSETS, TYPES, indexHtml: (base) => page('build.html', base), consoleHtml: (base) => page('build-console.html', base), paperHtml: paper, SRC };
