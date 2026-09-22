// Seeds one structured QuestionTemplate per Stage-3 (Balvatika) node into
// MongoDB, plus S1.8 (the event-sequencing node split off S3.6, living in
// Stage 1).
//
//   npm run seed:balvatika-questions               # upsert all rows
//   npm run seed:balvatika-questions -- --dry-run  # report only, write nothing
//
// Why this exists: PR #525 finalized the question<->skill DATABASE
// STRUCTURE (QuestionTemplate.conceptId + skills[] + subskills[] +
// assessmentMode). This script is the first real CONTENT written into that
// structure for Balvatika -- one template per node, sourced from the same
// NCF-FS citations already embedded in curriculumMap.ts's comments and the
// sheet-type (student/teacher/both) assignments from PR #517 section 5's
// outcome table.
//
// IMPORTANT CAVEAT, not hidden: as of 2026-09-19, nothing in the codebase
// reads `questionTemplates` to actually render a worksheet item (see issue
// #486, "Generation pipeline must consume questionTemplates" -- confirmed
// unresolved by direct grep before this script was written). These rows are
// real, reviewable curriculum intent, not yet anything a student or teacher
// will see. Content-authoring and pipeline-wiring were a deliberate decision
// to treat as separate concerns for this pass, not an oversight.
//
// Idempotency contract:
//   - matched on `conceptId` (one seed template per concept, not per
//     variation -- a Superadmin can author additional variants through the
//     normal authoring UI once this exists; this script only ever owns the
//     one row it created)
//   - `id` is written with $setOnInsert and never regenerated
//   - everything else is refreshed on every run, so correcting a row here
//     and re-running is the supported way to fix it

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGODB_URI is not set. Refusing to guess a connection string.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

interface SeedRow {
  conceptId: string;
  skills: string[];
  subskills: string[];
  questionFamily: string;
  assessmentMode: 'written' | 'observed' | 'both';
  generationIntent: string;
  svgThemeIds: string[];
  subjectCategory: string | null;
  name: string;
}

// One row per Stage-3 (Balvatika) node, plus S1.8. Sheet-type
// (written/observed/both) taken from PR #517 section 5's outcome table;
// skills/subskills match the assignments authored into
// frontend/src/data/skillProgressionMap.ts (PR #524); generationIntent is a
// fresh instruction sourced from the same NCF-FS competency each node cites
// in curriculumMap.ts's comments -- not copied from any single source
// verbatim, written to match this platform's existing intent style
// (learning action + visual behaviour + how the answer is given, no
// specific numbers/objects, per QuestionTemplate.generationIntent's own
// documented contract).
const ROWS: SeedRow[] = [
  { conceptId: 'S1.8', skills: ['SK03'], subskills: [], questionFamily: 'sequencing', assessmentMode: 'both',
    generationIntent: 'Show 3-4 pictures of a familiar daily routine (waking up, brushing teeth, eating breakfast, going to school) in scrambled order. The child arranges or numbers them in the correct sequence.',
    svgThemeIds: [], subjectCategory: null, name: 'Daily Routine Sequencing' },

  { conceptId: 'S3.1', skills: ['SK08'], subskills: ['SK08.01'], questionFamily: 'counting', assessmentMode: 'written',
    generationIntent: 'Show a numeral in large print beside several sets of objects with different counts. The child circles or points to the set whose count matches the numeral shown.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Numeral Recognition (1-10)' },

  { conceptId: 'S3.2', skills: ['SK08', 'SK06'], subskills: ['SK08.02'], questionFamily: 'counting', assessmentMode: 'both',
    generationIntent: 'Show a numeral (1-10) beside several sets of objects varying in count. The child draws a line matching the numeral to the set with the same quantity.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Numeral-Quantity Correspondence' },

  { conceptId: 'S3.3', skills: ['SK09'], subskills: ['SK09.03'], questionFamily: 'comparison', assessmentMode: 'written',
    generationIntent: 'Show two sets of objects with different counts, with a numeral written beneath each set. The child circles the numeral that is more, or the numeral that is less, per the question asked.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Numeral Comparison (Object-Mediated)' },

  { conceptId: 'S3.4', skills: ['SK03'], subskills: ['SK03.02'], questionFamily: 'comparison', assessmentMode: 'both',
    generationIntent: 'Show up to 5 objects (e.g. sticks or pencils) of visibly different sizes, out of order. The child orders them from smallest to largest (or shortest to longest) by numbering each object, without any comparison requiring transitive inference across more than one pair at a time.',
    svgThemeIds: [], subjectCategory: 'classroom-objects', name: 'Seriation (Up to 5 Objects)' },

  { conceptId: 'S3.5', skills: ['SK02'], subskills: ['SK02.05'], questionFamily: 'classification', assessmentMode: 'both',
    generationIntent: 'Show a mixed set of objects varying by shape, colour and size. First ask the child to circle or group the objects sharing one property (e.g. colour); then ask them to re-sort the same set by a different property (e.g. shape), showing they can flexibly reclassify.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Flexible Classification' },

  { conceptId: 'S3.6', skills: ['SK10'], subskills: ['SK10.01'], questionFamily: 'sequencing', assessmentMode: 'written',
    generationIntent: 'Show a sequence of numerals from 1 up to 20 with one or two numerals missing. The child writes the missing numeral(s) in the correct position, in correct sequence.',
    svgThemeIds: [], subjectCategory: null, name: 'Numeral Sequencing' },

  { conceptId: 'S3.7', skills: ['SK20'], subskills: [], questionFamily: 'vocabulary', assessmentMode: 'both',
    generationIntent: 'Show three objects differing in length or weight. The child circles the correct comparative word (e.g. longer/shorter, heavier/lighter) describing the relationship between two of the objects, or uses the word verbally when a teacher asks.',
    svgThemeIds: [], subjectCategory: 'classroom-objects', name: 'Comparative Vocabulary (Formalizing)' },

  { conceptId: 'S3.8', skills: ['SK18'], subskills: ['SK18.04'], questionFamily: 'pattern', assessmentMode: 'written',
    generationIntent: 'Show a repeating pattern of 2 or 3 items (shapes or colours) with the next one or two items left blank. The child draws or colours what comes next in the pattern.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Patterns (2-Item / 3-Item Extension)' },

  { conceptId: 'S3.10', skills: ['SK19'], subskills: ['SK19.04'], questionFamily: 'shape', assessmentMode: 'written',
    generationIntent: 'Show a set of simple shape pieces (e.g. triangles, squares) that can be combined to form a recognisable picture, such as a house or a boat. The child arranges or colours the pieces to complete the picture, demonstrating shape composition.',
    svgThemeIds: [], subjectCategory: null, name: 'Shape Composition & Decomposition' },

  { conceptId: 'S3.11', skills: ['SK05'], subskills: ['SK05.05'], questionFamily: 'counting', assessmentMode: 'observed',
    generationIntent: 'The teacher asks the child to recite number names aloud from 1 to 20, without counting any objects. The teacher records whether the child completes the sequence fluently, hesitates at specific points, or stops early.',
    svgThemeIds: [], subjectCategory: null, name: 'Number Names to 20 (Rote)' },

  { conceptId: 'S3.12', skills: ['SK06'], subskills: ['SK06.01'], questionFamily: 'counting', assessmentMode: 'observed',
    generationIntent: 'The teacher gives the child a small handful of objects and asks them to count the objects starting from any object of their choosing, not necessarily left to right. The teacher records whether the child reaches the same total regardless of the order counted.',
    svgThemeIds: [], subjectCategory: 'classroom-objects', name: 'Counts in Any Order (Order Irrelevance)' },

  { conceptId: 'S3.13', skills: ['SK08'], subskills: ['SK08.05'], questionFamily: 'counting', assessmentMode: 'written',
    generationIntent: 'Show a set of counted objects (1 to 9) beside a blank box. The child writes the numeral matching the count of objects shown.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Writes Numerals to 9' },

  { conceptId: 'S3.14', skills: ['SK13'], subskills: ['SK13.01'], questionFamily: 'operation', assessmentMode: 'both',
    generationIntent: "Show two small groups of objects whose combined total is 9 or fewer, with no plus symbol shown. The child counts the combined total across both groups and writes or circles the resulting number, without being shown the '+' symbol at this stage.",
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Combines Groups to 9 (Object-Based, No Symbol)' },

  { conceptId: 'S3.15', skills: ['SK14'], subskills: ['SK14.01'], questionFamily: 'operation', assessmentMode: 'both',
    generationIntent: "Show a group of 9 or fewer objects with some visibly removed or crossed out, with no minus symbol shown. The child counts the objects remaining and writes or circles the resulting number, without being shown the '-' symbol at this stage.",
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Takes Away to 9 (Object-Based, No Symbol)' },

  { conceptId: 'S3.16', skills: ['SK15'], subskills: ['SK15.01'], questionFamily: 'operation', assessmentMode: 'observed',
    generationIntent: 'The teacher gives the child a set of objects and asks them to arrange the objects into equal-sized small groups (e.g. groups of 2 or 3). The teacher records whether the child forms the groups correctly and can state how many groups resulted.',
    svgThemeIds: [], subjectCategory: 'classroom-objects', name: 'Makes Groups & Counts Objects/Groups' },

  { conceptId: 'S3.17', skills: ['SK16'], subskills: ['SK16.01'], questionFamily: 'operation', assessmentMode: 'both',
    generationIntent: "Show a set of up to 20 objects and 4 to 5 recipients (e.g. drawn figures or plates). The child distributes the objects one at a time to each recipient until shared equally, then records or shows the resulting share per recipient.",
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Shares Objects Equally (Up to 20, Among 4-5)' },

  { conceptId: 'S3.18', skills: ['SK18'], subskills: [], questionFamily: 'pattern', assessmentMode: 'both',
    generationIntent: 'Give the child a set of shapes, colours or objects with no pattern shown. The child creates their own repeating pattern using at least one feature (colour, shape, or size); the teacher checks the pattern genuinely repeats.',
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Creates a New Pattern' },

  { conceptId: 'S3.19', skills: ['SK18'], subskills: ['SK18.08'], questionFamily: 'pattern', assessmentMode: 'observed',
    generationIntent: "Show the child a completed repeating pattern. The teacher asks the child to describe the pattern's rule in their own words (e.g. 'red, blue, red, blue') and records whether the child can articulate the repeating unit.",
    svgThemeIds: [], subjectCategory: 'mixed', name: "Describes a Repeating Pattern's Rule" },

  { conceptId: 'S3.20', skills: ['SK19'], subskills: [], questionFamily: 'shape', assessmentMode: 'observed',
    generationIntent: "The teacher hands the child a real 3D object (e.g. a ball, a box, a cone). The child describes the object's physical features in their own words (e.g. 'it rolls', 'it has corners'); the teacher records the description given, not whether formal shape names were used.",
    svgThemeIds: [], subjectCategory: null, name: 'Describes 3D Solids in Own Words' },

  { conceptId: 'S3.21', skills: ['SK19'], subskills: ['SK19.09'], questionFamily: 'shape', assessmentMode: 'observed',
    generationIntent: 'The teacher gives the child a 3D object and a sheet of paper. The child traces one flat face of the object onto the paper; the teacher records whether the resulting outline is recognisable and correctly placed.',
    svgThemeIds: [], subjectCategory: null, name: 'Traces Faces of 3D Objects' },

  { conceptId: 'S3.22', skills: ['SK19'], subskills: [], questionFamily: 'shape', assessmentMode: 'written',
    generationIntent: 'Ask the child to draw a named 2D shape (circle, square, or triangle) freehand, without tracing. The drawing is evaluated for reasonable recognisability, not precise accuracy.',
    svgThemeIds: [], subjectCategory: null, name: 'Draws 2D Shapes Freehand' },

  { conceptId: 'S3.23', skills: ['SK20'], subskills: ['SK20.03'], questionFamily: 'comparison', assessmentMode: 'observed',
    generationIntent: "The teacher shows the child two vessels of different shapes or sizes, each containing water or sand. The child predicts which vessel holds more, then observes the actual comparison; the teacher records the child's prediction, reasoning, and final answer.",
    svgThemeIds: [], subjectCategory: null, name: 'Compares Capacity of Two Vessels' },

  { conceptId: 'S3.24', skills: ['SK21'], subskills: ['SK21.03'], questionFamily: 'calendar', assessmentMode: 'observed',
    generationIntent: 'The teacher asks the child to name the days of the week in order, and separately, the months of the year. The teacher records fluency and notes any specific gaps.',
    svgThemeIds: [], subjectCategory: null, name: 'Names Days of the Week & Months' },

  { conceptId: 'S3.25', skills: ['SK24'], subskills: [], questionFamily: 'reasoning', assessmentMode: 'observed',
    generationIntent: "The teacher poses a simple oral number riddle within the child's known number range (e.g. 'I am more than 3 and less than 5 -- what number am I?'). The child answers orally; the teacher records whether the answer is correct.",
    svgThemeIds: [], subjectCategory: null, name: 'Solves Simple Number Riddles/Puzzles' },

  { conceptId: 'S4.12', skills: ['SK08'], subskills: ['SK08.09'], questionFamily: 'counting', assessmentMode: 'written',
    generationIntent: "Show a set of objects being removed one at a time, ending with none left. The child identifies or writes '0' to represent that nothing remains.",
    svgThemeIds: [], subjectCategory: 'mixed', name: 'Concept of Zero' },

  { conceptId: 'S4.13', skills: ['SK10'], subskills: ['SK10.06'], questionFamily: 'sequencing', assessmentMode: 'written',
    generationIntent: 'Show a row of objects or characters in a line. The child circles or names the object in a given ordinal position (e.g. "the 3rd animal in line").',
    svgThemeIds: [], subjectCategory: 'animals', name: 'Ordinal Positions (1st-10th)' },

  { conceptId: 'S5.9', skills: ['SK22'], subskills: ['SK22.01'], questionFamily: 'vocabulary', assessmentMode: 'written',
    generationIntent: 'Show pictures of common Indian currency notes and coins. The child names or matches each to its correct value.',
    svgThemeIds: [], subjectCategory: null, name: 'Currency Recognition' },

  { conceptId: 'S5.13', skills: ['SK19'], subskills: ['SK19.08'], questionFamily: 'vocabulary', assessmentMode: 'both',
    generationIntent: 'Show a picture scene containing familiar objects (e.g. a box, a table, a chair). The child identifies or uses positional words (inside, outside, on, under, beside) to describe where an object is located relative to another.',
    svgThemeIds: [], subjectCategory: 'classroom-objects', name: 'Spatial Vocabulary' },
];

async function main() {
  const client = new MongoClient(MONGO_URI!);
  await client.connect();
  const db = client.db();
  const coll = db.collection('questionTemplates');

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of ROWS) {
    const existing = await coll.findOne({ conceptId: row.conceptId, source: 'seed:balvatika' });
    const id = existing?.id ?? ('qtpl_' + randomUUID().slice(0, 8));

    const doc = {
      id,
      conceptId: row.conceptId,
      // levelNumber/levelName are display aliases only, resolved from
      // conceptId at write time (per QuestionTemplate's own contract) --
      // this script does not hardcode them, so a future level-number shift
      // never requires re-running this seed.
      skills: row.skills,
      subskills: row.subskills,
      assessmentMode: row.assessmentMode,
      generationIntent: row.generationIntent,
      questionFamily: row.questionFamily,
      paramMode: 'structured',
      svgThemeIds: row.svgThemeIds,
      stem: '',
      answerSpec: '',
      numeralRange: null,
      digitCount: null,
      operations: [],
      maxOperandCount: null,
      carryBehavior: null,
      borrowBehavior: null,
      maxSumOrDifference: null,
      answerType: null,
      blankCount: null,
      questionCount: 1,
      subjectCategory: row.subjectCategory,
      name: row.name,
      variantKey: row.conceptId + ':seed:balvatika:v1',
      tags: ['balvatika', 'seed'],
      source: 'seed:balvatika',
      createdBy: 'system-seed',
      createdByEmail: 'system-seed@fln.internal',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: 'system-seed',
      updatedByEmail: 'system-seed@fln.internal',
      deletedAt: null,
      deletedBy: null,
    };

    if (DRY_RUN) {
      console.log(existing ? `[dry-run] would update ${row.conceptId}` : `[dry-run] would insert ${row.conceptId}`);
      continue;
    }

    await coll.updateOne({ id }, { $set: doc }, { upsert: true });
    if (existing) updated++; else inserted++;
  }

  console.log(`Done. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}, Total rows: ${ROWS.length}`);
  await client.close();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
