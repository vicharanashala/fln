/**
 * Classify existing question templates against the intent model, and report.
 *
 * Deliberately a REPORT, not a rewrite. A stored `stem` is a sentence a human
 * wrote for children; turning it into a generation intent is a judgement about
 * pedagogy, and a script that guessed would produce plausible-looking intents
 * that nobody reviewed. So this marks rows and tells you which need a person.
 *
 * Run:  npx tsx backend/src/migrations/questionTemplateIntentV1.ts [--apply]
 *
 * Without --apply it only prints. With --apply it sets `paramMode` and moves
 * nothing else: `stem` and `answerSpec` are left exactly as they are.
 */

import 'dotenv/config';
import { dbStore, connectDB, QuestionTemplate } from '../db';

export type Classification = 'structured' | 'legacy-free-text' | 'hybrid' | 'needs-review';

/**
 * Decide what a stored row is, without touching it.
 *
 * A row with both an intent and a stem is `hybrid` rather than either one: it
 * was authored under one model and edited under the other, and only a human
 * can say which half is now authoritative.
 */
export function classify(t: Pick<QuestionTemplate, 'generationIntent' | 'stem' | 'answerSpec'>): Classification {
  const hasIntent = Boolean((t.generationIntent ?? '').trim());
  const hasLegacy = Boolean((t.stem ?? '').trim()) || Boolean((t.answerSpec ?? '').trim());

  if (hasIntent && !hasLegacy) return 'structured';
  if (!hasIntent && hasLegacy) return 'legacy-free-text';
  if (hasIntent && hasLegacy) return 'hybrid';
  return 'needs-review';
}

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB();
  await dbStore.init();

  const templates = await dbStore.getQuestionTemplates(true);
  const buckets: Record<Classification, QuestionTemplate[]> = {
    'structured': [], 'legacy-free-text': [], 'hybrid': [], 'needs-review': [],
  };
  for (const t of templates) buckets[classify(t)].push(t);

  console.log(`\nquestionTemplates: ${templates.length} row(s)\n`);
  for (const [name, rows] of Object.entries(buckets)) {
    console.log(`  ${name.padEnd(18)} ${rows.length}`);
  }

  if (buckets['legacy-free-text'].length || buckets['hybrid'].length || buckets['needs-review'].length) {
    console.log('\nRows a person must look at:');
    for (const t of [...buckets['legacy-free-text'], ...buckets['hybrid'], ...buckets['needs-review']]) {
      console.log(`  ${t.id}  ${t.conceptId}  stem="${(t.stem ?? '').slice(0, 60)}"`);
    }
    console.log('\nNo intent has been written for these. Nothing was invented on their behalf.');
  }

  if (apply) {
    let touched = 0;
    for (const [name, rows] of Object.entries(buckets)) {
      if (name === 'needs-review') continue;
      for (const t of rows) {
        if (t.paramMode === name) continue;
        await dbStore.updateQuestionTemplate(t.id, { paramMode: name as QuestionTemplate['paramMode'] });
        touched++;
      }
    }
    console.log(`\nApplied: paramMode set on ${touched} row(s). stem and answerSpec untouched.`);
  } else {
    console.log('\nDry run. Pass --apply to write paramMode.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
