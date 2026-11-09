import { levelRows } from './levels';
import type { Attempt, ClassGroup, LevelCounts, LevelRow, Question, School, Student, User } from './types';

/**
 * Data access, behind interfaces so the routes never know which store is used.
 * v2 has one real store (MongoDB); the in-memory version is for tests and local demos.
 */
export interface Repos {
  users: {
    byEmail(email: string): Promise<User | undefined>;
    byId(id: string): Promise<User | undefined>;
    list(): Promise<User[]>;
    add(user: Omit<User, 'id'> & { id?: string }): Promise<User>;
    update(id: string, patch: Partial<Pick<User, 'isBanned' | 'name'>>): Promise<User | undefined>;
  };
  schools: {
    byId(id: string): Promise<School | undefined>;
    list(): Promise<School[]>;
    add(school: Omit<School, 'id'>): Promise<School>;
  };
  levels: {
    list(): Promise<LevelRow[]>;
    byNumber(levelNumber: number): Promise<LevelRow | undefined>;
  };
  questions: {
    add(question: Omit<Question, 'id'>): Promise<Question>;
    byId(id: string): Promise<Question | undefined>;
    byLevel(levelNumber: number): Promise<Question[]>;
    update(id: string, patch: Partial<Omit<Question, 'id'>>): Promise<Question | undefined>;
    /** How many questions each level has in each status. Levels with none are absent. */
    countsByLevel(): Promise<Record<number, LevelCounts>>;
  };
  classes: {
    byId(id: string): Promise<ClassGroup | undefined>;
    list(): Promise<ClassGroup[]>;
    add(cls: Omit<ClassGroup, 'id'>): Promise<ClassGroup>;
  };
  students: {
    byClass(classId: string): Promise<Student[]>;
    add(student: Omit<Student, 'id'>): Promise<Student>;
  };
  attempts: {
    add(attempt: Omit<Attempt, 'id'>): Promise<Attempt>;
    byClass(classId: string): Promise<Attempt[]>;
  };
}

export interface SeedData {
  users?: User[];
  schools?: School[];
  classes?: ClassGroup[];
  students?: Student[];
  attempts?: Attempt[];
  questions?: Question[];
}

export function memoryRepos(seed: SeedData = {}): Repos {
  const users = [...(seed.users ?? [])];
  const schools = [...(seed.schools ?? [])];
  const classes = [...(seed.classes ?? [])];
  const students = [...(seed.students ?? [])];
  const attempts = [...(seed.attempts ?? [])];
  let nextId = students.length + 1;
  let nextClassId = classes.length + 1;
  let nextAttemptId = attempts.length + 1;
  const levels = levelRows();
  const questions = [...(seed.questions ?? [])];
  let nextQuestionId = questions.length + 1;
  let nextUserId = users.length + 1;
  let nextSchoolId = schools.length + 1;
  return {
    users: {
      async byEmail(email) { return users.find(u => u.email.toLowerCase() === email.toLowerCase()); },
      async byId(id) { return users.find(u => u.id === id); },
      async list() { return [...users]; },
      async add(user) {
        const created: User = { ...user, id: user.id ?? `u_${nextUserId++}`, email: user.email.toLowerCase() };
        users.push(created);
        return created;
      },
      async update(id, patch) {
        const u = users.find(x => x.id === id);
        if (!u) return undefined;
        Object.assign(u, patch);
        return u;
      },
    },
    schools: {
      async byId(id) { return schools.find(s => s.id === id); },
      async list() { return [...schools]; },
      async add(school) {
        const created: School = { ...school, id: `sch_${nextSchoolId++}` };
        schools.push(created);
        return created;
      },
    },
    levels: {
      async list() { return levels.map(l => ({ ...l })); },
      async byNumber(n) { return levels.find(l => l.levelNumber === n); },
    },
    questions: {
      async add(q) {
        const created: Question = { ...q, id: `q_${nextQuestionId++}` };
        questions.push(created);
        return created;
      },
      async byId(id) { return questions.find(q => q.id === id); },
      async byLevel(n) { return questions.filter(q => q.levelNumber === n).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); },
      async update(id, patch) {
        const q = questions.find(x => x.id === id);
        if (!q) return undefined;
        Object.assign(q, patch);
        return q;
      },
      async countsByLevel() {
        const out: Record<number, LevelCounts> = {};
        for (const q of questions) {
          out[q.levelNumber] ??= { draft: 0, approved: 0, retired: 0, writtenApproved: 0 };
          out[q.levelNumber][q.status]++;
          if (q.status === 'approved' && q.mode === 'written') out[q.levelNumber].writtenApproved++;
        }
        return out;
      },
    },
    classes: {
      async byId(id) { return classes.find(c => c.id === id); },
      async list() { return [...classes]; },
      async add(cls) {
        const created: ClassGroup = { ...cls, id: `cls_${nextClassId++}` };
        classes.push(created);
        return created;
      },
    },
    students: {
      async byClass(classId) { return students.filter(s => s.classId === classId); },
      async add(student) {
        const created: Student = { ...student, id: `stu_${nextId++}` };
        students.push(created);
        return created;
      },
    },
    attempts: {
      async add(attempt) {
        const created: Attempt = { ...attempt, id: `att_${nextAttemptId++}` };
        attempts.push(created);
        return created;
      },
      async byClass(classId) {
        return attempts.filter(a => a.classId === classId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
    },
  };
}
