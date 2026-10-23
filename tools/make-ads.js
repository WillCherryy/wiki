#!/usr/bin/env node
'use strict';
// Renders the Instagram adverts (1080x1920, 30 fps) from tools/video/ads.html, a pure function of time, and muxes the soundtracks.
//   python3 tools/make-ads-audio.py && node tools/make-ads.js [general|players|streamers] [--workers 4]
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const FPS = 30, out = path.join(__dirname, '..', 'brand', 'video');
const wi = process.argv.indexOf('--workers'), WORKERS = wi > 0 ? +process.argv[wi + 1] : 4;
const MAP = { general: 'general', players: 'users', streamers: 'streamers' };
const want = process.argv.slice(2).filter(a => MAP[a]);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  for (const name of want.length ? want : Object.keys(MAP)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warmer-' + name + '-')), url = 'file://' + path.join(__dirname, 'video', 'ads.html') + '?ad=' + MAP[name];
    const probe = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await probe.goto(url); await probe.waitForFunction(() => window.__ready);
    const N = Math.ceil(await probe.evaluate(() => window.DURATION) * FPS); await probe.close();
    const work = async w => {
      const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await p.goto(url); await p.waitForFunction(() => window.__ready);
      for (let f = w; f < N; f += WORKERS) { await p.evaluate(t => window.render(t), f / FPS); await p.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 }); }
      await p.close();
    };
    await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
    const audio = path.join(out, `warmer-ad-${name}.wav`), mp4 = path.join(out, `warmer-ad-${name}.mp4`), args = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg')];
    if (fs.existsSync(audio)) args.push('-i', audio);
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'); if (fs.existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '224k', '-shortest');
    args.push(mp4); execFileSync('ffmpeg', args, { stdio: 'inherit' }); console.log('wrote', mp4, N, 'frames');
  }
  await b.close();
})();
