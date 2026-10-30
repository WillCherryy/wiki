#!/usr/bin/env node
'use strict';
// Renders the Cosmos film (1920x1080, 30 fps, letterboxed 2.39:1) from tools/video/cosmos.html with its original score (tools/make-cosmos-audio.py).
// The night sky, the Milky Way and the deep field are painted once (bake) and shared by every worker; the rest is the game's own universe renderer.
//   node tools/make-cosmos.js [--vertical] [--silent] [--workers 4] [--from 0] [--to 88] [--fps 30]
//   --vertical renders the 9:16 cut for Reels and Shorts; --silent leaves the sound off, for a track added in the app
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const VERT = process.argv.includes('--vertical'), SILENT = process.argv.includes('--silent'), VW = VERT ? 1080 : 1920, VH = VERT ? 1920 : 1080, Q = VERT ? '&v=1' : '', FPS = arg('fps', 30), WORKERS = arg('workers', 4), out = path.join(__dirname, '..', 'brand', 'video'), page = path.join(__dirname, 'video', 'cosmos.html'), BK = path.join(__dirname, 'video', '.cosmos-bake');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(BK, { recursive: true });
const ARGS = ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu-vsync'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ARGS });
  const probe = await b.newPage({ viewport: { width: VW, height: VH } }); await probe.goto('file://' + page + '?nobake=1' + Q); await probe.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const baked = await probe.evaluate(() => window.bake()); for (const k of ['sky', 'ridge', 'deep', 'gal', 'atl', 'crab']) fs.writeFileSync(path.join(BK, k + '.png'), Buffer.from(baked[k].split(',')[1], 'base64'));
  const info = await probe.evaluate(() => ({ duration: window.DURATION, events: window.EVENTS })); await probe.close(); console.log('baked in', baked.ms, 'ms');
  const audio = path.join(out, 'scorcher-cosmos.wav'); if (!SILENT) execFileSync('python3', [path.join(__dirname, 'make-cosmos-audio.py'), audio], { stdio: 'inherit' });
  const T0 = arg('from', 0), T1 = Math.min(info.duration, arg('to', info.duration)), F0 = Math.round(T0 * FPS), F1 = Math.round(T1 * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorcher-cosmos-'));
  const per = Math.ceil((F1 - F0) / WORKERS); let done = 0; const t0 = Date.now();
  const work = async w => {   // each worker takes one stretch of the film, so the surfaces it has painted stay useful frame to frame
    const p = await b.newPage({ viewport: { width: VW, height: VH } }); await p.goto('file://' + page + '?baked=.cosmos-bake' + Q); await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    const a = F0 + w * per, z = Math.min(F1, a + per);
    for (let f = a; f < z; f++) {
      const t = f / FPS; await p.evaluate(t => window.render(t), t);
      for (let k = 0; k < 12 && await p.evaluate(() => SKY.pending()); k++) { await p.waitForTimeout(40); await p.evaluate(t => window.render(t), t); }   // wait for any sharper star surface still being painted
      await p.evaluate(t => window.render(t), t);
      await p.screenshot({ path: path.join(dir, `f${String(f - F0).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (++done % 60 === 0) console.log(`${done}/${F1 - F0} frames, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    await p.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
  const tag = (VERT ? '-vertical' : '') + (SILENT ? '-silent' : ''), mp4 = path.join(out, T0 === 0 && T1 === info.duration ? `scorcher-cosmos${tag}.mp4` : `scorcher-cosmos${tag}-${T0}-${T1}.mp4`);
  const vid = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  execFileSync('ffmpeg', SILENT ? ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), ...vid, '-an', mp4] : ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-ss', String(T0), '-t', String(T1 - T0), '-i', audio, ...vid, '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true }); console.log('wrote', mp4, F1 - F0, 'frames in', Math.round((Date.now() - t0) / 1000), 's'); await b.close();
})();
