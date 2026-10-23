#!/usr/bin/env node
'use strict';
// Renders the epic adverts (1080x1920, 30 fps) from tools/video/epic.html, a pure function of time, and muxes the score.
//   python3 tools/make-epic-audio.py && node tools/make-epic.js [trailer|heat|lobby|strobe] [--workers 4]
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const FPS = 30, out = path.join(__dirname, '..', 'brand', 'video');
const wi = process.argv.indexOf('--workers'), WORKERS = wi > 0 ? +process.argv[wi + 1] : 4;
const NAMES = ['trailer', 'heat', 'lobby', 'strobe'], want = process.argv.slice(2).filter(a => NAMES.includes(a));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  for (const name of want.length ? want : NAMES) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorcher-epic-' + name + '-')), url = 'file://' + path.join(__dirname, 'video', 'epic.html') + '?ad=' + name;
    const probe = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await probe.goto(url); await probe.waitForFunction(() => window.__ready);
    const N = Math.ceil(await probe.evaluate(() => window.DURATION) * FPS); await probe.close();
    const work = async w => {
      const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await p.goto(url); await p.waitForFunction(() => window.__ready);
      for (let f = w; f < N; f += WORKERS) { await p.evaluate(t => window.render(t), f / FPS); await p.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 }); }
      await p.close();
    };
    await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
    const audio = path.join(out, `scorcher-epic-${name}.wav`), mp4 = path.join(out, `scorcher-epic-${name}.mp4`), args = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg')];
    if (fs.existsSync(audio)) args.push('-i', audio);
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'); if (fs.existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
    args.push(mp4); execFileSync('ffmpeg', args, { stdio: 'inherit' }); console.log('wrote', mp4, N, 'frames');
  }
  await b.close();
})();
