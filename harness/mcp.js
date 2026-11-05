'use strict';
// MCP front doors to the gateway. Any MCP-capable agent can connect, discover the tools and work a task; every call is logged to that
// trial's trace by the gateway, whichever way the agent arrived.
//   buildServer(trial)  an MCP server exposing the gateway's tools for one trial
//   createHttp()        streamable HTTP: one bearer token per trial, so a client's agent can run anywhere (their cloud, their laptop)
//   stdio               node mcp.js --task res-001   (for an agent running next to the harness, e.g. on the client's own hardware)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { TOOLS, Trial, call } = require('./gateway');
const { generate } = require('./tasks');
const { miningTasks, securityTasks } = require('./packs');

function buildServer(trial) {
  const server = new McpServer({ name: 'scorcher-build', version: '0.1.0' });
  for (const [name, t] of Object.entries(TOOLS)) {
    server.registerTool(name, { description: t.description, inputSchema: t.shape }, async args => {
      try { return { content: [{ type: 'text', text: JSON.stringify(call(trial, name, args)) }] }; }
      catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
  }
  return server;
}

function createHttp() {
  const trials = new Map();   // token -> Trial
  const srv = http.createServer((req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url !== '/mcp') return send(404, { error: 'not found' });
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || ''), trial = m && trials.get(m[1]);
    if (!trial) return send(401, { error: 'a valid trial token is required' });
    if (req.method !== 'POST') return send(405, { error: 'POST only (stateless MCP)' });
    let body = ''; req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let json; try { json = JSON.parse(body); } catch { return send(400, { error: 'invalid JSON' }); }
      const server = buildServer(trial), transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => { transport.close(); server.close(); });
      try { await server.connect(transport); await transport.handleRequest(req, res, json); } catch (e) { if (!res.headersSent) send(500, { error: e.message }); }
    });
  });
  return { srv, trials,
    open(task, opts) { const trial = new Trial('trial-' + crypto.randomBytes(4).toString('hex'), task, opts), token = crypto.randomBytes(24).toString('hex'); trials.set(token, trial); return { trial, token }; },
    listen: (port = 0) => new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv.address().port))), close: () => new Promise(r => srv.close(r)) };
}

if (require.main === module) {
  const id = process.argv[process.argv.indexOf('--task') + 1] || 'res-001', task = [...generate(), ...miningTasks(), ...securityTasks()].find(t => t.id === id);
  if (!task) { console.error('unknown task: ' + id); process.exit(1); }
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js'), trial = new Trial('stdio-' + id, task);
  buildServer(trial).connect(new StdioServerTransport()).then(() => {
    process.stdin.on('close', () => { trial.ended = Date.now(); fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', trial.id + '.json'), JSON.stringify({ summary: trial.summary(), trace: trial.trace, attempts: trial.attempts }, null, 1)); });
  });
}
module.exports = { buildServer, createHttp };
