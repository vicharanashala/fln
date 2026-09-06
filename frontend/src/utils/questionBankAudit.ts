export type IssueCategory =
  | 'MISSING_TEXT'
  | 'MISSING_ANSWER'
  | 'INVALID_CHOICES'
  | 'DUPLICATE_TEXT'
  | 'INVALID_LEVEL'
  | 'MALFORMED_SVG';

export type IssueSeverity = 'critical' | 'warning';

export interface AuditIssue {
  id: string;
  questionId: string;
  level: number | null;
  category: IssueCategory;
  categoryLabel: string;
  severity: IssueSeverity;
  message: string;
  questionSnippet: string;
  rawQuestion: any;
}

export interface AuditResult {
  total: number;
  valid: number;
  issueCount: number;
  healthScore: number;
  categoryCounts: Record<IssueCategory, number>;
  issues: AuditIssue[];
}

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  MISSING_TEXT: 'Missing Question Text',
  MISSING_ANSWER: 'Missing Correct Answer',
  INVALID_CHOICES: 'Invalid Choices',
  DUPLICATE_TEXT: 'Duplicate Question Text',
  INVALID_LEVEL: 'Invalid FLN Level',
  MALFORMED_SVG: 'Malformed SVG Markup',
};

export const CATEGORY_SEVERITIES: Record<IssueCategory, IssueSeverity> = {
  MISSING_TEXT: 'critical',
  MISSING_ANSWER: 'critical',
  INVALID_CHOICES: 'critical',
  DUPLICATE_TEXT: 'warning',
  INVALID_LEVEL: 'warning',
  MALFORMED_SVG: 'warning',
};

export function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractQuestionText(q: any): string {
  if (typeof q?.questionText === 'string') return q.questionText;
  if (typeof q?.question === 'string') return q.question;
  if (typeof q?.text === 'string') return q.text;
  return '';
}

export function extractQuestionId(q: any, index: number): string {
  if (q?.question_id) return String(q.question_id);
  if (q?.id) return String(q.id);
  if (q?.questionNumber !== undefined && q?.level !== undefined) return `L${q.level}-Q${q.questionNumber}`;
  return `Q-${index + 1}`;
}

export function extractQuestionLevel(q: any): number | null {
  const lvl = q?.level ?? q?.source_level;
  if (typeof lvl === 'number') return lvl;
  if (typeof lvl === 'string' && lvl.trim() !== '' && !isNaN(Number(lvl))) return Number(lvl);
  return null;
}

export function extractQuestionAnswer(q: any): any {
  if (q?.answer !== undefined) return q.answer;
  if (q?.expectedAnswer !== undefined) return q.expectedAnswer;
  if (q?.correctAnswer !== undefined) return q.correctAnswer;
  return undefined;
}

export function extractSvgContent(q: any): string | null {
  if (typeof q?.svgHtml === 'string' && q.svgHtml.trim().length > 0) return q.svgHtml;
  if (typeof q?.svgAsset === 'string' && q.svgAsset.includes('<svg')) return q.svgAsset;
  return null;
}

/**
 * Pure audit runner for Question Bank static analysis.
 * Non-destructive, side-effect free.
 */
export function runQuestionBankAudit(questions: any[]): AuditResult {
  const issues: AuditIssue[] = [];
  const questionIssueCountMap = new Map<number, number>();

  const categoryCounts: Record<IssueCategory, number> = {
    MISSING_TEXT: 0,
    MISSING_ANSWER: 0,
    INVALID_CHOICES: 0,
    DUPLICATE_TEXT: 0,
    INVALID_LEVEL: 0,
    MALFORMED_SVG: 0,
  };

  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      total: 0,
      valid: 0,
      issueCount: 0,
      healthScore: 100.0,
      categoryCounts,
      issues: [],
    };
  }

  // Pre-index for Duplicate Detection
  const normalizedTextMap = new Map<string, Array<{ q: any; index: number; qId: string }>>();

  questions.forEach((q, idx) => {
    const qId = extractQuestionId(q, idx);
    questionIssueCountMap.set(idx, 0);

    const rawText = extractQuestionText(q);
    const normalized = normalizeQuestionText(rawText);
    if (normalized.length >= 3) {
      if (!normalizedTextMap.has(normalized)) {
        normalizedTextMap.set(normalized, []);
      }
      normalizedTextMap.get(normalized)!.push({ q, index: idx, qId });
    }
  });

  const addIssue = (
    q: any,
    index: number,
    category: IssueCategory,
    message: string
  ) => {
    const qId = extractQuestionId(q, index);
    const rawText = extractQuestionText(q);
    const lvl = extractQuestionLevel(q);
    const severity = CATEGORY_SEVERITIES[category];
    const snippet = rawText.trim() ? (rawText.length > 80 ? rawText.substring(0, 80) + '…' : rawText) : '(No question text provided)';

    issues.push({
      id: `${qId}_${category}_${index}`,
      questionId: qId,
      level: lvl,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      severity,
      message,
      questionSnippet: snippet,
      rawQuestion: q,
    });

    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    questionIssueCountMap.set(index, (questionIssueCountMap.get(index) || 0) + 1);
  };

  // Run Static Integrity Checks for each question
  questions.forEach((q, idx) => {
    // 1. Missing / Empty Question Text (< 3 meaningful chars)
    const rawText = extractQuestionText(q);
    if (!rawText || rawText.trim().length < 3) {
      addIssue(
        q,
        idx,
        'MISSING_TEXT',
        `Question text is missing, empty, or has fewer than 3 characters (${rawText?.trim().length || 0} chars).`
      );
    }

    // 2. Missing Correct Answer (Important: 0 / "0" is valid)
    const answer = extractQuestionAnswer(q);
    const isAnswerMissing =
      answer === undefined ||
      answer === null ||
      (typeof answer === 'string' && answer.trim() === '');

    if (isAnswerMissing) {
      addIssue(
        q,
        idx,
        'MISSING_ANSWER',
        'Correct answer is missing or empty.'
      );
    }

    // 3. Invalid Choices (only when answer_type === 'choice')
    const answerType = q?.answer_type;
    if (answerType === 'choice') {
      const choices = q?.choices;
      if (!Array.isArray(choices)) {
        addIssue(
          q,
          idx,
          'INVALID_CHOICES',
          'Choice question is missing a valid "choices" array.'
        );
      } else {
        const nonEmptyChoices = choices
          .filter(c => c !== null && c !== undefined)
          .map(c => String(c).trim())
          .filter(c => c.length > 0);

        const uniqueChoices = new Set(nonEmptyChoices.map(c => c.toLowerCase()));

        if (nonEmptyChoices.length < 2 || uniqueChoices.size < 2) {
          addIssue(
            q,
            idx,
            'INVALID_CHOICES',
            `Choice question must have at least 2 distinct non-empty options (found ${uniqueChoices.size}).`
          );
        }
      }
    }

    // 5. Invalid FLN Level (valid range is 1–93)
    const level = extractQuestionLevel(q);
    if (
      level === null ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 93
    ) {
      addIssue(
        q,
        idx,
        'INVALID_LEVEL',
        `FLN Level ${level !== null ? `"${level}"` : 'missing'} is outside the valid range 1–93.`
      );
    }

    // 6. SVG Markup Integrity (only when SVG content is present)
    const svgContent = extractSvgContent(q);
    if (svgContent) {
      const hasOpenTag = svgContent.includes('<svg');
      const hasCloseTag = svgContent.includes('</svg>');
      if (!hasOpenTag || !hasCloseTag) {
        addIssue(
          q,
          idx,
          'MALFORMED_SVG',
          `SVG illustration has malformed XML markup (missing ${!hasOpenTag ? '<svg' : '</svg>'} tag).`
        );
      }
    }
  });

  // 4. Duplicate Question Text Check (Reports every affected question record)
  normalizedTextMap.forEach((occurrences) => {
    if (occurrences.length > 1) {
      const duplicateIds = occurrences.map(o => o.qId).join(', ');
      occurrences.forEach(({ q, index }) => {
        addIssue(
          q,
          index,
          'DUPLICATE_TEXT',
          `Duplicate question text shared with ${occurrences.length - 1} other record(s) [${duplicateIds}].`
        );
      });
    }
  });

  const total = questions.length;
  let validCount = 0;
  questionIssueCountMap.forEach((cnt) => {
    if (cnt === 0) validCount++;
  });

  const healthScore = total > 0 ? Math.round((validCount / total) * 1000) / 10 : 100.0;

  return {
    total,
    valid: validCount,
    issueCount: issues.length,
    healthScore,
    categoryCounts,
    issues,
  };
}
