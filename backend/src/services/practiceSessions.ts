import { randomUUID } from 'crypto';
import { answersMatch } from '../answerMatching';
import { Question, Student } from '../db';
import { generateQuestionsForLevel } from '../levelGenerator';

const SESSION_TTL_MS = 30 * 60 * 1000;

export type PracticeQuestion = Omit<Question, 'answer'>;

type PracticeSession = {
  id: string;
  studentId: string;
  ownerId: string;
  studentName: string;
  level: number;
  subLevel: number;
  topic?: string;
  questions: Question[];
  answeredQuestionIds: Set<string>;
  createdAt: string;
  expiresAt: number;
};

export type PublicPracticeSession = {
  id: string;
  studentId: string;
  studentName: string;
  level: number;
  subLevel: number;
  topic?: string;
  questions: PracticeQuestion[];
  createdAt: string;
  expiresAt: string;
};

export type PracticeAnswerResult =
  | { status: 'ok'; correct: boolean; completed: boolean; answeredQuestions: number; totalQuestions: number }
  | { status: 'not_found' | 'expired' | 'question_not_found' | 'already_answered' };

const sessions = new Map<string, PracticeSession>();

type CreatePracticeSessionOptions = {
  student: Student;
  ownerId: string;
  topic?: string;
  now?: number;
  ttlMs?: number;
  questionFactory?: (level: number, subLevel: number) => Question[];
};

function toPublicQuestion(question: Question): PracticeQuestion {
  const { answer: _answer, ...publicQuestion } = question;
  return publicQuestion;
}

function toPublicSession(session: PracticeSession): PublicPracticeSession {
  return {
    id: session.id,
    studentId: session.studentId,
    studentName: session.studentName,
    level: session.level,
    subLevel: session.subLevel,
    ...(session.topic ? { topic: session.topic } : {}),
    questions: session.questions.map(toPublicQuestion),
    createdAt: session.createdAt,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

function discardExpiredSessions(now: number): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

/**
 * Creates a short-lived, teacher-facilitated practice session. Answers stay
 * only in this process and are never part of the question payload sent to the
 * browser. Practice results deliberately do not affect official assessments,
 * student streaks, or level history.
 */
export function createPracticeSession(options: CreatePracticeSessionOptions): PublicPracticeSession | null {
  const now = options.now ?? Date.now();
  discardExpiredSessions(now);

  if (!Number.isInteger(options.student.currentLevel)) return null;

  const level = options.student.currentLevel;
  const subLevel = options.student.currentSubLevel ?? 0;
  const questionFactory = options.questionFactory ?? generateQuestionsForLevel;
  const generatedQuestions = questionFactory(level, subLevel);
  const normalizedTopic = options.topic?.trim().toLocaleLowerCase();
  const matchingQuestions = normalizedTopic
    ? generatedQuestions.filter(question => question.topic.trim().toLocaleLowerCase() === normalizedTopic)
    : generatedQuestions;
  const questions = matchingQuestions.length > 0 ? matchingQuestions : generatedQuestions;

  if (questions.length === 0) return null;

  const id = `practice_${randomUUID()}`;
  const session: PracticeSession = {
    id,
    studentId: options.student.id,
    ownerId: options.ownerId,
    studentName: options.student.name,
    level,
    subLevel,
    ...(matchingQuestions.length > 0 && options.topic?.trim() ? { topic: options.topic.trim() } : {}),
    questions: questions.map((question, index) => ({
      ...question,
      question_id: `PRACTICE_${id}_${index + 1}`,
    })),
    answeredQuestionIds: new Set(),
    createdAt: new Date(now).toISOString(),
    expiresAt: now + (options.ttlMs ?? SESSION_TTL_MS),
  };

  sessions.set(session.id, session);
  return toPublicSession(session);
}

export function getPracticeSession(sessionId: string, studentId: string, ownerId: string, now = Date.now()): PublicPracticeSession | null {
  const session = sessions.get(sessionId);
  if (!session || session.studentId !== studentId || session.ownerId !== ownerId) return null;
  if (session.expiresAt <= now) {
    sessions.delete(sessionId);
    return null;
  }
  return toPublicSession(session);
}

export function submitPracticeAnswer(options: {
  sessionId: string;
  studentId: string;
  ownerId: string;
  questionId: string;
  answer: unknown;
  now?: number;
}): PracticeAnswerResult {
  const now = options.now ?? Date.now();
  const session = sessions.get(options.sessionId);
  if (!session || session.studentId !== options.studentId || session.ownerId !== options.ownerId) {
    return { status: 'not_found' };
  }
  if (session.expiresAt <= now) {
    sessions.delete(session.id);
    return { status: 'expired' };
  }

  const question = session.questions.find(candidate => candidate.question_id === options.questionId);
  if (!question) return { status: 'question_not_found' };
  if (session.answeredQuestionIds.has(question.question_id)) return { status: 'already_answered' };

  const correct = answersMatch(options.answer, question.answer);
  session.answeredQuestionIds.add(question.question_id);
  return {
    status: 'ok',
    correct,
    completed: session.answeredQuestionIds.size === session.questions.length,
    answeredQuestions: session.answeredQuestionIds.size,
    totalQuestions: session.questions.length,
  };
}
