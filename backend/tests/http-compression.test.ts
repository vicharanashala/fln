import assert from 'node:assert/strict';
import { once } from 'node:events';
import http, { type IncomingHttpHeaders, type OutgoingHttpHeaders } from 'node:http';
import express from 'express';
import compression from 'compression';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const payload = {
  students: Array.from({ length: 250 }, (_, index) => ({
    id: `student-${index}`,
    name: 'Example student record repeated for compression coverage',
    classGroup: 'Class 2',
    section: 'A',
  })),
};

async function startServer() {
  const app = express();
  app.use(compression());
  app.get('/api/students', (_req, res) => res.json(payload));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, url: `http://127.0.0.1:${address.port}/api/students` };
}

function request(url: string, headers: OutgoingHttpHeaders = {}) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }>((resolveRequest, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolveRequest({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
  });
}

async function closeServer(server: http.Server) {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
}

test('large JSON responses are gzip-compressed when the client supports gzip', async () => {
  const { server, url } = await startServer();
  try {
    const response = await request(url, { 'accept-encoding': 'gzip' });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-encoding'], 'gzip');
    assert.match(String(response.headers.vary), /Accept-Encoding/i);
    assert.deepEqual(JSON.parse(gunzipSync(response.body).toString('utf8')), payload);
  } finally {
    await closeServer(server);
  }
});

test('JSON responses stay uncompressed when the client requests identity encoding', async () => {
  const { server, url } = await startServer();
  try {
    const response = await request(url, { 'accept-encoding': 'identity' });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-encoding'], undefined);
    assert.deepEqual(JSON.parse(response.body.toString('utf8')), payload);
  } finally {
    await closeServer(server);
  }
});

test('the production API installs compression before body parsers', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const install = source.indexOf('app.use(compression());');
  const jsonParser = source.indexOf('app.use(express.json(');
  const urlEncodedParser = source.indexOf('app.use(express.urlencoded(');
  assert.ok(install >= 0, 'expected compression middleware in backend/src/index.ts');
  assert.ok(jsonParser > install, 'compression must be installed before express.json');
  assert.ok(urlEncodedParser > install, 'compression must be installed before express.urlencoded');
});
