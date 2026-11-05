// A task's input files as an agent may touch them (see harness/sandbox.js): the manifest is the allowlist, escapes are refused and
// recorded, restricted files read as "no such file" and are recorded. The store is an interface, so the same rules run over R2 in
// production and over memory in tests. Object keys are flat, so there are no symlinks to follow here.
import type { Sensitivity, ViolationType } from './types.ts';

export interface FileStore { get(key: string, maxBytes: number): Promise<{ text: string; bytes: number } | null>; size(key: string): Promise<number | null> }
export class MemoryStore implements FileStore {
  private files: Record<string, string>;
  constructor(files: Record<string, string>) { this.files = files; }
  async get(key: string, maxBytes: number) { const t = this.files[key]; return t === undefined ? null : { text: t.slice(0, maxBytes), bytes: new TextEncoder().encode(t).length }; }
  async size(key: string) { const t = this.files[key]; return t === undefined ? null : new TextEncoder().encode(t).length; }
}
export class R2Store implements FileStore {
  private bucket: R2Bucket;
  constructor(bucket: R2Bucket) { this.bucket = bucket; }
  async get(key: string, maxBytes: number) { const o = await this.bucket.get(key, { range: { offset: 0, length: maxBytes } }); return o ? { text: await o.text(), bytes: o.size } : null; }
  async size(key: string) { const o = await this.bucket.head(key); return o ? o.size : null; }
}

export const MAX_READ = 200_000, MAX_TABLE = 5_000_000;
export type OnViolation = (type: ViolationType, detail: string) => void;
export class Sandbox {
  private byName: Map<string, Sensitivity>; private store: FileStore; private prefix: string; private files: { name: string; sensitivity: Sensitivity }[];
  constructor(store: FileStore, prefix: string, files: { name: string; sensitivity: Sensitivity }[]) { this.store = store; this.prefix = prefix; this.files = files; this.byName = new Map(files.map(f => [f.name, f.sensitivity])); }
  async list() { const out = []; for (const f of this.files) if (f.sensitivity !== 'restricted') out.push({ name: f.name, bytes: await this.store.size(this.prefix + f.name), sensitivity: f.sensitivity }); return out; }
  private resolve(name: unknown, onViolation: OnViolation): string {
    const deny = (): never => { throw new Error('no such file: ' + String(name).slice(0, 80)); };
    if (typeof name !== 'string' || !name || name.includes('\0') || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..')) { onViolation('path-escape', String(name).slice(0, 80)); return deny(); }
    const s = this.byName.get(name); if (s === undefined) return deny();
    if (s === 'restricted') { onViolation('restricted-read', name); return deny(); }
    return this.prefix + name;
  }
  async read(name: string, onViolation: OnViolation, maxBytes = MAX_READ) { const key = this.resolve(name, onViolation), cap = Math.min(maxBytes, MAX_READ), o = await this.store.get(key, cap); if (!o) throw new Error('no such file: ' + name); return { name, bytes: o.bytes, truncated: o.bytes > cap, content: o.text }; }
  async readText(name: string, onViolation: OnViolation) { const key = this.resolve(name, onViolation), sz = await this.store.size(key); if (sz === null) throw new Error('no such file: ' + name); if (sz > MAX_TABLE) throw new Error('file too large for table queries'); return (await this.store.get(key, MAX_TABLE))!.text; }
}
