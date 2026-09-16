import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_DIR = path.join(__dirname, '../../FLN SVG HTML files(22-59)');
const OUTPUT = path.join(__dirname, '../../data/questionBank.json');

interface Question {
  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml: string;
}

function extractTextFromSvg(svgHtml: string): string {
  const texts: string[] = [];
  const textRegex = /<text[^>]*>(.*?)<\/text>/g;
  let m;
  while ((m = textRegex.exec(svgHtml)) !== null) {
    const inner = m[1].replace(/<[^>]*>/g, '').trim();
    if (inner && inner !== '___' && !inner.match(/^\s*$/)) {
      texts.push(inner);
    }
  }
  return texts.join(' | ');
}

function parseSectionType(h2Text: string): string {
  const lower = h2Text.toLowerCase();
  if (lower.includes('mastery')) return 'mastery';
  if (lower.includes('easier')) return 'easier';
  if (lower.includes('remediation')) return 'remediation';
  if (lower.includes('foundation')) return 'foundation';
  if (lower.includes('assessment')) return 'assessment';
  return 'other';
}

function extractLevelNumber(filename: string): number {
  const match = filename.match(/level(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseHtmlFile(filePath: string, filename: string): Question[] {
  const html = fs.readFileSync(filePath, 'utf-8');
  const questions: Question[] = [];

  const levelNum = extractLevelNumber(filename);

  const h1Match = html.match(/<h1>(.*?)<\/h1>/);
  const levelTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : `Level ${levelNum}`;

  const sections = html.split(/<h2>/);

  if (sections.length === 1) {
    const sec = sections[0];
    const tableStart = sec.indexOf('<table>');
    const tableEnd = sec.indexOf('</table>');
    if (tableStart !== -1 && tableEnd !== -1) {
      const tableHtml = sec.substring(tableStart, tableEnd + 7);
      const rows = tableHtml.split(/<tr>/).slice(2);
      for (const row of rows) {
        if (!row.trim()) continue;
        const cells = row.split(/<\/tr>/)[0];
        const tdParts = cells.split(/<\/td>/);
        if (tdParts.length < 3) continue;
        const qNoText = tdParts[0].replace(/<[^>]*>/g, '').trim();
        const qNo = parseInt(qNoText, 10);
        if (isNaN(qNo)) continue;
        const sectionText = tdParts[1].replace(/<[^>]*>/g, '').trim();
        const svgMatch = tdParts[2].match(/<svg[\s\S]*?<\/svg>/);
        const svgHtml = svgMatch ? svgMatch[0] : '';
        const answerCell = tdParts[tdParts.length - 1] || tdParts[3] || '';
        const answer = answerCell.replace(/<[^>]*>/g, '').trim();
        let questionText = extractTextFromSvg(svgHtml);
        if (!questionText) questionText = sectionText;
        questions.push({
          level: levelNum,
          levelTitle,
          section: levelTitle,
          sectionType: 'assessment',
          questionNumber: qNo,
          questionText,
          answer,
          svgHtml,
        });
      }
    }
  } else {
    for (let si = 1; si < sections.length; si++) {
      const sec = sections[si];
      const h2End = sec.indexOf('</h2>');
      if (h2End === -1) continue;

      const h2Raw = sec.substring(0, h2End).replace(/<[^>]*>/g, '').trim();
      const sectionType = parseSectionType(h2Raw);

      const tableStart = sec.indexOf('<table>');
      const tableEnd = sec.indexOf('</table>');
      if (tableStart === -1 || tableEnd === -1) continue;

      const tableHtml = sec.substring(tableStart, tableEnd + 7);

      const rows = tableHtml.split(/<tr>/).slice(2);

      for (const row of rows) {
        if (!row.trim()) continue;

        const cells = row.split(/<\/tr>/)[0];
        const tdParts = cells.split(/<\/td>/);

        if (tdParts.length < 3) continue;

        const qNoText = tdParts[0].replace(/<[^>]*>/g, '').trim();
        const qNo = parseInt(qNoText, 10);
        if (isNaN(qNo)) continue;

        const sectionText = tdParts[1].replace(/<[^>]*>/g, '').trim();

        const svgMatch = tdParts[2].match(/<svg[\s\S]*?<\/svg>/);
        const svgHtml = svgMatch ? svgMatch[0] : '';

        const answerCell = tdParts[tdParts.length - 1] || tdParts[3] || '';
        const answer = answerCell.replace(/<[^>]*>/g, '').trim();

        let questionText = extractTextFromSvg(svgHtml);
        if (!questionText) {
          questionText = sectionText;
        }

        questions.push({
          level: levelNum,
          levelTitle,
          section: h2Raw,
          sectionType,
          questionNumber: qNo,
          questionText,
          answer,
          svgHtml,
        });
      }
    }
  }

  return questions;
}

function main() {
  const files = fs.readdirSync(HTML_DIR)
    .filter(f => f.endsWith('.html'))
    .sort((a, b) => {
      const la = extractLevelNumber(a);
      const lb = extractLevelNumber(b);
      return la - lb;
    });

  console.log(`Found ${files.length} HTML files`);

  const allQuestions: Question[] = [];

  for (const file of files) {
    const filePath = path.join(HTML_DIR, file);
    const qs = parseHtmlFile(filePath, file);
    console.log(`  ${file}: ${qs.length} questions`);
    allQuestions.push(...qs);
  }

  console.log(`\nTotal questions extracted: ${allQuestions.length}`);

  const outputDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(allQuestions, null, 2), 'utf-8');
  console.log(`Written to ${OUTPUT}`);

  const byLevel: Record<number, number> = {};
  for (const q of allQuestions) {
    byLevel[q.level] = (byLevel[q.level] || 0) + 1;
  }
  console.log('\nQuestions per level:');
  for (const [lvl, count] of Object.entries(byLevel).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  Level ${lvl}: ${count}`);
  }
}

main();
