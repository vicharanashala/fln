import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  getSkillOntologyProvenance,
  recordStudentAttempt,
  getStudentAttempts,
  getLearnerSkillState,
  rebuildLearnerSkillStates,
  proposeCandidateSkill,
  reviewCandidateSkill,
  getCandidateSkills,
} from './masteryModel.js';

describe('D1 — Per-Chain Mastery Model (Issue #484)', () => {
  describe('D1.1 — Skill Ontology Provenance', () => {
    test('SK13 subskills have complete 7-source provenance records', () => {
      const p1 = getSkillOntologyProvenance('SK13.01');
      assert.ok(p1, 'SK13.01 provenance record exists');
      assert.strictEqual(p1.validationStatus, 'APPROVED');
      assert.ok(p1.learningOutcome?.includes('NCERT'), 'NCERT Learning Outcome reference present');
      assert.ok(p1.competency?.includes('NIPUN'), 'NIPUN Bharat Lakshya reference present');
      assert.ok(p1.curriculumExpectation?.includes('NCF'), 'NCF-SE reference present');

      const p6 = getSkillOntologyProvenance('SK13.06');
      assert.ok(p6, 'SK13.06 provenance record exists');
      assert.strictEqual(p6.validationStatus, 'APPROVED');
    });
  });

  describe('D1.4 — Evidence Model (StudentAttempt)', () => {
    test('Records student attempt with scaffolding 0-4, representation, context, and evaluator metadata', () => {
      const attempt = recordStudentAttempt({
        studentId: 'std_test_001',
        questionId: 'q_sk13_06_1',
        paperId: 'paper_001',
        durationMs: 45000,
        isCorrect: true,
        rawResponse: '28',
        errorType: 'none',
        hintsUsed: 1,
        scaffoldingLevel: 2, // Strategic prompt
        representation: 'visual',
        context: 'real_world',
        evaluatorType: 'icr',
        confidence: 0.95,
        targetSkillId: 'SK13.06',
      });

      assert.ok(attempt.id.startsWith('att_'));
      assert.strictEqual(attempt.studentId, 'std_test_001');
      assert.strictEqual(attempt.durationMs, 45000);
      assert.strictEqual(attempt.hintsUsed, 1);
      assert.strictEqual(attempt.scaffoldingLevel, 2);
      assert.strictEqual(attempt.representation, 'visual');
      assert.strictEqual(attempt.context, 'real_world');
      assert.strictEqual(attempt.evaluatorType, 'icr');
      assert.strictEqual(attempt.confidence, 0.95);

      const saved = getStudentAttempts('std_test_001');
      assert.strictEqual(saved.length, 1);
      assert.strictEqual(saved[0].id, attempt.id);
    });

    test('Clamps scaffolding level to valid 0-4 scale', () => {
      const attempt = recordStudentAttempt({
        studentId: 'std_test_002',
        questionId: 'q_sk13_01',
        durationMs: 12000,
        isCorrect: false,
        rawResponse: '4',
        errorType: 'counting_error',
        scaffoldingLevel: 99 as any, // Invalid out of range
      });

      assert.strictEqual(attempt.scaffoldingLevel, 0, 'Invalid scaffolding defaults to 0');
    });
  });

  describe('D1.5 — Learner Skill State', () => {
    test('Learner skill state is algorithm-independent and contains no BKT columns', () => {
      const state = getLearnerSkillState('std_test_001', 'SK13.06');

      assert.ok(state.id);
      assert.strictEqual(state.studentId, 'std_test_001');
      assert.strictEqual(state.skillId, 'SK13.06');
      assert.ok(['MASTERED', 'DEVELOPING', 'NEEDS_SUPPORT', 'INSUFFICIENT_EVIDENCE'].includes(state.state));

      // Invariant check: algorithm-independent by construction (no BKT fields)
      const keys = Object.keys(state);
      assert.strictEqual(keys.includes('bkt_probability'), false);
      assert.strictEqual(keys.includes('bkt_slip'), false);
      assert.strictEqual(keys.includes('bkt_guess'), false);
    });

    test('Evaluates staleness and returns INSUFFICIENT_EVIDENCE when observations are old', () => {
      // Simulate stale skill state
      const staleState = getLearnerSkillState('std_test_stale', 'SK13.05', { checkStaleness: true, stalenessDays: 0 });
      assert.strictEqual(staleState.state, 'INSUFFICIENT_EVIDENCE');
    });

    test('State is derivable and rebuildable from raw attempt records alone', () => {
      const attempts = [
        {
          attempt: {
            id: 'att_rb_1',
            studentId: 'std_rebuild_user',
            questionId: 'q1',
            submittedAt: '2026-09-01T10:00:00Z',
            durationMs: 30000,
            isCorrect: true,
            rawResponse: '12',
            errorType: 'none',
            hintsUsed: 0,
            scaffoldingLevel: 0 as const,
            representation: 'symbolic' as const,
            context: 'direct' as const,
            evaluatorType: 'rule_engine' as const,
            confidence: 1.0,
          },
          targetSkillId: 'SK13.04',
        },
        {
          attempt: {
            id: 'att_rb_2',
            studentId: 'std_rebuild_user',
            questionId: 'q2',
            submittedAt: '2026-09-02T10:00:00Z',
            durationMs: 25000,
            isCorrect: true,
            rawResponse: '15',
            errorType: 'none',
            hintsUsed: 0,
            scaffoldingLevel: 0 as const,
            representation: 'symbolic' as const,
            context: 'direct' as const,
            evaluatorType: 'rule_engine' as const,
            confidence: 1.0,
          },
          targetSkillId: 'SK13.04',
        },
      ];

      const rebuilt = rebuildLearnerSkillStates('std_rebuild_user', attempts);
      assert.strictEqual(rebuilt.length, 1);
      assert.strictEqual(rebuilt[0].skillId, 'SK13.04');
      assert.strictEqual(rebuilt[0].evidenceCount, 2);
      assert.strictEqual(rebuilt[0].correctCount, 2);
      assert.strictEqual(rebuilt[0].state, 'MASTERED');
    });
  });

  describe('D1.6 — Skill Evolution (CandidateSkill & Human-in-the-loop Validation)', () => {
    test('Proposes a candidate skill with PENDING/PROPOSED status', () => {
      const candidate = proposeCandidateSkill({
        proposedBy: 'error_clustering_v1',
        parentSkillId: 'SK13.07',
        suggestedName: 'Regrouping across zero placeholder',
        suggestedDescription: 'Failure mode when carrying over a middle zero digit',
        evidenceErrorClusterIds: ['cluster_err_089'],
        sampleStudentResponses: ['402 - 187 = 315', '503 - 249 = 354'],
      });

      assert.ok(candidate.id.startsWith('cand_'));
      assert.strictEqual(candidate.status, 'PROPOSED');
      assert.strictEqual(candidate.parentSkillId, 'SK13.07');

      const list = getCandidateSkills({ status: 'PROPOSED' });
      assert.ok(list.some(c => c.id === candidate.id));
    });

    test('Human-in-the-loop: Candidate skill requires human ACCEPT/APPROVED to graduate to active ontology', () => {
      const candidate = proposeCandidateSkill({
        proposedBy: 'teacher_rachit',
        parentSkillId: 'SK13.06',
        suggestedName: 'Multi-operand two-digit addition',
        suggestedDescription: 'Adding three 2-digit numbers simultaneously',
        evidenceErrorClusterIds: ['cluster_err_092'],
        sampleStudentResponses: ['12 + 15 + 20 = 37'],
      });

      assert.strictEqual(candidate.status, 'PROPOSED');

      // Review and approve candidate skill by curriculum lead
      const reviewed = reviewCandidateSkill({
        candidateId: candidate.id,
        reviewedBy: 'jinal_curriculum_lead',
        decision: 'APPROVED',
        decisionNotes: 'Approved after pedagogical review against NCF-SE 2023',
        targetSubskillId: 'SK13.11',
      });

      assert.strictEqual(reviewed.status, 'APPROVED');
      assert.strictEqual(reviewed.reviewedBy, 'jinal_curriculum_lead');
      assert.strictEqual(reviewed.targetSubskillId, 'SK13.11');

      // Verify created subskill provenance
      const provenance = getSkillOntologyProvenance('SK13.11');
      assert.ok(provenance, 'Approved candidate skill created active ontology provenance');
      assert.strictEqual(provenance.validationStatus, 'APPROVED');
    });
  });
});
