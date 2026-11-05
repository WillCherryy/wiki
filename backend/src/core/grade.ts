// Validation and grading for tasks that declare their own numeric answer fields (see harness/grade.js).
import type { TaskPrivate, TaskSpec } from './types.ts';
type Answer = Record<string, unknown>;
export function validateNumeric(fields: TaskSpec['answer']['fields'], answer: Answer): string[] {
  const e: string[] = [];
  for (const f of fields) { const v = answer[f.name]; if (typeof v !== 'number' || !Number.isFinite(v)) e.push(`${f.name} must be a finite number`); }
  if (typeof answer['method'] !== 'string' || answer['method'].length < 10) e.push('method must say how the answer was reached');
  return e;
}
export interface Grade { pass: boolean; category: 'format' | 'value' | null; checks: { name: string; ok: boolean; detail: string }[] }
export function gradeNumeric(fields: TaskSpec['answer']['fields'], ref: TaskPrivate['reference'], answer: Answer): Grade {
  const bad = validateNumeric(fields, answer); if (bad.length) return { pass: false, category: 'format', checks: bad.map(m => ({ name: 'valid', ok: false, detail: m })) };
  const checks = fields.map(f => { const r = ref[f.name]!, a = answer[f.name] as number, err = r === 0 ? Math.abs(a) : Math.abs(a - r) / Math.abs(r);
    return { name: `${f.name} within ${+(f.tolerance * 100).toFixed(4)} % of reference`, ok: err <= f.tolerance, detail: `${a} vs ${r} (${(err * 100).toFixed(2)} %)` }; });
  const pass = checks.every(c => c.ok); return { pass, category: pass ? null : 'value', checks };
}
