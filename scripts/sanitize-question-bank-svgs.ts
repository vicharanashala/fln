import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { escapeStraySvgText } from '../backend/src/utils/svgEscape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_BANK_PATH = path.resolve(__dirname, '../data/questionBank.json');

function main() {
  console.log(`Reading ${QUESTION_BANK_PATH}...`);
  const raw = JSON.parse(fs.readFileSync(QUESTION_BANK_PATH, 'utf-8'));

  let changedCount = 0;
  const levelCounts: Record<number, number> = {};

  const updated = raw.map((q: any) => {
    if (!q.svgHtml) return q;
    const fixedSvg = escapeStraySvgText(q.svgHtml);
    if (fixedSvg !== q.svgHtml) {
      changedCount++;
      levelCounts[q.level] = (levelCounts[q.level] || 0) + 1;
      return { ...q, svgHtml: fixedSvg };
    }
    return q;
  });

  if (changedCount > 0) {
    fs.writeFileSync(QUESTION_BANK_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
    console.log(`Successfully sanitized ${changedCount} questions in questionBank.json!`);
    console.log('Affected counts per level:', levelCounts);
  } else {
    console.log('All questions in questionBank.json are already properly escaped.');
  }
}

main();
