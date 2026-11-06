// Sign-in by emailed link. The link opens a page with a button; only pressing it (a POST) signs in, because mail scanners such as
// Outlook Safe Links open every link in an email and would otherwise spend the link or sign in themselves.
// Tokens are 256-bit random values, valid for 15 minutes, single use, and stored only as SHA-256. Every request for a link gets the
// same reply whether or not the address is known, so the form cannot be used to find out who has an account. Requests are limited
// per address and per client (IP) to stop the form being used to flood someone's inbox.
import { sha256 } from './chain.ts';
import { randomToken } from './auth.ts';

export const LINK_MINUTES = 15;
export const LIMIT_PER_EMAIL = 5, LIMIT_PER_CLIENT = 20, LIMIT_WINDOW_MS = 60 * 60 * 1000;

export interface LoginTokenStore {
  createLoginToken(tokenHash: string, email: string, clientHash: string, now: number, expires: number): Promise<void>;
  consumeLoginToken(tokenHash: string, now: number): Promise<string | null>;
  deleteLoginToken(tokenHash: string): Promise<void>;                               // a link that was never sent: it must not count towards the limit        // atomically: unused and unexpired -> mark used, return the email
  recentRequests(email: string, clientHash: string, since: number): Promise<{ email: number; client: number }>;
}
export class MailError extends Error {}
export interface Mailer { send(to: string, subject: string, text: string, html: string): Promise<void> }

// a pragmatic address check: one @, a dot in the domain, no spaces or control characters (which also rules out header injection)
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length > 254 || /[\s\x00-\x1f\x7f<>(),;:"[\]\\]/.test(e)) return null;
  const m = /^([^@]+)@([a-z0-9-]+(\.[a-z0-9-]+)+)$/.exec(e);
  return m && m[1]!.length <= 64 && !m[2]!.split('.').some(p => !p || p.startsWith('-') || p.endsWith('-')) ? e : null;
}

export async function requestLink(o: { email: unknown; client: string; store: LoginTokenStore; mailer: Mailer; publicUrl: string; now: number }): Promise<{ ok: boolean; reason?: string }> {
  const email = normaliseEmail(o.email);
  if (!email) return { ok: false, reason: 'invalid' };
  const clientHash = await sha256(`client:${o.client}`);
  const recent = await o.store.recentRequests(email, clientHash, o.now - LIMIT_WINDOW_MS);
  if (recent.email >= LIMIT_PER_EMAIL || recent.client >= LIMIT_PER_CLIENT) return { ok: false, reason: 'rate' };
  const token = randomToken(32);
  const hash = await sha256(token);
  await o.store.createLoginToken(hash, email, clientHash, o.now, o.now + LINK_MINUTES * 60_000);
  const link = `${o.publicUrl}/auth/email/verify?token=${token}`;
  const text = `Sign in to Scorcher Build:\n\n${link}\n\nThe link works once, for ${LINK_MINUTES} minutes. If you did not ask for it, ignore this email: nothing happens unless the link is used.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0d0f0e;max-width:480px"><p style="font-weight:700">Scorcher Build</p>`
    + `<p>Sign in with the button below. It works once, for ${LINK_MINUTES} minutes.</p><p><a href="${link}" style="display:inline-block;background:#0d0f0e;color:#f3f4f1;padding:12px 20px;text-decoration:none">Sign in</a></p>`
    + `<p style="color:#6f7571;font-size:13px">If you did not ask for this, ignore it: nothing happens unless the link is used.</p></div>`;
  try { await o.mailer.send(email, 'Your Scorcher Build sign-in link', text, html); }
  catch (e) { await o.store.deleteLoginToken(hash); throw e; }
  return { ok: true };
}

export async function redeemLink(token: unknown, store: LoginTokenStore, now: number): Promise<string | null> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  return store.consumeLoginToken(await sha256(token), now);
}

// Resend's HTTP API (https://resend.com); any provider with an HTTP API fits the same interface
export class ResendMailer implements Mailer {
  private key: string; private from: string; private f: typeof fetch;
  // never store the global fetch itself: in Workers it throws "Illegal invocation" when called as a method of another object
  constructor(key: string, from: string, f: typeof fetch = (u, i) => fetch(u, i)) { this.key = key; this.from = from; this.f = f; }
  async send(to: string, subject: string, text: string, html: string) {
    const r = await this.f('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject, text, html }) });
    if (!r.ok) {   // the provider's own reason (for example an unverified sending domain) is safe to show: it names no recipient or secret
      const why = await r.json().then(j => String((j as { message?: unknown }).message ?? '')).catch(() => '');
      throw new MailError(`the email could not be sent (${r.status}${why ? `: ${why}` : ''})`);
    }
  }
}

export class MemoryLoginTokens implements LoginTokenStore {
  rows: { hash: string; email: string; client: string; created: number; expires: number; used: boolean }[] = [];
  async createLoginToken(hash: string, email: string, client: string, now: number, expires: number) { this.rows.push({ hash, email, client, created: now, expires, used: false }); }
  async deleteLoginToken(hash: string) { this.rows = this.rows.filter(r => r.hash !== hash); }
  async consumeLoginToken(hash: string, now: number) { const r = this.rows.find(x => x.hash === hash && !x.used && x.expires > now); if (!r) return null; r.used = true; return r.email; }
  async recentRequests(email: string, client: string, since: number) { const R = this.rows.filter(x => x.created >= since); return { email: R.filter(x => x.email === email).length, client: R.filter(x => x.client === client).length }; }
}

export class D1LoginTokens implements LoginTokenStore {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }
  async createLoginToken(hash: string, email: string, client: string, now: number, expires: number) {
    await this.db.prepare('INSERT INTO login_tokens (token_sha256, email, client_sha256, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)').bind(hash, email, client, now, expires).run();
  }
  async deleteLoginToken(hash: string) { await this.db.prepare('DELETE FROM login_tokens WHERE token_sha256 = ?').bind(hash).run(); }
  async consumeLoginToken(hash: string, now: number) {
    const r = await this.db.prepare('UPDATE login_tokens SET used = 1 WHERE token_sha256 = ? AND used = 0 AND expires_at > ? RETURNING email').bind(hash, now).first<{ email: string }>();
    return r?.email ?? null;
  }
  async recentRequests(email: string, client: string, since: number) {
    const r = await this.db.prepare('SELECT SUM(email = ?) AS e, SUM(client_sha256 = ?) AS c FROM login_tokens WHERE created_at >= ?').bind(email, client, since).first<{ e: number | null; c: number | null }>();
    return { email: r?.e ?? 0, client: r?.c ?? 0 };
  }
}
