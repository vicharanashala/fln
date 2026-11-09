import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError, handler } from '../http';
import type { ReadAnswers } from '../ollama';
import type { Repos } from '../repos';
import { loadClass } from '../services/classes';
import { gradePaper, suggestMarks, type PaperEntry } from '../services/grading';
import type { SheetService } from '../services/sheets';
import type { Attempt } from '../types';

const MAX_IMAGE_BASE64_CHARS = 8_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png'];

export interface WorksheetLimits { scanPerHour: number }

/** Printing a sheet, recording what children scored, and reading a photographed paper. */
export function worksheetRoutes(repos: Repos, sheets: SheetService, limits: WorksheetLimits, reader?: ReadAnswers): Router {
  const router = Router();

  router.get('/classes/:id/worksheet', handler(async (req, res) => {
    const cls = await loadClass(repos, String(req.params.id), req.user!);
    const q = req.query;
    const sheet = await sheets.resolve({ bankLevel: q.bankLevel === undefined ? undefined : Number(q.bankLevel), levelNumber: q.levelNumber === undefined ? undefined : Number(q.levelNumber), set: Number(q.set ?? 0) });
    const students = (await repos.students.byClass(cls.id)).sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      class: cls,
      sheet: { bankLevel: sheet.bankLevel, levelNumber: sheet.levelNumber, title: sheet.title, set: sheet.set, questions: sheet.questions },
      answerKey: sheet.answers, students,
    });
  }));

  router.get('/classes/:id/results', handler(async (req, res) => {
    const cls = await loadClass(repos, String(req.params.id), req.user!);
    res.json({ attempts: await repos.attempts.byClass(cls.id) });
  }));

  router.post('/classes/:id/results', handler(async (req, res) => {
    const user = req.user!;
    const cls = await loadClass(repos, String(req.params.id), user);
    const sheet = await sheets.resolve(req.body ?? {});
    const entries = req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200) throw new HttpError(400, 'entries must be a list of 1 to 200 papers.');
    const roster = new Set((await repos.students.byClass(cls.id)).map(s => s.id));
    // Check every paper before saving any, so one bad paper never leaves the others half saved.
    const planned: Omit<Attempt, 'id'>[] = (entries as PaperEntry[]).map(e => {
      if (typeof e?.studentId !== 'string' || !roster.has(e.studentId)) throw new HttpError(400, 'A paper is for a child who is not in this class.');
      const graded = gradePaper(e, sheet.answers);
      return {
        schoolId: cls.schoolId, classId: cls.id, studentId: e.studentId, bankLevel: sheet.bankLevel, levelNumber: sheet.levelNumber, set: sheet.set,
        ...graded, createdAt: new Date().toISOString(), recordedBy: user.id,
      };
    });
    const attempts = [];
    for (const a of planned) attempts.push(await repos.attempts.add(a));
    res.status(201).json({ attempts });
  }));

  const scanLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: limits.scanPerHour, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => req.user?.id ?? 'anonymous', validate: { keyGeneratorIpFallback: false },
    message: { error: 'Too many photos this hour. Please mark the rest by hand or try again later.' },
  });
  router.post('/classes/:id/scan', scanLimiter, handler(async (req, res) => {
    await loadClass(repos, String(req.params.id), req.user!); // access check only
    if (!reader) throw new HttpError(503, 'Photo reading is not switched on yet. Please mark by hand.');
    const sheet = await sheets.resolve(req.body ?? {});
    const image = req.body?.imageBase64, type = req.body?.mimeType;
    if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'The photo is missing, too large or not valid.');
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(400, 'The photo must be a JPEG or PNG.');
    const read = await reader({ imageBase64: image, questions: sheet.questions.map(q => ({ n: q.n, text: q.text })) });
    res.json({ answers: read, suggestedMarks: suggestMarks(read, sheet.answers) });
  }));

  return router;
}
