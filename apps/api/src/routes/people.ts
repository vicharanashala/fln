import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { passwordProblem, requireRole, toPublic, type AuthConfig } from '../auth';
import { HttpError, handler, requireString } from '../http';
import type { Repos } from '../repos';
import { ROLES, type Role, type User } from '../types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function peopleRoutes(repos: Repos, cfg: AuthConfig): Router {
  const router = Router();

  router.get('/schools', handler(async (req, res) => {
    const user = req.user!;
    const all = await repos.schools.list();
    res.json({ schools: user.role === 'superadmin' ? all : all.filter(s => s.id === user.schoolId) });
  }));

  router.post('/schools', requireRole('superadmin'), handler(async (req, res) => {
    const name = requireString(req.body?.name, 'name', 120);
    if ((await repos.schools.list()).some(s => s.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, 'A school with this name already exists.');
    res.status(201).json({ school: await repos.schools.add({ name }) });
  }));

  router.get('/users', requireRole('superadmin', 'school'), handler(async (req, res) => {
    const me = req.user!;
    const all = await repos.users.list();
    res.json({ users: (me.role === 'superadmin' ? all : all.filter(u => u.role === 'teacher' && u.schoolId === me.schoolId)).map(toPublic) });
  }));

  router.post('/users', requireRole('superadmin', 'school'), handler(async (req, res) => {
    const me = req.user!;
    const role = req.body?.role as Role;
    if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(', ')}.`);
    // A superadmin can create anyone; a school account can only add teachers to its own school.
    if (me.role === 'school' && role !== 'teacher') throw new HttpError(403, 'A school account can only add teachers.');
    const name = requireString(req.body?.name, 'name', 100);
    const email = requireString(req.body?.email, 'email', 200).toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(400, 'email must be a valid address.');
    const password = requireString(req.body?.password, 'password', 200);
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);
    let schoolId: string | undefined;
    if (role !== 'superadmin') {
      schoolId = me.role === 'school' ? me.schoolId : requireString(req.body?.schoolId, 'schoolId', 100);
      if (!schoolId || !(await repos.schools.byId(schoolId))) throw new HttpError(400, 'Unknown school.');
    }
    if (await repos.users.byEmail(email)) throw new HttpError(409, 'An account with this email already exists.');
    const user: Omit<User, 'id'> = { email, name, role, schoolId, passwordHash: await bcrypt.hash(password, cfg.bcryptCost ?? 10) };
    res.status(201).json({ user: toPublic(await repos.users.add(user)) });
  }));

  router.patch('/users/:id', requireRole('superadmin', 'school'), handler(async (req, res) => {
    const me = req.user!;
    const target = await repos.users.byId(String(req.params.id));
    if (!target) throw new HttpError(404, 'User not found.');
    if (me.role === 'school' && !(target.role === 'teacher' && target.schoolId === me.schoolId)) throw new HttpError(403, 'Forbidden');
    if (typeof req.body?.isBanned !== 'boolean') throw new HttpError(400, 'isBanned must be true or false.');
    if (target.id === me.id) throw new HttpError(400, 'You cannot block your own account.');
    res.json({ user: toPublic((await repos.users.update(target.id, { isBanned: req.body.isBanned }))!) });
  }));

  return router;
}
