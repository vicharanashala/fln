'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Keep the file-backed DB isolated from backend/data/db.json
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-ocr-keys-test-'));
const dataDir = path.join(scratchDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.copyFileSync(path.join(REPO_ROOT, 'backend', 'data', 'db.json'), path.join(dataDir, 'db.json'));

let server;
let baseUrl;
let token;

test.before(async () => {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: 3015,
      MONGODB_URI: '',
      JWT_SECRET: 'test-secret'
    });

    server = spawn('node', [path.resolve(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs'), path.resolve(REPO_ROOT, 'backend/src/index.ts')], { cwd: scratchDir, env });

    server.stdout.on('data', async (d) => {
      if (d.toString().includes('Server running')) {
        baseUrl = 'http://localhost:3015';
        try {
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'gps-mt-001.t01@fln.org', password: 'Fln@2026' })
          });
          const data = await res.json();
          token = data.token;
          resolve();
        } catch(e) {
          reject(e);
        }
      }
    });

    server.stderr.on('data', d => console.error(d.toString()));
  });
});

test.after(async () => {
  if (server) {
    server.kill();
    await new Promise(resolve => server.on('exit', resolve));
  }
  try {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  } catch (e) {
    if (e.code !== 'EBUSY') throw e;
  }
});

async function submit(studentId, answers) {
  const res = await fetch(`${baseUrl}/api/students/${studentId}/baseline/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answers })
  });
  return { status: res.status, body: await res.json() };
}

test('INTEGRATION: Backend students route accepts legacy Q1 format', async () => {
  // Using student s1
  const res = await submit('s1', { 'Q1': '66', 'Q2': '68' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.assignedLevel, 62);
});

test('INTEGRATION: Backend students route accepts OCR generated keys (q_1, q_2)', async () => {
  // Using student s2 (same class as s1)
  const res = await submit('s2', { 'q_1': '66', 'q_2': '68' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.assignedLevel, 62);
});

test('INTEGRATION: Backend students route preserves error validation format for invalid keys', async () => {
  // Using student s17
  const res = await submit('s17', { 'invalid': 'value' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Expected question ids like "Q_L60_1" or positions "Q1"\.\."Q10" \(or "q_1"\.\."q_10"\)/);
});

test('INTEGRATION: Backend students route returns error for out of range keys', async () => {
  // Using student s26
  const res = await submit('s26', { 'Q_99': 'value' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Expected question ids like "Q_L60_1" or positions "Q1"\.\."Q10" \(or "q_1"\.\."q_10"\)/);
});
