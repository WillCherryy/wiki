import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthStore, b64url, seal, unseal, verifyIdToken, type Claims, type Jwk, type OidcProvider } from '../src/core/auth.ts';
import { handleAuth, clearJwksCache, type AuthConfig } from '../src/auth-routes.ts';

const enc = new TextEncoder();
const NOW = Date.UTC(2026, 10, 6, 12), SEC = Math.floor(NOW / 1000);
async function keypair(kid: string) {
  const k = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', k.publicKey) as Jwk; return { priv: k.privateKey, jwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } };
}
async function sign(priv: CryptoKey, header: object, claims: object) {
  const h = b64url(enc.encode(JSON.stringify(header))), p = b64url(enc.encode(JSON.stringify(claims)));
  return `${h}.${p}.${b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, enc.encode(`${h}.${p}`))))}`;
}
const TID = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const goodClaims = (p: OidcProvider, over: Partial<Claims> = {}): Claims => ({ ...(p === 'google' ? { iss: 'https://accounts.google.com', email: 'Ada@Example.com', email_verified: true }
  : { iss: `https://login.microsoftonline.com/${TID}/v2.0`, tid: TID, preferred_username: 'ada@contoso.com' }), aud: 'client-1', sub: 'user-123', iat: SEC - 10, exp: SEC + 3600, nonce: 'n-1', name: 'Ada', ...over });

test('ID token: a valid token verifies, and every tampering or mismatch is refused', async () => {
  const { priv, jwk } = await keypair('k1'), other = await keypair('k1'), jwks = { keys: [jwk] };
  for (const p of ['google', 'microsoft'] as OidcProvider[]) {
    const ok = await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p));
    assert.equal((await verifyIdToken(ok, { provider: p, jwks, audience: 'client-1', nonce: 'n-1', now: NOW })).sub, 'user-123');
    const bad: [string, string, string?][] = [
      [await sign(other.priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p)), 'bad signature'],
      [await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p, { aud: 'someone-else' })), 'wrong audience'],
      [await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p, { exp: SEC - 3600 })), 'expired'],
      [await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p, { iat: SEC + 3600 })), 'issued in the future'],
      [await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p, { nonce: 'replayed' })), 'nonce mismatch'],
      [await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims(p, { iss: 'https://evil.example' })), 'wrong issuer'],
      [await sign(priv, { alg: 'RS256', kid: 'k2' }, goodClaims(p)), 'signing key not found'],
      [`${ok.split('.')[0]}.${b64url(enc.encode(JSON.stringify(goodClaims(p, { sub: 'admin' }))))}.${ok.split('.')[2]}`, 'bad signature'],
      [`${b64url(enc.encode(JSON.stringify({ alg: 'none' })))}.${ok.split('.')[1]}.`, 'unexpected algorithm none'],
    ];
    for (const [t, why] of bad) await assert.rejects(verifyIdToken(t, { provider: p, jwks, audience: 'client-1', nonce: 'n-1', now: NOW }), new RegExp(why), `${p}: ${why}`);
  }
  const unverified = await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims('google', { email_verified: false }));
  await assert.rejects(verifyIdToken(unverified, { provider: 'google', jwks, audience: 'client-1', nonce: 'n-1', now: NOW }), /email not verified/);
  const msWrongTenant = await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims('microsoft', { iss: `https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0` }));
  await assert.rejects(verifyIdToken(msWrongTenant, { provider: 'microsoft', jwks, audience: 'client-1', nonce: 'n-1', now: NOW }), /wrong issuer/);
});

test('sealed values: round trip, tamper and expiry', async () => {
  const s = await seal({ a: 1 }, 'secret', 60, NOW);
  assert.equal((await unseal<{ a: number }>(s, 'secret', NOW))?.a, 1);
  assert.equal(await unseal(s, 'other-secret', NOW), null);
  assert.equal(await unseal(s.replace(/^./, c => c === 'A' ? 'B' : 'A'), 'secret', NOW), null);
  assert.equal(await unseal(s, 'secret', NOW + 61_000), null);
});

test('full sign-in flow with a fake provider: start, callback, session, me, logout', async () => {
  clearJwksCache();
  const { priv, jwk } = await keypair('k1'), store = new MemoryAuthStore();
  const cfg: AuthConfig = { publicUrl: 'https://build.example', appUrl: 'https://example/build/console', sessionSecret: 'test-secret', clients: { google: { id: 'client-1', secret: 'shh' } } };
  let nonce = '', tokenBody = '';
  const fakeFetch = (async (u: string | URL | Request, init?: RequestInit) => {
    const s = String(u);
    if (s.includes('certs')) return new Response(JSON.stringify({ keys: [jwk] }));
    if (s.includes('token')) { tokenBody = String(init?.body); return new Response(JSON.stringify({ id_token: await sign(priv, { alg: 'RS256', kid: 'k1' }, goodClaims('google', { nonce })) })); }
    return new Response('no', { status: 404 });
  }) as typeof fetch;
  const d = { store, fetch: fakeFetch, now: () => NOW };
  const start = (await handleAuth(new Request('https://build.example/auth/google/start'), cfg, d))!;
  assert.equal(start.status, 302);
  const loc = new URL(start.headers.get('location')!); assert.equal(loc.origin, 'https://accounts.google.com');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256'); assert.equal(loc.searchParams.get('redirect_uri'), 'https://build.example/auth/google/callback');
  nonce = loc.searchParams.get('nonce')!;
  const flowCookie = start.headers.get('set-cookie')!.split(';')[0]!;
  assert.match(start.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
  // a forged state is refused
  const forged = (await handleAuth(new Request(`https://build.example/auth/google/callback?code=c&state=forged`, { headers: { cookie: flowCookie } }), cfg, d))!;
  assert.match(forged.headers.get('location')!, /signin=failed&reason=state/);
  // the real callback signs in and sets a session
  const cb = (await handleAuth(new Request(`https://build.example/auth/google/callback?code=c&state=${loc.searchParams.get('state')}`, { headers: { cookie: flowCookie } }), cfg, d))!;
  assert.equal(cb.headers.get('location'), 'https://example/build/console');
  assert.match(tokenBody, /code_verifier=/, 'PKCE verifier sent to the token endpoint');
  const session = cb.headers.getSetCookie().find(c => c.startsWith('__Host-sb_session='))!.split(';')[0]!;
  assert.ok(![...store.sessions.keys()].includes(session.split('=')[1]!), 'only the hash of the session token is stored');
  const me = await (await handleAuth(new Request('https://build.example/api/me', { headers: { cookie: session } }), cfg, d))!.json() as { signedIn: boolean; user: { email: string }; orgs: { role: string }[] };
  assert.deepEqual([me.signedIn, me.user.email, me.orgs[0]!.role], [true, 'ada@example.com', 'owner']);
  // signing in again reuses the user and the workspace
  await handleAuth(new Request(`https://build.example/auth/google/callback?code=c&state=${loc.searchParams.get('state')}`, { headers: { cookie: flowCookie } }), cfg, d);
  assert.equal(store.users.size, 1); assert.equal(store.orgs.size, 1);
  const out = (await handleAuth(new Request('https://build.example/auth/logout', { method: 'POST', headers: { cookie: session } }), cfg, d))!;
  assert.match(out.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal((await handleAuth(new Request('https://build.example/api/me', { headers: { cookie: session } }), cfg, d))!.status, 401);
  // a provider that is not configured says so
  assert.equal((await handleAuth(new Request('https://build.example/auth/microsoft/start'), cfg, d))!.status, 503);
});

import { MemoryLoginTokens, normaliseEmail, type Mailer } from '../src/core/email-login.ts';
test('email link: request, a scanner opening the link, the button, single use, expiry, rate limit, no enumeration, login CSRF', async () => {
  const store = new MemoryAuthStore(), tokens = new MemoryLoginTokens(), sent: { to: string; text: string }[] = [];
  const mailer: Mailer = { async send(to, _s, text) { sent.push({ to, text }); } };
  let now = NOW;
  const cfg: AuthConfig = { publicUrl: 'https://build.example', appUrl: 'https://example/build/console', sessionSecret: 's', clients: {} };
  const d = { store, fetch: fetch, now: () => now, tokens, mailer };
  const ask = (email: unknown, ip = '1.2.3.4') => handleAuth(new Request('https://build.example/auth/email/start', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify({ email }) }), cfg, d);
  // same reply for any valid address; bad input refused
  const r1 = await (await ask('Ada@Example.com '))!.json() as { message: string };
  assert.match(r1.message, /If that address can receive email/);
  assert.equal((await ask('not an email'))!.status, 400);
  assert.equal((await ask('a@b.com\r\nBcc: victim@x.com'))!.status, 400);              // no header injection
  assert.equal(sent.length, 1); assert.equal(sent[0]!.to, 'ada@example.com');
  const link = new URL(/https:\S+/.exec(sent[0]!.text)![0]), token = link.searchParams.get('token')!;
  // a mail scanner opens the link: a page, no session, the token still unused
  const scan = (await handleAuth(new Request(link.toString()), cfg, d))!;
  assert.equal(scan.status, 200); assert.equal(scan.headers.get('set-cookie'), null); assert.match(await scan.text(), /<form method="post"/);
  assert.equal(tokens.rows[0]!.used, false);
  const press = (tok: string, origin = 'https://build.example') => handleAuth(new Request('https://build.example/auth/email/verify', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: `token=${tok}` }), cfg, d);
  // a form posted from another site is refused (login CSRF)
  assert.match(await (await press(token, 'https://evil.example'))!.text(), /came from somewhere else/);
  assert.equal(tokens.rows[0]!.used, false);
  // the person presses the button: signed in
  const ok = (await press(token))!;
  assert.equal(ok.status, 303); assert.equal(ok.headers.get('location'), cfg.appUrl);
  const session = ok.headers.getSetCookie().find(c => c.startsWith('__Host-sb_session='))!.split(';')[0]!;
  const me = await (await handleAuth(new Request('https://build.example/api/me', { headers: { cookie: session } }), cfg, d))!.json() as { user: { email: string; provider: string } };
  assert.deepEqual([me.user.email, me.user.provider], ['ada@example.com', 'email']);
  assert.ok(!tokens.rows.some(r => r.hash === token), 'only the hash of the link token is stored');
  // single use
  assert.match((await press(token))!.headers.get('location')!, /signin=failed/);
  // expiry
  await ask('grace@example.com'); const t2 = new URL(/https:\S+/.exec(sent.at(-1)!.text)![0]).searchParams.get('token')!;
  now += 16 * 60_000; assert.match((await press(t2))!.headers.get('location')!, /signin=failed/);
  // rate limit per address
  for (let i = 0; i < 5; i++) await ask('flood@example.com', `9.9.9.${i}`);
  assert.equal((await ask('flood@example.com', '9.9.9.99'))!.status, 429);
  assert.equal(normaliseEmail('A.B+tag@Sub.Example.co.uk'), 'a.b+tag@sub.example.co.uk'); assert.equal(normaliseEmail('a@-bad.com'), null);
});

test('the sign-in page: an email form, Microsoft and Google only when configured, a strict content policy', async () => {
  const d = { store: new MemoryAuthStore(), fetch, now: () => NOW };
  const base: AuthConfig = { publicUrl: 'https://b.example', appUrl: 'https://a', sessionSecret: 's', clients: {} };
  const r = (await handleAuth(new Request('https://b.example/auth/signin'), base, d))!;
  const html = await r.text();
  assert.match(html, /Email me a link/); assert.doesNotMatch(html, /Sign in with Microsoft/);
  assert.match(r.headers.get('content-security-policy')!, /script-src 'nonce-signin'/);
  const withMs = await (await handleAuth(new Request('https://b.example/auth/signin'), { ...base, clients: { microsoft: { id: 'x', secret: 'y' } } }, d))!.text();
  assert.match(withMs, /Sign in with Microsoft/);
});
