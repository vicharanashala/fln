/* eslint-disable no-console */
/**
 * Migrate existing FLN Atlas data to add Class 1 students.
 *
 * For each existing school, append one Class 1 teacher, one Class 1 class
 * record, and 20 Class 1 students — mirroring the seed.ts CLASSES=['Class 2',
 * 'Class 3','Class 4'] pattern, but without dropping any existing data.
 *
 * Usage:
 *   tsx scripts/add_class1_students.ts --dry-run     # log plan, no writes
 *   tsx scripts/add_class1_students.ts --apply       # insert into Atlas
 *
 * Reads MONGODB_URI from the backend/.env file (same source as `npm run dev:backend`).
 */
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

type School = { id: string; stateCode: string; districtCode: string; blockCode: string };

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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Class 1 student generator (mirrors seed.ts lines 437-463 with class-specific fields)
function buildClass1Batch(school: School) {
  const schoolId = school.id;
  const schoolIdLower = schoolId.toLowerCase();
  const teacherId = `u_tch_${schoolId}_C1`;
  const classId = `c_${schoolId}_C1`;

  const teacher = {
    id: teacherId,
    email: `teacher.${schoolIdLower}.c1@fln.org`,
    name: 'Class 1 Teacher',
    role: 'teacher',
    schoolId: schoolId,
    passwordHash: SEED_PASSWORD_HASH,
  };

  const classRec = {
    id: classId,
    schoolId: schoolId,
    className: 'Class 1',
    section: 'A',
    teacherId: teacherId,
  };

  const students: any[] = [];
  for (let stIdx = 0; stIdx < 20; stIdx++) {
    const studentId = `s_${schoolId}_C1_${pad2(stIdx + 1)}`;
    // Class 1: lower starting levels (cap at 10), age 6-7
    const currentLevel = Math.floor(Math.random() * 10) + 1;          // 1..10
    const currentSubLevel = Math.floor(Math.random() * 3);             // 0..2
    students.push({
      id: studentId,
      name: `Class 1 Student ${pad2(stIdx + 1)}`,
      age: 6 + Math.floor(Math.random() * 2),                           // 6..7
      classGroup: 'Class 1',
      section: 'A',
      schoolId: schoolId,
      teacherId: teacherId,
      currentLevel,
      currentSubLevel,
      targetLevel: Math.min(currentLevel + 1, 93),
      aadharMasked: `XXXX-XXXX-${pad2(1000 + Math.floor(Math.random() * 9000))}`,
      levelHistory: [
        {
          level: currentLevel,
          date: '2026-04-10',
          reason: 'Onboarding Diagnostic Placement',
        },
      ],
      streak: Math.floor(Math.random() * 20),
    });
  }

  return { teacher, classRec, students };
}

async function loadSeedPasswordHash(client: MongoClient): Promise<string> {
  // Reuse the existing superadmin passwordHash (matches bcrypt.hashSync('Fln@2026', 10)).
  // Avoids pulling in bcrypt as a runtime dep here.
  const db = client.db();
  const superadmin = await db.collection('users').findOne({ id: 'u_sup_01' });
  if (!superadmin || !('passwordHash' in superadmin) || !superadmin.passwordHash) {
    throw new Error('Cannot find existing superadmin passwordHash to reuse');
  }
  return superadmin.passwordHash as string;
}

let SEED_PASSWORD_HASH = ''; // populated in main() once we connect

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  if (mode === 'dry-run') {
    console.log('=== DRY RUN — no writes ===\n');
  } else {
    console.log('=== APPLY — writing to Atlas ===\n');
  }

  const uri = loadMongoUri();
  console.log(`Connecting to MongoDB...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log(`Database: ${db.databaseName}\n`);

  // Pull the existing superadmin's password hash to use for new teachers
  SEED_PASSWORD_HASH = await loadSeedPasswordHash(client);
  console.log(`Loaded seed password hash (length ${SEED_PASSWORD_HASH.length})\n`);

  // Load all existing schools
  const schoolDocs = await db.collection('schools').find({}).toArray();
  const schools = schoolDocs as unknown as School[];
  console.log(`Found ${schools.length} schools in db.schools`);

  // Build the full Class 1 batch
  const teachers: any[] = [];
  const classes: any[] = [];
  const students: any[] = [];
  for (const school of schools) {
    const batch = buildClass1Batch(school);
    teachers.push(batch.teacher);
    classes.push(batch.classRec);
    students.push(...batch.students);
  }

  // Check for conflicts — if any of these IDs already exist, skip that school
  console.log('\nChecking for ID conflicts...');
  const teacherIds = teachers.map((t) => t.id);
  const classIds = classes.map((c) => c.id);
  const studentIds = students.map((s) => s.id);

  const [existingTeachers, existingClasses, existingStudents] = await Promise.all([
    db.collection('users').countDocuments({ id: { $in: teacherIds } }),
    db.collection('classes').countDocuments({ id: { $in: classIds } }),
    db.collection('students').countDocuments({ id: { $in: studentIds } }),
  ]);
  console.log(`  existing teachers with these IDs: ${existingTeachers}`);
  console.log(`  existing classes  with these IDs: ${existingClasses}`);
  console.log(`  existing students with these IDs: ${existingStudents}`);

  if (existingTeachers || existingClasses || existingStudents) {
    console.log('\n!! Some IDs already exist — would skip those schools in a real run.');
  }

  console.log('\n=== Plan ===');
  console.log(`  teachers (users):   ${teachers.length}`);
  console.log(`  classes:            ${classes.length}`);
  console.log(`  students:           ${students.length}`);

  // Sample IDs for verification
  if (schools.length > 0) {
    const s = schools[0];
    console.log(`\nSample (first school: ${s.id}):`);
    console.log(`  teacher:    ${teachers[0].id}  ${teachers[0].email}`);
    console.log(`  class:      ${classes[0].id}  ${classes[0].className}`);
    console.log(`  students:   ${students.slice(0, 3).map((x) => x.id).join(', ')}, ...`);
    console.log(`  first student doc:`);
    console.log('    ' + JSON.stringify(students[0], null, 2).split('\n').join('\n    '));
  }

  if (mode === 'dry-run') {
    console.log('\n(dry-run only — pass --apply to write to Atlas)');
    await client.close();
    return;
  }

  // === APPLY MODE ===
  console.log('\nInserting...');

  // Filter out any schools whose IDs already exist (idempotency / safety net)
  const conflictingTeacherIds = new Set(
    (await db.collection('users').find({ id: { $in: teacherIds } }, { projection: { id: 1 } }).toArray())
      .map((d) => d.id)
  );
  const teacherConflictIdx = new Set<number>();
  teachers.forEach((t, i) => { if (conflictingTeacherIds.has(t.id)) teacherConflictIdx.add(i); });

  const safeTeachers = teachers.filter((_, i) => !teacherConflictIdx.has(i));
  const safeClassRecs = classes.filter((_, i) => !teacherConflictIdx.has(i));
  const safeStudents = students.filter((_, i) => !teacherConflictIdx.has(Math.floor(i / 20)));

  console.log(`  safe to insert — teachers: ${safeTeachers.length}, classes: ${safeClassRecs.length}, students: ${safeStudents.length}`);

  const tRes = await db.collection('users').insertMany(safeTeachers);
  console.log(`  teachers inserted:    ${tRes.insertedCount}`);
  const cRes = await db.collection('classes').insertMany(safeClassRecs);
  console.log(`  classes inserted:     ${cRes.insertedCount}`);
  const sRes = await db.collection('students').insertMany(safeStudents);
  console.log(`  students inserted:    ${sRes.insertedCount}`);

  // Verify
  const after = {
    users: await db.collection('users').countDocuments({ id: { $in: safeTeachers.map((t) => t.id) } }),
    classes: await db.collection('classes').countDocuments({ id: { $in: safeClassRecs.map((c) => c.id) } }),
    students: await db.collection('students').countDocuments({ id: { $in: safeStudents.map((s) => s.id) } }),
  };
  console.log('\n=== Verified in DB ===');
  console.log(`  users:    ${after.users}`);
  console.log(`  classes:  ${after.classes}`);
  console.log(`  students: ${after.students}`);

  await client.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});