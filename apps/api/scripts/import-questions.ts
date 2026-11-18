// Adds the Balvatika pilot questions (or any file of questions) to the v2 database as drafts. Run on the server.
//
//   On the server:  bash deploy/import-questions.sh someone@example.org            (shows what would happen, writes nothing)
//                   bash deploy/import-questions.sh someone@example.org apply      (writes the drafts)
//
// The questions are drafts: a superadmin approves them in the app, one by one, before any teacher sees them.
// Safe to run twice; a question already there is skipped.
import { readFileSync } from 'node:fs';
import { importQuestions } from '../src/importQuestions';
import { connectMongo } from '../src/mongoRepos';

const [file, email, mode] = process.argv.slice(2);
const uri = process.env.MONGODB_URI;
if (!file || !email || !uri) { console.error('Usage: MONGODB_URI=... node import-questions.mjs <file.json> <superadmin email> [apply]'); process.exit(1); }

const store = await connectMongo(uri, process.env.MONGODB_DB ?? 'fln_v2');
try {
  await store.syncLevels(); // the API does this at every start; here it makes the script work on a database the API has not started on yet
  const user = await store.repos.users.byEmail(email);
  if (!user || user.role !== 'superadmin') { console.error('That email is not a superadmin account. Nothing was changed.'); process.exit(1); }
  const report = await importQuestions(store.repos, JSON.parse(readFileSync(file, 'utf8')), user.id, mode === 'apply');
  if (report.applied) console.log(`Added ${report.added} draft question(s); ${report.alreadyThere} were already there (of ${report.total} in the file).`);
  else console.log(`Dry run: ${report.total - report.alreadyThere} question(s) would be added, ${report.alreadyThere} are already there (of ${report.total} in the file). Nothing was written. Add "apply" to write them.`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await store.close();
}
