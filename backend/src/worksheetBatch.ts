export interface PlacedStudentLike {
  id: string;
  currentLevel?: number | null;
  levelHistory?: Array<{ level: number }>;
}

export function selectPlacedStudents<T extends PlacedStudentLike>(students: T[], studentIds: string[]) {
  const byId = new Map(students.map(student => [student.id, student]));
  const targets: T[] = [];
  const skipped: Array<{ studentId: string; reason: string }> = [];

  for (const studentId of studentIds) {
    const student = byId.get(studentId);
    if (!student) {
      skipped.push({ studentId, reason: 'Student not found.' });
      continue;
    }

    const latestPlacement = student.levelHistory?.[student.levelHistory.length - 1]?.level;
    if (student.currentLevel == null && latestPlacement == null) {
      skipped.push({ studentId, reason: 'Student has not completed their diagnostic test.' });
      continue;
    }

    targets.push(student.currentLevel == null
      ? { ...student, currentLevel: latestPlacement }
      : student);
  }

  return { targets, skipped };
}