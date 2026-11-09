import { MongoClient, type Db } from 'mongodb';
import type { Repos, SeedData } from './repos';
import { levelRows } from './levels';
import type { Attempt, ClassGroup, LevelCounts, LevelRow, Question, School, Student, User } from './types';

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
  /** Write all curriculum levels into the `levels` collection (insert or refresh by level number). Safe on every start. */
  syncLevels(): Promise<number>;
  /** Create the indexes the repositories rely on. Safe to run on every start. */
  ensureIndexes(): Promise<void>;
  /** Throws when the database does not answer. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export async function connectMongo(uri: string, dbName: string, options: { maxPoolSize?: number } = {}): Promise<MongoStore> {
  const client = new MongoClient(uri, { maxPoolSize: options.maxPoolSize ?? 10, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return createMongoStore(client.db(dbName), () => client.close());
}

export function createMongoStore(db: Db, close: () => Promise<void> = async () => {}): MongoStore {
  const users = db.collection<Doc<User>>('users');
  const schools = db.collection<Doc<School>>('schools');
  const classes = db.collection<Doc<ClassGroup>>('classes');
  const students = db.collection<Doc<Student>>('students');
  const attempts = db.collection<Doc<Attempt>>('attempts');
  const levels = db.collection<Doc<LevelRow & { id: string }>>('levels');
  const questions = db.collection<Doc<Question>>('questions');

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
      async list() {
        return (await users.find().sort({ _id: 1 }).toArray()).map(d => fromDoc<User>(d));
      },
      async add(user) {
        const created: User = { ...user, id: user.id ?? `u_${crypto.randomUUID()}`, email: user.email.toLowerCase() };
        await users.insertOne(toDoc(created)); // the unique email index rejects a duplicate
        return created;
      },
      async update(id, patch) {
        const doc = await users.findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' });
        return doc ? fromDoc<User>(doc) : undefined;
      },
    },
    schools: {
      async byId(id) {
        const doc = await schools.findOne({ _id: id });
        return doc ? fromDoc<School>(doc) : undefined;
      },
      async list() {
        return (await schools.find().sort({ _id: 1 }).toArray()).map(d => fromDoc<School>(d));
      },
      async add(school) {
        const created: School = { ...school, id: `sch_${crypto.randomUUID()}` };
        await schools.insertOne(toDoc(created));
        return created;
      },
    },
    levels: {
      async list() {
        return (await levels.find().sort({ levelNumber: 1 }).toArray()).map(({ _id: _omit, ...rest }) => { void _omit; return rest as unknown as LevelRow; });
      },
      async byNumber(n) {
        const doc = await levels.findOne({ levelNumber: n });
        if (!doc) return undefined;
        const { _id: _omit, ...rest } = doc; void _omit;
        return rest as unknown as LevelRow;
      },
    },
    questions: {
      async add(q) {
        const created: Question = { ...q, id: `q_${crypto.randomUUID()}` };
        await questions.insertOne(toDoc(created));
        return created;
      },
      async byId(id) {
        const doc = await questions.findOne({ _id: id });
        return doc ? fromDoc<Question>(doc) : undefined;
      },
      async approved() {
        return (await questions.find({ status: 'approved' }).toArray()).map(d => fromDoc<Question>(d));
      },
      async byLevel(n) {
        return (await questions.find({ levelNumber: n }).sort({ createdAt: 1, _id: 1 }).toArray()).map(d => fromDoc<Question>(d));
      },
      async update(id, patch) {
        const doc = await questions.findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' });
        return doc ? fromDoc<Question>(doc) : undefined;
      },
      async countsByLevel() {
        const rows = await questions.aggregate<{ _id: { l: number; s: 'draft' | 'approved' | 'retired'; m: string }; n: number }>([
          { $group: { _id: { l: '$levelNumber', s: '$status', m: '$mode' }, n: { $sum: 1 } } },
        ]).toArray();
        const out: Record<number, LevelCounts> = {};
        for (const r of rows) {
          out[r._id.l] ??= { draft: 0, approved: 0, retired: 0, writtenApproved: 0 };
          out[r._id.l][r._id.s] += r.n;
          if (r._id.s === 'approved' && r._id.m === 'written') out[r._id.l].writtenApproved += r.n;
        }
        return out;
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
      async add(cls) {
        const created: ClassGroup = { ...cls, id: `cls_${crypto.randomUUID()}` };
        await classes.insertOne(toDoc(created));
        return created;
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
    attempts: {
      async add(attempt) {
        const created: Attempt = { ...attempt, id: `att_${crypto.randomUUID()}` };
        await attempts.insertOne(toDoc(created));
        return created;
      },
      async byClass(classId) {
        return (await attempts.find({ classId }).sort({ createdAt: -1 }).toArray()).map(d => fromDoc<Attempt>(d));
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
      if (data.attempts?.length) await attempts.insertMany(data.attempts.map(toDoc));
      if (data.questions?.length) await questions.insertMany(data.questions.map(toDoc));
    },
    async syncLevels() {
      const rows = levelRows();
      await levels.bulkWrite(rows.map(r => ({
        updateOne: { filter: { levelNumber: r.levelNumber }, update: { $set: r, $setOnInsert: { _id: `level_${r.levelNumber}` } }, upsert: true },
      })));
      return rows.length;
    },
    async ensureIndexes() {
      await users.createIndex({ email: 1 }, { unique: true });
      await classes.createIndex({ schoolId: 1 });
      await students.createIndex({ classId: 1 });
      await attempts.createIndex({ classId: 1, createdAt: -1 });
      await levels.createIndex({ levelNumber: 1 }, { unique: true });
      await questions.createIndex({ levelNumber: 1, status: 1 });
    },
    async ping() { await db.command({ ping: 1 }); },
    close,
  };
}
