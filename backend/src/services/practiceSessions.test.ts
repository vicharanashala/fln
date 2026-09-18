import assert from 'node:assert/strict';
import test from 'node:test';
import { Student, Question } from '../db';
import { createPracticeSession, getPracticeSession, submitPracticeAnswer } from './practiceSessions';

const student: Student = {
  id: 'student-1',
  name: 'Asha',
  age: 8,
  classGroup: 'Class 3',
  section: 'A',
  schoolId: 'school-1',
  currentLevel: 24,
  currentSubLevel: 0,
  targetLevel: 30,
  aadharMasked: 'XXXX-XXXX-1234',
  levelHistory: [],
};

const question: Question = {
  question_id: 'source-question',
  question: 'What is 7 plus 5?',
  answer: '12',
  answer_type: 'number',
  topic: 'Number Operations',
  subtopic: 'Addition',
  difficulty: 'easy',
  source_level: 24,
};

function makeSession(now = 1_000, ttlMs = 1_000) {
  const session = createPracticeSession({
    student,
    ownerId: 'teacher-1',
    now,
    ttlMs,
    questionFactory: () => [question],
  });
  assert.ok(session);
  return session;
}

test('practice creation never exposes answers and server grades normalized answers', () => {
  const session = makeSession();
  assert.equal('answer' in session.questions[0], false);

  const result = submitPracticeAnswer({
    sessionId: session.id,
    studentId: student.id,
    ownerId: 'teacher-1',
    questionId: session.questions[0].question_id,
    answer: '012',
    now: 1_100,
  });
  assert.deepEqual(result, {
    status: 'ok',
    correct: true,
    completed: true,
    answeredQuestions: 1,
    totalQuestions: 1,
  });

  const repeated = submitPracticeAnswer({
    sessionId: session.id,
    studentId: student.id,
    ownerId: 'teacher-1',
    questionId: session.questions[0].question_id,
    answer: '12',
    now: 1_200,
  });
  assert.deepEqual(repeated, { status: 'already_answered' });
});

test('practice sessions are scoped to their facilitator and expire', () => {
  const session = makeSession(3_000, 100);
  assert.equal(getPracticeSession(session.id, student.id, 'teacher-2', 3_050), null);

  const result = submitPracticeAnswer({
    sessionId: session.id,
    studentId: student.id,
    ownerId: 'teacher-1',
    questionId: session.questions[0].question_id,
    answer: '12',
    now: 3_100,
  });
  assert.deepEqual(result, { status: 'expired' });
});
