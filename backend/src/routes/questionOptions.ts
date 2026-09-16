import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, QuestionOption } from '../db';
import { requireSuperadmin } from './superadminGuard';

const SUBJECT = 'question options';

const OPTION_TYPES: QuestionOption['type'][] = ['numeral-range', 'operation', 'svg-theme'];

/** Machine keys are used in URLs, CSV cells and stored rows, so keep them boring. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

const MAX_LABEL_CHARS = 60;
/**
 * Upper bound on an author-defined range.
 *
 * Not arbitrary: worksheets are printed for children in Classes 1 to 4, and a
 * range beyond this produces questions no level in the curriculum asks for.
 * Raising it is a product decision, not a validation tweak.
 */
const MAX_RANGE_BOUND = 10_000;

function validateOption(o: Partial<QuestionOption>): string | null {
  if (!o.type || !OPTION_TYPES.includes(o.type)) {
    return `type must be one of ${OPTION_TYPES.join(', ')}.`;
  }
  const key = (o.key ?? '').trim();
  if (!KEY_PATTERN.test(key)) {
    return 'key must be lowercase letters, digits and hyphens, starting with a letter or digit, at most 40 characters.';
  }
  const label = (o.label ?? '').trim();
  if (label.length === 0) return 'label is required.';
  if (label.length > MAX_LABEL_CHARS) return `label must be ${MAX_LABEL_CHARS} characters or fewer.`;

  if (o.type === 'numeral-range') {
    if (!Number.isInteger(o.min) || !Number.isInteger(o.max)) {
      return 'A number range needs whole-number min and max values.';
    }
    if ((o.min as number) < 0) return 'min cannot be negative.';
    if ((o.max as number) <= (o.min as number)) return 'max must be greater than min.';
    if ((o.max as number) > MAX_RANGE_BOUND) return `max cannot exceed ${MAX_RANGE_BOUND}.`;
  }

  if (o.implementationStatus && !['ready', 'not-ready'].includes(o.implementationStatus)) {
    return "implementationStatus must be 'ready' or 'not-ready'.";
  }
  return null;
}

export function registerQuestionOptionRoutes(app: express.Express) {
  app.get('/api/question-options', async (req, res) => {
    if (!requireSuperadmin(req, res, SUBJECT)) return;

    const includeInactive = req.query.includeInactive === 'true';
    let options = await dbStore.getQuestionOptions(includeInactive);

    const type = req.query.type as string | undefined;
    if (type) {
      if (!OPTION_TYPES.includes(type as QuestionOption['type'])) {
        return res.status(400).json({ error: `type must be one of ${OPTION_TYPES.join(', ')}.` });
      }
      options = options.filter(o => o.type === type);
    }
    res.json(options);
  });

  app.post('/api/question-options', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const draft: Partial<QuestionOption> = {
      type: req.body?.type,
      key: (req.body?.key ?? '').trim(),
      label: (req.body?.label ?? '').trim(),
      min: req.body?.min != null ? Number(req.body.min) : undefined,
      max: req.body?.max != null ? Number(req.body.max) : undefined,
      implementationStatus: req.body?.implementationStatus ?? 'not-ready',
    };

    const problem = validateOption(draft);
    if (problem) return res.status(400).json({ error: problem });

    const clash = await dbStore.getQuestionOptionByKey(draft.type!, draft.key!);
    if (clash) {
      return res.status(409).json({ error: `An active ${draft.type} with the key "${draft.key}" already exists.`, id: clash.id });
    }

    const now = new Date().toISOString();
    const option: QuestionOption = {
      id: 'qopt_' + randomUUID().slice(0, 8),
      type: draft.type!,
      key: draft.key!,
      label: draft.label!,
      min: draft.min,
      max: draft.max,
      // A new value is never assumed to work. Nothing can generate with it
      // until someone has implemented it and flipped this deliberately.
      implementationStatus: draft.implementationStatus as QuestionOption['implementationStatus'],
      active: true,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    await dbStore.addQuestionOption(option);
    res.status(201).json(option);
  });

  app.patch('/api/question-options/:id', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const current = await dbStore.getQuestionOptionById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Option not found.' });

    const merged: QuestionOption = {
      ...current,
      label: req.body?.label !== undefined ? String(req.body.label).trim() : current.label,
      min: req.body?.min !== undefined ? Number(req.body.min) : current.min,
      max: req.body?.max !== undefined ? Number(req.body.max) : current.max,
      implementationStatus: req.body?.implementationStatus ?? current.implementationStatus,
    };

    // The key and type are identity: rows already reference them. Renaming one
    // would silently repoint every template that used it.
    if (req.body?.key !== undefined && req.body.key !== current.key) {
      return res.status(400).json({ error: 'An option key cannot be changed. Deactivate this one and add a new option instead.' });
    }
    if (req.body?.type !== undefined && req.body.type !== current.type) {
      return res.status(400).json({ error: 'An option type cannot be changed.' });
    }

    const problem = validateOption(merged);
    if (problem) return res.status(400).json({ error: problem });

    const updated = await dbStore.updateQuestionOption(req.params.id, {
      label: merged.label,
      min: merged.min,
      max: merged.max,
      implementationStatus: merged.implementationStatus,
      updatedAt: new Date().toISOString(),
    });
    res.json(updated);
  });

  /**
   * Deactivate rather than delete.
   *
   * Templates store the option key, so removing the row would leave those
   * templates pointing at a value nothing can explain. Deactivating keeps the
   * history readable while taking the value out of the form.
   */
  app.delete('/api/question-options/:id', async (req, res) => {
    const user = requireSuperadmin(req, res, SUBJECT);
    if (!user) return;

    const current = await dbStore.getQuestionOptionById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Option not found.' });
    if (!current.active) return res.json({ ok: true });

    await dbStore.updateQuestionOption(req.params.id, { active: false, updatedAt: new Date().toISOString() });
    res.json({ ok: true });
  });
}
