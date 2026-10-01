import express from 'express';
import { getAuthUser } from '../auth';
import {
  recordStudentAttempt,
  getStudentAttempts,
  getLearnerSkillState,
  rebuildLearnerSkillStates,
  proposeCandidateSkill,
  reviewCandidateSkill,
  getCandidateSkills,
  getSkillOntologyProvenance,
  getAllSkillOntologyProvenance,
  CandidateSkillStatus,
} from '../masteryModel';

export function registerMasteryModelRoutes(app: express.Express) {
  /**
   * POST /api/mastery/attempts
   * Record a student attempt (D1.4 Evidence Model).
   */
  app.post('/api/mastery/attempts', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId, questionId, durationMs, isCorrect, rawResponse, errorType } = req.body;

    if (!studentId || !questionId || typeof isCorrect !== 'boolean') {
      return res.status(400).json({
        error: 'studentId, questionId, and boolean isCorrect are required fields',
      });
    }

    try {
      const attempt = recordStudentAttempt({
        studentId,
        questionId,
        paperId: req.body.paperId,
        submittedAt: req.body.submittedAt,
        durationMs: Number(durationMs) || 0,
        isCorrect,
        rawResponse: rawResponse || '',
        errorType: errorType || (isCorrect ? 'none' : 'unclassified'),
        hintsUsed: Number(req.body.hintsUsed) || 0,
        scaffoldingLevel: req.body.scaffoldingLevel,
        representation: req.body.representation,
        context: req.body.context,
        evaluatorType: req.body.evaluatorType,
        confidence: req.body.confidence,
        targetSkillId: req.body.targetSkillId,
      });

      res.status(201).json({ attempt });
    } catch (err: any) {
      console.error('[masteryModel] failed to record attempt:', err);
      res.status(500).json({ error: 'Failed to record attempt' });
    }
  });

  /**
   * GET /api/mastery/attempts/:studentId
   * Fetch attempts for a student.
   */
  app.get('/api/mastery/attempts/:studentId', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { studentId } = req.params;
    try {
      const attempts = getStudentAttempts(studentId, {
        questionId: req.query.questionId as string,
        paperId: req.query.paperId as string,
      });
      res.json({ studentId, count: attempts.length, attempts });
    } catch (err: any) {
      console.error(`[masteryModel] failed to fetch attempts for ${studentId}:`, err);
      res.status(500).json({ error: 'Failed to fetch student attempts' });
    }
  });

  /**
   * GET /api/mastery/skill-state/:studentId/:skillId
   * Fetch algorithm-independent learner skill belief state (D1.5).
   */
  app.get('/api/mastery/skill-state/:studentId/:skillId', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { studentId, skillId } = req.params;
    try {
      const checkStaleness = req.query.checkStaleness !== 'false';
      const skillState = getLearnerSkillState(studentId, skillId, { checkStaleness });
      res.json(skillState);
    } catch (err: any) {
      console.error(`[masteryModel] failed to fetch skill state for ${studentId}/${skillId}:`, err);
      res.status(500).json({ error: 'Failed to fetch learner skill state' });
    }
  });

  /**
   * POST /api/mastery/skill-state/:studentId/rebuild
   * Rebuild learner skill state from raw student attempt records (D1.5 invariant).
   */
  app.post('/api/mastery/skill-state/:studentId/rebuild', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { studentId } = req.params;
    const { attemptsWithSkills } = req.body;

    if (!Array.isArray(attemptsWithSkills)) {
      return res.status(400).json({ error: 'attemptsWithSkills array is required' });
    }

    try {
      const rebuiltStates = rebuildLearnerSkillStates(studentId, attemptsWithSkills);
      res.json({ studentId, rebuiltStatesCount: rebuiltStates.length, states: rebuiltStates });
    } catch (err: any) {
      console.error(`[masteryModel] failed to rebuild skill states for ${studentId}:`, err);
      res.status(500).json({ error: 'Failed to rebuild skill states' });
    }
  });

  /**
   * POST /api/mastery/candidate-skills
   * Propose a candidate skill from a cluster of classified errors (D1.6 Skill Evolution).
   */
  app.post('/api/mastery/candidate-skills', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { proposedBy, parentSkillId, suggestedName, suggestedDescription } = req.body;

    if (!proposedBy || !parentSkillId || !suggestedName) {
      return res.status(400).json({
        error: 'proposedBy, parentSkillId, and suggestedName are required fields',
      });
    }

    try {
      const candidate = proposeCandidateSkill({
        proposedBy,
        parentSkillId,
        suggestedName,
        suggestedDescription: suggestedDescription || '',
        evidenceErrorClusterIds: req.body.evidenceErrorClusterIds || [],
        sampleStudentResponses: req.body.sampleStudentResponses || [],
      });

      res.status(201).json({ candidate });
    } catch (err: any) {
      console.error('[masteryModel] failed to propose candidate skill:', err);
      res.status(500).json({ error: 'Failed to propose candidate skill' });
    }
  });

  /**
   * GET /api/mastery/candidate-skills
   * List candidate skills (filterable by status).
   */
  app.get('/api/mastery/candidate-skills', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const candidates = getCandidateSkills({
        status: req.query.status as CandidateSkillStatus,
        parentSkillId: req.query.parentSkillId as string,
      });
      res.json({ count: candidates.length, candidates });
    } catch (err: any) {
      console.error('[masteryModel] failed to list candidate skills:', err);
      res.status(500).json({ error: 'Failed to list candidate skills' });
    }
  });

  /**
   * PATCH /api/mastery/candidate-skills/:id/review
   * Human-in-the-loop validation endpoint (D1.6). Sets APPROVED / REJECTED / MERGED.
   */
  app.patch('/api/mastery/candidate-skills/:id/review', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { reviewedBy, decision, decisionNotes, targetSubskillId } = req.body;

    if (!reviewedBy || !['APPROVED', 'REJECTED', 'MERGED'].includes(decision)) {
      return res.status(400).json({
        error: 'reviewedBy and valid decision (APPROVED | REJECTED | MERGED) are required',
      });
    }

    try {
      const updated = reviewCandidateSkill({
        candidateId: id,
        reviewedBy,
        decision,
        decisionNotes,
        targetSubskillId,
      });

      res.json({ candidate: updated });
    } catch (err: any) {
      console.error(`[masteryModel] failed to review candidate skill ${id}:`, err);
      res.status(500).json({ error: err.message || 'Failed to review candidate skill' });
    }
  });

  /**
   * GET /api/mastery/ontology-provenance/:skillId
   * Query 7-source ontology provenance metadata for a skill (D1.1).
   */
  app.get('/api/mastery/ontology-provenance/:skillId', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { skillId } = req.params;
    try {
      const provenance = getSkillOntologyProvenance(skillId);
      if (!provenance) {
        return res.status(404).json({ error: `No ontology provenance recorded for skill ${skillId}` });
      }
      res.json(provenance);
    } catch (err: any) {
      console.error(`[masteryModel] failed to fetch provenance for ${skillId}:`, err);
      res.status(500).json({ error: 'Failed to fetch ontology provenance' });
    }
  });

  /**
   * GET /api/mastery/ontology-provenance
   * List all ontology provenance records.
   */
  app.get('/api/mastery/ontology-provenance', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const provenanceList = getAllSkillOntologyProvenance();
      res.json({ count: provenanceList.length, provenance: provenanceList });
    } catch (err: any) {
      console.error('[masteryModel] failed to list ontology provenance:', err);
      res.status(500).json({ error: 'Failed to list ontology provenance' });
    }
  });
}
