import { Router } from 'express';
import { QUESTIONS_PER_CONCEPT } from '@fln/domain';
import { HttpError, handler, requireString } from '../http';
import type { QuestionBank } from '../questionBank';
import type { Repos } from '../repos';
import { CLASS_NAMES, isClassName, levelRange, loadClass } from '../services/classes';

const MAX_NEW_STUDENTS = 60;
const MAX_IMPORT_ROWS = 500;

/** Classes and their children: create a class, add many children, see which levels have worksheets. */
export function classRoutes(repos: Repos, bank: QuestionBank): Router {
  const router = Router();

  router.post('/classes', handler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'teacher' || !user.schoolId) throw new HttpError(403, 'Only a teacher can create a class.');
    const className = req.body?.className;
    if (!isClassName(className)) throw new HttpError(400, `className must be one of: ${CLASS_NAMES.join(', ')}.`);
    const section = requireString(req.body?.section ?? 'A', 'section', 10);
    const existing = (await repos.classes.list()).find(c => c.teacherId === user.id && c.className === className && c.section.toLowerCase() === section.toLowerCase());
    if (existing) throw new HttpError(409, 'You already have this class and section.');
    res.status(201).json({ class: await repos.classes.add({ schoolId: user.schoolId, className, section, teacherId: user.id }) });
  }));

  router.post('/classes/:id/students/bulk', handler(async (req, res) => {
    const cls = await loadClass(repos, String(req.params.id), req.user!);
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
    const startLevel = levelRange(cls.className)?.[0] ?? 1;
    const students = [];
    for (const name of names) students.push(await repos.students.add({ schoolId: cls.schoolId, classId: cls.id, name, currentLevel: startLevel }));
    res.status(201).json({ students });
  }));

  /**
   * Imports a whole school file in one go. Each row names a child, a class and a section; classes that do not exist
   * yet are created for this teacher. A bad row is skipped with its reason and never stops the good ones.
   */
  router.post('/students/import', handler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'teacher' || !user.schoolId) throw new HttpError(403, 'Only a teacher can import children.');
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, 'rows must be a list with at least one row.');
    if (rows.length > MAX_IMPORT_ROWS) throw new HttpError(400, `A file may have at most ${MAX_IMPORT_ROWS} rows.`);
    const classes = (await repos.classes.list()).filter(c => c.teacherId === user.id);
    const names = new Map<string, Set<string>>(); // class id -> lower-cased names already there or added in this file
    const skipped: { row: number; reason: string }[] = [];
    let createdClasses = 0, createdStudents = 0;
    for (const [i, row] of (rows as { name?: unknown; className?: unknown; section?: unknown }[]).entries()) {
      const rowNo = i + 1;
      const name = typeof row?.name === 'string' ? row.name.trim().replace(/\s+/g, ' ') : '';
      const section = typeof row?.section === 'string' && row.section.trim() ? row.section.trim() : 'A';
      if (!name) { skipped.push({ row: rowNo, reason: 'The name is empty.' }); continue; }
      if (name.length > 100) { skipped.push({ row: rowNo, reason: 'The name is longer than 100 characters.' }); continue; }
      if (!isClassName(row.className)) { skipped.push({ row: rowNo, reason: `The class must be one of: ${CLASS_NAMES.join(', ')}.` }); continue; }
      if (section.length > 10) { skipped.push({ row: rowNo, reason: 'The section is longer than 10 characters.' }); continue; }
      let cls = classes.find(c => c.className === row.className && c.section.toLowerCase() === section.toLowerCase());
      if (!cls) {
        cls = await repos.classes.add({ schoolId: user.schoolId, className: row.className, section, teacherId: user.id });
        classes.push(cls);
        createdClasses++;
      }
      let known = names.get(cls.id);
      if (!known) { known = new Set((await repos.students.byClass(cls.id)).map(s => s.name.toLowerCase())); names.set(cls.id, known); }
      if (known.has(name.toLowerCase())) { skipped.push({ row: rowNo, reason: 'This child is already in the class.' }); continue; }
      known.add(name.toLowerCase());
      await repos.students.add({ schoolId: cls.schoolId, classId: cls.id, name, currentLevel: levelRange(cls.className)?.[0] ?? 1 });
      createdStudents++;
    }
    if (createdStudents === 0) throw new HttpError(400, 'No child could be imported. ' + (skipped[0] ? `Row ${skipped[0].row}: ${skipped[0].reason}` : ''));
    res.status(201).json({ createdStudents, createdClasses, skipped });
  }));

  router.get('/classes/:id/levels', handler(async (req, res) => {
    const cls = await loadClass(repos, String(req.params.id), req.user!);
    const upTo = levelRange(cls.className)?.[1] ?? 0;
    const [levels, counts] = await Promise.all([repos.levels.list(), repos.questions.countsByLevel()]);
    res.json({
      levels: levels.filter(l => l.levelNumber <= upTo).map(l => ({
        levelNumber: l.levelNumber, title: l.title, group: l.group,
        sets: Math.floor((counts[l.levelNumber]?.writtenApproved ?? 0) / QUESTIONS_PER_CONCEPT),
      })),
    });
  }));

  router.get('/classes/:id/topics', handler(async (req, res) => {
    await loadClass(repos, String(req.params.id), req.user!);
    res.json({ topics: bank.topics() });
  }));

  return router;
}
