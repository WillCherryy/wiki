#!/usr/bin/env node
'use strict';
// Renders brand/wrap/*.svg to 2000x2000 PNGs (transparent ones keep their transparency).  Run after tools/make-logo-wrap.py.
const fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = path.join(__dirname, '..', 'brand', 'wrap');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 2000, height: 2000 } });
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.svg'))) {
    await p.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}" width="2000" height="2000" style="display:block">`);
    await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')), omitBackground: f.includes('transparent') });
  }
  await b.close(); console.log('wrote PNGs to', dir);
})();
