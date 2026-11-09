'use strict';
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const path = require('node:path');

const shim = path.join(__dirname, 'bind-local.cjs');
/** Runs a small program with the shim loaded and returns the address its server ended up on. */
function addressOf(code) {
  const r = spawnSync(process.execPath, ['--require', shim, '-e', code], { encoding: 'utf8', timeout: 10000 });
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim());
}
const serve = (listenCall) => `const s = require('node:http').createServer(); ${listenCall}; s.on('listening', () => { console.log(JSON.stringify(s.address())); s.close(); });`;

test('"all addresses" becomes this machine only', () => {
  assert.strictEqual(addressOf(serve("s.listen(0, '0.0.0.0')")).address, '127.0.0.1');
  assert.strictEqual(addressOf(serve("s.listen(0, '::')")).address, '127.0.0.1');
});
test('listening with no host, with only a callback, or with a backlog is also local', () => {
  assert.strictEqual(addressOf(serve('s.listen(0)')).address, '127.0.0.1');
  assert.strictEqual(addressOf(serve('s.listen(0, () => {})')).address, '127.0.0.1');
  assert.strictEqual(addressOf(serve('s.listen(0, 511)')).address, '127.0.0.1');
});
test('an options object is handled the same way', () => {
  assert.strictEqual(addressOf(serve("s.listen({ port: 0, host: '0.0.0.0' })")).address, '127.0.0.1');
  assert.strictEqual(addressOf(serve('s.listen({ port: 0 })')).address, '127.0.0.1');
});
test('an explicit local address stays, and Express-style app.listen is covered', () => {
  assert.strictEqual(addressOf(serve("s.listen(0, '127.0.0.1')")).address, '127.0.0.1');
  const code = "const http = require('node:http'); const server = http.createServer((q, r) => r.end('ok')); const n = require('node:net'); " +
    "const o = http.Server.prototype.listen; server.listen(0, '0.0.0.0', () => { console.log(JSON.stringify(server.address())); server.close(); });";
  assert.strictEqual(addressOf(code).address, '127.0.0.1');
});
test('a socket path is left alone', () => {
  const sock = path.join(require('node:os').tmpdir(), `bind-local-${process.pid}.sock`);
  const r = addressOf(serve(`s.listen(${JSON.stringify(sock)})`));
  assert.strictEqual(r, sock);
});
