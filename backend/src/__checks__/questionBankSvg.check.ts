// Runnable assert script for Issue #499: every question-bank SVG must be
// well-formed, standalone, already-escaped XML, exactly matching the files
// committed under frontend/public/assets/svg/legacy-question-bank/.
//
// Invoked via:
//   npx tsx backend/src/__checks__/questionBankSvg.check.ts
//
// Reads only the committed seed source and the committed assets — no database
// connection, safe to run anywhere.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { strict as assert } from 'node:assert';
import { KNOWN_TAG_RE, escapeStraySvgText } from '../services/svgEscaping';
import { questionBankId } from '../db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, '../../../data/questionBank.json');
const ASSET_DIR = path.resolve(__dirname, '../../../frontend/public/assets/svg/legacy-question-bank');
const MANIFEST = path.join(ASSET_DIR, 'manifest.json');

interface LegacyQuestion {
  level: number;
  section: string;
  questionNumber: number;
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

const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}`);
    console.error('    ', err instanceof Error ? err.message : String(err));
    failed++;
  }
}

console.log('question bank SVG escaping (Issue #499)');

const raw: LegacyQuestion[] = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')) as ManifestEntry[];

check('seed has 1,202 questions with unique ids', () => {
  assert.equal(raw.length, 1202);
  const seen = new Set<string>();
  for (const q of raw) {
    const id = questionBankId(q.level, q.section, q.questionNumber);
    assert.ok(!seen.has(id), `duplicate id ${id}`);
    seen.add(id);
  }
});

check('manifest lists 1,202 assets', () => {
  assert.equal(manifest.length, 1202);
  for (const entry of manifest) {
    assert.equal(entry.file, `${entry.id}.svg`);
    assert.equal(fs.existsSync(path.join(ASSET_DIR, entry.file)), true, `missing asset ${entry.file}`);
  }
});

check('every svgHtml is a standalone <svg> document', () => {
  for (const q of raw) {
    const svg = normalize((q.svgHtml ?? '').trim());
    assert.ok(svg.startsWith('<svg'), `${questionBankId(q.level, q.section, q.questionNumber)}: not a standalone <svg> document`);
    assert.ok(svg.endsWith('</svg>'), `${questionBankId(q.level, q.section, q.questionNumber)}: does not close with </svg>`);
  }
});

check('every svgHtml is already escaped (idempotent under escapeStraySvgText)', () => {
  for (const q of raw) {
    const svg = (q.svgHtml ?? '').trim();
    assert.equal(escapeStraySvgText(svg), svg, `${questionBankId(q.level, q.section, q.questionNumber)}: escapeStraySvgText would still change it`);
  }
});

check('only known SVG tags appear, all authentic (no stray <, >, & outside tags)', () => {
  for (const q of raw) {
    const svg = (q.svgHtml ?? '').trim();
    const id = questionBankId(q.level, q.section, q.questionNumber);
    const tags = svg.match(KNOWN_TAG_RE);
    const stripped = svg.replace(KNOWN_TAG_RE, '');
    assert.equal(stripped.includes('<'), false, `${id}: unmatched < outside a known tag`);
    assert.equal(stripped.includes('>'), false, `${id}: unmatched > outside a known tag`);
    const entityStripped = stripped.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, '');
    assert.equal(entityStripped.includes('&'), false, `${id}: raw & that is not a real entity`);
    assert.ok(tags !== null, `${id}: no tags at all`);
    assert.equal(tags!.length > 0, true, `${id}: no tags at all`);
  }
});

check('JSON svgHtml matches committed asset files byte-for-byte', () => {
  const byId = new Map<string, LegacyQuestion>();
  for (const q of raw) byId.set(questionBankId(q.level, q.section, q.questionNumber), q);
  assert.equal(byId.size, manifest.length);
  for (const entry of manifest) {
    const q = byId.get(entry.id);
    assert.ok(q, `no seed row for manifest id ${entry.id}`);
    const fromJson = normalize(escapeStraySvgText((q.svgHtml ?? '').trim()));
    const fromFile = normalize(fs.readFileSync(path.join(ASSET_DIR, entry.file), 'utf-8'));
    assert.equal(fromFile, fromJson, `asset/seed mismatch for ${entry.id}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);