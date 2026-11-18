import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError, handler } from '../http';
import { isPrintedSheetId, parsePrintedSheetQr, readQrFromImage } from '@fln/domain';
import type { ReadAnswers } from '../ollama';
import type { Repos } from '../repos';
import { loadClass } from '../services/classes';
import { gradePaper, suggestMarks, type PaperEntry } from '../services/grading';
import type { SheetService } from '../services/sheets';
import type { Attempt, PrintedSheet } from '../types';

const MAX_IMAGE_BASE64_CHARS = 8_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
/** Most children one print may name (the same limit as saving results). */
const MAX_PRINTED_COPIES = 200;

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
    // With `printedSheetId` the papers are marked against that print, exactly as it was printed (#904); otherwise the teacher names the sheet.
    const printedId = req.body?.printedSheetId;
    let printed: PrintedSheet | undefined;
    if (printedId !== undefined) {
      if (req.body?.bankLevel !== undefined || req.body?.levelNumber !== undefined || req.body?.set !== undefined) throw new HttpError(400, 'Give either printedSheetId or a sheet, not both.');
      if (!isPrintedSheetId(printedId)) throw new HttpError(400, 'printedSheetId is not a printed sheet id.');
      printed = await repos.printedSheets.byId(printedId);
      if (!printed || printed.classId !== cls.id) throw new HttpError(404, 'That print was not found for this class.');
    }
    const sheet = printed ? await sheets.fromPrinted(printed) : await sheets.resolve(req.body ?? {});
    const entries = req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200) throw new HttpError(400, 'entries must be a list of 1 to 200 papers.');
    const roster = new Set((await repos.students.byClass(cls.id)).map(s => s.id));
    // Check every paper before saving any, so one bad paper never leaves the others half saved.
    const planned: Omit<Attempt, 'id'>[] = (entries as PaperEntry[]).map(e => {
      if (typeof e?.studentId !== 'string' || !roster.has(e.studentId)) throw new HttpError(400, 'A paper is for a child who is not in this class.');
      if (printed && !printed.studentIds.includes(e.studentId)) throw new HttpError(400, 'That print was not made for this child.');
      const graded = gradePaper(e, sheet.answers);
      return {
        schoolId: cls.schoolId, classId: cls.id, studentId: e.studentId, bankLevel: sheet.bankLevel, levelNumber: sheet.levelNumber, set: sheet.set,
        ...graded, createdAt: new Date().toISOString(), recordedBy: user.id, ...(printed ? { printedSheetId: printed.id } : {}),
      };
    });
    const attempts = [];
    for (const a of planned) attempts.push(await repos.attempts.add(a));
    res.status(201).json({ attempts });
  }));

  // Saved when a worksheet is printed (#904), so that each child's paper can carry a QR code naming this record and
  // the child. Printing again saves a new record: each print is its own paper.
  router.post('/classes/:id/printed-sheets', handler(async (req, res) => {
    const user = req.user!;
    const cls = await loadClass(repos, String(req.params.id), user);
    const sheet = await sheets.resolve(req.body ?? {});
    const roster = await repos.students.byClass(cls.id);
    const requested = req.body?.studentIds;
    let chosen = roster;
    if (requested !== undefined) {
      if (!Array.isArray(requested) || requested.length === 0 || requested.length > MAX_PRINTED_COPIES || requested.some(id => typeof id !== 'string')) {
        throw new HttpError(400, `studentIds must be a list of 1 to ${MAX_PRINTED_COPIES} children.`);
      }
      if (new Set(requested).size !== requested.length) throw new HttpError(400, 'studentIds must not repeat a child.');
      const byId = new Map(roster.map(s => [s.id, s]));
      if (requested.some(id => !byId.has(id))) throw new HttpError(400, 'A paper is for a child who is not in this class.');
      chosen = requested.map(id => byId.get(id)!);
    }
    if (chosen.length === 0) throw new HttpError(400, 'Add children to the class first. One copy is printed for each child.');
    if (chosen.length > MAX_PRINTED_COPIES) throw new HttpError(400, `At most ${MAX_PRINTED_COPIES} copies can be printed at once.`);
    const printedSheet = await repos.printedSheets.add({
      schoolId: cls.schoolId, classId: cls.id, bankLevel: sheet.bankLevel, levelNumber: sheet.levelNumber, set: sheet.set,
      title: sheet.title, questionIds: sheet.questionIds, answerKey: [...sheet.answers], studentIds: chosen.map(s => s.id), createdAt: new Date().toISOString(), createdBy: user.id,
    });
    res.status(201).json({ printedSheet });
  }));

  const scanLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: limits.scanPerHour, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => req.user?.id ?? 'anonymous', validate: { keyGeneratorIpFallback: false },
    message: { error: 'Too many photos this hour. Please mark the rest by hand or try again later.' },
  });
  router.post('/classes/:id/scan', scanLimiter, handler(async (req, res) => {
    const cls = await loadClass(repos, String(req.params.id), req.user!);
    if (!reader) throw new HttpError(503, 'Photo reading is not switched on yet. Please mark by hand.');
    const image = req.body?.imageBase64, type = req.body?.mimeType;
    if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'The photo is missing, too large or not valid.');
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(400, 'The photo must be a JPEG or PNG.');
    // The code printed on the paper (#904) names the print and the child. When it is one of ours it decides the sheet and the child, and the
    // answers are marked against what was printed. A paper with no readable code, or a code that is not ours, falls back to the sheet the
    // teacher chose. A code that is ours but wrong here (another class, an unknown print, a child it was not printed for) is refused
    // before any model call, because marking it against some other sheet would give a wrong result without anyone noticing.
    let matched: { printedSheet: { id: string; title: string; set: number; bankLevel: number | null; levelNumber: number | null }; student: { id: string; name: string } } | null = null;
    let sheet;
    const code = parsePrintedSheetQr(readQrFromImage(Buffer.from(image, 'base64')));
    if (code) {
      const printed = await repos.printedSheets.byId(code.printedSheetId);
      if (!printed || printed.classId !== cls.id) throw new HttpError(422, 'This paper was printed for another class, or its print could not be found. Please mark it by hand.');
      if (!printed.studentIds.includes(code.studentId)) throw new HttpError(422, 'This paper was not printed for the child its code names. Please mark it by hand.');
      const student = (await repos.students.byClass(cls.id)).find(s => s.id === code.studentId);
      if (!student) throw new HttpError(422, 'The child on this paper is no longer in this class. Please mark it by hand.');
      sheet = await sheets.fromPrinted(printed);
      matched = { printedSheet: { id: printed.id, title: printed.title, set: printed.set, bankLevel: printed.bankLevel, levelNumber: printed.levelNumber }, student: { id: student.id, name: student.name } };
    } else {
      // No readable code: the teacher's own choice of sheet is needed. Say what happened, not what the old form field was called.
      if (req.body?.bankLevel === undefined && req.body?.levelNumber === undefined) {
        throw new HttpError(422, 'No code was found on this paper. Take the photo again with the top of the paper in view and in focus, or choose the sheet and the child by hand.');
      }
      sheet = await sheets.resolve(req.body ?? {});
    }
    const read = await reader({ imageBase64: image, questions: sheet.questions.map(q => ({ n: q.n, text: q.text })) });
    res.json({ answers: read, suggestedMarks: suggestMarks(read, sheet.answers), matched });
  }));

  return router;
}
