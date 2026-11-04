import { Router } from 'express';
import { classForLevel } from '@fln/curriculum';
import { canAccessClass } from '../access';
import { HttpError, handler, requireString } from '../http';
import type { Repos } from '../repos';
import type { User } from '../types';

export function rosterRoutes(repos: Repos): Router {
  const router = Router();

  router.get('/classes', handler(async (req, res) => {
    const all = await repos.classes.list();
    res.json({ classes: all.filter(c => canAccessClass(req.user!, c)) });
  }));

  async function loadClass(id: string, user: User) {
    const cls = await repos.classes.byId(id);
    if (!cls) throw new HttpError(404, 'Class not found.');
    if (!canAccessClass(user, cls)) throw new HttpError(403, 'Forbidden');
    return cls;
  }

  router.get('/classes/:id/students', handler(async (req, res) => {
    const cls = await loadClass(String(req.params.id), req.user!);
    const students = (await repos.students.byClass(cls.id)).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ class: cls, students });
  }));

  router.post('/classes/:id/students', handler(async (req, res) => {
    const cls = await loadClass(String(req.params.id), req.user!);
    const name = requireString(req.body?.name, 'name');
    const level = req.body?.currentLevel;
    if (!Number.isInteger(level) || classForLevel(level) === undefined || classForLevel(level) === 'Beyond MVP') {
      throw new HttpError(400, 'currentLevel must be a whole number from a Balvatika to Class 3 level.');
    }
    const student = await repos.students.add({ schoolId: cls.schoolId, classId: cls.id, name, currentLevel: level });
    res.status(201).json({ student });
  }));

  return router;
}
