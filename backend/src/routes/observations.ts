import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, CYCLE_NAMES, TeacherObservationRecord, UserRole } from '../db';
import { canAccessStudent, getAuthUser } from '../auth';
import { getLevelForConcept } from '../config/curriculumMap';
import { OBSERVATION_LAYOUTS, renderObservationSheet } from '../observationSheet';
import type { ObservationLayout } from '../observationSheet';

const OBSERVATION_RATINGS = ['Proficient', 'Progressive', 'Beginner'] as const;
const OBSERVATION_STRATEGIES = ['fingers', 'counters', 'mental', 'written'] as const;

/** Most children and concepts one printed sheet may carry. */
const MAX_SHEET_STUDENTS = 120;
const MAX_SHEET_CONCEPTS = 20;

/** Who may read or print a class's observations: wide roles, anyone at the school, or the class teacher. */
function canAccessClassRecords(user: NonNullable<ReturnType<typeof getAuthUser>>, classGroup: { schoolId: string; teacherId: string }): boolean {
  const hasBroadAccess = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(user.role);
  const hasSchoolAccess = classGroup.schoolId === user.schoolId || (user.assignedSchools?.includes(classGroup.schoolId) ?? false);
  const isClassTeacher = classGroup.teacherId === user.id;
  return hasBroadAccess || hasSchoolAccess || isClassTeacher;
}

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
      if (!(await canAccessStudent(user, student))) return res.status(403).json({ error: 'Forbidden.' });

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

      if (!canAccessClassRecords(user, classGroup)) {
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

    const { studentId, conceptId, classId, cycle, rating, notYetAssessed, selfCorrected, strategyUsed } = req.body ?? {};
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

    // Optional fields: absent is fine, present must be valid.
    if (selfCorrected !== undefined && typeof selfCorrected !== 'boolean') {
      return res.status(400).json({ error: 'selfCorrected must be true or false.' });
    }
    if (strategyUsed !== undefined && !(OBSERVATION_STRATEGIES as readonly unknown[]).includes(strategyUsed)) {
      return res.status(400).json({ error: `strategyUsed must be one of ${OBSERVATION_STRATEGIES.join(', ')}.` });
    }

    const concept = conceptId.trim();
    if (concept.length > 20 || !getLevelForConcept(concept)) {
      return res.status(400).json({ error: 'Unknown conceptId.' });
    }

    try {
      const student = (await dbStore.getStudents()).find(s => s.id === studentId.trim());
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!(await canAccessStudent(user, student))) return res.status(403).json({ error: 'Forbidden.' });

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
      const priorRecord = existing.find(record => record.conceptId === concept);
      const carriedSelfCorrected: boolean | undefined = selfCorrected ?? priorRecord?.selfCorrected;
      const carriedStrategy: TeacherObservationRecord['strategyUsed'] = strategyUsed ?? priorRecord?.strategyUsed;
      const now = new Date().toISOString();
      const record: TeacherObservationRecord = {
        id: priorRecord?.id ?? `obs_${randomUUID()}`,
        studentId: student.id,
        conceptId: concept,
        teacherId: user.id,
        teacherEmail: user.email,
        schoolId: student.schoolId,
        classId: classGroup.id,
        cycle,
        rating,
        notYetAssessed,
        // Only set when there is a value, so a record never carries an empty key; an update
        // that does not send a field keeps what the earlier save recorded.
        ...(carriedSelfCorrected !== undefined && { selfCorrected: carriedSelfCorrected }),
        ...(carriedStrategy !== undefined && { strategyUsed: carriedStrategy }),
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
  /**
   * The printed observation sheet for a class (#618): a class grid or a half page per child,
   * covering the concepts a teacher observes. Writes nothing; it only returns a PDF link.
   */
  app.post('/api/observations/sheet', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === UserRole.TEACHER && user.isBanned) {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const { classId, cycle, layout, conceptIds } = req.body ?? {};
    if (typeof classId !== 'string' || !classId.trim()) {
      return res.status(400).json({ error: 'classId is required.' });
    }
    if (!isValidCycle(cycle)) {
      return res.status(400).json({ error: `cycle must be one of: ${CYCLE_NAMES.join(', ')}` });
    }
    if (!(OBSERVATION_LAYOUTS as readonly unknown[]).includes(layout)) {
      return res.status(400).json({ error: `layout must be one of: ${OBSERVATION_LAYOUTS.join(', ')}.` });
    }
    let requested: string[] | undefined;
    if (conceptIds !== undefined) {
      if (!Array.isArray(conceptIds) || conceptIds.length === 0 || conceptIds.length > MAX_SHEET_CONCEPTS ||
          !conceptIds.every(c => typeof c === 'string' && c.trim().length > 0 && c.trim().length <= 20)) {
        return res.status(400).json({ error: `conceptIds must be a list of 1 to ${MAX_SHEET_CONCEPTS} concept ids.` });
      }
      requested = [...new Set(conceptIds.map((c: string) => c.trim()))];
      const unknown = requested.filter(c => !getLevelForConcept(c));
      if (unknown.length > 0) {
        return res.status(400).json({ error: `Unknown conceptId: ${unknown.join(', ')}.` });
      }
    }

    try {
      const classGroup = (await dbStore.getClasses()).find(c => c.id === classId.trim());
      if (!classGroup) return res.status(404).json({ error: 'Class not found.' });
      if (!canAccessClassRecords(user, classGroup)) {
        return res.status(403).json({ error: 'Forbidden.' });
      }

      const students = (await dbStore.getStudents())
        .filter(s => s.schoolId === classGroup.schoolId && s.classGroup === classGroup.className && s.section === classGroup.section)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (students.length === 0) {
        return res.status(400).json({ error: 'No students found in this class roster.' });
      }
      if (students.length > MAX_SHEET_STUDENTS) {
        return res.status(400).json({ error: `A sheet can hold at most ${MAX_SHEET_STUDENTS} children; this class has ${students.length}.` });
      }

      // A concept is observed when one of its live templates is marked observed or both.
      const observable = new Set(
        (await dbStore.getQuestionTemplates())
          .filter(t => t.assessmentMode === 'observed' || t.assessmentMode === 'both')
          .map(t => t.conceptId)
      );
      let conceptList: string[];
      if (requested) {
        const notObserved = requested.filter(c => !observable.has(c));
        if (notObserved.length > 0) {
          return res.status(400).json({ error: `${notObserved.join(', ')} ${notObserved.length === 1 ? 'is' : 'are'} not observed by a teacher, so there is no observation sheet row for ${notObserved.length === 1 ? 'it' : 'them'}.` });
        }
        conceptList = requested;
      } else {
        conceptList = [...observable].filter(c => getLevelForConcept(c)).slice(0, MAX_SHEET_CONCEPTS);
      }
      const concepts = conceptList
        .map(c => ({ conceptId: c, levelNumber: getLevelForConcept(c)!.levelNumber, title: getLevelForConcept(c)!.levelTitle }))
        .sort((a, b) => a.levelNumber - b.levelNumber);
      if (concepts.length === 0) {
        return res.status(404).json({ error: 'No concept is marked as observed, so there is nothing to put on the sheet.' });
      }

      const result = await renderObservationSheet({
        sheetId: `OBS_${randomUUID().slice(0, 8)}`,
        layout: layout as ObservationLayout,
        className: classGroup.className,
        section: classGroup.section,
        cycle,
        students: students.map(s => ({ id: s.id, name: s.name, displayId: s.displayId })),
        concepts,
      });
      return res.json({
        success: true,
        pdfUrl: result.pdfUrl,
        layout,
        pageCount: result.pageCount,
        studentCount: students.length,
        concepts: concepts.map(c => ({ conceptId: c.conceptId, level: c.levelNumber })),
      });
    } catch (error: any) {
      console.error('[Observations] sheet failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not create the observation sheet.' });
    }
  });

}
