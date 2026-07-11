import archiver from 'archiver';
import type { Response } from 'express';
import { Student } from '../../modules/students/student.model.js';
import { Worksheet } from '../../modules/baseline/worksheet.model.js';
import { BaselineStatus } from '../../shared/enums.js';
import { renderBaselinePdf } from '../../modules/baseline/pdf.service.js';
import { badRequest } from '../../core/errors/index.js';
import type { UserDoc } from '../../modules/users/user.model.js';

/**
 * Stream a ZIP of baseline PDFs — one per student whose baseline is generated
 * but not yet evaluated (i.e. sheets still to be printed/conducted).
 */
export async function streamBaselineZip(teacher: UserDoc, res: Response): Promise<void> {
  const students = await Student.find({
    teacherId: teacher._id,
    baselineStatus: BaselineStatus.GENERATED,
    baselineTestId: { $ne: null },
  });

  if (students.length === 0) {
    throw badRequest('No generated baseline tests to download. Generate baseline tests first.');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="baseline-tests-${stamp}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);

  for (const student of students) {
    const test = await Worksheet.findById(student.baselineTestId);
    if (!test) continue;
    const pdf = await renderBaselinePdf(test, student);
    const safe = student.name.replace(/[^\w\- ]/g, '').replace(/\s+/g, '_');
    archive.append(pdf, { name: `${safe}_${student.rollNo}_baseline.pdf` });
  }

  await archive.finalize();
}
