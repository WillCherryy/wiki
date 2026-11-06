// HTTP side of sign-in. Routes: GET /auth/{google|microsoft}/start, GET /auth/{google|microsoft}/callback, POST /auth/logout, GET /api/me.
// Dependencies (fetch, store, clock) are injected so the whole flow is tested without a network or a database.
import { AuthError, PROVIDERS, authorizeUrl, identityOf, pkcePair, randomToken, seal, sessionUser, signIn, unseal, verifyIdToken, type AuthStore, type Jwk, type Provider, type User } from './core/auth.ts';
import { sha256 } from './core/chain.ts';

export interface AuthConfig {
  publicUrl: string;          // where this backend is served, e.g. https://build.playscorcher.com (the OAuth redirect URIs live here)
  appUrl: string;             // where people land after signing in, e.g. https://playscorcher.com/build/console
  sessionSecret: string;      // HMAC key for the short-lived sign-in cookie
  clients: Partial<Record<Provider, { id: string; secret: string }>>;
}
export interface AuthDeps { store: AuthStore; fetch: typeof fetch; now: () => number }

const SESSION = '__Host-sb_session', FLOW = '__Host-sb_flow';
const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
export const readCookie = (r: Request, name: string) => (r.headers.get('cookie') ?? '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === name)?.slice(1).join('=') ?? '';
const json = (o: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
const redirect = (to: string, cookies: string[] = []) => { const h = new Headers({ location: to, 'cache-control': 'no-store' }); for (const c of cookies) h.append('set-cookie', c); return new Response(null, { status: 302, headers: h }); };

const JWKS = new Map<string, { at: number; keys: { keys: Jwk[] } }>();
async function jwks(p: Provider, f: typeof fetch, now: number, refresh = false) {
  const c = JWKS.get(p); if (c && !refresh && now - c.at < 36e5) return c.keys;
  const r = await f(PROVIDERS[p].jwks); if (!r.ok) throw new AuthError('could not fetch signing keys');
  const keys = await r.json() as { keys: Jwk[] }; JWKS.set(p, { at: now, keys }); return keys;
}
export const clearJwksCache = () => JWKS.clear();

export async function currentUser(r: Request, d: AuthDeps): Promise<User | null> { return sessionUser(d.store, readCookie(r, SESSION), d.now()); }

export async function handleAuth(r: Request, cfg: AuthConfig, d: AuthDeps): Promise<Response | null> {
  const url = new URL(r.url), m = /^\/auth\/(google|microsoft)\/(start|callback)$/.exec(url.pathname);
  if (m) {
    const p = m[1] as Provider, client = cfg.clients[p];
    if (!client?.id || !client.secret) return json({ error: `${p} sign-in is not configured` }, 503);
    const redirectUri = `${cfg.publicUrl}/auth/${p}/callback`;
    if (m[2] === 'start' && r.method === 'GET') {
      const state = randomToken(16), nonce = randomToken(16), { verifier, challenge } = await pkcePair();
      const flow = await seal({ p, state, nonce, verifier }, cfg.sessionSecret, 600, d.now());
      return redirect(authorizeUrl(p, client.id, redirectUri, state, nonce, challenge), [cookie(FLOW, flow, 600)]);
    }
    if (m[2] === 'callback' && r.method === 'GET') {
      const fail = (why: string) => redirect(`${cfg.appUrl}?signin=failed&reason=${encodeURIComponent(why)}`, [cookie(FLOW, '', 0)]);
      if (url.searchParams.get('error')) return fail(url.searchParams.get('error')!);
      const flow = await unseal<{ p: Provider; state: string; nonce: string; verifier: string }>(readCookie(r, FLOW), cfg.sessionSecret, d.now());
      if (!flow || flow.p !== p || flow.state !== url.searchParams.get('state')) return fail('state');
      const code = url.searchParams.get('code'); if (!code) return fail('code');
      const tr = await d.fetch(PROVIDERS[p].token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: client.id, client_secret: client.secret, code_verifier: flow.verifier }) });
      if (!tr.ok) return fail('token');
      const idToken = (await tr.json() as { id_token?: string }).id_token; if (!idToken) return fail('token');
      let claims;
      try { claims = await verifyIdToken(idToken, { provider: p, jwks: await jwks(p, d.fetch, d.now()), audience: client.id, nonce: flow.nonce, now: d.now() }); }
      catch (e) {
        if (e instanceof AuthError && e.message === 'signing key not found') {   // keys rotate: refetch once
          try { claims = await verifyIdToken(idToken, { provider: p, jwks: await jwks(p, d.fetch, d.now(), true), audience: client.id, nonce: flow.nonce, now: d.now() }); } catch { return fail('verify'); }
        } else return fail('verify');
      }
      const { token } = await signIn(d.store, identityOf(p, claims), d.now());
      return redirect(cfg.appUrl, [cookie(SESSION, token, 7 * 86400), cookie(FLOW, '', 0)]);
    }
    return json({ error: 'method not allowed' }, 405);
  }
  if (url.pathname === '/auth/logout' && r.method === 'POST') {
    const t = readCookie(r, SESSION); if (t) await d.store.deleteSession(await sha256(t));
    return json({ ok: true }, 200, { 'set-cookie': cookie(SESSION, '', 0) });
  }
  if (url.pathname === '/api/me' && r.method === 'GET') {
    const u = await currentUser(r, d); if (!u) return json({ signedIn: false }, 401);
    return json({ signedIn: true, user: { id: u.id, email: u.email, name: u.name, provider: u.provider }, orgs: await d.store.orgsOf(u.id) });
  }
  return null;
}
