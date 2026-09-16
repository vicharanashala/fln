import express from 'express';
import { dbStore } from '../db';

export function registerStatsRoutes(app: express.Express) {
  // DB connection status (used by the header status indicator).
  // Returns the active db mode + counts so the UI can show MongoDB Atlas vs local.
  app.get('/api/db-status', (_req, res) => {
    return res.json({
      connected: true,
      usingMongo: dbStore.useMongo,
      mode: dbStore.useMongo ? 'MongoDB Atlas' : 'Local File DB (Fallback)',
    });
  });

  // Public stats (no auth required — used by landing page)
  app.get('/api/stats', async (_req, res) => {
    const db = dbStore.getDb();
    if (!db) return res.json({ totalStates: 0, totalDistricts: 0, totalSchools: 0, totalStudents: 0, totalAssessments: 0, avgFlnLevel: 0, totalUsers: 0, certifiedCount: 0, certifiedPercent: 0 });

    const [totalSchools, totalStudents, totalUsers, totalAssessments, stateCodes, districtCodes, avgResult, certifiedResult] = await Promise.all([
      db.collection('schools').countDocuments(),
      db.collection('students').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('worksheets').countDocuments(),
      db.collection('schools').distinct('stateCode'),
      db.collection('schools').distinct('districtCode'),
      db.collection('students').aggregate([{ $group: { _id: null, avg: { $avg: '$currentLevel' } } }]).toArray(),
      db.collection('students').aggregate([{ $match: { currentLevel: { $gte: 5 } } }, { $count: 'count' }]).toArray(),
    ]);

    const certifiedCount = certifiedResult[0]?.count ?? 0;
    const avgFlnLevel = totalStudents > 0 ? Math.round(avgResult[0]?.avg ?? 0) : 0;

    res.json({
      totalStates: stateCodes.length,
      totalDistricts: districtCodes.length,
      totalSchools,
      totalStudents,
      totalAssessments,
      avgFlnLevel,
      totalUsers,
      certifiedCount,
      certifiedPercent: totalStudents > 0 ? Math.round((certifiedCount / totalStudents) * 100) : 0,
    });
  });
}
