// Example layouts to start from, one per common question shape. The author
// still picks the level; nothing here is saved until they press Save.
import type { LayoutTemplate } from './types';

const base = { conceptId: '', constraints: [] as string[], status: 'draft' as const };

export const STARTERS: LayoutTemplate[] = [
  {
    ...base,
    name: 'Count the pictures',
    questionFamily: 'counting',
    answerFormat: 'single-number',
    variables: [
      { name: 'n', kind: 'int', min: 1, max: 9 },
      { name: 'pic', kind: 'svg', themeIds: ['fruits', 'animals', 'vehicles'] },
    ],
    rows: [
      { id: 'r1', blocks: [{ id: 'b1', type: 'text', span: 12, props: { text: 'Count and write how many.', size: 'md', bold: true, align: 'left' } }] },
      { id: 'r2', blocks: [
        { id: 'b2', type: 'picture', span: 8, props: { svgVar: 'pic', count: '{{n}}', size: 'md', perRow: 5 } },
        { id: 'b3', type: 'answerBox', span: 4, props: { label: '', answer: '{{n}}', boxes: 1 } },
      ] },
    ],
  },
  {
    ...base,
    name: 'Add two groups (multiple choice)',
    questionFamily: 'operation',
    answerFormat: 'mcq-4',
    variables: [
      { name: 'a', kind: 'int', min: 1, max: 5 },
      { name: 'b', kind: 'int', min: 1, max: 4 },
      { name: 'sum', kind: 'calc', expr: 'a + b' },
      { name: 'pic', kind: 'svg', themeIds: ['fruits'] },
    ],
    rows: [
      { id: 'r1', blocks: [{ id: 'b1', type: 'text', span: 12, props: { text: 'How many in all? {{a}} + {{b}} = ?', size: 'md', bold: true, align: 'left' } }] },
      { id: 'r2', blocks: [
        { id: 'b2', type: 'picture', span: 5, props: { svgVar: 'pic', count: '{{a}}', size: 'sm', perRow: 5 } },
        { id: 'b3', type: 'text', span: 2, props: { text: '+', size: 'lg', bold: true, align: 'center' } },
        { id: 'b4', type: 'picture', span: 5, props: { svgVar: 'pic', count: '{{b}}', size: 'sm', perRow: 5 } },
      ] },
      { id: 'r3', blocks: [{ id: 'b5', type: 'mcq', span: 12, props: { answer: '{{sum}}', distractors: [], optionCount: 4, layout: 'inline' } }] },
    ],
  },
  {
    ...base,
    name: 'Subtract without going below zero',
    questionFamily: 'operation',
    answerFormat: 'fill-blanks',
    variables: [
      { name: 'a', kind: 'int', min: 5, max: 20 },
      { name: 'b', kind: 'int', min: 1, max: 9 },
    ],
    constraints: ['a > b'],
    rows: [
      { id: 'r1', blocks: [{ id: 'b1', type: 'text', span: 12, props: { text: 'Fill in the blank.', size: 'md', bold: true, align: 'left' } }] },
      { id: 'r2', blocks: [{ id: 'b2', type: 'fillBlank', span: 12, props: { text: '{{a}} − {{b}} = __', answers: ['{{a - b}}'] } }] },
    ],
  },
  {
    ...base,
    name: 'Which is bigger? (true / false)',
    questionFamily: 'comparison',
    answerFormat: 'true-false',
    variables: [
      { name: 'a', kind: 'int', min: 10, max: 99 },
      { name: 'b', kind: 'int', min: 10, max: 99 },
    ],
    constraints: ['a != b'],
    rows: [
      { id: 'r1', blocks: [
        { id: 'b1', type: 'number', span: 3, props: { value: '{{a}}', boxed: true, size: 'lg' } },
        { id: 'b2', type: 'number', span: 3, props: { value: '{{b}}', boxed: true, size: 'lg' } },
      ] },
      { id: 'r2', blocks: [{ id: 'b3', type: 'trueFalse', span: 12, props: { statement: '{{a}} is bigger than {{b}}.', truth: 'a > b' } }] },
    ],
  },
  {
    ...base,
    name: 'Put numbers in order',
    questionFamily: 'sequencing',
    answerFormat: 'arrange',
    variables: [
      { name: 'a', kind: 'int', min: 1, max: 50 },
      { name: 'b', kind: 'int', min: 1, max: 50 },
      { name: 'c', kind: 'int', min: 1, max: 50 },
      { name: 'd', kind: 'int', min: 1, max: 50 },
    ],
    constraints: ['a != b && a != c && a != d && b != c && b != d && c != d'],
    rows: [
      { id: 'r1', blocks: [{ id: 'b1', type: 'text', span: 12, props: { text: 'Write these numbers from smallest to biggest.', size: 'md', bold: true, align: 'left' } }] },
      { id: 'r2', blocks: [{ id: 'b2', type: 'arrange', span: 12, props: { items: ['{{a}}', '{{b}}', '{{c}}', '{{d}}'], order: 'asc' } }] },
    ],
  },
];
