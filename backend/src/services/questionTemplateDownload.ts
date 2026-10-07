import JSZip from 'jszip';
import type { buildLevelMapPayload } from '../config/skillLevelMap';
import type { SvgTheme } from '../svgAssetCatalog';
import { getParamCatalog } from '../types/questionTemplateParams';

/** Quote reference cells and prevent spreadsheet formulas in descriptive text. */
function csv(rows: Array<Array<string | number | boolean>>): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value);
    if (/^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n') + '\r\n';
}

/** Package the same catalogues used by the authoring API; no database writes. */
export async function buildQuestionTemplateDownload(
  columns: readonly string[],
  levelMap: ReturnType<typeof buildLevelMapPayload>,
  themes: SvgTheme[],
  options: { stage?: string } = {},
): Promise<Buffer> {
  const zip = new JSZip();
  // Deliberately byte-identical to the existing header-only CSV endpoint.
  zip.file('questions.csv', columns.join(',') + '\n');

  const levelRows: Array<Array<string | number | boolean>> = [[
    'levelNumber', 'levelId', 'conceptId', 'stage', 'stageName', 'capability',
    'skillId', 'skillName', 'subskillId', 'subskillName',
  ]];
  const skills = new Map(levelMap.skills.map(skill => [skill.id, skill]));
  const stageLabels = new Map(levelMap.stages.map(stage => [stage.stage, stage.label]));
  const levels = options.stage ? levelMap.levels.filter(level => level.stage === options.stage) : levelMap.levels;
  for (const level of levels) {
    const base = [level.levelNumber, level.levelId, level.sCode, level.stage,
      stageLabels.get(level.stage) ?? level.stage, level.capability];
    if (level.skills.length === 0) levelRows.push([...base, '', '', '', '']);
    for (const skillId of level.skills) {
      const skill = skills.get(skillId);
      const subskills = skill?.subskills.length ? skill.subskills : [{ id: '', name: '' }];
      for (const subskill of subskills) {
        levelRows.push([...base, skillId, skill?.name ?? '', subskill.id, subskill.name]);
      }
    }
  }
  zip.file('reference-levels-and-subskills.csv', csv(levelRows));
  zip.file('reference-svg-themes.csv', csv([
    ['themeId', 'themeLabel', 'variantId', 'assetFile', 'supportedAnswerShapes', 'printSafe', 'viewBox'],
    ...themes.flatMap(theme => theme.variants.map(variant => [
      theme.id, theme.label, variant.variantId, variant.file,
      theme.supportedAnswerShapes.join('|'), theme.printSafe, theme.viewBox,
    ])),
  ]));
  const catalog = getParamCatalog();
  const rules: Record<string, string> = {
    numeralRange: `Deprecated values: ${catalog.deprecatedNumeralRange.join('|')}. Prefer a non-deprecated range.`,
    deprecatedNumeralRange: 'Reference metadata, not a CSV column: deprecated numeralRange values.',
    generationIntent: `Required: ${catalog.generationIntent.minChars}-${catalog.generationIntent.maxChars} characters.`,
    blankCount: `Integer ${catalog.blankCount.min}-${catalog.blankCount.max}; only for ${catalog.contextRules.blankCount.requiresAnswerType}.`,
    questionCount: `Integer ${catalog.questionCount.min}-${catalog.questionCount.max}; default ${catalog.questionCount.default}.`,
    carryBehavior: `Requires operations to include ${catalog.contextRules.carryBehavior.requiresOperation}.`,
    borrowBehavior: `Requires operations to include ${catalog.contextRules.borrowBehavior.requiresOperation}.`,
    maxOperandCount: `Requires operations to include ${catalog.contextRules.maxOperandCount.requiresAnyOperation.join(' or ')}.`,
    maxSumOrDifference: `Requires operations to include ${catalog.contextRules.maxSumOrDifference.requiresAnyOperation.join(' or ')}.`,
    operations: 'Separate multiple values with |.',
    maxSvgThemes: 'Reference metadata, not a CSV column: maximum number of svgThemeIds.',
    contextRules: 'Reference metadata, not a CSV column: dependencies between fields.',
  };
  zip.file('reference-allowed-values.csv', csv([
    ['column', 'allowedValues', 'rule'],
    ...Object.entries(catalog).map(([column, values]) => [column,
      Array.isArray(values) ? values.join('|') : JSON.stringify(values),
      rules[column] ?? 'Choose one of the listed values.']),
  ]));

  const firstLevel = levels[0];
  if (!firstLevel) throw new Error('No levels available for the selected stage.');
  const firstSkill = skills.get(firstLevel.skills[0]);
  const values: Record<string, string> = {
    conceptId: firstLevel.sCode, skills: firstLevel.skills[0] ?? '',
    subskills: firstSkill?.subskills[0]?.id ?? '', questionFamily: 'counting',
    numeralRange: '0-9', answerType: 'single-number', questionCount: '10',
    svgThemeIds: 'fruits', subjectCategory: 'fruits',
    generationIntent: 'The child counts the objects shown and writes how many there are.',
  };
  zip.file('questions-example.csv', columns.join(',') + '\n'
    + csv([columns.map(column => values[column] ?? '')]).replace(/^\uFEFF/, ''));
  zip.file('README.txt', [
    'Question authoring template',
    '',
    '1. Extract this ZIP and fill in questions.csv (one question template per row).',
    '2. Use reference-levels-and-subskills.csv to find conceptId, skill and subskill codes.',
    `   This download covers ${options.stage ? stageLabels.get(options.stage) ?? options.stage : 'all stages'}.`,
    '   Each row shows a valid level -> skill -> subskill relationship.',
    '3. Use reference-svg-themes.csv to find visual themes and their available artwork.',
    '   Copy themeId into svgThemeIds, not the label, filename or variantId.',
    '4. Separate multiple skills, subskills, themes or tags in a cell with |.',
    '   See reference-allowed-values.csv for legal values, limits and dependencies.',
    '   questions-example.csv contains one valid format example for this selection.',
    '   Adapt it to your intended concept; it is not pedagogically reviewed question content.',
    '5. Save questions.csv as UTF-8 CSV, then use Check the file before Import.',
    '   Upload only questions.csv, not this ZIP or the reference files.',
    '',
    'References are generated from the running server\'s level map and SVG catalogue',
    'at download time. Download again after the deployed curriculum/catalogue changes.',
  ].join('\r\n'));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
