#!/usr/bin/env node
'use strict';
// Regenerates the icons and the social preview image. Needs Playwright with Chromium (not a project dependency):
//   npm i --no-save playwright && node tools/make-brand.js
const fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..'), font = f => 'file://' + path.join(root, 'fonts', f);
const INK = '#16130f', PAPER = '#f3eee4', ACCENT = '#d63a1f';

const markSolid = (scale, rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="${INK}"/>
<g transform="translate(${32 - 17 * scale} ${32 - 10 * scale}) scale(${scale})"><circle cx="4" cy="13" r="3.2" fill="${PAPER}"/><path d="M8 12C13 0 21 1 26 8" fill="none" stroke="${PAPER}" stroke-width="2.4" stroke-linecap="round"/><circle cx="30" cy="9" r="3.6" fill="${ACCENT}"/></g></svg>`;

(async () => {
  fs.writeFileSync(path.join(root, 'favicon.svg'), markSolid(1.45, 14));
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const shot = async (html, w, h, file) => { const tmp = path.join(require('os').tmpdir(), 'wikilink-brand.html'); fs.writeFileSync(tmp, html); const p = await b.newPage({ viewport: { width: w, height: h } }); await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); await p.screenshot({ path: path.join(root, file) }); await p.close(); };
  const out = [[192, 'icon-192.png', markSolid(1.45, 0)], [512, 'icon-512.png', markSolid(1.45, 0)], [180, 'apple-touch-icon.png', markSolid(1.45, 0)], [512, 'icon-maskable-512.png', markSolid(1.05, 0)]];
  for (const [s, f, svg] of out) { const p = await b.newPage({ viewport: { width: s, height: s } }); await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" style="display:block" `)}</body>`); await p.screenshot({ path: path.join(root, f) }); await p.close(); }

  const og = `<style>
@font-face{font-family:S;src:url(${font('instrument-serif-latin-400-normal.woff2')})}@font-face{font-family:S;font-style:italic;src:url(${font('instrument-serif-latin-400-italic.woff2')})}
@font-face{font-family:U;font-weight:600;src:url(${font('instrument-sans-latin-600-normal.woff2')})}
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:${PAPER};color:${INK};font-family:U;position:relative;overflow:hidden}
.top{position:absolute;left:0;right:0;top:0;height:10px;background:linear-gradient(90deg,#2a4f8a,#5c8cbe,#d6be8c,#f08c50,${ACCENT})}
.frame{position:absolute;inset:44px;border:1px solid #d8cfbf}
.word{position:absolute;left:96px;top:96px;font:400 150px/1 S;letter-spacing:-1px}.word i{color:${ACCENT}}
.tag{position:absolute;left:100px;top:262px;font:600 26px U;letter-spacing:.2em;text-transform:uppercase;color:#4b453b}
.route{position:absolute;left:100px;right:100px;top:380px;display:flex;align-items:center}
.n{width:26px;height:26px;border-radius:50%;flex:none}.ln{height:3px;flex:1;margin:0 -2px}
.lab{position:absolute;top:424px;font:400 44px/1.1 S}.sub{position:absolute;left:100px;bottom:92px;font:600 24px U;color:#7a7265;letter-spacing:.04em}
</style><body><div class="top"></div><div class="frame"></div>
<div class="word">wiki<i>link</i></div><div class="tag">The daily Wikipedia race</div>
<div class="route"><div class="n" style="background:#2a4f8a"></div><div class="ln" style="background:linear-gradient(90deg,#2a4f8a,#5c8cbe)"></div><div class="n" style="background:#5c8cbe"></div><div class="ln" style="background:linear-gradient(90deg,#5c8cbe,#d6be8c)"></div><div class="n" style="background:#d6be8c"></div><div class="ln" style="background:linear-gradient(90deg,#d6be8c,#f08c50)"></div><div class="n" style="background:#f08c50"></div><div class="ln" style="background:linear-gradient(90deg,#f08c50,${ACCENT})"></div><div class="n" style="background:${ACCENT};width:34px;height:34px"></div></div>
<div class="lab" style="left:100px">Start</div><div class="lab" style="right:100px">Target</div>
<div class="sub">Click only links. Get warmer. No account needed.</div></body>`;
  await shot(og, 1200, 630, 'og.png');
  await b.close();
  console.log('brand assets written');
})();
