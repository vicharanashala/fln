import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { tagsForLevel } from '@fln/curriculum';
import { importQuestions } from '../src/importQuestions';
import { memoryRepos } from '../src/repos';

const data = JSON.parse(readFileSync(new URL('../../../data/balvatika-questions.json', import.meta.url), 'utf8'));
const fresh = () => memoryRepos({});
const perLevel: Record<number, number> = {};
for (const q of data) perLevel[q.levelNumber] = (perLevel[q.levelNumber] ?? 0) + 1;
const N = data.length;
const counts = async (repos: ReturnType<typeof memoryRepos>) => {
  const c = await repos.questions.countsByLevel();
  return Object.fromEntries(Object.entries(c).map(([n, v]) => [n, v.draft + v.approved + v.retired]));
};
const good = (over: Record<string, unknown> = {}) => ({ levelNumber: 19, mode: 'written', prompt: 'Circle the number.', answer: '2', options: ['1', '2'], subskillIds: [tagsForLevel(19)!.subskills[0].id], svg: null, ...over });

describe('importing questions as drafts', () => {
  it('shows what would happen without writing anything', async () => {
    const repos = fresh();
    const r = await importQuestions(repos, data, 'u_super', false);
    assert.deepStrictEqual(r, { total: N, added: 0, alreadyThere: 0, retired: 0, wouldRetire: 0, applied: false });
    assert.deepStrictEqual(await counts(repos), {});
  });

  it('adds the questions as drafts, with the drawing and the teacher note, and approves none of them', async () => {
    const repos = fresh();
    const r = await importQuestions(repos, data, 'u_super', true);
    assert.deepStrictEqual(r, { total: N, added: N, alreadyThere: 0, retired: 0, wouldRetire: 0, applied: true });
    assert.deepStrictEqual(await counts(repos), perLevel);
    const all = (await Promise.all(Object.keys(perLevel).map(n => repos.questions.byLevel(Number(n))))).flat();
    assert.ok(all.every(q => q.status === 'draft' && q.approvedBy === null && q.source === 'balvatika-review' && q.createdBy === 'u_super'));
    assert.ok(all.every(q => q.subskillIds.length > 0 && (q.mode === 'observed' || q.answer)));
    assert.ok(all.some(q => q.svg?.startsWith('<svg')) && all.some(q => q.teacherNote), 'drawings and teacher notes came with the questions');
    assert.ok(Object.values(await repos.questions.countsByLevel()).every(c => c.writtenApproved === 0), 'no teacher can see a draft');
  });

  it('is safe to run twice, also after one has been approved', async () => {
    const repos = fresh();
    await importQuestions(repos, data, 'u_super', true);
    const first = (await repos.questions.byLevel(Number(Object.keys(perLevel)[0])))[0];
    await repos.questions.update(first.id, { status: 'approved', approvedBy: 'u_super', approvedAt: new Date().toISOString() });
    const again = await importQuestions(repos, data, 'u_super', true);
    assert.deepStrictEqual(again, { total: N, added: 0, alreadyThere: N, retired: 0, wouldRetire: 0, applied: true });
    assert.deepStrictEqual(await counts(repos), perLevel);
  });

  it('writes nothing when any item breaks a rule, and names every one that does', async () => {
    const repos = fresh();
    const items = [good(), good({ prompt: 'B', answer: '9' }), good({ prompt: 'C', subskillIds: [tagsForLevel(31)!.subskills[0].id] }), good({ levelNumber: 5000 }), good({ svg: '<svg><script>x</script></svg>', prompt: 'D' })];
    await assert.rejects(() => importQuestions(repos, items, 'u_super', true), (e: Error) => {
      assert.match(e.message, /Nothing was written\. 4 problem/);
      for (const n of [2, 3, 4, 5]) assert.ok(e.message.includes(`Item ${n}`), `item ${n} is named`);
      assert.ok(!e.message.includes('Item 1'));
      return true;
    });
    assert.deepStrictEqual(await counts(repos), {}, 'not even the good item was written');
  });

  it('refuses the same question twice in one file, an empty file and a file that is not a list', async () => {
    const repos = fresh();
    await assert.rejects(() => importQuestions(repos, [good(), good()], 'u', true), /twice/);
    await assert.rejects(() => importQuestions(repos, [], 'u', true), /list of questions/);
    await assert.rejects(() => importQuestions(repos, { a: 1 }, 'u', true), /list of questions/);
    assert.deepStrictEqual(await counts(repos), {});
  });

  it('keeps two questions that differ only in their drawing (the combine-groups questions share a wording)', async () => {
    const repos = fresh();
    const a = good({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><g class="obj"/></svg>' }), b = good({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><g class="obj"/><g class="obj"/></svg>' });
    const r = await importQuestions(repos, [a, b], 'u', true);
    assert.equal(r.added, 2);
  });

  it('retires an out-of-date draft but never an approved question, and leaves a hand-typed draft alone', async () => {
    const repos = fresh();
    const v1 = [good({ prompt: 'Old A', answer: '1', options: ['1', '2'] }), good({ prompt: 'Old B', answer: '2', options: ['1', '2'] }), good({ prompt: 'Old C', answer: '1', options: ['1', '2'] })].map(x => ({ ...x, source: 'balvatika-review' }));
    await importQuestions(repos, v1, 'u', true);
    const [oldA, oldB, oldC] = await repos.questions.byLevel(19);
    await repos.questions.update(oldA.id, { status: 'approved', approvedBy: 'u', approvedAt: new Date().toISOString() });
    const typed = await repos.questions.add({ ...oldB, id: undefined as never, prompt: 'Typed by hand', source: 'authored', createdAt: new Date().toISOString() } as never);
    const v2 = [{ ...good({ prompt: 'Old C', answer: '1', options: ['1', '2'] }), source: 'balvatika-review' }, { ...good({ prompt: 'New D', answer: '2', options: ['1', '2'] }), source: 'balvatika-review' }];
    const dry = await importQuestions(repos, v2, 'u', false);
    assert.deepStrictEqual([dry.wouldRetire, dry.retired], [1, 0], 'a dry run says what it would retire and retires nothing');
    assert.equal((await repos.questions.byId(oldB.id))!.status, 'draft');
    const r = await importQuestions(repos, v2, 'u', true);
    assert.deepStrictEqual([r.added, r.alreadyThere, r.retired], [1, 1, 1]);
    const status = async (id: string) => (await repos.questions.byId(id))!.status;
    assert.equal(await status(oldA.id), 'approved', 'an approved question is never touched');
    assert.equal(await status(oldB.id), 'retired', 'an out-of-date draft is retired, not deleted');
    assert.equal(await status(oldC.id), 'draft', 'a question that is still in the file stays');
    assert.equal(await status(typed.id), 'draft', 'a draft typed in by hand is left alone');
    const again = await importQuestions(repos, v2, 'u', true);
    assert.deepStrictEqual([again.added, again.retired], [0, 0], 'safe to run again');
  });
});
