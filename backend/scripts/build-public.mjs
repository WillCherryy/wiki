// Writes backend/public: the Scorcher Build landing page (/), the console (/console) and their assets, served as static files by this
// Worker on build.playscorcher.com. The pages come from mockups/suite via tools/build-pages.js; links point at this host.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, '..', 'public');
const BP = createRequire(import.meta.url)('../../tools/build-pages.js');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), BP.indexHtml(''));
fs.writeFileSync(path.join(out, 'console.html'), BP.consoleHtml(''));
fs.copyFileSync(path.join(here, '..', 'app', 'app.html'), path.join(out, 'app.html'));   // the working app: run tests, connect agents, see results
for (const a of BP.ASSETS) { fs.mkdirSync(path.dirname(path.join(out, a)), { recursive: true }); fs.copyFileSync(path.join(BP.SRC, a), path.join(out, a)); }
fs.writeFileSync(path.join(out, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n');
console.log(`wrote ${path.relative(process.cwd(), out)}: index.html, console.html and ${BP.ASSETS.length} assets`);
