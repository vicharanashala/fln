import express from 'express';
import bcrypt from 'bcrypt';
import { dbStore, UserRole, User } from '../db';
import { getAuthUser, sanitizeUser } from '../auth';

// Coordinator registration: state -> district -> block -> school cascade, then
// creating a teacher account scoped to the chosen school.
const COORDINATOR_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN];

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

    res.json(enriched);
  });

  app.post('/api/teachers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || !COORDINATOR_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden. Coordinator role required.' });
    }

    const { firstName, lastName, email, phoneNumber, password, school } = req.body;
    if (!firstName || !lastName || !email || !password || !school) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements. Must be >= 8 chars and contain uppercase, digit, and special char.' });
    }

    const schools = await dbStore.getSchools();
    const targetSchool = schools.find(s => s.id.toLowerCase() === String(school).toLowerCase());
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
      activityType: 'verify',
      status: 'Success',
      details: `Coordinator registered teacher: ${newTeacher.name} at ${targetSchool.name}`,
    });

    res.json({
      success: true,
      message: 'Teacher registered successfully.',
      data: { teacherId, firstName, lastName, email: newTeacher.email },
    });
  });
}
