import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, UserRole, QuestionLogic } from '../db';
import { getAuthUser } from '../auth';
import {
  LEVEL_COUNT,
  getLevel,
  isSkillMappedToLevel,
  isSubskillUnderSkills,
  buildLevelMapPayload,
} from '../config/skillLevelMap';

const MAX_LOGIC_CHARS = 2000;
/** Window for the accidental-double-click guard. Not a uniqueness constraint on pedagogy. */
const DUPLICATE_WINDOW_MS = 60_000;

/**
 * Every route here is Superadmin-only. Authoring question logic is a curriculum
 * decision, and the 7-role hierarchy has no curriculum-author role — widening
 * this later is a one-line change here.
 */
function requireSuperadmin(req: express.Request, res: express.Response) {
  const user = getAuthUser(req);
  if (!user || user.role !== UserRole.SUPERADMIN) {
    res.status(403).json({ error: 'Only superadmins can manage question logics.' });
    return null;
  }
  return user;
}

/**
 * Server-side validation of a (level, skills, subskills, text) combination.
 *
 * The client's cascading dropdowns make invalid combinations hard to *pick*,
 * but they cannot make them impossible to *send*. A logic filed against a level
 * that cannot host its skills would flow straight into the question-generation
 * pipeline and produce questions that assess something the level never claimed
 * to teach, so this check is the real guard.
 *
 * Returns an error string, or null when the combination is valid.
 */
function validateCombination(
  level: number,
  skills: string[],
  subskills: string[],
  logicText: string
): string | null {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) {
    return `level must be an integer in [1, ${LEVEL_COUNT}].`;
  }
  const levelInfo = getLevel(level);
  if (!levelInfo) return `Level L${level} is not present in the curriculum map.`;

  // Defensive: every level in the map should carry at least one skill. If one
  // does not, say so plainly rather than letting the "skill not mapped" error
  // below imply the author picked wrongly.
  if (levelInfo.skills.length === 0) {
    return `Level L${level} has no skills mapped to it, so no logic can be authored for it.`;
  }

  if (!Array.isArray(skills) || skills.length === 0) {
    return 'At least one skill is required.';
  }
  for (const sk of skills) {
    if (!isSkillMappedToLevel(sk, level)) {
      return `Skill ${sk} is not mapped to L${level}.`;
    }
  }

  if (!Array.isArray(subskills)) return 'subskills must be an array.';
  for (const ss of subskills) {
    if (!isSubskillUnderSkills(ss, skills)) {
      return `Sub-skill ${ss} is not under any of the selected skills.`;
    }
  }

  const text = (logicText ?? '').trim();
  if (text.length === 0) return 'Question logic text is required.';
  if (text.length > MAX_LOGIC_CHARS) {
    return `Question logic must be ${MAX_LOGIC_CHARS} characters or fewer.`;
  }

  return null;
}

export function registerQuestionLogicRoutes(app: express.Express) {
  /** Everything the authoring form needs to drive its dropdowns, in one call. */
  app.get('/api/question-logics/level-map', async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    res.json(buildLevelMapPayload());
  });

  app.get('/api/question-logics/stats', async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    res.json(await dbStore.getQuestionLogicStats(LEVEL_COUNT));
  });

  app.get('/api/question-logics', async (req, res) => {
    if (!requireSuperadmin(req, res)) return;

    const includeDeleted = req.query.includeDeleted === 'true';
    let logics = await dbStore.getQuestionLogics(includeDeleted);

    const levelParam = req.query.level;
    if (levelParam !== undefined) {
      const level = Number(levelParam);
      if (!Number.isInteger(level)) {
        return res.status(400).json({ error: 'level filter must be an integer.' });
      }
      logics = logics.filter(l => l.level === level);
    }

    const skill = req.query.skill as string | undefined;
    if (skill) logics = logics.filter(l => l.skills.includes(skill));

    const subskill = req.query.subskill as string | undefined;
    if (subskill) logics = logics.filter(l => l.subskills.includes(subskill));

    res.json(logics);
  });

  app.post('/api/question-logics', async (req, res) => {
    const user = requireSuperadmin(req, res);
    if (!user) return;

    const level = Number(req.body?.level);
    const skills: string[] = req.body?.skills ?? [];
    const subskills: string[] = req.body?.subskills ?? [];
    const logicText: string = req.body?.logicText ?? '';

    const problem = validateCombination(level, skills, subskills, logicText);
    if (problem) return res.status(400).json({ error: problem });

    const text = logicText.trim();

    // Double-click guard: same author, same level, same text, within a minute.
    // Deliberately not a unique index — two Superadmins may legitimately author
    // near-identical logic for different reasons, and pedagogy should not be
    // constrained by a database constraint.
    const existing = await dbStore.getQuestionLogics(false);
    const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
    const dupe = existing.find(l =>
      l.createdBy === user.id &&
      l.level === level &&
      l.logicText.trim().toLowerCase() === text.toLowerCase() &&
      new Date(l.createdAt).getTime() > cutoff
    );
    if (dupe) {
      return res.status(409).json({ error: 'An identical logic was just saved for this level.', id: dupe.id });
    }

    const now = new Date().toISOString();
    const logic: QuestionLogic = {
      id: 'qlogic_' + randomUUID().slice(0, 8),
      level,
      levelName: getLevel(level)!.capability,
      skills,
      subskills,
      logicText: text,
      taxonomy: '3-type',
      createdBy: user.id,
      createdByEmail: user.email,
      createdAt: now,
      updatedAt: now,
      updatedBy: user.id,
      updatedByEmail: user.email,
      deletedAt: null,
      deletedBy: null,
    };

    await dbStore.addQuestionLogic(logic);
    res.status(201).json(logic);
  });

  app.patch('/api/question-logics/:id', async (req, res) => {
    const user = requireSuperadmin(req, res);
    if (!user) return;

    const current = await dbStore.getQuestionLogicById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Question logic not found.' });
    if (current.deletedAt) return res.status(400).json({ error: 'Cannot edit a deleted logic.' });

    // Fall back to the stored value for anything the caller did not send, so a
    // partial PATCH is still validated as a whole document. This is what makes
    // "change only the level" fail loudly when the existing skills cannot live
    // at the new level, instead of silently shipping a mismatched pair.
    const level = req.body?.level !== undefined ? Number(req.body.level) : current.level;
    const skills: string[] = req.body?.skills ?? current.skills;
    const subskills: string[] = req.body?.subskills ?? current.subskills;
    const logicText: string = req.body?.logicText ?? current.logicText;

    const problem = validateCombination(level, skills, subskills, logicText);
    if (problem) {
      // Make the level-only case actionable rather than just rejected.
      if (req.body?.level !== undefined && req.body?.skills === undefined && problem.includes('not mapped')) {
        return res.status(400).json({
          error: `Existing skills [${current.skills.join(', ')}] are not all mapped to the new level L${level}. Update skills in the same request.`,
        });
      }
      return res.status(400).json({ error: problem });
    }

    const updates: Partial<QuestionLogic> = {
      level,
      levelName: getLevel(level)!.capability,
      skills,
      subskills,
      logicText: logicText.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      updatedByEmail: user.email,
    };

    const updated = await dbStore.updateQuestionLogic(req.params.id, updates);
    res.json(updated);
  });

  app.delete('/api/question-logics/:id', async (req, res) => {
    const user = requireSuperadmin(req, res);
    if (!user) return;

    const current = await dbStore.getQuestionLogicById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Question logic not found.' });
    if (current.deletedAt) return res.json({ ok: true });

    await dbStore.updateQuestionLogic(req.params.id, {
      deletedAt: new Date().toISOString(),
      deletedBy: user.id,
    });
    res.json({ ok: true });
  });
}
