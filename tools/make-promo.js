#!/usr/bin/env node
'use strict';
// Records the short advert: a hook, then the real game UI (puzzle, discovery, universe, modes) on a phone-sized screen, with big captions and the Vivaldi recording underneath. Based on make-demo: the daily puzzle, links, the heat signal, find, contents, the win and its Sky reveal,
// your sky and system map, packs, leaderboards, live races, profile, cloud save and the Locker. No scripted graphics: this drives index.html itself.
// The sandbox cannot reach Wikipedia, so article text comes from tools/video/demo-articles.js; everything else (UI, heat logic, animations) is the real code.
//   node tools/make-promo.js           -> brand/video/scorcher-promo.mp4 (1080x1920)
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), { spawn, execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const { articleHtml, BACKLINKS } = require('./video/demo-articles.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'brand', 'video'), PORT = 8796, BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));   // long holds are trimmed so the demo stays brisk
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
  await ctx.addInitScript(() => { if (!/overlay\.html$/.test(location.pathname)) return; window.WebSocket = class { constructor() { setTimeout(() => { this.onopen && this.onopen(); const n = Date.now(), s = o => this.onmessage({ data: JSON.stringify(o) }); const top = [{ n: 'Mira', d: 1, c: 4, s: 29 }, { n: 'Jonas', d: 1, c: 5, s: 41 }, { n: 'Lena', at: 'Nile', tp: .8 }, { n: 'Sam', at: 'Egypt', tp: .5 }, { n: 'Ravi', at: 'Italy', tp: .3 }];
    s({ t: 's', now: n, phase: 'racing', round: 1, startAt: n - 15000, puzzle: { from: 'Pizza', to: 'Crocodile' } }); s({ t: 'b', n: 9, fin: 2, top, stuck: [{ title: 'Mediterranean Sea', tp: .3, n: 2, names: [] }, { title: 'Hippopotamus', tp: .5, n: 1, names: ['Sam'] }] }); }, 80); } send() {} close() {} }; });
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
    await dot(x, y); await sleep(380); await page.evaluate(() => { const t = document.getElementById('demoTap'); t.classList.remove('press'); void t.offsetWidth; t.classList.add('press'); }); await sleep(120);
    if (then) await then(); else await loc.click(); await sleep(180); await page.evaluate(() => document.getElementById('demoTap').classList.remove('on'));
  };
  const link = t => page.locator(`#article a[data-t="${t}"]`).first();
  const toLink = async t => { await link(t).evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(900); };
  const modalScroll = async (y, ms = 900) => { await page.evaluate(y => { const m = document.querySelector('.modal'); if (m) m.scrollTo({ top: y, behavior: 'smooth' }); }, y); await sleep(ms); };
  const snap = async n => { fs.mkdirSync('/tmp/snaps', { recursive: true }); await page.screenshot({ path: `/tmp/snaps/${n}.png` }); };
  const closeAll = async () => { await page.evaluate(() => { const f = document.getElementById('skyfull'); if (f) f.remove(); closeModal(); }); await sleep(500); };

  // ---- the advert's own overlays: big captions and full-screen title cards
  await page.evaluate(() => {
    const st = document.createElement('style'); st.textContent = `
      #prCap{position:fixed;left:0;right:0;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:100002;pointer-events:none;text-align:center;padding:0 18px;opacity:0;transform:translateY(14px) scale(.96);transition:opacity .22s,transform .3s cubic-bezier(.2,.9,.2,1)}
      #prCap.on{opacity:1;transform:none}#prCap b{display:inline-block;max-width:100%;padding:11px 20px 12px;border-radius:10px;background:rgba(20,17,14,.92);color:#fff;font:400 31px/1.08 "EB Garamond",Georgia,serif;letter-spacing:.005em;box-shadow:0 10px 34px -8px rgba(0,0,0,.55)}#prCap b i{color:#ff7a59;font-style:italic}
      #prCard{position:fixed;inset:0;z-index:100003;display:grid;place-content:center;gap:14px;padding:0 26px;text-align:center;color:#fff;background:#0c0a12;opacity:0;pointer-events:none;transition:opacity .28s}#prCard.on{opacity:1}
      #prCard .a{font:400 66px/1 "EB Garamond",Georgia,serif;animation:prIn .55s cubic-bezier(.2,.9,.2,1) both}#prCard .a i{color:#ff6a45}#prCard .a.s{font-size:44px}#prCard .b{font:600 17px "Instrument Sans",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#b9b2d6;animation:prIn .55s .15s cubic-bezier(.2,.9,.2,1) both}
      #prCard .r{display:flex;justify-content:center;align-items:center;gap:12px;font:400 50px/1 "EB Garamond",serif;animation:prIn .55s .3s both}#prCard .r em{color:#ff6a45;font-style:italic}#prCard .r s{text-decoration:none;color:#ff6a45}
      @keyframes prIn{from{opacity:0;transform:translateY(26px) scale(.94)}}
      #prOv{position:fixed;left:50%;top:50%;width:508px;height:286px;margin:-143px 0 0 -254px;z-index:100004;border-radius:10px;overflow:hidden;box-shadow:0 30px 90px -10px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.12);opacity:0;transform:scale(.92);transition:.35s cubic-bezier(.2,.9,.2,1);pointer-events:none}#prOv.on{opacity:1;transform:none}#prOv iframe{width:1920px;height:1080px;border:0;transform:scale(.2646);transform-origin:0 0}
      #demoCap{display:none}`;
    document.head.appendChild(st);
    for (const [id, tag] of [['prCap', 'div'], ['prCard', 'div'], ['prOv', 'div']]) { const e = document.createElement(tag); e.id = id; document.body.appendChild(e); }
  });
  const pc = async (html, hold) => { await page.evaluate(h => { const c = document.getElementById('prCap'); c.innerHTML = '<b>' + h + '</b>'; c.classList.add('on'); }, html); if (hold) await sleep(hold); };
  const pcOff = async () => { await page.evaluate(() => document.getElementById('prCap').classList.remove('on')); await sleep(220); };
  const card = async (html, hold) => { await page.evaluate(h => { const c = document.getElementById('prCard'); c.innerHTML = h; c.classList.add('on'); }, html); await sleep(hold); };
  const cardOff = async () => { await page.evaluate(() => document.getElementById('prCard').classList.remove('on')); await sleep(300); };

  // 0. the hook
  await card(`<div class="b">Wikipedia, but it's a race</div><div class="a">Get from</div><div class="r">Pizza <s>→</s> <em>Crocodile</em></div><div class="a s" style="animation-delay:.5s">using <i>only links.</i></div>`, 2500);
  await card(`<div class="a" style="font-size:96px"><i>4</i> clicks.</div><div class="b">Fewer, and the sky rewards you</div>`, 1300);
  await cardOff();
  // 1. the daily puzzle, played
  await pc('A new puzzle <i>every day</i>', 1100); await pcOff();
  await tap(page.locator('#playBtn')); await page.waitForSelector('#game.on', { timeout: 15000 }); await sleep(900);
  await pc('Tap a link. <i>Travel.</i>', 900);
  await toLink('Italy'); await tap(link('Italy')); await sleep(900); await pcOff();
  await pc('The heat bar shows how <i>close</i> you are', 1500); await pcOff();
  await toLink('Egypt'); await tap(link('Egypt')); await sleep(800);
  await pc('Search a page for any link', 400); await tap(page.locator('#dFind')); await page.keyboard.type('Nile', { delay: 110 }); await sleep(700); await page.keyboard.press('Escape'); await sleep(300); await pcOff();
  await toLink('Nile'); await tap(link('Nile')); await sleep(800);
  await pc('Getting <i>hotter</i>…', 900); await pcOff();
  await toLink('Crocodile'); await tap(link('Crocodile'));
  await page.waitForSelector('#skyCv', { timeout: 20000 });
  // 2. the discovery
  await sleep(1200); await pc('Solve it and you <i>discover</i> a real object', 1500); await pcOff();
  await page.evaluate(() => { const m = document.querySelector('.page, #page'); window.scrollTo({ top: 420, behavior: 'smooth' }); }); await sleep(700);
  // 3. your sky, the universe, full screen
  await page.evaluate(() => { closeModal(); show('home'); renderHome(); openSkyFull({}); }); await sleep(2200);
  await pc('Your own <i>universe</i>, scaled by real mass', 1700); await pcOff();
  await sleep(1400);
  await tap(page.locator('#sfClose')); await sleep(300); await page.evaluate(() => { const f = document.getElementById('skyfull'); if (f) f.remove(); closeModal(); show('home'); renderHome(); }); await sleep(300);
  // 4. modes, quickly
  await card(`<div class="a s">And so much <i>more</i></div>`, 700); await cardOff();
  await pc('Companion packs for every interest', 300); await page.evaluate(() => openPacks()); await sleep(1500); await pcOff();
  await pc('Race friends <i>live</i>', 300); await page.evaluate(() => { closeModal(); openHost(); }); await sleep(500); await page.locator('button:has-text("Create lobby")').click(); await sleep(1200); await pcOff();
  await pc('Stream it, with an <i>OBS overlay</i>', 300);
  await card('', 1); await page.evaluate(() => { try { Live.leave(true); } catch {} closeModal(); show('home'); const o = document.getElementById('prOv'); o.innerHTML = '<iframe src="/overlay.html?c=SCRCH&bg=1"></iframe>'; o.classList.add('on'); }); await sleep(2500);
  await page.evaluate(() => document.getElementById('prOv').classList.remove('on')); await cardOff(); await pcOff();
  await pc('Daily leaderboards and private leagues', 300); await page.evaluate(() => openLeaderboard('day')); await sleep(1300); await pcOff();
  await pc('Make it yours: <i>fonts, colours, themes</i>', 300); await page.evaluate(() => { closeModal(); openStudio(); }); await sleep(1200); await pcOff();
  await pc('Progress saved, <i>no account</i>', 300); await page.evaluate(() => { closeModal(); openCloud(); }); await sleep(1100); await pcOff();
  await page.evaluate(() => { closeModal(); show('home'); renderHome(); });
  // 5. the end
  await card(`<div style="display:grid;justify-items:center;gap:6px"><img src="/favicon.svg" style="width:120px;height:120px;border-radius:26px"><div class="a" style="font-size:84px;margin-top:8px">Scorch<i>er</i></div><div class="b">The daily Wikipedia link race</div><div class="a s" style="margin-top:24px;animation-delay:.5s">Play free · <i>playscorcher.com</i></div><div class="b" style="margin-top:34px;font-size:12px;letter-spacing:.1em;color:#7d7699;text-transform:none">Music: Vivaldi, Summer (Presto), J. Harrison with the Wichita State University Chamber Players, CC BY-SA 3.0</div></div>`, 3400);
  await cdp.send('Page.stopScreencast'); await sleep(600);
  await browser.close(); srv.kill();
  // ---- assemble at a constant 30 fps with the Vivaldi recording underneath
  frames.sort((a, b) => a.t - b.t); const list = [];
  frames.forEach((f, i) => { const d = i < frames.length - 1 ? Math.max(.001, frames[i + 1].t - f.t) : .6; list.push(`file '${f.file}'`, `duration ${d.toFixed(4)}`); }); list.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
  const SPEED = +(process.env.SPEED || 1.25), total = (frames[frames.length - 1].t - frames[0].t + .6) / SPEED, mp4 = path.join(OUT, 'scorcher-promo.mp4'), track = path.join(ROOT, 'brand', 'audio', 'hops-music.mp3'), t0 = +(process.env.MUSIC_FROM || 6);
  const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-ss', String(t0), '-i', track,
    '-vf', `setpts=PTS/${SPEED},fps=30,scale=1080:1920:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-movflags', '+faststart',
    '-af', `afade=t=in:d=0.4,afade=t=out:st=${(total - 2).toFixed(2)}:d=2,volume=.8`, '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(2), mp4];
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`wrote ${mp4}: ${total.toFixed(1)}s from ${frames.length} frames`);
})().catch(e => { console.error(e); try { process.kill(0); } catch {} process.exit(1); });
