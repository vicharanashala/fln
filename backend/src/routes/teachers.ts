import express from 'express';
import bcrypt from 'bcrypt';
import { dbStore, UserRole, User } from '../db';
import { getAuthUser, sanitizeUser } from '../auth';

// Roles permitted to register a teacher. Issue 4 added SCHOOL so that a
// principal can add teachers to their own school; the route below then
// forces the resulting teacher's schoolId to the principal's own schoolId.
const TEACHER_REGISTRATION_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.BLOCK_ADMIN,
  UserRole.SCHOOL,
];

export function registerTeacherRoutes(app: express.Express) {
  app.get('/api/teachers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (![UserRole.SCHOOL, UserRole.BLOCK_ADMIN, UserRole.SUPERADMIN].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const [users, schools, classes, students] = await Promise.all([
      dbStore.getUsers(),
      dbStore.getSchools(),
      dbStore.getClasses(),
      dbStore.getStudents(),
    ]);
    const schoolById = new Map(schools.map(s => [s.id, s]));

    let teachers = users.filter(u => u.role === UserRole.TEACHER);
    if (user.role === UserRole.SCHOOL) {
      teachers = teachers.filter(t => t.schoolId === user.schoolId);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      teachers = teachers.filter(t => schoolById.get(t.schoolId || '')?.blockCode === user.blockCode);
    }

    const enriched = teachers.map(t => {
      const teacherClasses = classes.filter(c => c.teacherId === t.id);
      const studentsCount = students.filter(s => s.teacherId === t.id).length;
      return {
        ...sanitizeUser(t),
        classes: teacherClasses.map(c => `${c.className} ${c.section}`),
        studentsCount,
        status: t.isBanned ? 'Inactive' : 'Active',
      };
    });

    // Opt-in pagination (same pattern as GET /api/students, PR #115).
    // Omitting ?page & ?limit returns the full scoped list — no existing caller breaks.
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    if (pageParam || limitParam) {
      const page  = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(limitParam || '50', 10) || 50));
      const total = enriched.length;
      const start = (page - 1) * limit;
      res.set('X-Total-Count', String(total));
      res.set('X-Page',        String(page));
      res.set('X-Pages',       String(Math.max(1, Math.ceil(total / limit))));
      return res.json(enriched.slice(start, start + limit));
    }

    res.json(enriched);
  });

  app.post('/api/teachers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || !TEACHER_REGISTRATION_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden. Coordinator role required.' });
    }

    const { firstName, lastName, email, phoneNumber, password, school } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements. Must be >= 8 chars and contain uppercase, digit, and special char.' });
    }

    // Issue 4: principals are scoped to their own school. If a principal
    // submits a `school` field that disagrees with their own schoolId, we
    // surface the misconfiguration with HTTP 400 instead of silently
    // overriding — that way, a copy-paste mistake can't accidentally
    // create a teacher at the wrong school.
    let resolvedSchoolId: string;
    if (user.role === UserRole.SCHOOL) {
      if (!user.schoolId) {
        return res.status(400).json({ error: 'Principal account has no schoolId; cannot register a teacher.' });
      }
      if (school !== undefined && school !== null && String(school).toLowerCase() !== user.schoolId.toLowerCase()) {
        return res.status(400).json({ error: `A principal can only register teachers at their own school (${user.schoolId}). Got '${school}'.` });
      }
      resolvedSchoolId = user.schoolId;
    } else {
      if (!school) {
        return res.status(400).json({ error: 'school is required for coordinator-created teachers.' });
      }
      resolvedSchoolId = String(school);
    }

    const schools = await dbStore.getSchools();
    const targetSchool = schools.find(s => s.id.toLowerCase() === resolvedSchoolId.toLowerCase());
    if (!targetSchool) return res.status(400).json({ error: 'Unknown school.' });

    const users = await dbStore.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const teacherId = 'u_' + Math.random().toString(36).substr(2, 9);
    const newTeacher: User = {
      id: teacherId,
      name: `${firstName} ${lastName}`,
      email: email.toLowerCase(),
      role: UserRole.TEACHER,
      passwordHash: await bcrypt.hash(password, 10),
      phoneNumber: phoneNumber || undefined,
      stateCode: targetSchool.stateCode,
      districtCode: targetSchool.districtCode,
      blockCode: targetSchool.blockCode,
      schoolId: targetSchool.id,
    };

    await dbStore.addUser(newTeacher);

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: targetSchool.id,
      schoolName: targetSchool.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      // Issue 16: teacher registration is "register", not "verify".
      activityType: 'register',
      status: 'Success',
      details: user.role === UserRole.SCHOOL
        ? `Principal registered teacher: ${newTeacher.name} at ${targetSchool.name}`
        : `Coordinator registered teacher: ${newTeacher.name} at ${targetSchool.name}`,
    });

    res.json({
      success: true,
      message: 'Teacher registered successfully.',
      data: { teacherId, firstName, lastName, email: newTeacher.email, schoolId: targetSchool.id },
    });
  });

  // Issue #182: a teacher's own bulk-request history — what type of test/
  // worksheet she's requested, when, and for how many students. A teacher
  // can always see her own history; admin-tier roles can look up any
  // teacher's for oversight.
  app.get('/api/teachers/:id/test-history', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const targetId = req.params.id;
    const isSelf = user.id === targetId;
    const isOversight = [
      UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN,
      UserRole.BLOCK_ADMIN, UserRole.SCHOOL,
    ].includes(user.role);
    if (!isSelf && !isOversight) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const history = await dbStore.getTestHistory(targetId);
    res.json(history);
  });
}
