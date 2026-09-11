import express from 'express';
import { dbStore, UserRole, School } from '../db';
import { getAuthUser } from '../auth';

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

    const { id, name, stateCode, districtCode, blockCode, strength,
            address, pincode, udiseCode, schoolType, establishedYear,
            contactEmail, contactPhone } = req.body;
    if (!id || !name || !stateCode || !districtCode || !blockCode) {
      return res.status(400).json({ error: 'Missing required school fields.' });
    }

    const schools = await dbStore.getSchools();
    if (schools.some(s => s.id.toLowerCase() === id.toLowerCase())) {
      return res.status(400).json({ error: 'School ID already exists.' });
    }

    // Validate the optional identity fields (issue #1). They are not strictly
    // required so existing onboarding flows that only send the legacy fields
    // keep working, but when they are supplied they must be well-formed.
    const ALLOWED_SCHOOL_TYPES = ['primary', 'upper_primary', 'secondary', 'higher_secondary', 'other'] as const;
    if (schoolType !== undefined && !(ALLOWED_SCHOOL_TYPES as readonly string[]).includes(schoolType)) {
      return res.status(400).json({ error: `Invalid schoolType. Allowed: ${ALLOWED_SCHOOL_TYPES.join(', ')}` });
    }
    if (pincode !== undefined && pincode !== null && !/^\d{6}$/.test(String(pincode))) {
      return res.status(400).json({ error: 'pincode must be 6 digits.' });
    }
    if (udiseCode !== undefined && udiseCode !== null && !/^\d{11}$/.test(String(udiseCode))) {
      return res.status(400).json({ error: 'udiseCode must be 11 digits.' });
    }
    if (establishedYear !== undefined && establishedYear !== null) {
      const yr = Number(establishedYear);
      const thisYear = new Date().getFullYear();
      if (!Number.isFinite(yr) || yr < 1800 || yr > thisYear) {
        return res.status(400).json({ error: `establishedYear must be between 1800 and ${thisYear}.` });
      }
    }
    if (contactEmail !== undefined && contactEmail !== null && contactEmail !== '' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactEmail))) {
      return res.status(400).json({ error: 'contactEmail is not a valid email.' });
    }
    if (contactPhone !== undefined && contactPhone !== null && contactPhone !== '' &&
        !/^\+?\d{7,15}$/.test(String(contactPhone).replace(/[\s-]/g, ''))) {
      return res.status(400).json({ error: 'contactPhone must be 7-15 digits, optional leading +.' });
    }

    const newSch: School = {
      id: id.toLowerCase(),
      name,
      stateCode: stateCode.toUpperCase(),
      districtCode: districtCode.toUpperCase(),
      blockCode: blockCode.toUpperCase(),
      strength: strength || 'low',
      teachersCount: 0,
      isAccessLocked: false,
      address: address || undefined,
      pincode: pincode ? String(pincode) : undefined,
      udiseCode: udiseCode ? String(udiseCode) : undefined,
      schoolType: schoolType || undefined,
      establishedYear: establishedYear !== undefined && establishedYear !== null && establishedYear !== ''
        ? Number(establishedYear) : undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
    };

    await dbStore.addSchool(newSch);

    // Add Log entry
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: newSch.id,
      schoolName: newSch.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'onboard',
      status: 'Success',
      details: `Superadmin onboarded a new school: ${newSch.name} (ID: ${newSch.id})`
    });

    res.json(newSch);
  });
}
