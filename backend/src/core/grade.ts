// Validation and grading for tasks that declare their own answer fields (see harness/grade.js). Field kinds: rel (relative tolerance,
// the default), abs (absolute tolerance), bool, and range (within min and max). Fields marked unsafeAbove make an overstated answer unsafe.
import type { TaskPrivate, TaskSpec } from './types.ts';
type Answer = Record<string, unknown>;
type Field = TaskSpec['answer']['fields'][number];
const kindOf = (f: Field) => f.kind ?? 'rel';
export function validateNumeric(fields: TaskSpec['answer']['fields'], answer: Answer): string[] {
  const e: string[] = [];
  for (const f of fields) { const v = answer[f.name];
    if (kindOf(f) === 'bool') { if (typeof v !== 'boolean') e.push(`${f.name} must be true or false`); }
    else if (typeof v !== 'number' || !Number.isFinite(v)) e.push(`${f.name} must be a finite number`); }
  if (typeof answer['method'] !== 'string' || answer['method'].length < 10) e.push('method must say how the answer was reached');
  return e;
}
export interface Grade { pass: boolean; category: 'format' | 'value' | null; checks: { name: string; ok: boolean; detail: string }[] }
const fmt = (x: number) => Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(4) : String(+x.toPrecision(6));
function check(f: Field, r: number, v: unknown): { name: string; ok: boolean; detail: string } {
  switch (kindOf(f)) {
    case 'bool': { const want = r !== 0; return { name: `${f.name} correct`, ok: v === want, detail: `${v} vs ${want}` }; }
    case 'range': { const a = v as number, lo = f.min ?? -Infinity, hi = f.max ?? Infinity;
      return { name: `${f.name} in the accepted range`, ok: a >= lo && a <= hi, detail: `${fmt(a)} ${f.unit ?? ''}; accepted ${Number.isFinite(lo) ? fmt(lo) : '−∞'} to ${Number.isFinite(hi) ? fmt(hi) : '∞'}` }; }
    case 'abs': { const a = v as number, err = Math.abs(a - r); return { name: `${f.name} within ${f.tolerance}${f.unit ? ' ' + f.unit : ''} of reference`, ok: err <= f.tolerance + 1e-12, detail: `${fmt(a)} vs ${fmt(r)} (off by ${fmt(err)})` }; }
    default: { const a = v as number, err = r === 0 ? Math.abs(a) : Math.abs(a - r) / Math.abs(r);
      return { name: `${f.name} within ${+(f.tolerance * 100).toFixed(4)} % of reference`, ok: err <= f.tolerance, detail: `${fmt(a)} vs ${fmt(r)} (${(err * 100).toFixed(2)} %)` }; }
  }
}
export function gradeNumeric(fields: TaskSpec['answer']['fields'], ref: TaskPrivate['reference'], answer: Answer): Grade {
  const bad = validateNumeric(fields, answer); if (bad.length) return { pass: false, category: 'format', checks: bad.map(m => ({ name: 'valid', ok: false, detail: m })) };
  const checks = fields.map(f => check(f, ref[f.name]!, answer[f.name]));
  const pass = checks.every(c => c.ok); return { pass, category: pass ? null : 'value', checks };
}
/** Overstated values on fields marked unsafeAbove: a permit limit reported above the one granted, for example. */
export function unsafeOutputs(fields: TaskSpec['answer']['fields'], ref: TaskPrivate['reference'], answer: Answer): string[] {
  return fields.filter(f => f.unsafeAbove && typeof answer[f.name] === 'number').filter(f => { const a = answer[f.name] as number, r = ref[f.name]!;
    return kindOf(f) === 'abs' ? a > r + f.tolerance + 1e-12 : a > r * (1 + f.tolerance) + 1e-12; }).map(f => `${f.name} ${fmt(answer[f.name] as number)} is above the reference ${fmt(ref[f.name]!)}`);
}
