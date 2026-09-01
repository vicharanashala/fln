import express from 'express';
import { dbStore, UserRole } from '../db';
import { getAuthUser } from '../auth';

/**
 * Superadmin review of the existing question bank.
 *
 * Purpose: retire the 1-59 numbering WITHOUT a level-to-level crosswalk. Each
 * concrete question is tagged with the 93-space level it actually assesses, so
 * content is addressed by its own tag rather than by the level it came from.
 * Once every question carries a tag, nothing needs to know what old level 41
 * corresponded to.
 *
 * The bank covers old levels 22-59 only. Levels 1-21 are procedural generators
 * with no stored questions, so they have nothing to tag and are mapped
 * level-to-level instead — see the /legacy-levels endpoints below.
 *
 * Superadmin-only: which level a question belongs to is global curriculum
 * content that feeds generation for every school, the same reasoning that keeps
 * question-logic authoring restricted.
 */
function requireSuperadmin(req: express.Request, res: express.Response) {
  const user = getAuthUser(req);
  if (!user || user.role !== UserRole.SUPERADMIN) {
    res.status(403).json({ error: 'Only superadmins can review the question bank.' });
    return null;
  }
  return user;
}

/** The 93-space level a question is being mapped to must actually exist. */
async function resolveTarget(levelNumber: number) {
  return await dbStore.getCurriculumLevel(levelNumber);
}

export function registerQuestionBankRoutes(app: express.Express) {
  /** Paged question list. Filter by legacy level, section type, review status. */
  app.get('/api/question-bank', async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    try {
      const { level, sectionType, status, limit, skip } = req.query;
      const result = await dbStore.getQuestionBank({
        level: level !== undefined ? Number(level) : undefined,
        sectionType: sectionType ? String(sectionType) : undefined,
        status: status ? (String(status) as any) : undefined,
        limit: limit ? Math.min(Number(limit), 200) : 50,
        skip: skip ? Number(skip) : 0,
      });
      res.json(result);
    } catch (err: any) {
      console.error('[question-bank] list failed:', err);
      res.status(500).json({ error: 'Failed to read the question bank.' });
    }
  });

  /** Review progress, and the shape of what is left. */
  app.get('/api/question-bank/progress', async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    try {
      res.json(await dbStore.getQuestionBankProgress());
    } catch (err: any) {
      console.error('[question-bank] progress failed:', err);
      res.status(500).json({ error: 'Failed to compute review progress.' });
    }
  });

  /**
   * Map one question to a 93-space level, or retire it.
   *
   * Retiring keeps the row and marks it, rather than deleting: the decision
   * that a question is not worth using is itself a curriculum judgement worth
   * auditing, and it must be reversible. Readers filter on reviewStatus.
   */
  app.patch('/api/question-bank/:questionId', async (req, res) => {
    const user = requireSuperadmin(req, res);
    if (!user) return;
    const { mappedLevel, reviewStatus, reviewNote } = req.body || {};

    if (!['mapped', 'retired', 'untagged'].includes(reviewStatus)) {
      return res.status(400).json({ error: 'reviewStatus must be "mapped", "retired" or "untagged".' });
    }
    try {
      const existing = await dbStore.getQuestionBankEntry(req.params.questionId);
      if (!existing) return res.status(404).json({ error: 'No such question in the bank.' });

      const patch: any = { reviewStatus, reviewedBy: user.email, reviewNote };

      if (reviewStatus === 'mapped') {
        const target = await resolveTarget(Number(mappedLevel));
        if (!target) {
          return res.status(400).json({
            error: `Level ${mappedLevel} is not a curriculum level. Valid levels are 1-93; ` +
                   `if the collection is empty run "npm run seed:levels".`,
          });
        }
        patch.mappedLevel = target.levelNumber;
        // conceptId travels from the level, so the question inherits the same
        // immutable identity student evidence already points at.
        patch.conceptId = target.conceptId;
      } else {
        patch.mappedLevel = null;
        patch.conceptId = undefined;
      }

      res.json(await dbStore.reviewQuestion(req.params.questionId, patch));
    } catch (err: any) {
      console.error('[question-bank] review failed:', err);
      res.status(500).json({ error: 'Failed to save the review decision.' });
    }
  });

  /**
   * Apply one decision to a whole (level, section).
   *
   * The questions repeat heavily within a section — one legacy level's 48 items
   * can be 48 variations of the same task — so reviewing them one at a time
   * would be busywork rather than judgement.
   */
  app.post('/api/question-bank/bulk', async (req, res) => {
    const user = requireSuperadmin(req, res);
    if (!user) return;
    const { level, section, sectionType, mappedLevel, reviewStatus } = req.body || {};

    if (level === undefined || Number.isNaN(Number(level))) {
      return res.status(400).json({ error: 'level is required.' });
    }
    if (!['mapped', 'retired', 'untagged'].includes(reviewStatus)) {
      return res.status(400).json({ error: 'reviewStatus must be "mapped", "retired" or "untagged".' });
    }
    try {
      const patch: any = { reviewStatus, reviewedBy: user.email };
      if (reviewStatus === 'mapped') {
        const target = await resolveTarget(Number(mappedLevel));
        if (!target) return res.status(400).json({ error: `Level ${mappedLevel} is not a curriculum level (1-93).` });
        patch.mappedLevel = target.levelNumber;
        patch.conceptId = target.conceptId;
      } else {
        patch.mappedLevel = null;
        patch.conceptId = undefined;
      }
      const result = await dbStore.reviewQuestionsBulk(
        { level: Number(level), section, sectionType }, patch);
      res.json(result);
    } catch (err: any) {
      console.error('[question-bank] bulk review failed:', err);
      res.status(500).json({ error: 'Failed to apply the bulk decision.' });
    }
  });

  /**
   * The legacy levels that have NO questions to tag.
   *
   * The bank starts at old level 22. Levels 1-21 are procedural generators, so
   * there is nothing to review question-by-question — they are mapped whole,
   * onto one 93-space level each. This is the small residual crosswalk: 21 rows
   * rather than 59, and the 21 easiest ones.
   */
  app.get('/api/question-bank/legacy-levels', async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    try {
      const progress = await dbStore.getQuestionBankProgress();
      const inBank = new Set(progress.legacyLevelsInBank);
      const levels = await dbStore.getCurriculumLevels();
      const mappedByLegacy = new Map(levels.filter(l => l.legacyLevel59 !== null).map(l => [l.legacyLevel59, l]));
      const rows = [];
      for (let legacyId = 1; legacyId <= 59; legacyId++) {
        if (inBank.has(legacyId)) continue;
        const target = mappedByLegacy.get(legacyId);
        rows.push({
          legacyId,
          hasQuestions: false,
          mappedLevel: target ? target.levelNumber : null,
          mappedCapability: target ? target.capability : null,
        });
      }
      res.json({ rows, note: 'These legacy levels have no stored questions — map the level itself.' });
    } catch (err: any) {
      console.error('[question-bank] legacy-levels failed:', err);
      res.status(500).json({ error: 'Failed to read the unmapped legacy levels.' });
    }
  });

  /** Map a question-less legacy level onto one 93-space level. */
  app.patch('/api/question-bank/legacy-levels/:legacyId', async (req, res) => {
    const user = requireSuperadmin(req, res);
    if (!user) return;
    const legacyId = Number(req.params.legacyId);
    const { mappedLevel } = req.body || {};
    if (!Number.isInteger(legacyId) || legacyId < 1 || legacyId > 59) {
      return res.status(400).json({ error: 'legacyId must be an integer between 1 and 59.' });
    }
    try {
      if (mappedLevel === null) {
        await dbStore.setCurriculumLegacyMapping(null, legacyId);
        return res.json({ legacyId, mappedLevel: null });
      }
      const target = await resolveTarget(Number(mappedLevel));
      if (!target) return res.status(400).json({ error: `Level ${mappedLevel} is not a curriculum level (1-93).` });

      // One legacy level cannot feed two 93-space levels: the seeder aborts on
      // exactly this collision rather than picking a winner, so refuse it here
      // too instead of writing a state the seed would later reject.
      const clash = await dbStore.getCurriculumLevelByLegacy59(legacyId);
      if (clash && clash.levelNumber !== target.levelNumber) {
        return res.status(409).json({
          error: `Legacy level ${legacyId} is already mapped to L${clash.levelNumber} (${clash.capability}). ` +
                 `Clear that mapping first if it should move to L${target.levelNumber}.`,
        });
      }
      await dbStore.setCurriculumLegacyMapping(target.levelNumber, legacyId);
      res.json({ legacyId, mappedLevel: target.levelNumber, mappedCapability: target.capability });
    } catch (err: any) {
      console.error('[question-bank] legacy mapping failed:', err);
      res.status(500).json({ error: 'Failed to save the legacy level mapping.' });
    }
  });
}
