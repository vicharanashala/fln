import express from 'express';
import { dbStore, CandidateSkill, Skill, CandidateSkillStatus } from '../db';
import { getAuthUser } from '../auth';
import { requireSuperadmin } from './superadminGuard';

/**
 * D1.6 — Skill Evolution Routes (#481)
 *
 * The pipeline, and the one rule that matters most:
 *
 *   Student data -> Algorithmic analysis -> Candidate error patterns -> Candidate subskill
 *                -> Human/educational validation -> New skill version
 *
 * Don't make AI the authority. An algorithm can cluster responses, flag recurring patterns,
 * generate a candidate label, and estimate a confidence score. It CANNOT add a subskill
 * to the ontology. Only a human validator (Superadmin / Curriculum Expert) can do that.
 *
 * Actions:
 *   - ACCEPT: Promotes candidate into a real Skill with source_type = 'DISCOVERED_DATA'.
 *   - REJECT: Declines candidate with rationale.
 *   - MERGE: Merges pattern into existing parent or sibling skill.
 *   - SPLIT: Flags candidate for division into more granular subskills.
 *   - REDEFINE: Clarifies candidate label and bounds.
 */
export function registerSkillEvolutionRoutes(app: express.Express) {
  /**
   * List candidate skills for human/educational validation.
   * Authenticated: Any logged-in staff can view candidate status.
   */
  app.get('/api/skills/candidates', async (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { status, parentSkillId } = req.query;
      const candidates = await dbStore.getCandidateSkills({
        status: status ? (String(status).toUpperCase() as CandidateSkillStatus) : undefined,
        parentSkillId: parentSkillId ? String(parentSkillId) : undefined,
      });
      res.json(candidates);
    } catch (err: any) {
      console.error('[skills/candidates] failed to list candidate skills:', err);
      res.status(500).json({ error: 'Failed to list candidate skills.' });
    }
  });

  /**
   * Get a single candidate skill by id.
   */
  app.get('/api/skills/candidates/:id', async (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const candidate = await dbStore.getCandidateSkillById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: `Candidate skill ${req.params.id} not found.` });
      }
      res.json(candidate);
    } catch (err: any) {
      console.error('[skills/candidates] failed to get candidate skill:', err);
      res.status(500).json({ error: 'Failed to get candidate skill.' });
    }
  });

  /**
   * Create a new candidate skill record.
   * Can be created by algorithmic analysis or human experts proposing a pattern.
   */
  app.post('/api/skills/candidates', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      parentSkillId,
      observedPattern,
      evidence,
      algorithmConfidence,
      proposedSubskillName,
      reviewNotes,
    } = req.body;

    if (!parentSkillId || !observedPattern) {
      return res.status(400).json({ error: 'parentSkillId and observedPattern are required.' });
    }

    if (!evidence || typeof evidence !== 'object') {
      return res.status(400).json({ error: 'Valid evidence object is required.' });
    }

    const id = req.body.id || `C-${Date.now().toString(36).toUpperCase()}`;

    const candidate: CandidateSkill = {
      id,
      parentSkillId: String(parentSkillId).trim(),
      observedPattern: String(observedPattern).trim(),
      evidence: {
        attemptsCount: Number(evidence.attemptsCount) || 0,
        affectedLearnersCount: Number(evidence.affectedLearnersCount) || 0,
        affectedLearnersPercentage: Number(evidence.affectedLearnersPercentage) || 0,
        questionTemplateIds: Array.isArray(evidence.questionTemplateIds) ? evidence.questionTemplateIds : [],
        errorTypes: Array.isArray(evidence.errorTypes) ? evidence.errorTypes : [],
      },
      algorithmConfidence: typeof algorithmConfidence === 'number' ? algorithmConfidence : 0.5,
      status: 'PENDING',
      proposedSubskillName: proposedSubskillName ? String(proposedSubskillName).trim() : undefined,
      reviewNotes: reviewNotes ? String(reviewNotes).trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const created = await dbStore.addCandidateSkill(candidate);
      res.status(201).json(created);
    } catch (err: any) {
      console.error('[skills/candidates] failed to create candidate skill:', err);
      res.status(500).json({ error: 'Failed to create candidate skill.' });
    }
  });

  /**
   * Human-in-the-loop validation endpoint: ACCEPT / REJECT / MERGE / SPLIT / REDEFINE.
   * Only Superadmins / Curriculum leads can validate candidates into official skills.
   */
  app.post('/api/skills/candidates/:id/validate', async (req, res) => {
    const user = requireSuperadmin(req, res, 'skill validation');
    if (!user) return; // 403 sent

    const candidate = await dbStore.getCandidateSkillById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: `Candidate skill ${req.params.id} not found.` });
    }

    const { action, skillName, targetSkillId, notes } = req.body;
    const allowedActions = ['ACCEPT', 'REJECT', 'MERGE', 'SPLIT', 'REDEFINED'];
    if (!action || !allowedActions.includes(String(action).toUpperCase())) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${allowedActions.join(', ')}`,
      });
    }

    const normalizedAction = String(action).toUpperCase() as CandidateSkillStatus;
    const now = new Date().toISOString();

    let createdSkill: Skill | undefined;

    if (normalizedAction === 'ACCEPTED') {
      // Promoting candidate to a full Skill with source_type = 'DISCOVERED_DATA'
      const skillId = targetSkillId || `${candidate.parentSkillId}.D${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const name = skillName || candidate.proposedSubskillName || candidate.observedPattern;

      createdSkill = {
        id: skillId,
        parentSkillId: candidate.parentSkillId,
        name,
        description: candidate.observedPattern,
        sourceType: 'DISCOVERED_DATA',
        validationStatus: 'VALIDATED',
        createdBy: user.email,
        validatedBy: user.email,
        validatedAt: now,
        candidateSourceId: candidate.id,
        createdAt: now,
        updatedAt: now,
      };

      await dbStore.addSkill(createdSkill);
    }

    const updatedCandidate = await dbStore.updateCandidateSkill(candidate.id, {
      status: normalizedAction,
      validatedBy: user.email,
      validatedAt: now,
      reviewNotes: notes ? String(notes).trim() : candidate.reviewNotes,
      resultingSkillId: createdSkill?.id || (targetSkillId ? String(targetSkillId) : undefined),
    });

    res.json({
      candidate: updatedCandidate,
      skill: createdSkill,
      message: `Candidate ${candidate.id} resolved with action ${normalizedAction}.`,
    });
  });

  /**
   * List all official skills (including curriculum and discovered skills).
   */
  app.get('/api/skills', async (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { parentSkillId, validationStatus } = req.query;
      const skills = await dbStore.getSkills({
        parentSkillId: parentSkillId ? String(parentSkillId) : undefined,
        validationStatus: validationStatus ? (String(validationStatus).toUpperCase() as any) : undefined,
      });
      res.json(skills);
    } catch (err: any) {
      console.error('[skills] failed to list skills:', err);
      res.status(500).json({ error: 'Failed to list skills.' });
    }
  });
}
