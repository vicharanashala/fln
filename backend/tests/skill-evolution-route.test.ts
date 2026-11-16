/**
 * Issue #481: Skill Evolution route-level regression tests.
 *
 * Verifies that the HTTP routes for skill evolution work end-to-end:
 *   1. POST /api/skills/candidates creates a candidate.
 *   2. POST /api/skills/candidates/:id/validate with action ACCEPT
 *      promotes the candidate and creates a Skill with source_type
 *      'DISCOVERED_DATA'.
 *   3. Duplicate id on POST returns 409.
 *   4. Invalid action on validate returns 400.
 *
 * Run:  cd backend && npm run test:skill-evolution-routes
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Bootstrap: isolate env + cwd BEFORE importing application modules
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-skill-evo-route-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';
process.env.SEED_DEMO_PASSWORD = 'Fln@2026';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerSkillEvolutionRoutes } = await import('../src/routes/skillEvolution');
const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;

await dbStore.init();

const app = express();
app.use(express.json());
registerSkillEvolutionRoutes(app);

const apiServer: http.Server = await new Promise(resolve => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s as http.Server));
});
const apiPort = (apiServer.address() as import('net').AddressInfo).port;
const BASE = `http://127.0.0.1:${apiPort}`;

const SUPERADMIN = 'superadmin@fln.org';

function authHeaderFor(email: string): string {
  return `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
}

async function api(method: string, reqPath: string, email: string, body?: unknown) {
  const res = await fetch(`${BASE}${reqPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: authHeaderFor(email) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

after(async () => {
  await new Promise<void>(resolve => apiServer.close(() => resolve()));
  (apiServer as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch {}
});

const sampleCandidate = {
  id: 'C-ROUTE-TEST-001',
  parentSkillId: 'M.2.OA',
  observedPattern: 'Reverses digits when writing two-digit numbers',
  evidence: {
    attemptsCount: 45,
    affectedLearnersCount: 12,
    affectedLearnersPercentage: 26.7,
    questionTemplateIds: ['tmpl-42'],
    errorTypes: ['procedural'],
  },
  algorithmConfidence: 0.82,
  proposedSubskillName: 'Digit-reversal in place-value writing',
};

test('POST /api/skills/candidates — creates candidate with status PENDING', async () => {
  const r = await api('POST', '/api/skills/candidates', SUPERADMIN, sampleCandidate);
  assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.id, sampleCandidate.id);
  assert.equal(r.json.status, 'PENDING');
  assert.equal(r.json.parentSkillId, sampleCandidate.parentSkillId);
});

test('POST /api/skills/candidates — duplicate id returns 409', async () => {
  const r = await api('POST', '/api/skills/candidates', SUPERADMIN, sampleCandidate);
  assert.equal(r.status, 409, `Expected 409, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.ok(r.json.error, 'Expected error message in body');
});

test('GET /api/skills/candidates/:id — returns the candidate', async () => {
  const r = await api('GET', `/api/skills/candidates/${sampleCandidate.id}`, SUPERADMIN);
  assert.equal(r.status, 200);
  assert.equal(r.json.id, sampleCandidate.id);
});

test('POST /api/skills/candidates/:id/validate with ACCEPT — creates Skill with source_type DISCOVERED_DATA', async () => {
  const r = await api(
    'POST',
    `/api/skills/candidates/${sampleCandidate.id}/validate`,
    SUPERADMIN,
    { action: 'ACCEPT', skillName: 'Digit-reversal subskill', notes: 'Confirmed by curriculum team' },
  );
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);

  // The response must include the promoted skill
  const skill = r.json.skill;
  assert.ok(skill, 'Response should include a skill object');
  assert.equal(skill.source_type, 'DISCOVERED_DATA', `source_type should be DISCOVERED_DATA, got ${skill.source_type}`);
  assert.equal(skill.parentSkillId, sampleCandidate.parentSkillId);

  // The candidate status must be updated to ACCEPTED
  const candidateCheck = await api('GET', `/api/skills/candidates/${sampleCandidate.id}`, SUPERADMIN);
  assert.equal(candidateCheck.json.status, 'ACCEPTED');
});

test('POST /api/skills/candidates/:id/validate with invalid action — returns 400', async () => {
  // Create a fresh candidate for this test
  const tmpId = 'C-ROUTE-TEST-BADACTION';
  await api('POST', '/api/skills/candidates', SUPERADMIN, { ...sampleCandidate, id: tmpId });

  const r = await api('POST', `/api/skills/candidates/${tmpId}/validate`, SUPERADMIN, { action: 'DEMOLISH' });
  assert.equal(r.status, 400, `Expected 400, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.ok(r.json.error, 'Expected error message in body');
});

test('GET /api/skills — lists the promoted skill', async () => {
  const r = await api('GET', '/api/skills', SUPERADMIN);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json), 'Expected array response');
  const found = r.json.find((s: any) => s.source_type === 'DISCOVERED_DATA' && s.parentSkillId === sampleCandidate.parentSkillId);
  assert.ok(found, 'Expected to find the promoted skill in GET /api/skills');
});
