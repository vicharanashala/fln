// Read-only Aadhaar-at-rest audit (Phase 2 hardening).
//
// Answers, with totals only:
//   1. How many student docs appear to contain RAW Aadhaar?
//   2. How many docs lack aadhaarIdentityId?
//   3. How many docs are already fully tokenized?
//   4. Any unexpected Aadhaar-related fields?
//
// Guarantees:
//   - READ-ONLY: no document is created, modified, or deleted.
//   - Never prints Aadhaar values, tokens, or identity ids.
//   - Never calls detokenization or any vault endpoint.
//
// Usage:
//   cd backend
//   MONGODB_URI=... npx tsx scripts/audit-aadhaar-at-rest.ts   # audit MongoDB
//   npx tsx scripts/audit-aadhaar-at-rest.ts                   # audit local file store
import 'dotenv/config';
import { connectDB, dbStore } from '../src/db';

const KNOWN_AADHAAR_FIELDS = new Set(['aadharMasked', 'aadhaarTokenId', 'aadhaarIdentityId']);

interface AuditTally {
  total: number;
  rawMaskExact: number;      // aadharMasked is exactly 12 digits → almost certainly raw
  rawMaskEmbedded: number;   // aadharMasked contains a 12-digit run but is not exactly 12 digits
  missingIdentityId: number; // no aadhaarIdentityId
  fullyTokenized: number;    // mask shape + token + identityId all present
  unexpectedFields: Record<string, number>;
}

function newTally(): AuditTally {
  return { total: 0, rawMaskExact: 0, rawMaskEmbedded: 0, missingIdentityId: 0, fullyTokenized: 0, unexpectedFields: {} };
}

function tallyDoc(t: AuditTally, doc: any): void {
  t.total += 1;
  const mask = typeof doc?.aadharMasked === 'string' ? doc.aadharMasked : '';
  if (/^\d{12}$/.test(mask)) {
    t.rawMaskExact += 1;
  } else if (/\d{12}/.test(mask)) {
    t.rawMaskEmbedded += 1;
  }
  const hasIdentity = typeof doc?.aadhaarIdentityId === 'string' && doc.aadhaarIdentityId.length > 0;
  const hasToken = typeof doc?.aadhaarTokenId === 'string' && doc.aadhaarTokenId.length > 0;
  const looksMasked = /^XXXX-XXXX-\d{4}$/.test(mask);
  if (!hasIdentity) t.missingIdentityId += 1;
  if (looksMasked && hasToken && hasIdentity) t.fullyTokenized += 1;
  for (const key of Object.keys(doc || {})) {
    if (/^aadhaa?r/i.test(key) && !KNOWN_AADHAAR_FIELDS.has(key)) {
      t.unexpectedFields[key] = (t.unexpectedFields[key] || 0) + 1;
    }
  }
}

function printReport(t: AuditTally, source: string): void {
  console.log('──────────────────────────────────────────────');
  console.log(`Aadhaar-at-rest audit — source: ${source}`);
  console.log('──────────────────────────────────────────────');
  console.log(`total student documents scanned:         ${t.total}`);
  console.log(`raw Aadhaar (aadharMasked == 12 digits): ${t.rawMaskExact}`);
  console.log(`raw Aadhaar embedded (12-digit run):     ${t.rawMaskEmbedded}`);
  console.log(`missing aadhaarIdentityId:               ${t.missingIdentityId}`);
  console.log(`fully tokenized (mask+token+identity):   ${t.fullyTokenized}`);
  const unexpectedKeys = Object.keys(t.unexpectedFields);
  if (unexpectedKeys.length === 0) {
    console.log('unexpected Aadhaar-related fields:        none');
  } else {
    console.log('unexpected Aadhaar-related fields:');
    for (const key of unexpectedKeys) console.log(`  - ${key}: ${t.unexpectedFields[key]} document(s)`);
  }
  console.log('──────────────────────────────────────────────');
  console.log('This is a READ-ONLY audit. No data was modified.');
}

async function main(): Promise<void> {
  await connectDB();     // repository convention (see reseed.ts); no-op without MONGODB_URI
  await dbStore.init();  // wires the Mongo handle or loads the file store

  const t = newTally();
  const db = dbStore.getDb();
  if (db) {
    // Mongo path: cursor with a narrow projection — only Aadhaar-relevant
    // fields are pulled across the wire, and only counters are kept.
    const projection = { aadharMasked: 1, aadhaarTokenId: 1, aadhaarIdentityId: 1 };
    const cursor = db.collection('students').find({}, { projection: projection as any });
    let scannedViaCursor = 0;
    while (await cursor.hasNext()) {
      tallyDoc(t, await cursor.next());
      scannedViaCursor += 1;
    }
    await cursor.close();
    printReport(t, `MongoDB collection "students" (${scannedViaCursor} docs)`);
  } else {
    // Local file-fallback store.
    const students = await dbStore.getStudents();
    students.forEach(s => tallyDoc(t, s));
    printReport(t, 'local file store (data/db.json)');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[aadhaar-audit] failed:', err?.message || err);
  process.exit(1);
});
