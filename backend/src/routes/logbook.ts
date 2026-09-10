import express from 'express';
import { dbStore, UserRole, LogEntry } from '../db';
import { getAuthUser } from '../auth';

export function registerLogbookRoutes(app: express.Express) {
  // GET /api/logbook - Role-scoped logbook view
  app.get('/api/logbook', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const logs = (await dbStore.getLogbook()) || [];

    // Server-side role scoping - case-insensitive
    const userRole = (user.role || '').toLowerCase();
    if (userRole === 'superadmin' || userRole === 'super admin') {
      return res.json(logs);
    }
    if (userRole === 'teacher' || userRole === 'school' || userRole === 'principal') {
      return res.json(logs.filter(l => l.schoolId === user.schoolId));
    }
    if (userRole === 'volunteer') {
      return res.json(logs.filter(l => user.assignedSchools?.includes(l.schoolId)));
    }

    const schools = await dbStore.getSchools();
    let allowedSchoolIds: Set<string>;
    if (userRole === 'admin' || userRole === 'state admin' || userRole === 'state_admin') {
      allowedSchoolIds = new Set(schools.filter(s => s.stateCode?.toLowerCase() === user.stateCode?.toLowerCase()).map(s => s.id));
    } else if (userRole === 'district_admin' || userRole === 'district admin') {
      allowedSchoolIds = new Set(schools.filter(s => s.districtCode?.toLowerCase() === user.districtCode?.toLowerCase()).map(s => s.id));
    } else if (userRole === 'block_admin' || userRole === 'block admin') {
      allowedSchoolIds = new Set(schools.filter(s => s.blockCode?.toLowerCase() === user.blockCode?.toLowerCase()).map(s => s.id));
    } else {
      return res.json(logs);
    }
    return res.json(logs.filter(l => allowedSchoolIds.has(l.schoolId)));
  });

  // POST /api/logbook - Record a new operational event
  app.post('/api/logbook', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const { schoolId, schoolName, activityType, status, details } = req.body;

      if (!details || !activityType) {
        return res.status(400).json({ error: 'Activity type and details are required.' });
      }

      const newLog: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        timestamp: new Date().toISOString(),
        schoolId: user?.schoolId || schoolId || 'general',
        schoolName: schoolName || 'General Facility',
        userId: user?.id || 'anonymous',
        userEmail: user?.email || req.body.userEmail || 'system@fln.org',
        userRole: user?.role || (req.body.userRole as UserRole) || UserRole.TEACHER,
        activityType,
        status: status || 'Success',
        details,
      };

      await dbStore.addLog(newLog);
      return res.status(201).json(newLog);
    } catch (err: any) {
      console.error('Error recording log entry:', err);
      return res.status(500).json({ error: 'Failed to create log entry.' });
    }
  });
}
