#!/usr/bin/env node
'use strict';
// Builds large article pools from Wikipedia's Vital Articles lists:
//   pool.json        ~10,000 articles (level 4), grouped by topic  -> random practice mode
//   daily-pool.json  ~1,000 articles (level 3), grouped by section -> default pool for daily puzzles
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('linkedom');
const g = require('./wikigraph');

const L4 = ['People', 'History', 'Geography', 'Arts', 'Philosophy and religion', 'Everyday life', 'Society and social sciences', 'Biological and health sciences', 'Physical sciences', 'Technology', 'Mathematics'];

// First article link of every list item, grouped by `groupOf(heading)`.
function extract(html, fixedCategory) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('.mw-parser-output') || doc.body, out = {};
  let cat = fixedCategory || 'Misc';
  for (const el of Array.from(root.querySelectorAll('h2,h3,li'))) {
    if (el.tagName === 'LI') {
      const a = el.querySelector('a[href^="/wiki/"]'); if (!a) continue;
      let t; try { t = decodeURIComponent(a.getAttribute('href').slice(6).split('#')[0]).replace(/_/g, ' '); } catch { continue; }
      if (!t || /^[A-Za-z ]{2,20}:/.test(t) || /^List of /.test(t)) continue;
      (out[cat] || (out[cat] = [])).push(t);
    } else if (!fixedCategory && el.tagName === 'H2') cat = el.textContent.replace(/\[.*?\]|\(.*?\)/g, '').trim() || cat;
  }
  for (const k of Object.keys(out)) { out[k] = [...new Set(out[k])]; if (out[k].length < 5) delete out[k]; }
  return out;
}

async function fetchList(page, fixedCategory) {
  const j = await g.api({ action: 'parse', page, prop: 'text', disableeditsection: '1', disablelimitreport: '1', disabletoc: '1' });
  return extract(j.parse.text, fixedCategory);
}
const total = o => Object.values(o).reduce((n, a) => n + a.length, 0);

async function main() {
  const root = path.join(__dirname, '..');
  try {
    const d = await fetchList('Wikipedia:Vital articles/Level/3');
    fs.writeFileSync(path.join(root, 'daily-pool.json'), JSON.stringify(d)); console.log('daily-pool.json', total(d), 'articles in', Object.keys(d).length, 'groups');
  } catch (e) { console.warn('level 3 failed:', e.message); }
  const all = {};
  for (const sub of L4) {
    try { const d = await fetchList(`Wikipedia:Vital articles/Level/4/${sub}`, sub); all[sub] = Object.values(d).flat(); console.log(' ', sub, all[sub].length); }
    catch (e) { console.warn(' ', sub, 'failed:', e.message); }
  }
  if (total(all)) { fs.writeFileSync(path.join(root, 'pool.json'), JSON.stringify(all)); console.log('pool.json', total(all), 'articles'); }
}
module.exports = { extract };
if (require.main === module) main();
