'use strict';
// Render the technical paper to A4 PDF: mockups/suite/scorcher-build-paper.pdf, served beside the page at /build/scorcher-build-paper.pdf.
// Run after changing the paper or regenerating the validation register:  node tools/paper-pdf.js   (needs Playwright's Chromium)
const fs = require('fs'), path = require('path');
const BP = require('./build-pages');
(async () => {
  const { chromium } = require('playwright');
  const tmp = path.join(BP.SRC, '_paper-print.html'), out = path.join(BP.SRC, 'scorcher-build-paper.pdf');
  fs.writeFileSync(tmp, BP.paperHtml('/build'));               // same folder as the page, so its fonts resolve
  const b = await chromium.launch(), p = await b.newPage();
  try {
    await p.goto('file://' + tmp, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
    await p.emulateMedia({ media: 'print', colorScheme: 'light' });
    await p.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="width:100%;font:8px monospace;color:#6a706c;padding:0 17mm;display:flex;justify-content:space-between"><span>Scorcher Build · Testing AI agents against physics · v1</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
  } finally { await b.close(); fs.unlinkSync(tmp); }
  console.log('wrote', path.relative(process.cwd(), out), Math.round(fs.statSync(out).size / 1024) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
