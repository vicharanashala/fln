import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createMongoStore } from '../src/mongoRepos';
import { memoryRepos, type Repos, type SeedData } from '../src/repos';

const seed: SeedData = {
  users: [
    { id: 'u1', email: 'Teacher@FLN.test', name: 'T', role: 'teacher', schoolId: 'A', passwordHash: 'h' },
    { id: 'u2', email: 'super@fln.test', name: 'S', role: 'superadmin', passwordHash: 'h', isBanned: true },
  ],
  schools: [{ id: 'A', name: 'School A' }],
  classes: [
    { id: 'c2', schoolId: 'A', className: 'Class 1', section: 'A', teacherId: 'u1' },
    { id: 'c1', schoolId: 'A', className: 'Balvatika', section: 'A', teacherId: 'u1' },
  ],
  students: [
    { id: 's1', schoolId: 'A', classId: 'c1', name: 'Asha', currentLevel: 20 },
    { id: 's2', schoolId: 'A', classId: 'c2', name: 'Zoya', currentLevel: 47 },
  ],
};

/** The same behaviour must hold for the in-memory store (used by route tests) and MongoDB (used in production). */
function contract(name: string, make: () => Promise<Repos>) {
  describe(`repos contract: ${name}`, () => {
    let repos: Repos;
    before(async () => { repos = await make(); });

    it('finds a user by email ignoring case, and by id', async () => {
      assert.equal((await repos.users.byEmail('TEACHER@fln.test'))?.id, 'u1');
      assert.equal((await repos.users.byId('u2'))?.isBanned, true);
    });
    it('returns undefined for unknown ids and emails', async () => {
      assert.equal(await repos.users.byEmail('nobody@fln.test'), undefined);
      assert.equal(await repos.users.byId('nope'), undefined);
      assert.equal(await repos.schools.byId('nope'), undefined);
      assert.equal(await repos.classes.byId('nope'), undefined);
    });
    it('never exposes a Mongo _id on returned records', async () => {
      const school = await repos.schools.byId('A');
      assert.deepEqual(school, { id: 'A', name: 'School A' });
      assert.equal(Object.hasOwn(await repos.classes.byId('c1') ?? {}, '_id'), false);
    });
    it('lists all classes', async () => {
      const ids = (await repos.classes.list()).map(c => c.id);
      assert.ok(ids.includes('c1') && ids.includes('c2'));
    });
    it('lists only the students of the asked class', async () => {
      assert.deepEqual((await repos.students.byClass('c1')).map(s => s.name), ['Asha']);
      assert.deepEqual(await repos.students.byClass('missing'), []);
    });
    it('adds a student with a new unique id and finds it again', async () => {
      const a = await repos.students.add({ schoolId: 'A', classId: 'c1', name: 'Ira', currentLevel: 1 });
      const b = await repos.students.add({ schoolId: 'A', classId: 'c1', name: 'Om', currentLevel: 1 });
      assert.notEqual(a.id, b.id);
      const names = (await repos.students.byClass('c1')).map(s => s.name).sort();
      assert.deepEqual(names, ['Asha', 'Ira', 'Om']);
    });
    it('adds a class with a new id and lists it', async () => {
      const created = await repos.classes.add({ schoolId: 'A', className: 'Class 2', section: 'B', teacherId: 'u1' });
      assert.match(created.id, /^cls_/);
      assert.equal((await repos.classes.byId(created.id))?.section, 'B');
      assert.ok((await repos.classes.list()).some(c => c.id === created.id));
    });
    it('stores attempts per class, newest first, without leaking a Mongo _id', async () => {
      const base = { schoolId: 'A', classId: 'c1', studentId: 's1', level: 22, set: 0, answers: [], score: 3, band: 'Developing' as const, source: 'marks' as const, recordedBy: 'u1' };
      const older = await repos.attempts.add({ ...base, createdAt: '2026-11-01T10:00:00.000Z' });
      const newer = await repos.attempts.add({ ...base, createdAt: '2026-11-02T10:00:00.000Z' });
      await repos.attempts.add({ ...base, classId: 'c2', createdAt: '2026-11-03T10:00:00.000Z' });
      assert.notEqual(older.id, newer.id);
      const list = await repos.attempts.byClass('c1');
      assert.deepEqual(list.map(a => a.id), [newer.id, older.id]);
      assert.equal(Object.hasOwn(list[0], '_id'), false);
      assert.deepEqual(await repos.attempts.byClass('missing'), []);
    });
  });
}

contract('memory', async () => memoryRepos(seed));

let mongod: MongoMemoryServer;
let client: MongoClient;
contract('mongo', async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  const store = createMongoStore(client.db('fln_v2_test'));
  await store.ensureIndexes();
  await store.seed(seed);
  return store.repos;
});

describe('mongo indexes', () => {
  it('rejects a second user with the same email in any case', async () => {
    const store = createMongoStore(client.db('fln_v2_dupe'));
    await store.ensureIndexes();
    await store.seed({ users: [{ id: 'a', email: 'x@y.z', name: 'A', role: 'teacher', schoolId: 'A', passwordHash: 'h' }] });
    await assert.rejects(store.seed({ users: [{ id: 'b', email: 'X@Y.Z', name: 'B', role: 'teacher', schoolId: 'A', passwordHash: 'h' }] }));
  });
});

after(async () => {
  await client?.close();
  await mongod?.stop();
});
