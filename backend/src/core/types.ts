// Shared types and the task spec schema. One definition used by the Worker, the Durable Object, the model loop and the tests.
import { z } from 'zod';

export const Sensitivity = z.enum(['normal', 'restricted']);
export type Sensitivity = z.infer<typeof Sensitivity>;

/** A customer's task, as in harness/taskspec.ts: what to do, the team's procedure, files, answer fields, policy and limits. */
export const TaskSpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,60}$/, 'id: lowercase letters, digits and dashes, 3 to 61 characters'),
  title: z.string().min(3).max(120), domain: z.string().min(2).max(40),
  statement: z.string().min(20, 'statement: say what is to be done, in at least a sentence').max(4000), instructions: z.string().max(20000).optional(),
  files: z.array(z.object({ path: z.string(), sensitivity: Sensitivity.default('normal') })).max(50).default([]),
  // kind: rel (default, tolerance is a fraction of the reference), abs (tolerance in the field's unit), bool (true or false; reference 1 or 0),
  // range (no reference value to match: the answer must lie within min and max). unsafeAbove: an answer above the reference beyond tolerance is unsafe.
  answer: z.object({ fields: z.array(z.object({ name: z.string().regex(/^[a-z][a-z0-9_]*$/), unit: z.string().max(20).optional(), tolerance: z.number().min(0).max(1),
    kind: z.enum(['rel', 'abs', 'bool', 'range']).optional(), min: z.number().optional(), max: z.number().optional(), unsafeAbove: z.boolean().optional() }).strict()).min(1).max(20) }),
  reference: z.record(z.string(), z.number()),
  policy: z.object({ tools: z.array(z.string()) }).optional(),
  limits: z.object({ maxCalls: z.number().int().min(1).max(200).optional(), maxCostUsd: z.number().min(0).max(100).optional() }).optional(),
}).strict().superRefine((s, ctx) => { for (const f of s.answer.fields) if (!(f.name in s.reference)) ctx.addIssue({ code: 'custom', message: `reference is missing a value for "${f.name}"` }); });
export type TaskSpec = z.infer<typeof TaskSpec>;

export type ViolationType = 'restricted-read' | 'path-escape' | 'tool-not-allowed' | 'egress-blocked';
export interface Violation { type: ViolationType; detail: string; call: number; at: number }
export interface TraceEntry { i: number; tool: string; args: unknown; ok: boolean; error?: string; result?: unknown; resultSha?: string; ms: number; at: number; hash: string }
export interface Usage { model: string; input_tokens: number; output_tokens: number }

/** Everything a trial needs that the agent must never see (reference answer, guarded secrets) lives in the private part. */
/** Inputs for the key-free physics checks of a well test: the brief's parameters (SI) and the data, as delivered, converted to hours and Pa. */
export interface WellTestPhysics { kind: 'welltest'; q: number; mu: number; h: number; phi: number; ct: number; rw: number; pwf: number; tp: number; dt_h: number[]; p_pa: number[] }
export interface TaskPrivate { reference: Record<string, number>; canaries: string[]; physics?: WellTestPhysics }
export interface TaskPublic { id: string; title: string; statement: string; instructions: string | null; answer: TaskSpec['answer']; files: { name: string; sensitivity: Sensitivity }[]; policy: TaskSpec['policy'] | null; limits: { maxCalls: number; maxCostUsd: number } }
