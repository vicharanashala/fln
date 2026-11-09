import assert from 'node:assert';
import { describe, it } from 'node:test';
import { HttpError } from '../src/http';
import { gradePaper, suggestMarks } from '../src/services/grading';
import { createLimiter } from '../src/services/limiter';

const key = ['7', '2, 4', '10', 'yes', '3'];
const bad = (fn: () => unknown, status = 400) => assert.throws(fn, (e: unknown) => e instanceof HttpError && e.status === status);

describe('gradePaper', () => {
  it('grades answers against the key and assigns the band', () => {
    const g = gradePaper({ answers: ['7', '2,4', '09', null, '3'] }, key);
    assert.deepEqual(g.answers.map(a => a.correct), [true, true, false, false, true]);
    assert.equal(g.score, 3); assert.equal(g.band, 'Developing'); assert.equal(g.source, 'typed');
    assert.equal(gradePaper({ answers: ['7', '2, 4', '10', 'yes', '3'], source: 'scan' }, key).source, 'scan');
    assert.equal(gradePaper({ answers: ['7', '2, 4', '10', 'yes', '3'], source: 'whatever' }, key).source, 'typed', 'only "scan" is accepted as a source');
  });
  it('takes the teacher\'s own marks as they are', () => {
    const g = gradePaper({ marks: [true, false, false, false, false] }, key);
    assert.equal(g.score, 1); assert.equal(g.band, 'Emerging'); assert.equal(g.source, 'marks');
    assert.equal(g.answers[0].given, null);
    assert.equal(gradePaper({ marks: [true, true, true, true, true] }, key).band, 'Secure');
  });
  it('refuses anything that is not exactly one well-formed kind of paper', () => {
    bad(() => gradePaper({}, key));
    bad(() => gradePaper({ answers: ['1', '2', '3', '4', '5'], marks: [true, true, true, true, true] }, key));
    bad(() => gradePaper({ answers: ['1'] }, key));
    bad(() => gradePaper({ answers: ['1', '2', '3', '4', 5] }, key));
    bad(() => gradePaper({ answers: ['1', '2', '3', '4', 'x'.repeat(101)] }, key));
    bad(() => gradePaper({ marks: [true, true] }, key));
    bad(() => gradePaper({ marks: ['yes', 1, 1, 1, 1] }, key));
    bad(() => gradePaper({ marks: null }, key));
  });
  it('suggests marks only for answers that were read and match', () => {
    assert.deepEqual(suggestMarks(['7', null, '10', 'no', ''], key), [true, false, true, false, false]);
  });
});

describe('createLimiter', () => {
  const gate = () => { let open!: () => void; const wait = new Promise<void>(r => { open = r; }); return { wait, open }; };

  it('runs one job at a time, queues the next, and refuses when the queue is full', async () => {
    const run = createLimiter({ concurrent: 1, queue: 1 });
    const order: string[] = [];
    const g1 = gate(), g2 = gate();
    const a = run(async () => { order.push('a start'); await g1.wait; order.push('a end'); return 'a'; });
    const b = run(async () => { order.push('b start'); await g2.wait; order.push('b end'); return 'b'; });
    await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(order, ['a start'], 'b is waiting while a runs');
    await assert.rejects(run(async () => 'c'), (e: unknown) => e instanceof HttpError && e.status === 503, 'the third is refused, not queued forever');
    g1.open(); await a; await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(order, ['a start', 'a end', 'b start']);
    g2.open();
    assert.equal(await b, 'b');
  });
  it('frees its place when a job fails, so one bad photo does not block the rest', async () => {
    const run = createLimiter({ concurrent: 1, queue: 0 });
    await assert.rejects(run(async () => { throw new Error('boom'); }), /boom/);
    assert.equal(await run(async () => 'next'), 'next');
  });
  it('lets several run at once when allowed', async () => {
    const run = createLimiter({ concurrent: 2, queue: 0 });
    const g = gate();
    const a = run(() => g.wait.then(() => 1)), b = run(() => g.wait.then(() => 2));
    await assert.rejects(run(async () => 3), (e: unknown) => e instanceof HttpError && e.status === 503);
    g.open();
    assert.deepEqual(await Promise.all([a, b]), [1, 2]);
  });
});
