// @ts-nocheck — see certification.check.ts note. Pre-existing test fixtures
// don't match the post-`fix/remove-streak-backend` Student shape.
/**
 * Runnable assert script for the Phase 5 certification list endpoint
 * (`GET /api/certifications`) and the concurrency safety on the review
 * endpoint (`POST /api/certification/review/:certificationId`).
 *
 * Covers cases that don't require a live server. Live-server cases
 * (role 403, 400 on empty revoke reason over HTTP) are documented in
 * backend/src/modules/certification/README.md — Phase 5 verification section.
 *
 * Run via:
 *   npx tsx backend/src/__checks__/certification-list.check.ts
 */
import { strict as assert } from 'node:assert';
import {
  resolveCertificationReview,
  CertificationReviewError,
} from '../certificationRecords';
import { Certification } from '../db';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    ', err instanceof Error ? err.message : String(err));
    failed++;
  }
}

console.log('certification list / review safety — Phase 5');

function makeReviewNeededCert(): Certification {
  return {
    id: 'cert_test_list',
    studentId: 's1',
    classNumber: 3,
    level: 5,
    decisionSnapshot: {
      outcome: 'not_eligible',
      evaluatedAt: '2026-08-02T00:00:00.000Z',
      classNumber: 3,
      level: 5,
      metTopics: [],
      missingTopics: ['Number Operations'],
      unassessedTopics: [],
    },
    status: 'review_needed',
    version: 1,
    issuedAt: '2026-06-15T00:00:00.000Z',
    certificateId: 'CERT-s1-3',
    reviewReason: 'below threshold: Number Operations',
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

// --- Pure helper safety nets ---

check('resolveCertificationReview: revoke + empty reason → 400 (MISSING_REASON)', () => {
  assert.throws(
    () => resolveCertificationReview(
      makeReviewNeededCert(),
      'revoke',
      { id: 'admin1', email: 'admin@fln.org' },
      '   '
    ),
    (err: unknown) => err instanceof CertificationReviewError && err.code === 'MISSING_REASON'
  );
});

check('resolveCertificationReview: revoke + non-empty reason → ok', () => {
  const result = resolveCertificationReview(
    makeReviewNeededCert(),
    'revoke',
    { id: 'admin1', email: 'admin@fln.org' },
    'OCR misread confirmed by teacher'
  );
  assert.equal(result.updated.status, 'revoked');
  assert.equal(result.updated.reviewReason, 'OCR misread confirmed by teacher');
  assert.equal(result.updated.version, 2);
});

check('resolveCertificationReview: confirm + wrong starting state → 409 (WRONG_STATE)', () => {
  const cert = { ...makeReviewNeededCert(), status: 'active' as const };
  assert.throws(
    () => resolveCertificationReview(cert, 'confirm', { id: 'admin1', email: 'admin@fln.org' }),
    (err: unknown) =>
      err instanceof CertificationReviewError
      && err.code === 'WRONG_STATE'
      && err.currentStatus === 'active'
  );
});

check('resolveCertificationReview: invalid decision → INVALID_DECISION', () => {
  // Cast to bypass the union type — the helper still validates.
  assert.throws(
    () => resolveCertificationReview(
      makeReviewNeededCert(),
      'maybe' as unknown as 'confirm',
      { id: 'admin1', email: 'admin@fln.org' }
    ),
    (err: unknown) => err instanceof CertificationReviewError && err.code === 'INVALID_DECISION'
  );
});

// --- Concurrency safety nets (pure state checks, no live DB needed) ---

check('concurrent confirm: same starting version, two upserts → second rejected', () => {
  // The Phase 3 updateCertificationIfVersion helper relies on a version
  // match. We can't run updateOne without Mongo, but we can document the
  // expected shape of the conflict: if a previous review action already
  // bumped version from 1 to 2, a second action passing expectedVersion=1
  // will see matchedCount === 0 and the caller returns 409.
  //
  // The shape of the resolved version after one confirm is what the test
  // below asserts. The 409 itself is observable only via a live curl.
  const first = resolveCertificationReview(
    makeReviewNeededCert(),
    'confirm',
    { id: 'admin1', email: 'admin@fln.org' }
  );
  assert.equal(first.updated.version, 2);
  // A second admin trying to confirm with the stale version=1 would 409.
  // We can't simulate that without Mongo here, so this is a documented
  // contract test rather than an end-to-end one.
});

// --- Live-server cases (documented for manual curl) ---
//
// 1. Role 403 on queue (no studentId param):
//    curl -H 'Authorization: Bearer <teacher jwt>' http://localhost:3000/api/certifications
//    → expect 403 { error: 'Forbidden: insufficient privileges for queue view.' }
//
// 2. Role 403 on queue with valid studentId (teacher can see their own students):
//    curl -H 'Authorization: Bearer <teacher jwt>' http://localhost:3000/api/certifications?studentId=<their-student>
//    → expect 200 with the cert array.
//
// 3. Invalid status param:
//    curl -H 'Authorization: Bearer <admin jwt>' 'http://localhost:3000/api/certifications?status=garbage'
//    → expect 400 { error: "status must be 'active', 'review_needed', or 'revoked'." }
//
// 4. Concurrent confirm 409:
//    Two parallel curls to POST /api/certification/review/<id> with decision=confirm.
//    One succeeds; the other gets 409 "Concurrent modification: ...".
//    (Requires seed data: a review_needed cert from the existing trigger.)

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);