/**
 * worksheetLayoutRules.ts
 *
 * Fixed PDF layout minimums for Balvatika-appropriate print worksheets.
 *
 * These constants define the hard lower bounds that every worksheet renderer
 * must honour when producing printable PDFs. The core principle is:
 *
 *   **Minimum layout requirements always win; page count is the variable
 *   that flexes.**
 *
 * If content cannot fit on a single page at the required font size and
 * answer-box height, the renderer MUST add pages rather than shrink content
 * below these minimums. Content must never be silently truncated or dropped
 * to fit a page budget.
 *
 * --- Design rationale (Balvatika print rule) ---
 *
 * Worksheets target early-grade learners (Balvatika / NEP Stages 1–3,
 * ages 3–8) whose motor and visual skills require:
 *   - Large, clearly legible text (≥ 18 pt).
 *   - Generously sized answer spaces for handwriting.
 *   - Uncluttered pages — one concept-block per visual section.
 *   - No mid-question page breaks; each question block should use
 *     CSS `page-break-inside: avoid` (or the equivalent pdf-lib layout
 *     guard) so a question is never split across two pages.
 *
 * These rules are pure configuration. Runtime enforcement belongs in the
 * individual renderers (e.g. renderConceptWorksheet in #602) that import
 * and apply them.
 *
 * @see https://github.com/vicharanashala/fln/issues/603
 */

// ---------------------------------------------------------------------------
// Font size
// ---------------------------------------------------------------------------

/**
 * Absolute minimum font size (in PDF points) for any printed text on a
 * Balvatika worksheet. Renderers must not set body/question text smaller
 * than this value.
 *
 * Rationale: NEP early-grade print guidelines and classroom testing
 * indicate that 18 pt is the smallest size reliably readable by children
 * aged 5–8 on standard A4 worksheets.
 */
export const MIN_FONT_SIZE_PT = 18;

// ---------------------------------------------------------------------------
// Answer box dimensions
// ---------------------------------------------------------------------------

/**
 * Minimum height (in PDF points) of any answer-input box drawn on the
 * worksheet. This guarantees enough vertical space for a child's
 * handwritten response, even for tall characters, and ensures the boxes
 * remain scannable by the OCR/ICR evaluation pipeline.
 *
 * Current codebase reference: `paperGenerator.ts` draws answer boxes with
 * `height: 24` (line ~625). This constant formalises that value as the
 * enforced minimum.
 */
export const MIN_ANSWER_BOX_HEIGHT_PT = 24;

// ---------------------------------------------------------------------------
// Questions per page
// ---------------------------------------------------------------------------

/**
 * Maximum number of question blocks allowed on one physical A4 page.
 *
 * Repository evidence: Issue #594 specifies a hard maximum of 4 questions
 * per physical page for Balvatika worksheets. If spacing requirements mean
 * fewer than 4 questions fit safely, the renderer must use fewer questions
 * and continue onto another page rather than shrink or cram content.
 */
export const QUESTIONS_PER_PAGE_MAX = 4;

// ---------------------------------------------------------------------------
// Overflow / pagination policy
// ---------------------------------------------------------------------------

/**
 * Documents the overflow policy that renderers must follow when the
 * question set exceeds `QUESTIONS_PER_PAGE_MAX` or when content would
 * otherwise exceed the printable area of a single page.
 *
 * Rules (in priority order):
 *
 * 1. **Minimums always win.** `MIN_FONT_SIZE_PT` and
 *    `MIN_ANSWER_BOX_HEIGHT_PT` are non-negotiable lower bounds. Content
 *    must not be shrunk below the minimum readable/layout requirements to
 *    force a fit.
 *
 * 2. **Page count may increase.** If honouring the minimums means the
 *    content no longer fits on one page, the renderer adds pages. One
 *    extra page is acceptable and expected; the system prioritises
 *    readability over paper economy.
 *
 * 3. **Content must never be silently truncated.** Every assigned question
 *    must appear on the printed output. Dropping questions to fit a
 *    page-count target is a correctness bug, not a layout trade-off.
 *
 * 4. **Question blocks use `page-break-inside: avoid`.** A question
 *    (prompt + answer box) must not be split across two pages. If the
 *    remaining space on the current page is insufficient, the entire
 *    block moves to the next page.
 */
export const OVERFLOW_POLICY = {
  /** Minimum layout requirements always win over page-count targets. */
  minimumsAlwaysWin: true,

  /** The renderer may add pages to honour minimums. */
  pageCountMayIncrease: true,

  /** Assigned content must never be silently dropped or truncated. */
  contentNeverTruncated: true,

  /**
   * CSS rule (or equivalent pdf-lib guard) that prevents a question block
   * from being split across a page boundary.
   */
  questionBlockPageBreak: 'page-break-inside: avoid' as const,
} as const;

/**
 * TypeScript type for the overflow policy, available for renderers that
 * want to accept it as a parameter.
 */
export type OverflowPolicy = typeof OVERFLOW_POLICY;
