import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore } from '../db';
import { requireSuperadmin } from './superadminGuard';
import { CURRICULUM_MAPPING, getLevelForConcept } from '../config/curriculumMap';
import { listThemes } from '../svgAssetCatalog';
import { QUESTION_FAMILIES } from '../types/questionTemplateParams';
import {
  LAYOUT_ANSWER_FORMATS, LAYOUT_BLOCK_TYPES, LAYOUT_STATUSES,
  type LayoutTemplate,
} from '../types/layoutTemplate';
import { ExpressionError, resolveLayout, validateLayoutTemplate } from '../services/layoutTemplateEngine';

const SUBJECT = 'question layout templates';
/** A template is a few KB; anything far beyond this is a mistake or abuse. */
const MAX_TEMPLATE_BYTES = 200_000;

/** Only the fields an author controls. Ids, authorship and timestamps are set here, never trusted from the body. */
function authoredFields(body: any): Partial<LayoutTemplate> {
  const out: Partial<LayoutTemplate> = {};
  if (typeof body?.name === 'string') out.name = body.name.trim().slice(0, 120);
  if (typeof body?.conceptId === 'string') out.conceptId = body.conceptId.trim();
  if (typeof body?.questionFamily === 'string') out.questionFamily = body.questionFamily;
  if (typeof body?.answerFormat === 'string') out.answerFormat = body.answerFormat;
  if (typeof body?.status === 'string') out.status = body.status;
  if (Array.isArray(body?.variables)) out.variables = body.variables;
  if (Array.isArray(body?.constraints)) out.constraints = body.constraints.map((c: unknown) => String(c)).filter((c: string) => c.trim());
  if (Array.isArray(body?.rows)) out.rows = body.rows;
  return out;
}

function tooLarge(body: unknown): boolean {
  try { return JSON.stringify(body ?? {}).length > MAX_TEMPLATE_BYTES; } catch { return true; }
}

/** Fills the level alias fields from the concept, so they can never disagree. */
function withLevel(t: Partial<LayoutTemplate>): Partial<LayoutTemplate> {
  const level = t.conceptId ? getLevelForConcept(t.conceptId) : undefined;
  return level ? { ...t, levelNumber: level.levelNumber, levelName: level.levelTitle } : t;
}

export function registerLayoutTemplateRoutes(app: express.Express) {
  /** Everything the builder's dropdowns need, in one call. */
  app.get('/api/layout-templates/catalog', (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    const levels = Object.values(CURRICULUM_MAPPING)
      .sort((a, b) => a.levelNumber - b.levelNumber)
      .map(l => ({ levelNumber: l.levelNumber, levelName: l.levelTitle, conceptId: l.conceptId, stage: l.stage, strand: l.strand }));
    res.json({
      levels,
      questionFamilies: QUESTION_FAMILIES,
      answerFormats: LAYOUT_ANSWER_FORMATS,
      blockTypes: LAYOUT_BLOCK_TYPES,
      statuses: LAYOUT_STATUSES,
      svgThemes: listThemes().map(t => ({ id: t.id, label: t.label, printSafe: t.printSafe })),
    });
  });

  app.get('/api/layout-templates', async (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    const list = await dbStore.getLayoutTemplates();
    list.sort((a, b) => (a.levelNumber - b.levelNumber) || a.name.localeCompare(b.name));
    res.json(list);
  });

  app.get('/api/layout-templates/:id', async (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    const t = await dbStore.getLayoutTemplateById(req.params.id);
    if (!t || t.deletedAt) return res.status(404).json({ error: 'Layout template not found.' });
    res.json(t);
  });

  /**
   * Resolve an unsaved draft with a seed, so the builder can show exactly what
   * a child would get (and its answer key) before anything is saved.
   */
  app.post('/api/layout-templates/preview', (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;
    if (tooLarge(req.body?.template)) return res.status(413).json({ error: 'Template is too large.' });
    const draft = withLevel({ id: 'preview', ...authoredFields(req.body?.template) }) as LayoutTemplate;
    const seed = String(req.body?.seed ?? randomUUID()).slice(0, 80);
    // Preview is lenient about name/status so an author can look before naming it.
    const errors = validateLayoutTemplate({ ...draft, name: draft.name || 'Untitled', status: 'draft' });
    if (errors.length) return res.status(422).json({ errors });
    try {
      res.json(resolveLayout(draft, seed));
    } catch (err: any) {
      res.status(422).json({ errors: [err instanceof ExpressionError ? err.message : String(err?.message ?? err)] });
    }
  });

  app.post('/api/layout-templates', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;
    if (tooLarge(req.body)) return res.status(413).json({ error: 'Template is too large.' });
    const now = new Date().toISOString();
    const template = {
      ...withLevel({ status: 'draft', constraints: [], variables: [], ...authoredFields(req.body) }),
      id: `LT-${randomUUID()}`,
      createdBy: user.id,
      createdByEmail: user.email,
      createdAt: now,
      updatedAt: now,
      updatedByEmail: user.email,
      deletedAt: null,
    } as LayoutTemplate;
    if (!getLevelForConcept(template.conceptId ?? '')) return res.status(400).json({ errors: ['Choose a level that exists in the curriculum.'] });
    const errors = validateLayoutTemplate(template);
    if (errors.length) return res.status(400).json({ errors });
    await dbStore.addLayoutTemplate(template);
    res.status(201).json(template);
  });

  app.patch('/api/layout-templates/:id', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;
    if (tooLarge(req.body)) return res.status(413).json({ error: 'Template is too large.' });
    const current = await dbStore.getLayoutTemplateById(req.params.id);
    if (!current || current.deletedAt) return res.status(404).json({ error: 'Layout template not found.' });
    // Validate the merged document, so a partial PATCH cannot leave it half-valid.
    const merged = { ...current, ...withLevel({ ...current, ...authoredFields(req.body) }) } as LayoutTemplate;
    if (!getLevelForConcept(merged.conceptId)) return res.status(400).json({ errors: ['Choose a level that exists in the curriculum.'] });
    const errors = validateLayoutTemplate(merged);
    if (errors.length) return res.status(400).json({ errors });
    const updated = await dbStore.updateLayoutTemplate(current.id, {
      ...withLevel(authoredFields(req.body)),
      levelNumber: merged.levelNumber,
      levelName: merged.levelName,
      updatedAt: new Date().toISOString(),
      updatedByEmail: user.email,
    });
    res.json(updated);
  });

  /** Soft delete: a printed paper may already cite this id. */
  app.delete('/api/layout-templates/:id', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;
    const current = await dbStore.getLayoutTemplateById(req.params.id);
    if (!current || current.deletedAt) return res.status(404).json({ error: 'Layout template not found.' });
    const now = new Date().toISOString();
    await dbStore.updateLayoutTemplate(current.id, { deletedAt: now, updatedAt: now, updatedByEmail: user.email, status: 'draft' });
    res.json({ ok: true });
  });
}
