import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, CYCLE_NAMES, TeacherObservationRecord, UserRole } from '../db';
import { canAccessStudent, getAuthUser } from '../auth';

const OBSERVATION_RATINGS = ['Proficient', 'Progressive', 'Beginner'] as const;

function isValidCycle(cycle: unknown): cycle is typeof CYCLE_NAMES[number] {
  return typeof cycle === 'string' && (CYCLE_NAMES as readonly string[]).includes(cycle);
}

export function registerObservationRoutes(app: express.Express) {
  app.get('/api/observations/student/:studentId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === UserRole.TEACHER && user.isBanned) {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const { cycle } = req.query;
    if (!isValidCycle(cycle)) {
      return res.status(400).json({ error: `cycle must be one of: ${CYCLE_NAMES.join(', ')}` });
    }

    try {
      const student = (await dbStore.getStudents()).find(s => s.id === req.params.studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

      return res.json(await dbStore.getObservationRecordsForStudent(student.id, cycle));
    } catch (error: any) {
      console.error('[Observations] student records lookup failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not load observation records.' });
    }
  });

  app.get('/api/observations/class/:classId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === UserRole.TEACHER && user.isBanned) {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const { cycle } = req.query;
    if (!isValidCycle(cycle)) {
      return res.status(400).json({ error: `cycle must be one of: ${CYCLE_NAMES.join(', ')}` });
    }

    try {
      const classGroup = (await dbStore.getClasses()).find(c => c.id === req.params.classId);
      if (!classGroup) return res.status(404).json({ error: 'Class not found.' });

      const hasBroadAccess = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(user.role);
      const hasSchoolAccess = classGroup.schoolId === user.schoolId || (user.assignedSchools?.includes(classGroup.schoolId) ?? false);
      const isClassTeacher = classGroup.teacherId === user.id;
      if (!hasBroadAccess && !hasSchoolAccess && !isClassTeacher) {
        return res.status(403).json({ error: 'Forbidden.' });
      }

      return res.json(await dbStore.getObservationRecordsForClass(classGroup.id, cycle));
    } catch (error: any) {
      console.error('[Observations] class records lookup failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not load observation records.' });
    }
  });

  app.post('/api/observations', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === UserRole.TEACHER && user.isBanned) {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const { studentId, conceptId, classId, cycle, rating, notYetAssessed } = req.body ?? {};
    if (
      typeof studentId !== 'string' || !studentId.trim() ||
      typeof conceptId !== 'string' || !conceptId.trim() ||
      typeof classId !== 'string' || !classId.trim() ||
      !isValidCycle(cycle) ||
      !(OBSERVATION_RATINGS as readonly unknown[]).includes(rating) ||
      typeof notYetAssessed !== 'boolean'
    ) {
      return res.status(400).json({
        error: 'Required fields: studentId, conceptId, classId, valid cycle, valid rating, and boolean notYetAssessed.'
      });
    }

    try {
      const student = (await dbStore.getStudents()).find(s => s.id === studentId.trim());
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

      const classGroup = (await dbStore.getClasses()).find(c => c.id === classId.trim());
      if (!classGroup) return res.status(404).json({ error: 'Class not found.' });
      if (
        classGroup.schoolId !== student.schoolId ||
        classGroup.className !== student.classGroup ||
        classGroup.section !== student.section
      ) {
        return res.status(400).json({ error: 'The class does not match the student.' });
      }

      const existing = await dbStore.getObservationRecordsForStudent(student.id, cycle);
      const priorRecord = existing.find(record => record.conceptId === conceptId.trim());
      const now = new Date().toISOString();
      const record: TeacherObservationRecord = {
        id: priorRecord?.id ?? `obs_${randomUUID()}`,
        studentId: student.id,
        conceptId: conceptId.trim(),
        teacherId: user.id,
        teacherEmail: user.email,
        schoolId: student.schoolId,
        classId: classGroup.id,
        cycle,
        rating,
        notYetAssessed,
        observedAt: now,
        createdAt: priorRecord?.createdAt ?? now,
        updatedAt: now
      };

      return res.json(await dbStore.upsertObservationRecord(record));
    } catch (error: any) {
      console.error('[Observations] record save failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not save observation record.' });
    }
  });
}
