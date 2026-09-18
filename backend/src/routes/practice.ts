import express from 'express';
import { dbStore, UserRole } from '../db';
import { canAccessStudent, getAuthUser } from '../auth';
import { createPracticeSession, getPracticeSession, submitPracticeAnswer } from '../services/practiceSessions';

function canFacilitatePractice(role: UserRole): boolean {
  return role === UserRole.TEACHER || role === UserRole.VOLUNTEER;
}

export function registerPracticeRoutes(app: express.Express) {
  app.post('/api/students/:id/practice-sessions', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canFacilitatePractice(user.role)) return res.status(403).json({ error: 'Practice sessions are available to teachers and volunteers only.' });

    const students = await dbStore.getStudents();
    const student = students.find(candidate => candidate.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const rawTopic = req.body?.topic;
    if (rawTopic !== undefined && (typeof rawTopic !== 'string' || rawTopic.length > 120)) {
      return res.status(400).json({ error: 'topic must be a string of at most 120 characters.' });
    }

    const session = createPracticeSession({
      student,
      ownerId: user.id,
      topic: rawTopic,
    });
    if (!session) {
      return res.status(409).json({ error: 'A completed diagnostic level is required before practice can begin.' });
    }

    return res.status(201).json(session);
  });

  app.get('/api/students/:id/practice-sessions/:sessionId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canFacilitatePractice(user.role)) return res.status(403).json({ error: 'Practice sessions are available to teachers and volunteers only.' });

    const students = await dbStore.getStudents();
    const student = students.find(candidate => candidate.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const session = getPracticeSession(req.params.sessionId, student.id, user.id);
    if (!session) return res.status(404).json({ error: 'Practice session not found or expired.' });
    return res.json(session);
  });

  app.post('/api/students/:id/practice-sessions/:sessionId/answers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canFacilitatePractice(user.role)) return res.status(403).json({ error: 'Practice sessions are available to teachers and volunteers only.' });

    const students = await dbStore.getStudents();
    const student = students.find(candidate => candidate.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const { questionId, answer } = req.body ?? {};
    if (typeof questionId !== 'string' || questionId.length === 0 || questionId.length > 200 || typeof answer !== 'string' || answer.length > 500) {
      return res.status(400).json({ error: 'questionId and answer are required and must be within the allowed length.' });
    }

    const result = submitPracticeAnswer({
      sessionId: req.params.sessionId,
      studentId: student.id,
      ownerId: user.id,
      questionId,
      answer,
    });
    if (result.status === 'not_found') return res.status(404).json({ error: 'Practice session not found.' });
    if (result.status === 'expired') return res.status(410).json({ error: 'Practice session has expired. Start a new session.' });
    if (result.status === 'question_not_found') return res.status(404).json({ error: 'Practice question not found.' });
    if (result.status === 'already_answered') return res.status(409).json({ error: 'This practice question has already been answered.' });

    return res.json(result);
  });
}
