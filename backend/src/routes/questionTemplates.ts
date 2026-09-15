import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, QuestionTemplate } from '../db';
import { requireSuperadmin } from './superadminGuard';
import { getLevel, isSkillMappedToLevel, isSubskillUnderSkills, buildLevelMapPayload, LEVEL_COUNT } from '../config/skillLevelMap';
import { getLevelForConcept } from '../config/curriculumMap';
import {
  QuestionTemplateParams,
  QuestionFamily,
  ParamMode,
  coerceParams,
  validateParams,
  validateGenerationIntent,
  deriveTemplateName,
  variantKeyFor,
  getParamCatalog,
  QUESTION_COUNT_DEFAULT,
  QUESTION_FAMILIES,
  MAX_SVG_THEMES,
} from '../types/questionTemplateParams';
import { isKnownThemeId, listThemes } from '../svgAssetCatalog';

const MAX_NAME_CHARS = 200;
const MAX_TAGS = 20;
const MAX_TAG_CHARS = 40;
/** Cap on one import. Large enough for a curriculum batch, small enough to stay a single round trip. */
const MAX_IMPORT_ROWS = 1000;

const SUBJECT = 'question templates';

/**
 * Server-side validation of a whole template.
 *
 * The client's cascading dropdowns make an invalid combination hard to pick,
 * but they cannot make it impossible to send, and the CSV import has no
 * dropdowns at all. A template filed against a concept that cannot host its
 * skills would go on to produce questions assessing something the level never
 * claimed to teach, so this is the real guard.
 *
 * Returns an error string, or null when the template is valid.
 */
function validateTemplate(
  conceptId: string,
  skills: string[],
  subskills: string[],
  generationIntent: string,
  questionFamily: string,
  svgThemeIds: string[],
  answerSpec: string,
  params: QuestionTemplateParams,
  tags: string[],
  name: string
): string | null {
  if (typeof conceptId !== 'string' || conceptId.trim().length === 0) {
    return 'conceptId is required.';
  }
  const concept = getLevelForConcept(conceptId.trim());
  if (!concept) return `Concept ${conceptId} is not present in the curriculum map.`;

  const levelInfo = getLevel(concept.levelNumber);
  if (!levelInfo) return `Concept ${conceptId} resolves to L${concept.levelNumber}, which is not in the skill map.`;

  // Defensive: every level in the map should carry at least one skill. If one
  // does not, say so plainly rather than letting the "skill not mapped" error
  // below imply the author picked wrongly.
  if (levelInfo.skills.length === 0) {
    return `L${concept.levelNumber} has no skills mapped to it, so no question can be authored for it.`;
  }

  if (!Array.isArray(skills) || skills.length === 0) return 'At least one skill is required.';
  for (const sk of skills) {
    if (!isSkillMappedToLevel(sk, concept.levelNumber)) {
      return `Skill ${sk} is not mapped to L${concept.levelNumber}.`;
    }
  }

  if (!Array.isArray(subskills)) return 'subskills must be an array.';
  for (const ss of subskills) {
    if (!isSubskillUnderSkills(ss, skills)) {
      return `Sub-skill ${ss} is not under any of the selected skills.`;
    }
  }

  const intentProblem = validateGenerationIntent(generationIntent);
  if (intentProblem) return intentProblem;

  if (!(QUESTION_FAMILIES as readonly string[]).includes(questionFamily)) {
    return `questionFamily must be one of ${QUESTION_FAMILIES.join(', ')}.`;
  }

  // The answer is generated, never authored. Rejecting this outright rather
  // than dropping it silently: an author who typed an answer believes it will
  // be used, and quietly discarding it would be worse than saying no.
  if ((answerSpec ?? '').trim().length > 0) {
    return 'An answer cannot be authored here. The generator produces the answer from the intent and the options below.';
  }

  if (!Array.isArray(svgThemeIds)) return 'svgThemeIds must be an array.';
  if (svgThemeIds.length > MAX_SVG_THEMES) {
    return `At most ${MAX_SVG_THEMES} visual themes may be selected.`;
  }
  for (const t of svgThemeIds) {
    if (typeof t !== 'string' || !isKnownThemeId(t)) {
      return `Unknown visual theme "${t}".`;
    }
  }
  if (questionFamily === 'counting' && svgThemeIds.length === 0) {
    return 'A counting question needs at least one visual theme, otherwise there is nothing for the child to count.';
  }

  if (name.length > MAX_NAME_CHARS) {
    return `Name must be ${MAX_NAME_CHARS} characters or fewer.`;
  }

  if (!Array.isArray(tags)) return 'tags must be an array.';
  if (tags.length > MAX_TAGS) return `A template may carry at most ${MAX_TAGS} tags.`;
  for (const t of tags) {
    if (typeof t !== 'string' || t.trim().length === 0) return 'tags must be non-empty strings.';
    if (t.length > MAX_TAG_CHARS) return `Each tag must be ${MAX_TAG_CHARS} characters or fewer.`;
  }

  return validateParams(params);
}

/** Lowercased, trimmed, de-duplicated, order preserved. */
function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const tag = t.trim().toLowerCase();
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Build the stored row from validated inputs.
 *
 * Shared by the single-create route and the importer so that a row authored in
 * the form and the same row imported from a CSV are byte-for-byte the same
 * document, rather than two shapes that only mostly agree.
 */
function buildTemplate(
  input: {
    conceptId: string;
    skills: string[];
    subskills: string[];
    generationIntent: string;
    questionFamily: QuestionFamily;
    svgThemeIds: string[];
    params: QuestionTemplateParams;
    name: string;
    tags: string[];
    source: 'form' | 'csv';
  },
  user: { id: string; email: string },
  now: string
): QuestionTemplate {
  const concept = getLevelForConcept(input.conceptId)!;
  const params = input.params;
  return {
    id: 'qtpl_' + randomUUID().slice(0, 8),
    conceptId: input.conceptId,
    levelNumber: concept.levelNumber,
    levelName: getLevel(concept.levelNumber)!.capability,
    skills: input.skills,
    subskills: input.subskills,
    generationIntent: input.generationIntent.trim(),
    questionFamily: input.questionFamily,
    paramMode: 'structured',
    svgThemeIds: input.svgThemeIds,
    // Legacy columns stay present and empty on new rows. See QuestionTemplate.
    stem: '',
    answerSpec: '',
    numeralRange: params.numeralRange,
    digitCount: params.digitCount,
    operations: params.operations,
    maxOperandCount: params.maxOperandCount,
    carryBehavior: params.carryBehavior,
    borrowBehavior: params.borrowBehavior,
    maxSumOrDifference: params.maxSumOrDifference,
    answerType: params.answerType,
    blankCount: params.blankCount,
    questionCount: params.questionCount ?? QUESTION_COUNT_DEFAULT,
    subjectCategory: params.subjectCategory,
    name: input.name.trim() || deriveTemplateName(params),
    variantKey: variantKeyFor(input.conceptId, params),
    tags: input.tags,
    source: input.source,
    createdBy: user.id,
    createdByEmail: user.email,
    createdAt: now,
    updatedAt: now,
    updatedBy: user.id,
    updatedByEmail: user.email,
    deletedAt: null,
    deletedBy: null,
  };
}

/**
 * Minimal RFC 4180 reader: quoted fields, doubled quotes inside them, and
 * newlines inside quotes. Hand-rolled because it is the only CSV in the
 * backend and a dependency would be carried into every bundle for this.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  row.push(field);
  rows.push(row);

  // Trailing newline produces one empty final row; blank lines anywhere are noise.
  return rows.filter(r => r.some(c => c.trim().length > 0));
}

/** Pipe-separated list cell, e.g. "SK03|SK07". Empty cell means empty list. */
function splitList(cell: string): string[] {
  return (cell ?? '').split('|').map(s => s.trim()).filter(s => s.length > 0);
}

function cellOrNull(cell: string): string | null {
  const v = (cell ?? '').trim();
  return v.length === 0 ? null : v;
}

const CSV_COLUMNS = [
  'conceptId', 'skills', 'subskills', 'generationIntent', 'questionFamily', 'svgThemeIds',
  'numeralRange', 'digitCount', 'operations', 'maxOperandCount',
  'carryBehavior', 'borrowBehavior', 'maxSumOrDifference',
  'answerType', 'blankCount', 'questionCount', 'subjectCategory',
  'name', 'tags',
] as const;

export function registerQuestionTemplateRoutes(app: express.Express) {
  /** The legal values and context rules the form renders itself from. */
  app.get('/api/question-templates/param-catalog', (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    res.json({ ...getParamCatalog(), svgThemes: listThemes() });
  });

  /** Levels, skills and sub-skills for the cascading pickers, in one call. */
  app.get('/api/question-templates/level-map', (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    res.json(buildLevelMapPayload());
  });

  /** The header row the importer expects, so the form can offer a blank file. */
  app.get('/api/question-templates/csv-template', (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    res.type('text/csv').send(CSV_COLUMNS.join(',') + '\n');
  });

  app.get('/api/question-templates/stats', async (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    res.json(await dbStore.getQuestionTemplateStats(LEVEL_COUNT));
  });

  app.get('/api/question-templates', async (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;

    const includeDeleted = req.query.includeDeleted === 'true';
    let templates = await dbStore.getQuestionTemplates(includeDeleted);

    const conceptId = req.query.conceptId as string | undefined;
    if (conceptId) templates = templates.filter(t => t.conceptId === conceptId);

    const skill = req.query.skill as string | undefined;
    if (skill) templates = templates.filter(t => t.skills.includes(skill));

    const subskill = req.query.subskill as string | undefined;
    if (subskill) templates = templates.filter(t => t.subskills.includes(subskill));

    const tag = req.query.tag as string | undefined;
    if (tag) templates = templates.filter(t => t.tags.includes(tag.toLowerCase()));

    const variantKey = req.query.variantKey as string | undefined;
    if (variantKey) templates = templates.filter(t => t.variantKey === variantKey);

    res.json(templates);
  });

  app.post('/api/question-templates', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const conceptId: string = (req.body?.conceptId ?? '').trim();
    const skills: string[] = req.body?.skills ?? [];
    const subskills: string[] = req.body?.subskills ?? [];
    const generationIntent: string = req.body?.generationIntent ?? '';
    const questionFamily: string = req.body?.questionFamily ?? 'operation';
    const svgThemeIds: string[] = req.body?.svgThemeIds ?? [];
    const answerSpec: string = req.body?.answerSpec ?? '';
    const params = coerceParams(req.body);
    const tags = normalizeTags(req.body?.tags);
    const name: string = (req.body?.name ?? '').trim();

    const problem = validateTemplate(conceptId, skills, subskills, generationIntent, questionFamily, svgThemeIds, answerSpec, params, tags, name);
    if (problem) return res.status(400).json({ error: problem });

    const template = buildTemplate(
      { conceptId, skills, subskills, generationIntent, questionFamily: questionFamily as QuestionFamily, svgThemeIds, params, name, tags, source: 'form' },
      user,
      new Date().toISOString()
    );

    await dbStore.addQuestionTemplate(template);

    // Not a rejection: two Superadmins may legitimately author the same
    // variation with different stems. Reported so the author can see it rather
    // than discovering the collision in a generated paper.
    const siblings = (await dbStore.getQuestionTemplatesByVariantKey(template.variantKey))
      .filter(t => t.id !== template.id);

    res.status(201).json({
      template,
      duplicateVariants: siblings.map(t => ({ id: t.id, name: t.name, stem: t.stem })),
    });
  });

  app.patch('/api/question-templates/:id', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const current = await dbStore.getQuestionTemplateById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Question template not found.' });
    if (current.deletedAt) return res.status(400).json({ error: 'Cannot edit a deleted template.' });

    // Fall back to the stored value for anything the caller did not send, so a
    // partial PATCH is still validated as a whole document. This is what makes
    // "change only the concept" fail loudly when the existing skills cannot
    // live at the new level, instead of silently storing a mismatched pair.
    const conceptId: string = (req.body?.conceptId ?? current.conceptId).trim();
    const skills: string[] = req.body?.skills ?? current.skills;
    const subskills: string[] = req.body?.subskills ?? current.subskills;
    const generationIntent: string = req.body?.generationIntent ?? current.generationIntent ?? '';
    const questionFamily: string = req.body?.questionFamily ?? current.questionFamily ?? 'operation';
    const svgThemeIds: string[] = req.body?.svgThemeIds ?? current.svgThemeIds ?? [];
    // Never inherit a legacy answer into a structured edit: that would fail the
    // "no authored answer" rule on a row the author did not touch.
    const answerSpec: string = req.body?.answerSpec ?? '';
    const tags = req.body?.tags !== undefined ? normalizeTags(req.body.tags) : current.tags;
    const params = coerceParams({ ...current, ...req.body });
    const name: string = (req.body?.name ?? current.name).trim();

    const problem = validateTemplate(conceptId, skills, subskills, generationIntent, questionFamily, svgThemeIds, answerSpec, params, tags, name);
    if (problem) {
      // Make the concept-only case actionable rather than merely rejected.
      if (req.body?.conceptId !== undefined && req.body?.skills === undefined && problem.includes('not mapped')) {
        return res.status(400).json({
          error: `Existing skills [${current.skills.join(', ')}] are not all mapped to ${conceptId}. Update skills in the same request.`,
        });
      }
      return res.status(400).json({ error: problem });
    }

    const concept = getLevelForConcept(conceptId)!;

    // The name is the author's once they have edited it, so it is only
    // re-derived when the caller explicitly asks or has left it empty.
    const regenerate = req.body?.regenerateName === true || name.length === 0;

    const updates: Partial<QuestionTemplate> = {
      conceptId,
      levelNumber: concept.levelNumber,
      levelName: getLevel(concept.levelNumber)!.capability,
      skills,
      subskills,
      generationIntent: generationIntent.trim(),
      questionFamily: questionFamily as QuestionFamily,
      paramMode: 'structured' as ParamMode,
      svgThemeIds,
      numeralRange: params.numeralRange,
      digitCount: params.digitCount,
      operations: params.operations,
      maxOperandCount: params.maxOperandCount,
      carryBehavior: params.carryBehavior,
      borrowBehavior: params.borrowBehavior,
      maxSumOrDifference: params.maxSumOrDifference,
      answerType: params.answerType,
      blankCount: params.blankCount,
      questionCount: params.questionCount ?? QUESTION_COUNT_DEFAULT,
      subjectCategory: params.subjectCategory,
      name: regenerate ? deriveTemplateName(params) : name,
      variantKey: variantKeyFor(conceptId, params),
      tags,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      updatedByEmail: user.email,
    };

    const updated = await dbStore.updateQuestionTemplate(req.params.id, updates);
    res.json(updated);
  });

  app.delete('/api/question-templates/:id', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const current = await dbStore.getQuestionTemplateById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Question template not found.' });
    if (current.deletedAt) return res.json({ ok: true });

    await dbStore.updateQuestionTemplate(req.params.id, {
      deletedAt: new Date().toISOString(),
      deletedBy: user.id,
    });
    res.json({ ok: true });
  });

  /**
   * Bulk import from CSV.
   *
   * All-or-nothing by design. A partial import that writes the valid rows and
   * rejects the rest leaves the author reconciling a half-written file against
   * a list of errors by hand, which is harder than fixing the file and trying
   * again. `dryRun` runs every check and writes nothing, so the same request
   * doubles as the preview.
   */
  app.post('/api/question-templates/import', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const csv: string = req.body?.csv ?? '';
    const dryRun: boolean = req.body?.dryRun === true;

    if (typeof csv !== 'string' || csv.trim().length === 0) {
      return res.status(400).json({ error: 'csv is required.' });
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'The file needs a header row and at least one data row.' });
    }

    const header = rows[0].map(h => h.trim());
    const missing = CSV_COLUMNS.filter(c => !header.includes(c));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}.` });
    }

    const dataRows = rows.slice(1);
    if (dataRows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `At most ${MAX_IMPORT_ROWS} rows per import; this file has ${dataRows.length}.` });
    }

    const col = (row: string[], name: string) => (row[header.indexOf(name)] ?? '').trim();
    const now = new Date().toISOString();
    const errors: Array<{ row: number; error: string }> = [];
    const prepared: QuestionTemplate[] = [];

    dataRows.forEach((row, i) => {
      // +2 so the number matches what the author sees in a spreadsheet: one for
      // the header, one because spreadsheets count from 1.
      const rowNumber = i + 2;

      const conceptId = col(row, 'conceptId');
      const skills = splitList(col(row, 'skills'));
      const subskills = splitList(col(row, 'subskills'));
      const generationIntent = col(row, 'generationIntent');
      const questionFamily = col(row, 'questionFamily') || 'operation';
      const svgThemeIds = splitList(col(row, 'svgThemeIds'));
      const answerSpec = col(row, 'answerSpec');
      const tags = normalizeTags(splitList(col(row, 'tags')));
      const name = col(row, 'name');

      const params = coerceParams({
        numeralRange: cellOrNull(col(row, 'numeralRange')),
        digitCount: cellOrNull(col(row, 'digitCount')),
        operations: splitList(col(row, 'operations')),
        maxOperandCount: cellOrNull(col(row, 'maxOperandCount')),
        carryBehavior: cellOrNull(col(row, 'carryBehavior')),
        borrowBehavior: cellOrNull(col(row, 'borrowBehavior')),
        maxSumOrDifference: cellOrNull(col(row, 'maxSumOrDifference')),
        answerType: cellOrNull(col(row, 'answerType')),
        blankCount: cellOrNull(col(row, 'blankCount')),
        questionCount: cellOrNull(col(row, 'questionCount')),
        subjectCategory: cellOrNull(col(row, 'subjectCategory')),
      });

      const problem = validateTemplate(conceptId, skills, subskills, generationIntent, questionFamily, svgThemeIds, answerSpec, params, tags, name);
      if (problem) {
        errors.push({ row: rowNumber, error: problem });
        return;
      }

      prepared.push(buildTemplate(
        { conceptId, skills, subskills, generationIntent, questionFamily: questionFamily as QuestionFamily, svgThemeIds, params, name, tags, source: 'csv' },
        user,
        now
      ));
    });

    if (errors.length > 0) {
      return res.status(400).json({
        imported: 0,
        rowsRead: dataRows.length,
        errors,
        error: `${errors.length} of ${dataRows.length} rows are invalid. Nothing was imported.`,
      });
    }

    // Variations that already exist, and variations the file repeats within
    // itself. Both are reported, neither blocks the import.
    const withinFile = new Map<string, number>();
    for (const t of prepared) withinFile.set(t.variantKey, (withinFile.get(t.variantKey) ?? 0) + 1);
    const existingKeys: string[] = [];
    for (const key of withinFile.keys()) {
      const siblings = await dbStore.getQuestionTemplatesByVariantKey(key);
      if (siblings.length > 0) existingKeys.push(key);
    }

    if (dryRun) {
      return res.json({
        dryRun: true,
        imported: 0,
        rowsRead: dataRows.length,
        wouldImport: prepared.length,
        errors: [],
        repeatedInFile: [...withinFile.entries()].filter(([, n]) => n > 1).map(([key, n]) => ({ variantKey: key, count: n })),
        alreadyExists: existingKeys,
        preview: prepared.slice(0, 10).map(t => ({ conceptId: t.conceptId, name: t.name, stem: t.stem })),
      });
    }

    await dbStore.addQuestionTemplates(prepared);

    res.status(201).json({
      dryRun: false,
      imported: prepared.length,
      rowsRead: dataRows.length,
      errors: [],
      repeatedInFile: [...withinFile.entries()].filter(([, n]) => n > 1).map(([key, n]) => ({ variantKey: key, count: n })),
      alreadyExists: existingKeys,
    });
  });
}
