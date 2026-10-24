#!/usr/bin/env node
'use strict';
// Renders the calm advert (1080x1920, 30 fps) from tools/video/calm.html, a pure function of time, with its score.
//   node tools/make-calm.js [--workers 4]      needs python3 + numpy for the soundtrack
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const FPS = 30, out = path.join(__dirname, '..', 'brand', 'video'), wi = process.argv.indexOf('--workers'), WORKERS = wi > 0 ? +process.argv[wi + 1] : 4;
const url = 'file://' + path.join(__dirname, 'video', 'calm.html');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const probe = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await probe.goto(url); await probe.waitForFunction(() => window.__ready);
  const dur = await probe.evaluate(() => window.DURATION), events = await probe.evaluate(() => window.EVENTS); await probe.close();
  fs.writeFileSync(path.join(__dirname, 'video', '.calm-events.json'), JSON.stringify({ duration: dur, events }));
  execFileSync('python3', [path.join(__dirname, 'make-calm-audio.py')], { stdio: 'inherit' });
  const N = Math.ceil(dur * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorcher-calm-'));
  const work = async w => {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await p.goto(url); await p.waitForFunction(() => window.__ready);
    for (let f = w; f < N; f += WORKERS) { await p.evaluate(t => window.render(t), f / FPS); await p.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 }); }
    await p.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
  const audio = path.join(out, 'scorcher-calm.wav'), mp4 = path.join(out, 'scorcher-calm.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-i', audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4], { stdio: 'inherit' });
  console.log('wrote', mp4, N, 'frames'); await b.close();
})();
