// Durable Object: one instance per streamer lobby, holding the live race in memory and the viewers' WebSockets.
import { LobbyCore } from './lobby-core.js';
const TTL = 12 * 3600e3;

export class Lobby {
  constructor(state) { this.state = state; this.core = null; }

  async load() {
    if (this.core) return this.core;
    const init = await this.state.storage.get('init'); if (!init) return null;
    this.core = new LobbyCore({ code: init.code, hostKey: init.hostKey });
    this.core.setPuzzle(init.puzzle);
    return this.core;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/init' && request.method === 'POST') {
      if (await this.state.storage.get('init')) return new Response('exists', { status: 409 });
      const b = await request.json(), probe = new LobbyCore({ code: b.code, hostKey: b.hostKey });
      if (!probe.setPuzzle(b.puzzle)) return new Response('bad puzzle', { status: 400 });
      await this.state.storage.put('init', { code: b.code, hostKey: b.hostKey, puzzle: probe.puzzle });
      await this.state.storage.setAlarm(Date.now() + TTL);
      return new Response('ok');
    }
    const core = await this.load(); if (!core) return new Response('no such lobby', { status: 404 });
    if (path === '/info') return new Response(JSON.stringify({ code: core.code, phase: core.phase, n: core.players.size }), { headers: { 'content-type': 'application/json' } });
    if (path === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      const conn = { send: s => { try { server.send(s); } catch {} } };
      server.addEventListener('message', e => { if (typeof e.data === 'string' && e.data.length < 2000) core.message(conn, e.data); });
      const drop = () => core.leave(conn);
      server.addEventListener('close', drop); server.addEventListener('error', drop);
      core.join(conn);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('not found', { status: 404 });
  }

  async alarm() { this.core = null; await this.state.storage.deleteAll(); }
}
