import { Student, type StudentDoc } from '../../modules/students/student.model.js';
import { EvaluationReport } from '../../modules/evaluation/evaluation.model.js';
import { BaselineStatus } from '../../shared/enums.js';
import { conflict, forbidden, notFound } from '../../core/errors/index.js';
import type { UserDoc } from '../../modules/users/user.model.js';

/** Mask all but the last 4 digits of an Aadhar / Birth Certificate number (SRS R-6). */
function maskId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return 'XXXX';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export interface StudentInput {
  name: string;
  rollNo: string;
  age: number;
  section?: string;
  aadhar: string;
}

function ensureOwner(student: StudentDoc | null, teacher: UserDoc): StudentDoc {
  if (!student) throw notFound('Student not found');
  if (String(student.teacherId) !== teacher.id) throw forbidden('This student is not in your class');
  return student;
}

export const studentService = {
  async listForTeacher(teacher: UserDoc) {
    const students = await Student.find({ teacherId: teacher._id }).sort({ name: 1 });
    // attach latest evaluation report (if any) for the UI
    const reports = await EvaluationReport.find({ teacherId: teacher._id });
    const byStudent = new Map(reports.map((r) => [String(r.studentId), r]));
    return students.map((s) => ({ ...s.toObject(), report: byStudent.get(s.id) ?? null }));
  },

  async get(id: string, teacher: UserDoc): Promise<StudentDoc> {
    return ensureOwner(await Student.findById(id), teacher);
  },

  async create(input: StudentInput, teacher: UserDoc): Promise<StudentDoc> {
    const dup = await Student.exists({ teacherId: teacher._id, rollNo: input.rollNo.trim() });
    if (dup) throw conflict(`Roll number ${input.rollNo} already exists in your class`);
    return Student.create({
      name: input.name.trim(),
      rollNo: input.rollNo.trim(),
      age: input.age,
      section: input.section?.trim() || teacher.section || 'A',
      classGrade: teacher.classGrade ?? 2,
      schoolId: teacher.schoolId ?? 'UNKNOWN',
      teacherId: teacher._id,
      aadharMasked: maskId(input.aadhar),
      baselineStatus: BaselineStatus.PENDING,
    });
  },

  async update(id: string, input: Partial<StudentInput>, teacher: UserDoc): Promise<StudentDoc> {
    const student = await this.get(id, teacher);
    if (input.name !== undefined) student.name = input.name.trim();
    if (input.rollNo !== undefined) student.rollNo = input.rollNo.trim();
    if (input.age !== undefined) student.age = input.age;
    if (input.section !== undefined) student.section = input.section.trim();
    if (input.aadhar) student.aadharMasked = maskId(input.aadhar);
    await student.save();
    return student;
  },

  async remove(id: string, teacher: UserDoc): Promise<void> {
    const student = await this.get(id, teacher);
    await student.deleteOne();
    await EvaluationReport.deleteOne({ studentId: student._id });
  },
};
