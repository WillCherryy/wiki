/* Scorcher Tree: the explorer. Reads treedata/vertebrates.json (built by tools/build-tree.js, rules in docs/tree-data.md) and draws it on a canvas:
   fluid zoom, collapsible clades, search, common-ancestor comparison, and an inspector that shows the evidence behind each branch.
   When enough nodes carry published ages it switches from branching order to a geological time axis by itself; it never draws an age that is not in the data. */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GROUP = { jawless: ['Jawless fishes', '#8b7d70'], cartilaginous: ['Cartilaginous fishes', '#6f8796'], rayfinned: ['Ray-finned fishes', '#5f8ea6'], lobefinned: ['Lobe-finned fishes', '#6c7d8c'], amphibian: ['Amphibians', '#6f9150'], mammal: ['Mammals', '#b0805a'], reptile: ['Reptiles', '#7d8f4f'], bird: ['Birds', '#b0603f'] };
const STATUS = { resolved: ['Resolved', 'res', 'Recent studies agree on this grouping.'], debated: ['Debated', 'deb', 'Published studies disagree. The competing answers are listed below.'], unresolved: ['Unresolved', 'unr', 'The data cannot yet decide the branching order here, so it is drawn as one split into several.'], pending: ['Not yet reviewed', 'pend', 'This branch follows the published synthesis but has not yet been reviewed here.'] };
const PER = [['Cambrian', 538.8, 486.9, '#c9d6b3'], ['Ordovician', 486.9, 443.1, '#b8d6c8'], ['Silurian', 443.1, 419.6, '#d6eadb'], ['Devonian', 419.6, 358.9, '#e6cfaa'], ['Carboniferous', 358.9, 298.9, '#c4dbd6'], ['Permian', 298.9, 251.9, '#efc0b4'], ['Triassic', 251.9, 201.4, '#d4bfd9'], ['Jurassic', 201.4, 143.1, '#bfe2ea'], ['Cretaceous', 143.1, 66, '#d2e8c0'], ['Paleogene', 66, 23.03, '#f6d5b8'], ['Neogene', 23.03, 2.58, '#f6efb0'], ['Quaternary', 2.58, 0, '#f4f2c8']];   // ICS International Chronostratigraphic Chart boundaries (Ma)
const START_COLLAPSED = ['teleostei', 'squamata', 'neoaves', 'laurasiatheria', 'euarchontoglires'];
const ICON = { search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' };

let D = null, root = null, byId = new Map(), rows = [], collapsed = new Set(START_COLLAPSED), sel = null, cmp = [], cmpMode = false, hover = null, timeMode = false, H = 1, maxAge = 1;
const cam = { rowH: 18, y: 0, tRowH: 18, tY: 0 };
const app = $('#txApp');
app.innerHTML = `<header class="tx-top"><a class="tx-brand" href="/tree"><span class="w">Scorch<b>er</b></span><span class="s">Tree</span></a>
  <div class="tx-search"><label>${ICON.search}<input id="txQ" type="search" placeholder="Search a species or group" autocomplete="off" spellcheck="false" aria-label="Search the tree"><kbd>/</kbd></label><div class="tx-res" id="txRes" hidden></div></div>
  <nav class="tx-nav"><button data-v="explore" class="on">Explorer</button><button data-v="compare" id="txCmpBtn" aria-pressed="false">Compare</button><button data-v="about" id="txAbout">About the data</button><a href="/sky">Sky</a></nav>
  <div class="tx-sel" id="txSel"></div></header>
<main class="tx-main" id="txMain"><canvas id="txCv" aria-label="Evolutionary tree. Scroll or pinch to zoom, drag to move, tap a species or branch point to inspect it."></canvas><div class="tx-crumbs" id="txCrumbs"></div><div class="tx-banner" id="txBanner" hidden></div><div class="tx-cmp" id="txCmp" hidden></div>
  <div class="tx-legend"><span><svg><circle cx="9" cy="6" r="4.5" fill="#fbf8f1" stroke="#c8401f" stroke-width="2"/></svg>Reviewed</span><span><svg><circle cx="9" cy="6" r="3.2" fill="#fbf8f1" stroke="#857c6e" stroke-width="1.5"/></svg>Not yet reviewed</span><span><svg><rect x="5" y="2" width="8" height="8" transform="rotate(45 9 6)" fill="#fbf8f1" stroke="#a86d12" stroke-width="1.8"/></svg>Debated</span><span><svg><path d="M3 6 L15 2 L15 10 Z" fill="#e7dfcf" stroke="#857c6e"/></svg>Group: tap to open</span></div>
  <div class="tx-zoom"><button id="txIn" aria-label="Zoom in">+</button><button id="txOut" aria-label="Zoom out">−</button><button id="txFit" aria-label="Fit the whole tree" style="font-size:13px">⤢</button></div><div class="tx-tip" id="txTip" hidden></div></main>
<aside class="tx-side" id="txSide" aria-live="polite"></aside>
<dialog class="tx-dlg" id="txDlg"><button class="x" aria-label="Close" onclick="this.closest('dialog').close()">×</button><div id="txDlgBody"></div></dialog>`;
const cv = $('#txCv'), main = $('#txMain'), g = cv.getContext('2d');
let W = 0, Hh = 0, dpr = 1;
const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = main.clientWidth; Hh = main.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); clampCam(true); dirty = true; };

/* ---------------- data */
const taxon = id => D.taxa[id], rec = id => D.nodes[id] || {}, isTip = n => !n.children;
const label = n => isTip(n) ? taxon(n.id).common : (rec(n.id).common || rec(n.id).name || 'Unnamed group');
const sciLabel = n => isTip(n) ? taxon(n.id).sci : (rec(n.id).name || '');
const colourOf = n => GROUP[taxon(isTip(n) ? n.id : n.tips[0]).group][1];
const dated = n => { const d = (rec(n.id).age || {}).display; return d && d.source !== 'bounded' ? d : null; };
function prepare() {
  (function f(n, p, depth) { n.parent = p; n.depth = depth; byId.set(n.id, n); if (n.children) { n.children.forEach(c => f(c, n, depth + 1)); n.tips = n.children.flatMap(c => c.tips || [c.id]); n.h = 1 + Math.max(...n.children.map(c => c.h)); } else n.h = 0; })(D.tree, null, 0);
  root = D.tree; H = root.h;
  const internal = [...byId.values()].filter(n => n.children), withAge = internal.filter(dated);
  timeMode = withAge.length >= internal.length * .6;   // only once most branch points have published ages
  if (timeMode) { (function age(n) { if (isTip(n)) return (n.age = 0); n.children.forEach(age); const d = dated(n); n.age = d ? (d.mid != null ? d.mid : d.lo) : Math.max(...n.children.map(c => c.age)) * 1.08 + 1; return n.age; })(root);
    (function down(n) { (n.children || []).forEach(c => { if (!isTip(c)) { c.age = Math.min(c.age, n.age); down(c); } }); })(root);   // estimates from different studies can put a midpoint just above its parent's: never draw time running backwards (the published interval bars are unchanged)
    maxAge = root.age * 1.06; }
}
const xOf = n => timeMode ? 1 - n.age / maxAge : 1 - n.h / H;   // 0 = root side, 1 = today
function layout() {
  rows = []; (function f(n) { if (isTip(n) || collapsed.has(n.id)) { n.row = rows.length; rows.push(n); return; } n.children.forEach(f); n.row = (n.children[0].row + n.children[n.children.length - 1].row) / 2; })(root);
  dirty = true;
}
const visible = n => { for (let p = n.parent; p; p = p.parent) if (collapsed.has(p.id)) return false; return true; };
const lineage = n => { const out = []; for (let p = n; p; p = p.parent) out.unshift(p); return out; };
const mrcaOf = (a, b) => { const A = new Set(lineage(a)); for (let p = b; p; p = p.parent) if (A.has(p)) return p; return root; };

/* ---------------- geometry and camera */
const TOP = 72, BOT = 64, phone = () => W < 560;
const labelW = () => phone() ? 128 : 250, X0 = () => 24, X1 = () => W - labelW() - 18;
const px = x01 => X0() + x01 * (X1() - X0()), py = row => TOP + cam.y + (row + .5) * cam.rowH;
const fitRowH = () => Math.max(3, (Hh - TOP - BOT) / Math.max(1, rows.length));
function clampCam(snap) { const minH = Math.min(fitRowH(), 64); cam.tRowH = Math.max(minH, Math.min(64, cam.tRowH)); const span = rows.length * cam.tRowH, room = Hh - TOP - BOT;
  cam.tY = span <= room ? (room - span) / 2 : Math.max(room - span - 20, Math.min(20, cam.tY)); if (snap) { cam.rowH = cam.tRowH; cam.y = cam.tY; } }
function zoomAt(f, sy) { const r = (sy - TOP - cam.tY) / cam.tRowH, nh = Math.max(Math.min(fitRowH(), 64), Math.min(64, cam.tRowH * f)); cam.tY = sy - TOP - r * nh; cam.tRowH = nh; clampCam(); }
function focusRow(row, rh) { cam.tRowH = Math.max(cam.tRowH, rh || 22); cam.tY = (Hh - TOP - BOT) / 2 - (row + .5) * cam.tRowH; clampCam(); }
const fit = () => { cam.tRowH = fitRowH(); clampCam(); };

/* ---------------- drawing */
const IMG = new Map(); const img = t => { if (!t.image) return null; let i = IMG.get(t.image.thumb); if (!i) { i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => { dirty = true; }; i.src = t.image.thumb; IMG.set(t.image.thumb, i); } return i.complete && i.naturalWidth ? i : null; };
let dirty = true;
const fitText = (t, w) => { if (g.measureText(t).width <= w) return t; let s = t; while (s.length > 2 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s.trimEnd() + '…'; };
function hot() {   // ids on highlighted paths: the selected species' lineage, or the two compared species back to their common ancestor
  const s = new Set(); if (cmp.length === 2) { const a = byId.get(cmp[0]), b = byId.get(cmp[1]), m = mrcaOf(a, b); [a, b].forEach(t => { for (let p = t; p && p !== m.parent; p = p.parent) s.add(p.id); }); return { s, m }; }
  const n = sel && byId.get(sel); if (n) { if (isTip(n)) lineage(n).forEach(p => s.add(p.id)); else { (function f(q) { s.add(q.id); (q.children || []).forEach(f); })(n); lineage(n).forEach(p => s.add(p.id)); } }
  return { s, m: null };
}
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  const { s: HOT, m: M } = hot(), anyHot = HOT.size > 0, rh = cam.rowH, x1 = px(1);
  const header = () => { g.fillStyle = '#f4efe4'; g.fillRect(0, 0, W, TOP - 22); g.fillStyle = '#ddd3c1'; g.fillRect(0, TOP - 23, X1() + labelW() + 18, 1);
  if (timeMode) { const tx = ma => px(1 - ma / maxAge); PER.forEach(([n, a, b]) => { const xa = Math.max(X0(), tx(a)), xb = tx(b); if (xb < X0()) return;
      g.font = '500 10px Jost, sans-serif'; const full = n.toUpperCase(), ab = n.slice(0, n === 'Paleogene' ? 5 : n === 'Quaternary' ? 1 : 3).toUpperCase() + '.', t = xb - xa > g.measureText(full).width + 10 ? full : xb - xa > g.measureText(ab).width + 6 ? ab : ''; if (t) { g.fillStyle = '#4b453b'; g.textAlign = 'center'; g.fillText(t, (xa + xb) / 2, TOP - 38); } });
    g.font = '400 10px "IBM Plex Mono", monospace'; g.fillStyle = '#857c6e'; g.textAlign = 'center'; const lw = g.measureText('500 Ma').width + 14, step = [50, 100, 200, 250, 500].find(st => Math.abs(tx(0) - tx(st)) >= lw) || 500;   // ticks never run together on a narrow screen
    for (let m = 0; m < maxAge; m += step) g.fillText(m ? m + ' Ma' : 'Today', tx(m), TOP - 26); }
  else { g.fillStyle = '#857c6e'; g.font = '500 10px Jost, sans-serif'; g.textAlign = 'left'; g.fillText('BRANCHING ORDER', X0(), TOP - 30); g.font = '400 11px Jost, sans-serif'; g.fillStyle = '#a39a8b'; if (!phone()) g.fillText('Earlier splits to the left · branch lengths carry no time; published ages are written on the branch points', X0() + 112, TOP - 30);
    g.textAlign = 'right'; g.fillStyle = '#857c6e'; g.font = '500 10px Jost, sans-serif'; g.fillText('LIVING SPECIES', x1 + labelW() - 4, TOP - 30); } };
  if (timeMode) { const tx = ma => px(1 - ma / maxAge); PER.forEach(([, a, b, c], i) => { const xa = Math.max(X0(), tx(a)), xb = tx(b); if (xb < X0()) return; g.fillStyle = c; g.globalAlpha = i % 2 ? .28 : .42; g.fillRect(xa, TOP - 22, xb - xa, Hh - TOP - BOT + 42); g.globalAlpha = 1; }); }   // geological periods behind the tree
  const y0 = -rh * 2, y1 = Hh + rh * 2, inView = y => y > y0 && y < y1;
  // branches
  g.lineCap = 'round';
  (function br(n) { if (isTip(n) || collapsed.has(n.id)) return; const x = px(xOf(n)), y = py(n.row), ys = n.children.map(c => py(c.row)), top = Math.min(...ys), bot = Math.max(...ys);
    if (bot < y0 || top > y1) { n.children.forEach(br); return; }
    n.children.forEach(c => { const on = HOT.has(c.id) && HOT.has(n.id), cy = py(c.row), cx = isTip(c) || collapsed.has(c.id) ? (collapsed.has(c.id) ? px(xOf(c)) : x1) : px(xOf(c));
      g.strokeStyle = on ? '#c8401f' : anyHot ? 'rgba(26,23,18,.22)' : 'rgba(26,23,18,.62)'; g.lineWidth = on ? 2.4 : 1.25; g.beginPath(); g.moveTo(x, y); g.lineTo(x, cy); g.lineTo(cx, cy); g.stroke(); br(c); }); })(root);
  // collapsed groups: a wedge with a count
  rows.forEach(n => { if (isTip(n)) return; const y = py(n.row); if (!inView(y)) return; const x = px(xOf(n)), hw = Math.max(3, Math.min(rh * .38, 14)), on = HOT.has(n.id);
    g.fillStyle = on ? 'rgba(200,64,31,.14)' : '#e7dfcf'; g.strokeStyle = on ? '#c8401f' : 'rgba(26,23,18,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y - hw); g.lineTo(x1, y + hw); g.closePath(); g.fill(); g.stroke(); });
  // branch points
  const markers = [];
  (function mk(n) { if (isTip(n)) return; const x = px(xOf(n)), y = py(n.row); if (inView(y)) { const r = rec(n.id), st = (r.relationship || {}).status, isSel = sel === n.id || (M && M.id === n.id), dim = anyHot && !HOT.has(n.id);
      const d = (r.age || {}).display; if (timeMode && d && d.source !== 'bounded') { g.strokeStyle = r.review === 'reviewed' ? 'rgba(200,64,31,.5)' : 'rgba(133,124,110,.45)'; g.lineWidth = 5; g.beginPath(); g.moveTo(px(1 - d.hi / maxAge), y); g.lineTo(px(1 - d.lo / maxAge), y); g.stroke(); }
      g.globalAlpha = dim ? .35 : 1; g.fillStyle = '#fbf8f1';
      if (st === 'debated') { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.strokeStyle = '#a86d12'; g.lineWidth = 1.8; g.fillRect(-4, -4, 8, 8); g.strokeRect(-4, -4, 8, 8); g.restore(); }
      else { g.strokeStyle = r.review === 'reviewed' ? '#c8401f' : '#857c6e'; g.lineWidth = r.review === 'reviewed' ? 2 : 1.5; g.beginPath(); g.arc(x, y, r.review === 'reviewed' ? 4.5 : 3.3, 0, 7); g.fill(); g.stroke(); }
      if (isSel) { g.strokeStyle = 'rgba(200,64,31,.3)'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 11, 0, 7); g.stroke(); }
      if (hover === n.id) { g.strokeStyle = '#1a1712'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 8, 0, 7); g.stroke(); }
      g.globalAlpha = 1; markers.push({ n, x, y }); }
    if (!collapsed.has(n.id)) n.children.forEach(mk); })(root);
  // clade names where there is room (named groups only, no overlaps)
  const plate = (bx, by, w, fs) => { g.fillStyle = 'rgba(244,239,228,.88)'; g.beginPath(); if (g.roundRect) g.roundRect(bx - 3, by - fs * .82, w + 6, fs * 1.18, 3); else g.rect(bx - 3, by - fs * .82, w + 6, fs * 1.18); g.fill(); };   // a soft backing so branch lines never strike through a label
  const taken = []; g.font = '500 9.5px Jost, sans-serif'; g.textAlign = 'left';
  markers.forEach(({ n, x, y }) => { const r = rec(n.id); if (!r.name || collapsed.has(n.id)) return; const span = (n.children[n.children.length - 1].row - n.children[0].row) * rh; if (span < 46) return;
    const t = r.name.toUpperCase().split('').join(String.fromCharCode(8202)), w = g.measureText(t).width, bx = x + 8, by = y - 7; if (bx + w > x1 - 6) return; if (taken.some(b => bx < b[0] + b[2] && bx + w > b[0] && Math.abs(by - b[1]) < 12)) return;
    taken.push([bx, by, w]); plate(bx, by, w, 9.5); g.fillStyle = anyHot && !HOT.has(n.id) ? 'rgba(75,69,59,.35)' : '#4b453b'; g.fillText(t, bx, by); });
  // ages on branch points that have published evidence: a fossil bracket, or a fossil minimum alone
  g.font = '400 10px "IBM Plex Mono", monospace';
  markers.forEach(({ n, x, y }) => { if (collapsed.has(n.id) || rh < 9) return; const a = rec(n.id).age || {}, d = a.display; let t = '';
    if (d && d.source !== 'bounded') t = d.lo != null && d.hi != null && d.lo !== d.hi ? `${+d.lo.toFixed(1)}–${+d.hi.toFixed(1)} Ma` : `${+(d.mid != null ? d.mid : d.lo).toFixed(1)} Ma`; else if (a.fossilMin) t = `≥ ${+a.fossilMin.ma.toFixed(1)} Ma`; if (!t) return;
    const w = g.measureText(t).width, bx = x + 8, by = y + 13; if (bx + w > x1 - 6 || taken.some(b => bx < b[0] + b[2] && bx + w > b[0] && Math.abs(by - b[1]) < 11)) return; taken.push([bx, by, w]);
    g.textAlign = 'left'; plate(bx, by, w, 10); g.fillStyle = anyHot && !HOT.has(n.id) ? 'rgba(138,90,43,.35)' : '#8a5a2b'; g.fillText(t, bx, by); });
  // tips and collapsed labels
  const showLbl = rh >= 11, fs = Math.max(11, Math.min(16, rh * .66)), showSci = rh >= 28, tr = Math.max(2.5, Math.min(12, rh * .36));
  rows.forEach(n => { const y = py(n.row); if (!inView(y)) return; const on = HOT.has(n.id), dim = anyHot && !on, c = colourOf(n);
    g.globalAlpha = dim ? .38 : 1;
    if (isTip(n)) { const t = taxon(n.id), im = img(t), cx = x1 + 6 + tr; g.fillStyle = c; g.beginPath(); g.arc(cx, y, tr, 0, 7); g.fill(); if (im && tr > 6) { g.save(); g.beginPath(); g.arc(cx, y, tr, 0, 7); g.clip(); const s = tr * 2, k = Math.max(s / im.naturalWidth, s / im.naturalHeight); g.drawImage(im, cx - im.naturalWidth * k / 2, y - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); g.restore(); }
      if (sel === n.id || cmp.includes(n.id)) { g.strokeStyle = '#c8401f'; g.lineWidth = 2; g.beginPath(); g.arc(cx, y, tr + 3, 0, 7); g.stroke(); }
      if (showLbl) { g.textAlign = 'left'; g.fillStyle = on && (sel === n.id || cmp.includes(n.id)) ? '#c8401f' : '#1a1712'; g.font = `400 ${fs}px "EB Garamond", Georgia, serif`; const lx = cx + tr + 7, room = W - lx - 14; g.fillText(fitText(t.common, room), lx, showSci ? y - 1 : y + fs * .33);
        if (showSci) { g.fillStyle = '#857c6e'; g.font = `italic 400 ${Math.max(11, fs * .78)}px "EB Garamond", Georgia, serif`; g.fillText(fitText(t.sci, room), lx, y + fs * .82); } } }
    else if (showLbl) { const r = rec(n.id); g.textAlign = 'left'; g.fillStyle = '#1a1712'; g.font = `500 ${Math.max(11, Math.min(14, rh * .6))}px Jost, sans-serif`; const lx = x1 + 8; g.fillText(r.common || r.name || 'Group', lx, y + 4);
      const w = g.measureText(r.common || r.name || 'Group').width; g.fillStyle = '#857c6e'; g.font = `400 ${Math.max(10, Math.min(12, rh * .5))}px Jost, sans-serif`; g.fillText(`${n.tips.length} species`, lx + w + 8, y + 4); }
    g.globalAlpha = 1; });
  // a strip of colour per major group at the far right, named when the labels are too small to read
  let run = null; const strip = W - 8, flush = () => { if (!run) return; const ya = py(run.a) - rh / 2 + 1, yb = py(run.b) + rh / 2 - 1; g.fillStyle = GROUP[run.k][1]; g.fillRect(strip, ya, 4, yb - ya);
    if (!showLbl && yb - ya > 24) { g.font = '500 11px Jost, sans-serif'; g.textAlign = 'right'; g.fillStyle = GROUP[run.k][1]; g.fillText(GROUP[run.k][0], strip - 8, (ya + yb) / 2 + 4); } };
  rows.forEach(n => { const k = taxon(isTip(n) ? n.id : n.tips[0]).group; if (run && run.k === k) run.b = n.row; else { flush(); run = { k, a: n.row, b: n.row }; } }); flush();
  header(); draw.markers = markers;
}
(function loop() { const k = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : .2; const dy = cam.tY - cam.y, dh = cam.tRowH - cam.rowH;
  if (Math.abs(dy) > .3 || Math.abs(dh) > .01) { cam.y += dy * k; cam.rowH += dh * k; dirty = true; } else if (dy || dh) { cam.y = cam.tY; cam.rowH = cam.tRowH; dirty = true; }
  if (dirty && D) { dirty = false; draw(); } requestAnimationFrame(loop); })();

/* ---------------- interaction */
function hitTest(x, y) {
  for (const m of draw.markers || []) if (Math.hypot(m.x - x, m.y - y) < 10) return m.n;
  const r = Math.floor((y - TOP - cam.y) / cam.rowH), n = rows[r]; if (!n) return null;
  if (x > px(1) - 12) return n; if (!isTip(n) && x > px(xOf(n)) - 6 && Math.abs(py(n.row) - y) < Math.max(8, cam.rowH * .4)) return n; return null;
}
const ptr = new Map(); let drag = null, pinch = 0, lastTap = 0, lastId = null;
cv.addEventListener('pointerdown', e => { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch {} if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.abs(a.y - b.y) + 20; drag = null; } else drag = { y: e.clientY, cy: cam.tY, moved: false }; });
cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (ptr.has(e.pointerId)) { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.abs(a.y - b.y) + 20; if (pinch) zoomAt(d / pinch, (a.y + b.y) / 2 - r.top); pinch = d; return; }
    if (drag) { const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) { drag.moved = true; cv.classList.add('drag'); } if (drag.moved) { cam.tY = drag.cy + dy; clampCam(); cam.y = cam.tY; dirty = true; } return; } }
  const n = hitTest(x, y), id = n ? n.id : null; if (id !== hover) { hover = id; dirty = true; cv.classList.toggle('hot', !!n); }
  const tip = $('#txTip'); if (n && !isTip(n)) { const r2 = rec(n.id); tip.innerHTML = `<b>${esc(r2.common || r2.name || 'Branch point')}</b>${n.tips.length} species${collapsed.has(n.id) ? ' · tap to open' : ''}`; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false; } else tip.hidden = true; });
cv.addEventListener('pointerup', e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0; cv.classList.remove('drag'); const d = drag; drag = null; if (!d || d.moved) return;
  const n = hitTest(x, y), now = performance.now(); if (!n) { if (!cmpMode) { sel = null; showWelcome(); setHash(); dirty = true; } return; }
  if (!isTip(n) && (collapsed.has(n.id) || (now - lastTap < 320 && lastId === n.id))) { toggle(n.id); lastTap = 0; return; } lastTap = now; lastId = n.id;
  if (isTip(n) && cmpMode) return addCompare(n.id); select(n.id); });
cv.addEventListener('pointerleave', () => { hover = null; $('#txTip').hidden = true; dirty = true; });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) zoomAt(Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * .0022), e.clientY - r.top); }, { passive: false });
$('#txIn').onclick = () => zoomAt(1.6, Hh / 2); $('#txOut').onclick = () => zoomAt(1 / 1.6, Hh / 2); $('#txFit').onclick = fit;
function toggle(id) { const n = byId.get(id); if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); layout(); clampCam(); focusRow(n.row, cam.tRowH); if (sel === id) showNode(n); }
function reveal(n) { for (let p = n.parent; p; p = p.parent) collapsed.delete(p.id); layout(); }

/* ---------------- inspector */
const side = $('#txSide');
const badge = st => { const s = STATUS[st] || STATUS.pending; return `<span class="tx-badge ${s[1]}">${s[0]}</span>`; };
const pathHTML = (list, cls = '') => `<div class="tx-path ${cls}">${list.map((p, i) => `${i ? '<span>›</span>' : ''}<button data-go="${p.id}">${esc(rec(p.id).name || label(p))}</button>`).join('')}</div>`;
const mya = v => +(+v).toFixed(2) + ' Ma';   // as published, never rounded away
function periodAt(ma) { const p = PER.find(([, a, b]) => ma <= a && ma > b) || PER[PER.length - 1]; return p[0]; }
function ageChart(a, d) {   // a small timeline: geological periods behind, the fossil minimum, the soft maximum, the bracket and any clock estimates
  const vals = [a.fossilMin && a.fossilMin.ma, a.softMax && a.softMax.ma, d && d.lo, d && d.hi, ...(a.clock || []).flatMap(c => [c.lo, c.hi])].filter(v => v != null); if (!vals.length) return '';
  const span = Math.max(...vals) - Math.min(...vals), hi = Math.max(...vals) + Math.max(4, span * .35), lo = Math.max(0, Math.min(...vals) - Math.max(4, span * .35)), W = 360, x = m => 10 + (hi - m) / (hi - lo) * (W - 20);
  let s = '', y = 30; PER.forEach(([nm, pa, pb, c]) => { const xa = x(Math.min(pa, hi)), xb = x(Math.max(pb, lo)); if (pb >= hi || pa <= lo) return; s += `<rect x="${xa}" y="14" width="${xb - xa}" height="200" fill="${c}" opacity=".55"/>`; if (xb - xa > nm.length * 6) s += `<text x="${(xa + xb) / 2}" y="10" font-family="Jost" font-size="9" letter-spacing="1" fill="#857c6e" text-anchor="middle">${nm.toUpperCase()}</text>`; });
  if (d && d.lo != null && d.hi != null) { s += `<line x1="${x(d.hi)}" x2="${x(d.lo)}" y1="${y}" y2="${y}" stroke="#1a1712" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"${d.source === 'bounded' ? ' stroke-dasharray="1 6"' : ''}/>`; y += 18; }
  if (a.fossilMin) { s += `<line x1="${x(a.fossilMin.ma)}" x2="${x(lo)}" y1="${y}" y2="${y}" stroke="#8a5a2b" stroke-dasharray="2 3" stroke-width="1.5"/><rect x="${x(a.fossilMin.ma) - 5}" y="${y - 5}" width="10" height="10" transform="rotate(45 ${x(a.fossilMin.ma)} ${y})" fill="#8a5a2b"/>`; y += 18; }
  if (a.softMax) { s += `<line x1="${x(a.softMax.ma)}" x2="${x(a.softMax.ma)}" y1="${y - 7}" y2="${y + 7}" stroke="#5d7a3a" stroke-width="2"/><line x1="${x(a.softMax.ma)}" x2="${x(a.softMax.ma) + 22}" y1="${y}" y2="${y}" stroke="#5d7a3a" stroke-dasharray="2 3" stroke-width="1.5"/>`; y += 18; }
  (a.clock || []).forEach(c => { s += `<line x1="${x(c.hi)}" x2="${x(c.lo)}" y1="${y}" y2="${y}" stroke="#2f5f8f" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>${c.mid != null ? `<circle cx="${x(c.mid)}" cy="${y}" r="3.5" fill="#2f5f8f"/>` : ''}`; y += 18; });
  const ticks = [hi, (hi + lo) / 2, lo].map(m => `<text x="${x(m)}" y="${y + 6}" font-family="IBM Plex Mono" font-size="9.5" fill="#857c6e" text-anchor="${m === hi ? 'start' : m === lo ? 'end' : 'middle'}">${m < 1 ? 'Today' : (m >= 100 ? Math.round(m) : +m.toFixed(1)) + ' Ma'}</text>`).join('');
  return `<svg class="tx-chart" viewBox="0 0 ${W} ${y + 10}" role="img" aria-label="Age evidence on a geological timeline">${s.replace(/height="200"/g, `height="${y - 22}"`)}${ticks}</svg>`;
}
function agesHTML(n) {
  const a = rec(n.id).age || {}, d = a.display, cites = D.citations || {};
  const src = (c, chk) => { const k = c && cites[c]; if (!k) return ''; return `${esc(k.authors.split(/,|&/)[0].trim())}${/,|&/.test(k.authors) ? ' et al.' : ''} ${esc(k.year)}${k.verified ? '' : ' <em class="uv" title="The DOI has not yet been checked against Crossref and the value not yet checked by a reviewer">unverified</em>'}${chk && /^https?:/.test(chk) ? ` · <a href="${esc(chk)}" target="_blank" rel="noopener">checked here</a>` : ''}`; };
  const row = (col, shape, name, desc, val) => `<div class="tx-ev"><i style="background:${col};${shape}"></i><span><b>${name}</b><small>${desc}</small></span><span class="v ${val ? '' : 'none'}">${val || 'not yet sourced'}</span></div>`;
  const fm = a.fossilMin, sm = a.softMax, cl = a.clock || [], ch = a.challenge;
  const kind = c => c.cite === 'kumar2022' ? `TimeTree synthesis of ${c.studies || 'several'} studies (confidence interval of the median)` : /HPD|credib/i.test(c.method || '') ? '95% interval of one study' : 'one study';
  const dc = d && cl.find(c => c.lo === d.lo && c.hi === d.hi);
  const drawn = d ? (d.source === 'bounded' ? (d.lo != null || d.hi != null ? `No published age for this split itself. Its relatives bound it: ${d.lo != null ? 'at least ' + mya(d.lo) : ''}${d.lo != null && d.hi != null ? ', ' : ''}${d.hi != null ? 'no more than ' + mya(d.hi) : ''}.` : '') : d.source === 'calibration' ? `A fossil calibration bracket: between the oldest accepted fossil and the soft maximum, in the ${periodAt(d.lo)}${periodAt(d.hi) !== periodAt(d.lo) ? ' to ' + periodAt(d.hi) : ''}. It constrains the age; it is not an estimate of it.` : d.source === 'review' ? 'Chosen in the evidence review.' : dc && dc.cite === 'kumar2022' ? `TimeTree's synthesis: the median of ${dc.studies || 'several'} published estimates${d.mid != null ? ', ' + mya(d.mid) : ''}, with the confidence interval of that median, ${mya(d.lo)}–${mya(d.hi)}. It summarises the literature; it is not a single study's uncertainty${fm ? '. The fossil minimum is a separate, independent constraint' : ''}.` : `A published molecular-clock estimate${d.mid != null ? ' of ' + mya(d.mid) : ''}, with its 95% interval of ${mya(d.lo)}–${mya(d.hi)}${fm ? '. The fossil minimum above is a separate, independent constraint' : ''}.`) : '';
  return `${ageChart(a, d)}<div class="tx-ages">${row('#8a5a2b', 'transform:rotate(45deg)', 'Fossil minimum', fm ? `${fm.taxon ? `<i>${esc(fm.taxon)}</i>${fm.formation ? ', ' + esc(fm.formation) : ''} · ` : ''}${fm.dating ? esc(fm.dating) + ' · ' : ''}${src(fm.cite, fm.checked)}${fm.note ? `<span class="tx-caveat">${esc(fm.note)}</span>` : ''}${ch ? `<span class="tx-caveat"><b>Challenged:</b> ${esc(ch.taxon)}, ${esc(ch.formation)} (${esc(ch.dating)}) · ${src(ch.cite, ch.checked)}. ${esc(ch.note || '')}</span>` : ''}` : 'The oldest accepted fossil of the group', fm && '≥ ' + mya(fm.ma))}
    ${row('#5d7a3a', '', 'Soft maximum', sm ? `${esc(sm.basis || '')} · ${src(sm.cite, sm.checked)}` : 'Older, well-sampled rocks where the group is absent', sm && '≤ ' + mya(sm.ma))}
    ${row('#2f5f8f', 'border-radius:50%', 'Molecular clocks', cl.length ? cl.map(c => `${c.mid != null ? `<b>${mya(c.mid)}</b> ` : ''}(${mya(c.lo)}–${mya(c.hi)}) · ${src(c.cite, c.checked)} · ${kind(c)}${c.note ? `<span class="tx-caveat">${esc(c.note)}</span>` : ''}`).join('<br>') : 'Published estimates from DNA, calibrated with fossils', cl.length && `${mya(Math.min(...cl.map(c => c.lo)))}–${mya(Math.max(...cl.map(c => c.hi)))}`)}</div>
    ${drawn ? `<p class="tx-drawn">${drawn}</p>` : ''}`;
}
const ageCount = () => Object.values(D.nodes).filter(r => r.age && (r.age.fossilMin || r.age.softMax || (r.age.clock || []).length)).length;
function showWelcome() {
  side.classList.remove('open');
  side.innerHTML = `<div class="tx-grab"></div><div class="tx-eye">The evolutionary tree</div><h1>How every vertebrate <i>is related</i></h1>
    <p class="tx-lede">${Object.keys(D.taxa).length} species chosen to span every major lineage, from hagfish to humans, placed by the published synthesis of evolutionary relationships. Every branch point will carry the evidence behind it.</p>
    <ol class="tx-how"><li><span><b>Tap a species</b> to see where it sits and who its closest relatives are.</span></li><li><span><b>Tap a branch point</b> for the group it founds and the evidence for it. <b>Tap a triangle</b> to open a group.</span></li><li><span><b>Compare</b> any two species to find their last common ancestor.</span></li><li><span><b>Scroll or pinch</b> to zoom; drag to move; <kbd>/</kbd> to search.</span></li></ol>
    <div class="tx-acts"><button class="p" data-ex="homo-sapiens,gallus-gallus">Human and chicken</button><button data-ex="balaenoptera-musculus,hippopotamus-amphibius">Whale and hippo</button><button data-ex="latimeria-chalumnae,homo-sapiens">Coelacanth and human</button></div>
    ${D.status === 'draft' ? `<div class="tx-note"><b>Work in progress.</b> The branching is a conservative hand-curated draft until it is rebuilt from the Open Tree of Life synthesis; where a split is debated or unchecked, it is left unresolved. ${ageCount()} branch points carry published fossil evidence so far (look for the brown ages on the tree), each awaiting a DOI check and review. Nothing is guessed.</div>` : ''}`;
  bindSide(); $$('[data-ex]', side).forEach(b => b.onclick = () => { const [a, c] = b.dataset.ex.split(','); setCompare([a, c]); });
}
function showTaxon(n) {
  const t = taxon(n.id), sib = n.parent.children.filter(c => c !== n), rel = sib.flatMap(c => c.tips || [c.id]).slice(0, 8), anc = lineage(n).slice(0, -1).filter(p => rec(p.id).name);
  side.innerHTML = `<div class="tx-grab"></div><div class="tx-eye">Species · ${esc(GROUP[t.group][0])}</div><h1>${esc(t.common)}</h1><p class="tx-sci">${esc(t.sci)}</p>
    <div class="tx-photo" style="--c:${GROUP[t.group][1]}">${t.image ? `<img src="${esc(t.image.thumb)}" alt="${esc(t.common)}">` : '<span class="ph">Photograph to come from Wikimedia Commons, credited</span>'}</div>${t.image ? `<p class="tx-credit">Photo: ${esc(t.image.credit || t.image.artist)} · <a href="${esc(t.image.licenceUrl || t.image.page)}" target="_blank" rel="noopener">${esc(t.image.licence)}</a> · <a href="${esc(t.image.page)}" target="_blank" rel="noopener">source</a></p>` : ''}
    <h3>Closest relatives here <em>${rel.length === 1 ? 'its sister species' : 'its sister group'}</em></h3><div class="tx-members">${rel.map(id => `<button data-go="${id}">${esc(taxon(id).common)}</button>`).join('')}</div>
    ${(() => { const p = n.parent, d = (rec(p.id).age || {}).display, fm = (rec(p.id).age || {}).fossilMin; if (!d && !fm) return ''; const pn = rec(p.id).name || 'its parent group'; const t = d && d.source !== 'bounded' ? `between ${mya(d.lo)} and ${mya(d.hi)} (${d.source === 'calibration' ? 'a fossil bracket' : 'a molecular-clock interval'})` : d && (d.lo != null || d.hi != null) ? `${d.lo != null ? 'at least ' + mya(d.lo) : ''}${d.lo != null && d.hi != null ? ' and ' : ''}${d.hi != null ? 'no more than ' + mya(d.hi) : ''}` : 'not yet dated'; return `<h3>When it split from them</h3><p style="margin:0;font-size:13.5px;color:var(--ink2)">At ${esc(pn)}: ${t}. <button class="tx-inline" data-go="${p.id}">See the evidence</button></p>`; })()}
    <h3>Its lineage <em>from the root of the tree</em></h3>${pathHTML(anc)}
    <div class="tx-acts"><button class="p" data-act="cmp">Compare with…</button><a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(t.sci)}" target="_blank" rel="noopener">Wikipedia ↗</a>${t.ott ? `<a href="https://tree.opentreeoflife.org/opentree/argus/ottol@${t.ott}" target="_blank" rel="noopener">Open Tree ↗</a>` : ''}</div>`;
  bindSide(); $('[data-act="cmp"]', side).onclick = () => { setCompareMode(true); cmp = [n.id]; drawCmp(); dirty = true; };
}
function showNode(n) {
  const r = rec(n.id), rel = r.relationship || {}, st = STATUS[rel.status] || STATUS.pending, nm = r.common || r.name || 'Unnamed branch point';
  side.innerHTML = `<div class="tx-grab"></div><div class="tx-eye">Branch point ${badge(rel.status)}${r.review === 'reviewed' ? '<span class="tx-badge rev">Reviewed</span>' : ''}</div><h1>${esc(nm)}</h1>${r.common && r.name ? `<p class="tx-sci">${esc(r.name)}</p>` : ''}
    ${r.blurb ? `<p class="tx-lede">${esc(r.blurb)}</p>` : `<p class="tx-lede">The last common ancestor of ${n.tips.length} species in this tree, and all its descendants.</p>`}
    <h3>Relationship <em>Is this group real?</em></h3><p style="margin:0 0 8px;font-size:13px;color:var(--ink2)">${esc(rel.note || st[2])}</p>
    ${(rel.support || []).map(s => `<dl class="tx-kv"><dt>${esc(s.metric)}</dt><dd>${esc(s.value)} <small style="color:var(--mute)">${esc(s.data || '')}</small></dd></dl>`).join('')}
    ${(rel.competing || []).map(h => `<div class="tx-hyp"><b>${esc(h.name)}</b><p>${esc(h.summary)}</p>${h.cite ? '' : '<small>Citation to be added</small>'}</div>`).join('')}
    <h3>Age <em>When did the lineages split?</em></h3>${agesHTML(n)}
    <details class="tx-fold"><summary>Why three kinds of age?</summary><p>A fossil gives a <b>minimum</b>: the group must be at least as old as its oldest member. Older rocks where it is absent suggest a soft <b>maximum</b>. <b>Molecular clocks</b> estimate the split from DNA differences, calibrated with fossils. Scorcher Tree keeps all three apart and never merges them into a number nobody published.</p></details>
    <h3>In this group <em>${n.tips.length} species</em></h3><div class="tx-members">${n.tips.slice(0, 24).map(id => `<button data-go="${id}">${esc(taxon(id).common)}</button>`).join('')}${n.tips.length > 24 ? `<button data-act="open">+ ${n.tips.length - 24} more</button>` : ''}</div>
    <h3>Lineage</h3>${pathHTML(lineage(n).filter(p => rec(p.id).name || p === n))}
    <div class="tx-acts"><button class="p" data-act="open">${collapsed.has(n.id) ? 'Open this group' : 'Zoom to this group'}</button><button data-act="fold">${collapsed.has(n.id) ? 'Keep closed' : 'Close this group'}</button></div>`;
  bindSide();
  $$('[data-act="open"]', side).forEach(b => b.onclick = () => { if (collapsed.has(n.id)) toggle(n.id); const a = byId.get(n.tips[0]), z = byId.get(n.tips[n.tips.length - 1]); reveal(n); cam.tRowH = Math.min(40, Math.max(fitRowH(), (Hh - TOP - BOT) / (z.row - a.row + 3))); focusRow((a.row + z.row) / 2, cam.tRowH); showNode(n); });
  $('[data-act="fold"]', side).onclick = () => toggle(n.id);
}
function showCompare() {
  const a = byId.get(cmp[0]), b = byId.get(cmp[1]), m = mrcaOf(a, b), r = rec(m.id), ta = taxon(a.id), tb = taxon(b.id), nm = r.common || r.name || 'an unnamed ancestor';
  side.innerHTML = `<div class="tx-grab"></div><div class="tx-eye">Last common ancestor</div><h1>${esc(ta.common)} <i>&amp;</i> ${esc(tb.common)}</h1>
    <p class="tx-lede">Follow both highlighted lines back until they meet. They last shared an ancestor at <b>${esc(nm)}</b>${r.name && r.common ? ` (${esc(r.name)})` : ''}, the founder of a group of ${m.tips.length} species in this tree.</p>
    ${r.blurb ? `<p style="font-size:13.5px;color:var(--ink2);margin:0 0 6px">${esc(r.blurb)}</p>` : ''}
    <h3>When <em>${badge((r.relationship || {}).status)}</em></h3>${agesHTML(m)}
    <h3>From the ancestor to each</h3>${pathHTML(lineage(a).slice(lineage(m).length - 1).filter(p => rec(p.id).name || p === a))}<div style="height:6px"></div>${pathHTML(lineage(b).slice(lineage(m).length - 1).filter(p => rec(p.id).name || p === b))}
    <details class="tx-fold" open><summary>How to read this</summary><p>The meeting point is their most recent common ancestor: not a modern animal, and neither species descends from the other. Both have been evolving separately ever since.</p></details>
    <div class="tx-acts"><button class="p" data-go="${m.id}">Open ${esc(r.name || 'the ancestor')}</button><button data-act="swap">Change species</button></div>`;
  bindSide(); $('[data-act="swap"]', side).onclick = () => { cmp = []; setCompareMode(true); drawCmp(); dirty = true; };
}
function bindSide() { $$('[data-go]', side).forEach(b => b.onclick = () => { const n = byId.get(b.dataset.go); reveal(n); select(n.id, true); }); const gb = $('.tx-grab', side); if (gb) gb.onclick = () => side.classList.toggle('open'); side.scrollTop = 0; }
function select(id, center) { const n = byId.get(id); if (!n) return; if (!visible(n)) reveal(n); sel = id; if (cmp.length === 2 && !cmpMode) cmp = []; drawCmp(); if (isTip(n)) showTaxon(n); else showNode(n); if (center) focusRow(n.row); setHash(); dirty = true; }

/* ---------------- compare */
function setCompareMode(on) { cmpMode = on; $('#txCmpBtn').classList.toggle('on', on); $('#txCmpBtn').setAttribute('aria-pressed', on); if (on && cmp.length === 2) cmp = []; drawCmp(); }
function addCompare(id) { if (cmp.includes(id)) return; cmp.push(id); if (cmp.length > 2) cmp = cmp.slice(-2); if (cmp.length === 2) { cmpMode = false; $('#txCmpBtn').classList.remove('on'); sel = null; finishCompare(); } drawCmp(); dirty = true; }
function setCompare(ids) { cmp = ids.slice(0, 2); cmpMode = false; $('#txCmpBtn').classList.remove('on'); sel = null; finishCompare(); drawCmp(); }
function finishCompare() { const [a, b] = cmp.map(i => byId.get(i)); reveal(a); reveal(b); showCompare(); const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row); cam.tRowH = Math.max(fitRowH(), Math.min(30, (Hh - TOP - BOT) / (hi - lo + 4))); focusRow((lo + hi) / 2, cam.tRowH); setHash(); dirty = true; }
function drawCmp() { const box = $('#txCmp'); if (!cmpMode && cmp.length < 2) { box.hidden = true; return; } box.hidden = false;
  const chip = id => { const t = taxon(id); return `<span class="tx-chip" style="--c:${GROUP[t.group][1]}"><i${t.image ? ` style="background-image:url('${esc(t.image.thumb)}')"` : ''}></i>${esc(t.common)}<button class="x" data-rm="${id}" aria-label="Remove">×</button></span>`; };
  box.innerHTML = [0, 1].map(i => cmp[i] ? chip(cmp[i]) : `<span class="tx-chip empty"><i></i>${cmpMode ? (i === cmp.length ? 'Tap a species or search' : 'then another') : ''}</span>`).join('<span style="color:var(--mute);font-size:12px">and</span>') + (cmpMode ? '<button class="tx-chip" id="txCmpX" style="padding:5px 12px">Cancel</button>' : '');
  $$('[data-rm]', box).forEach(b => b.onclick = () => { cmp = cmp.filter(x => x !== b.dataset.rm); setCompareMode(true); dirty = true; if (!cmp.length) showWelcome(); });
  const x = $('#txCmpX'); if (x) x.onclick = () => { cmp = []; setCompareMode(false); dirty = true; showWelcome(); }; }
$('#txCmpBtn').onclick = () => { setCompareMode(!cmpMode); if (!cmpMode && cmp.length < 2) { cmp = []; drawCmp(); } dirty = true; };

/* ---------------- search */
let found = [], fi = 0;
function search(q) { const res = $('#txRes'), f = q.trim().toLowerCase(); if (!f) { res.hidden = true; return; }
  found = [...Object.entries(D.taxa).map(([id, t]) => ({ id, a: t.common, b: t.sci, k: GROUP[t.group][0], c: GROUP[t.group][1], im: t.image && t.image.thumb })), ...Object.entries(D.nodes).filter(([, r]) => r.name).map(([id, r]) => ({ id, a: r.common || r.name, b: r.common ? r.name : '', k: 'Group', c: '#ddd3c1' }))]
    .filter(x => x.a.toLowerCase().includes(f) || x.b.toLowerCase().includes(f)).sort((x, y) => (x.a.toLowerCase().indexOf(f) < 0) - (y.a.toLowerCase().indexOf(f) < 0) || x.a.localeCompare(y.a)).slice(0, 10); fi = 0;
  res.innerHTML = found.length ? found.map((x, i) => `<button data-i="${i}" class="${i ? '' : 'on'}"><i style="--c:${x.c}${x.im ? `;background-image:url('${esc(x.im)}')` : ''}"></i><span><b>${esc(x.a)}</b><small><i style="display:inline;background:none;width:auto;height:auto">${esc(x.b)}</i></small></span><em>${esc(x.k)}</em></button>`).join('') : '<p>Nothing by that name in this selection.</p>';
  res.hidden = false; $$('button', res).forEach(b => b.onclick = () => pick(+b.dataset.i)); }
function pick(i) { const x = found[i]; if (!x) return; $('#txRes').hidden = true; $('#txQ').value = ''; $('#txQ').blur(); const n = byId.get(x.id); if (cmpMode && isTip(n)) return addCompare(n.id); reveal(n); select(n.id, true); }
$('#txQ').oninput = e => search(e.target.value);
$('#txQ').onkeydown = e => { const bs = $$('#txRes button'); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); fi = (fi + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % Math.max(1, bs.length); bs.forEach((b, i) => b.classList.toggle('on', i === fi)); } else if (e.key === 'Enter') pick(fi); else if (e.key === 'Escape') { e.target.value = ''; search(''); e.target.blur(); } };
document.addEventListener('pointerdown', e => { if (!e.target.closest('.tx-search')) $('#txRes').hidden = true; });

/* ---------------- about, keyboard, links */
$('#txAbout').onclick = () => { $('#txDlgBody').innerHTML = `<h2>About the data</h2>
  <p>Scorcher Tree is a <b>selected</b> tree: ${Object.keys(D.taxa).length} of the roughly 70,000 living vertebrate species, chosen to span every major lineage. It shows how they are related and, branch point by branch point, the evidence for it.</p>
  <h3>The rules</h3><ul><li><b>No number without a citation.</b> Every age and every support value links to the paper it comes from, and each DOI is checked.</li><li><b>Three kinds of age, never merged:</b> fossil minimums, soft maximums from older rocks, and molecular-clock estimates.</li><li><b>Unresolved stays unresolved.</b> Where the evidence cannot decide, the tree splits several ways at once rather than picking an answer.</li><li><b>Debates are shown, not settled.</b> Competing hypotheses are listed side by side.</li><li><b>Photos are freely licensed and credited.</b></li></ul>
  <h3>Where things stand</h3><ul><li>Topology: <b>${esc(D.topology.source)}</b>${D.topology.source === 'draft' ? ' (a conservative hand-curated draft; it will be rebuilt from the Open Tree of Life synthesis)' : ' · ' + esc(D.topology.version)}.</li><li>Branch points with published age evidence: <b>${ageCount()}</b> of ${Object.keys(D.nodes).length} (fossil calibrations so far; molecular-clock estimates to come). Until most are dated, the tree shows branching order, with the published ages written on it.</li><li>Evidence reviews completed: <b>${Object.values(D.nodes).filter(r => r.review === 'reviewed').length}</b>.</li></ul>
  <h3>Sources</h3><ul>${Object.values(D.citations || {}).map(c => `<li>${esc(c.authors)} (${esc(c.year)}). ${esc(c.title)}. <i>${esc(c.journal)}</i>. ${c.doi ? `<a href="https://doi.org/${esc(c.doi)}" target="_blank" rel="noopener">doi:${esc(c.doi)}</a>` : ''} ${c.verified ? '' : '<b style="color:var(--contest)">· DOI not yet verified</b>'}</li>`).join('')}<li>Open Tree of Life synthetic tree and taxonomy (CC0).</li><li>Geological periods: ICS International Chronostratigraphic Chart.</li><li>Photographs: Wikimedia Commons, credited individually.</li></ul>`; $('#txDlg').showModal(); };
$('#txDlg').addEventListener('click', e => { if (e.target.id === 'txDlg') e.target.close(); });
document.addEventListener('keydown', e => { if (e.target.closest('input') || $('#txDlg').open) return; if (e.key === '/') { e.preventDefault(); $('#txQ').focus(); } else if (e.key === '+' || e.key === '=') zoomAt(1.4, Hh / 2); else if (e.key === '-') zoomAt(1 / 1.4, Hh / 2); else if (e.key === 'f' || e.key === 'F') fit();
  else if (e.key === 'c' || e.key === 'C') $('#txCmpBtn').click(); else if (e.key === 'Escape') { if (cmpMode || cmp.length) { cmp = []; setCompareMode(false); } sel = null; showWelcome(); setHash(); dirty = true; } });
function setHash() { const h = cmp.length === 2 ? '#c=' + cmp.join(',') : sel ? '#' + (isTip(byId.get(sel)) ? 't' : 'n') + '=' + sel : ''; try { history.replaceState(null, '', h || location.pathname); } catch {} }
window.addEventListener('resize', resize);

/* ---------------- start */
fetch('/treedata/vertebrates.json').then(r => r.json()).then(data => {
  D = data; prepare(); layout(); resize(); cam.tRowH = Math.max(fitRowH(), Math.min(22, fitRowH())); clampCam(true);
  $('#txSel').innerHTML = `<b>A selected tree</b> · ${Object.keys(D.taxa).length} of about 70,000 vertebrate species<br>${esc(D.section)} section${D.status === 'draft' ? ' · draft' : ''}`;
  $('#txCrumbs').innerHTML = 'Life › Eukaryotes › Animals › <b>Vertebrates</b>';
  if (D.status === 'draft') { const b = $('#txBanner'); b.hidden = false; b.innerHTML = (phone() ? `Draft · ${ageCount()} dated points` : `Draft · branching order, with published ages for ${ageCount()} branch points (unverified)`) + ' <button id="txWhy">Why?</button>'; $('#txWhy').onclick = () => $('#txAbout').click(); }
  const h = location.hash.match(/^#([tnc])=(.+)$/); if (h) { if (h[1] === 'c') setCompare(h[2].split(',').filter(i => byId.has(i))); else if (byId.has(h[2])) select(h[2], true); else showWelcome(); } else showWelcome();
  window.__tree = { select, setCompare, toggle, byId, cam };
}).catch(e => { side.innerHTML = `<h1>Could not load the tree</h1><p class="tx-lede">${esc(e.message)}</p>`; });
