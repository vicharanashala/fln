import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  evaluate, fill, ExpressionError, resolveLayout, validateLayoutTemplate, nearbyDistractors, createRng,
} from '../src/services/layoutTemplateEngine';
import { stripPreviewMarkup } from '../src/services/layoutTemplateGeneration';
import { drawLayout, measureLayout } from '../src/layoutTemplatePdf';
import type { LayoutTemplate } from '../src/types/layoutTemplate';

function template(over: Partial<LayoutTemplate> = {}): LayoutTemplate {
  return {
    id: 'LT-test',
    name: 'Add two numbers with pictures',
    conceptId: 'S1.5',
    levelNumber: 5,
    levelName: 'Counting Small Sets (1-3)',
    questionFamily: 'operation',
    answerFormat: 'mcq-4',
    variables: [
      { name: 'a', kind: 'int', min: 1, max: 9 },
      { name: 'b', kind: 'int', min: 1, max: 9 },
      { name: 'sum', kind: 'calc', expr: 'a + b' },
      { name: 'pic', kind: 'svg', themeIds: ['fruits'] },
      { name: 'thing', kind: 'pick', values: ['apples', 'mangoes'] },
    ],
    constraints: ['a > b'],
    rows: [
      { id: 'r1', blocks: [{ id: 'b1', type: 'text', span: 12, props: { text: 'Ravi has {{a}} {{thing}} and gets {{b}} more. How many now?', size: 'md', bold: false, align: 'left' } }] },
      { id: 'r2', blocks: [
        { id: 'b2', type: 'picture', span: 6, props: { svgVar: 'pic', count: '{{a}}', size: 'sm', perRow: 5 } },
        { id: 'b3', type: 'picture', span: 6, props: { svgVar: 'pic', count: '{{b}}', size: 'sm', perRow: 5 } },
      ] },
      { id: 'r3', blocks: [{ id: 'b4', type: 'mcq', span: 12, props: { answer: '{{sum}}', distractors: [], optionCount: 4, layout: 'inline' } }] },
    ],
    status: 'approved',
    createdBy: 'u', createdByEmail: 'u@x', createdAt: '', updatedAt: '', updatedByEmail: 'u@x', deletedAt: null,
    ...over,
  };
}

test('expressions: arithmetic, precedence, comparisons and functions', () => {
  const s = { a: 7, b: 3, w: 'apples' };
  assert.equal(evaluate('a + b * 2', s), 13);
  assert.equal(evaluate('(a + b) * 2', s), 20);
  assert.equal(evaluate('a > b && b >= 3', s), 1);
  assert.equal(evaluate('max(a, b, 10) - abs(-2)', s), 8);
  assert.equal(evaluate('w', s), 'apples');
  assert.equal(evaluate('w == w', s), 1);
  assert.equal(fill('{{a}} + {{b}} = {{a + b}}', s), '7 + 3 = 10');
  assert.equal(fill('{{a / 2}}', s), '3.5');
});

test('expressions: nothing outside the grammar runs', () => {
  for (const bad of ['process.exit()', 'a; b', 'constructor', 'a[0]', 'require("fs")', '`x`', 'c + 1', '1 / 0', 'foo(1)']) {
    assert.throws(() => evaluate(bad, { a: 1, b: 2 }), ExpressionError, bad);
  }
});

test('same template and seed give the same question and key; another seed changes it', () => {
  const t = template();
  const one = resolveLayout(t, 'seed-1');
  assert.deepEqual(resolveLayout(t, 'seed-1'), one);
  const others = ['seed-2', 'seed-3', 'seed-4', 'seed-5'].map(s => resolveLayout(t, s).plainText);
  assert.ok(others.some(p => p !== one.plainText));
});

test('constraints always hold and the MCQ key letter points at the right answer', () => {
  const t = template();
  for (let i = 0; i < 100; i++) {
    const r = resolveLayout(t, `s${i}`);
    const a = Number(r.values.a), b = Number(r.values.b);
    assert.ok(a > b, 'a > b');
    const mcq = r.rows[2].blocks[0];
    assert.equal(mcq.type, 'mcq');
    if (mcq.type !== 'mcq') continue;
    assert.equal(mcq.options.length, 4);
    assert.equal(new Set(mcq.options).size, 4, 'options are distinct');
    const idx = r.answers[0].charCodeAt(0) - 65;
    assert.equal(mcq.options[idx], String(a + b));
    assert.equal(r.answerType, 'choice');
    assert.deepEqual(r.choices, mcq.options);
    const pics = r.rows[1].blocks;
    assert.equal(pics[0].type === 'picture' && pics[0].count, a);
    assert.ok(pics[0].type === 'picture' && pics[0].svg, 'picture markup is loaded for preview');
    assert.ok(pics[0].type === 'picture' && pics[1].type === 'picture' && pics[0].variant?.file === pics[1].variant?.file, 'both groups show the same picture');
  }
});

test('answer keys for true/false, fill in the blanks, match and arrange', () => {
  const t = template({
    answerFormat: 'fill-blanks',
    variables: [{ name: 'a', kind: 'int', min: 2, max: 5 }, { name: 'b', kind: 'int', min: 6, max: 9 }],
    constraints: [],
    rows: [
      { id: 'r1', blocks: [{ id: 't', type: 'trueFalse', span: 12, props: { statement: '{{a}} is less than {{b}}', truth: 'a < b' } }] },
      { id: 'r2', blocks: [{ id: 'f', type: 'fillBlank', span: 12, props: { text: '{{a}} + __ = {{a + b}}', answers: ['{{b}}'] } }] },
      { id: 'r3', blocks: [{ id: 'm', type: 'match', span: 12, props: { pairs: [{ left: '{{a}}', right: 'small' }, { left: '{{b}}', right: 'big' }] } }] },
      { id: 'r4', blocks: [{ id: 'o', type: 'arrange', span: 12, props: { items: ['{{b}}', '{{a}}', '{{a + b}}'], order: 'asc' } }] },
    ],
  });
  const r = resolveLayout(t, 'k');
  const a = Number(r.values.a), b = Number(r.values.b);
  assert.equal(r.answers[0], 'True');
  assert.equal(r.answers[1], String(b));
  const m = r.rows[2].blocks[0];
  assert.ok(m.type === 'match');
  if (m.type === 'match') {
    // "1-X": left item 1 pairs with the right item at letter X.
    assert.equal(m.right[r.answers[2].split(', ')[0].charCodeAt(2) - 65], 'small');
  }
  assert.equal(r.answers[3], [a, b, a + b].join(', '));
});

test('nearby distractors are distinct, never negative and never the answer', () => {
  const rng = createRng('x');
  for (const ans of ['0', '1', '5', '100']) {
    const d = nearbyDistractors(ans, 3, rng);
    assert.equal(d.length, 3);
    assert.ok(!d.includes(ans));
    assert.ok(d.every(x => Number(x) >= 0));
    assert.equal(new Set(d).size, 3);
  }
});

test('validation explains what to fix', () => {
  assert.deepEqual(validateLayoutTemplate(template()), []);
  const errs = (o: Partial<LayoutTemplate>) => validateLayoutTemplate(template(o)).join(' | ');
  assert.match(errs({ rows: [] }), /at least one row/);
  assert.match(errs({ constraints: ['a > 100'] }), /No values satisfied/);
  assert.match(errs({ variables: [{ name: 'a', kind: 'int', min: 9, max: 1 }] }), /min is bigger than max/);
  assert.match(errs({ variables: [{ name: 'pic', kind: 'svg', themeIds: ['no-such-theme'] }] }), /unknown picture theme/);
  assert.match(errs({ rows: [{ id: 'r', blocks: [{ id: 'x', type: 'text', span: 12, props: { text: 'hi', size: 'md', bold: false, align: 'left' } }] }] }), /Add a block the child answers in/);
  assert.match(errs({ rows: [{ id: 'r', blocks: [
    { id: 'x', type: 'answerBox', span: 8, props: { label: '', answer: '1', boxes: 1 } },
    { id: 'y', type: 'answerBox', span: 8, props: { label: '', answer: '1', boxes: 1 } },
  ] }] }), /wider than the page/);
  assert.match(errs({ rows: [{ id: 'r', blocks: [{ id: 'x', type: 'answerBox', span: 12, props: { label: '', answer: '{{zzz}}', boxes: 1 } }] }] }), /Unknown variable "zzz"/);
});

test('stored questions keep a picture file reference, not the markup', () => {
  const stored = stripPreviewMarkup(resolveLayout(template(), 'p'));
  const pic = stored.rows[1].blocks[0];
  assert.ok(pic.type === 'picture' && pic.svg === null && pic.variant?.file);
});

test('PDF: measured height equals drawn height, and every block type draws', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { fontFor: (_t: string, b?: boolean) => (b ? bold : font) };
  const page = doc.addPage([595, 842]);
  const all = template({
    rows: [
      ...template().rows,
      { id: 'r9', blocks: [
        { id: 'n', type: 'number', span: 3, props: { value: '{{a}}', boxed: true, size: 'lg' } },
        { id: 'ab', type: 'answerBox', span: 5, props: { label: 'Answer:', answer: '{{sum}}', boxes: 2 } },
        { id: 'tf', type: 'trueFalse', span: 4, props: { statement: '{{a}} > {{b}}', truth: 'a > b' } },
      ] },
      { id: 'r10', blocks: [{ id: 'd', type: 'divider', span: 12, props: {} as any }] },
      { id: 'r11', blocks: [{ id: 'sp', type: 'spacer', span: 12, props: { height: 5 } }] },
      { id: 'r12', blocks: [
        { id: 'fb', type: 'fillBlank', span: 6, props: { text: '{{a}} + __ = {{sum}}', answers: ['{{b}}'] } },
        { id: 'ar', type: 'arrange', span: 6, props: { items: ['{{a}}', '{{b}}', '{{sum}}'], order: 'desc' } },
      ] },
      { id: 'r13', blocks: [{ id: 'mt', type: 'match', span: 12, props: { pairs: [{ left: '{{a}}', right: 'x' }, { left: '{{b}}', right: 'y' }] } }] },
    ],
  });
  const layout = stripPreviewMarkup(resolveLayout(all, 'pdf'));
  const measured = measureLayout(layout, 495, fonts);
  const drawn = drawLayout(page, layout, 50, 780, 495, fonts);
  assert.ok(measured > 100);
  assert.equal(Math.round(drawn * 100), Math.round(measured * 100));
  const bytes = await doc.save();
  assert.ok(bytes.length > 2000);
});
