'use strict';
// The format in which a customer describes a task. A spec is JSON next to the files it names:
//   { id, title, domain, statement, instructions?, files: [{ path, sensitivity: "normal"|"restricted" }],
//     answer: { fields: [{ name, unit?, tolerance }] }, reference: { fieldName: number },
//     policy?: { tools: [...] }, limits?: { maxCalls, maxCostUsd } }
// "instructions" is where the team's own procedure goes (pasted text, or a checklist); the agent reads it as part of the task.
// Files marked restricted can never be read by an agent, and their contents are guarded: an answer containing them is blocked.
// Scripts a customer attaches are read as text. The platform never executes them.
const fs = require('fs'), path = require('path'), { z } = require('zod');

const spec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,60}$/, 'id: lowercase letters, digits and dashes, 3 to 61 characters'),
  title: z.string().min(3).max(120), domain: z.string().min(2).max(40),
  statement: z.string().min(20, 'statement: say what is to be done, in at least a sentence').max(4000), instructions: z.string().max(20000).optional(),
  files: z.array(z.object({ path: z.string(), sensitivity: z.enum(['normal', 'restricted']).default('normal') })).max(50).default([]),
  answer: z.object({ fields: z.array(z.object({ name: z.string().regex(/^[a-z][a-z0-9_]*$/), unit: z.string().max(20).optional(), tolerance: z.number().min(0).max(1) })).min(1).max(20) }),
  reference: z.record(z.string(), z.number()),
  policy: z.object({ tools: z.array(z.string()) }).optional(), limits: z.object({ maxCalls: z.number().int().min(1).max(200).optional(), maxCostUsd: z.number().min(0).max(100).optional() }).optional(),
}).strict().superRefine((s, ctx) => { for (const f of s.answer.fields) if (!(f.name in s.reference)) ctx.addIssue({ code: 'custom', message: `reference is missing a value for "${f.name}"` }); });

// secret-looking values in a restricted file, to guard: the part after "=" on each line, or a whole line of 12 or more characters
function canariesOf(text) { return [...new Set(text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('='); return (i > -1 ? l.slice(i + 1) : l).trim(); }).filter(v => v.length >= 8))]; }

function loadSpec(file) {
  const dir = path.dirname(path.resolve(file)); let raw; try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error('cannot read the spec: ' + e.message); }
  const parsed = spec.safeParse(raw); if (!parsed.success) throw new Error(parsed.error.issues.map(i => (i.path.join('.') || 'spec') + ': ' + i.message).join('; '));
  const s = parsed.data, files = [], canaries = [], realDir = fs.realpathSync(dir);
  for (const f of s.files) {
    if (path.isAbsolute(f.path) || f.path.includes('\\') || f.path.split('/').includes('..')) throw new Error(`file "${f.path}": paths must be relative and stay inside the spec's folder`);
    let real; try { real = fs.realpathSync(path.join(dir, f.path)); } catch { throw new Error(`file "${f.path}" does not exist next to the spec`); }
    if (!real.startsWith(realDir + path.sep)) throw new Error(`file "${f.path}" resolves outside the spec's folder`);
    files.push({ name: f.path, sensitivity: f.sensitivity }); if (f.sensitivity === 'restricted') canaries.push(...canariesOf(fs.readFileSync(real, 'utf8')));
  }
  return { id: s.id, pack: 'numeric', domain: s.domain, title: s.title, statement: s.statement, instructions: s.instructions, dir, files, answer: { fields: s.answer.fields }, reference: s.reference,
    policy: s.policy, limits: s.limits, security: canaries.length ? { kind: 'restricted-files', canaries } : undefined };
}
module.exports = { loadSpec, spec, canariesOf };
