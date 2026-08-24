import express from 'express';
import { dbStore, UserRole, School } from '../db';
import { getAuthUser } from '../auth';

export function registerSchoolRoutes(app: express.Express) {
  app.get('/api/schools', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const schools = await dbStore.getSchools();

    let scoped: typeof schools;
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      scoped = schools;
    } else if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      scoped = schools.filter(s => s.id === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      scoped = schools.filter(s => user.assignedSchools?.includes(s.id));
    } else if (user.role === UserRole.DISTRICT_ADMIN) {
      scoped = schools.filter(s => s.districtCode === user.districtCode);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      scoped = schools.filter(s => s.blockCode === user.blockCode);
    } else {
      scoped = schools;
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

    const { id, name, stateCode, districtCode, blockCode, strength } = req.body;
    if (!id || !name || !stateCode || !districtCode || !blockCode) {
      return res.status(400).json({ error: 'Missing required school fields.' });
    }

    const schools = await dbStore.getSchools();
    if (schools.some(s => s.id.toLowerCase() === id.toLowerCase())) {
      return res.status(400).json({ error: 'School ID already exists.' });
    }

    const newSch: School = {
      id: id.toLowerCase(),
      name,
      stateCode: stateCode.toUpperCase(),
      districtCode: districtCode.toUpperCase(),
      blockCode: blockCode.toUpperCase(),
      strength: strength || 'low',
      teachersCount: 0,
      isAccessLocked: false
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
      activityType: 'verify',
      status: 'Success',
      details: `Superadmin onboarded a new school: ${newSch.name} (ID: ${newSch.id})`
    });

    res.json(newSch);
  });
}
