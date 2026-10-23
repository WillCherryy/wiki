#!/usr/bin/env node
'use strict';
// Renders the PNG half of the brand kit (icons, avatar, banner, social preview, overview sheet) from brand/*.svg.
// First run `python3 tools/make-logos.py`. Needs Playwright with Chromium (not a project dependency):
//   npm i --no-save playwright && node tools/make-brand.js
const fs = require('fs'), os = require('os'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..'), brand = path.join(root, 'brand'), font = f => 'file://' + path.join(root, 'fonts', f);
const svg = f => fs.readFileSync(path.join(brand, f), 'utf8').replace(/ width="[\d.]+" height="[\d.]+"/, ' width="100%" height="100%"');
const INK = '#16130f', PAPER = '#f3eee4', ACCENT = '#d63a1f', RAMP = 'linear-gradient(90deg,#2a4f8a,#5c8cbe,#d6be8c,#f08c50,#d63a1f)';
const FONTS = `@font-face{font-family:S;src:url(${font('eb-garamond-latin-400-normal.woff2')})}@font-face{font-family:S;font-style:italic;src:url(${font('eb-garamond-latin-400-italic.woff2')})}@font-face{font-family:U;font-weight:500;src:url(${font('instrument-sans-latin-500-normal.woff2')})}@font-face{font-family:U;font-weight:600;src:url(${font('instrument-sans-latin-600-normal.woff2')})}`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const shot = async (html, w, h, file, scale = 1, full = false) => {
    const tmp = path.join(os.tmpdir(), 'warmer-brand.html'); fs.writeFileSync(tmp, `<style>${FONTS}*{box-sizing:border-box}body{margin:0}</style>${html}`);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale }); await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(file.includes('/') ? '' : root, file), fullPage: full }); await p.close();
  };
  const sq = (s, name, svgText) => shot(`<div style="width:${s}px;height:${s}px">${svgText}</div>`, s, s, name);
  // app icons: full-bleed (platforms round the corners); maskable keeps the mark inside the central safe zone
  const flat = f => svg(f).replace(/rx="14"/, 'rx="0"');
  for (const [s, f] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png'], [1024, 'brand/app-icon-1024.png']]) await sq(s, path.join(f.startsWith('brand') ? brand : root, path.basename(f)), flat('app-icon.svg'));
  const mk = fs.readFileSync(path.join(root, 'tools', '.maskable.svg'), 'utf8');
  await sq(512, path.join(root, 'icon-maskable-512.png'), mk);
  // avatar: mark centred with generous room for a circular crop
  await shot(`<div style="width:800px;height:800px;background:${INK};display:grid;place-items:center"><div style="width:420px;height:350px">${svg('mark-on-dark.svg')}</div></div>`, 800, 800, path.join(brand, 'avatar-800.png'));
  // banner (X / Twitch / YouTube header)
  await shot(`<div style="width:1500px;height:500px;background:${PAPER};position:relative;overflow:hidden"><div style="position:absolute;left:0;right:0;top:0;height:10px;background:${RAMP}"></div>
    <div style="position:absolute;left:150px;top:120px;width:760px;height:190px">${svg('logo-horizontal.svg')}</div>
    <div style="position:absolute;left:176px;top:340px;font:600 22px U;letter-spacing:.22em;text-transform:uppercase;color:#4b453b">The daily Wikipedia race</div>
    <div style="position:absolute;right:120px;top:90px;width:430px;height:330px;opacity:.95">${svg('mark.svg')}</div></div>`, 1500, 500, path.join(brand, 'banner-1500x500.png'));
  // social preview
  await shot(`<div style="width:1200px;height:630px;background:${PAPER};position:relative;overflow:hidden"><div style="position:absolute;left:0;right:0;top:0;height:10px;background:${RAMP}"></div><div style="position:absolute;inset:44px;border:1px solid #d8cfbf"></div>
    <div style="position:absolute;left:96px;top:110px;width:760px;height:230px">${svg('logo-horizontal.svg')}</div>
    <div style="position:absolute;left:104px;top:372px;font:600 26px U;letter-spacing:.2em;text-transform:uppercase;color:#4b453b">The daily Wikipedia race</div>
    <div style="position:absolute;left:104px;bottom:84px;font:500 25px U;color:#7a7265;letter-spacing:.03em">Click only links. Get warmer. No account needed.</div>
    <div style="position:absolute;right:110px;bottom:100px;width:230px;height:190px">${svg('mark.svg')}</div></div>`, 1200, 630, path.join(root, 'og.png'));
  // overview sheet
  const tile = (name, inner, bg, ink, h = 200, w = '100%') => `<div style="background:${bg};border:1px solid #d8cfbf;padding:20px;display:flex;flex-direction:column;gap:12px"><div style="height:${h}px;width:${w};display:grid;place-items:center">${inner}</div><div style="font:600 11px U;letter-spacing:.16em;text-transform:uppercase;color:${ink}">${name}</div></div>`;
  const box = (f, w, h) => `<div style="width:${w}px;height:${h}px">${svg(f)}</div>`;
  const sw = (c, n) => `<div style="flex:1"><div style="height:64px;background:${c};border:1px solid #d8cfbf"></div><div style="font:600 11px U;margin-top:6px;color:#4b453b">${n}</div><div style="font:500 11px U;color:#7a7265">${c}</div></div>`;
  await shot(`<div style="width:1544px;padding:44px;background:#ebe6da;color:${INK};font-family:U">
    <div style="font:400 54px S">Warmer — logo suite</div><div style="font:500 15px U;color:#7a7265;margin:4px 0 26px">Five dots climbing the temperature ramp. The mark is the game: cold start, hot target.</div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:18px">${tile('Primary · horizontal', box('logo-horizontal.svg', 640, 190), '#fbf8f1', '#7a7265', 210)}${tile('Stacked', box('logo-stacked.svg', 250, 200), '#fbf8f1', '#7a7265', 210)}</div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-top:18px">${tile('On dark', box('logo-horizontal-on-dark.svg', 640, 190), INK, '#b8b0a0', 210)}${tile('Mark', box('mark.svg', 250, 210), '#fbf8f1', '#7a7265', 210)}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:18px">${tile('One colour · black', box('logo-horizontal-black.svg', 300, 96), '#fbf8f1', '#7a7265', 120)}${tile('One colour · white', box('logo-horizontal-white.svg', 300, 96), '#d63a1f', '#fff', 120)}${tile('Wordmark', box('wordmark.svg', 270, 80), '#fbf8f1', '#7a7265', 120)}${tile('Wordmark · night', box('wordmark-on-dark.svg', 270, 80), INK, '#b8b0a0', 120)}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:18px">
      ${tile('App icon · dark', `<div style="width:130px;height:130px;border-radius:30px;overflow:hidden">${svg('app-icon.svg')}</div>`, '#fbf8f1', '#7a7265', 150)}
      ${tile('App icon · light', `<div style="width:130px;height:130px;border-radius:30px;overflow:hidden;border:1px solid #d8cfbf">${svg('app-icon-light.svg')}</div>`, '#fbf8f1', '#7a7265', 150)}
      ${tile('Avatar (circle crop)', `<div style="width:130px;height:130px;border-radius:50%;overflow:hidden;background:${INK};display:grid;place-items:center"><div style="width:76px;height:64px">${svg('mark-on-dark.svg')}</div></div>`, '#fbf8f1', '#7a7265', 150)}
      ${tile('Favicon 16 / 32 / 48', [16, 32, 48].map(s => `<div style="width:${s}px;height:${s}px;border-radius:${s * .22}px;overflow:hidden;margin:0 6px">${svg('app-icon.svg')}</div>`).join(''), '#fbf8f1', '#7a7265', 150)}</div>
    <div style="display:flex;gap:12px;margin-top:22px">${sw(INK, 'Ink')}${sw(PAPER, 'Paper')}${sw('#2a4f8a', 'Cold')}${sw('#5c8cbe', 'Cool')}${sw('#d6be8c', 'Sand')}${sw('#f08c50', 'Warm')}${sw(ACCENT, 'Hot · accent')}</div>
    <div style="font:500 14px/1.5 U;color:#4b453b;margin-top:18px">Type: EB Garamond (regular + italic for “er”). Clear space around the logo: the height of the largest dot. Minimum size: mark 16px, horizontal logo 90px wide.</div></div>`, 1544, 1300, path.join(brand, 'brand-sheet.png'), 1, true);
  // profile pictures and transparent marks for social accounts (circle-crop safe: the mark sits inside the central 60%)
  const shotT = async (html, w, h, file) => {
    const tmp = path.join(os.tmpdir(), 'warmer-brand-t.html'); fs.writeFileSync(tmp, `<style>*{margin:0}html,body{background:transparent}</style>${html}`);
    const p = await b.newPage({ viewport: { width: w, height: h } }); await p.goto('file://' + tmp); await p.waitForTimeout(150); await p.screenshot({ path: file, omitBackground: true }); await p.close();
  };
  const ig = (bg, mk, name) => shot(`<div style="width:1080px;height:1080px;background:${bg};display:grid;place-items:center"><div style="width:560px;height:467px">${svg(mk)}</div></div>`, 1080, 1080, path.join(brand, name));
  await ig(INK, 'mark-on-dark.svg', 'instagram-profile-1080.png'); await ig(PAPER, 'mark.svg', 'instagram-profile-1080-light.png');
  await ig(ACCENT, 'mark-white.svg', 'instagram-profile-1080-red.png');
  await shotT(`<div style="width:1024px;height:853px">${svg('mark.svg')}</div>`, 1024, 853, path.join(brand, 'mark-1024-transparent.png'));
  await shotT(`<div style="width:2400px;height:${Math.round(2400 * 0.3)}px">${svg('logo-horizontal.svg')}</div>`, 2400, 720, path.join(brand, 'logo-horizontal-2400-transparent.png'));
  for (const sz of [32, 48, 96]) await sq(sz, path.join(brand, `favicon-${sz}.png`), flat('app-icon.svg'));
  const alt = path.join(brand, 'alt-sheet.html');
  if (fs.existsSync(alt)) { const p = await b.newPage({ viewport: { width: 1580, height: 900 } }); await p.goto('file://' + alt); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250); await p.screenshot({ path: path.join(brand, 'alt-sheet.png'), fullPage: true }); await p.close(); }
  await b.close(); console.log('brand PNGs written');
})();
