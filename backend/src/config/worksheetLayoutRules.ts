/**
 * worksheetLayoutRules.ts -- fixed PDF layout minimums for Balvatika print.
 *
 * Issue #603: PDF layout values (font size, answer-box height, spacing)
 * were hardcoded inline inside each generator function in
 * `backend/src/paperGenerator.ts` (e.g. the literal `size: 15`, `size: 10`
 * values around lines 630-645). The new Balvatika renderer
 * `renderConceptWorksheet()` (issue #602) and any future generator that
 * targets the year-before-Class-1 stage must read its minimums from here
 * so the print stays legible for a 3-6 year-old, and so changing the
 * minimums is a one-file edit, not a search-and-replace through every
 * generator.
 *
 * Design decisions, per the issue body and Research/fln_year_before_class1.md
 * \u00a74 / \u00a76.1.2(a) -- the NCF-FS rule that printed material for this age
 * must use large type, ample answer space, and never compress content to
 * fit a page:
 *
 *  - MIN_FONT_SIZE_PT = 18pt. A 3-year-old eye at arm's length cannot
 *    reliably read 12pt text. 18pt is the floor; generators may use more
 *    for headings / answer spaces.
 *  - MIN_ANSWER_BOX_HEIGHT_PT = 24pt. A pencil mark fits in ~10pt but a
 *    pre-writing scribble (the dominant answer shape for this stage)
 *    needs roughly 2.5x. Anything smaller pushes children to write on
 *    the question, not in the answer space.
 *  - QUESTIONS_PER_PAGE_MAX. A Balvatika page is full at this many
 *    questions; overflow adds a page (see OVERFLOW_POLICY).
 *  - OVERFLOW_POLICY. Encoded as a frozen object so the comment travels
 *    with the policy and isn't lost in a refactor.
 *
 * The constants are NOT contextually labeled "Balvatika" because the
 * underlying principle ("minimums win, pages flex") applies to any
 * printed worksheet -- the values may simply need to be tighter for
 * a different stage. New generators should consume these constants; do
 * not inline new literals in their render code.
 */

export const MIN_FONT_SIZE_PT = 18;

export const MIN_ANSWER_BOX_HEIGHT_PT = 24;

/**
 * Maximum number of questions on a single worksheet page.
 *
 * Once a generator hits this many, it MUST start a new page rather
 * than shrink the fonts or compress the answer boxes. The layout
 * rules are minimums -- content can shrink the page count (questions
 * get fewer rows) but never the per-item minimums.
 */
export const QUESTIONS_PER_PAGE_MAX = 6;

/**
 * Overflow policy. Frozen so a downstream caller can't mutate the
 * rule at runtime; if the rule needs to change, the version field
 * below must bump and consumers re-evaluated.
 *
 * \u201cMinimums win, pages flex.\u201d The fixed minimums above are non-negotiable
 * for Balvatika print; if a paper has more questions than fit on one
 * page at those minimums, the renderer starts a new page. The content
 * is never shrunk (smaller font, smaller answer box, tighter spacing)
 * to force a single-page fit.
 */
export const OVERFLOW_POLICY = Object.freeze({
  version: 'v1',
  rule: 'minimums-win-pages-flex',
  description:
    'Fixed minimums (MIN_FONT_SIZE_PT, MIN_ANSWER_BOX_HEIGHT_PT, page geometry) ' +
    'are non-negotiable. When content exceeds the page budget, the renderer ' +
    'starts a new page. Fonts, answer boxes, and spacing are never shrunk to ' +
    'force a single-page fit.',
  // Action the renderer takes when content exceeds QUESTIONS_PER_PAGE_MAX.
  onOverflow: 'page-break',
  // Whether the renderer is allowed to skip overflow policy for short
  // student-facing content. Kept false: the rule is the rule.
  allowShrinkForShortContent: false,
} as const);