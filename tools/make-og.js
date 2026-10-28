#!/usr/bin/env node
'use strict';
// Renders a 1200x630 link-preview picture for every Sky object (og/find/<slug>.jpg), so /find/<object> links unfurl with the real object art.
//   node tools/make-og.js
const fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'og', 'find');
fs.mkdirSync(OUT, { recursive: true });
const font = f => 'file://' + path.join(ROOT, 'fonts', f);
const HTML = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:EB;src:url(${font('eb-garamond-latin-400-normal.woff2')});font-weight:400}
@font-face{font-family:EB;src:url(${font('eb-garamond-latin-400-italic.woff2')});font-weight:400;font-style:italic}
@font-face{font-family:IS;src:url(${font('instrument-sans-latin-600-normal.woff2')});font-weight:600}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:#0a0914;overflow:hidden;position:relative;color:#fff}
#bg{position:absolute;inset:0;background:radial-gradient(70% 90% at 24% 50%,var(--c),transparent 70%);opacity:.28}
canvas{position:absolute;left:0;top:0}
.t{position:absolute;left:560px;right:56px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:14px}
.e{font:600 18px IS;letter-spacing:.22em;text-transform:uppercase;color:#b9b2d6}.chip{align-self:flex-start;padding:7px 16px;border-radius:999px;border:1px solid var(--c);background:rgba(255,255,255,.06);font:600 16px IS;letter-spacing:.14em;text-transform:uppercase}
.n{font:italic 400 92px/1 EB;color:var(--c);text-shadow:0 0 40px var(--c)}.s{font:600 20px IS;letter-spacing:.1em;text-transform:uppercase;color:#a9a2c8}
.f{position:absolute;left:560px;right:56px;bottom:44px;display:flex;justify-content:space-between;align-items:baseline;font:400 30px EB}.f b{font-weight:400}.f i{color:#ff6a45}.f span{font:600 15px IS;letter-spacing:.16em;text-transform:uppercase;color:#8d86b0}
</style><div id="bg"></div><canvas id="c" width="1200" height="630"></canvas><div class="t"><div class="e">I discovered</div><div class="chip" id="chip"></div><div class="n" id="n"></div><div class="s" id="s"></div></div>
<div class="f"><b>Scorch<i>er</i></b><span>The daily Wikipedia link race</span></div>`;
(async () => {
  const { slugOf } = await import('../worker/find.js');
  const b = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } }); const tmp = path.join(require('os').tmpdir(), 'scorcher-og.html'); fs.writeFileSync(tmp, HTML); await p.goto('file://' + tmp); await p.addScriptTag({ path: path.join(ROOT, 'skyobjects.js') });
  await p.evaluate(() => Promise.all(['400 40px EB', 'italic 400 40px EB', '600 20px IS'].map(f => document.fonts.load(f))));
  const list = await p.evaluate(() => SKY.OBJ.flatMap((o, i) => SKY.POOL[o.id].map(q => ({ id: o.id, idx: i, name: q.n, kind: q.kind, c: o.c, tn: o.name }))));
  let n = 0;
  for (const it of list) {
    await p.evaluate(it => {
      document.body.style.setProperty('--c', it.c); document.getElementById('bg').style.setProperty('--c', it.c); document.getElementById('chip').textContent = it.tn + ' · tier ' + (it.idx + 1) + ' of 9';
      document.getElementById('n').textContent = it.name; document.getElementById('n').style.fontSize = it.name.length > 14 ? (it.name.length > 22 ? 52 : 68) + 'px' : '92px'; document.getElementById('s').textContent = it.kind;
      const cv = document.getElementById('c'), g = cv.getContext('2d'), w = 1200, h = 630; g.clearRect(0, 0, w, h);
      const q = SKY.POOL[it.id].find(x => x.n === it.name); g.save(); g.beginPath(); g.rect(0, 0, 540, h); g.clip(); SKY.starfield(g, 540, h, 0, 190, 3); g.restore();
      SKY.starfield(g, w, h, 0, 90, 11); g.save(); g.beginPath(); g.rect(0, 0, 1200, 630); g.clip(); SKY.drawV(g, it.id, 285, 315, (SKY.FR[it.id] || .2) * h * .95, 3.2, q); g.restore();
    }, it);
    await p.waitForTimeout(40);
    await p.screenshot({ path: path.join(OUT, slugOf(it.name) + '.jpg'), type: 'jpeg', quality: 88 }); n++;
  }
  // one picture per scheduled daily puzzle (og/day/<date>.jpg) for /p/<date> share links
  const days = JSON.parse(fs.readFileSync(path.join(ROOT, 'puzzles.json'), 'utf8')).days, DOUT = path.join(ROOT, 'og', 'day'); fs.mkdirSync(DOUT, { recursive: true });
  const dp = await b.newPage({ viewport: { width: 1200, height: 630 } }), dtmp = path.join(require('os').tmpdir(), 'scorcher-og-day.html'); let nd = 0;
  for (const [day, z] of Object.entries(days)) {
    const [y, m, d] = day.split('-').map(Number), num = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5) + 1, esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'), big = Math.max(z.from.length, z.to.length) > 16 ? 64 : 84;
    fs.writeFileSync(dtmp, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:EB;src:url(${font('eb-garamond-latin-400-normal.woff2')});font-weight:400}@font-face{font-family:EB;src:url(${font('eb-garamond-latin-400-italic.woff2')});font-weight:400;font-style:italic}@font-face{font-family:IS;src:url(${font('instrument-sans-latin-600-normal.woff2')});font-weight:600}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;color:#fff;position:relative;background:linear-gradient(135deg,#14203f 0%,#1d2a4d 28%,#3a2f52 52%,#7d3a3a 78%,#c2431f 100%)}
body::after{content:'';position:absolute;inset:0;background:radial-gradient(60% 80% at 80% 100%,rgba(255,120,60,.35),transparent 70%)}.w{position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between;z-index:1}
.top{display:flex;justify-content:space-between;font:600 20px IS;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.78)}.r{display:grid;gap:10px}.l{font:600 18px IS;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.n{font:400 ${big}px/1.02 EB}.n.t{font-style:italic;color:#ffd0b8}.dots{display:flex;gap:14px;align-items:center;margin:6px 0}.dots i{width:16px;height:16px;border-radius:50%}.f{display:flex;justify-content:space-between;align-items:baseline;font:400 34px EB}.f i{color:#ff9a7a}.f span{font:600 18px IS;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.7)}</style>
<div class="w"><div class="top"><span>Daily puzzle #${num}</span><span>${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</span></div>
<div class="r"><div class="l">Get from</div><div class="n">${esc(z.from)}</div><div class="dots"><i style="background:#2a4f8a"></i><i style="background:#5c8cbe"></i><i style="background:#d6be8c"></i><i style="background:#f08c50"></i><i style="background:#d63a1f;width:24px;height:24px"></i></div><div class="l">to</div><div class="n t">${esc(z.to)}</div></div>
<div class="f"><b style="font-weight:400">Scorch<i>er</i></b><span>${z.par ? 'Fastest route: ' + z.par + ' click' + (z.par === 1 ? '' : 's') + ' · ' : ''}The daily Wikipedia link race</span></div></div>`);
    await dp.goto('file://' + dtmp); await dp.evaluate(() => Promise.all(['400 40px EB', 'italic 400 40px EB', '600 20px IS'].map(f => document.fonts.load(f)))); await dp.waitForTimeout(30);
    await dp.screenshot({ path: path.join(DOUT, day + '.jpg'), type: 'jpeg', quality: 88 }); nd++;
  }
  await b.close(); console.log(`wrote ${n} object previews to og/find/ and ${nd} daily previews to og/day/`);
})().catch(e => { console.error(e); process.exit(1); });
