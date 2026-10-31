#!/usr/bin/env node
'use strict';
// Enforces Scorcher Tree's evidence rules (docs/tree-data.md) on a built dataset.
//   node tools/check-tree.js [file] [--strict]      draft: unsourced claims are warnings; strict (before release): errors
const fs = require('fs'), path = require('path');

function validate(d, { strict = false } = {}) {
  const errors = [], warnings = [], soft = m => (strict ? errors : warnings).push(m), cites = d.citations || {}, nodes = d.nodes || {};
  const STATUS = ['resolved', 'debated', 'unresolved', 'pending'], OKLIC = /^(cc0|public domain|pd|cc by(-sa)? [0-9.]+)/i, num = v => typeof v === 'number' && isFinite(v) && v > 0;
  const cite = (where, c) => { if (!c) return errors.push(`${where}: a number with no citation`); if (!cites[c]) return errors.push(`${where}: cites "${c}", which is not in citations`); if (!cites[c].doi && !cites[c].isbn) soft(`${where}: citation "${c}" has no DOI or ISBN`); else if (cites[c].doi && cites[c].verified !== true) soft(`${where}: citation "${c}" DOI not verified against Crossref`); };
  // tree shape
  const tips = new Set(), byId = new Map(), parentOf = new Map();
  (function f(n, p) { if (!n || !n.id) return errors.push('tree: a node with no id'); if (byId.has(n.id)) errors.push(`tree: duplicate id ${n.id}`); byId.set(n.id, n); if (p) parentOf.set(n.id, p.id);
    if (!n.children) { tips.add(n.id); if (!d.taxa[n.id]) errors.push(`tree: tip ${n.id} has no taxon entry`); return; }
    if (n.children.length < 2) errors.push(`tree: ${n.id} has a single child`); if (!nodes[n.id]) errors.push(`nodes: ${n.id} has no record`); n.children.forEach(c => f(c, n)); })(d.tree, null);
  for (const id of Object.keys(d.taxa || {})) if (!tips.has(id)) warnings.push(`taxa: ${id} is not on the tree`);
  for (const [id, n] of Object.entries(nodes)) {
    const t = byId.get(id), w = `node ${n.name || id}`; if (!t) { errors.push(`${w}: record for a node not on the tree`); continue; }
    const rel = n.relationship || {}; if (!STATUS.includes(rel.status)) errors.push(`${w}: relationship status "${rel.status}" is not one of ${STATUS.join(', ')}`);
    if (t.children.length > 2 && !['unresolved', 'pending', 'debated'].includes(rel.status)) errors.push(`${w}: ${t.children.length} branches but status "${rel.status}": a polytomy must be unresolved, pending or debated`);
    if (rel.status === 'debated') { if (!rel.competing || rel.competing.length < 2) errors.push(`${w}: debated, but fewer than two competing hypotheses are named`); (rel.competing || []).forEach((h, i) => { if (!h.cite) soft(`${w}: competing hypothesis "${h.name || i}" has no citation`); else cite(`${w} hypothesis ${h.name}`, h.cite); }); }
    if (['resolved', 'unresolved'].includes(rel.status) && !(rel.support || []).length) soft(`${w}: status "${rel.status}" given without published support`);
    (rel.support || []).forEach((s, i) => { if (s.value == null || !s.metric) errors.push(`${w}: support ${i} needs a metric and a value as published`); cite(`${w} support ${s.metric}`, s.cite); });
    const a = n.age || {};
    if (a.fossilMin) { if (!num(a.fossilMin.ma)) errors.push(`${w}: fossil minimum must be a positive age in Ma`); cite(`${w} fossil minimum`, a.fossilMin.cite); }
    if (a.softMax) { if (!num(a.softMax.ma)) errors.push(`${w}: soft maximum must be a positive age in Ma`); cite(`${w} soft maximum`, a.softMax.cite); if (a.fossilMin && a.softMax.ma < a.fossilMin.ma) errors.push(`${w}: soft maximum is younger than the fossil minimum`); }
    (a.clock || []).forEach((c, i) => { if (!num(c.lo) || !num(c.hi) || c.lo > c.hi || (c.mid != null && (c.mid < c.lo || c.mid > c.hi))) errors.push(`${w}: clock estimate ${i} must have 0 < lo ≤ mid ≤ hi`); cite(`${w} clock estimate ${i}`, c.cite); });
    const dp = a.display; if (dp) {
      if (!['review', 'synthesis', 'calibration', 'bounded'].includes(dp.source)) errors.push(`${w}: display source "${dp.source}" is not review, synthesis, calibration or bounded`);
      if (dp.source === 'calibration' && !(a.fossilMin && a.softMax && dp.lo === a.fossilMin.ma && dp.hi === a.softMax.ma)) errors.push(`${w}: a calibration display must run exactly from its fossil minimum to its soft maximum`);
      if (dp.source === 'bounded') { if (dp.mid != null) errors.push(`${w}: a bounded node must not have a midpoint`); }
      else { const fromRecords = (a.clock || []).some(c => c.lo === dp.lo && c.hi === dp.hi) || (a.fossilMin && a.softMax && dp.lo === a.fossilMin.ma && dp.hi === a.softMax.ma);
        if (!fromRecords) errors.push(`${w}: displayed interval ${dp.lo}–${dp.hi} Ma is not one of its published intervals (never invent a date)`);
        if (dp.mid != null && !(a.clock || []).some(c => c.mid === dp.mid)) errors.push(`${w}: displayed midpoint ${dp.mid} Ma is not a published value`);
        if (dp.source === 'review' && n.review !== 'reviewed') soft(`${w}: display source is "review" but the node is not marked reviewed`);
        if (a.fossilMin && dp.hi < a.fossilMin.ma) soft(`${w}: displayed interval is younger than its own fossil minimum`); }
      if (dp.lo != null && dp.hi != null && dp.lo > dp.hi) errors.push(`${w}: displayed lo is older than hi`);
      const p = parentOf.get(id), pd = p && nodes[p] && nodes[p].age && nodes[p].age.display;
      if (pd && pd.hi != null && dp.lo != null && dp.source !== 'bounded' && pd.source !== 'bounded' && dp.lo > pd.hi) errors.push(`${w}: displayed as entirely older than its ancestor ${nodes[p].name || p}`);
    }
  }
  for (const [id, t] of Object.entries(d.taxa || {})) if (t.image) { if (!OKLIC.test(t.image.licence || '')) errors.push(`taxon ${t.sci}: image licence "${t.image.licence}" is not free`); if (!t.image.artist) errors.push(`taxon ${t.sci}: image has no credit`); }
  return { errors, warnings };
}

if (require.main === module) {
  const file = process.argv.slice(2).find(a => !a.startsWith('-')) || path.join(__dirname, '..', 'treedata', 'vertebrates.json'), strict = process.argv.includes('--strict');
  const r = validate(JSON.parse(fs.readFileSync(file, 'utf8')), { strict });
  r.errors.forEach(e => console.error('ERROR ' + e)); if (process.argv.includes('-v')) r.warnings.forEach(w => console.warn('warn  ' + w));
  console.log(`${path.basename(file)}: ${r.errors.length} errors, ${r.warnings.length} warnings${strict ? ' (strict)' : ''}`); process.exit(r.errors.length ? 1 : 0);
}
module.exports = { validate };
