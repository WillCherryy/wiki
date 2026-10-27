#!/usr/bin/env node
'use strict';
// Records a plain screen demo of the real game UI on a phone-sized screen: the daily puzzle, links, the heat signal, find, contents, the win and its Sky reveal,
// your sky and system map, packs, leaderboards, live races, profile, cloud save and the Locker. No scripted graphics: this drives index.html itself.
// The sandbox cannot reach Wikipedia, so article text comes from tools/video/demo-articles.js; everything else (UI, heat logic, animations) is the real code.
//   node tools/make-demo.js            -> brand/video/scorcher-demo.mp4 (1080x1920)
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), { spawn, execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const { articleHtml, BACKLINKS } = require('./video/demo-articles.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'brand', 'video'), PORT = 8795, BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms >= 1000 ? ms * .7 : ms));   // long holds are trimmed so the demo stays brisk
const today = new Date().toLocaleDateString('en-CA');
const post = (p, body) => new Promise(res => { const d = JSON.stringify(body), r = http.request(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } }, x => { x.resume(); x.on('end', () => res(x.statusCode)); }); r.on('error', () => res(0)); r.end(d); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DEV: '1', DATA_FILE: path.join(os.tmpdir(), 'scorcher-demo-data-' + Date.now() + '.json') }, stdio: 'ignore' }); await sleep(1500);
  // a believable leaderboard for today
  for (const [pid, name, xp, c, s] of [['demoada01', 'Ada', 9, 4, 31], ['demoeli02', 'Eli', 8, 4, 44], ['demomia03', 'Mia', 6, 4, 58], ['demoray04', 'Ray', 5, 5, 40], ['demojun05', 'Jun', 4, 5, 67], ['demolee06', 'Lee', 3, 6, 71]])
    await post('/api/score', { pid, name, xp, day: today, clicks: c, secs: s, score: 900 - c * 30 - s, path: ['Pizza', 'Italy', 'Egypt', 'Nile', 'Crocodile'].slice(0, c + 1), purist: c === 4 });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' });
  await ctx.addInitScript(() => { try { localStorage.setItem('wikiio:seen', '1'); } catch {} });
  const page = await ctx.newPage(); page.on('pageerror', e => console.log('pageerror', e.stack.split('\n').slice(0,3).join(' | ')));
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') {
      if (u.pathname === '/puzzles.json') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, days: { [today]: { from: 'Pizza', to: 'Crocodile', par: 4, route: ['Pizza', 'Italy', 'Egypt', 'Nile', 'Crocodile'], alts: [], cats: ['Food', 'Nature'] } } }) });
      return route.continue();
    }
    if (u.hostname === 'en.wikipedia.org') {
      const m = u.pathname.match(/\/api\/rest_v1\/page\/summary\/(.+)$/);
      if (m) { const t = decodeURIComponent(m[1]).replace(/_/g, ' '), D = { Pizza: 'Italian dish of flatbread with toppings', Crocodile: 'Large semiaquatic reptile' }; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: t, description: D[t] || '', extract: '' }) }); }
      const q = u.searchParams, act = q.get('action');
      if (act === 'parse') { const t = (q.get('page') || '').replace(/_/g, ' '); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ parse: { title: t, text: articleHtml(t) } }) }); }
      if (act === 'query' && q.get('prop') === 'linkshere') { const t = (q.get('titles') || ''); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ query: { pages: [{ title: t, linkshere: (BACKLINKS[t] || []).map(title => ({ title })) }] } }) }); }
      return route.fulfill({ contentType: 'application/json', body: '{}' });
    }
    return route.abort();
  });
  await page.goto(BASE + '/index.html'); await sleep(1500);
  // a lived-in profile, so the home screen, Sky and profile pages are not empty
  await page.evaluate(() => {
    closeModal(); P.name = 'Will'; P.played = 63; P.won = 60; P.streak = 12; P.maxStreak = 41; P.best = 2; P.xp = 640;
    const want = { brown: 4, reddwarf: 5, redgiant: 4, sun: 5, bluewhite: 4, bluegiant: 2, whitedwarf: 2, neutron: 1 }, cat = {}; for (const id in want) SKY.POOL[id].slice(0, want[id]).forEach((q, i) => { cat[q.n] = i ? 1 : 2; });
    P.sky.cat = cat; P.sky.found = Object.fromEntries(Object.entries(want).map(([k, v]) => [k, v + 1])); P.sky.best = 7; P.sky.total = 22; P.sky.runs = {};
    for (const [i, n] of Object.keys(cat).entries()) P.sky.runs[n] = { first: { day: '2026-10-' + String(10 + (i % 15)).padStart(2, '0'), mode: i % 3 ? 'daily' : 'pack', num: 280 + i, from: ['Cycling', 'Atom', 'Jazz', 'Volcano', 'Pasta'][i % 5], to: ['Eiffel Tower', 'Saturn', 'Chess', 'Mozart', 'Tiger'][(i + 2) % 5], clicks: 3 + (i % 3), par: 3, secs: 40 + i * 5, why: 'par route', idx: 0, at: Date.now() - (i + 2) * 864e5 } };
    for (let d = 1; d <= 14; d++) P.sky.log[new Date(Date.now() - d * 864e5).toLocaleDateString('en-CA')] = [1, 3, 4, 5, 2, 7, 0, 6][d % 8];
    delete P.days[dayKey()]; saveP(); renderHeader(); renderHome();
  });
  await sleep(900);
  // overlays that belong to the recording: a tap marker and a caption
  await page.evaluate(() => {
    const st = document.createElement('style'); st.textContent = `#demoTap{position:fixed;left:0;top:0;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,255,255,.34);border:3px solid rgba(255,255,255,.95);box-shadow:0 0 0 2px rgba(0,0,0,.28),0 6px 20px rgba(0,0,0,.35);z-index:100000;pointer-events:none;opacity:0;transform:translate(270px,700px);transition:transform .6s cubic-bezier(.3,.7,.2,1),opacity .25s}#demoTap.on{opacity:1}#demoTap i{position:absolute;inset:-3px;border-radius:50%;border:3px solid rgba(255,255,255,.9);opacity:0}#demoTap.press i{animation:demoRipple .5s ease-out}@keyframes demoRipple{from{opacity:.9;transform:scale(.7)}to{opacity:0;transform:scale(2.1)}}
      #demoCap{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translate(-50%,-8px);max-width:88%;z-index:100001;pointer-events:none;background:rgba(22,19,15,.9);color:#fff;font:600 15.5px/1.25 "Instrument Sans",system-ui,sans-serif;letter-spacing:.01em;padding:11px 20px;border-radius:999px;text-align:center;opacity:0;transition:opacity .4s,transform .4s}#demoCap.on{opacity:1;transform:translate(-50%,0)}`; document.head.appendChild(st);
    const t = document.createElement('div'); t.id = 'demoTap'; t.innerHTML = '<i></i>'; document.body.appendChild(t); const c = document.createElement('div'); c.id = 'demoCap'; document.body.appendChild(c);
  });
  // ---- the recorder: Chrome's screencast at device resolution, timestamped, assembled at the end
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorcher-demo-')), frames = []; let n = 0;
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async f => { const file = path.join(dir, `f${String(n++).padStart(6, '0')}.jpg`); fs.writeFile(file, Buffer.from(f.data, 'base64'), () => {}); frames.push({ file, t: f.metadata.timestamp }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  // ---- helpers
  const cap = async (text, hold = 0) => { console.log('cap:', text); await page.evaluate(t => { const c = document.getElementById('demoCap'); c.textContent = t; c.classList.add('on'); }, text); if (hold) await sleep(hold); };
  const capOff = async () => { await page.evaluate(() => document.getElementById('demoCap').classList.remove('on')); await sleep(300); };
  const dot = async (x, y, show = true) => { await page.evaluate(([x, y, s]) => { const t = document.getElementById('demoTap'); t.style.transform = `translate(${x}px,${y}px)`; t.classList.toggle('on', s); }, [x, y, show]); };
  const tap = async (loc, then) => {   // glide the marker to the element, press, then do the real click
    const b = await loc.boundingBox(); if (!b) throw new Error('no box'); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await dot(x, y); await sleep(700); await page.evaluate(() => { const t = document.getElementById('demoTap'); t.classList.remove('press'); void t.offsetWidth; t.classList.add('press'); }); await sleep(220);
    if (then) await then(); else await loc.click(); await sleep(350); await page.evaluate(() => document.getElementById('demoTap').classList.remove('on'));
  };
  const link = t => page.locator(`#article a[data-t="${t}"]`).first();
  const toLink = async t => { await link(t).evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(900); };
  const modalScroll = async (y, ms = 900) => { await page.evaluate(y => { const m = document.querySelector('.modal'); if (m) m.scrollTo({ top: y, behavior: 'smooth' }); }, y); await sleep(ms); };
  const snap = async n => { fs.mkdirSync('/tmp/snaps', { recursive: true }); await page.screenshot({ path: `/tmp/snaps/${n}.png` }); };
  const closeAll = async () => { await page.evaluate(() => { const f = document.getElementById('skyfull'); if (f) f.remove(); closeModal(); }); await sleep(500); };

  // 1. home
  await sleep(600);
  await cap('A new Wikipedia puzzle every day', 3000);
  await page.evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' })); await sleep(1200); await cap('Packs, practice, live races and your sky', 2600);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await sleep(1000);
  // 2. start the puzzle
  await tap(page.locator('#playBtn')); await page.waitForSelector('#game.on', { timeout: 15000 }); await sleep(1500);
  await cap('Start on one article. Reach the other by clicking links', 3600);
  // 3. Pizza -> Italy
  await cap('Tap a link to travel', 900); await toLink('Italy'); await tap(link('Italy')); await sleep(1700);
  await cap('The heat bar shows how close you are', 3200);
  // 4. find a link
  await cap('Search a page for any link', 900); await tap(page.locator('#dFind')); await page.keyboard.type('Egypt', { delay: 190 }); await sleep(1400); await page.locator('#dFind').click(); await sleep(500);
  await toLink('Egypt'); await tap(link('Egypt')); await sleep(1700);
  // 5. contents
  await cap('Jump to any section', 900); await tap(page.locator('#dToc')); await sleep(1500);
  await tap(page.locator('.toc.big .toc-i').nth(1), async () => { await page.locator('.toc.big .toc-i').nth(1).click(); }); await sleep(1700);
  await cap('Getting warmer', 1800); await toLink('Nile'); await tap(link('Nile')); await sleep(1700);
  // 6. the last link
  await cap('Almost there. The screen glows as you close in', 2800); await toLink('Crocodile'); await tap(link('Crocodile'));
  await page.waitForSelector('#skyCv', { timeout: 20000 }).catch(async e => { await page.screenshot({ path: '/tmp/demo-fail.png' }); console.log(await page.evaluate(() => JSON.stringify({tt:G.toTitle,to:G.to,cur:G.cur&&G.cur.title,path:G.path,done:G.done,mode:G.mode,sky:!!(G.result&&G.result.sky),scrim:document.getElementById('scrim').className,mod:document.getElementById('modal').innerText.slice(0,200)}))); throw e; }); await cap('Solved. You earn a real astronomical object', 4200);
  await modalScroll(560, 1200); await cap('Your route, and how it compares', 3000); await modalScroll(1500, 1200);
  // 7. sky
  await tap(page.locator('#skyBtn')); await sleep(2200); await capOff();
  await snap('sky1'); await cap('Collect real stars, named after the real thing', 3200);
  await tap(page.locator('#skyTabs [data-t="sys"]')); await sleep(2200); await snap('sys'); await cap('Build your own star system', 3000);
  await tap(page.locator('#zFull')); await sleep(1800); await cap('Explore it full screen', 2200);
  await tap(page.locator('#sfChips button').nth(3), async () => { await page.locator('#sfChips button').nth(3).click(); }); await snap('full'); await sleep(3800);
  await tap(page.locator('#sfClose')); await sleep(900); await closeAll();
  // 8. packs, ranks, live
  await page.evaluate(() => { closeModal(); show('home'); renderHome(); }); await sleep(800);
  await cap('Themed companion packs', 600); await tap(page.locator('#tabbar [data-go="packs"]')); await sleep(1500); await modalScroll(420, 1100); await modalScroll(0, 900); await closeAll();
  await cap('Daily leaderboards and private leagues', 600); await tap(page.locator('#tabbar [data-go="ranks"]')); await sleep(2800); await closeAll();
  await page.evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' })); await sleep(900); await cap('Race friends live', 600); await tap(page.locator('#qLive')); await sleep(2800); await closeAll();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await sleep(700);
  // 9. profile, cloud save, make it yours
  await cap('Your title, streak and progress', 600); await tap(page.locator('#tabbar [data-go="me"]')); await sleep(2600); await modalScroll(320, 1000); await closeAll();
  await cap('Progress saved to the cloud, no account', 600); await page.evaluate(() => openCloud()); await sleep(3000); await closeAll();
  await cap('Make it yours: themes, trails and buddies', 600); await page.evaluate(() => openLocker('theme')); await sleep(1600);
  await snap('locker1'); await page.evaluate(() => document.querySelector('#lkTabs [data-t="buddy"]').click()); await sleep(1200); await tap(page.locator('.lkgrid .item').nth(3)); await sleep(2600); await snap('locker2'); await closeAll();
  // 10. close
  await cap('Play free at playscorcher.com', 3600); await capOff(); await sleep(500);
  await cdp.send('Page.stopScreencast'); await sleep(600);
  await browser.close(); srv.kill();
  // ---- assemble: timestamps -> a constant 30 fps video, with a calm piece of the Vivaldi recording underneath
  frames.sort((a, b) => a.t - b.t); const list = [];
  frames.forEach((f, i) => { const d = i < frames.length - 1 ? Math.max(.001, frames[i + 1].t - f.t) : .6; list.push(`file '${f.file}'`, `duration ${d.toFixed(4)}`); }); list.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
  const total = frames[frames.length - 1].t - frames[0].t + .6, mp4 = path.join(OUT, 'scorcher-demo.mp4'), track = path.join(ROOT, 'brand', 'audio', 'hops-music.mp3'), hasTrack = fs.existsSync(track);
  const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt')]; if (hasTrack) args.push('-ss', '34', '-i', track);
  args.push('-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart');
  if (hasTrack) args.push('-af', `afade=t=in:d=1.2,afade=t=out:st=${(total - 2.4).toFixed(2)}:d=2.4,volume=.45`, '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(2)); else args.push('-t', total.toFixed(2));
  args.push(mp4); execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`wrote ${mp4}: ${total.toFixed(1)}s from ${frames.length} frames`);
})().catch(e => { console.error(e); try { process.kill(0); } catch {} process.exit(1); });
