// Layout templates: how one question for a level looks on paper.
//
// A `QuestionTemplate` (curriculum.types.ts) says WHAT a question asks: the
// concept, the number range, the operation. Until this file existed, HOW that
// question looked on a printed sheet was hard-coded per question family in
// services/questionTemplateRenderer.ts, so changing the look of one level meant
// a code change and a deploy.
//
// A layout template is the Superadmin-authored answer to "how should this
// level's question look": rows of blocks (text, numbers, pictures, answer
// boxes, MCQ options, match pairs...) whose values come from named variables
// drawn with a seeded RNG. The same template + seed always produces the same
// question and the same answer key, which is what ICR marking relies on.
//
// Idea taken from hegdev13/fln-template-maker (rows on a 12-column grid,
// placeholders filled by a seeded `resolveData`), reshaped around FLN's own
// question families and answer types rather than copied.

import type { QuestionFamily } from './questionTemplateParams';

/** Answer shapes a layout can produce. Mirrors ANSWER_TYPES in questionTemplateParams.ts. */
export const LAYOUT_ANSWER_FORMATS = [
  'single-number', 'mcq-4', 'fill-blanks', 'true-false', 'matching', 'arrange', 'observed',
] as const;
export type LayoutAnswerFormat = (typeof LAYOUT_ANSWER_FORMATS)[number];

export const LAYOUT_STATUSES = ['draft', 'approved'] as const;
export type LayoutStatus = (typeof LAYOUT_STATUSES)[number];

// ---------------------------------------------------------------- variables

/** A random whole number in [min, max], optionally skipping some values. */
export interface IntVariable { name: string; kind: 'int'; min: number; max: number; exclude?: number[] }
/** A value computed from earlier variables, e.g. `a + b`. */
export interface CalcVariable { name: string; kind: 'calc'; expr: string }
/** One word or value picked from a list, e.g. apples / mangoes / bananas. */
export interface PickVariable { name: string; kind: 'pick'; values: string[] }
/** A picture drawn from one of the SVG themes in the asset manifest. */
export interface SvgVariable { name: string; kind: 'svg'; themeIds: string[] }

export type LayoutVariable = IntVariable | CalcVariable | PickVariable | SvgVariable;
export const VARIABLE_KINDS = ['int', 'calc', 'pick', 'svg'] as const;

// ---------------------------------------------------------------- blocks

/**
 * Every string prop may contain `{{expr}}` placeholders, where expr is a
 * variable name or arithmetic over variables (`{{a + b}}`).
 */
export interface TextBlockProps { text: string; size: 'sm' | 'md' | 'lg'; bold: boolean; align: 'left' | 'center' | 'right' }
export interface NumberBlockProps { value: string; boxed: boolean; size: 'md' | 'lg' }
/** Draws the picture held by an svg variable `count` times (count may be a placeholder). */
export interface PictureBlockProps { svgVar: string; count: string; size: 'sm' | 'md' | 'lg'; perRow: number }
/** Empty boxes the child writes into. `answer` goes into the answer key, never onto the sheet. */
export interface AnswerBoxBlockProps { label: string; answer: string; boxes: number }
/** Options lettered A-D. `distractors` empty = generated near the answer. */
export interface McqBlockProps { answer: string; distractors: string[]; optionCount: 3 | 4; layout: 'inline' | 'stacked' }
/** `truth` is an expression; when it is non-zero the statement is true. */
export interface TrueFalseBlockProps { statement: string; truth: string }
export interface MatchBlockProps { pairs: { left: string; right: string }[] }
/** `__` in `text` marks a blank; `answers[i]` fills blank i. */
export interface FillBlankBlockProps { text: string; answers: string[] }
export interface ArrangeBlockProps { items: string[]; order: 'asc' | 'desc' }
export interface SpacerBlockProps { height: number }
export type DividerBlockProps = Record<string, never>;

export interface BlockPropsByType {
  text: TextBlockProps;
  number: NumberBlockProps;
  picture: PictureBlockProps;
  answerBox: AnswerBoxBlockProps;
  mcq: McqBlockProps;
  trueFalse: TrueFalseBlockProps;
  match: MatchBlockProps;
  fillBlank: FillBlankBlockProps;
  arrange: ArrangeBlockProps;
  spacer: SpacerBlockProps;
  divider: DividerBlockProps;
}
export type LayoutBlockType = keyof BlockPropsByType;
export const LAYOUT_BLOCK_TYPES = [
  'text', 'number', 'picture', 'answerBox', 'mcq', 'trueFalse', 'match', 'fillBlank', 'arrange', 'spacer', 'divider',
] as const satisfies readonly LayoutBlockType[];

/** Blocks that put something into the answer key. */
export const ANSWER_BLOCK_TYPES: readonly LayoutBlockType[] = ['answerBox', 'mcq', 'trueFalse', 'match', 'fillBlank', 'arrange'];

export interface LayoutBlock<T extends LayoutBlockType = LayoutBlockType> {
  id: string;
  type: T;
  /** Width in twelfths of the row. A row's spans must add up to 12 or less. */
  span: number;
  props: BlockPropsByType[T];
}

export interface LayoutRow { id: string; blocks: LayoutBlock[] }

export interface LayoutTemplate {
  id: string;
  name: string;
  /** Durable identity of the level (e.g. "S3.4"); level numbers can be renumbered. */
  conceptId: string;
  /** Display alias, recomputed from conceptId on write. */
  levelNumber: number;
  levelName: string;
  questionFamily: QuestionFamily;
  answerFormat: LayoutAnswerFormat;
  variables: LayoutVariable[];
  /** Expressions that must all be true, e.g. `a > b` so subtraction never goes negative. */
  constraints: string[];
  rows: LayoutRow[];
  /** Only approved layouts are used for real worksheets. */
  status: LayoutStatus;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedByEmail: string;
  /** Soft delete: a printed paper may already cite this id. */
  deletedAt: string | null;
}

// ---------------------------------------------------------------- resolved output

/** A block with every placeholder replaced. This is what the preview and the PDF draw. */
export type ResolvedBlock =
  | { type: 'text'; span: number; text: string; size: TextBlockProps['size']; bold: boolean; align: TextBlockProps['align'] }
  | { type: 'number'; span: number; value: string; boxed: boolean; size: NumberBlockProps['size'] }
  | {
      type: 'picture'; span: number; themeId: string | null; count: number; size: PictureBlockProps['size']; perRow: number;
      /** Which manifest file to draw. Kept on stored questions instead of the markup itself. */
      variant: { variantId: string; file: string } | null;
      /** SVG markup, filled for the builder preview only and stripped before a question is stored. */
      svg: string | null;
    }
  | { type: 'answerBox'; span: number; label: string; boxes: number }
  | { type: 'mcq'; span: number; options: string[]; layout: McqBlockProps['layout'] }
  | { type: 'trueFalse'; span: number; statement: string }
  | { type: 'match'; span: number; left: string[]; right: string[] }
  | { type: 'fillBlank'; span: number; parts: string[] }
  | { type: 'arrange'; span: number; items: string[]; order: ArrangeBlockProps['order'] }
  | { type: 'spacer'; span: number; height: number }
  | { type: 'divider'; span: number };

export interface ResolvedRow { blocks: ResolvedBlock[] }

export interface ResolvedLayout {
  templateId: string;
  seed: string;
  rows: ResolvedRow[];
  /** One entry per answer-bearing block, in reading order. */
  answers: string[];
  /** The values every variable took, for the preview and for debugging a reprint. */
  values: Record<string, string | number>;
  /** Plain-text version of the question, for screens and paths that cannot draw a layout. */
  plainText: string;
  /** Choices when the layout has exactly one MCQ block. */
  choices?: string[];
  answerType: 'text' | 'number' | 'choice';
}
