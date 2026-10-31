#!/usr/bin/env node
'use strict';
// UI smoke test: styles.css parses with balanced braces (a stray "}" once silently dropped ~30 Sky rules), then every page opens on desktop and phone
// with no script errors, no sideways scrolling and visible content. Wikipedia is stubbed. Skipped when Playwright is not installed.
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let fails = 0; const bad = m => { fails++; console.error('  FAIL ' + m); };

// 1. CSS structure
{ const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  let d = 0, line = 1; for (const ch of css) { if (ch === '\n') line++; else if (ch === '{') d++; else if (ch === '}') { d--; if (d < 0) { bad(`styles.css: stray "}" near line ${line}`); d = 0; } } } if (d !== 0) bad(`styles.css: ${d} unclosed "{"`); }

let chromium; try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch {} }
(async () => {
  if (!chromium) { console.log(fails ? '' : 'ok: ui smoke (css only; Playwright not installed, pages skipped)'); process.exit(fails ? 1 : 0); }
  const { articleHtml } = require('./video/demo-articles.js'), PORT = 8931, today = new Date().toLocaleDateString('en-CA');
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DEV: '1', DATA_FILE: path.join(os.tmpdir(), 'scorcher-ui-' + Date.now() + '.json') }, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1500));
  const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const CALLS = ['openPacks()', "openPack('history')", 'liveMenu()', 'openHost()', 'openStudio()', 'leagueModal()', 'openLocker()', "openSky({tab:'sky'})", 'openProfile()', 'openSettings()', "openLeaderboard('day')", 'openCloud()', 'openMaker()', 'openArchive()'];
  for (const [tag, vp, mob] of [['desktop', { width: 1360, height: 860 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mob, hasTouch: mob }); await ctx.addInitScript(() => { try { localStorage.setItem('wikiio:seen', '1'); } catch {} });
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/*', r => { const u = new URL(r.request().url());
      if (u.hostname === 'localhost') { if (u.pathname === '/puzzles.json') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, days: { [today]: { from: 'Pizza', to: 'Crocodile', par: 4, route: ['Pizza', 'Italy', 'Egypt', 'Nile', 'Crocodile'], alts: [], cats: ['Food'] } } }) }); return r.continue(); }
      if (u.hostname === 'en.wikipedia.org') { const m = u.pathname.match(/page\/summary\/(.+)$/); if (m) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: decodeURIComponent(m[1]).replace(/_/g, ' '), description: '', extract: '' }) }); const q = u.searchParams; if (q.get('action') === 'parse') { const t = (q.get('page') || '').replace(/_/g, ' '); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ parse: { title: t, text: articleHtml(t) } }) }); } return r.fulfill({ contentType: 'application/json', body: '{}' }); }
      return r.abort(); });
    await page.goto(`http://localhost:${PORT}/index.html`); await page.waitForFunction(() => typeof P !== 'undefined' && typeof renderHome === 'function' && document.querySelector('#home'), null, { timeout: 15000 }); await page.waitForTimeout(600);
    await page.evaluate(() => { closeModal(); P.sky.cat = { 'TON 618': 1, Rigel: 1, 'The Sun': 1 }; P.sky.found = { quasar: 1, bluegiant: 1, sun: 1 }; P.sky.best = 8; saveP(); });
    for (const call of CALLS) {
      errs.length = 0; await page.evaluate(() => { const f = document.getElementById('skyfull'); if (f) f.remove(); const ob = document.getElementById('obs'); if (ob) { const x = ob.querySelector('#obClose'); if (x) x.click(); else ob.remove(); } closeModal(); show('home'); });
      try { await page.evaluate(c => { eval(c); }, call); await page.waitForTimeout(900); } catch (e) { bad(`${tag} ${call}: threw ${e.message.split('\n')[0]}`); continue; }
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, text: (document.querySelector('#page:not([style*="none"]) #pageBody, #scrim.on #modal, #obs') || {}).innerText || '' }));
      if (errs.length) bad(`${tag} ${call}: script error: ${errs[0]}`); if (m.over > 2) bad(`${tag} ${call}: page scrolls sideways by ${m.over}px`); if (m.text.trim().length < 20) bad(`${tag} ${call}: nothing visible`);
    }
    errs.length = 0; await page.evaluate(() => { closeModal(); show('home'); Observatory.open({}); }); await page.waitForTimeout(1800);
    const sz = await page.evaluate(() => { const c = document.getElementById('obCv'); return c ? [c.width, c.clientWidth, document.getElementById('obInsp').innerText.length] : null; }); if (!sz || sz[0] < sz[1] * .4 || sz[2] < 20) bad(`${tag} observatory did not open properly (${sz})`); if (errs.length) bad(`${tag} observatory: ${errs[0]}`);
    errs.length = 0; await page.evaluate(() => { document.getElementById('obClose').click(); Observatory.compare('The Sun'); }); await page.waitForTimeout(1200); if (!(await page.evaluate(() => !!document.getElementById('cmpInfo') && document.getElementById('cmpInfo').innerText.length > 10))) bad(`${tag} size comparison did not open`); if (errs.length) bad(`${tag} compare: ${errs[0]}`);
    await page.evaluate(() => document.getElementById('cmpX').click());
    // Scorcher Sky: the same engine with everything unlocked, its own scientific interface
    errs.length = 0; await page.goto(`http://localhost:${PORT}/sky`); await page.waitForTimeout(2500);
    { const r = await page.evaluate(async () => { const out = {}; out.welcome = document.getElementById('sxInsp').innerText.length; __map.pick('Betelgeuse'); await new Promise(r => setTimeout(r, 600));
        const t = document.getElementById('sxInsp').innerText; out.bet = /Betelgeuse/.test(t) && /Right ascension/.test(t) && /PUBLISHED/i.test(t);
        __map.pick('Jupiter'); await new Promise(r => setTimeout(r, 400)); out.jup = /Ecliptic longitude/.test(document.getElementById('sxInsp').innerText);
        const st = { gx: 120, gy: -40, gz: 15, unit: .84, M: 1.2, T: 6100, L: 28, kind: 'F-type main-sequence star', hex: '#fff4e0', name: 'Test' }; showStar(st); out.star = /Declination/.test(document.getElementById('sxInsp').innerText);
        __map.pick('Betelgeuse'); await new Promise(r => setTimeout(r, 300)); document.querySelector('[data-a="cmp"]').click(); await new Promise(r => setTimeout(r, 900)); out.cmp = !!document.getElementById('cmpInfo'); const x = document.getElementById('cmpX'); if (x) x.click();
        __map.pick('Jupiter'); await new Promise(r => setTimeout(r, 300)); document.querySelector('[data-a="globe"]').click(); await new Promise(r => setTimeout(r, 600)); out.globe = !!document.getElementById('inspect'); const g = document.getElementById('inX'); if (g) g.click();
        const q = document.getElementById('sxQ'); q.value = '05h35m -05.4'; q.dispatchEvent(new Event('input')); out.coord = /Orion Nebula/.test(document.getElementById('sxRes').innerText);
        out.over = document.documentElement.scrollWidth - innerWidth; return out; });
      if (errs.length) bad(`${tag} /sky: script error: ${errs[0]}`); if (r.welcome < 50) bad(`${tag} /sky: no welcome panel`); if (!r.bet) bad(`${tag} /sky: object inspector incomplete`); if (!r.jup) bad(`${tag} /sky: planet inspector incomplete`);
      if (!r.star) bad(`${tag} /sky: catalogue star inspector incomplete`); if (!r.cmp) bad(`${tag} /sky: size comparison did not open`); if (!r.globe) bad(`${tag} /sky: globe did not open`); if (!r.coord) bad(`${tag} /sky: coordinate search failed`); if (r.over > 2) bad(`${tag} /sky: page scrolls sideways by ${r.over}px`); }
    // Scorcher Tree: loads the built dataset, inspects species and branch points, compares two species, opens a collapsed group, searches
    errs.length = 0; await page.goto(`http://localhost:${PORT}/tree`); await page.waitForTimeout(1500);
    { const r = await page.evaluate(async () => { const T = window.__tree, side = () => document.getElementById('txSide').innerText, out = {}; if (!T) return { load: false }; out.load = true;
        T.select('homo-sapiens', true); out.taxon = /Homo sapiens/.test(side()) && /Closest relatives/i.test(side());
        T.select('placentalia', true); out.node = /Atlantogenata/.test(side()) && /Ravenictis/.test(side()) && /Tarver/.test(side()); T.select('vertebrata', true); out.node = out.node && /not yet sourced/.test(side());
        T.setCompare(['homo-sapiens', 'gallus-gallus']); out.cmp = /Last common ancestor/i.test(side()) && /Amniot/.test(side());
        const was = T.byId.get('teleostei').row; T.toggle('teleostei'); out.open = T.byId.get('danio-rerio').row != null;
        const q = document.getElementById('txQ'); q.value = 'coelac'; q.dispatchEvent(new Event('input')); out.search = /coelacanth/i.test(document.getElementById('txRes').innerText);
        out.over = document.documentElement.scrollWidth - innerWidth; return out; });
      if (errs.length) bad(`${tag} /tree: script error: ${errs[0]}`); if (!r.load) bad(`${tag} /tree: dataset did not load`); else { if (!r.taxon) bad(`${tag} /tree: species inspector incomplete`); if (!r.node) bad(`${tag} /tree: branch-point inspector incomplete`); if (!r.cmp) bad(`${tag} /tree: comparison did not find the common ancestor`); if (!r.open) bad(`${tag} /tree: group did not open`); if (!r.search) bad(`${tag} /tree: search failed`); if (r.over > 2) bad(`${tag} /tree: page scrolls sideways`); } }
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if (fails) { console.error(`ui smoke: ${fails} failure(s)`); process.exit(1); } console.log('ok: ui smoke (styles parse, 15 pages x desktop and phone open cleanly, no sideways scroll; Scorcher Sky inspects, compares, searches coordinates; Scorcher Tree inspects, compares, opens groups, searches)');
})().catch(e => { console.error(e); process.exit(1); });
