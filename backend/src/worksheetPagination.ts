import { getAnswerSpaceRule, AnswerSpaceRule } from './answerSpaceRules.js';
import { getPaperTypeConfig, PaperType } from './config/paperTypeConfig.js';

/** Maximum physical questions allowed on any single physical printed page (Issue #594) */
export const MAX_QUESTIONS_PER_PAGE = 4;

export const DEFAULT_PAGE_HEIGHT_MM = 297; // Standard A4 height in mm
export const DEFAULT_PAGE_WIDTH_MM = 210;  // Standard A4 width in mm
export const DEFAULT_MARGIN_TOP_MM = 14;
export const DEFAULT_MARGIN_BOTTOM_MM = 14;
export const DEFAULT_HEADER_HEIGHT_PAGE1_MM = 35;
export const DEFAULT_HEADER_HEIGHT_SUBSEQUENT_MM = 15;
export const DEFAULT_FOOTER_HEIGHT_MM = 10;
export const DEFAULT_BASE_QUESTION_CONTENT_HEIGHT_MM = 15;

export interface QuestionLayoutInput {
  id: string;
  answerType?: string;
  svgThemeId?: string;
  /** Custom measured total height in mm (overrides estimation if provided and > 0) */
  heightMm?: number;
  /** Custom question content text/prompt height in mm before answer space */
  contentHeightMm?: number;
  [key: string]: any;
}

export interface PaginationOptions {
  maxQuestionsPerPage?: number;
  pageHeightMm?: number;
  marginTopMm?: number;
  marginBottomMm?: number;
  headerHeightPage1Mm?: number;
  headerHeightSubsequentMm?: number;
  footerHeightMm?: number;
  baseQuestionContentHeightMm?: number;
  paperType?: PaperType | string;
}

export interface PageAssignment {
  pageNumber: number;
  questionIds: string[];
  totalHeightMm: number;
  questions: QuestionLayoutInput[];
}

export interface PaginationResult {
  totalPages: number;
  pages: PageAssignment[];
  questionPageMap: Record<string, number>;
  paperTypeConfig?: any;
}

/**
 * Calculates effective vertical layout height in mm for a given question input.
 * Consults answerSpaceRules for per-answerType box heights, padding, and bottom margins.
 */
export function getQuestionHeightMm(
  q: QuestionLayoutInput,
  options: PaginationOptions = {}
): number {
  if (typeof q.heightMm === 'number' && q.heightMm > 0) {
    return q.heightMm;
  }

  const baseContentH =
    q.contentHeightMm ?? options.baseQuestionContentHeightMm ?? DEFAULT_BASE_QUESTION_CONTENT_HEIGHT_MM;

  const answerType = q.answerType || 'single-number';
  const rule: AnswerSpaceRule = getAnswerSpaceRule(answerType, q.svgThemeId);

  const answerSpaceH = rule.boxHeightMm + (rule.minPaddingMm || 0) + (rule.marginBottomMm || 0);

  return baseContentH + answerSpaceH;
}

/**
 * Deterministically paginates an ordered list of questions.
 * Enforces:
 * 1. Hard maximum of 4 questions per physical page (MAX_QUESTIONS_PER_PAGE).
 * 2. Page height constraints (never split a question across page boundaries).
 * 3. Preservation of question ordering.
 * 4. Integration with paperTypeConfig question count source of truth.
 */
export function paginateQuestions(
  questions: QuestionLayoutInput[],
  options: PaginationOptions = {}
): PaginationResult {
  const maxQuestionsPerPage = options.maxQuestionsPerPage ?? MAX_QUESTIONS_PER_PAGE;
  const pageHeight = options.pageHeightMm ?? DEFAULT_PAGE_HEIGHT_MM;
  const marginTop = options.marginTopMm ?? DEFAULT_MARGIN_TOP_MM;
  const marginBottom = options.marginBottomMm ?? DEFAULT_MARGIN_BOTTOM_MM;
  const headerH1 = options.headerHeightPage1Mm ?? DEFAULT_HEADER_HEIGHT_PAGE1_MM;
  const headerHSub = options.headerHeightSubsequentMm ?? DEFAULT_HEADER_HEIGHT_SUBSEQUENT_MM;
  const footerH = options.footerHeightMm ?? DEFAULT_FOOTER_HEIGHT_MM;

  let paperConfig;
  if (options.paperType) {
    paperConfig = getPaperTypeConfig(options.paperType);
  }

  if (!questions || questions.length === 0) {
    return {
      totalPages: 0,
      pages: [],
      questionPageMap: {},
      paperTypeConfig: paperConfig,
    };
  }

  const pages: PageAssignment[] = [];
  let currentPageNum = 1;
  let currentQuestions: QuestionLayoutInput[] = [];
  let currentHeight = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qHeight = getQuestionHeightMm(q, options);

    const headerH = currentPageNum === 1 ? headerH1 : headerHSub;
    const maxUsableHeight = pageHeight - marginTop - marginBottom - headerH - footerH;

    const wouldExceedCount = currentQuestions.length >= maxQuestionsPerPage;
    const wouldExceedHeight = currentQuestions.length > 0 && currentHeight + qHeight > maxUsableHeight;

    if (wouldExceedCount || wouldExceedHeight) {
      pages.push({
        pageNumber: currentPageNum,
        questionIds: currentQuestions.map(item => item.id),
        totalHeightMm: currentHeight,
        questions: [...currentQuestions],
      });

      currentPageNum += 1;
      currentQuestions = [q];
      currentHeight = qHeight;
    } else {
      currentQuestions.push(q);
      currentHeight += qHeight;
    }
  }

  if (currentQuestions.length > 0) {
    pages.push({
      pageNumber: currentPageNum,
      questionIds: currentQuestions.map(item => item.id),
      totalHeightMm: currentHeight,
      questions: [...currentQuestions],
    });
  }

  const questionPageMap: Record<string, number> = {};
  for (const page of pages) {
    for (const q of page.questions) {
      questionPageMap[q.id] = page.pageNumber;
    }
  }

  return {
    totalPages: pages.length,
    pages,
    questionPageMap,
    paperTypeConfig: paperConfig,
  };
}

/**
 * Pure helper for DOM/canvas block slicing in browser PDF renderers.
 * Ensures blocks corresponding to questions/sections do not exceed max 4 questions per physical page.
 */
export function paginateDOMBlocks(
  blocks: Array<{ top: number; bottom: number; isQuestion?: boolean }>,
  pageHeightPx: number,
  maxQuestionsPerPage: number = MAX_QUESTIONS_PER_PAGE
): Array<{ startPx: number; endPx: number; questionCount: number }> {
  if (!blocks || blocks.length === 0) return [];

  const pages: Array<{ startPx: number; endPx: number; questionCount: number }> = [];
  let pageStartPx = blocks[0].top;
  let cursorPx = blocks[0].top;
  let qCountOnPage = 0;

  for (let i = 0; i < blocks.length; i++) {
    const blk = blocks[i];
    const isQ = Boolean(blk.isQuestion);
    const blkHeight = blk.bottom - blk.top;
    const usedPx = cursorPx - pageStartPx;

    const wouldExceedCount = isQ && qCountOnPage >= maxQuestionsPerPage;
    const wouldExceedHeight = usedPx > 0 && usedPx + blkHeight > pageHeightPx;

    if (wouldExceedCount || wouldExceedHeight) {
      pages.push({ startPx: pageStartPx, endPx: cursorPx, questionCount: qCountOnPage });
      pageStartPx = blk.top;
      cursorPx = blk.bottom;
      qCountOnPage = isQ ? 1 : 0;
    } else {
      cursorPx = blk.bottom;
      if (isQ) qCountOnPage++;
    }
  }

  if (cursorPx > pageStartPx || pages.length === 0) {
    pages.push({ startPx: pageStartPx, endPx: cursorPx, questionCount: qCountOnPage });
  }

  return pages;
}
