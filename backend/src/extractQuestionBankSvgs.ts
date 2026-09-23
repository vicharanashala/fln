// One-time extraction: pull the SVG markup out of `questionBank.svgHtml`
// (the last place question-bank artwork lives inline, alongside
// `levelHtmlTemplates.htmlContent`) into individual files, per the decision
// to have exactly one place SVG markup lives -- files under
// frontend/public/assets/svg/, id-referenced from Mongo, never inline.
//
// Reads from the already-committed `data/questionBank.json` (the seed
// source), NOT from a live database connection -- the canonical content
// already sits in git, so this needs no MONGODB_URI and is safe to run
// anywhere. See docs/question-authoring-and-assets.md for the "one place"
// rule this closes the last gap in.
//
// Output: frontend/public/assets/svg/legacy-question-bank/<id>.svg (one
// file per question) + manifest.json mapping id -> filename + basic
// metadata. Kept in its OWN directory, separate from the reusable
// authoring-theme catalog under assets/svg/questions/ -- these are 1,202
// unique, one-off legacy illustrations, not a small set of reusable themes
// with variants, and mixing the two concepts into one manifest would make
// both harder to reason about.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { questionBankId } from './db';
import { escapeStraySvgText } from './utils/svgEscape';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, '../../data/questionBank.json');
const OUT_DIR = path.resolve(__dirname, '../../frontend/public/assets/svg/legacy-question-bank');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

interface LegacyQuestion {
  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml: string;
}

interface ManifestEntry {
  id: string;
  file: string;
  level: number;
  section: string;
  questionNumber: number;
  bytes: number;
}

function main() {
  const raw: LegacyQuestion[] = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));
  console.log(`Read ${raw.length} questions from ${SOURCE}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: ManifestEntry[] = [];
  const seenIds = new Set<string>();
  let skippedEmpty = 0;
  let escapedCount = 0;

  for (const q of raw) {
    const id = questionBankId(q.level, q.section, q.questionNumber);

    if (seenIds.has(id)) {
      throw new Error(`Duplicate question id ${id} -- identity collision, aborting before writing a partial set.`);
    }
    seenIds.add(id);

    const rawSvg = (q.svgHtml ?? '').trim();
    if (!rawSvg) {
      skippedEmpty++;
      continue;
    }
    if (!rawSvg.startsWith('<svg')) {
      throw new Error(`${id}: svgHtml does not start with <svg> -- not a standalone document, needs a different handler.`);
    }

    const svg = escapeStraySvgText(rawSvg);
    if (svg !== rawSvg) escapedCount++;

    const file = `${id}.svg`;
    fs.writeFileSync(path.join(OUT_DIR, file), svg, 'utf-8');
    manifest.push({
      id,
      file,
      level: q.level,
      section: q.section,
      questionNumber: q.questionNumber,
      bytes: Buffer.byteLength(svg, 'utf-8'),
    });
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  console.log(`Wrote ${manifest.length} SVG files to ${OUT_DIR}`);
  if (skippedEmpty > 0) console.log(`Skipped ${skippedEmpty} question(s) with empty svgHtml.`);
  if (escapedCount > 0) console.log(`Escaped stray unescaped <, > or & in ${escapedCount} question(s) -- these were invalid XML before extraction (tolerated by the old dangerouslySetInnerHTML render, not by a standalone .svg file).`);
  console.log(`Manifest: ${MANIFEST}`);
}

main();
