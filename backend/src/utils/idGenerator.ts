import { TeacherRepository } from '../repositories/teacher.repository';

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
