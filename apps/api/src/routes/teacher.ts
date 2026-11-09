import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CLASS_LEVEL_RANGES } from '@fln/curriculum';
import { QUESTIONS_PER_CONCEPT, answersMatch, bandFromScore } from '@fln/domain';
import { canAccessClass } from '../access';
import { HttpError, handler, requireString } from '../http';
import type { ReadAnswers } from '../ollama';
import type { QuestionBank, SheetQuestion } from '../questionBank';
import type { Repos } from '../repos';
import type { Attempt, AttemptAnswer, User } from '../types';

type ClassName = keyof typeof CLASS_LEVEL_RANGES;
const CLASS_NAMES = Object.keys(CLASS_LEVEL_RANGES) as ClassName[];
const MAX_NEW_STUDENTS = 60;
const MAX_IMAGE_BASE64_CHARS = 8_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png'];

function isClassName(v: unknown): v is ClassName { return typeof v === 'string' && (CLASS_NAMES as string[]).includes(v); }

export function teacherRoutes(repos: Repos, bank: QuestionBank, reader?: ReadAnswers): Router {
  const router = Router();

  async function loadClass(id: string, user: User) {
    const cls = await repos.classes.byId(id);
    if (!cls) throw new HttpError(404, 'Class not found.');
    if (!canAccessClass(user, cls)) throw new HttpError(403, 'Forbidden');
    return cls;
  }

  /**
   * A sheet comes from approved written questions of a curriculum level (`levelNumber`), or, until those exist,
   * from the older bank (`bankLevel`). Exactly one of the two is given.
   */
  interface ResolvedSheet { bankLevel: number | null; levelNumber: number | null; title: string; set: number; questions: SheetQuestion[]; answers: string[] }
  async function readSheet(body: { bankLevel?: unknown; levelNumber?: unknown; set?: unknown }): Promise<ResolvedSheet> {
    const set = body.set ?? 0;
    const hasLevel = body.levelNumber !== undefined && body.levelNumber !== null, hasBank = body.bankLevel !== undefined && body.bankLevel !== null;
    if (hasLevel === hasBank) throw new HttpError(400, 'Give either levelNumber or bankLevel.');
    if (!Number.isInteger(set) || (set as number) < 0) throw new HttpError(400, 'set must be a whole number.');
    if (hasLevel) {
      if (!Number.isInteger(body.levelNumber)) throw new HttpError(400, 'levelNumber must be a whole number.');
      const level = await repos.levels.byNumber(body.levelNumber as number);
      if (!level) throw new HttpError(404, 'Level not found.');
      const written = (await repos.questions.byLevel(level.levelNumber)).filter(q => q.status === 'approved' && q.mode === 'written');
      const picked = written.slice((set as number) * QUESTIONS_PER_CONCEPT, ((set as number) + 1) * QUESTIONS_PER_CONCEPT);
      if (picked.length < QUESTIONS_PER_CONCEPT) throw new HttpError(404, 'This level does not have enough approved questions for a worksheet yet.');
      return {
        bankLevel: null, levelNumber: level.levelNumber, title: level.title, set: set as number,
        questions: picked.map((q, i) => ({ n: i + 1, text: q.prompt, svg: q.svg, options: q.options })),
        answers: picked.map(q => q.answer),
      };
    }
    if (!Number.isInteger(body.bankLevel)) throw new HttpError(400, 'bankLevel must be a whole number.');
    const sheet = bank.sheet(body.bankLevel as number, set as number);
    if (!sheet) throw new HttpError(404, 'There is no worksheet for that topic yet.');
    return { bankLevel: sheet.bankLevel, levelNumber: null, title: sheet.title, set: sheet.set, questions: sheet.questions, answers: sheet.answers };
  }

  router.post('/classes', handler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'teacher' || !user.schoolId) throw new HttpError(403, 'Only a teacher can create a class.');
    const className = req.body?.className;
    if (!isClassName(className)) throw new HttpError(400, `className must be one of: ${CLASS_NAMES.join(', ')}.`);
    const section = requireString(req.body?.section ?? 'A', 'section', 10);
    const existing = (await repos.classes.list()).find(c => c.teacherId === user.id && c.className === className && c.section.toLowerCase() === section.toLowerCase());
    if (existing) throw new HttpError(409, 'You already have this class and section.');
    const created = await repos.classes.add({ schoolId: user.schoolId, className, section, teacherId: user.id });
    res.status(201).json({ class: created });
  }));

  router.post('/classes/:id/students/bulk', handler(async (req, res) => {
    const cls = await loadClass(String(req.params.id), req.user!);
    const raw = req.body?.names;
    if (!Array.isArray(raw) || raw.some(n => typeof n !== 'string')) throw new HttpError(400, 'names must be a list of names.');
    const seen = new Set((await repos.students.byClass(cls.id)).map(s => s.name.toLowerCase()));
    const names: string[] = [];
    for (const n of raw as string[]) {
      const name = n.trim().replace(/\s+/g, ' ');
      if (!name) continue;
      if (name.length > 100) throw new HttpError(400, 'Each name must be at most 100 characters.');
      if (seen.has(name.toLowerCase())) continue; // same name twice in one paste or already in the class: skip, never duplicate
      seen.add(name.toLowerCase());
      names.push(name);
    }
    if (names.length === 0) throw new HttpError(400, 'Add at least one new name.');
    if (names.length > MAX_NEW_STUDENTS) throw new HttpError(400, `Add at most ${MAX_NEW_STUDENTS} names at a time.`);
    const startLevel = isClassName(cls.className) ? CLASS_LEVEL_RANGES[cls.className][0] : 1;
    const students = [];
    for (const name of names) students.push(await repos.students.add({ schoolId: cls.schoolId, classId: cls.id, name, currentLevel: startLevel }));
    res.status(201).json({ students });
  }));

  router.get('/classes/:id/levels', handler(async (req, res) => {
    const cls = await loadClass(String(req.params.id), req.user!);
    const upTo = isClassName(cls.className) ? CLASS_LEVEL_RANGES[cls.className][1] : 0;
    const [levels, counts] = await Promise.all([repos.levels.list(), repos.questions.countsByLevel()]);
    res.json({
      levels: levels.filter(l => l.levelNumber <= upTo).map(l => {
        const written = counts[l.levelNumber]?.writtenApproved ?? 0;
        return { levelNumber: l.levelNumber, title: l.title, group: l.group, sets: Math.floor(written / QUESTIONS_PER_CONCEPT) };
      }),
    });
  }));

  router.get('/classes/:id/topics', handler(async (req, res) => {
    await loadClass(String(req.params.id), req.user!);
    res.json({ topics: bank.topics() });
  }));

  router.get('/classes/:id/worksheet', handler(async (req, res) => {
    const cls = await loadClass(String(req.params.id), req.user!);
    const q = req.query;
    const sheet = await readSheet({ bankLevel: q.bankLevel === undefined ? undefined : Number(q.bankLevel), levelNumber: q.levelNumber === undefined ? undefined : Number(q.levelNumber), set: Number(q.set ?? 0) });
    const students = (await repos.students.byClass(cls.id)).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ class: cls, sheet: { bankLevel: sheet.bankLevel, levelNumber: sheet.levelNumber, title: sheet.title, set: sheet.set, questions: sheet.questions }, answerKey: sheet.answers, students });
  }));

  router.get('/classes/:id/results', handler(async (req, res) => {
    const cls = await loadClass(String(req.params.id), req.user!);
    res.json({ attempts: await repos.attempts.byClass(cls.id) });
  }));

  router.post('/classes/:id/results', handler(async (req, res) => {
    const user = req.user!;
    const cls = await loadClass(String(req.params.id), user);
    const sheet = await readSheet(req.body ?? {});
    const entries = req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200) throw new HttpError(400, 'entries must be a list of 1 to 200 papers.');
    const roster = new Set((await repos.students.byClass(cls.id)).map(s => s.id));
    const planned: Omit<Attempt, 'id'>[] = [];
    for (const e of entries as { studentId?: unknown; answers?: unknown; marks?: unknown; source?: unknown }[]) {
      if (typeof e?.studentId !== 'string' || !roster.has(e.studentId)) throw new HttpError(400, 'A paper is for a child who is not in this class.');
      const hasAnswers = e.answers !== undefined, hasMarks = e.marks !== undefined;
      if (hasAnswers === hasMarks) throw new HttpError(400, 'Send either answers or marks for each paper, not both.');
      let answers: AttemptAnswer[];
      if (hasAnswers) {
        const given = e.answers;
        if (!Array.isArray(given) || given.length !== QUESTIONS_PER_CONCEPT || given.some(g => g !== null && typeof g !== 'string' || (typeof g === 'string' && g.length > 100))) {
          throw new HttpError(400, `answers must be ${QUESTIONS_PER_CONCEPT} answers (or null for blank).`);
        }
        answers = (given as (string | null)[]).map((g, i) => ({ n: i + 1, given: g, correct: g !== null && answersMatch(g, sheet.answers[i]) }));
      } else {
        const marks = e.marks;
        if (!Array.isArray(marks) || marks.length !== QUESTIONS_PER_CONCEPT || marks.some(m => typeof m !== 'boolean')) {
          throw new HttpError(400, `marks must be ${QUESTIONS_PER_CONCEPT} true/false values.`);
        }
        answers = (marks as boolean[]).map((m, i) => ({ n: i + 1, given: null, correct: m }));
      }
      const score = answers.filter(a => a.correct).length;
      planned.push({
        schoolId: cls.schoolId, classId: cls.id, studentId: e.studentId, bankLevel: sheet.bankLevel, levelNumber: sheet.levelNumber, set: sheet.set, answers, score, band: bandFromScore(score),
        source: hasMarks ? 'marks' : e.source === 'scan' ? 'scan' : 'typed', createdAt: new Date().toISOString(), recordedBy: user.id,
      });
    }
    const attempts = [];
    for (const a of planned) attempts.push(await repos.attempts.add(a));
    res.status(201).json({ attempts });
  }));

  const scanLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => req.user?.id ?? 'anonymous', validate: { keyGeneratorIpFallback: false },
    message: { error: 'Too many photos this hour. Please mark the rest by hand or try again later.' },
  });
  router.post('/classes/:id/scan', scanLimiter, handler(async (req, res) => {
    await loadClass(String(req.params.id), req.user!); // access check only
    if (!reader) throw new HttpError(503, 'Photo reading is not switched on yet. Please mark by hand.');
    const sheet = await readSheet(req.body ?? {});
    const image = req.body?.imageBase64, type = req.body?.mimeType;
    if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'The photo is missing, too large or not valid.');
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(400, 'The photo must be a JPEG or PNG.');
    const read = await reader({ imageBase64: image, questions: sheet.questions.map(q => ({ n: q.n, text: q.text })) });
    res.json({ answers: read, suggestedMarks: read.map((g, i) => g !== null && answersMatch(g, sheet.answers[i])) });
  }));

  return router;
}
