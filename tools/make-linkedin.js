#!/usr/bin/env node
'use strict';
// LinkedIn banners from the brand SVGs: personal profile (1584x396, light and dark) and company page cover (1128x191).
// Run `python3 tools/make-logos.py` first.  node tools/make-linkedin.js
const fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..'), brand = path.join(root, 'brand'), font = f => 'file://' + path.join(root, 'fonts', f);
const svg = f => fs.readFileSync(path.join(brand, f), 'utf8').replace(/ width="[\d.]+" height="[\d.]+"/, ' width="100%" height="100%"');
const RAMP = 'linear-gradient(90deg,#2a4f8a,#5c8cbe,#d6be8c,#f08c50,#d63a1f)';
const FONTS = `@font-face{font-family:U;font-weight:500;src:url(${font('instrument-sans-latin-500-normal.woff2')})}@font-face{font-family:U;font-weight:600;src:url(${font('instrument-sans-latin-600-normal.woff2')})}@font-face{font-family:S;src:url(${font('eb-garamond-latin-400-normal.woff2')})}@font-face{font-family:S;font-style:italic;src:url(${font('eb-garamond-latin-400-italic.woff2')})}`;
const vb = f => { const m = fs.readFileSync(path.join(brand, f), 'utf8').match(/viewBox="([\d. -]+)"/)[1].split(' ').map(Number); return m[2] / m[3]; };
const T = { light: { bg: '#f3eee4', ink: '#16130f', mute: '#7a7265', ink2: '#4b453b', logo: 'logo-horizontal.svg', mark: 'mark.svg' }, dark: { bg: '#16130f', ink: '#f3eee4', mute: '#a1978a', ink2: '#cfc7b8', logo: 'logo-horizontal-on-dark.svg', mark: 'mark-on-dark.svg' } };
const personal = t => `<div style="width:1584px;height:396px;background:${t.bg};position:relative;overflow:hidden;font-family:U">
  <div style="position:absolute;left:0;right:0;top:0;height:10px;background:${RAMP}"></div>
  <div style="position:absolute;left:446px;top:84px;width:${150 * vb(t.logo)}px;height:150px">${svg(t.logo)}</div>
  <div style="position:absolute;left:480px;top:262px;font:600 21px U;letter-spacing:.22em;text-transform:uppercase;color:${t.ink2}">The daily Wikipedia link race</div>
  <div style="position:absolute;left:480px;top:306px;font:500 24px U;color:${t.mute}">playscorcher.com &nbsp;·&nbsp; Free &nbsp;·&nbsp; No account &nbsp;·&nbsp; A new puzzle every day</div>
  <div style="position:absolute;right:70px;top:56px;width:330px;height:275px">${svg(t.mark)}</div></div>`;
const company = t => `<div style="width:1128px;height:191px;background:${t.bg};position:relative;overflow:hidden;font-family:U">
  <div style="position:absolute;left:0;right:0;top:0;height:6px;background:${RAMP}"></div>
  <div style="position:absolute;left:70px;top:30px;width:${100 * vb(t.logo)}px;height:100px">${svg(t.logo)}</div>
  <div style="position:absolute;left:84px;top:150px;font:600 15px U;letter-spacing:.22em;text-transform:uppercase;color:${t.ink2}">The daily Wikipedia link race</div>
  <div style="position:absolute;right:84px;top:8px;width:210px;height:175px">${svg(t.mark)}</div></div>`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const shot = async (html, w, h, file) => { const tmp = path.join(require('os').tmpdir(), 'scorcher-linkedin.html'); fs.writeFileSync(tmp, `<style>${FONTS}*{box-sizing:border-box}body{margin:0}</style>${html}`); const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250); await p.screenshot({ path: path.join(brand, file) }); await p.close(); };
  await shot(personal(T.light), 1584, 396, 'linkedin-banner-light.png'); await shot(personal(T.dark), 1584, 396, 'linkedin-banner-dark.png');
  await shot(company(T.light), 1128, 191, 'linkedin-company-cover-light.png'); await shot(company(T.dark), 1128, 191, 'linkedin-company-cover-dark.png');
  await b.close(); console.log('wrote LinkedIn banners (2x) to', brand);
})();
