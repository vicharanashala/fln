import express from 'express';
import { dbStore, UserRole, Announcement } from '../db';
import { getAuthUser } from '../auth';

export function registerAnnouncementRoutes(app: express.Express) {
  app.get('/api/announcements', async (req, res) => {
    const anns = await dbStore.getAnnouncements();
    res.json(anns);
  });

  app.post('/api/announcements/create', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    const { title, message, isUrgent } = req.body;
    const newAnn: Announcement = {
      id: 'ann_' + Date.now(),
      title,
      message,
      isUrgent: !!isUrgent,
      authorEmail: user.email,
      createdAt: new Date().toISOString()
    };
    await dbStore.addAnnouncement(newAnn);

    // Logging
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: '',
      schoolName: 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'ticket',
      status: 'Success',
      details: `Created announcement: ${title}`
    });

    res.json(newAnn);
  });
}
