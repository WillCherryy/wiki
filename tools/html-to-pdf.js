#!/usr/bin/env node
'use strict';
// Print a local HTML file to an A4 PDF with Playwright's Chromium: node tools/html-to-pdf.js in.html out.pdf
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error('usage: node tools/html-to-pdf.js in.html out.pdf'); process.exit(2); }
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(src));
  await p.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
  await b.close();
  console.log('wrote', out);
})().catch(e => { console.error(e.message); process.exit(1); });
