import { Router } from 'express';
import { requireRole } from '../auth';
import { HttpError, handler, requireString } from '../http';
import type { Repos } from '../repos';
import { QUESTION_MODES, QUESTION_STATUSES, type Question, type QuestionMode, type QuestionStatus } from '../types';

const MAX_SVG_CHARS = 60_000;
const MAX_OPTIONS = 6;

/** A drawing is shown to children as an image, which cannot run code; these checks are a second lock. */
export function svgProblem(svg: string): string | undefined {
  const t = svg.trim();
  if (!t.startsWith('<svg') || !t.endsWith('</svg>')) return 'The drawing must be one <svg> element.';
  if (t.length > MAX_SVG_CHARS) return `The drawing must be at most ${MAX_SVG_CHARS} characters.`;
  if (/<script|javascript:|<foreignObject|\son[a-z]+\s*=/i.test(t)) return 'The drawing may not contain scripts or event handlers.';
  return undefined;
}

interface Fields { mode: QuestionMode; prompt: string; answer: string; options: string[]; svg: string | null; teacherNote: string | null }

/** Reads the writable fields of a question from a request body, applying the rules once for create and edit. */
function readFields(body: Record<string, unknown> | undefined, base?: Question): Fields {
  const b = body ?? {};
  const mode = (b.mode ?? base?.mode) as string;
  if (!(QUESTION_MODES as readonly string[]).includes(mode)) throw new HttpError(400, `mode must be one of: ${QUESTION_MODES.join(', ')}.`);
  const prompt = requireString(b.prompt ?? base?.prompt, 'prompt', 500);
  const answerRaw = b.answer ?? base?.answer ?? '';
  if (typeof answerRaw !== 'string' || answerRaw.length > 200) throw new HttpError(400, 'answer must be text of at most 200 characters.');
  const answer = answerRaw.trim();
  if (mode === 'written' && !answer) throw new HttpError(400, 'A written question needs an answer.');
  const optionsRaw = b.options ?? base?.options ?? [];
  if (!Array.isArray(optionsRaw) || optionsRaw.length > MAX_OPTIONS || optionsRaw.some(o => typeof o !== 'string' || !o.trim() || o.trim().length > 100)) {
    throw new HttpError(400, `options must be a list of at most ${MAX_OPTIONS} short choices.`);
  }
  const options = (optionsRaw as string[]).map(o => o.trim());
  if (options.length === 1) throw new HttpError(400, 'Give at least two choices, or none.');
  if (new Set(options.map(o => o.toLowerCase())).size !== options.length) throw new HttpError(400, 'The choices must all be different.');
  if (options.length > 0 && !options.includes(answer)) throw new HttpError(400, 'The answer must be one of the choices.');
  const svgRaw = b.svg === undefined ? base?.svg ?? null : b.svg;
  if (svgRaw !== null && (typeof svgRaw !== 'string')) throw new HttpError(400, 'svg must be text or null.');
  const svg = svgRaw === null || svgRaw.trim() === '' ? null : svgRaw.trim();
  if (svg) { const p = svgProblem(svg); if (p) throw new HttpError(400, p); }
  const noteRaw = b.teacherNote === undefined ? base?.teacherNote ?? null : b.teacherNote;
  if (noteRaw !== null && (typeof noteRaw !== 'string' || noteRaw.length > 500)) throw new HttpError(400, 'teacherNote must be text of at most 500 characters.');
  return { mode: mode as QuestionMode, prompt, answer, options, svg, teacherNote: typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null };
}

/** Where a question may go next. An approved question is never edited: retire it and write a new one. */
const NEXT: Record<QuestionStatus, readonly QuestionStatus[]> = { draft: ['approved', 'retired'], approved: ['retired'], retired: ['draft'] };

export function contentRoutes(repos: Repos): Router {
  const router = Router();
  const superadmin = requireRole('superadmin');

  async function loadLevel(raw: unknown) {
    const n = Number(raw);
    const level = Number.isInteger(n) ? await repos.levels.byNumber(n) : undefined;
    if (!level) throw new HttpError(404, 'Level not found.');
    return level;
  }

  router.get('/levels', handler(async (req, res) => {
    const [levels, counts] = await Promise.all([repos.levels.list(), repos.questions.countsByLevel()]);
    const isSuper = req.user!.role === 'superadmin';
    res.json({
      levels: levels.map(l => {
        const c = counts[l.levelNumber] ?? { draft: 0, approved: 0, retired: 0, writtenApproved: 0 };
        // Teachers only ever see what is approved; drafts and retired questions are the superadmin's business.
        return { ...l, counts: isSuper ? c : { draft: 0, approved: c.approved, retired: 0, writtenApproved: c.writtenApproved } };
      }),
    });
  }));

  router.get('/levels/:n/questions', superadmin, handler(async (req, res) => {
    const level = await loadLevel(req.params.n);
    res.json({ level, questions: await repos.questions.byLevel(level.levelNumber) });
  }));

  router.post('/levels/:n/questions', superadmin, handler(async (req, res) => {
    const level = await loadLevel(req.params.n);
    const f = readFields(req.body);
    const now = new Date().toISOString();
    const created = await repos.questions.add({
      levelNumber: level.levelNumber, conceptId: level.conceptId, ...f,
      status: 'draft', source: req.body?.source === 'balvatika-review' ? 'balvatika-review' : 'authored',
      createdBy: req.user!.id, createdAt: now, updatedAt: now, approvedBy: null, approvedAt: null,
    });
    res.status(201).json({ question: created });
  }));

  router.patch('/questions/:id', superadmin, handler(async (req, res) => {
    const q = await repos.questions.byId(String(req.params.id));
    if (!q) throw new HttpError(404, 'Question not found.');
    const wantsStatus = req.body?.status !== undefined;
    const wantsEdit = ['mode', 'prompt', 'answer', 'options', 'svg', 'teacherNote'].some(k => req.body?.[k] !== undefined);
    if (wantsStatus && wantsEdit) throw new HttpError(400, 'Change the status or the wording, not both at once.');
    if (!wantsStatus && !wantsEdit) throw new HttpError(400, 'Nothing to change.');
    const now = new Date().toISOString();
    if (wantsStatus) {
      const next = req.body.status;
      if (!(QUESTION_STATUSES as readonly string[]).includes(next)) throw new HttpError(400, `status must be one of: ${QUESTION_STATUSES.join(', ')}.`);
      if (!NEXT[q.status].includes(next)) throw new HttpError(409, `A ${q.status} question cannot become ${next}.`);
      const approving = next === 'approved';
      const updated = await repos.questions.update(q.id, { status: next, updatedAt: now, approvedBy: approving ? req.user!.id : q.approvedBy, approvedAt: approving ? now : q.approvedAt });
      res.json({ question: updated });
      return;
    }
    if (q.status !== 'draft') throw new HttpError(409, 'Only a draft can be edited. Retire this question and write a new one.');
    res.json({ question: await repos.questions.update(q.id, { ...readFields(req.body, q), updatedAt: now }) });
  }));

  return router;
}
