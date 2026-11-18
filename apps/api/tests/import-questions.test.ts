import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { tagsForLevel } from '@fln/curriculum';
import { importQuestions } from '../src/importQuestions';
import { memoryRepos } from '../src/repos';

const pilot = JSON.parse(readFileSync(new URL('../../../data/balvatika-pilot-questions.json', import.meta.url), 'utf8'));
const fresh = () => memoryRepos({});
const counts = async (repos: ReturnType<typeof memoryRepos>) => {
  const c = await repos.questions.countsByLevel();
  return Object.fromEntries(Object.entries(c).map(([n, v]) => [n, v.draft + v.approved + v.retired]));
};
const good = (over: Record<string, unknown> = {}) => ({ levelNumber: 19, mode: 'written', prompt: 'Circle the number.', answer: '2', options: ['1', '2'], subskillIds: [tagsForLevel(19)!.subskills[0].id], svg: null, ...over });

describe('importing questions as drafts', () => {
  it('shows what would happen without writing anything', async () => {
    const repos = fresh();
    const r = await importQuestions(repos, pilot, 'u_super', false);
    assert.deepStrictEqual(r, { total: 12, added: 0, alreadyThere: 0, applied: false });
    assert.deepStrictEqual(await counts(repos), {});
  });

  it('adds the pilot as drafts, with the drawing and the teacher note, and approves none of them', async () => {
    const repos = fresh();
    const r = await importQuestions(repos, pilot, 'u_super', true);
    assert.deepStrictEqual(r, { total: 12, added: 12, alreadyThere: 0, applied: true });
    assert.deepStrictEqual(await counts(repos), { 19: 5, 20: 2, 31: 5 });
    const all = [...await repos.questions.byLevel(19), ...await repos.questions.byLevel(20), ...await repos.questions.byLevel(31)];
    assert.ok(all.every(q => q.status === 'draft' && q.approvedBy === null && q.source === 'balvatika-review' && q.createdBy === 'u_super'));
    assert.ok(all.every(q => q.svg?.startsWith('<svg') && q.subskillIds.length > 0));
    assert.equal(all.filter(q => q.teacherNote).length, 8, 'the notes came with the questions');
    assert.equal((await repos.questions.countsByLevel())[19].writtenApproved, 0, 'no teacher can see a draft');
  });

  it('is safe to run twice, also after one has been approved', async () => {
    const repos = fresh();
    await importQuestions(repos, pilot, 'u_super', true);
    const first = (await repos.questions.byLevel(19))[0];
    await repos.questions.update(first.id, { status: 'approved', approvedBy: 'u_super', approvedAt: new Date().toISOString() });
    const again = await importQuestions(repos, pilot, 'u_super', true);
    assert.deepStrictEqual(again, { total: 12, added: 0, alreadyThere: 12, applied: true });
    assert.deepStrictEqual(await counts(repos), { 19: 5, 20: 2, 31: 5 });
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
});
