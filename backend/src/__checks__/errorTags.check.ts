import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { TOPIC_ERROR_TAGS, getErrorTagsForTopic, isValidErrorTag } from '../errorTags.js';
import { registerErrorTagsRoutes } from '../routes/errorTags.js';
import { registerQuestionTemplateRoutes } from '../routes/questionTemplates.js';
import { dbStore, UserRole } from '../db.js';
import { JWT_SECRET } from '../auth.js';

console.log('Running errorTags checks (Issue #626)...');

// 1. Verify Balvatika topic keys and exact tag lists
assert.ok(TOPIC_ERROR_TAGS['counting'], 'counting topic should exist');
assert.ok(TOPIC_ERROR_TAGS['shapes'], 'shapes topic should exist');
assert.ok(TOPIC_ERROR_TAGS['patterns'], 'patterns topic should exist');
assert.ok(TOPIC_ERROR_TAGS['literacy'], 'literacy topic should exist');

// 1a. counting tags (Gelman & Gallistel 5 counting principles)
const countingTags = getErrorTagsForTopic('counting') as string[];
assert.equal(countingTags.length, 5, 'counting should have exactly 5 tags');
assert.deepEqual(countingTags, [
  'one-to-one-slip',
  'stable-order-error',
  'cardinality-miss',
  'abstraction-error',
  'order-irrelevance-confusion',
]);

// 1b. shapes tags
const shapeTags = getErrorTagsForTopic('shapes') as string[];
assert.deepEqual(shapeTags, ['under-inclusion', 'over-generalization']);

// 1c. patterns tags
const patternTags = getErrorTagsForTopic('patterns') as string[];
assert.deepEqual(patternTags, ['missing-item', 'swapped-item', 'extra-item']);

// 1d. literacy tags (placeholder for follow-up issue)
const literacyTags = getErrorTagsForTopic('literacy') as string[];
assert.deepEqual(literacyTags, []);

// 2. Prototype key safety (constructor bug fix)
assert.equal(getErrorTagsForTopic('constructor'), null, 'constructor should return null');
assert.equal(isValidErrorTag('constructor', 'x'), false, 'constructor lookup should safely return false without throwing');

// 3. isValidErrorTag function verification
assert.equal(isValidErrorTag('shapes', 'under-inclusion'), true);
assert.equal(isValidErrorTag('shapes', 'over-generalization'), true);
assert.equal(isValidErrorTag('shapes', 'attribute-confusion'), false);
assert.equal(isValidErrorTag('patterns', 'missing-item'), true);
assert.equal(isValidErrorTag('patterns', 'unit-misidentification'), false);
assert.equal(isValidErrorTag('invalid-topic', 'under-inclusion'), false);

// 4. HTTP Route & Backend Validator checks
const app = express();
app.use(express.json());
registerErrorTagsRoutes(app);
registerQuestionTemplateRoutes(app);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}`;

// Setup mock superadmin user in dbStore
const user = { id: 'test-superadmin', email: 'superadmin@fln.org', name: 'Superadmin', role: UserRole.SUPERADMIN };
await dbStore.init();
await dbStore.addUser(user);
const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

try {
  // 4a. GET /api/error-tags?topic=shapes
  const shapeRes = await fetch(`${baseUrl}/api/error-tags?topic=shapes`, { headers: authHeaders });
  assert.equal(shapeRes.status, 200);
  const shapeData = await shapeRes.json() as any;
  assert.deepEqual(shapeData.tags, ['under-inclusion', 'over-generalization']);

  // 4b. GET /api/error-tags?topic=constructor returns 400 (not 200 with empty/function)
  const ctorRes = await fetch(`${baseUrl}/api/error-tags?topic=constructor`, { headers: authHeaders });
  assert.equal(ctorRes.status, 400);

  // 4c. Backend validator: valid errorTag saves (201)
  const validTemplateBody = {
    conceptId: 'S3.1',
    skills: ['SK05'],
    generationIntent: 'The child counts the objects shown and writes one numeral in the answer space.',
    questionFamily: 'counting',
    svgThemeIds: ['fruits'],
    errorTag: 'cardinality-miss',
    topic: 'counting',
  };
  const saveRes = await fetch(`${baseUrl}/api/question-templates`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(validTemplateBody),
  });
  const savedData = await saveRes.json() as any;
  assert.equal(saveRes.status, 201, 'Valid template with valid errorTag should save with status 201');
  assert.equal(savedData.template.errorTag, 'cardinality-miss');

  // 4d. Backend validator: invalid errorTag returns 400
  const invalidTemplateBody = {
    conceptId: 'S3.1',
    skills: ['SK05'],
    generationIntent: 'The child counts the objects shown and writes one numeral in the answer space.',
    questionFamily: 'counting',
    svgThemeIds: ['fruits'],
    errorTag: 'non-existent-tag',
    topic: 'counting',
  };
  const failRes = await fetch(`${baseUrl}/api/question-templates`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(invalidTemplateBody),
  });
  assert.equal(failRes.status, 400, 'Template with unknown errorTag should fail validation with status 400');
  const failData = await failRes.json() as any;
  assert.match(failData.error, /Unknown error tag 'non-existent-tag'/);

  console.log('✅ All errorTags unit checks and backend validator checks passed!');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
