import express from 'express';
import { dbStore, UserRole, School } from '../db';
import { getAuthUser } from '../auth';

export function registerSchoolRoutes(app: express.Express) {
  app.get('/api/schools', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const schools = await dbStore.getSchools();
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      return res.json(schools);
    }
    if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      return res.json(schools.filter(s => s.id === user.schoolId));
    }
    if (user.role === UserRole.VOLUNTEER) {
      return res.json(schools.filter(s => user.assignedSchools?.includes(s.id)));
    }
    if (user.role === UserRole.DISTRICT_ADMIN) {
      return res.json(schools.filter(s => s.districtCode === user.districtCode));
    }
    if (user.role === UserRole.BLOCK_ADMIN) {
      return res.json(schools.filter(s => s.blockCode === user.blockCode));
    }
    res.json(schools);
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
