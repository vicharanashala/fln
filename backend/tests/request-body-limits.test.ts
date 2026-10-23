import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import express from 'express';
import { registerRequestBodyParsers } from '../src/requestBodyParsers';

// Exercise the production parser over HTTP without booting a database, OCR,
// or the application. The final handler only reports what reached a route.
const app = express();
registerRequestBodyParsers(app);
app.use((_req, res, next) => { res.setHeader('X-Reached-Handler', 'yes'); next(); });
app.use((req, res) => res.json({ body: req.body }));
const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error.status ?? 500).json({ type: error.type });
};
app.use(errors);
const server = app.listen(0, '127.0.0.1');
let base: string;
before(async () => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

const fiveMB = 'a'.repeat(5 * 1024 * 1024);
function post(path: string, body: string, contentType = 'application/json') {
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': contentType }, body });
}

test('small JSON and nested form bodies still reach handlers unchanged', async () => {
  const json = { email: 'test@example.test', nested: { value: 1 } };
  assert.deepEqual(await (await post('/api/auth/login', JSON.stringify(json))).json(), { body: json });
  assert.deepEqual(await (await post('/api/auth/login', 'user[name]=Test', 'application/x-www-form-urlencoded')).json(),
    { body: { user: { name: 'Test' } } });
});

test('a 5 MB unauthenticated login request is rejected before the handler', async () => {
  const res = await post('/api/auth/login', JSON.stringify({ padding: fiveMB }));
  assert.equal(res.status, 413);
  assert.equal(res.headers.get('X-Reached-Handler'), null);
  assert.equal((await res.json()).type, 'entity.too.large');
});

test('ordinary JSON bodies respect the exact 1 MiB boundary', async () => {
  const overhead = JSON.stringify({ value: '' }).length;
  for (const [size, status] of [[1024 * 1024, 200], [1024 * 1024 + 1, 413]]) {
    const res = await post('/api/tickets', JSON.stringify({ value: 'a'.repeat(size - overhead) }));
    assert.equal(res.status, status);
    await res.arrayBuffer();
  }
});

for (const [path, field] of [
  ['/api/icr/check-quality', 'imageDataUrl'],
  ['/api/icr/evaluate-cloud', 'imageDataUrl'],
  ['/api/icr/evaluate-bulk', 'fileDataUrl'],
  ['/api/students/bulk-import', 'csv'],
  ['/api/question-templates/import', 'csv'],
]) {
  test(`${path} accepts a 5 MB JSON upload without truncation`, async () => {
    const res = await post(path, JSON.stringify({ [field]: fiveMB }));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).body[field], fiveMB);
  });
}

test('query strings and trailing slashes retain the upload allowance', async () => {
  const res = await post('/api/icr/check-quality/?test=1', JSON.stringify({ imageDataUrl: fiveMB }));
  assert.equal(res.status, 200);
  await res.arrayBuffer();
});

test('similar paths, child paths and other HTTP methods keep the small limit', async () => {
  for (const [path, method] of [
    ['/api/icr/check-quality-extra', 'POST'],
    ['/api/icr/check-quality/child', 'POST'],
    ['/api/icr/cloud-config', 'POST'],
    ['/api/icr/check-quality', 'PUT'],
  ]) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: fiveMB }) });
    assert.equal(res.status, 413, `${method} ${path}`);
    await res.arrayBuffer();
  }
});

test('URL-encoded bodies keep the small limit even on upload endpoints', async () => {
  for (const path of ['/api/auth/login', '/api/icr/evaluate-cloud']) {
    const res = await post(path, `value=${fiveMB}`, 'application/x-www-form-urlencoded');
    assert.equal(res.status, 413);
    await res.arrayBuffer();
  }
});

test('malformed JSON still returns 400', async () => {
  const res = await post('/api/auth/login', '{invalid');
  assert.equal(res.status, 400);
  await res.arrayBuffer();
});

test('compressed JSON cannot bypass the small limit', async () => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    body: gzipSync(JSON.stringify({ padding: fiveMB })) });
  assert.equal(res.status, 413);
  await res.arrayBuffer();
});

test('upload JSON still rejects a body larger than 100 MiB', async () => {
  // Stream a complete oversized body using a reusable chunk, not a 100 MB buffer.
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = http.request(base + '/api/icr/evaluate-bulk', { method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': 100 * 1024 * 1024 + 1,
    } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Upload limit check timed out')));
    const chunk = Buffer.alloc(1024 * 1024, ' ');
    Readable.from((function* () {
      for (let i = 0; i < 100; i++) yield chunk;
      yield Buffer.from(' ');
    })()).pipe(req);
  });
  assert.equal(status, 413);
});
