import { Student, type StudentDoc } from '../../modules/students/student.model.js';
import { Worksheet } from '../../modules/baseline/worksheet.model.js';
import { BaselineStatus, AssessmentCycle } from '../../shared/enums.js';
import { buildBaselineQuestions } from '../../domain/levels.js';
import { badRequest } from '../../core/errors/index.js';
import type { UserDoc } from '../../modules/users/user.model.js';

/** Generate a baseline test for a single student (idempotent). */
async function generateForStudent(student: StudentDoc) {
  if (student.baselineTestId) {
    return Worksheet.findById(student.baselineTestId);
  }
  const coversClass = Math.max(1, student.classGrade - 1);
  const questions = buildBaselineQuestions(student.classGrade);

  const test = await Worksheet.create({
    studentId: student._id,
    teacherId: student.teacherId,
    schoolId: student.schoolId,
    classGrade: student.classGrade,
    cycle: AssessmentCycle.BASELINE,
    coversClass,
    questions,
    status: 'generated',
  });

  student.baselineTestId = test._id;
  student.baselineStatus = BaselineStatus.GENERATED;
  await student.save();
  return test;
}

export const baselineService = {
  /** Generate baseline tests for all pending students in the teacher's class. */
  async generateForClass(teacher: UserDoc): Promise<{ generated: number }> {
    const pending = await Student.find({ teacherId: teacher._id, baselineStatus: BaselineStatus.PENDING });
    if (pending.length === 0) throw badRequest('No students with a pending baseline test');
    for (const student of pending) await generateForStudent(student);
    return { generated: pending.length };
  },

  /** Baseline status summary for the teacher's class. */
  async status(teacher: UserDoc) {
    const [pending, generated, evaluated] = await Promise.all([
      Student.countDocuments({ teacherId: teacher._id, baselineStatus: BaselineStatus.PENDING }),
      Worksheet.countDocuments({ teacherId: teacher._id, status: 'generated' }),
      Worksheet.countDocuments({ teacherId: teacher._id, status: 'evaluated' }),
    ]);
    return { pending, generated, evaluated };
  },

  /** Fetch a single test with the answer key stripped (for preview). */
  async getTestForPreview(testId: string, teacher: UserDoc) {
    const test = await Worksheet.findOne({ _id: testId, teacherId: teacher._id });
    if (!test) throw badRequest('Test not found');
    const obj = test.toObject();
    obj.questions = obj.questions.map(({ answer, ...q }) => q) as typeof obj.questions;
    return obj;
  },
};
