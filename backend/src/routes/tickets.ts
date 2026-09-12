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

  const handleCreateTicket = async (req: express.Request, res: express.Response) => {
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
  };

  app.post('/api/tickets', handleCreateTicket);
  app.post('/api/tickets/create', handleCreateTicket);

  const handleResolveTicket = async (req: express.Request, res: express.Response) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    const { status, resolutionNote, reclassifiedBand, actionTaken } = req.body; // Reviewed or Resolved
    const validStatus = ['Reviewed', 'Resolved'].includes(status) ? status : 'Resolved';
    const updates: Partial<Ticket> = {
      status: validStatus,
      actionTakenAt: new Date().toISOString(),
      actionTakenBy: user.email
    };
    if (resolutionNote !== undefined) updates.resolutionNote = resolutionNote;
    if (reclassifiedBand !== undefined) updates.reclassifiedBand = reclassifiedBand;

    let derivedAction = actionTaken;
    if (!derivedAction) {
      if (reclassifiedBand === 'confirmed') {
        derivedAction = 'Confirmed in Current Cohort';
      } else if (reclassifiedBand) {
        derivedAction = `Reclassified to ${reclassifiedBand.toUpperCase()}`;
      } else if (resolutionNote) {
        derivedAction = resolutionNote;
      } else if (status === 'Reviewed') {
        derivedAction = 'Marked as Reviewed';
      } else {
        derivedAction = 'Verified & Resolved';
      }
    }
    updates.actionTaken = derivedAction;

    const tickets = await dbStore.getTickets();
    const existingTicket = tickets.find(t => t.id === req.params.id);
    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // If reclassifying difficulty (e.g. easy -> medium or hard), persist the change in dbStore
    if (reclassifiedBand && ['easy', 'medium', 'hard'].includes(reclassifiedBand)) {
      const qId = existingTicket.flagDetails?.questionId;
      if (qId) {
        await dbStore.updateQuestionDifficulty(qId, reclassifiedBand as 'easy' | 'medium' | 'hard');
      }
      if (existingTicket.flagDetails) {
        updates.flagDetails = {
          ...existingTicket.flagDetails,
          difficulty: reclassifiedBand as 'easy' | 'medium' | 'hard'
        };
      }
    }

    const updated = await dbStore.updateTicket(req.params.id, updates);

    // Audit log entry for governance logbook
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: '',
      schoolName: 'Superadmin Review Queue',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'ticket',
      status: 'Success',
      details: `Superadmin executed action on Ticket #${req.params.id}: "${derivedAction}"`
    });

    res.json(updated);
  };

  app.post('/api/tickets/:id/resolve', handleResolveTicket);
  app.put('/api/tickets/:id', handleResolveTicket);
}

