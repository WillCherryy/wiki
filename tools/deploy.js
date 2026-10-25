#!/usr/bin/env node
'use strict';
// One command to publish the latest code: pulls main, builds dist/, deploys the Worker (site + API) and then checks that the live site
// really serves the build you just made.   usage: npm run deploy        (needs `npx wrangler login` done once)
const { execSync, spawnSync } = require('child_process');
const run = (cmd, opt = {}) => { console.log('\n> ' + cmd); const r = spawnSync(cmd, { shell: true, stdio: 'inherit', ...opt }); if (r.status !== 0) { console.error('\nStopped: "' + cmd + '" failed.'); process.exit(1); } };
const out = cmd => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
run('git pull --ff-only origin main');
run('npm run build:site');
const commit = out('git rev-parse --short HEAD');
run('npx wrangler deploy');
const domain = (() => { try { return require('../config.js').domain; } catch { return null; } })() || 'playscorcher.com';
(async () => {
  for (const base of ['https://' + domain, 'https://wiki.will-34e.workers.dev']) {
    for (let i = 0; i < 6; i++) {
      try { const r = await fetch(base + '/build.txt?x=' + Date.now(), { cache: 'no-store' }); const b = r.ok ? await r.json() : null;
        if (b && b.commit === commit) { console.log('\nLive on ' + base + ': build ' + commit + ' (' + b.builtAt + '). Hard-refresh the page (Ctrl+F5, or clear the site data on your phone).'); process.exit(0); }
        if (b) console.log(base + ' is serving build ' + b.commit + ', expected ' + commit + (i < 5 ? ' - retrying...' : ''));
      } catch (e) { if (i === 5) console.log(base + ' not reachable from here (' + (e.cause && e.cause.code || e.message) + ').'); }
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  console.log('\nDeployed, but could not confirm the live build. Open https://' + domain + '/build.txt - it should say "' + commit + '". If it does not, the custom domain is not attached to this Worker (see worker/README.md).');
})();
