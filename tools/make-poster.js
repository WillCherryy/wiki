#!/usr/bin/env node
'use strict';
// Daily Instagram poster for the day's link race (1080x1350, the 4:5 feed post; add --story for 1080x1920).
//   node tools/make-poster.js --today                      pulls today's pair (live API, then puzzles.json)
//   node tools/make-poster.js --from "Bradley Wiggins" --to "Tour de France" [--par 3] [--day 2026-10-24]
//   options: --theme dark   --tease (hides the destination as "?" for a teaser post)   --story   --out file.png
// --today needs WARMER_URL (your site) in the environment, the same one tools/stats.js uses.
const fs = require('fs'), os = require('os'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..'), font = f => 'file://' + path.join(root, 'fonts', f);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && !process.argv[i + 1]?.startsWith('--') ? process.argv[i + 1] : d; }, flag = n => process.argv.includes('--' + n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayNum = k => { const [y, m, d] = k.split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5) + 1; };
const level = p => p <= 2 ? 'Easy' : p === 3 ? 'Medium' : p === 4 ? 'Hard' : 'Expert';
const svg = f => fs.readFileSync(path.join(root, 'brand', f), 'utf8').replace(/ width="[\d.]+" height="[\d.]+"/, ' width="100%" height="100%"');
const vb = f => { const m = fs.readFileSync(path.join(root, 'brand', f), 'utf8').match(/viewBox="([\d. -]+)"/)[1].split(' ').map(Number); return m[2] / m[3]; };

async function pair(day) {
  if (arg('from') && (arg('to') || flag('tease'))) return { from: arg('from'), to: arg('to') || '?', par: +arg('par', 0) || null };
  const base = (process.env.WARMER_URL || '').replace(/\/$/, '');
  if (base) { try { const r = await fetch(`${base}/api/daily?day=${day}`); if (r.ok) { const j = await r.json(); if (j.from && j.to) return { from: j.from, to: j.to, par: j.par || null }; } } catch {} }
  try { const d = JSON.parse(fs.readFileSync(path.join(root, 'puzzles.json'), 'utf8')).days[day]; if (d) return { from: d.from, to: d.to, par: d.par || null }; } catch {}
  console.error(`Could not find the pair for ${day}. Set WARMER_URL, run git pull (for puzzles.json), or pass --from "..." --to "..."`); process.exit(1);
}
const size = (s, big) => { const n = s.length; return big * (n <= 12 ? 1 : n <= 18 ? .8 : n <= 26 ? .62 : .5); };

(async () => {
  const day = arg('day', new Date().toLocaleDateString('en-CA')), p = await pair(day), dark = arg('theme', 'light') === 'dark', story = flag('story'), tease = flag('tease');
  const W = 1080, H = story ? 1920 : 1350, T = dark ? { bg: '#16130f', ink: '#f3eee4', ink2: '#cfc7b8', mute: '#a1978a', acc: '#ff6a45', rule: '#3b342b', logo: 'logo-horizontal-on-dark.svg' } : { bg: '#f3eee4', ink: '#16130f', ink2: '#4b453b', mute: '#7a7265', acc: '#d63a1f', rule: '#cfc6b3', logo: 'logo-horizontal.svg' };
  const dots = [['#2a4f8a', 22], ['#5c8cbe', 28], ['#d6be8c', 36], ['#f08c50', 46], ['#d63a1f', 58]];
  const date = new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const html = `<style>@font-face{font-family:S;src:url(${font('eb-garamond-latin-400-normal.woff2')})}@font-face{font-family:S;font-style:italic;src:url(${font('eb-garamond-latin-400-italic.woff2')})}@font-face{font-family:U;font-weight:500;src:url(${font('instrument-sans-latin-500-normal.woff2')})}@font-face{font-family:U;font-weight:600;src:url(${font('instrument-sans-latin-600-normal.woff2')})}*{box-sizing:border-box;margin:0}body{margin:0}</style>
  <div style="width:${W}px;height:${H}px;background:${T.bg};color:${T.ink};position:relative;overflow:hidden;font-family:U">
   <div style="position:absolute;inset:34px;border:3px solid ${T.ink}"></div><div style="position:absolute;inset:48px;border:1.5px solid ${T.rule}"></div>
   <div style="position:absolute;left:96px;right:96px;top:98px;display:flex;justify-content:space-between;align-items:center"><div style="height:74px;width:${74 * vb(T.logo)}px">${svg(T.logo)}</div><div style="text-align:right;font:600 22px U;letter-spacing:.2em;text-transform:uppercase;color:${T.mute};line-height:1.7">Plate No. ${dayNum(day)}<br>${esc(date)}</div></div>
   <div style="position:absolute;left:96px;right:96px;top:208px;height:4px;background:${T.ink}"></div>
   <div style="position:absolute;left:96px;right:96px;top:236px;bottom:${story ? 150 : 104}px;display:flex;flex-direction:column;text-align:center">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
     <div style="font:600 22px U;letter-spacing:.24em;text-transform:uppercase;color:${T.mute};margin-bottom:22px">Start</div>
     <div style="font:400 ${size(p.from, 150)}px/.98 S;letter-spacing:-.02em">${esc(p.from)}</div>
     <div style="display:flex;align-items:center;justify-content:center;gap:26px;margin:${story ? 80 : 46}px 0">
       <div style="flex:1;border-top:4px dotted ${T.rule}"></div><div style="display:flex;align-items:flex-end;gap:14px">${dots.map(([c, d]) => `<i style="display:block;width:${d}px;height:${d}px;border-radius:50%;background:${c}"></i>`).join('')}</div><div style="flex:1;border-top:4px dotted ${T.rule}"></div></div>
     <div style="font:600 22px U;letter-spacing:.24em;text-transform:uppercase;color:${T.mute};margin-bottom:22px">Reach</div>
     <div style="font:italic 400 ${tease ? 210 : size(p.to, 150)}px/.98 S;letter-spacing:-.02em;color:${T.acc}">${tease ? '?' : esc(p.to)}</div>
    </div>
    <div style="display:flex;justify-content:center;gap:12px;margin:26px 0 34px">${[p.par ? `Par · ${p.par} click${p.par === 1 ? '' : 's'}` : 'Click only links', p.par ? level(p.par) : '', 'Solvable in 4 or fewer'].filter(Boolean).map(t => `<span style="border:2.5px solid ${T.ink};padding:10px 18px;font:600 19px U;letter-spacing:.1em;text-transform:uppercase;color:${T.ink2};white-space:nowrap">${t}</span>`).join('')}</div>
    <div><div style="font:italic 400 66px/1 S">Can you beat it?</div><div style="font:500 36px U;margin-top:16px">playscorcher.com</div><div style="font:600 18px U;letter-spacing:.2em;text-transform:uppercase;color:${T.mute};margin-top:16px">Free · No account · New puzzle every day</div></div>
   </div>
  </div>`;
  const tmp = path.join(os.tmpdir(), 'scorcher-poster.html'); fs.writeFileSync(tmp, html);
  const out = path.resolve(arg('out', path.join(root, 'posters', `${day}${tease ? '-teaser' : ''}${story ? '-story' : ''}${dark ? '-dark' : ''}.png`))); fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }), pg = await b.newPage({ viewport: { width: W, height: H } });
  await pg.goto('file://' + tmp); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(250); await pg.screenshot({ path: out }); await b.close();
  console.log('wrote', out, `(${p.from} -> ${tease ? '?' : p.to})`);
})();
