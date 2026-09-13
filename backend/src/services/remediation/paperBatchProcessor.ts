/**
 * Paper Batch Processor Service for FLN Remediation Engine.
 * Complete, end-to-end dynamic backend pipeline that scales automated concept
 * classification, dynamic dictionary loading, practice question generation,
 * and plain-language remediation across all 176 FLN exam papers.
 */

import { detectConcept, generateByConcept, BlueprintQuestion, getHumanReadableRemediation, CONCEPT_MAP, registerConceptGenerator } from './blueprintEngine';
import { aiClassifyConcept } from './conceptClassifier';

export interface PaperInput {
  paperId: string;
  paperName?: string;
  questions: Array<string | { questionNo?: number; questionText: string; answer?: string; conceptName?: string }>;
}

export interface PracticeSet {
  questionNumber: number;
  originalQuestion: string;
  concept: string;
  remediation: string;
  practiceQuestions: BlueprintQuestion[];
  needsReview?: boolean;
  aiGenerated?: boolean;
}

export interface PaperOutput {
  paperId: string;
  paperName: string;
  totalQuestions: number;
  topics: PracticeSet[];
  processedAt: string;
}

export interface ConceptDictionaryEntry {
  keywords: string[];
  remediation: string;
}

/**
 * 1. Concept Dictionary Loader
 * Dynamically builds & registers concept dictionary entries from paper question corpora.
 */
export function buildConceptDictionary(reviewPapers: PaperInput[]): Record<string, ConceptDictionaryEntry> {
  const dictionary: Record<string, ConceptDictionaryEntry> = {};

  if (Array.isArray(reviewPapers)) {
    reviewPapers.forEach(paper => {
      (paper.questions || []).forEach(q => {
        const qText = typeof q === 'string' ? q : q.questionText || '';
        if (!qText) return;

        const concept = classifyConcept(qText);
        if (!dictionary[concept]) {
          const keywords = extractKeywords(qText);
          const remediation = getHumanReadableRemediation(concept, qText);
          dictionary[concept] = { keywords, remediation };

          // Register in global concept map if missing
          if (!CONCEPT_MAP[concept]) {
            CONCEPT_MAP[concept] = keywords;
          }
        }
      });
    });
  }

  return dictionary;
}

/**
 * Helper to extract keywords from question text
 */
function extractKeywords(questionText: string): string[] {
  const cleaned = questionText
    .replace(/[\s—–-]*item\s*\d+/gi, '')
    .replace(/[\s—–-]*question\s*\d+/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 3);
  return Array.from(new Set(words));
}

/**
 * 2. Classifier
 * Uses the 3-stage NLP/Pattern classifier for concept detection.
 */
export function classifyConcept(questionText: string, hintConcept: string = ''): string {
  return detectConcept(questionText, hintConcept) || aiClassifyConcept(questionText) || 'General';
}

/**
 * 3. Dynamic Generator
 * Creates varied practice questions with options and plain-language remediation sheets.
 */
export function createDynamicQuestions(
  concept: string,
  qText: string,
  vIndex: number = 0,
  dictionary?: Record<string, ConceptDictionaryEntry>,
  count: number = 5
): BlueprintQuestion[] {
  return Array.from({ length: count }, (_, i) => {
    const questionObj = generateByConcept(concept, vIndex * 5 + i, qText, '');
    if (dictionary && dictionary[concept]) {
      questionObj.remediation = dictionary[concept].remediation;
    }
    return questionObj;
  });
}

/**
 * 4. Dispatcher
 * Dispatches concept classification + dynamic practice generation for a question.
 */
export function generatePractice(
  concept: string,
  qText: string,
  vIndex: number = 0,
  dictionary?: Record<string, ConceptDictionaryEntry>,
  questionNumber: number = 1
): PracticeSet {
  const effectiveConcept = concept || classifyConcept(qText);
  const practiceQuestions = createDynamicQuestions(effectiveConcept, qText, vIndex, dictionary, 5);
  const remediation = (dictionary && dictionary[effectiveConcept])
    ? dictionary[effectiveConcept].remediation
    : getHumanReadableRemediation(effectiveConcept, qText);

  return {
    questionNumber,
    originalQuestion: qText,
    concept: effectiveConcept,
    remediation,
    practiceQuestions,
    needsReview: practiceQuestions.some(pq => pq.needsReview),
    aiGenerated: practiceQuestions.some(pq => pq.aiGenerated)
  };
}

/**
 * 5. Batch Processor
 * Processes papers automatically across the entire 176-paper corpus.
 */
export function processPaper(
  paper: PaperInput,
  countPerQuestion: number = 5,
  dictionary?: Record<string, ConceptDictionaryEntry>
): PaperOutput {
  const paperId = paper.paperId || 'PAPER_UNKNOWN';
  const paperName = paper.paperName || `Worksheet ${paperId}`;
  const rawQuestions = paper.questions || [];

  const topics: PracticeSet[] = rawQuestions.map((q, idx) => {
    const qNo = idx + 1;
    const qText = typeof q === 'string' ? q : q.questionText || `Question ${qNo}`;
    const hintConcept = typeof q === 'object' ? q.conceptName || '' : '';
    const concept = classifyConcept(qText, hintConcept);

    return generatePractice(concept, qText, idx, dictionary, countPerQuestion);
  });

  return {
    paperId,
    paperName,
    totalQuestions: rawQuestions.length,
    topics,
    processedAt: new Date().toISOString()
  };
}

/**
 * Batch processes multiple papers in one go across the entire paper corpus.
 */
export function processAllPapers(
  papers: PaperInput[],
  dictionary?: Record<string, ConceptDictionaryEntry>,
  countPerQuestion: number = 5
): PaperOutput[] {
  if (!Array.isArray(papers)) return [];
  return papers.map(p => processPaper(p, countPerQuestion, dictionary));
}
