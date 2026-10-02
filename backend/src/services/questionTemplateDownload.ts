import JSZip from 'jszip';
import type { buildLevelMapPayload } from '../config/skillLevelMap';
import type { SvgTheme } from '../svgAssetCatalog';

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
): Promise<Buffer> {
  const zip = new JSZip();
  // Deliberately byte-identical to the existing header-only CSV endpoint.
  zip.file('questions.csv', columns.join(',') + '\n');

  const levelRows: Array<Array<string | number | boolean>> = [[
    'levelNumber', 'levelId', 'conceptId', 'stage', 'capability',
    'skillId', 'skillName', 'subskillId', 'subskillName',
  ]];
  const skills = new Map(levelMap.skills.map(skill => [skill.id, skill]));
  for (const level of levelMap.levels) {
    const base = [level.levelNumber, level.levelId, level.sCode, level.stage, level.capability];
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
  zip.file('README.txt', [
    'Question authoring template',
    '',
    '1. Extract this ZIP and fill in questions.csv (one question template per row).',
    '2. Use reference-levels-and-subskills.csv to find conceptId, skill and subskill codes.',
    '   Filter its stage column to find the curriculum stage you need.',
    '   Each row shows a valid level -> skill -> subskill relationship.',
    '3. Use reference-svg-themes.csv to find visual themes and their available artwork.',
    '   Copy themeId into svgThemeIds, not the label, filename or variantId.',
    '4. Separate multiple skills, subskills, themes or tags in a cell with |.',
    '5. Save questions.csv as UTF-8 CSV, then use Check the file before Import.',
    '   Upload only questions.csv, not this ZIP or the reference files.',
    '',
    'References are generated from the running server\'s level map and SVG catalogue',
    'at download time. Download again after the deployed curriculum/catalogue changes.',
  ].join('\r\n'));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
