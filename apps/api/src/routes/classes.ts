import { Router } from 'express';
import { QUESTIONS_PER_CONCEPT } from '@fln/domain';
import { HttpError, handler, requireString } from '../http';
import type { QuestionBank } from '../questionBank';
import type { Repos } from '../repos';
import { CLASS_NAMES, isClassName, levelRange, loadClass } from '../services/classes';

const MAX_NEW_STUDENTS = 60;

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
