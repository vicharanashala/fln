/**
 * Builds worksheet questions from a level's approved layout templates
 * (Template Builder). Tried before the intent-based `questionTemplates`
 * renderer: a layout is the most specific thing a Superadmin can author for a
 * level, so when one exists and is approved it decides how the question looks.
 *
 * Returns [] when the concept has no approved layout (or the store cannot be
 * read), which is the caller's signal to fall through to the next source —
 * a level nobody has built a layout for must still produce a paper.
 */

import { randomUUID } from 'crypto';
import { dbStore, type Question } from '../db';
import { getLevelForConcept } from '../config/curriculumMap';
import type { LayoutTemplate, ResolvedLayout } from '../types/layoutTemplate';
import { resolveLayout } from './layoutTemplateEngine';

/** Drop preview-only SVG markup so a stored question carries a file reference, not kilobytes of markup. */
export function stripPreviewMarkup(layout: ResolvedLayout): ResolvedLayout {
  return {
    ...layout,
    rows: layout.rows.map(r => ({
      blocks: r.blocks.map(b => (b.type === 'picture' ? { ...b, svg: null } : b)),
    })),
  };
}

export async function generateQuestionsFromLayouts(
  conceptId: string,
  opts: { count: number; levelNumber: number; subLevel: number },
): Promise<Question[]> {
  let layouts: LayoutTemplate[] = [];
  try {
    layouts = await dbStore.getApprovedLayoutTemplatesByConcept(conceptId);
  } catch (err: any) {
    console.warn(`[layoutTemplates] could not read layouts for ${conceptId}: ${err?.message || err}`);
    return [];
  }
  if (layouts.length === 0) return [];
  // Observed-only layouts belong on the teacher's sheet, never on a child's worksheet.
  layouts = layouts.filter(l => l.answerFormat !== 'observed');
  if (layouts.length === 0) return [];

  const concept = getLevelForConcept(conceptId);
  const strand = concept?.strand ?? 'Number Sense';
  const difficulty: Question['difficulty'] = opts.subLevel === 2 ? 'easy' : opts.subLevel === 1 ? 'medium' : 'hard';

  const questions: Question[] = [];
  const seen = new Set<string>();
  const maxAttempts = opts.count * 8;
  for (let attempt = 0, cursor = 0; questions.length < opts.count && attempt < maxAttempts; attempt++, cursor++) {
    const layout = layouts[cursor % layouts.length];
    let resolved: ResolvedLayout;
    try {
      resolved = resolveLayout(layout, randomUUID());
    } catch (err: any) {
      // A layout that validated on save can still fail on a rare draw; skip that draw, not the paper.
      console.warn(`[layoutTemplates] ${layout.id} failed to resolve: ${err?.message || err}`);
      continue;
    }
    // A paper must not carry the same question twice (#760).
    if (seen.has(resolved.plainText)) continue;
    seen.add(resolved.plainText);

    questions.push({
      question_id: `${conceptId}_Q${questions.length + 1}`,
      question: resolved.plainText,
      answer: resolved.answers.join(' | '),
      answer_type: resolved.answerType,
      choices: resolved.choices,
      topic: strand,
      subtopic: layout.name || layout.questionFamily,
      difficulty,
      source_level: opts.levelNumber,
      conceptId,
      layout: stripPreviewMarkup(resolved),
    });
  }

  if (questions.length < opts.count) {
    console.warn(`[layoutTemplates] ${conceptId} produced ${questions.length} distinct question(s), wanted ${opts.count}.`);
  }
  return questions;
}
