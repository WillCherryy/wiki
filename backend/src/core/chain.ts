// Tamper-evident audit chain: each trace entry carries the hash of the one before. The format is identical to harness/gateway.js,
// so a trace produced by either can be verified by the other.
import type { TraceEntry } from './types.ts';

const enc = new TextEncoder();
export const GENESIS = '0'.repeat(64);
export async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  let out = ''; for (const b of d) out += (b < 16 ? '0' : '') + b.toString(16); return out;
}
type Hashable = Pick<TraceEntry, 'i' | 'tool' | 'args' | 'ok' | 'error' | 'result'> & { resultSha?: string | undefined };
export async function entryHash(prev: string, e: Hashable): Promise<string> {
  return sha256(prev + JSON.stringify([e.i, e.tool, e.args, e.ok, e.error || null, e.resultSha ?? await sha256(JSON.stringify(e.result === undefined ? null : e.result))]));   // a stored digest stands in for a large result
}
export type ChainCheck = { ok: true; length: number; head: string } | { ok: false; firstBad: number };
export async function verifyChain(trace: readonly TraceEntry[]): Promise<ChainCheck> {
  let prev = GENESIS;
  for (let i = 0; i < trace.length; i++) { const e = trace[i]!; if (e.hash !== await entryHash(prev, e)) return { ok: false, firstBad: i + 1 }; prev = e.hash; }
  return { ok: true, length: trace.length, head: prev };
}
