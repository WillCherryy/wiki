#!/usr/bin/env node
'use strict';
// Renders the race advert (1080x1920, 30 fps) from tools/video/race.html: a Wikipedia-style page photographed at an angle,
// five dots racing across it. A pure function of time. Needs python3 + numpy for the score.
//   node tools/make-race.js [--story wiggins|newton] [--workers 4]     (the stories live in tools/video/race-content.js)
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const FPS = 30, out = path.join(__dirname, '..', 'brand', 'video'), wi = process.argv.indexOf('--workers'), WORKERS = wi > 0 ? +process.argv[wi + 1] : 4;
const si = process.argv.indexOf('--story'), STORY = si > 0 ? process.argv[si + 1] : 'wiggins', url = 'file://' + path.join(__dirname, 'video', 'race.html') + '?story=' + STORY;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const probe = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await probe.goto(url); await probe.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const info = await probe.evaluate(() => ({ duration: window.DURATION, events: window.EVENTS, t0: 1.9, endT: window.ENDT, lastT: window.LASTT, suffix: window.RACE_CONTENT[new URLSearchParams(location.search).get('story') || 'wiggins'].file })); await probe.close();
  fs.writeFileSync(path.join(__dirname, 'video', '.race-events.json'), JSON.stringify(info));
  execFileSync('python3', [path.join(__dirname, 'make-race-audio.py')], { stdio: 'inherit' }); const SUF = info.suffix;
  const N = Math.ceil(info.duration * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorcher-race-'));
  const work = async w => {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await p.goto(url); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    for (let f = w; f < N; f += WORKERS) { await p.evaluate(t => window.render(t), f / FPS); await p.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 }); }
    await p.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
  const audio = path.join(out, `scorcher-race${SUF}.wav`), mp4 = path.join(out, `scorcher-race${SUF}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-i', audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4], { stdio: 'inherit' });
  console.log('wrote', mp4, N, 'frames'); await b.close();
})();
