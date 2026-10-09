import { randomUUID } from 'crypto';
import { dbStore, RemedialBlueprint, RemedialBlueprintStageItem, RemediationPlan } from '../db';
import { describeConcept } from '../competencyPrerequisites';

/**
 * Remedial Blueprint Service (Issue #677)
 *
 * Generates a three-stage remedial worksheet blueprint:
 * 1. Supported (worked) example: Worked example with step-by-step solution for the deepest gap concept.
 * 2. Focused practice items: Focused items for target concepts.
 * 3. Mixed / transfer item: Transfer/application question.
 *
 * Items from outside the approved question bank are flagged for teacher review (`isApprovedBank: false`, `flaggedForReview: true`).
 */
export async function generateRemedialBlueprint(
  plan: RemediationPlan,
  masteryState?: Record<string, string>
): Promise<RemedialBlueprint> {
  const qBankResult = await dbStore.getQuestionBank();
  const qBank: any[] = Array.isArray(qBankResult) ? qBankResult : (qBankResult?.items || []);

  const getApprovedOrFallback = (conceptId: string, itemType: 'example' | 'practice' | 'transfer'): RemedialBlueprintStageItem => {
    // Look for matching approved question bank entry
    const match = qBank.find(entry => entry.conceptId === conceptId || entry.id === conceptId);
    if (match) {
      return {
        questionId: match.id,
        conceptId,
        questionText: match.questionText || `Approved question for ${describeConcept(conceptId)}`,
        answer: match.answer || 'Approved Answer',
        isApprovedBank: true,
        flaggedForReview: false,
        stepByStepSolution: itemType === 'example' ? `Step 1: Identify ${describeConcept(conceptId)}. Step 2: Solve accurately.` : undefined
      };
    }

    // Generated / Unreviewed item from outside approved bank
    return {
      questionId: `gen_${conceptId}_${randomUUID().slice(0, 8)}`,
      conceptId,
      questionText: `[Unreviewed Practice] Solve problem for ${describeConcept(conceptId)} (${itemType})`,
      answer: 'Generated Answer',
      isApprovedBank: false,
      flaggedForReview: true,
      stepByStepSolution: itemType === 'example' ? `[Generated Example] Step 1: Breakdown ${describeConcept(conceptId)}. Step 2: Calculate result.` : undefined
    };
  };

  const targetConcept = plan.deepestGapConceptId || plan.targetConceptId;

  // 1. Supported Example
  const supportedExample = getApprovedOrFallback(targetConcept, 'example');

  // 2. Focused Practice Items
  const gapConcepts = plan.orderedGaps.map(g => g.conceptId);
  const focusedPractice: RemedialBlueprintStageItem[] = gapConcepts.map(cId =>
    getApprovedOrFallback(cId, 'practice')
  );

  // If fewer than 3 practice items, pad with target concept practice
  while (focusedPractice.length < 3) {
    focusedPractice.push(getApprovedOrFallback(targetConcept, 'practice'));
  }

  // 3. Mixed / Transfer Item
  const mixedTransferItem = getApprovedOrFallback(plan.targetConceptId, 'transfer');

  const blueprint: RemedialBlueprint = {
    id: 'blueprint_' + randomUUID(),
    planId: plan.id,
    studentId: plan.studentId,
    stages: {
      supportedExample,
      focusedPractice,
      mixedTransferItem
    },
    createdAt: new Date().toISOString()
  };

  await dbStore.addRemedialBlueprint(blueprint);
  return blueprint;
}
