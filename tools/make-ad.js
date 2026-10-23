#!/usr/bin/env node
'use strict';
// Renders the Warmer advert: tools/video/ad.html is a pure function of time, so frames are captured one by one
// (1080x1920, 30 fps) and muxed with the soundtrack from tools/make-ad-audio.py.
//   python3 tools/make-ad-audio.py && node tools/make-ad.js [--fps 30] [--frames N] [--sheet]
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 30), SECS = 32, N = +arg('frames', FPS * SECS), WORKERS = +arg('workers', 4);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warmer-ad-')), out = path.join(__dirname, '..', 'brand', 'video');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const work = async w => {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await p.goto('file://' + path.join(__dirname, 'video', 'ad.html')); await p.waitForFunction(() => window.__ready);
    for (let f = w; f < N; f += WORKERS) {
      await p.evaluate(t => window.render(t), f / FPS);
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    }
    await p.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
  await b.close();
  const audio = path.join(out, 'warmer-ad.wav'), mp4 = path.join(out, 'warmer-ad.mp4');
  const args = ['-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg')];
  if (fs.existsSync(audio)) args.push('-i', audio);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (fs.existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '224k', '-shortest');
  args.push(mp4);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  if (process.argv.includes('--sheet')) console.log('frames in', dir);
  console.log('wrote', mp4);
})();
