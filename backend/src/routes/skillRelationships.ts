import express from 'express';
import { getAuthUser } from '../auth';
import {
  getAllSkillRelationships,
  getSkillPrerequisites,
  isSkillPrerequisiteSatisfied,
  validateSkillRelationships,
} from '../skillRelationships';

export function registerSkillRelationshipRoutes(app: express.Express) {
  /**
   * GET /api/skill-relationships
   * Returns all skill_relationship rows in the learning prerequisite graph.
   */
  app.get('/api/skill-relationships', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const relationships = getAllSkillRelationships();
      res.json({ relationships });
    } catch (err: any) {
      console.error('[skillRelationships] failed to fetch skill relationships:', err);
      res.status(500).json({ error: 'Failed to fetch skill relationships' });
    }
  });

  /**
   * GET /api/skill-relationships/prerequisites/:skillId
   * Answers "what does a learner need before :skillId", returning all valid routes.
   * e.g., GET /api/skill-relationships/prerequisites/SK13.06
   */
  app.get('/api/skill-relationships/prerequisites/:skillId', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { skillId } = req.params;
    if (!skillId) {
      return res.status(400).json({ error: 'skillId is required' });
    }
    try {
      const prerequisites = getSkillPrerequisites(skillId);
      res.json(prerequisites);
    } catch (err: any) {
      console.error(`[skillRelationships] failed to fetch prerequisites for ${skillId}:`, err);
      res.status(500).json({ error: `Failed to fetch prerequisites for ${skillId}` });
    }
  });

  /**
   * POST /api/skill-relationships/check-satisfied
   * Evaluates whether a learner's masteredSkills satisfy the prerequisites for targetSkill.
   */
  app.post('/api/skill-relationships/check-satisfied', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { targetSkill, masteredSkills } = req.body;
    if (!targetSkill || !Array.isArray(masteredSkills)) {
      return res.status(400).json({ error: 'targetSkill and masteredSkills array are required' });
    }
    try {
      const isSatisfied = isSkillPrerequisiteSatisfied(targetSkill, masteredSkills);
      const prerequisites = getSkillPrerequisites(targetSkill);
      res.json({
        targetSkill,
        isSatisfied,
        routes: prerequisites.routes,
      });
    } catch (err: any) {
      console.error(`[skillRelationships] failed to check prerequisite satisfaction for ${targetSkill}:`, err);
      res.status(500).json({ error: 'Failed to evaluate prerequisite satisfaction' });
    }
  });

  /**
   * GET /api/skill-relationships/validation-report
   * Returns graph validation status (cycles, unknown IDs, edge counts).
   */
  app.get('/api/skill-relationships/validation-report', (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const report = validateSkillRelationships();
      res.json(report);
    } catch (err: any) {
      console.error('[skillRelationships] failed to run validation report:', err);
      res.status(500).json({ error: 'Failed to run graph validation' });
    }
  });
}
