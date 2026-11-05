/* Scorcher Evolve: a daily deduction game on the tree of life.
   A hidden vertebrate is chosen for the day. Each guess reveals the last common ancestor the guess shares with it,
   and costs that ancestor's age (as Scorcher Tree shows it) from a budget of 2,000 million years.
   Finding the daily animal adds it to Your Tree. All relationships and ages come from /treedata/vertebrates.json. */
(() => {
'use strict';
const BUDGET = 2000, LAUNCH = '2026-11-04', KEY = 'scorcher:evolve';
const $ = id => document.getElementById(id), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = v => Math.round(v).toLocaleString('en-GB');
const GROUP = { mammal: 'Mammals', bird: 'Birds', reptile: 'Reptiles', amphibian: 'Amphibians', lobefinned: 'Lobe-finned fishes', rayfinned: 'Ray-finned fishes', cartilaginous: 'Cartilaginous fishes', jawless: 'Jawless fishes' };
const ORDER = ['mammal', 'bird', 'reptile', 'amphibian', 'lobefinned', 'rayfinned', 'cartilaginous', 'jawless'];
// the race's temperature scale: deep ancestors are cold, recent ones are hot
const HEAT = [[0, [214, 58, 31]], [60, [240, 140, 80]], [180, [214, 190, 140]], [350, [92, 140, 190]], [600, [42, 79, 138]]];
const heat = ma => { for (let i = 1; i < HEAT.length; i++) if (ma <= HEAT[i][0]) { const [a, ca] = HEAT[i - 1], [b, cb] = HEAT[i], t = (ma - a) / (b - a); return 'rgb(' + ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(',') + ')'; } return 'rgb(42,79,138)'; };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }, save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const S = Object.assign({ days: {}, tree: [] }, load());
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = k => Math.round((Date.parse(k + 'T12:00:00Z') - Date.parse(LAUNCH + 'T12:00:00Z')) / 864e5) + 1;
try { const t = (JSON.parse(localStorage.getItem('wikiio:v1')) || {}).theme || 'system'; if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark'; } catch {}   // the race's own setting

let D, par = {}, kids = {}, tips = [], ctx = null;
const path = id => { const p = [id]; while (par[p[0]]) p.unshift(par[p[0]]); return p; };
const mrca = (a, b) => { const pa = path(a), pb = path(b); let m = null; for (let i = 0; i < Math.min(pa.length, pb.length) && pa[i] === pb[i]; i++) m = pa[i]; return m; };
const under = id => kids[id] && kids[id].length ? kids[id].flatMap(under) : [id];
const T = id => D.taxa[id];
// an ancestor's age as Scorcher Tree shows it: a clock interval's central value, or a calibration's minimum; a bound where that is all there is
function ageOf(id) { const d = ((D.nodes[id] || {}).age || {}).display; if (!d) return { ma: 0, txt: 'not dated' };
  if (d.source === 'synthesis' && d.mid != null) return { ma: d.mid, txt: `${fmt(d.mid)} Ma` };
  if (d.lo != null) return { ma: d.lo, txt: d.source === 'bounded' ? `at least ${fmt(d.lo)} Ma` : `${fmt(d.lo)} Ma` };
  if (d.hi != null) return { ma: d.hi, txt: `at most ${fmt(d.hi)} Ma` };
  return { ma: 0, txt: 'not dated' }; }
function nameOf(id) { const n = D.nodes[id] || {}; if (n.common) return n.common; if (n.name) return n.name;
  const m = /^mrca-(.+)--(.+)$/.exec(id); return m && T(m[1]) && T(m[2]) ? `Ancestor of the ${T(m[1]).common.toLowerCase()} and the ${T(m[2]).common.toLowerCase()}` : 'A shared ancestor'; }
const sciName = id => { const n = D.nodes[id] || {}; return n.common && n.name ? n.name : ''; };
const img = id => (T(id).image || {}).thumb || '';

// a fixed shuffle of the species, one per day
function dailyHidden(k) { const ids = tips.slice().sort(); let s = 20261104; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const n = dayNum(k) - 1, cycle = Math.floor(n / ids.length); return ids[(((n + cycle * 7) % ids.length) + ids.length) % ids.length]; }

function start(mode) {
  const k = dayKey();
  if (mode === 'daily') { const rec = S.days[k] || (S.days[k] = { g: [] }); ctx = { mode, day: k, hidden: dailyHidden(k), rec }; }
  else { const pool = tips.filter(t => t !== dailyHidden(k)); ctx = { mode, day: k, hidden: pool[Math.floor(Math.random() * pool.length)], rec: { g: [] } }; }
  $('meta').innerHTML = mode === 'daily' ? `<span><b>Today’s animal</b> · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span>Evolve No. ${dayNum(k)}</span>` : `<span><b>Practice round</b> · not added to Your Tree</span><a href="#" id="back">Back to today’s animal</a>`;
  if (mode !== 'daily') $('back').onclick = e => { e.preventDefault(); start('daily'); };
  $('q').value = ''; render(); }

const spent = () => ctx.rec.g.reduce((s, g) => s + (g === ctx.hidden ? 0 : ageOf(mrca(g, ctx.hidden)).ma), 0);
const left = () => Math.max(0, BUDGET - spent());
const over = () => ctx.rec.g.includes(ctx.hidden) || left() <= 0;

function guess(id) {
  if (!ctx || over() || !T(id) || ctx.rec.g.includes(id)) return;
  ctx.rec.g.push(id);
  if (id === ctx.hidden) { ctx.rec.won = true; if (ctx.mode === 'daily' && !S.tree.includes(id)) S.tree.push(id); }
  else if (left() <= 0) ctx.rec.lost = true;
  if (ctx.mode === 'daily') save();
  render(true); }

function render(fresh) {
  const L = left(), done = over(), g = ctx.rec.g;
  $('budTop').textContent = $('budLab').textContent = `${fmt(L)} Myr`; $('budBar').style.setProperty('--left', L / BUDGET);
  $('play').hidden = done;
  // the closest ancestor so far
  const wrong = g.filter(x => x !== ctx.hidden), anc = wrong.map(x => mrca(x, ctx.hidden));
  const best = anc.sort((a, b) => path(b).length - path(a).length)[0];
  if (best && !done) { const a = ageOf(best), n = D.nodes[best] || {}, inside = under(best).filter(t => !g.includes(t)).length;
    $('closest').innerHTML = `<div class="closest" style="--c:${heat(a.ma)}"><div class="k">Closest so far: the hidden animal descends from</div><h2>${esc(nameOf(best))}</h2><p>${sciName(best) ? `<span class="sci">${esc(sciName(best))}</span>, ` : ''}${esc(a.txt)}. ${esc(n.blurb || '')} ${inside} of the field guide’s animals descend from it.</p></div>`; }
  else $('closest').innerHTML = '';
  // the log, newest first
  $('log').innerHTML = g.length ? g.slice().reverse().map(x => { if (x === ctx.hidden) return `<div class="row win"><img class="thumb" src="${esc(img(x))}" alt=""><div class="g"><b>${esc(T(x).common)}</b><small class="sci">${esc(T(x).sci)}</small></div><div class="a"><span><b>That’s the one</b></span></div><div class="c">0<small>Myr</small></div></div>`;
    const m = mrca(x, ctx.hidden), a = ageOf(m); return `<div class="row"><img class="thumb" src="${esc(img(x))}" alt=""><div class="g"><b>${esc(T(x).common)}</b><small class="sci">${esc(T(x).sci)}</small></div><div class="a" style="--c:${heat(a.ma)}"><i></i><span><b>${esc(nameOf(m))}</b><small>shared ancestor, ${esc(a.txt)}</small></span></div><div class="c">−${fmt(a.ma)}<small>Myr</small></div></div>`; }).join('') : '<div class="empty">No guesses yet. A first guess from a big group, such as a mammal or a bird, tells you the most.</div>';
  // the result
  if (done) { const h = ctx.hidden, t = T(h), im = t.image || {}, won = g.includes(h);
    $('done').innerHTML = `<div class="done"><figure><img src="${esc(im.thumb || '')}" alt="${esc(t.common)}"><figcaption>${esc(im.artist || 'Unknown')}, ${esc(im.licence || '')}${im.page ? ` · <a href="${esc(im.page)}" target="_blank" rel="noopener">source</a>` : ''}</figcaption></figure>
      <div><div class="res">${won ? (ctx.mode === 'daily' ? 'Found, and added to Your Tree' : 'Found') : 'Out of deep time. The hidden animal was'}</div><h2>${esc(t.common)}</h2><div class="sn">${esc(t.sci)}</div>
      <div class="stats"><div><b>${g.length}</b><span>${g.length === 1 ? 'guess' : 'guesses'}</span></div><div><b>${fmt(left())}</b><span>Myr left</span></div><div><b>${esc(GROUP[t.group] || '')}</b><span>group</span></div></div>
      <p>Its line, going back: ${path(h).slice(0, -1).reverse().slice(0, 4).map(n => esc(nameOf(n))).join(' → ')}.</p>
      <div class="acts"><a class="btn" href="/tree#t=${esc(h)}" target="_blank" rel="noopener">See it in Scorcher Tree</a>${h !== 'homo-sapiens' ? `<a class="btn line" href="/tree#c=homo-sapiens,${esc(h)}" target="_blank" rel="noopener">Compare it with us</a>` : ''}${ctx.mode === 'daily' ? '<button class="btn line" id="share">Copy result</button>' : ''}<button class="btn line" id="again">Practice round</button></div></div></div>`;
    $('again').onclick = () => { start('practice'); scrollTo({ top: 0, behavior: 'smooth' }); };
    const sh = $('share'); if (sh) sh.onclick = () => { const txt = `Scorcher Evolve No. ${dayNum(ctx.day)}: ${won ? 'found' : 'not found'} in ${g.length} ${g.length === 1 ? 'guess' : 'guesses'}, ${fmt(left())} Myr left\n${g.map(x => x === h ? '🟥' : (a => a < 60 ? '🟧' : a < 180 ? '🟨' : a < 350 ? '🟦' : '⬛')(ageOf(mrca(x, h)).ma)).join('')}\nplayscorcher.com/evolve`;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { sh.textContent = 'Copied'; }, () => { sh.textContent = 'Could not copy'; }); };
  } else $('done').innerHTML = '';
  guide(); yours();
  if (fresh && done) $('done').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

function guide() {
  const g = ctx.rec.g, dim = $('dim').checked, wrong = g.filter(x => x !== ctx.hidden), possible = new Set(tips.filter(t => wrong.every(w => mrca(w, t) === mrca(w, ctx.hidden))));
  $('spp').innerHTML = ORDER.map(k => { const ids = tips.filter(t => T(t).group === k).sort((a, b) => T(a).common.localeCompare(T(b).common)); if (!ids.length) return '';
    return `<div class="grp"><h4>${GROUP[k]}</h4><div class="spp">${ids.map(t => `<button class="sp${g.includes(t) ? ' used' : dim && !possible.has(t) ? ' out' : ''}" data-id="${t}" title="${esc(T(t).sci)}"><img src="${esc(img(t))}" alt="" loading="lazy">${esc(T(t).common)}</button>`).join('')}</div></div>`; }).join('');
  $('spp').querySelectorAll('.sp').forEach(b => b.onclick = () => guess(b.dataset.id)); }

// Your Tree: the species found on daily rounds, drawn in their place in the synthesis
function yours() {
  const got = S.tree.filter(t => T(t)); $('ycount').textContent = `${got.length} of ${tips.length} animals`;
  if (!got.length) { $('ytree').innerHTML = '<div class="none">Find today’s animal to plant your first branch.</div>'; return; }
  const keep = new Set(); got.forEach(t => path(t).forEach(n => keep.add(n)));
  const build = id => { const ch = (kids[id] || []).filter(c => keep.has(c)).map(build); return ch.length === 1 && !T(id) ? ch[0] : { id, ch }; };
  const root = build(D.tree.id), rows = [], RH = 34; let depth = 0;
  (function lay(n, d) { n.d = d; depth = Math.max(depth, d); if (!n.ch.length) { n.y = rows.length * RH + 20; rows.push(n); } else { n.ch.forEach(c => lay(c, d + 1)); n.y = (n.ch[0].y + n.ch[n.ch.length - 1].y) / 2; } })(root, 0);
  const W = 860, labW = 260, X = d => 20 + d * ((W - labW - 40) / Math.max(1, depth)), H = rows.length * RH + 20;
  let s = ''; (function draw(n) { if (!n.ch.length) return; const x = X(n.d); n.ch.forEach(c => { const xc = c.ch.length ? X(c.d) : X(depth); s += `<path d="M${x} ${n.y}V${c.y}H${xc}" fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5"/>`; draw(c); });
    if (n.ch.length > 1) { const a = ageOf(n.id); s += `<rect x="${x - 4}" y="${n.y - 4}" width="8" height="8" fill="${heat(a.ma)}"/><text x="${x + 8}" y="${n.y - 7}" font-size="12.5" fill="currentColor" fill-opacity=".7" font-family="Jost, sans-serif">${esc(nameOf(n.id))}</text>`; } })(root);
  rows.forEach(n => { const t = T(n.id); s += `<a href="/tree#t=${esc(n.id)}" target="_blank" rel="noopener"><circle cx="${X(depth)}" cy="${n.y}" r="5" fill="#d63a1f"/><text x="${X(depth) + 14}" y="${n.y + 6}" font-size="19" fill="currentColor" font-family="'EB Garamond', serif">${esc(t.common)}</text></a>`; });
  $('ytree').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your Tree: the animals you have found">${s}</svg>`; }

// suggestions
let sel = -1;
function suggest() { const q = $('q').value.trim().toLowerCase(), box = $('sug'); if (!q) { box.hidden = true; return; }
  const hits = tips.filter(t => T(t).common.toLowerCase().includes(q) || T(t).sci.toLowerCase().includes(q)).sort((a, b) => T(a).common.toLowerCase().indexOf(q) - T(b).common.toLowerCase().indexOf(q)).slice(0, 8);
  sel = hits.length ? 0 : -1; box.hidden = !hits.length;
  box.innerHTML = hits.map((t, i) => `<li data-id="${t}" class="${i === sel ? 'on' : ''}${ctx.rec.g.includes(t) ? ' used' : ''}"><img src="${esc(img(t))}" alt=""><b>${esc(T(t).common)}</b><small class="sci">${esc(T(t).sci)}</small></li>`).join('');
  box.querySelectorAll('li').forEach(li => li.onmousedown = e => { e.preventDefault(); pick(li.dataset.id); }); }
function pick(id) { $('q').value = ''; $('sug').hidden = true; guess(id); $('q').focus(); }
$('q').oninput = suggest; $('q').onblur = () => setTimeout(() => { $('sug').hidden = true; }, 120);
$('q').onkeydown = e => { const li = [...$('sug').querySelectorAll('li')]; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!li.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + li.length) % li.length; li.forEach((x, i) => x.classList.toggle('on', i === sel)); }
  else if (e.key === 'Enter') { e.preventDefault(); if (li[sel]) pick(li[sel].dataset.id); } else if (e.key === 'Escape') $('sug').hidden = true; };
$('go').onclick = () => { const li = $('sug').querySelectorAll('li'); if (li[Math.max(0, sel)]) pick(li[Math.max(0, sel)].dataset.id); else $('q').focus(); };
$('dim').onchange = guide;
$('practice').onclick = () => { start('practice'); scrollTo({ top: 0, behavior: 'smooth' }); };

fetch('/treedata/vertebrates.json').then(r => r.json()).then(d => { D = d;
  (function walk(n) { kids[n.id] = (n.children || []).map(c => c.id); (n.children || []).forEach(c => { par[c.id] = n.id; walk(c); }); })(D.tree);
  tips = Object.keys(D.taxa).filter(t => kids[t] && !kids[t].length);
  window.EVOLVE = { mrca, ageOf, nameOf, dailyHidden, guess, get ctx() { return ctx; } };   // for tests
  start('daily');
}).catch(() => { $('plate').insertAdjacentHTML('beforeend', '<p>The tree data could not be loaded. Please try again later.</p>'); });
})();
