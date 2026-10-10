import express from 'express';
import bcrypt from 'bcrypt';
import { dbStore, UserRole, School } from '../db';
import { getAuthUser } from '../auth';
import { generatePrincipalId } from '../idGenerator';
import { STATES_UTS } from '../geoData';

export function registerSchoolRoutes(app: express.Express) {
  app.get('/api/schools', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const schools = await dbStore.getSchools();

    let scoped: typeof schools;
    if (user.role === UserRole.SUPERADMIN) {
      scoped = schools;
    } else if (user.role === UserRole.ADMIN) {
      // State admin, so scoped to their own state. GET /api/logbook and
      // GET /api/admin/coordinators both already scope ADMIN by stateCode; this
      // endpoint returned every school nationwide, so a Punjab admin could read
      // Rajasthan's schools.
      scoped = schools.filter(s => s.stateCode === user.stateCode);
    } else if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      scoped = schools.filter(s => s.id === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      scoped = schools.filter(s => user.assignedSchools?.includes(s.id));
    } else if (user.role === UserRole.DISTRICT_ADMIN) {
      scoped = schools.filter(s => s.districtCode === user.districtCode);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      scoped = schools.filter(s => s.blockCode === user.blockCode);
    } else {
      // Fail closed. This branch previously returned every school nationwide, so
      // any role added later leaked the full list until someone remembered to
      // come back here.
      return res.status(403).json({ error: 'Forbidden: role not permitted to list schools.' });
    }

    // Opt-in pagination (same pattern as GET /api/students, PR #115).
    // Omitting ?page & ?limit returns the full scoped list — no existing caller breaks.
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    if (pageParam || limitParam) {
      const page  = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(limitParam || '50', 10) || 50));
      const total = scoped.length;
      const start = (page - 1) * limit;
      res.set('X-Total-Count', String(total));
      res.set('X-Page',        String(page));
      res.set('X-Pages',       String(Math.max(1, Math.ceil(total / limit))));
      return res.json(scoped.slice(start, start + limit));
    }

    res.json(scoped);
  });

  app.post('/api/schools', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }

    const body = req.body || {};
    const required = ['id', 'name', 'stateCode', 'districtCode', 'blockCode', 'villageCity', 'addressLine1', 'pinCode', 'schoolType', 'managementType', 'email', 'phone'];
    const missing = required.filter(key => typeof body[key] !== 'string' || !body[key].trim());
    const establishmentYear = Number(body.establishmentYear);
    const currentYear = new Date().getFullYear();
    const initialClasses: string[] = Array.isArray(body.initialClasses)
      ? [...new Set<string>(body.initialClasses.map((value: unknown) => String(value).trim()).filter(Boolean))]
      : [];
    const validClassNames = initialClasses.every((className: string) => /^Class (?:[1-9]|1[0-2])$/.test(className));
    const principal = body.principal || {};
    const udiseCode = typeof body.udiseCode === 'string' ? body.udiseCode.trim() : '';
    const governmentSchoolCode = typeof body.governmentSchoolCode === 'string' ? body.governmentSchoolCode.trim() : '';
    if (missing.length || !Number.isInteger(establishmentYear) || establishmentYear < 1800 || establishmentYear > currentYear || initialClasses.length === 0 || !validClassNames ||
        (!udiseCode && !governmentSchoolCode) ||
        typeof principal.name !== 'string' || !principal.name.trim() || typeof principal.email !== 'string' || !principal.email.trim() ||
        typeof principal.password !== 'string' || !principal.password) {
      return res.status(400).json({ error: 'Missing or invalid required school identity fields.', fields: missing });
    }
    const id = body.id.trim();
    const name = body.name.trim();
    const stateCode = body.stateCode.trim();
    const districtCode = body.districtCode.trim();
    const blockCode = body.blockCode.trim();
    if (id.length > 80 || name.length > 200 || stateCode.length > 20 || districtCode.length > 40 || blockCode.length > 40 ||
        body.villageCity.trim().length > 120 || body.addressLine1.trim().length > 200 ||
        (typeof body.addressLine2 === 'string' && body.addressLine2.trim().length > 200) ||
        (typeof body.landmark === 'string' && body.landmark.trim().length > 120)) {
      return res.status(400).json({ error: 'One or more school identity fields exceed the allowed length.' });
    }
    const stateInfo = STATES_UTS.find(state => state.code === stateCode.toUpperCase());
    if (!stateInfo) return res.status(400).json({ error: 'Unknown state code.' });
    if (!stateInfo.districts.some(district => district.code === districtCode.toUpperCase())) {
      return res.status(400).json({ error: 'Unknown district for this state.' });
    }
    if (!/^[A-Z]+_\d+$/.test(blockCode.toUpperCase())) {
      return res.status(400).json({ error: 'Block code must look like GNT_01.' });
    }
    if (!/^\d{6}$/.test(body.pinCode.trim())) return res.status(400).json({ error: 'PIN code must contain exactly 6 digits.' });
    if (udiseCode && !/^\d{11}$/.test(udiseCode)) return res.status(400).json({ error: 'UDISE code must contain exactly 11 digits.' });
    if (governmentSchoolCode.length > 40) return res.status(400).json({ error: 'Government school code must be 40 characters or fewer.' });
    if (!['Primary', 'Middle', 'Secondary', 'Higher Secondary', 'Other'].includes(body.schoolType.trim()) ||
        !['Government', 'Government aided', 'Private', 'Other'].includes(body.managementType.trim())) {
      return res.status(400).json({ error: 'School type or management type is invalid.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || !/^[+\d][\d\s()-]{8,17}$/.test(body.phone.trim())) {
      return res.status(400).json({ error: 'Enter a valid school email and phone number.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(principal.email.trim())) return res.status(400).json({ error: 'Enter a valid principal email.' });
    if (!['high', 'low'].includes(body.strength || 'low')) return res.status(400).json({ error: 'Strength must be high or low.' });
    if (body.status !== undefined && !['active', 'pending', 'inactive'].includes(body.status)) return res.status(400).json({ error: 'Status must be active, pending, or inactive.' });
    const hasUppercase = /[A-Z]/.test(principal.password);
    const hasNumber = /[0-9]/.test(principal.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(principal.password);
    if (principal.password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Principal password must be at least 8 characters and include an uppercase letter, number, and special character.' });
    }

    const schools = await dbStore.getSchools();
    if (schools.some(s => s.id.toLowerCase() === id.toLowerCase())) return res.status(400).json({ error: 'School ID already exists.' });
    if (schools.some(s => (udiseCode && s.udiseCode === udiseCode) || (governmentSchoolCode && s.governmentSchoolCode === governmentSchoolCode))) {
      return res.status(400).json({ error: 'Government school code already exists.' });
    }
    const users = await dbStore.getUsers();
    if (users.some(u => u.email.toLowerCase() === principal.email.trim().toLowerCase())) return res.status(400).json({ error: 'A user with the principal email already exists.' });

    const timestamp = new Date().toISOString();
    const newSch: School = {
      id: id.toLowerCase(),
      name,
      stateCode: stateCode.toUpperCase(),
      districtCode: districtCode.toUpperCase(),
      blockCode: blockCode.toUpperCase(),
      strength: body.strength || 'low',
      teachersCount: 0,
      isAccessLocked: false,
      villageCity: body.villageCity.trim(),
      addressLine1: body.addressLine1.trim(),
      addressLine2: typeof body.addressLine2 === 'string' ? body.addressLine2.trim() : '',
      landmark: typeof body.landmark === 'string' ? body.landmark.trim() : '',
      pinCode: body.pinCode.trim(),
      udiseCode: udiseCode || undefined,
      governmentSchoolCode: governmentSchoolCode || undefined,
      schoolType: body.schoolType.trim(),
      managementType: body.managementType.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      establishmentYear,
      initialClasses,
      status: body.status === 'pending' || body.status === 'inactive' ? body.status : 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const principalUser = {
      id: generatePrincipalId(),
      name: principal.name.trim(),
      email: principal.email.trim().toLowerCase(),
      role: UserRole.SCHOOL,
      passwordHash: await bcrypt.hash(principal.password, 10),
      stateCode: newSch.stateCode,
      districtCode: newSch.districtCode,
      blockCode: newSch.blockCode,
      schoolId: newSch.id,
      phoneNumber: typeof principal.phone === 'string' ? principal.phone.trim() : undefined
    };
    newSch.principalId = principalUser.id;
    await dbStore.addSchool(newSch);
    await dbStore.addUser(principalUser);
    await dbStore.ensureClassesExist(newSch.id, initialClasses, 'A', principalUser.id);

    // Add Log entry
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: newSch.id,
      schoolName: newSch.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Superadmin onboarded a new school: ${newSch.name} (ID: ${newSch.id})`
    });

    res.json(newSch);
  });
}
