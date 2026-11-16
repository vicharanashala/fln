import { ANSWER_TYPES } from '../types/questionTemplateParams';

export const MIN_FONT_SIZE_PT = 18;
/**
 * A child of five or six has to be able to write a digit or a letter in the box.
 * 58 pt is about 20 mm (78 px), the size the Balvatika worksheet review settled on:
 * a smaller box is decorative, not usable. (It was 24 pt until #603's first value
 * was checked against a printed sheet.)
 */
export const MIN_ANSWER_BOX_HEIGHT_PT = 58;
export const QUESTIONS_PER_PAGE_MAX = 4;

/**
 * What happens when the content does not fit (#603).
 *
 * The fixed minimums above always win. The page count is the only thing that
 * flexes: a question that does not fit in the space left moves to the next
 * page. Text is never shrunk below `MIN_FONT_SIZE_PT`, the answer box is never
 * made smaller than `MIN_ANSWER_BOX_HEIGHT_PT`, and a question is never cut.
 * A single question taller than a whole page is the one case that cannot be
 * helped by adding pages; it is placed alone on its own page, not dropped.
 */
export const OVERFLOW_POLICY = {
  minimumsWin: true,
  pageCountFlexes: true,
  shrinkToFit: false,
  truncateContent: false,
} as const;

/** Space kept free at the bottom of a page for the footer line. */
export const PAGE_BOTTOM_MARGIN_PT = 60;
/** Vertical gap between one question block and the next. */
export const QUESTION_GAP_PT = 30;

/**
 * Group question blocks into pages. `blockHeights[i]` is the height of block i
 * (its wrapped text plus its answer box). A block moves to a new page when the
 * page already holds `maxPerPage` blocks, or when it would not fit in the
 * height left. Returns, per page, the indexes of the blocks on it.
 */
export function planQuestionPages(
  blockHeights: number[],
  opts: { maxPerPage: number; availableHeight: number; gap: number },
): number[][] {
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;
  blockHeights.forEach((height, index) => {
    const fits = used + height <= opts.availableHeight;
    if (current.length > 0 && (current.length >= opts.maxPerPage || !fits)) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(index);
    used += height + opts.gap;
  });
  if (current.length > 0) pages.push(current);
  return pages;
}

/**
 * How much answer space each answer type gets (#590), defined here once and
 * read by every renderer rather than copied into each template.
 *
 *   box         a framed area to write or draw in
 *   line        a ruled line to write on (blanks to fill)
 *   true-false  two labelled boxes, True and False
 *   none        nothing drawn: the options themselves are printed, and the
 *               child circles one; only a little room is kept after them
 *
 * Every drawn box is at least `MIN_ANSWER_BOX_HEIGHT_PT` tall.
 */
export type AnswerSpaceStyle = 'box' | 'line' | 'true-false' | 'none';
export interface AnswerSpaceRule {
  style: AnswerSpaceStyle;
  widthPt: number;
  heightPt: number;
  dashed?: boolean;
}

export const ANSWER_SPACE_RULES: Readonly<Record<(typeof ANSWER_TYPES)[number], AnswerSpaceRule>> = {
  'single-number': { style: 'box', widthPt: 150, heightPt: MIN_ANSWER_BOX_HEIGHT_PT },
  'mcq-4':         { style: 'none', widthPt: 0, heightPt: 12 },
  'fill-blanks':   { style: 'line', widthPt: 330, heightPt: MIN_ANSWER_BOX_HEIGHT_PT },
  'true-false':    { style: 'true-false', widthPt: 230, heightPt: MIN_ANSWER_BOX_HEIGHT_PT },
  'matching':      { style: 'box', widthPt: 420, heightPt: 96 },
  'trace':         { style: 'box', widthPt: 420, heightPt: 120, dashed: true },
};

/** Used for a question whose template names no answer type (or one not listed). */
export const DEFAULT_ANSWER_TYPE: (typeof ANSWER_TYPES)[number] = 'single-number';

export function answerSpaceFor(answerType: string | null | undefined): AnswerSpaceRule {
  const known = typeof answerType === 'string' && Object.prototype.hasOwnProperty.call(ANSWER_SPACE_RULES, answerType);
  return ANSWER_SPACE_RULES[known ? (answerType as (typeof ANSWER_TYPES)[number]) : DEFAULT_ANSWER_TYPE];
}

/**
 * Extra room kept on every side of a printed picture when the child answers by
 * circling it, so a pencil loop around one object does not run into its
 * neighbours. Applied only when the artwork's theme lists 'circle' in
 * `supportedAnswerShapes`.
 */
export const CIRCLE_PADDING_PT = 12;

/** Does this theme's artwork support being circled? Reads `supportedAnswerShapes`. */
export function themeSupportsCircling(supportedAnswerShapes: readonly string[] | undefined): boolean {
  return Array.isArray(supportedAnswerShapes) && supportedAnswerShapes.includes('circle');
}
