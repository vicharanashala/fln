/* eslint-disable no-console */
/**
 * Seed operational logbook entries for local development & testing.
 *
 * Usage:
 *   tsx scripts/seed_logbook.ts --dry-run     # log plan, no writes
 *   tsx scripts/seed_logbook.ts --apply       # insert/upsert into MongoDB
 *
 * Reads MONGODB_URI from backend/.env (if available) or defaults to local mongo.
 */
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  userId: string;
  userEmail: string;
  userRole: string;
  activityType: string;
  status: 'Success' | 'Delayed' | 'Failed';
  details: string;
}

export const SAMPLE_LOGBOOK_ENTRIES: LogEntry[] = [
  {
    id: 'log-20260818-001',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    schoolId: 'gps-mt-001',
    schoolName: 'Model Town Primary School',
    userId: 'usr-teacher-01',
    userEmail: 'vihaan.teacher@fln.gov.in',
    userRole: 'teacher',
    activityType: 'download',
    status: 'Success',
    details: 'Generated and downloaded Class 2 FLN Baseline Diagnostic Worksheets (Set A & Set B)'
  },
  {
    id: 'log-20260818-002',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    schoolId: 'gps-mt-001',
    schoolName: 'Model Town Primary School',
    userId: 'usr-volunteer-02',
    userEmail: 'aarav.volunteer@fln.gov.in',
    userRole: 'volunteer',
    activityType: 'scan',
    status: 'Success',
    details: 'Batch uploaded 28 ICR answer sheets for Grade 3 diagnostic evaluation'
  },
  {
    id: 'log-20260818-003',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    schoolId: 'gps-rkp-002',
    schoolName: 'R.K. Puram Government School',
    userId: 'usr-principal-01',
    userEmail: 'sunita.principal@fln.gov.in',
    userRole: 'school',
    activityType: 'verify',
    status: 'Success',
    details: 'Verified and certified Class 1 foundational numeracy placement records'
  },
  {
    id: 'log-20260818-004',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    schoolId: 'gps-dwr-003',
    schoolName: 'Dwarka Sector 4 Primary School',
    userId: 'usr-teacher-03',
    userEmail: 'priya.teacher@fln.gov.in',
    userRole: 'teacher',
    activityType: 'print',
    status: 'Success',
    details: 'Printed 35 copies of Level 22 (Flexible Classification) remediation sheets'
  },
  {
    id: 'log-20260818-005',
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    schoolId: 'gps-vhr-004',
    schoolName: 'Vasant Vihar School',
    userId: 'usr-block-01',
    userEmail: 'rajesh.block@fln.gov.in',
    userRole: 'block_admin',
    activityType: 'conduct',
    status: 'Success',
    details: 'Initiated block-wide Mid-Year FLN competency audit verification'
  },
  {
    id: 'log-20260818-006',
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    schoolId: 'gps-mt-001',
    schoolName: 'Model Town Primary School',
    userId: 'usr-teacher-01',
    userEmail: 'vihaan.teacher@fln.gov.in',
    userRole: 'teacher',
    activityType: 'ticket',
    status: 'Success',
    details: 'Submitted question clarification ticket for Level 13 (Shape Identification)'
  }
];

function loadMongoUri(): string {
  const envPath = path.resolve(__dirname, '..', 'backend', '.env');
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf-8');
    const match = text.match(/^MONGODB_URI\s*=\s*(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return process.env.MONGODB_URI || 'mongodb://localhost:27017/fln';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  console.log(`[seed_logbook] Preparing to seed ${SAMPLE_LOGBOOK_ENTRIES.length} logbook entries.`);

  if (dryRun) {
    for (const entry of SAMPLE_LOGBOOK_ENTRIES) {
      console.log(`[dry-run] Would upsert log: ${entry.id} (${entry.userRole}: ${entry.activityType}) - "${entry.details}"`);
    }
    console.log('\nDry run complete. Run with `--apply` to persist sample rows to the MongoDB database.');
    return;
  }

  const uri = loadMongoUri();
  console.log(`[seed_logbook] Connecting to MongoDB at ${uri}...`);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const logCol = db.collection<LogEntry>('logbook');

    for (const entry of SAMPLE_LOGBOOK_ENTRIES) {
      await logCol.updateOne(
        { id: entry.id },
        { $set: entry },
        { upsert: true }
      );
      console.log(`[applied] Upserted log: ${entry.id}`);
    }

    console.log('\nLogbook seeding successfully completed.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Error running seed_logbook:', err);
  process.exit(1);
});
