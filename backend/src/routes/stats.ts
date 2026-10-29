import express from 'express';
import { dbStore, mongoClient } from '../db';

export function registerStatsRoutes(app: express.Express) {
  // DB connection status (used by the header status indicator).
  // Returns the active db mode + counts so the UI can show MongoDB Atlas vs local.
  app.get('/api/db-status', (_req, res) => {
    return res.json({
      // mongoClient is nulled whenever connect or init fails; useMongo is never reset.
      connected: !!mongoClient,
      usingMongo: dbStore.useMongo,
      mode: dbStore.useMongo ? 'MongoDB Atlas' : 'Local File DB (Fallback)',
    });
  });

  // Public stats (no auth required — used by landing page)
  app.get('/api/stats', async (_req, res) => {
    const db = dbStore.getDb();
    if (!db) {
      const [schools, students, users, worksheets] = await Promise.all([
        dbStore.getSchools(),
        dbStore.getStudents(),
        dbStore.getUsers(),
        dbStore.getWorksheets()
      ]);
      const certifiedCount = students.filter(student => student.currentLevel >= 5).length;
      const avgFlnLevel = students.length
        ? Math.round(students.reduce((sum, student) => sum + student.currentLevel, 0) / students.length)
        : 0;
      return res.json({
        totalStates: new Set(schools.map(school => school.stateCode)).size,
        totalDistricts: new Set(schools.map(school => school.districtCode)).size,
        totalSchools: schools.length,
        totalStudents: students.length,
        totalAssessments: worksheets.length,
        avgFlnLevel,
        totalUsers: users.length,
        certifiedCount,
        certifiedPercent: students.length ? Math.round((certifiedCount / students.length) * 100) : 0
      });
    }

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
