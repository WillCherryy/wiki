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
  await b.close(); console.log(`wrote ${n} previews to og/find/`);
})().catch(e => { console.error(e); process.exit(1); });
