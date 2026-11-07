import type { ClassGroup, School, Student, User } from './types';

/**
 * Data access, behind interfaces so the routes never know which store is used.
 * v2 has one real store (MongoDB); the in-memory version is for tests and local demos.
 */
export interface Repos {
  users: {
    byEmail(email: string): Promise<User | undefined>;
    byId(id: string): Promise<User | undefined>;
  };
  schools: { byId(id: string): Promise<School | undefined> };
  classes: {
    byId(id: string): Promise<ClassGroup | undefined>;
    list(): Promise<ClassGroup[]>;
  };
  students: {
    byClass(classId: string): Promise<Student[]>;
    add(student: Omit<Student, 'id'>): Promise<Student>;
  };
}

export interface SeedData {
  users?: User[];
  schools?: School[];
  classes?: ClassGroup[];
  students?: Student[];
}

export function memoryRepos(seed: SeedData = {}): Repos {
  const users = [...(seed.users ?? [])];
  const schools = [...(seed.schools ?? [])];
  const classes = [...(seed.classes ?? [])];
  const students = [...(seed.students ?? [])];
  let nextId = students.length + 1;
  return {
    users: {
      async byEmail(email) { return users.find(u => u.email.toLowerCase() === email.toLowerCase()); },
      async byId(id) { return users.find(u => u.id === id); },
    },
    schools: { async byId(id) { return schools.find(s => s.id === id); } },
    classes: {
      async byId(id) { return classes.find(c => c.id === id); },
      async list() { return [...classes]; },
    },
    students: {
      async byClass(classId) { return students.filter(s => s.classId === classId); },
      async add(student) {
        const created: Student = { ...student, id: `stu_${nextId++}` };
        students.push(created);
        return created;
      },
    },
  };
}
