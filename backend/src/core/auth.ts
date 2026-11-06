// Sign-in with Google or Microsoft: OpenID Connect authorization code flow with PKCE, verified here without a third-party library.
// What is checked, every time: the state and nonce we issued (in a short-lived HMAC-signed cookie), the ID token's RS256 signature
// against the provider's published keys, its issuer, audience, expiry and issue time, and for Google that the email is verified.
// Sessions are random 256-bit tokens; only their SHA-256 is stored, so a database leak does not leak sessions.
import { sha256 } from './chain.ts';

export type OidcProvider = 'google' | 'microsoft';
export type Provider = OidcProvider | 'email';
export interface ProviderConfig { authorize: string; token: string; jwks: string; scope: string; issuer: (claims: Claims) => boolean }
export const PROVIDERS: Record<OidcProvider, ProviderConfig> = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    scope: 'openid email profile', issuer: c => c.iss === 'https://accounts.google.com' || c.iss === 'accounts.google.com' },
  // "common" accepts work, school and personal Microsoft accounts; the issuer then names the account's own tenant
  microsoft: { authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    jwks: 'https://login.microsoftonline.com/common/discovery/v2.0/keys', scope: 'openid email profile',
    issuer: c => typeof c.tid === 'string' && /^[0-9a-f-]{36}$/.test(c.tid) && c.iss === `https://login.microsoftonline.com/${c.tid}/v2.0` },
};
export interface Claims { iss?: string; aud?: string | string[]; sub?: string; exp?: number; iat?: number; nonce?: string; email?: string; email_verified?: boolean;
  name?: string; preferred_username?: string; tid?: string; [k: string]: unknown }
export interface Identity { provider: Provider; subject: string; email: string | null; name: string | null; tenantHint: string | null }

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

async function hmacKey(secret: string) { return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
// a value we hand to the browser and must get back unchanged: payload.signature, with an expiry inside the payload
export async function seal(obj: object, secret: string, ttlSeconds: number, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...obj, exp: Math.floor(now / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}
export async function unseal<T>(value: string, secret: string, now = Date.now()): Promise<T | null> {
  const [body, sig] = value.split('.'); if (!body || !sig) return null;
  let ok = false; try { ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(sig), enc.encode(body)); } catch { return null; }   // constant-time inside WebCrypto
  if (!ok) return null;
  const o = JSON.parse(dec.decode(unb64url(body))) as T & { exp: number };
  return o.exp >= Math.floor(now / 1000) ? o : null;
}
export async function pkcePair() { const verifier = randomToken(32); return { verifier, challenge: b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier)))) }; }

export function authorizeUrl(p: OidcProvider, clientId: string, redirectUri: string, state: string, nonce: string, challenge: string): string {
  const u = new URL(PROVIDERS[p].authorize);
  for (const [k, v] of Object.entries({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: PROVIDERS[p].scope, state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' })) u.searchParams.set(k, v);
  return u.toString();
}

export interface Jwk { kid?: string; kty: string; n?: string; e?: string; alg?: string; use?: string }
export class AuthError extends Error {}
export async function verifyIdToken(jwt: string, o: { provider: OidcProvider; jwks: { keys: Jwk[] }; audience: string; nonce: string; now?: number; skewSeconds?: number }): Promise<Claims> {
  const parts = jwt.split('.'); if (parts.length !== 3) throw new AuthError('malformed token');
  const [h, p, s] = parts as [string, string, string];
  const header = JSON.parse(dec.decode(unb64url(h))) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256') throw new AuthError(`unexpected algorithm ${header.alg}`);          // never "none", never HMAC with a public key
  const jwk = o.jwks.keys.find(k => k.kid === header.kid && k.kty === 'RSA'); if (!jwk) throw new AuthError('signing key not found');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(s), enc.encode(`${h}.${p}`)))) throw new AuthError('bad signature');
  const c = JSON.parse(dec.decode(unb64url(p))) as Claims, now = Math.floor((o.now ?? Date.now()) / 1000), skew = o.skewSeconds ?? 60;
  if (!PROVIDERS[o.provider].issuer(c)) throw new AuthError('wrong issuer');
  if (!(Array.isArray(c.aud) ? c.aud.includes(o.audience) : c.aud === o.audience)) throw new AuthError('wrong audience');
  if (typeof c.exp !== 'number' || c.exp + skew < now) throw new AuthError('expired');
  if (typeof c.iat !== 'number' || c.iat - skew > now) throw new AuthError('issued in the future');
  if (c.nonce !== o.nonce) throw new AuthError('nonce mismatch');
  if (typeof c.sub !== 'string' || !c.sub) throw new AuthError('no subject');
  if (o.provider === 'google' && c.email !== undefined && c.email_verified !== true) throw new AuthError('email not verified');
  return c;
}
export function identityOf(p: OidcProvider, c: Claims): Identity {
  // Microsoft does not guarantee the email claim is verified: it is shown, never used to grant access to an organisation
  const email = p === 'google' ? (c.email ?? null) : (c.email ?? c.preferred_username ?? null);
  return { provider: p, subject: p === 'microsoft' ? `${c.tid}:${c.sub}` : c.sub!, email: email ? String(email).toLowerCase() : null, name: c.name ?? null, tenantHint: p === 'microsoft' ? (c.tid ?? null) : null };
}

export interface User { id: string; email: string | null; name: string | null; provider: Provider }
export interface Org { id: string; name: string; role: 'owner' | 'admin' | 'member' }
export interface AuthStore {
  upsertUser(i: Identity, now: number): Promise<User>;
  orgsOf(userId: string): Promise<Org[]>;
  createOrg(name: string, ownerId: string, now: number): Promise<Org>;
  createSession(tokenHash: string, userId: string, expires: number): Promise<void>;
  session(tokenHash: string, now: number): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
}
export const SESSION_DAYS = 7;
export async function signIn(store: AuthStore, i: Identity, now = Date.now()): Promise<{ token: string; user: User; orgs: Org[] }> {
  const user = await store.upsertUser(i, now);
  let orgs = await store.orgsOf(user.id);
  if (!orgs.length) orgs = [await store.createOrg(user.name ? `${user.name}'s workspace` : 'My workspace', user.id, now)];   // a private workspace; teams are joined by invitation
  const token = randomToken(32);
  await store.createSession(await sha256(token), user.id, now + SESSION_DAYS * 864e5);
  return { token, user, orgs };
}
export const sessionUser = async (store: AuthStore, token: string, now = Date.now()) => token ? store.session(await sha256(token), now) : null;

export class MemoryAuthStore implements AuthStore {
  users = new Map<string, User & { key: string }>(); orgs = new Map<string, Org & { owner: string }>(); members: { org: string; user: string; role: Org['role'] }[] = []; sessions = new Map<string, { user: string; expires: number }>();
  async upsertUser(i: Identity) { const key = `${i.provider}:${i.subject}`; let u = [...this.users.values()].find(x => x.key === key);
    if (!u) { u = { id: randomToken(12), email: i.email, name: i.name, provider: i.provider, key }; this.users.set(u.id, u); } else { u.email = i.email; u.name = i.name; } return u; }
  async orgsOf(userId: string) { return this.members.filter(m => m.user === userId).map(m => ({ ...this.orgs.get(m.org)!, role: m.role })); }
  async createOrg(name: string, ownerId: string) { const o = { id: randomToken(12), name, role: 'owner' as const, owner: ownerId }; this.orgs.set(o.id, o); this.members.push({ org: o.id, user: ownerId, role: 'owner' }); return o; }
  async createSession(h: string, user: string, expires: number) { this.sessions.set(h, { user, expires }); }
  async session(h: string, now: number) { const s = this.sessions.get(h); return s && s.expires > now ? this.users.get(s.user) ?? null : null; }
  async deleteSession(h: string) { this.sessions.delete(h); }
}

export class D1AuthStore implements AuthStore {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }
  async upsertUser(i: Identity, now: number): Promise<User> {
    const id = randomToken(12);
    await this.db.prepare('INSERT INTO users (id, provider, subject, email, name, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, subject) DO UPDATE SET email = excluded.email, name = excluded.name, last_login = excluded.last_login')
      .bind(id, i.provider, i.subject, i.email, i.name, now, now).run();
    const r = await this.db.prepare('SELECT id, email, name, provider FROM users WHERE provider = ? AND subject = ?').bind(i.provider, i.subject).first<User>();
    return r!;
  }
  async orgsOf(userId: string): Promise<Org[]> {
    return (await this.db.prepare('SELECT o.id, o.name, m.role FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY m.created_at').bind(userId).all<Org>()).results;
  }
  async createOrg(name: string, ownerId: string, now: number): Promise<Org> {
    const id = randomToken(12);
    await this.db.batch([this.db.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)').bind(id, name, now),
      this.db.prepare('INSERT INTO memberships (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)').bind(id, ownerId, 'owner', now)]);
    return { id, name, role: 'owner' };
  }
  async createSession(h: string, userId: string, expires: number) { await this.db.prepare('INSERT INTO sessions (token_sha256, user_id, expires_at) VALUES (?, ?, ?)').bind(h, userId, expires).run(); }
  async session(h: string, now: number) { return this.db.prepare('SELECT u.id, u.email, u.name, u.provider FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_sha256 = ? AND s.expires_at > ?').bind(h, now).first<User>(); }
  async deleteSession(h: string) { await this.db.prepare('DELETE FROM sessions WHERE token_sha256 = ?').bind(h).run(); }
}
