import { Student } from '../../modules/students/student.model.js';
import { Worksheet, type QuestionType } from '../../modules/baseline/worksheet.model.js';
import { EvaluationReport } from '../../modules/evaluation/evaluation.model.js';
import { BaselineStatus } from '../../shared/enums.js';
import { levelName } from '../../domain/levels.js';
import { badRequest, forbidden, notFound } from '../../core/errors/index.js';
import type { UserDoc } from '../../modules/users/user.model.js';

/** Normalise an answer for lenient comparison (case / space / ₹ insensitive). */
function norm(v: unknown): string {
  return String(v ?? '').toLowerCase().replace(/[₹\s]/g, '').trim();
}
const isCorrect = (q: QuestionType, submitted: string) => norm(submitted) === norm(q.answer);

const MASTERY_THRESHOLD = 0.6;

/**
 * Weakest-level mapping (ported from the prototype's core, cleaned up):
 * group questions by source level, and place the student at the LOWEST level
 * they have not yet mastered. If all mastered, place at the highest level tested.
 */
function mapToLevel(questions: QuestionType[], answers: Record<string, string>): number {
  const byLevel = new Map<number, { correct: number; total: number }>();
  for (const q of questions) {
    const b = byLevel.get(q.sourceLevel) ?? { correct: 0, total: 0 };
    b.total += 1;
    if (isCorrect(q, answers[q.questionId] ?? '')) b.correct += 1;
    byLevel.set(q.sourceLevel, b);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  for (const lvl of levels) {
    const { correct, total } = byLevel.get(lvl)!;
    if (correct / total < MASTERY_THRESHOLD) return lvl;
  }
  return levels[levels.length - 1] ?? 1;
}

function buildNarrative(scorePercent: number, strengths: string[], weaknesses: string[], level: number): string {
  const parts = [`Student answered ${scorePercent}% of the baseline correctly.`];
  if (strengths.length) parts.push(`Strengths: ${[...new Set(strengths)].join(', ')}.`);
  if (weaknesses.length) parts.push(`Needs practice in: ${[...new Set(weaknesses)].join(', ')}.`);
  parts.push(`Placed at ${levelName(level)} for personalised worksheets.`);
  return parts.join(' ');
}

export const evaluationService = {
  /** Evaluate a student's baseline answers, assign an FLN level, persist report. */
  async evaluate(studentId: string, answers: Record<string, string>, teacher: UserDoc) {
    if (!answers || typeof answers !== 'object') {
      throw badRequest('answers must be a JSON object of questionId -> answer');
    }
    const student = await Student.findById(studentId);
    if (!student) throw notFound('Student not found');
    if (String(student.teacherId) !== teacher.id) throw forbidden('Student is not in your class');
    if (!student.baselineTestId) throw badRequest('No baseline test has been generated for this student');

    const test = await Worksheet.findById(student.baselineTestId);
    if (!test) throw notFound('Baseline test not found');

    const breakdown = test.questions.map((q) => ({
      questionId: q.questionId,
      topic: q.topic,
      sourceLevel: q.sourceLevel,
      expected: q.answer,
      submitted: String(answers[q.questionId] ?? ''),
      correct: isCorrect(q, answers[q.questionId] ?? ''),
    }));

    const correctCount = breakdown.filter((b) => b.correct).length;
    const totalQuestions = test.questions.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const assignedLevel = mapToLevel(test.questions, answers);
    const assignedLevelName = levelName(assignedLevel);

    const strengths = breakdown.filter((b) => b.correct).map((b) => b.topic);
    const weaknesses = breakdown.filter((b) => !b.correct).map((b) => b.topic);
    const narrative = buildNarrative(scorePercent, strengths, weaknesses, assignedLevel);

    const report = await EvaluationReport.findOneAndUpdate(
      { studentId: student._id },
      {
        worksheetId: test._id,
        studentId: student._id,
        teacherId: teacher._id,
        totalQuestions,
        correctCount,
        scorePercent,
        breakdown,
        assignedLevel,
        assignedLevelName,
        narrative,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    test.status = 'evaluated';
    await test.save();

    student.currentLevel = assignedLevel;
    student.currentLevelName = assignedLevelName;
    student.baselineStatus = BaselineStatus.EVALUATED;
    student.levelHistory.push({
      level: assignedLevel,
      levelName: assignedLevelName,
      date: new Date(),
      reason: `Baseline evaluation: ${scorePercent}% (${correctCount}/${totalQuestions})`,
    });
    await student.save();

    return report;
  },

  async getReport(studentId: string, teacher: UserDoc) {
    return EvaluationReport.findOne({ studentId, teacherId: teacher._id });
  },
};
