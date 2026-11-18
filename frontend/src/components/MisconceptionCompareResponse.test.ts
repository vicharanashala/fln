import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  isNoCollisionResponse,
  type NoCollisionPayload,
  type ComparePayload,
  type Fingerprint,
} from './MisconceptionFingerprint';

describe('Misconception comparison response handling (#752)', () => {
  const componentPath = path.resolve(__dirname, 'MisconceptionFingerprint.tsx');
  const source = fs.readFileSync(componentPath, 'utf-8');

  // --- Runtime Behavioral Tests ---
  describe('isNoCollisionResponse runtime type guard', () => {
    const mockFingerprintA: Fingerprint = {
      studentId: 'student_1',
      studentName: 'Student One',
      classGroup: 'Preschool 1',
      currentLevel: 1,
      score: 5,
      totalAnswered: 10,
      totalIncorrect: 5,
      vector: { l1: 0.5 },
      signature: [{ key: 'l1', label: 'Level 1', value: 0.5 }],
      weakness: {
        weakestLevel: 1,
        levelsFailed: [1],
        topics: [{ topic: 'Counting', wrong: 5, attempted: 10, rate: 0.5 }],
      },
      errors: [],
      glyph: {
        path: '',
        innerPath: '',
        hue: 0,
        accentHue: 0,
        spikes: [],
        size: 24,
        signatureHash: 'hash',
      },
    };

    const mockFingerprintB: Fingerprint = {
      ...mockFingerprintA,
      studentId: 'student_2',
      studentName: 'Student Two',
    };

    const validComparePayload: ComparePayload = {
      left: { fingerprint: mockFingerprintA, archetype: null },
      right: { fingerprint: mockFingerprintB, archetype: null },
      sameScore: true,
      sameLevel: true,
      totalCollisions: 1,
      cohortSize: 10,
      archetypeCount: 2,
      usedFallbackNaming: false,
    };

    it('1. A valid HTTP 200 no-collision payload returns true', () => {
      const validNoCollisionPayload: NoCollisionPayload = {
        left: null,
        right: null,
        reason: 'NO_COLLISION',
        message: 'No two children in this cohort share a score across different archetypes.',
      };
      expect(isNoCollisionResponse(validNoCollisionPayload)).toBe(true);
    });

    it('2. A valid comparison payload returns false', () => {
      expect(isNoCollisionResponse(validComparePayload)).toBe(false);
    });

    it('3. A payload with reason: NO_COLLISION but non-null left returns false', () => {
      const invalidLeftPayload = {
        left: { fingerprint: mockFingerprintA, archetype: null },
        right: null,
        reason: 'NO_COLLISION',
        message: 'Invalid payload with left present',
      };
      expect(isNoCollisionResponse(invalidLeftPayload)).toBe(false);
    });

    it('4. A payload with reason: NO_COLLISION but non-null right returns false', () => {
      const invalidRightPayload = {
        left: null,
        right: { fingerprint: mockFingerprintB, archetype: null },
        reason: 'NO_COLLISION',
        message: 'Invalid payload with right present',
      };
      expect(isNoCollisionResponse(invalidRightPayload)).toBe(false);
    });

    it('5. An unrelated error payload returns false', () => {
      const unrelatedErrorPayload = {
        error: 'Student not found in this cohort.',
        statusCode: 404,
      };
      expect(isNoCollisionResponse(unrelatedErrorPayload)).toBe(false);
      expect(isNoCollisionResponse(null)).toBe(false);
      expect(isNoCollisionResponse(undefined)).toBe(false);
      expect(isNoCollisionResponse('error')).toBe(false);
      expect(isNoCollisionResponse({})).toBe(false);
    });
  });

  // --- Static & Structural Contract Tests ---
  describe('Component source integration contracts', () => {
    it('declares NoCollisionPayload with left and right explicitly null and reason NO_COLLISION', () => {
      expect(source).toContain('interface NoCollisionPayload');
      expect(source).toContain("reason: 'NO_COLLISION'");
      expect(source).toContain('left: null');
      expect(source).toContain('right: null');
    });

    it('defines isNoCollisionResponse type guard to avoid unsafe any or direct property access', () => {
      expect(source).toContain('function isNoCollisionResponse');
    });

    it('handles HTTP 200 NO_COLLISION by setting noCollision=true and compare=null without accessing left/right', () => {
      const successBranch = source.match(/} else {\s*const payload: CompareResponse = await cmpRes\.json\(\);([\s\S]*?)if \(cohortRes\.ok\)/)?.[1] ?? '';
      expect(successBranch).toContain('if (isNoCollisionResponse(payload))');
      expect(successBranch).toContain('setNoCollision(true)');
      expect(successBranch).toContain('setCompare(null)');
      expect(successBranch).toContain('setCompare(payload)');
      expect(successBranch).toContain('setLeftId(payload.left.fingerprint.studentId)');
      expect(successBranch).toContain('setRightId(payload.right.fingerprint.studentId)');
    });

    it('preserves backwards compatibility for legacy 404 NO_COLLISION responses', () => {
      expect(source).toContain("if (reason === 'NO_COLLISION')");
      expect(source).toContain('setNoCollision(true)');
    });

    it('displays the empty-state explanation box when noCollision is true', () => {
      expect(source).toContain('{noCollision && cohort && cohort.analysedCount > 0 && (');
      expect(source).toContain('No side-by-side comparison for');
    });
  });
});
