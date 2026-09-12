import express from 'express';
import { dbStore } from '../db';
import { getAuthUser } from '../auth';
import { autoFlagService } from '../services/autoFlagService';

export function registerGovernanceRoutes(app: express.Express) {
  // Automated Pedagogical Level-Flagging Engine (SRS Rule R-15 & §6.7)
  app.post('/api/governance/auto-flag/scan', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Superadmin or Admin role required' });
    }

    try {
      const rawMinAttempts = parseInt(req.body?.minAttempts, 10);
      const minAttempts = !isNaN(rawMinAttempts) && rawMinAttempts >= 1 ? Math.min(rawMinAttempts, 100) : 3;

      const rawFailureThreshold = parseFloat(req.body?.failureThreshold);
      const failureThreshold = !isNaN(rawFailureThreshold) && rawFailureThreshold > 0 && rawFailureThreshold < 1
        ? Math.max(0.1, Math.min(0.9, rawFailureThreshold))
        : 0.50;

      const rawMedThreshold = parseFloat(req.body?.mediumFailureThreshold);
      const mediumFailureThreshold = !isNaN(rawMedThreshold) && rawMedThreshold > 0 && rawMedThreshold < 1
        ? Math.max(0.2, Math.min(0.95, rawMedThreshold))
        : 0.70;

      const worksheetId = req.body?.worksheetId;

      const scanResult = await autoFlagService.checkAndFlagQuestions({
        minAttempts,
        failureThreshold,
        mediumFailureThreshold,
        worksheetId
      });

      const summary = await autoFlagService.getAutoFlagSummary();

      res.json({
        success: true,
        createdCount: scanResult.created.length,
        updatedCount: scanResult.updated.length,
        totalFlagged: scanResult.allFlags.length,
        summary
      });
    } catch (err: any) {
      console.error('Error executing Auto-Flag scan:', err);
      res.status(500).json({ error: 'Failed to run pedagogical auto-flag scan: ' + (err?.message || err) });
    }
  });

  app.get('/api/governance/auto-flag/summary', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Superadmin or Admin role required' });
    }

    try {
      const summary = await autoFlagService.getAutoFlagSummary();
      res.json(summary);
    } catch (err: any) {
      console.error('Error fetching Auto-Flag summary:', err);
      res.status(500).json({ error: 'Failed to fetch auto-flag summary' });
    }
  });

  app.post('/api/governance/auto-flag/reset', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Superadmin or Admin role required' });
    }

    try {
      await dbStore.resetAutoFlagState();
      await dbStore.addLog({
        id: 'log_reset_' + Date.now(),
        timestamp: new Date().toISOString(),
        schoolId: 'NATIONAL',
        schoolName: 'Superadmin Console',
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        activityType: 'ticket',
        status: 'Success',
        details: 'Reset all pedagogical auto-flags, telemetry submissions, and diagnostic test states for fresh validation.'
      });

      const summary = await autoFlagService.getAutoFlagSummary();
      res.json({ success: true, message: 'Auto-flag state and demo diagnostics successfully reset.', summary });
    } catch (err: any) {
      console.error('Error resetting auto-flag state:', err);
      res.status(500).json({ error: 'Failed to reset auto-flag state: ' + (err?.message || err) });
    }
  });
}
