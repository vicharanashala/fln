import { ANSWER_TYPES, AnswerType } from './types/questionTemplateParams.js';
import { listThemes } from './svgAssetCatalog.js';

export interface AnswerSpaceRule {
  answerType: AnswerType | 'circle' | string;
  boxWidthMm: number;
  boxHeightMm: number;
  minPaddingMm: number;
  marginBottomMm: number;
  circlePaddingMm?: number;
  layoutStyle: 'box' | 'choice-grid' | 'line' | 'split-cols' | 'large-area';
  cssClasses: string[];
  styleDeclaration: string;
}

export const BASE_ANSWER_SPACE_RULES: Record<AnswerType, Omit<AnswerSpaceRule, 'answerType'>> = {
  'single-number': {
    boxWidthMm: 22,
    boxHeightMm: 16,
    minPaddingMm: 2,
    marginBottomMm: 4,
    layoutStyle: 'box',
    cssClasses: ['ans-box', 'ans-box-single-number'],
    styleDeclaration: 'width: 22mm; height: 16mm; padding: 2mm; margin-bottom: 4mm;',
  },
  'fill-blanks': {
    boxWidthMm: 28,
    boxHeightMm: 16,
    minPaddingMm: 2,
    marginBottomMm: 5,
    layoutStyle: 'box',
    cssClasses: ['ans-box', 'ans-box-fill-blanks'],
    styleDeclaration: 'width: 28mm; height: 16mm; padding: 2mm; margin-bottom: 5mm;',
  },
  'mcq-4': {
    boxWidthMm: 65,
    boxHeightMm: 32,
    minPaddingMm: 3,
    marginBottomMm: 6,
    layoutStyle: 'choice-grid',
    cssClasses: ['ans-box-mcq-4', 'mcq-options'],
    styleDeclaration: 'width: 65mm; height: 32mm; padding: 3mm; margin-bottom: 6mm;',
  },
  'true-false': {
    boxWidthMm: 45,
    boxHeightMm: 18,
    minPaddingMm: 3,
    marginBottomMm: 5,
    layoutStyle: 'choice-grid',
    cssClasses: ['ans-box-true-false'],
    styleDeclaration: 'width: 45mm; height: 18mm; padding: 3mm; margin-bottom: 5mm;',
  },
  matching: {
    boxWidthMm: 120,
    boxHeightMm: 48,
    minPaddingMm: 4,
    marginBottomMm: 8,
    layoutStyle: 'split-cols',
    cssClasses: ['ans-box-matching', 'match-grid'],
    styleDeclaration: 'width: 120mm; height: 48mm; padding: 4mm; margin-bottom: 8mm;',
  },
  trace: {
    boxWidthMm: 80,
    boxHeightMm: 42,
    minPaddingMm: 5,
    marginBottomMm: 10,
    layoutStyle: 'large-area',
    cssClasses: ['ans-box-trace', 'trace-box'],
    styleDeclaration: 'width: 80mm; height: 42mm; padding: 5mm; margin-bottom: 10mm;',
  },
};

/**
 * Resolves the spacing and sizing rule for a given answerType.
 * Consults SVG theme's supportedAnswerShapes: if 'circle' is present (or answerType is 'circle'),
 * adjusts layout/spacing rules to reserve extra space around the artwork for pencil circling.
 */
export function getAnswerSpaceRule(
  answerType: AnswerType | string,
  svgThemeId?: string
): AnswerSpaceRule {
  const baseType = (answerType as AnswerType) in BASE_ANSWER_SPACE_RULES
    ? (answerType as AnswerType)
    : 'single-number';

  const baseRule = BASE_ANSWER_SPACE_RULES[baseType];

  let supportsCircle = answerType === 'circle';
  if (svgThemeId) {
    const theme = listThemes().find(t => t.id === svgThemeId);
    if (theme?.supportedAnswerShapes?.includes('circle')) {
      supportsCircle = true;
    }
  }

  if (supportsCircle) {
    const circlePadding = 8;
    return {
      answerType,
      boxWidthMm: baseRule.boxWidthMm + 12,
      boxHeightMm: baseRule.boxHeightMm + 12,
      minPaddingMm: baseRule.minPaddingMm + circlePadding,
      marginBottomMm: baseRule.marginBottomMm + 4,
      circlePaddingMm: circlePadding,
      layoutStyle: baseRule.layoutStyle,
      cssClasses: [...baseRule.cssClasses, 'ans-box-circle-target'],
      styleDeclaration: `width: ${baseRule.boxWidthMm + 12}mm; height: ${baseRule.boxHeightMm + 12}mm; padding: ${baseRule.minPaddingMm + circlePadding}mm; margin-bottom: ${baseRule.marginBottomMm + 4}mm; border-radius: 50%;`,
    };
  }

  return {
    answerType: baseType,
    ...baseRule,
  };
}

/**
 * Returns spacing and sizing rules for all defined ANSWER_TYPES.
 */
export function getAllAnswerSpaceRules(): Record<AnswerType, AnswerSpaceRule> {
  const rules: Partial<Record<AnswerType, AnswerSpaceRule>> = {};
  for (const type of ANSWER_TYPES) {
    rules[type] = getAnswerSpaceRule(type);
  }
  return rules as Record<AnswerType, AnswerSpaceRule>;
}

/**
 * Generates CSS rules for all per-answerType spacing definitions.
 */
export function generateAnswerSpaceCss(): string {
  return (ANSWER_TYPES as readonly string[])
    .map(type => {
      const rule = getAnswerSpaceRule(type);
      return `.${rule.cssClasses[0]} { ${rule.styleDeclaration} }`;
    })
    .join('\n');
}
