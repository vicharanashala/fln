/**
 * Reusable CSV seeder for the Balvatika question bank (#761).
 *
 * Reads a question-bank CSV file, validates columns and assessment modes,
 * constructs QuestionTemplate documents with status 'pendingApproval' and
 * paramMode 'legacy-free-text', and upserts them idempotently by variantKey.
 *
 * CLI usage:
 *   npm run seed:balvatika-bank -- --file path/to/bank.csv
 *   npm run seed:balvatika-bank -- --file path/to/bank.csv --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { getLevelForConcept } from './config/curriculumMap';
import { getLevel, getSkillsForLevel, getSubskillsForSkills } from './config/skillLevelMap';
import { parseCsv, resolveTemplateTopic, ASSESSMENT_MODES } from './routes/questionTemplates';
import type { QuestionTemplate } from './db';
import type { QuestionFamily } from './types/questionTemplateParams';

export const BANK_REQUIRED_HEADERS = [
  'conceptId',
  'itemNumber',
  'stem',
  'answerSpec',
  'assessmentMode',
] as const;

export interface BankCsvRow {
  conceptId: string;
  itemNumber: number;
  stem: string;
  answerSpec: string;
  assessmentMode: 'written' | 'observed' | 'both';
  questionFamily?: QuestionFamily;
  name?: string;
  topic?: string;
}

export interface BankRowError {
  row: number;
  error: string;
}

export interface ParseBankCsvResult {
  validRows: BankCsvRow[];
  errors: BankRowError[];
}

/**
 * Determine questionFamily from concept or explicit input.
 */
export function inferQuestionFamily(conceptId: string, family?: string): QuestionFamily {
  if (family && ['operation', 'counting', 'comparison', 'classification', 'pattern', 'shape', 'measurement', 'time', 'money', 'data', 'geometry', 'fractions', 'word-problem', 'sequencing', 'vocabulary', 'calendar', 'reasoning'].includes(family.toLowerCase())) {
    return family.toLowerCase() as QuestionFamily;
  }
  const topic = resolveTemplateTopic(conceptId);
  if (topic === 'counting') return 'counting';
  if (topic === 'shapes') return 'shape';
  if (topic === 'patterns') return 'pattern';
  if (topic === 'literacy') return 'vocabulary';
  return 'operation';
}

/**
 * Parse and validate a Balvatika question-bank CSV string.
 * Reports errors with 1-based spreadsheet row numbers.
 */
export function parseAndValidateBankCsv(csvContent: string): ParseBankCsvResult {
  const rows = parseCsv(csvContent);
  const errors: BankRowError[] = [];
  const validRows: BankCsvRow[] = [];

  if (rows.length < 2) {
    errors.push({
      row: 1,
      error: 'CSV must contain a header row and at least one data row.',
    });
    return { validRows, errors };
  }

  const header = rows[0].map(h => h.trim());
  const missingHeaders = BANK_REQUIRED_HEADERS.filter(h => !header.includes(h));
  if (missingHeaders.length > 0) {
    errors.push({
      row: 1,
      error: `Missing required CSV headers: ${missingHeaders.join(', ')}.`,
    });
    return { validRows, errors };
  }

  const colIndex = (name: string) => header.indexOf(name);
  const col = (row: string[], name: string) => {
    const idx = colIndex(name);
    return idx >= 0 && idx < row.length ? (row[idx] ?? '').trim() : '';
  };

  const dataRows = rows.slice(1);
  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1-based index (+1 header, +1 for 1-based row)

    // Skip entirely empty rows
    if (row.every(c => c.trim().length === 0)) {
      return;
    }

    const conceptId = col(row, 'conceptId');
    const itemNumberStr = col(row, 'itemNumber');
    const stem = col(row, 'stem');
    const answerSpec = col(row, 'answerSpec');
    const rawMode = col(row, 'assessmentMode').toLowerCase();
    const explicitFamily = col(row, 'questionFamily');
    const explicitName = col(row, 'name');
    const explicitTopic = col(row, 'topic');

    if (!conceptId) {
      errors.push({ row: rowNumber, error: 'conceptId is required.' });
      return;
    }

    const concept = getLevelForConcept(conceptId);
    if (!concept) {
      errors.push({ row: rowNumber, error: `Concept ${conceptId} is not present in the curriculum map.` });
      return;
    }

    const itemNumber = parseInt(itemNumberStr, 10);
    if (isNaN(itemNumber) || itemNumber < 1) {
      errors.push({ row: rowNumber, error: `itemNumber must be a positive integer, got "${itemNumberStr}".` });
      return;
    }

    if (!stem) {
      errors.push({ row: rowNumber, error: 'stem (question text) is required.' });
      return;
    }

    if (!answerSpec) {
      errors.push({ row: rowNumber, error: 'answerSpec (expected answer) is required.' });
      return;
    }

    if (!(ASSESSMENT_MODES as readonly string[]).includes(rawMode)) {
      errors.push({
        row: rowNumber,
        error: `assessmentMode must be one of: ${ASSESSMENT_MODES.join(', ')}. Got: "${rawMode}".`,
      });
      return;
    }

    const assessmentMode = rawMode as 'written' | 'observed' | 'both';
    const questionFamily = inferQuestionFamily(conceptId, explicitFamily);

    validRows.push({
      conceptId,
      itemNumber,
      stem,
      answerSpec,
      assessmentMode,
      questionFamily,
      name: explicitName || undefined,
      topic: explicitTopic || undefined,
    });
  });

  return { validRows, errors };
}

/**
 * Construct a QuestionTemplate document from validated bank row.
 */
export function buildBankQuestionTemplate(
  row: BankCsvRow,
  existingDoc?: Partial<QuestionTemplate> | null,
  now = new Date().toISOString()
): QuestionTemplate {
  const concept = getLevelForConcept(row.conceptId)!;
  const levelInfo = getLevel(concept.levelNumber);
  const skills = levelInfo?.skills ? [...levelInfo.skills] : getSkillsForLevel(concept.levelNumber);
  const subskills = getSubskillsForSkills(skills);
  const variantKey = `${row.conceptId}:bank:v1:${row.itemNumber}`;
  const id = existingDoc?.id ?? ('qtpl_' + randomUUID().slice(0, 8));

  // Determine status: preserve existing status if already reviewed/approved, otherwise pendingApproval
  const status = existingDoc?.status ?? 'pendingApproval';

  return {
    id,
    conceptId: row.conceptId,
    levelNumber: concept.levelNumber,
    levelName: levelInfo?.capability ?? `Level ${concept.levelNumber}`,
    skills,
    subskills,
    assessmentMode: row.assessmentMode,
    generationIntent: row.stem,
    questionFamily: row.questionFamily ?? 'operation',
    paramMode: 'legacy-free-text',
    svgThemeIds: existingDoc?.svgThemeIds ?? [],
    stem: row.stem,
    answerSpec: row.answerSpec,
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
    subjectCategory: null,
    name: row.name || `${row.conceptId} Q${row.itemNumber} (Bank)`,
    variantKey,
    tags: ['balvatika', 'bank-v0.1', 'to-review'],
    source: 'seed:balvatika-bank' as any,
    status,
    createdBy: existingDoc?.createdBy ?? 'system-seed',
    createdByEmail: existingDoc?.createdByEmail ?? 'system-seed@fln.internal',
    createdAt: existingDoc?.createdAt ?? now,
    updatedAt: now,
    updatedBy: 'system-seed',
    updatedByEmail: 'system-seed@fln.internal',
    deletedAt: null,
    deletedBy: null,
  };
}

export interface SeedBalvatikaBankOptions {
  filePath: string;
  dryRun?: boolean;
  mongoUri?: string;
}

export interface SeedBalvatikaBankResult {
  totalRowsRead: number;
  validCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedPreservedCount: number;
  errors: BankRowError[];
  dryRun: boolean;
  documents: QuestionTemplate[];
}

/**
 * Core runner for seeding or dry-running the Balvatika question bank.
 */
export async function seedBalvatikaBank(
  options: SeedBalvatikaBankOptions
): Promise<SeedBalvatikaBankResult> {
  const { filePath, dryRun = false, mongoUri } = options;

  if (!filePath) {
    throw new Error('A CSV file path must be provided via --file.');
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: "${resolvedPath}".`);
  }

  const csvContent = fs.readFileSync(resolvedPath, 'utf8');
  const { validRows, errors } = parseAndValidateBankCsv(csvContent);

  if (errors.length > 0) {
    return {
      totalRowsRead: validRows.length + errors.length,
      validCount: validRows.length,
      insertedCount: 0,
      updatedCount: 0,
      skippedPreservedCount: 0,
      errors,
      dryRun,
      documents: [],
    };
  }

  const now = new Date().toISOString();
  const documents: QuestionTemplate[] = [];

  if (dryRun) {
    for (const r of validRows) {
      const doc = buildBankQuestionTemplate(r, null, now);
      documents.push(doc);
    }
    return {
      totalRowsRead: validRows.length,
      validCount: validRows.length,
      insertedCount: 0,
      updatedCount: 0,
      skippedPreservedCount: 0,
      errors: [],
      dryRun: true,
      documents,
    };
  }

  // Real run: requires MongoDB connection
  const uri = mongoUri || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured. Real import requires database connection.');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const coll = db.collection<QuestionTemplate>('questionTemplates');

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedPreservedCount = 0;

  try {
    for (const r of validRows) {
      const variantKey = `${r.conceptId}:bank:v1:${r.itemNumber}`;
      const existing = await coll.findOne({ variantKey });

      if (existing) {
        // If question is approved or has been reviewed, preserve its status and reviewer-authored fields
        if (existing.status === 'approved' || existing.status === 'rejected') {
          skippedPreservedCount++;
          continue;
        }
        const doc = buildBankQuestionTemplate(r, existing, now);
        await coll.updateOne({ variantKey }, { $set: doc });
        updatedCount++;
        documents.push(doc);
      } else {
        const doc = buildBankQuestionTemplate(r, null, now);
        await coll.insertOne(doc as any);
        insertedCount++;
        documents.push(doc);
      }
    }
  } finally {
    await client.close();
  }

  return {
    totalRowsRead: validRows.length,
    validCount: validRows.length,
    insertedCount,
    updatedCount,
    skippedPreservedCount,
    errors: [],
    dryRun: false,
    documents,
  };
}

/**
 * Parse command-line flags.
 */
export function parseCliArgs(args: string[]): { file?: string; dryRun: boolean } {
  let file: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file') {
      file = args[i + 1];
      i++;
    } else if (arg.startsWith('--file=')) {
      file = arg.slice('--file='.length);
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { file, dryRun };
}

/**
 * Main CLI entry point.
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { file, dryRun } = parseCliArgs(args);

  if (!file) {
    console.error('Error: Missing required argument --file <path/to/bank.csv>');
    console.error('Usage: npm run seed:balvatika-bank -- --file <path> [--dry-run]');
    process.exit(1);
  }

  try {
    const result = await seedBalvatikaBank({ filePath: file, dryRun });

    if (result.errors.length > 0) {
      console.error(`\nValidation failed with ${result.errors.length} error(s):`);
      for (const err of result.errors) {
        console.error(`  Row ${err.row}: ${err.error}`);
      }
      process.exit(1);
    }

    if (result.dryRun) {
      console.log(`\n[DRY RUN] Validated ${result.validCount} question(s) successfully (0 database writes):`);
      for (const doc of result.documents) {
        console.log(
          `  [Concept ${doc.conceptId}] Item Q${doc.variantKey.split(':').pop()} | Mode: ${doc.assessmentMode} | Status: ${doc.status} | Key: ${doc.variantKey}`
        );
      }
      console.log(`\nSummary: ${result.validCount} valid row(s), 0 written.`);
    } else {
      console.log(`\nImport complete:`);
      console.log(`  Inserted: ${result.insertedCount}`);
      console.log(`  Updated:  ${result.updatedCount}`);
      console.log(`  Preserved approved: ${result.skippedPreservedCount}`);
      console.log(`  Total processed:    ${result.validCount}`);
    }
  } catch (err: any) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]).toLowerCase() ===
    path.resolve(fileURLToPath(import.meta.url)).toLowerCase();

if (isDirectRun) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
