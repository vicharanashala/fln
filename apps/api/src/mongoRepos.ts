import { MongoClient, type Db } from 'mongodb';
import type { Repos, SeedData } from './repos';
import type { ClassGroup, School, Student, User } from './types';

/** Mongo documents use our string id as `_id`, so ids stay stable and no ObjectId leaks into the API. */
type Doc<T extends { id: string }> = Omit<T, 'id'> & { _id: string };

function toDoc<T extends { id: string }>(value: T): Doc<T> {
  const { id, ...rest } = value;
  return { _id: id, ...rest } as Doc<T>;
}

function fromDoc<T extends { id: string }>(doc: Doc<T>): T {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest } as unknown as T;
}

export interface MongoStore {
  repos: Repos;
  /** Insert starting data; used by tests and the seed script, never by request handlers. */
  seed(data: SeedData): Promise<void>;
  /** Create the indexes the repositories rely on. Safe to run on every start. */
  ensureIndexes(): Promise<void>;
  close(): Promise<void>;
}

export async function connectMongo(uri: string, dbName: string): Promise<MongoStore> {
  const client = new MongoClient(uri);
  await client.connect();
  return createMongoStore(client.db(dbName), () => client.close());
}

export function createMongoStore(db: Db, close: () => Promise<void> = async () => {}): MongoStore {
  const users = db.collection<Doc<User>>('users');
  const schools = db.collection<Doc<School>>('schools');
  const classes = db.collection<Doc<ClassGroup>>('classes');
  const students = db.collection<Doc<Student>>('students');

  const repos: Repos = {
    users: {
      async byEmail(email) {
        // Emails are stored lower-cased (see seed), so the lookup is an exact match on an index.
        const doc = await users.findOne({ email: email.toLowerCase() });
        return doc ? fromDoc<User>(doc) : undefined;
      },
      async byId(id) {
        const doc = await users.findOne({ _id: id });
        return doc ? fromDoc<User>(doc) : undefined;
      },
    },
    schools: {
      async byId(id) {
        const doc = await schools.findOne({ _id: id });
        return doc ? fromDoc<School>(doc) : undefined;
      },
    },
    classes: {
      async byId(id) {
        const doc = await classes.findOne({ _id: id });
        return doc ? fromDoc<ClassGroup>(doc) : undefined;
      },
      async list() {
        return (await classes.find().sort({ _id: 1 }).toArray()).map(d => fromDoc<ClassGroup>(d));
      },
    },
    students: {
      async byClass(classId) {
        return (await students.find({ classId }).sort({ _id: 1 }).toArray()).map(d => fromDoc<Student>(d));
      },
      async add(student) {
        const created: Student = { ...student, id: `stu_${crypto.randomUUID()}` };
        await students.insertOne(toDoc(created));
        return created;
      },
    },
  };

  return {
    repos,
    async seed(data) {
      if (data.users?.length) await users.insertMany(data.users.map(u => toDoc({ ...u, email: u.email.toLowerCase() })));
      if (data.schools?.length) await schools.insertMany(data.schools.map(toDoc));
      if (data.classes?.length) await classes.insertMany(data.classes.map(toDoc));
      if (data.students?.length) await students.insertMany(data.students.map(toDoc));
    },
    async ensureIndexes() {
      await users.createIndex({ email: 1 }, { unique: true });
      await classes.createIndex({ schoolId: 1 });
      await students.createIndex({ classId: 1 });
    },
    close,
  };
}
