/**
 * worksheetContent.ts -- resolve a teacher's concept selection into concrete
 * question instances for a Balvatika-style concept worksheet.
 *
 * Issue #600: skill selection and question authoring have lived as two
 * disconnected features. This module is the seam between them: a caller
 * passes the concepts the teacher picked, plus a count of questions per
 * concept, and gets back a fully-resolved bundle of question instances
 * (template + artwork variant + per-instance seed) ready for the renderer
 * (#602) to lay out on a page.
 *
 * Design choices worth noting:
 *  - This module reads `QuestionTemplate` rows. The legacy `questionService.ts`
 *    reads `Question` rows generated from a level-based rule instead. Both
 *    pipelines coexist; this one is the authoring-driven path.
 *  - `pickVariant(themeId, seed)` is reused verbatim from `svgAssetCatalog.ts`
 *    so regeneration is deterministic -- a child who is re-issued the same
 *    paper sees the same artwork, which also keeps the ICR scanner happy.
 *  - `questionsPerConcept` is a caller parameter. The mastery/question-count
 *    number is still an open decision; threading it through here means that
 *    decision lives in one place rather than scattered across routes.
 *  - Templates whose `svgThemeIds` is empty get a null variant. The renderer
 *    decides what to do with that (some families -- e.g. vocabulary,
 *    reasoning -- are text-only by design and need no artwork).
 */

import { dbStore, QuestionTemplate } from '../db';
import { pickVariant, SvgThemeVariant, isKnownThemeId } from '../svgAssetCatalog';

/**
 * One concrete question instance: a QuestionTemplate plus the artwork
 * variant (if any) the renderer should draw with. The `seed` is what made
 * the variant choice deterministic; the renderer echoes it so the same
 * seed re-renders the same artwork on the printed page.
 */
export interface ResolvedQuestion {
  template: QuestionTemplate;
  /** First svgThemeIds entry, resolved to a manifest variant. Null when the
   * template carries no artwork (text-only families) or the theme id is
   * unknown to the manifest. The renderer handles both. */
  artwork: SvgThemeVariant | null;
  /** Seed used to pick the variant. The renderer MUST echo this so a
   * regenerated worksheet picks the same artwork. */
  seed: string;
}

/**
 * One concept's bundle of resolved questions.
 */
export interface ResolvedConcept {
  conceptId: string;
  questions: ResolvedQuestion[];
}

/**
 * Bundle returned by resolveWorksheetContent().
 */
export interface ResolvedWorksheetContent {
  concepts: ResolvedConcept[];
  /** Total question count across every concept. Convenient for the renderer's
   * page-budget math (#603's QUESTIONS_PER_PAGE_MAX). */
  totalQuestions: number;
}

/**
 * Resolve `conceptIds` into concrete question instances.
 *
 * For each concept: read all matching QuestionTemplate rows (live, non-deleted),
 * filter out templates whose `assessmentMode` is `'observed'`-only (those route
 * to the teacher-observation flow, not the worksheet), take up to
 * `questionsPerConcept` of them in stable order (sorted by template id for
 * reproducibility), and pick one SVG variant per template using a per-paper
 * seed.
 *
 * @param conceptIds      Concept IDs the teacher selected (e.g. ['S1.1', 'S3.4']).
 *                        Empty strings and duplicates are dropped silently.
 * @param questionsPerConcept  How many questions to pull per concept. Must be a
 *                        positive integer; the resolver does not invent a default
 *                        because the mastery/question-count decision is still open
 *                        (see issue #621 and follow-ups).
 * @param paperSeed      Stable seed for the WHOLE paper; the per-template
 *                        seed is derived as `${paperSeed}:${template.id}` so
 *                        variant choice is reproducible across regenerations.
 *                        When omitted, falls back to a timestamp, which is
 *                        fine for one-shot generations but breaks determinism.
 */
export async function resolveWorksheetContent(
  conceptIds: string[],
  questionsPerConcept: number,
  paperSeed?: string,
): Promise<ResolvedWorksheetContent> {
  if (!Number.isInteger(questionsPerConcept) || questionsPerConcept <= 0) {
    throw new Error(
      `resolveWorksheetContent: questionsPerConcept must be a positive integer, got ${questionsPerConcept}`,
    );
  }

  // De-duplicate and drop blanks; preserve caller order for stable output.
  const seen = new Set<string>();
  const dedupedIds: string[] = [];
  for (const raw of conceptIds) {
    const id = (raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    dedupedIds.push(id);
  }

  // Default seed: timestamp at call-time. Renderer MUST be told the seed
  // explicitly when reproducibility matters.
  const effectivePaperSeed = paperSeed ?? new Date().toISOString();

  const concepts: ResolvedConcept[] = [];
  let total = 0;

  for (const conceptId of dedupedIds) {
    const templates = await dbStore.getQuestionTemplatesByConcept(conceptId);

    // Filter out observed-only templates -- they belong on the teacher
    // observation sheet (#618), not the child worksheet. `'both'` is
    // allowed: the teacher may still pull it for written use, even though
    // #616's gate will surface it for Balvatika as well.
    const eligible = templates.filter(t => t.assessmentMode !== 'observed');

    // Stable order so the same (conceptIds, questionsPerConcept, paperSeed)
    // yields the same instances every time.
    eligible.sort((a, b) => a.id.localeCompare(b.id));

    const slice = eligible.slice(0, questionsPerConcept);
    const questions: ResolvedQuestion[] = slice.map((template) => {
      // Pick the first svgThemeId as the primary artwork source. The
      // QuestionTemplate field is plural so authors can offer alternatives,
      // but the resolver is single-artwork for now -- the renderer can
      // pick alternatives from the remaining svgThemeIds later if it
      // needs to. (Issue #602 will own that decision.)
      const primaryTheme = template.svgThemeIds[0];
      let artwork: SvgThemeVariant | null = null;
      if (primaryTheme && isKnownThemeId(primaryTheme)) {
        const variant = pickVariant(primaryTheme, `${effectivePaperSeed}:${template.id}`);
        if (variant) artwork = variant;
      }
      return {
        template,
        artwork,
        seed: `${effectivePaperSeed}:${template.id}`,
      };
    });

    concepts.push({ conceptId, questions });
    total += questions.length;
  }

  return { concepts, totalQuestions: total };
}