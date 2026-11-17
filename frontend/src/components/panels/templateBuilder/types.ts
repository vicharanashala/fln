// Shapes the Template Builder edits. They mirror backend/src/types/layoutTemplate.ts;
// the backend validates and resolves them, the browser only edits the JSON.

export type VariableKind = 'int' | 'calc' | 'pick' | 'svg';
export type LayoutVariable =
  | { name: string; kind: 'int'; min: number; max: number; exclude?: number[] }
  | { name: string; kind: 'calc'; expr: string }
  | { name: string; kind: 'pick'; values: string[] }
  | { name: string; kind: 'svg'; themeIds: string[] };

export type BlockType =
  | 'text' | 'number' | 'picture' | 'answerBox' | 'mcq' | 'trueFalse' | 'match' | 'fillBlank' | 'arrange' | 'spacer' | 'divider';

export interface LayoutBlock { id: string; type: BlockType; span: number; props: Record<string, any> }
export interface LayoutRow { id: string; blocks: LayoutBlock[] }

export interface LayoutTemplate {
  id?: string;
  name: string;
  conceptId: string;
  levelNumber?: number;
  levelName?: string;
  questionFamily: string;
  answerFormat: string;
  variables: LayoutVariable[];
  constraints: string[];
  rows: LayoutRow[];
  status: 'draft' | 'approved';
  updatedAt?: string;
  updatedByEmail?: string;
}

export type ResolvedBlock = { type: BlockType; span: number } & Record<string, any>;
export interface ResolvedLayout {
  rows: { blocks: ResolvedBlock[] }[];
  answers: string[];
  values: Record<string, string | number>;
  plainText: string;
  answerType: string;
}

export interface Catalog {
  levels: { levelNumber: number; levelName: string; conceptId: string; stage: number; strand: string }[];
  questionFamilies: string[];
  answerFormats: string[];
  svgThemes: { id: string; label: string; printSafe: boolean }[];
}

export const MAX_BLOCKS_PER_ROW = 4;

/** Palette entries, grouped the way an author thinks about a question. */
export const PALETTE: { group: string; items: { type: BlockType; label: string; hint: string }[] }[] = [
  {
    group: 'Show the child',
    items: [
      { type: 'text', label: 'Text', hint: 'Instruction or question, with {{placeholders}}' },
      { type: 'number', label: 'Number', hint: 'A big number, boxed or plain' },
      { type: 'picture', label: 'Pictures', hint: 'A picture repeated N times' },
    ],
  },
  {
    group: 'Child answers',
    items: [
      { type: 'answerBox', label: 'Answer box', hint: 'Empty boxes to write in' },
      { type: 'mcq', label: 'Multiple choice', hint: 'A–D options, wrong answers can be automatic' },
      { type: 'trueFalse', label: 'True / False', hint: 'A statement to mark' },
      { type: 'fillBlank', label: 'Fill in the blanks', hint: 'Use __ for each blank' },
      { type: 'match', label: 'Match the following', hint: 'Pairs, right side shuffled' },
      { type: 'arrange', label: 'Arrange in order', hint: 'Smallest to biggest or reverse' },
    ],
  },
  {
    group: 'Spacing',
    items: [
      { type: 'spacer', label: 'Space', hint: 'Empty space' },
      { type: 'divider', label: 'Line', hint: 'A horizontal line' },
    ],
  },
];

export const BLOCK_LABEL: Record<BlockType, string> = Object.fromEntries(
  PALETTE.flatMap(g => g.items.map(i => [i.type, i.label])),
) as Record<BlockType, string>;

export const ANSWER_BLOCKS: BlockType[] = ['answerBox', 'mcq', 'trueFalse', 'match', 'fillBlank', 'arrange'];

let counter = 0;
export function newId(prefix: string): string {
  counter++;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Sensible starting props for each block, using the first variables if there are any. */
export function defaultBlock(type: BlockType, variables: LayoutVariable[]): LayoutBlock {
  const nums = variables.filter(v => v.kind === 'int' || v.kind === 'calc').map(v => v.name);
  const first = nums[0] ?? 'a';
  const last = nums[nums.length - 1] ?? 'a';
  const pic = variables.find(v => v.kind === 'svg')?.name ?? '';
  const props: Record<BlockType, Record<string, any>> = {
    text: { text: 'Count and write the number.', size: 'md', bold: false, align: 'left' },
    number: { value: `{{${first}}}`, boxed: true, size: 'lg' },
    picture: { svgVar: pic, count: `{{${first}}}`, size: 'md', perRow: 5 },
    answerBox: { label: '', answer: `{{${last}}}`, boxes: 1 },
    mcq: { answer: `{{${last}}}`, distractors: [], optionCount: 4, layout: 'inline' },
    trueFalse: { statement: `{{${first}}} is bigger than 5`, truth: `${first} > 5` },
    match: { pairs: [{ left: `{{${first}}}`, right: '' }, { left: '', right: '' }] },
    fillBlank: { text: `{{${first}}} + __ = {{${last}}}`, answers: [''] },
    arrange: { items: [`{{${first}}}`, `{{${last}}}`], order: 'asc' },
    spacer: { height: 8 },
    divider: {},
  };
  const fullWidth: BlockType[] = ['text', 'mcq', 'match', 'fillBlank', 'arrange', 'divider', 'spacer', 'trueFalse'];
  return { id: newId('b'), type, span: fullWidth.includes(type) ? 12 : 6, props: props[type] };
}

export function emptyTemplate(): LayoutTemplate {
  return {
    name: '',
    conceptId: '',
    questionFamily: 'counting',
    answerFormat: 'single-number',
    variables: [
      { name: 'a', kind: 'int', min: 1, max: 9 },
    ],
    constraints: [],
    rows: [],
    status: 'draft',
  };
}

/** Free space left in a row, in twelfths. */
export function rowSpace(row: LayoutRow): number {
  return 12 - row.blocks.reduce((s, b) => s + b.span, 0);
}
