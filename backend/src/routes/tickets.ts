import express from 'express';
import { dbStore, UserRole, Ticket } from '../db';
import { getAuthUser } from '../auth';

export function registerTicketRoutes(app: express.Express) {
  // Tickets (In-App Feedback)
  app.get('/api/tickets', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tkts = await dbStore.getTickets();
    if (user.role === UserRole.SUPERADMIN) {
      return res.json(tkts);
    }
    // Filter scoped by role
    const filtered = tkts.filter(t => t.userId === user.id || t.userEmail === user.email);
    res.json(filtered);
  });

  app.post('/api/tickets/create', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { type, subject, description } = req.body;
    if (type === 'curriculum' && user.role !== UserRole.TEACHER && user.role !== UserRole.VOLUNTEER) {
      return res.status(400).json({ error: 'Curriculum feedback can only be submitted by Teachers or Volunteers.' });
    }

    const newTicket: Ticket = {
      id: 'tkt_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      type: type || 'general',
      subject,
      description,
      status: 'Open',
      createdAt: new Date().toISOString()
    };

    await dbStore.addTicket(newTicket);

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: user.schoolId || '',
      schoolName: user.schoolId ? 'Assigned School' : 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'ticket',
      status: 'Success',
      details: `Created feedback ticket: ${subject}`
    });

    res.json(newTicket);
  });

  app.post('/api/tickets/:id/resolve', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    const { status } = req.body; // Reviewed or Resolved
    const updated = await dbStore.updateTicket(req.params.id, { status });
    res.json(updated);
  });
}
