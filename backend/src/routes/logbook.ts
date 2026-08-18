import express from 'express';
import { dbStore, UserRole } from '../db';
import { getAuthUser } from '../auth';

export function registerLogbookRoutes(app: express.Express) {
  // Logbook
  app.get('/api/logbook', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const logs = await dbStore.getLogbook();

    // Server-side role scoping - mirrors the pattern used elsewhere in this
    // file (e.g. /api/admin/coordinators). LogEntry only carries schoolId,
    // so district/block/state scoping goes through a schools lookup first.
    if (user.role === UserRole.SUPERADMIN) {
      return res.json(logs);
    }
    if (user.role === UserRole.TEACHER || user.role === UserRole.SCHOOL) {
      return res.json(logs.filter(l => l.schoolId === user.schoolId));
    }
    if (user.role === UserRole.VOLUNTEER) {
      return res.json(logs.filter(l => user.assignedSchools?.includes(l.schoolId)));
    }

    const schools = await dbStore.getSchools();
    let allowedSchoolIds: Set<string>;
    if (user.role === UserRole.ADMIN) {
      allowedSchoolIds = new Set(schools.filter(s => s.stateCode === user.stateCode).map(s => s.id));
    } else if (user.role === UserRole.DISTRICT_ADMIN) {
      allowedSchoolIds = new Set(schools.filter(s => s.districtCode === user.districtCode).map(s => s.id));
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      allowedSchoolIds = new Set(schools.filter(s => s.blockCode === user.blockCode).map(s => s.id));
    } else {
      return res.status(403).json({ error: 'Forbidden: role not permitted to view the logbook.' });
    }
    res.json(logs.filter(l => allowedSchoolIds.has(l.schoolId)));
  });
}
