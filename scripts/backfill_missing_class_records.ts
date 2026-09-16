/* eslint-disable no-console */
/**
 * Backfill missing ClassGroup ("classes" collection) documents for
 * students registered before dbStore.ensureClassExists() existed.
 *
 * Root cause: only the original seed data ever populated the `classes`
 * collection. Registering a student (single POST /api/students or
 * POST /api/students/bulk-import) created a Student record tagged with a
 * classGroup/section, but nothing created the matching ClassGroup document
 * those strings imply. Several features key off ClassGroup existing for a
 * teacher/school -- the Teacher Dashboard's class-tab bar (issue #291), and
 * bulk diagnostic generation's authorization check ("You are not
 * authorized to generate diagnostic papers for Class N", reported live on
 * a teacher whose real 9-student Class 2 roster had no ClassGroup record).
 *
 * This is a one-time catch-up for students that predate the fix in
 * createStudentFromData (students.ts) that now calls ensureClassExists()
 * on every new registration going forward. Safe to re-run -- it only
 * inserts a ClassGroup if one doesn't already exist for that
 * schoolId+className+section.
 *
 * Usage:
 *   tsx scripts/backfill_missing_class_records.ts --dry-run   # log plan, no writes
 *   tsx scripts/backfill_missing_class_records.ts --apply     # insert into Atlas
 *
 * Reads MONGODB_URI from the backend/.env file (same source as `npm run dev:backend`).
 */
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

type Student = { id: string; name: string; schoolId: string; classGroup: string; section: string; teacherId?: string };
type ClassGroup = { id: string; schoolId: string; className: string; section: string; teacherId: string };

function loadMongoUri(): string {
  const envPath = path.resolve(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`backend/.env not found at ${envPath}`);
  }
  const text = fs.readFileSync(envPath, 'utf-8');
  const match = text.match(/^MONGODB_URI\s*=\s*(.+)$/m);
  if (!match) throw new Error('MONGODB_URI not set in backend/.env');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  const uri = loadMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const students = await db.collection<Student>('students').find({}).toArray();
  const existingClasses = await db.collection<ClassGroup>('classes').find({}).toArray();
  const existingKeys = new Set(existingClasses.map(c => `${c.schoolId}|${c.className}|${c.section}`));

  // Group students by school+class+section so we backfill one ClassGroup
  // per real combination, not one per student. Prefer the first teacher-
  // owned student's teacherId if any exist in that group (matches how a
  // real teacher's own registrations would have set it going forward);
  // falls back to a placeholder if the group is entirely non-teacher-owned
  // (e.g. a volunteer/admin-registered class) -- ClassGroup.teacherId is a
  // required field but volunteer/admin authorization checks key off
  // schoolId/assignedSchools, not teacherId, so a placeholder there is
  // harmless for those paths.
  const groups = new Map<string, { schoolId: string; className: string; section: string; teacherId: string }>();
  for (const s of students) {
    const key = `${s.schoolId}|${s.classGroup}|${s.section}`;
    if (existingKeys.has(key)) continue;
    if (!groups.has(key)) {
      groups.set(key, { schoolId: s.schoolId, className: s.classGroup, section: s.section, teacherId: s.teacherId || 'unassigned' });
    } else if (s.teacherId && groups.get(key)!.teacherId === 'unassigned') {
      groups.get(key)!.teacherId = s.teacherId;
    }
  }

  console.log(`Found ${students.length} students, ${existingClasses.length} existing ClassGroup records.`);
  console.log(`${groups.size} missing ClassGroup(s) to create:`);
  for (const g of groups.values()) {
    console.log(`  - ${g.schoolId} / ${g.className} / ${g.section} (teacherId: ${g.teacherId})`);
  }

  if (dryRun) {
    console.log('\nDry run only -- no writes made. Re-run with --apply to insert.');
    await client.close();
    return;
  }

  let inserted = 0;
  for (const g of groups.values()) {
    const id = 'c_' + g.schoolId + '_' + g.className.replace(/\s+/g, '') + '_' + g.section;
    await db.collection('classes').updateOne(
      { id },
      { $setOnInsert: { id, ...g } },
      { upsert: true }
    );
    inserted++;
  }
  console.log(`\nApplied: ${inserted} ClassGroup record(s) created (or already existed, safely skipped).`);
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
