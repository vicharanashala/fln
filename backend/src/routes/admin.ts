import express from 'express';
import bcrypt from 'bcrypt';
import { dbStore, UserRole, User } from '../db';
import { getAuthUser, sanitizeUser } from '../auth';

export function registerAdminRoutes(app: express.Express) {
  // Admin Creation (by Superadmin)
  app.post('/api/admin/create', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }

    const { name, email, password, role, stateCode, districtCode, blockCode, schoolId, assignedSchools } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Verify Password complexity (§3.2 A-3)
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements. Must be >= 8 chars and contain uppercase, digit, and special char.' });
    }

    const users = await dbStore.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Issue 2 + Issue 10: for principals (UserRole.SCHOOL) and teachers
    // (UserRole.TEACHER), the schoolId is the source of truth for school
    // identity and geography. We explicitly:
    //   1. Require schoolId.
    //   2. Validate that the school exists (case-insensitive lookup matches
    //      the way /api/schools stores ids).
    //   3. Derive stateCode/districtCode/blockCode from the school, overriding
    //      anything the caller may have submitted.
    //   4. If the caller did submit conflicting geography, reject with HTTP
    //      400 rather than silently overriding, so misconfigurations are
    //      surfaced instead of hidden.
    //
    // For other roles (ADMIN, district/block coordinators, volunteers) we
    // still accept the geographic fields the caller submits — those accounts
    // legitimately span a wider scope.
    let resolvedSchoolId: string | undefined = schoolId || undefined;
    let resolvedStateCode: string | undefined = stateCode ? stateCode.toUpperCase() : undefined;
    let resolvedDistrictCode: string | undefined = districtCode ? districtCode.toUpperCase() : undefined;
    let resolvedBlockCode: string | undefined = blockCode ? blockCode.toUpperCase() : undefined;

    if (role === UserRole.SCHOOL || role === UserRole.TEACHER) {
      const roleLabel = role === UserRole.SCHOOL ? 'school' : 'teacher';
      if (!schoolId) {
        return res.status(400).json({ error: `schoolId is required when role is ${roleLabel}.` });
      }
      const schools = await dbStore.getSchools();
      const targetSchool = schools.find(s => s.id.toLowerCase() === String(schoolId).toLowerCase());
      if (!targetSchool) {
        return res.status(400).json({ error: `Unknown school: ${schoolId}. Onboard the school first via POST /api/schools.` });
      }
      // Reject conflicting geo up front so silent override doesn't mask
      // configuration mistakes.
      const conflicts: string[] = [];
      if (resolvedStateCode && resolvedStateCode !== targetSchool.stateCode) conflicts.push(`stateCode ${resolvedStateCode} != school ${targetSchool.stateCode}`);
      if (resolvedDistrictCode && resolvedDistrictCode !== targetSchool.districtCode) conflicts.push(`districtCode ${resolvedDistrictCode} != school ${targetSchool.districtCode}`);
      if (resolvedBlockCode && resolvedBlockCode !== targetSchool.blockCode) conflicts.push(`blockCode ${resolvedBlockCode} != school ${targetSchool.blockCode}`);
      if (conflicts.length) {
        return res.status(400).json({ error: `Geographic values conflict with school ${targetSchool.id}: ${conflicts.join('; ')}. Use the school's own geography or fix the school's record.` });
      }
      // Derive from school.
      resolvedSchoolId = targetSchool.id;
      resolvedStateCode = targetSchool.stateCode;
      resolvedDistrictCode = targetSchool.districtCode;
      resolvedBlockCode = targetSchool.blockCode;
    }

    const newUser: User = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      name,
      email: email.toLowerCase(),
      role: role as UserRole,
      passwordHash: await bcrypt.hash(password, 10),
      stateCode: resolvedStateCode,
      districtCode: resolvedDistrictCode,
      blockCode: resolvedBlockCode,
      schoolId: resolvedSchoolId,
      assignedSchools: assignedSchools || undefined
    };

    await dbStore.addUser(newUser);

    // Add Log entry
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: resolvedSchoolId || '',
      schoolName: resolvedSchoolId ? 'GPS' : 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      // Issue 16: account-creation events are "register", not "verify".
      activityType: 'register',
      status: 'Success',
      details: `Superadmin created account: ${name} (${role}) for scope ${resolvedStateCode || '*'}/${resolvedDistrictCode || '*'}/${resolvedBlockCode || '*'}${resolvedSchoolId ? ` (school ${resolvedSchoolId})` : ''}`
    });

    res.json(newUser);
  });

  app.get('/api/admin/coordinators', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const users = await dbStore.getUsers();
    let filtered: typeof users;
    if (user.role === UserRole.SUPERADMIN) {
      filtered = users;
    } else if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      filtered = users.filter(u => u.schoolId === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      filtered = users.filter(u => user.assignedSchools?.includes(u.schoolId || ''));
    } else if (user.role === UserRole.DISTRICT_ADMIN) {
      filtered = users.filter(u => u.districtCode === user.districtCode);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      filtered = users.filter(u => u.blockCode === user.blockCode);
    } else if (user.role === UserRole.ADMIN) {
      filtered = users.filter(u => u.stateCode === user.stateCode);
    } else {
      // Fail closed. This started as `let filtered = users` with no final branch,
      // so SUPERADMIN fell through correctly by accident — and so would any role
      // added later, handing it every user in the system.
      return res.status(403).json({ error: 'Forbidden: role not permitted to list coordinators.' });
    }
    res.json(filtered.map(sanitizeUser));
  });

  // Revive Banned Teacher (§6.5)
  app.post('/api/admin/revive-teacher', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { teacherId } = req.body;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID is required.' });

    const users = await dbStore.getUsers();
    const teacher = users.find(u => u.id === teacherId && u.role === UserRole.TEACHER);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    await dbStore.updateUser(teacher.id, {
      delayedAttemptsCount: 0,
      isBanned: false
    });

    if (teacher.schoolId) {
      const schoolTeachers = users.filter(u => u.role === UserRole.TEACHER && u.schoolId === teacher.schoolId);
      const anyBanned = schoolTeachers.some(t => t.isBanned && t.id !== teacher.id);
      if (!anyBanned) {
        await dbStore.updateSchool(teacher.schoolId, { isAccessLocked: false });
      }
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: teacher.schoolId || 'N/A',
      schoolName: 'GPS',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Revived teacher ${teacher.name} (${teacher.email}) resetting delayed attempts.`
    });

    res.json({ success: true, message: 'Teacher successfully revived.' });
  });

  // Restore School Access (§6.5)
  app.post('/api/admin/restore-school', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [UserRole.SUPERADMIN, UserRole.ADMIN];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { schoolId } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'School ID is required.' });

    const schools = await dbStore.getSchools();
    const school = schools.find(s => s.id === schoolId);
    if (!school) return res.status(404).json({ error: 'School not found.' });

    await dbStore.updateSchool(schoolId, { isAccessLocked: false });

    // Revive all teachers in this school
    const users = await dbStore.getUsers();
    const schoolTeachers = users.filter(u => u.role === UserRole.TEACHER && u.schoolId === schoolId);
    for (const teacher of schoolTeachers) {
      await dbStore.updateUser(teacher.id, {
        delayedAttemptsCount: 0,
        isBanned: false
      });
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: schoolId,
      schoolName: school.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Manually restored school access for school: ${school.name}`
    });

    res.json({ success: true, message: 'School access manually restored.' });
  });

  // ══════════════════════════════════════════
  // DATABASE RESET (Superadmin only)
  // ══════════════════════════════════════════
  // Wipes every collection and re-seeds. Requires an authenticated superadmin.
  // Deliberately POST-only: a GET reset was removed because it let any prefetch,
  // crawler, or <img>/link trigger a full database wipe with no credentials.
  app.post('/api/reset', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    await dbStore.reset();
    res.json({ success: true, message: 'Database reset to fresh seed data.' });
  });
}
