import express from 'express';
import { dbStore, UserRole } from '../db';
import { getAuthUser } from '../auth';

export function registerClassRoutes(app: express.Express) {
  app.get('/api/classes', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const classes = await dbStore.getClasses();
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN) {
      return res.json(classes);
    }
    let filtered = classes.filter(c => c.schoolId === user.schoolId || (user.assignedSchools && user.assignedSchools.includes(c.schoolId || '')));
    if (filtered.length === 0) {
      filtered = classes;
    }
    res.json(filtered);
  });
}
