import { TeacherRepository } from '../repositories/teacher.repository';
import { ClassRepository } from '../repositories/class/class.repository';

export async function generateTeacherId(
  repository: TeacherRepository
): Promise<string> {
  const lastId = await repository.getLastTeacherId();

  if (!lastId) {
    return 'T000001';
  }

  const numericPart = parseInt(lastId.replace('T', ''), 10);
  const nextNumeric = numericPart + 1;
  return `T${String(nextNumeric).padStart(6, '0')}`;
}

export async function generateClassCode(
  repository: ClassRepository
): Promise<string> {
  const lastCode = await repository.getLastClassCode();

  if (!lastCode) {
    return 'CLS-001';
  }

  const numericPart = parseInt(lastCode.replace('CLS-', ''), 10);
  const nextNumeric = numericPart + 1;
  return `CLS-${String(nextNumeric).padStart(3, '0')}`;
}
