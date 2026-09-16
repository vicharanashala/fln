/**
 * Remove inline SVG/HTML markup from the two legacy collections that still
 * store it directly in Mongo, now that both have a file-based replacement:
 *
 *   - questionBank.svgHtml       -> frontend/public/assets/svg/legacy-question-bank/*.svg
 *                                   (see extractQuestionBankSvgs.ts; already run,
 *                                   files + manifest.json committed)
 *   - levelHtmlTemplates.htmlContent -> "FLN SVG HTML files(22-59)/*.html
 *                                   (the original source files -- this collection
 *                                   was always just a re-seed of them, and nothing
 *                                   in the active codebase reads htmlContent back
 *                                   out; QuestionReviewPanel.tsx is the only real
 *                                   consumer of svgHtml, and it's already been
 *                                   repointed at the file-based lookup)
 *
 * This closes the last gap in the "SVG markup lives in exactly one place"
 * decision -- see docs/question-authoring-and-assets.md.
 *
 * Deliberately a REPORT by default, matching questionTemplateIntentV1.ts's
 * convention. Run:
 *
 *   npx tsx backend/src/migrations/cleanInlineSvgFromDb.ts           # dry run
 *   npx tsx backend/src/migrations/cleanInlineSvgFromDb.ts --apply   # actually unset the fields
 *
 * Before writing anything, this checks that the file-based replacement
 * actually exists on disk in the checkout the script is running from, and
 * refuses to touch the database if it doesn't -- so this can never delete
 * the only copy of the data by running against a checkout where the
 * extraction step hasn't happened.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI!;

const QUESTION_BANK_MANIFEST = path.resolve(
  __dirname, '../../../frontend/public/assets/svg/legacy-question-bank/manifest.json'
);
const LEVEL_HTML_DIR = path.resolve(__dirname, '../../../FLN SVG HTML files(22-59)');

async function main() {
  const apply = process.argv.includes('--apply');

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  const db = client.db();

  // --- questionBank.svgHtml ---
  const questionBank = db.collection('questionBank');
  const withSvg = await questionBank.countDocuments({ svgHtml: { $exists: true, $ne: '' } });

  let manifestCount = 0;
  let manifestOk = false;
  if (fs.existsSync(QUESTION_BANK_MANIFEST)) {
    const manifest = JSON.parse(fs.readFileSync(QUESTION_BANK_MANIFEST, 'utf-8'));
    manifestCount = Array.isArray(manifest) ? manifest.length : 0;
    manifestOk = manifestCount >= withSvg;
  }

  console.log(`questionBank: ${withSvg} document(s) still carry inline svgHtml.`);
  console.log(`Extracted-file manifest has ${manifestCount} entr${manifestCount === 1 ? 'y' : 'ies'} (${QUESTION_BANK_MANIFEST}).`);

  if (withSvg > 0 && !manifestOk) {
    console.error(
      'ABORT: the file-based replacement does not cover every row that still has ' +
      'inline svgHtml (or the manifest is missing entirely). Not touching questionBank. ' +
      'Run extractQuestionBankSvgs.ts from a checkout where data/questionBank.json is ' +
      'current, commit the output, and re-run this from that checkout.'
    );
  } else if (withSvg > 0 && apply) {
    const res = await questionBank.updateMany(
      { svgHtml: { $exists: true, $ne: '' } },
      { $unset: { svgHtml: '' } }
    );
    console.log(`Cleaned svgHtml from ${res.modifiedCount} questionBank document(s).`);
  } else if (withSvg > 0) {
    console.log('Dry run -- would clean the above. Pass --apply to actually write.');
  } else {
    console.log('Nothing to clean in questionBank.');
  }

  // --- levelHtmlTemplates.htmlContent ---
  const levelHtmlTemplates = db.collection('levelHtmlTemplates');
  const withHtml = await levelHtmlTemplates.countDocuments({ htmlContent: { $exists: true, $ne: '' } });

  const sourceFileCount = fs.existsSync(LEVEL_HTML_DIR)
    ? fs.readdirSync(LEVEL_HTML_DIR).filter(f => f.endsWith('.html')).length
    : 0;
  const sourceOk = sourceFileCount >= withHtml;

  console.log(`\nlevelHtmlTemplates: ${withHtml} document(s) still carry inline htmlContent.`);
  console.log(`Original source directory has ${sourceFileCount} .html file(s) (${LEVEL_HTML_DIR}).`);

  if (withHtml > 0 && !sourceOk) {
    console.error(
      'ABORT: the original source directory does not cover every row that still has ' +
      'inline htmlContent (or the directory is missing entirely). Not touching levelHtmlTemplates.'
    );
  } else if (withHtml > 0 && apply) {
    const res = await levelHtmlTemplates.updateMany(
      { htmlContent: { $exists: true, $ne: '' } },
      { $unset: { htmlContent: '' } }
    );
    console.log(`Cleaned htmlContent from ${res.modifiedCount} levelHtmlTemplates document(s).`);
  } else if (withHtml > 0) {
    console.log('Dry run -- would clean the above. Pass --apply to actually write.');
  } else {
    console.log('Nothing to clean in levelHtmlTemplates.');
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
