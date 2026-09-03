import { Type } from "@google/genai";
import { getAiClient, generateContentWithRetry } from '../../gemini';
import { blueprintEngine, generateRemediationVariants, BlueprintQuestion } from './blueprintEngine';
import { numericEngine } from './numericEngine.js';
import { matrixEngine } from './matrixEngine.js';

// ---------------------------------------------------------------------------
// Type classifier — decides which engine handles each question
// ---------------------------------------------------------------------------
type EngineType = 'numeric' | 'matrix' | 'api';

function classifyEngine(originalQuestion: string, questionType: string, conceptName: string): EngineType {
  const combined = `${originalQuestion} ${questionType} ${conceptName}`.toLowerCase();

  // Infer type from question text when stored type is 'standard'
  const effectiveType = (questionType && questionType !== 'standard')
    ? questionType
    : (/tally|tallies/.test(combined) ? 'tally'
      : /clock|read the clock|match time/.test(combined) ? 'clock'
        : /shape trac|marine trac/.test(combined) ? 'trace'
          : /\btrac(e|ing)\b/.test(combined) ? 'trace'
            : /match the shape|shape match/.test(combined) ? 'shape'
              : questionType);

  // ALWAYS send these to the AI or blueprintEngine (not numeric/matrix)
  const isApiOnly =
    /\b(trac(e|ing)|marine|shape trac)\b/.test(combined) ||
    /\b(clock|time|calendar|month|week|day)\b/.test(combined) ||
    /\b(tally|tallies|data handling)\b/.test(combined) ||
    /\b(ordinal|1st|2nd|3rd|position)\b/.test(combined) ||
    /\b(money|rupee|coin|currency)\b/.test(combined) ||
    /\b(map|direction|north|south|east|west)\b/.test(combined) ||
    effectiveType === 'trace' || effectiveType === 'clock' || effectiveType === 'tally';

  if (isApiOnly) return 'api';

  // NUMERIC engine — pure math, counting, arithmetic, place value, comparisons with numbers
  const isNumeric =
    /\b(add|subtract|addition|subtraction|multiply|division|divide|plus|minus|sum|difference|quotient|product)\b/.test(combined) ||
    /\b(count(ing)?|how many|stars|balls|items)\b/.test(combined) ||
    /\b(greater than|less than|more than|fewer|equal|before|after|between)\b/.test(combined) ||
    /\b(place value|tens|units|ones|digits|number line|skip counting)\b/.test(combined) ||
    /\b(ordering|ascending|descending|largest|smallest)\b/.test(combined) ||
    /\b(area|perimeter|meters|cm|kg|grams|liters|fraction|decimal|angle|symmetry)\b/.test(combined) ||
    /\d+\s*[+\-*/]\s*\d+/.test(originalQuestion);

  if (isNumeric) return 'numeric';

  // MATRIX engine — only pure classification/odd-one-out/category questions
  const isMatrix =
    /\b(odd one out|odd one|does not belong|classify|classification|category|categories)\b/.test(combined) ||
    /\b(fruit|animal|vehicle|food|living|non-living|plants|tools)\b/.test(combined) ||
    /\b(color|colour)\b/.test(combined) ||
    effectiveType === 'matrix';

  if (isMatrix) return 'matrix';

  // Everything else → AI API
  return 'api';
}

// ---------------------------------------------------------------------------
// AI batch prompt — generates all 5 variants in one call
// ---------------------------------------------------------------------------
function buildBatchPrompt(originalQuestion: string, conceptName: string, questionType: string): string {
  return `You are an expert AI Primary School Math Teacher creating 5 remedial practice questions for a student.

EXAM PAPER QUESTION BLUEPRINT (Use this EXACT prompt structure as your template):
"${originalQuestion}"

TOPIC / CONCEPT: "${conceptName}"
QUESTION TYPE: "${questionType}"

CRITICAL INSTRUCTION FOR FULL AUTOMATION:
- Examine the original question above from the student's exam paper.
- Generate 5 practice questions that are 100% IDENTICAL IN FORMAT, QUESTION TYPE, INSTRUCTIONS, AND TOPIC to the original paper question.
- Do NOT change the topic or question style. If the original question is about equal groups, count equal groups. If it is about frequency tables, use frequency tables. If it is about comparison, compare numbers.
- Only mutate the numbers, object items, emojis, or category names so each variant is unique.
- Compute the precise, correct answer for each generated variant.

Return ONLY this JSON (no extra text outside json):
{
  "variants": [
    {"question": "complete readable practice question", "answer": "exact correct answer"},
    {"question": "complete readable practice question", "answer": "exact correct answer"},
    {"question": "complete readable practice question", "answer": "exact correct answer"},
    {"question": "complete readable practice question", "answer": "exact correct answer"},
    {"question": "complete readable practice question", "answer": "exact correct answer"}
  ]
}`;
}

// ---------------------------------------------------------------------------
// GenerativeEngine — smart 3-engine router
// ---------------------------------------------------------------------------
export class GenerativeEngine {
  /**
   * Generates all 5 practice variants for a failed question.
   * Routes to the right engine automatically:
   *   numeric    → numericEngine  (no API call)
   *   matrix     → matrixEngine   (no API call)
   *   everything → AI API         (one batch call for all 5)
   */
  async generateBatch(
    originalQuestion: string,
    conceptName: string,
    questionType: string = 'standard',
    baseOffset: number = 0,
    classLevel: number = 5
  ): Promise<BlueprintQuestion[]> {
    console.log(`[GenerativeEngine] Fast-routing "${originalQuestion}" via blueprintEngine (concept=${conceptName}) | offset=${baseOffset}`);
    return generateRemediationVariants(originalQuestion, '', 5, conceptName, baseOffset, classLevel);
  }

  /**
   * Single-variant API — delegates to generateBatch for consistency.
   */
  async generate(
    originalQuestion: string,
    conceptName: string,
    questionType: string = 'standard',
    _originalAnswer: string = '',
    variantIndex: number = 0
  ): Promise<BlueprintQuestion> {
    const batch = await this.generateBatch(originalQuestion, conceptName, questionType);
    return batch[variantIndex % batch.length];
  }

  // ── AI batch call ─────────────────────────────────────────────────────────
  private async generateBatchViaAI(
    originalQuestion: string,
    conceptName: string,
    questionType: string
  ): Promise<BlueprintQuestion[]> {
    const aiClient = getAiClient();
    if (!aiClient) return this.generateBatchFallback(originalQuestion, conceptName, questionType);

    try {
      const response = await generateContentWithRetry({
        contents: buildBatchPrompt(originalQuestion, conceptName, questionType),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              variants: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING }
                  },
                  required: ['question', 'answer']
                }
              }
            },
            required: ['variants']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      const variants = (parsed.variants || []) as Array<{ question: string; answer: string }>;

      const valid = variants
        .map(v => ({ question: String(v.question || '').trim(), answer: String(v.answer || '').trim() }))
        .filter(v => v.question && v.question !== originalQuestion && !/Item \d+/i.test(v.question));

      // Only fall back completely if the AI gave us NOTHING usable.
      // Previously this discarded 1-2 perfectly good AI variants just
      // because fewer than 3 came back.
      if (valid.length === 0) return this.generateBatchFallback(originalQuestion, conceptName, questionType);

      // Keep every real AI variant. Only pad missing slots with the local
      // fallback, and label those honestly instead of marking everything
      // as AI-generated.
      const result: BlueprintQuestion[] =
        valid.slice(0, 5).map(v => ({
          question: v.question,
          answer: v.answer,
          aiGenerated: true,
          topic: conceptName
        }));

      if (result.length < 5) {
        const fallbacks = this.generateBatchFallback(originalQuestion, conceptName, questionType);
        while (result.length < 5) {
          result.push(fallbacks[result.length] || fallbacks[0]);
        }
      }

      return result;
    } catch {
      return this.generateBatchFallback(originalQuestion, conceptName, questionType);
    }
  }

  // ── Matrix helpers ────────────────────────────────────────────────────────
  private getMatrixTemplate(originalQuestion: string): string {
    const q = originalQuestion.toLowerCase();

    // Map known question types to a clear instruction the student can follow
    if (/odd one out/i.test(q) || /does not belong/i.test(q)) {
      return 'Circle the item that does NOT belong in the group:';
    }
    if (/match the shape/i.test(q) || /shape match/i.test(q)) {
      return 'Match the shape shown to its correct name. Which shape is this?';
    }
    if (/match the follow/i.test(q)) {
      return 'Draw a line to match each item on the left with its pair on the right:';
    }
    if (/same group/i.test(q) || /classify/i.test(q) || /category/i.test(q)) {
      return 'Circle ALL items that belong to the SAME group:';
    }
    if (/living/i.test(q) || /non-living/i.test(q)) {
      return 'Circle the item that is LIVING (alive):';
    }
    if (/colour|color/i.test(q)) {
      return 'Circle the item that is a DIFFERENT colour from the others:';
    }
    if (/fruit/i.test(q)) {
      return 'Circle the item that is NOT a fruit:';
    }
    if (/animal/i.test(q)) {
      return 'Circle the item that is NOT an animal:';
    }
    if (/vehicle/i.test(q)) {
      return 'Circle the item that is NOT a vehicle:';
    }
    // Generic fallback — still readable
    return 'Look at the items below. Circle the ONE that does NOT belong with the others:';
  }

  private buildMatrixArrays(originalQuestion: string, conceptName: string, questionType: string) {
    const combined = `${originalQuestion} ${conceptName} ${questionType}`.toLowerCase();

    // Shape matching / identification
    if (/\b(shape|shapes|square|triangle|rectangle|circle|diamond|pentagon|hexagon|star)\b/.test(combined)) {
      return {
        targetGroup: ['circle 🔴', 'triangle 🔺', 'square ⏹', 'rectangle 🟦', 'pentagon ⬟', 'hexagon ⬡'],
        foilGroup: ['star ⭐', 'diamond 🔷', 'heart ❤️', 'crescent 🌙']
      };
    }
    // Color grouping
    if (/\b(color|colour|red|blue|green|yellow|orange|purple|pink)\b/.test(combined)) {
      return {
        targetGroup: ['red apple 🍎', 'red tomato 🍅', 'red rose 🌹', 'red fire engine 🚒'],
        foilGroup: ['blue sky 🌀', 'green leaf 🍃', 'yellow sun ☀️', 'purple grape 🍇']
      };
    }
    // Fruit category
    if (/\b(fruit|apple|banana|mango|orange|grapes|papaya)\b/.test(combined)) {
      return {
        targetGroup: ['apple 🍎', 'banana 🍌', 'mango 🥭', 'orange 🍊', 'grapes 🍇'],
        foilGroup: ['chair 🪑', 'car 🚗', 'book 📕', 'pencil ✏️']
      };
    }
    // Animal category
    if (/\b(animal|dog|cat|bird|fish|lion|elephant|rabbit|cow)\b/.test(combined)) {
      return {
        targetGroup: ['dog 🐕', 'cat 🐈', 'rabbit 🐇', 'cow 🐄', 'elephant 🐘'],
        foilGroup: ['bus 🚌', 'ball ⚽', 'table 🪵', 'pencil ✏️']
      };
    }
    // Vehicle category
    if (/\b(vehicle|car|bus|truck|bicycle|train|airplane)\b/.test(combined)) {
      return {
        targetGroup: ['car 🚗', 'bus 🚌', 'bicycle 🚲', 'truck 🚚', 'train 🚆'],
        foilGroup: ['apple 🍎', 'chair 🪑', 'fish 🐟', 'flower 🌸']
      };
    }
    // Living vs non-living
    if (/\b(living|non-living|alive|plant|tree|grass)\b/.test(combined)) {
      return {
        targetGroup: ['plant 🌱', 'tree 🌳', 'grass 🌿', 'flower 🌸', 'bird 🐦'],
        foilGroup: ['stone 🪨', 'plastic bottle', 'chair 🪑', 'glass 🥛']
      };
    }
    // Generic odd-one-out fallback
    return {
      targetGroup: ['apple 🍎', 'banana 🍌', 'orange 🍊', 'mango 🥭', 'grapes 🍇'],
      foilGroup: ['car 🚗', 'chair 🪑', 'book 📕', 'pencil ✏️', 'bus 🚌']
    };
  }

  // ── Blueprint fallback (when AI is off and engine can't handle it) ─────────
  public generateBatchFallback(
    originalQuestion: string,
    conceptName: string,
    questionType: string,
    baseOffset: number = 0
  ): BlueprintQuestion[] {
    const variants = generateRemediationVariants(originalQuestion, '', 5, conceptName, baseOffset);
    return variants.map(v => ({
      question: v.question,
      options: v.options,
      answer: v.answer,
      remediation: v.remediation,
      aiGenerated: false,
      needsReview: v.needsReview ?? false,
      topic: v.topic,
      subQuestions: v.subQuestions
    }));
  }


  public generateFallback(
    originalQuestion: string,
    conceptName: string,
    questionType: string,
    _originalAnswer: string = '',
    variantIndex: number = 0
  ) {
    const resolvedType = this.resolveQuestionType(originalQuestion, questionType);
    return blueprintEngine.generate(originalQuestion, conceptName, resolvedType, '', variantIndex);
  }

  /**
   * Infers the correct engine type from the question text when questionType is 'standard'.
   * Needed because many questions from the paper generator use type='standard' regardless of content.
   */
  private resolveQuestionType(originalQuestion: string, questionType: string): string {
    if (questionType && questionType !== 'standard') return questionType;
    const q = originalQuestion.toLowerCase();
    if (/count,\s*write|count\s*&\s*match|gesture|finger/i.test(q)) return 'count-match';
    if (/tally|tallies/i.test(q)) return 'tally';
    if (/clock|time|calendar/i.test(q)) return 'clock';
    if (/shape trac|marine trac/i.test(q)) return 'trace';
    if (/\btrac(e|ing)\b/i.test(q)) return 'trace';
    if (/match the shape|shape match/i.test(q)) return 'shape';
    if (/odd one out/i.test(q)) return 'matrix';
    if (/long or short|shorter|longer/i.test(q)) return 'circle-choice';
    return questionType || 'standard';
  }
}

export const generativeEngine = new GenerativeEngine();
