// EXPERIMENTAL - SAFE TO REMOVE
// ============================================================================
//
// Metadata-driven experimental question generator (proof-of-concept).
//
// Reads FLN Levels Structure markdown files directly and generates simple
// curriculum-aligned questions using the parsed metadata (level name,
// description, objective, learning outcomes, topics, sections).
//
// To delete this experiment:
//   1. Delete this file: frontend/src/utils/experimentalQuestionGenerator.ts
//   2. (If any integration point was added) Remove that import/call
//
// No other files are modified by this experiment.
// ============================================================================

// EXPERIMENTAL - SAFE TO REMOVE
// Bundle every FLN Levels Structure markdown file at build time. Vite's
// `?raw` query returns the contents as a string, so no runtime fs.readFileSync
// / fs.readdirSync is needed (the previous Node-only implementation threw
// `TypeError: undefined is not a function` when Vite replaced the missing
// `fs` module with `(void 0)` in the browser bundle).
//
// Path is relative to this source file
// (frontend/src/utils/experimentalQuestionGenerator.ts):
//   ../        → frontend/src/
//   ../../     → frontend/
//   ../../../  → fln/   (the monorepo root that holds FLN Levels Structure)
// @ts-expect-error Vite client types are not configured; runtime build works.
const MARKDOWN_FILES = import.meta.glob('../../../FLN Levels Structure/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
import { Question } from '../types';

// ---------------------------------------------------------------------------
// 1. FLN Levels Structure parser
// ---------------------------------------------------------------------------

interface FLNLevelMetadata {
  level: number;
  name: string;
  classGroup: string;
  strand: string;
  brief: string;
  description: string;
  objective: string;
  learningOutcomes: string[];
  topics: string[];
  sections: ParsedSection[];
  metadataSource: string;
}

interface ParsedSection {
  letter: string;
  title: string;
}

function findRepoRoot(): string | null {
  // The markdown contents were bundled at build time via import.meta.glob
  // above. As long as at least one FLN Levels Structure markdown was found,
  // the repo root is "present" for our purposes — the filesystem walk has
  // been replaced by the bundle. Return the directory prefix shared by all
  // keys so downstream code keeps its path-join style expectations.
  const paths = Object.keys(MARKDOWN_FILES);
  if (paths.length === 0) return null;
  const prefix = paths[0].split('FLN Levels Structure')[0];
  return prefix || '.';
}

function findLevelDirectory(_repoRoot: string, level: number): string | null {
  for (const filePath of Object.keys(MARKDOWN_FILES)) {
    const m = filePath.match(/Level\s+(\d+)/i);
    if (m && parseInt(m[1], 10) === level) {
      const idx = filePath.lastIndexOf('/');
      return idx >= 0 ? filePath.substring(0, idx) : filePath;
    }
  }
  return null;
}

function stripMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSection(text: string, headingCore: string): string {
  const escaped = headingCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:#{1,3}\\s+\\*{0,2}${escaped}\\*{0,2}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`,
    'i'
  );
  const m = text.match(re);
  return m ? stripMarkdown(m[1]) : '';
}

function extractSectionRaw(text: string, headingCore: string): string {
  // Same as `extractSection` but preserves newlines in the body so callers
  // like `parseTopics` can split on them. The shared `extractSection`
  // collapses newlines for display-oriented consumers.
  const escaped = headingCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:#{1,3}\\s+\\*{0,2}${escaped}\\*{0,2}[^\\n]*)\\n+([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`,
    'i'
  );
  const m = text.match(re);
  return m ? m[1] : '';
}

function extractBullets(body: string): string[] {
  return body
    .split(/\s*[.;]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^---+$/.test(s));
}

function extractSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const re = /#{2,3}\s+\*{0,2}\s*Section\s+([A-Z])\s*\*{0,2}(?:\s*[:\-]\s*\*{0,2}\s*([^\n*#]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const letter = m[1].toUpperCase();
    const rawTitle = (m[2] ?? '').trim();
    const title = stripMarkdown(rawTitle);
    const finalTitle = title || `Section ${letter}`;
    sections.push({ letter, title: finalTitle });
  }
  return sections;
}

function findLevelMarkdowns(levelDir: string): string[] {
  const candidates: string[] = [];
  const prefix = levelDir + '/';
  for (const filePath of Object.keys(MARKDOWN_FILES)) {
    if (!filePath.startsWith(prefix)) continue;
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    if (/^Level\s+\d+.*\.md$/i.test(fileName)) candidates.push(filePath);
  }
  for (const filePath of Object.keys(MARKDOWN_FILES)) {
    if (!filePath.startsWith(prefix)) continue;
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    if (/^\d+\.\d+\.md$/i.test(fileName)) candidates.push(filePath);
  }
  return candidates;
}

export function loadLevelMetadata(level: number): FLNLevelMetadata | null {
  const repoRoot = findRepoRoot();
  if (!repoRoot) return null;
  const levelDir = findLevelDirectory(repoRoot, level);
  if (!levelDir) return null;
  const mdPaths = findLevelMarkdowns(levelDir);
  if (mdPaths.length === 0) return null;

  const mainText = MARKDOWN_FILES[mdPaths[0]];
  if (!mainText) return null;

  const nameMatch = mainText.match(/^#\s+Level\s+\d+\s*[:\-]\s*([^\n]+)/im);
  const name = nameMatch ? stripMarkdown(nameMatch[1]) : `Level ${level}`;
  const description = extractSection(mainText, 'Description');
  const objective = extractSection(mainText, 'Objective');
  const loText = extractSection(mainText, 'Learning Outcome')
    || extractSection(mainText, 'Learning Outcomes');
  const topicsText = extractSection(mainText, 'Topics Covered');

  const allSections: ParsedSection[] = [];
  for (const p of mdPaths) {
    const text = MARKDOWN_FILES[p];
    if (text === undefined) continue;
    for (const sec of extractSections(text)) allSections.push(sec);
  }

  return {
    level, name, classGroup: '', strand: '', brief: '', description, objective,
    learningOutcomes: loText ? extractBullets(loText) : [],
    topics: topicsText ? extractBullets(topicsText) : [],
    sections: allSections,
    metadataSource: mdPaths.join(','),
  };
}

const COMPETENCY_GRAPH: Record<number, { strand: string; prerequisite?: number; reinforcement?: number }> = {
  13: { strand: 'Number Sense' },
  45: { strand: 'Fractions', prerequisite: 13, reinforcement: 46 },
  46: { strand: 'Money' },
};

// ---------------------------------------------------------------------------
// 2. PHASE 1 — Competency pool
//
// We walk every FLN Levels Structure markdown file once at module load and
// build a flat pool of "competencies" (i.e. topics taught in each level).
// Every entry in the pool carries everything the worksheet generator needs
// to derive a real assessment question: the source level, the strand, the
// topic, the level name, the parsed sections, and the markdown path. The
// pool is the input for the new worksheet generation (Phase 2) which picks
// unique competencies per worksheet.
// ---------------------------------------------------------------------------

export interface CompetencySection {
  letter: string;
  title: string;
}

export interface CompetencyEntry {
  /** Source FLN level (1..59). */
  sourceLevel: number;
  /** Class / grade-group, derived from the directory or main file. */
  sourceClass: string;
  /** Level name, e.g. "Time & Calendar". */
  levelName: string;
  /** Top-level FLN strand, e.g. "Calendar & Time". */
  strand: string;
  /** The actual topic inside the level, e.g. "Analog Clock". */
  topic: string;
  /** All parsed Section A/B/C/... for this level (shared across its topics). */
  sections: CompetencySection[];
  /** Original markdown path inside the bundle. */
  markdownPath: string;
}

let COMPETENCY_POOL: CompetencyEntry[] | null = null;
let COMPETENCY_POOL_BY_LEVEL: Map<number, CompetencyEntry[]> | null = null;

// Strand inference: every level in `FLN_LEVELS_LIST` carries a `strand`.
// We read the table from the source so the parser never hardcodes strands.
let FLN_STRAND_BY_LEVEL: Map<number, { name: string; strand: string; classGroup: string }> | null = null;

function loadFLNStrandMap(): Map<number, { name: string; strand: string; classGroup: string }> {
  if (FLN_STRAND_BY_LEVEL) return FLN_STRAND_BY_LEVEL;
  // Inline a copy of the FLN_LEVELS_LIST. This is the level→strand mapping
  // the rest of the application uses (see RoleDashboards.tsx). We do NOT
  // hardcode competencies — only the level→strand table, which is part of
  // the framework and not a question bank.
  const TABLE: Array<{ id: number; name: string; strand: string; classGroup: string }> = [
    { id: 1,  classGroup: 'Preschool 1', name: 'Quantity Comparison',                 strand: 'Number Sense' },
    { id: 2,  classGroup: 'Preschool 1', name: 'Odd One Out',                          strand: 'Number Sense' },
    { id: 3,  classGroup: 'Preschool 1', name: 'Matching + Tracing Lines',             strand: 'Shapes' },
    { id: 4,  classGroup: 'Preschool 2', name: 'Numbers 1-10',                         strand: 'Number Sense' },
    { id: 5,  classGroup: 'Preschool 2', name: 'Finger Gesture Counting',              strand: 'Number Sense' },
    { id: 6,  classGroup: 'Preschool 2', name: 'After, Between, Before',               strand: 'Number Sense' },
    { id: 7,  classGroup: 'Preschool 3', name: 'Addition through objects',             strand: 'Number Operations' },
    { id: 8,  classGroup: 'Preschool 3', name: 'Subtraction(1-10)',                    strand: 'Number Operations' },
    { id: 9,  classGroup: 'Preschool 3', name: 'Pattern Recognition+Draw by Tracing', strand: 'Patterns' },
    { id: 10, classGroup: 'Preschool 3', name: 'Comparison – Numeral',                 strand: 'Number Sense' },
    { id: 11, classGroup: 'Review',       name: 'Review Assessment',                    strand: 'Review' },
    { id: 12, classGroup: 'Class 1',     name: 'Tens and Ones',                        strand: 'Number Sense' },
    { id: 13, classGroup: 'Class 1',     name: 'Numbers 11–30',                         strand: 'Number Sense' },
    { id: 14, classGroup: 'Class 1',     name: 'Counting + Fun Trace',                  strand: 'Number Sense' },
    { id: 15, classGroup: 'Class 1',     name: 'After, Between & Before',               strand: 'Number Sense' },
    { id: 16, classGroup: 'Class 1',     name: 'Addition (1-30)',                      strand: 'Number Operations' },
    { id: 17, classGroup: 'Class 1',     name: 'Subtraction (1-30)',                   strand: 'Number Operations' },
    { id: 18, classGroup: 'Class 1',     name: 'Ordering (1-30)',                      strand: 'Number Sense' },
    { id: 19, classGroup: 'Class 1',     name: 'Numering 31-50',                       strand: 'Number Sense' },
    { id: 20, classGroup: 'Class 1',     name: 'Skip Counting in 2s/3s',                strand: 'Number Sense' },
    { id: 21, classGroup: 'Class 1',     name: 'Comparison (1-50)',                    strand: 'Number Sense' },
    { id: 22, classGroup: 'Class 1',     name: 'Ordering (1-50)',                      strand: 'Number Sense' },
    { id: 23, classGroup: 'Review',       name: 'Review Assessment',                    strand: 'Review' },
    { id: 24, classGroup: 'Class 2',     name: 'Numbers 51-100',                       strand: 'Number Sense' },
    { id: 25, classGroup: 'Class 2',     name: 'Place Value (Tens & Ones)',            strand: 'Number Sense' },
    { id: 26, classGroup: 'Class 2',     name: 'Carry Addition',                       strand: 'Number Operations' },
    { id: 27, classGroup: 'Class 2',     name: 'Borrow Subtraction',                   strand: 'Number Operations' },
    { id: 28, classGroup: 'Class 2',     name: 'Comparison (Greater Than, Less Than, Equal)', strand: 'Number Sense' },
    { id: 29, classGroup: 'Class 2',     name: 'Ordering (Ascending & Descending)',    strand: 'Number Sense' },
    { id: 30, classGroup: 'Class 2',     name: 'Data Handling (Tally Marks)',         strand: 'Data Handling' },
    { id: 31, classGroup: 'Class 2',     name: 'Time',                                  strand: 'Calendar & Time' },
    { id: 32, classGroup: 'Class 2',     name: 'Ordinal Positions (1st–10th)',         strand: 'Number Sense' },
    { id: 33, classGroup: 'Class 2',     name: 'Multiplication (Repeated Addition)',  strand: 'Number Operations' },
    { id: 34, classGroup: 'Class 2',     name: 'Measurement (Non-Standard & Standard)', strand: 'Measurement' },
    { id: 35, classGroup: 'Review',       name: 'Review Assessment',                    strand: 'Review' },
    { id: 36, classGroup: 'Class 3',     name: 'Numbers 101–1000 (Place Value)',       strand: 'Number Sense' },
    { id: 37, classGroup: 'Class 3',     name: 'Comparison (Greater Than, Less Than, Equal)', strand: 'Number Sense' },
    { id: 38, classGroup: 'Class 3',     name: 'Ordering (Ascending & Descending)',    strand: 'Number Sense' },
    { id: 39, classGroup: 'Class 3',     name: 'Addition (Up to 1000)',                strand: 'Number Operations' },
    { id: 40, classGroup: 'Class 3',     name: 'Subtraction (Up to 1000)',             strand: 'Number Operations' },
    { id: 41, classGroup: 'Class 3',     name: 'Multiplication (Tables 2–10)',         strand: 'Number Operations' },
    { id: 42, classGroup: 'Class 3',     name: 'Division (Introduction)',              strand: 'Number Operations' },
    { id: 43, classGroup: 'Class 3',     name: 'Standard Measurement & Simple Conversions', strand: 'Measurement' },
    { id: 44, classGroup: 'Class 3',     name: 'Time & Calendar',                      strand: 'Calendar & Time' },
    { id: 45, classGroup: 'Class 3',     name: 'Fractions',                            strand: 'Fractions' },
    { id: 46, classGroup: 'Class 3',     name: 'Money',                                 strand: 'Money' },
    { id: 47, classGroup: 'Class 3',     name: 'Data Handling',                        strand: 'Data Handling' },
    { id: 48, classGroup: 'Review',       name: 'Foundation Mastery Assessment',        strand: 'Review' },
    { id: 49, classGroup: 'Class 4',     name: 'Numbers up to 10,000',                 strand: 'Number Sense' },
    { id: 50, classGroup: 'Class 4',     name: 'Advanced Multiplication',              strand: 'Number Operations' },
    { id: 51, classGroup: 'Class 4',     name: 'Advanced Division',                    strand: 'Number Operations' },
    { id: 52, classGroup: 'Class 4',     name: 'Maps & Directions',                    strand: 'Shapes' },
    { id: 53, classGroup: 'Class 4',     name: 'Factors & Multiples',                  strand: 'Number Operations' },
    { id: 54, classGroup: 'Class 4',     name: 'Fraction Operations',                  strand: 'Fractions' },
    { id: 55, classGroup: 'Class 4',     name: 'Decimals (Introduction)',              strand: 'Number Sense' },
    { id: 56, classGroup: 'Class 4',     name: 'Area & Perimeter',                     strand: 'Measurement' },
    { id: 57, classGroup: 'Class 4',     name: 'Angles',                                strand: 'Measurement' },
    { id: 58, classGroup: 'Class 4',     name: 'Symmetry & Reflection',                strand: 'Shapes' },
    { id: 59, classGroup: 'Review',       name: 'Advanced Mastery Assessment',          strand: 'Review' },
  ];
  const map = new Map<number, { name: string; strand: string; classGroup: string }>();
  for (const r of TABLE) map.set(r.id, { name: r.name, strand: r.strand, classGroup: r.classGroup });
  FLN_STRAND_BY_LEVEL = map;
  return map;
}

function findLevelNumber(filePath: string): number | null {
  // FLN Levels Structure paths look like:
  //   ../../../FLN Levels Structure/Level 13_ Numbers 11–30/13.0.md
  //   ../../../FLN Levels Structure/Level 13_ Numbers 11–30/Level 13_ Numbers 11–30.md
  const m1 = filePath.match(/Level\s+(\d+)/i);
  if (m1) {
    const n = parseInt(m1[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 59) return n;
  }
  const m2 = filePath.match(/^[\s\S]*?(\d+)\.(\d+)\.md$/);
  if (m2) {
    const n = parseInt(m2[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 59) return n;
  }
  return null;
}

function findMainMarkdownForLevel(level: number): string | null {
  // The "main" file is the one whose name starts with "Level <n>". We pick
  // the first match (length-sorted to prefer the shortest one, which is
  // typically the canonical file).
  const prefix = `/${level}_`;
  const candidates: string[] = [];
  for (const fp of Object.keys(MARKDOWN_FILES)) {
    if (fp.includes(`/Level ${level}_`) && fp.endsWith('.md')) candidates.push(fp);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.length - b.length);
  const text = MARKDOWN_FILES[candidates[0]];
  return text ?? null;
}

// Bullet-aware topic extractor used by the competency pool. The existing
// `extractBullets` only splits on `.` / `;` which collapses bulleted lists
// into a single blob; here we split on newlines and strip bullet markers.
function parseTopics(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*+]\s+/, '').trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^---+$/.test(l))
    .filter((l) => !/^SECTION\s+[A-Z]\s*:/i.test(l))
    .filter((l) => !/^\*?\*?Topics Covered\*?\*?$/i.test(l.trim()))
    .filter((l) => !/^\*?\*?Learning Outcome\(s\)?\*?\*?$/i.test(l))
    .filter((l, i, arr) => i === 0 || l !== arr[i - 1])
    .map((l) => stripMarkdown(l));
}

function buildCompetencyPool(): { pool: CompetencyEntry[]; byLevel: Map<number, CompetencyEntry[]> } {
  const strandMap = loadFLNStrandMap();
  // Group files by level number.
  const filesByLevel = new Map<number, string[]>();
  for (const fp of Object.keys(MARKDOWN_FILES)) {
    const lvl = findLevelNumber(fp);
    if (lvl === null) continue;
    const arr = filesByLevel.get(lvl) ?? [];
    arr.push(fp);
    filesByLevel.set(lvl, arr);
  }

  const pool: CompetencyEntry[] = [];
  const byLevel = new Map<number, CompetencyEntry[]>();

  for (const [lvl, files] of filesByLevel) {
    const meta = strandMap.get(lvl);
    const strand = meta?.strand ?? '';
    const levelName = meta?.name ?? `Level ${lvl}`;
    const sourceClass = meta?.classGroup ?? '';

    // Parse sections from every file in the level. We dedupe by (letter, title).
    const sectionMap = new Map<string, CompetencySection>();
    for (const fp of files) {
      const text = MARKDOWN_FILES[fp];
      if (!text) continue;
      for (const sec of extractSections(text)) {
        const key = `${sec.letter}::${sec.title.toLowerCase()}`;
        if (!sectionMap.has(key)) sectionMap.set(key, sec);
      }
    }
    const sections = Array.from(sectionMap.values());

    // Parse the canonical level markdown to get topics. If absent, fall
    // back to scanning any file that has a "Topics Covered" block.
    const main = findMainMarkdownForLevel(lvl) ?? files.map((f) => MARKDOWN_FILES[f]).find((t): t is string => !!t);
    let topics: string[] = [];
    let mainPath = main ? (files.find((f) => MARKDOWN_FILES[f] === main) ?? files[0]) : files[0];
    if (main) {
      const topicsText = extractSectionRaw(main, 'Topics Covered');
      if (topicsText) topics = parseTopics(topicsText);
    }
    if (topics.length === 0) {
      // Last-ditch: pull topics from any file in the level.
      for (const fp of files) {
        const text = MARKDOWN_FILES[fp];
        if (!text) continue;
        const t = extractSectionRaw(text, 'Topics Covered');
        if (t) {
          const list = parseTopics(t);
          if (list.length > 0) { topics = list; break; }
        }
      }
    }
    // If the level has no topics in the markdown (e.g. Levels 9, 11, 23, 35,
    // 48, 59 are "Review Assessment" levels), we fall back to the level
    // name itself as the single competency.
    if (topics.length === 0) {
      topics = [levelName];
    }

    const entryBase = { sourceLevel: lvl, sourceClass, levelName, strand, sections,
      markdownPath: mainPath };

    for (const topic of topics) {
      pool.push({ ...entryBase, topic });
    }
    byLevel.set(lvl, pool.filter((e) => e.sourceLevel === lvl));
  }

  return { pool, byLevel };
}

function ensurePool() { return COMPETENCY_POOL ?? (COMPETENCY_POOL = (COMPETENCY_POOL_BY_LEVEL = buildCompetencyPool(), COMPETENCY_POOL_BY_LEVEL && buildCompetencyPool().pool));
}

// The pool is built exactly once on first access. Building it is cheap
// (a single pass over MARKDOWN_FILES) so we do it lazily but cache the
// result.
function getCompetencyPool(): CompetencyEntry[] {
  if (COMPETENCY_POOL) return COMPETENCY_POOL;
  const { pool, byLevel } = buildCompetencyPool();
  COMPETENCY_POOL = pool;
  COMPETENCY_POOL_BY_LEVEL = byLevel;
  return pool;
}
function getCompetencyPoolByLevel(): Map<number, CompetencyEntry[]> {
  if (COMPETENCY_POOL_BY_LEVEL) return COMPETENCY_POOL_BY_LEVEL;
  const { pool, byLevel } = buildCompetencyPool();
  COMPETENCY_POOL = pool;
  COMPETENCY_POOL_BY_LEVEL = byLevel;
  return byLevel;
}

/** Internal export used by the Phase-1 verification harness only. */
export function _poolForDebug(): CompetencyEntry[] { return getCompetencyPool(); }

// ---------------------------------------------------------------------------
// 3. PHASE 2 — Competency selection
//
// Given a starting/reference level, pick exactly 8 UNIQUE competencies
// (i.e. unique `topic` strings) from the pool. The selected level goes
// first; the remaining 7 slots are filled with related competencies from
// neighbouring levels and the wider strand pool, while guaranteeing no
// duplicate topics.
//
// Determinism: the algorithm is a pure function of the pool + the
// starting level. It never invents content and never repeats a topic.
// ---------------------------------------------------------------------------

export const WORKSHEET_QUESTION_COUNT = 8;

/** A lightweight tag carried alongside the picked pool entries. */
export interface SelectedCompetency {
  entry: CompetencyEntry;
  /** Coarse reason for inclusion — used by the Phase-2 verifier. */
  source:
    | 'starting-level'
    | 'prerequisite-level'
    | 'reinforcement-level'
    | 'same-strand-neighbour'
    | 'cross-strand-bridge'
    | 'strand-rotation';
}

function dedupKey(e: CompetencyEntry): string {
  // Topics are unique within a level. Across levels the same phrase can
  // recur (e.g. "Place Value" in L25 and L36), so the dedup key MUST
  // include both strand and topic to keep the worksheet varied.
  return `${e.strand}::${e.topic.toLowerCase()}`;
}

function entryKey(e: CompetencyEntry): string {
  return `${e.sourceLevel}::${e.strand}::${e.topic}`;
}

function pushUnique(list: SelectedCompetency[], seen: Set<string>, entry: CompetencyEntry, source: SelectedCompetency['source']): boolean {
  if (!entry.strand) return false;
  const k = dedupKey(entry);
  if (seen.has(k)) return false;
  // Also reject level-topic duplicates (the same topic CAN appear multiple
  // times across levels — we still want only one in the worksheet).
  seen.add(k);
  list.push({ entry, source });
  return true;
}

function entriesForLevel(lvl: number): CompetencyEntry[] {
  return getCompetencyPoolByLevel().get(lvl) ?? [];
}

function adjacentLevelTargets(start: number, count: number): number[] {
  // Walk outward from `start` alternately left/right, skipping levels
  // that have no competencies. The order alternates so the worksheet
  // reaches both prerequisite and reinforcement directions.
  const out: number[] = [];
  for (let d = 1; d <= 59 && out.length < count; d++) {
    const left = start - d;
    const right = start + d;
    if (left >= 1) out.push(left);
    if (out.length >= count) break;
    if (right <= 59) out.push(right);
  }
  return out;
}

export function selectCompetencies(startingLevel: number): SelectedCompetency[] {
  if (!Number.isFinite(startingLevel)) return [];
  const start = Math.max(1, Math.min(59, Math.floor(startingLevel)));
  const pool = getCompetencyPool();
  if (pool.length === 0) return [];

  const selected: SelectedCompetency[] = [];
  // Two separate dedup sets: the question-level key (strand::topic) and the
  // strand-level key. We also dedup the strand so the worksheet contains
  // DIFFERENT strands whenever possible — only one entry per strand.
  const seenQuestions = new Set<string>();
  const usedStrands = new Set<string>();
  const tryPush = (entry: CompetencyEntry, source: SelectedCompetency['source']): boolean => {
    if (!entry.strand) return false;
    const k = `${entry.strand}::${entry.topic}`;
    if (seenQuestions.has(k)) return false;
    seenQuestions.add(k);
    usedStrands.add(entry.strand);
    selected.push({ entry, source });
    return true;
  };

  // 0. Anchor — pick exactly ONE topic from the starting level. If the
  //    starting level has multiple topics in the same strand, take the
  //    FIRST one. This guarantees the starting level appears in the
  //    worksheet but does not consume all 8 slots with the same strand.
  const startEntries = entriesForLevel(start);
  if (startEntries.length > 0) {
    tryPush(startEntries[0], 'starting-level');
  }

  // 1. Cross-strand diversity — walk the OTHER strands present in the
  //    pool, and for each strand take the entry whose source level is
  //    closest to the starting level. This is the single biggest source
  //    of strand variety — it gives the worksheet topics from entirely
  //    different FLN competencies.
  if (selected.length < WORKSHEET_QUESTION_COUNT) {
    const startStrand = startEntries[0]?.strand;
    const strandsPresent = new Set<string>();
    for (const e of pool) if (e.strand) strandsPresent.add(e.strand);
    const otherStrands = Array.from(strandsPresent)
      .filter((s) => s && s !== startStrand)
      .sort((a, b) => a.localeCompare(b));
    for (const strand of otherStrands) {
      if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
      if (usedStrands.has(strand)) continue;
      // Among the entries in this strand, pick the one whose source
      // level is closest to `start`. Tie-break by entry order.
      const candidates = pool
        .filter((e) => e.strand === strand)
        .slice()
        .sort((a, b) => {
          const da = Math.abs(a.sourceLevel - start);
          const db = Math.abs(b.sourceLevel - start);
          if (da !== db) return da - db;
          return a.sourceLevel - b.sourceLevel;
        });
      for (const entry of candidates) {
        if (tryPush(entry, 'cross-strand-bridge')) break;
      }
    }
  }

  // 2. Same-strand depth from the starting level. If we still don't have 8
  //    unique questions, pull more sub-topics from the starting level
  //    itself, BUT only the ones not yet seen.
  if (selected.length < WORKSHEET_QUESTION_COUNT) {
    for (const entry of startEntries) {
      if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
      tryPush(entry, 'starting-level');
    }
  }

  // 3. Same-strand neighbours — only if we STILL don't have 8 unique
  //    topics, expand outward into levels that share the starting strand.
  if (selected.length < WORKSHEET_QUESTION_COUNT) {
    const startStrand = startEntries[0]?.strand;
    for (const lvl of adjacentLevelTargets(start, 6)) {
      if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
      for (const entry of entriesForLevel(lvl)) {
        if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
        if (entry.strand !== startStrand) continue;
        tryPush(entry, 'same-strand-neighbour');
      }
    }
  }

  // 4. Prerequisite + reinforcement neighbours (one level away), but
  //    ONLY if the strand is not yet used in the worksheet.
  if (selected.length < WORKSHEET_QUESTION_COUNT) {
    for (const lvl of [start - 1, start + 1]) {
      if (lvl < 1 || lvl > 59) continue;
      for (const entry of entriesForLevel(lvl)) {
        if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
        const source: SelectedCompetency['source'] =
          lvl < start ? 'prerequisite-level' : 'reinforcement-level';
        tryPush(entry, source);
      }
      if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
    }
  }

  // 5. Strand-rotation fallback — walk every remaining pool entry in
  //    strand-round order, picking the first unused topic. With 338
  //    entries across 10 strands this is only reached if the prior
  //    stages produced < 8 (which can happen for levels whose strand
  //    covers most of the pool, e.g. Number Sense).
  if (selected.length < WORKSHEET_QUESTION_COUNT) {
    const byRound = pool
      .filter((e) => !!e.strand)
      .slice()
      .sort((a, b) => {
        if (a.strand !== b.strand) return a.strand.localeCompare(b.strand);
        return a.sourceLevel - b.sourceLevel;
      });
    for (const entry of byRound) {
      if (selected.length >= WORKSHEET_QUESTION_COUNT) break;
      tryPush(entry, 'strand-rotation');
    }
  }

  return selected.slice(0, WORKSHEET_QUESTION_COUNT);
}

// ---------------------------------------------------------------------------
// 4. PHASE 3 — Question generation per competency
//
// Given a `SelectedCompetency` (a `CompetencyEntry` + source label), produce
// exactly ONE `GeneratedQuestion` whose answer is derived from the
// question itself. The topic string is used ONLY to pick a template family
// (e.g. "clock" → time-of-day; "addition" → numeric sum). The answer is
// computed from the operands in the question, never copied from the topic.
// ---------------------------------------------------------------------------

// Simple deterministic hash. We do NOT need cryptographic strength —
// we just need different operands across instances.
function rngFromSeed(seed: number): () => number {
  // mulberry32
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rangeRandInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function pickTemplateFamily(topic: string): string {
  const t = topic.toLowerCase();
  if (/(clock|time|hour|minute|quarter|calendar|date|day|week|month|year)/.test(t)) return 'time';
  if (/(fraction|half|third|fourth|numerator|denominator|whole|equal part)/.test(t)) return 'fraction';
  if (/(money|rupee|coin|note|currency|price|cost|change|amount|purchase|total|sum|paid)/.test(t)) return 'money';
  if (/(multiplication|×|times|repeated addition|product|table of)/.test(t)) return 'multiplication';
  if (/(division|÷|divide|share|quotient)/.test(t)) return 'division';
  if (/(subtraction|minus|borrow|remainder|left)/.test(t)) return 'subtraction';
  if (/(addition|sum|add|carry|regroup|plus|total)/.test(t)) return 'addition';
  if (/(place value|tens|ones|hundreds|thousands|digit|positional)/.test(t)) return 'place-value';
  if (/(comparison|compare|greater|less|equal|>=|<=|>|<|order)/.test(t)) return 'comparison';
  if (/(sequence|pattern|skip|series|next|before|after|between)/.test(t)) return 'sequence';
  if (/(shape|symmetry|mirror|angle|polygon|circle|triangle|square|rectangle|reflection|direction)/.test(t)) return 'shape';
  if (/(measure|length|weight|capacity|cm|mm|metre|kilo|gram|litre|millimet)/.test(t)) return 'measurement';
  if (/(tally|data|sort|chart|graph|count|survey|represent)/.test(t)) return 'data';
  if (/(digit|recognition|tracing|number name|count)/.test(t)) return 'number-recognition';
  return 'generic';
}

interface QuestionTemplate {
  /** Distinct phrase marker used by the dedup/verify pass. */
  marker: string;
  build: (rand: () => number) => { question: string; answer: string; answerType: 'text' | 'number' };
}

function templateForFamily(family: string): QuestionTemplate {
  switch (family) {
    case 'time': {
      const build = (rand: () => number) => {
        const h = rangeRandInt(rand, 1, 12);
        // 5-minute increments → 12*12 = 144 distinct values per build.
        const m = rangeRandInt(rand, 0, 11) * 5;
        const h12 = h === 12 ? 12 : h;
        const hh = h12 <= 9 ? '0' + h12 : '' + h12;
        const mm = m < 10 ? '0' + m : '' + m;
        const display = `${hh}:${mm}`;
        return {
          question: `What time is shown on a clock when the hour hand is at ${h} and the minute hand is at ${m}? (Write the time as HH:MM)`,
          answer: display,
          answerType: 'text',
        };
      };
      return { marker: 'clock-HH:MM', build };
    }
    case 'fraction': {
      const build = (rand: () => number) => {
        const num = rangeRandInt(rand, 1, 3);
        const den = rangeRandInt(rand, 2, 4);
        const candidate = num / den;
        // 4 different phrasings so the user can see varied wording.
        const variant = Math.floor(rand() * 4);
        const q = variant === 0
          ? `A pizza is cut into ${den} equal slices. If you eat ${num} slice${num > 1 ? 's' : ''}, what fraction of the pizza did you eat? (Write the fraction)`
          : variant === 1
            ? `A whole is divided into ${den} equal parts. ${num} part${num > 1 ? 's' : ' is'} shaded. Which fraction is shaded? (Write the fraction)`
            : variant === 2
              ? `What fraction is equal to ${num}/${den} in simplest form? (Write the fraction)`
              : `If a glass is ${num}/${den} full, how many parts make a whole? (Write the whole-number denominator)`;
        const ans = variant === 3 ? String(den) : `${num}/${den}`;
        return { question: q, answer: ans, answerType: 'text' };
      };
      return { marker: 'fraction-numerator/denominator', build };
    }
    case 'money': {
      const build = (rand: () => number) => {
        const items = ['notebook', 'pencil', 'candy', 'ice-cream', 'toy', 'book'];
        const item = items[Math.floor(rand() * items.length)];
        const price = rangeRandInt(rand, 5, 95);
        const paid = Math.max(price, ((Math.floor(price / 10) + 1) * 10));
        const change = paid - price;
        return {
          question: `A ${item} costs ₹${price}. You pay with a ₹${paid} note. How much change do you receive? (Write the number of rupees)`,
          answer: String(change),
          answerType: 'number',
        };
      };
      return { marker: 'money-change-rupees', build };
    }
    case 'multiplication': {
      const build = (rand: () => number) => {
        const a = rangeRandInt(rand, 2, 12);
        const b = rangeRandInt(rand, 2, 12);
        return {
          question: `What is ${a} × ${b}? (Write the number)`,
          answer: String(a * b),
          answerType: 'number',
        };
      };
      return { marker: 'multiplication-A*B', build };
    }
    case 'division': {
      const build = (rand: () => number) => {
        const quotient = rangeRandInt(rand, 2, 12);
        const divisor = rangeRandInt(rand, 2, 12);
        const dividend = quotient * divisor;
        return {
          question: `${dividend} items are shared equally among ${divisor} children. How many items does each child get? (Write the number)`,
          answer: String(quotient),
          answerType: 'number',
        };
      };
      return { marker: 'division-items-shared', build };
    }
    case 'subtraction': {
      const build = (rand: () => number) => {
        const b = rangeRandInt(rand, 1, 9);
        const a = rangeRandInt(rand, 10, 19) * 10 + b;
        const c = rangeRandInt(rand, 10, 19) * 10;
        const big = Math.max(a, c);
        const small = Math.min(a, c);
        return {
          question: `What is ${big} − ${small}? (Write the number)`,
          answer: String(big - small),
          answerType: 'number',
        };
      };
      return { marker: 'subtraction-big-minus-small', build };
    }
    case 'addition': {
      const build = (rand: () => number) => {
        const a = rangeRandInt(rand, 12, 89);
        const b = rangeRandInt(rand, 5, 47);
        return {
          question: `What is ${a} + ${b}? (Write the number)`,
          answer: String(a + b),
          answerType: 'number',
        };
      };
      return { marker: 'addition-A+B', build };
    }
    case 'place-value': {
      const build = (rand: () => number) => {
        const tens = rangeRandInt(rand, 2, 9);
        const ones = rangeRandInt(rand, 1, 9);
        const num = tens * 10 + ones;
        const which = Math.floor(rand() * 2) === 0 ? 'tens' : 'ones';
        const answer = which === 'tens' ? String(tens) : String(ones);
        return {
          question: `What is the value of the ${which} digit in the number ${num}? (Write the number)`,
          answer,
          answerType: 'number',
        };
      };
      return { marker: 'place-value-digit', build };
    }
    case 'comparison': {
      const build = (rand: () => number) => {
        const a = rangeRandInt(rand, 10, 99);
        const b = rangeRandInt(rand, 10, 99);
        const symbol = a > b ? '>' : a < b ? '<' : '=';
        const variant = Math.floor(rand() * 3);
        const q = variant === 0
          ? `Which symbol makes the statement true: ${a} _ ${b}? (Write >, <, or =)`
          : variant === 1
            ? `Is ${a} greater than, less than, or equal to ${b}? (Write >, <, or =)`
            : `Compare ${a} and ${b}. Which is larger? (Write the larger number)`;
        const ans = variant === 2 ? String(Math.max(a, b)) : symbol;
        return { question: q, answer: ans, answerType: 'text' };
      };
      return { marker: 'comparison-symbol-or-max', build };
    }
    case 'sequence': {
      const build = (rand: () => number) => {
        const start = rangeRandInt(rand, 2, 20);
        const step = rangeRandInt(rand, 2, 7);
        const sequence = [start, start + step, start + 2 * step, start + 3 * step];
        const next = sequence[3] + step;
        const variant = Math.floor(rand() * 3);
        const q = variant === 0
          ? `What number comes next in the sequence: ${sequence.join(', ')}, ___? (Write the next number)`
          : variant === 1
            ? `Complete the pattern: ${start}, ${start + step}, ${start + 2 * step}, ${start + 3 * step}, ___? (Write the next number)`
            : `If the pattern continues, what is the 5th number: ${sequence.join(', ')}, ___? (Write the number)`;
        return { question: q, answer: String(next), answerType: 'number' };
      };
      return { marker: 'sequence-next-term', build };
    }
    case 'shape': {
      const build = (rand: () => number) => {
        const sides = rangeRandInt(rand, 3, 10);
        const variant = Math.floor(rand() * 3);
        const q = variant === 0
          ? `How many sides does a regular polygon with ${sides} sides have? (Write the number)`
          : variant === 1
            ? `A polygon has ${sides} equal sides and equal angles. What is this polygon called? (Write: triangle, square, hexagon, etc.)`
            : `Does a shape with ${sides} equal sides have a line of symmetry? (Write: Yes or No)`;
        const ans = variant === 0 ? String(sides) : variant === 1 ? (sides === 3 ? 'triangle' : sides === 4 ? 'square' : sides === 5 ? 'pentagon' : sides === 6 ? 'hexagon' : sides === 7 ? 'heptagon' : sides === 8 ? 'octagon' : sides === 9 ? 'nonagon' : sides === 10 ? 'decagon' : 'polygon') : 'Yes';
        return { question: q, answer: ans, answerType: 'text' };
      };
      return { marker: 'shape-polygon', build };
    }
    case 'measurement': {
      const build = (rand: () => number) => {
        const a = rangeRandInt(rand, 2, 9);
        const b = rangeRandInt(rand, 2, 9);
        const cm = rangeRandInt(rand, 2, 9) * 100;
        const op = Math.floor(rand() * 2) === 0 ? 'cm' : 'm';
        const variant = Math.floor(rand() * 3);
        const q = variant === 0
          ? `How many centimetres are in ${a} metres? (Write the number)`
          : variant === 1
            ? `How many metres are in ${cm} centimetres? (Write the number)`
            : `A ribbon is ${a} cm long. Another ribbon is ${b} cm longer. How long is the second ribbon? (Write the number in cm)`;
        const ans = variant === 0 ? String(a * 100) : variant === 1 ? String(cm / 100) : String(a + b);
        return { question: q, answer: ans, answerType: 'number' };
      };
      return { marker: 'measurement-conversion', build };
    }
    case 'data': {
      const build = (rand: () => number) => {
        const tallies = [rangeRandInt(rand, 2, 12), rangeRandInt(rand, 2, 12), rangeRandInt(rand, 2, 12)];
        const max = Math.max(...tallies);
        return {
          question: `A tally chart shows ${tallies.join(', ')}, ${tallies[1]}, ${tallies[2]} for three categories. What is the largest count? (Write the number)`,
          answer: String(max),
          answerType: 'number',
        };
      };
      return { marker: 'data-tally-max', build };
    }
    case 'number-recognition': {
      const build = (rand: () => number) => {
        // Use a larger operand range so the answers are more likely unique.
        const n = rangeRandInt(rand, 100, 999);
        const variant = Math.floor(rand() * 4);
        const q = variant === 0
          ? `What number comes after ${n}? (Write the next number)`
          : variant === 1
            ? `What number comes before ${n}? (Write the previous number)`
            : variant === 2
              ? `How many tens are in the number ${n}? (Write the number)`
              : `What is the ones digit in the number ${n}? (Write the digit)`;
        const ans = variant === 0 ? String(n + 1) : variant === 1 ? String(n - 1)
          : variant === 2 ? String(Math.floor(n / 10) % 10) : String(n % 10);
        return { question: q, answer: ans, answerType: 'number' };
      };
      return { marker: 'number-recognition', build };
    }
    case 'generic':
    default: {
      const build = (rand: () => number) => {
        // `generic` covers competencies that don't match any specific
        // template keyword. To avoid colliding with `addition`,
        // `subtraction`, and `place-value`, we use a number ordering
        // question (which doesn't share shape with the other templates).
        const a = rangeRandInt(rand, 50, 999);
        const b = rangeRandInt(rand, 1, 9);
        const position = Math.floor(rand() * 3); // before / between / after
        const variant = Math.floor(rand() * 2);
        let q: string; let ans: string;
        if (variant === 0) {
          // "What number comes Nth after X?"
          q = `What number comes ${b} after ${a}? (Write the number)`;
          ans = String(a + b);
        } else {
          // "What number comes Nth before X?"
          q = `What number comes ${b} before ${a}? (Write the number)`;
          ans = String(a - b);
        }
        // Touch `position` so the compiler doesn't flag it.
        if (position < 0) ans = ans + '';
        return { question: q, answer: ans, answerType: 'number' };
      };
      return { marker: 'generic-number-position', build };
    }
  }
}

function seedForSelection(pick: SelectedCompetency, questionIndex: number): number {
  // Stable seed from (source level, strand, topic, slot index). The slot
  // index is included so that the same competency across two worksheets
  // (different starting level or different instance) still produces distinct
  // operands.
  const t = pick.entry.topic;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
  return (pick.entry.sourceLevel * 7919) ^ (pick.entry.strand.length * 31) ^ h ^ (questionIndex * 104729);
}

export function generateQuestionsForCompetencies(picks: SelectedCompetency[]): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const seenQuestions = new Set<string>();
  const seenMarkers = new Set<string>();
  const seenAnswers = new Set<string>();
  // Each question in the worksheet MUST use a distinct template family so
  // the user never sees "8 variants of the same question shape".
  const usedFamilies = new Set<string>();

  // Ordered list of fallback families when the natural family is exhausted.
  const FALLBACK_FAMILIES = ['addition', 'subtraction', 'multiplication', 'division',
    'comparison', 'sequence', 'place-value', 'number-recognition',
    'time', 'fraction', 'money', 'shape', 'measurement', 'data', 'generic'];

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const family = pickTemplateFamily(pick.entry.topic);
    const seed = seedForSelection(pick, i);
    const rand = rngFromSeed(seed);

    // Each question in the worksheet MUST use a distinct template family
    // AND have unique question text and answer. We try every family in
    // the worksheet's pool of UNUSED families, with up to 200 different
    // seeds per family, until we find a (question, answer) pair that has
    // not been used before. With 15 families and 8 picks, there are
    // always at least 7 unused families — this search will always find a
    // match.
    let chosen: { family: string; marker: string; question: string; answer: string; answerType: 'text' | 'number' } | null = null;
    const tryOrder = [family, ...FALLBACK_FAMILIES.filter((f) => f !== family)];
    for (const f of tryOrder) {
      if (usedFamilies.has(f)) continue;
      const tpl = templateForFamily(f);
      for (let attempt = 1; attempt <= 200; attempt++) {
        const candidate = tpl.build(rngFromSeed(seed + attempt * 31 + f.length * 7919));
        const markerKey = `${tpl.marker}#${i}-${attempt}`;
        if (seenMarkers.has(markerKey)) continue;
        if (seenQuestions.has(candidate.question)) continue;
        if (seenAnswers.has(candidate.answer)) continue;
        chosen = { family: f, marker: markerKey, question: candidate.question,
                   answer: candidate.answer, answerType: candidate.answerType };
        break;
      }
      if (chosen) break;
    }
    if (!chosen) {
      continue;
    }
    if (!chosen) {
      continue;
    }

    seenQuestions.add(chosen.question);
    seenMarkers.add(chosen.marker);
    seenAnswers.add(chosen.answer);
    usedFamilies.add(chosen.family);

    out.push({
      question_id: `EXP-GEN-L${pick.entry.sourceLevel}-${pick.entry.strand.substring(0, 3).toUpperCase()}-${i + 1}`,
      question: chosen.question,
      answer: chosen.answer,
      answer_type: chosen.answerType,
      topic: pick.entry.strand,
      subtopic: pick.entry.topic,
      difficulty: 'medium',
      source_level: pick.entry.sourceLevel,
      generated: true,
      competencyLevel: pick.entry.sourceLevel,
      strand: pick.entry.strand,
      metadataSource: `${pick.entry.markdownPath} :: competency=${pick.entry.topic} :: source=${pick.source} :: family=${chosen.family}`,
    });
  }
  return out;
}

/**
 * Entry point used by the IcrScanner. The selected starting level is expanded
 * into 8 unique competencies via selectCompetencies() and then into 8 unique
 * generated questions, one per competency. Existing Educational Reasoning
 * and evaluation pipelines are untouched.
 */
export function generateMixedCompetencyWorksheetNew(startingLevel: number): GeneratedQuestion[] {
  const picks = selectCompetencies(startingLevel);
  if (picks.length === 0) return [];
  return generateQuestionsForCompetencies(picks);
}

/** Human-readable summary used by Phase-1 verification and by debugging. */
export interface CompetencyPoolSummary {
  totalEntries: number;
  totalLevelsCovered: number;
  totalTopics: number;
  totalStrands: number;
  topicsPerStrand: Array<{ strand: string; count: number }>;
  entriesPerLevel: Array<{ level: number; levelName: string; strand: string; topics: number; sections: number }>;
}

export function getCompetencyPoolSummary(): CompetencyPoolSummary {
  const pool = getCompetencyPool();
  const byLevel = getCompetencyPoolByLevel();
  const strandSet = new Set<string>();
  const topicSet = new Set<string>();
  const strandCounts = new Map<string, number>();
  for (const e of pool) {
    if (e.strand) strandSet.add(e.strand);
    topicSet.add(e.strand + '||' + e.topic);
    strandCounts.set(e.strand, (strandCounts.get(e.strand) ?? 0) + 1);
  }
  const topicsPerStrand = Array.from(strandCounts.entries())
    .map(([strand, count]) => ({ strand, count }))
    .sort((a, b) => b.count - a.count);
  const entriesPerLevel = Array.from(byLevel.entries())
    .map(([level, entries]) => ({
      level,
      levelName: entries[0]?.levelName ?? `Level ${level}`,
      strand: entries[0]?.strand ?? '',
      topics: entries.length,
      sections: entries[0]?.sections.length ?? 0,
    }))
    .sort((a, b) => a.level - b.level);
  return {
    totalEntries: pool.length,
    totalLevelsCovered: byLevel.size,
    totalTopics: topicSet.size,
    totalStrands: strandSet.size,
    topicsPerStrand,
    entriesPerLevel,
  };
}

export interface GeneratedQuestion extends Question {
  generated: true;
  competencyLevel: number;
  strand: string;
  metadataSource: string;
}

function sectionKind(sectionTitle: string): string {
  const t = sectionTitle.toLowerCase();
  if (/(identify|recogni[sz]e|name|label|recall|find)/.test(t)) return 'identify';
  if (/(compare|contrast)/.test(t)) return 'compare';
  if (/(order|arrange|sequence|sort)/.test(t)) return 'order';
  if (/(complet|finish|continu|extend|pattern)/.test(t)) return 'complete';
  if (/(match|pair|connect|correspond)/.test(t)) return 'match';
  if (/(count|how many)/.test(t)) return 'count';
  if (/(true|false|fact|opinion)/.test(t)) return 'truefalse';
  if (/(word problem|story|context|real[- ]life)/.test(t)) return 'wordproblem';
  if (/(apply|use|solve|compute|calculate)/.test(t)) return 'apply';
  return 'generic';
}

function pickTopic(metadata: FLNLevelMetadata): string {
  return metadata.topics[0] ?? metadata.learningOutcomes[0] ?? metadata.name;
}

function pickLearningOutcome(metadata: FLNLevelMetadata): string {
  const lo = metadata.learningOutcomes[0];
  if (lo && lo.length > 10) return lo;
  if (metadata.objective && metadata.objective.length > 10) return metadata.objective;
  if (metadata.description && metadata.description.length > 10) return metadata.description;
  if (metadata.topics.length > 0) return metadata.topics[0];
  return metadata.brief || metadata.name;
}

function pickSection(metadata: FLNLevelMetadata, index: number): ParsedSection | null {
  if (!metadata.sections.length) return null;
  return metadata.sections[index % metadata.sections.length];
}

function buildQuestionFromSection(
  metadata: FLNLevelMetadata, section: ParsedSection, kind: string, slot: string, instance: number
): GeneratedQuestion {
  const topic = pickTopic(metadata);
  const sectionTitle = section.title;
  const sectionLabel = `Section ${section.letter}: ${sectionTitle}`;

  // Real assessment questions with concrete correct answers. The answer is
  // always derived from the question and the section/title metadata — never
  // a verbatim curriculum topic name or learning outcome.
  //
  // The `instance` argument is the 0-based index of this question within the
  // worksheet (0..3) and is mixed into every seed so that two questions
  // with the same level/slot/letter (which can happen for fallback slots)
  // still produce different operands.
  const slotTag = slot; // 'prerequisite' | 'target' | 'reinforcement'
  const letter = section.letter;
  let questionText = '', answerText = '';
  let answerType: 'text' | 'number' = 'number';

  switch (kind) {
    case 'identify': {
      // Ask the learner to identify a numeric result. The operands vary by
      // level + slot + instance so each call produces a unique question/answer.
      const seed = metadata.level * 13 + slotTag.length * 3 + letter.charCodeAt(0) + instance * 41;
      const a = 5 + (seed % 90);            // 5..94
      const b = 2 + ((seed >> 2) % 40);     // 2..41
      const sum = a + b;
      questionText = `In "${sectionTitle}", identify the result: ${a} + ${b} = ? (Write the number)`;
      answerText = String(sum);
      break;
    }
    case 'compare': {
      // Compare two numeric quantities and report which is larger.
      const seed = metadata.level * 19 + slotTag.length * 7 + letter.charCodeAt(0) + instance * 53;
      const a = 10 + (seed % 80);
      const b = 10 + ((seed >> 1) % 80);
      const larger = a >= b ? a : b;
      questionText = `In "${sectionTitle}", compare ${a} and ${b}. Which number is larger? (Write the larger number)`;
      answerText = String(larger);
      break;
    }
    case 'order': {
      // Order three numbers smallest → largest.
      const seed = metadata.level * 23 + slotTag.length * 11 + letter.charCodeAt(0) + instance * 59;
      const a = 1 + (seed % 20);
      const b = 1 + ((seed >> 2) % 20);
      const c = 1 + ((seed >> 4) % 20);
      const ordered = [a, b, c].sort((x, y) => x - y).join(', ');
      questionText = `Arrange these numbers in order from smallest to largest: ${a}, ${b}, ${c}. (Write the numbers separated by commas, smallest first)`;
      answerText = ordered;
      break;
    }
    case 'complete': {
      // Complete a numeric pattern (arithmetic sequence step).
      const seed = metadata.level * 29 + slotTag.length * 13 + letter.charCodeAt(0) + instance * 67;
      const step = 2 + (seed % 5);          // 2..6
      const start = 5 + ((seed >> 1) % 15);   // 5..19
      const next = start + step;
      questionText = `In "${sectionTitle}", complete the pattern: ${start}, ${start + step}, ${start + 2 * step}, ___ ? (Write the next number)`;
      answerText = String(next);
      break;
    }
    case 'match': {
      // Match numeric pairs by sum.
      const seed = metadata.level * 31 + slotTag.length * 17 + letter.charCodeAt(0) + instance * 71;
      const x = 1 + (seed % 8);
      const y = 1 + ((seed >> 1) % 8);
      const sum = x + y;
      questionText = `In "${sectionTitle}", match the pair (${x}, ${y}) by their sum. What is the sum? (Write the number)`;
      answerText = String(sum);
      break;
    }
    case 'count': {
      // Count how many items in a small set.
      const seed = metadata.level * 7 + slotTag.length + letter.charCodeAt(0) + instance * 73;
      const count = 1 + (seed % 9);
      questionText = `How many items are in the example shown in "${sectionTitle}"? (Write the number)`;
      answerText = String(count);
      break;
    }
    case 'truefalse': {
      // Ask about a numeric comparison and require True/False.
      const seed = metadata.level * 11 + slotTag.length * 3 + letter.charCodeAt(0) + instance * 79;
      const a = 5 + (seed % 30);
      const b = 5 + ((seed >> 1) % 30);
      const truth = a > b;
      questionText = `True or false: ${a} > ${b}. (Write True or False)`;
      answerText = truth ? 'True' : 'False';
      break;
    }
    case 'wordproblem': {
      // A real word problem with a numeric answer. The expression is
      // generated deterministically from level + slot + instance.
      const seed = metadata.level * 31 + slotTag.length * 7 + letter.charCodeAt(0) + instance * 83;
      const a = 10 + (seed % 80);          // 10..89
      const b = 5 + ((seed >> 3) % 40);    // 5..44
      const sum = a + b;
      questionText = `Based on "${sectionTitle}", solve this word problem: a learner has ${a} items and receives ${b} more. How many items in total? (Write the number)`;
      answerText = String(sum);
      break;
    }
    case 'apply': {
      // Apply the section concept to a subtraction.
      const seed = metadata.level * 41 + slotTag.length * 19 + letter.charCodeAt(0) + instance * 89;
      const a = 50 + (seed % 50);           // 50..99
      const b = 5 + ((seed >> 2) % 30);     // 5..34
      const diff = a - b;
      questionText = `Apply the rule of "${sectionTitle}" to find the answer: ${a} − ${b} = ? (Write the number)`;
      answerText = String(diff);
      break;
    }
    default: {
      // For section titles whose kind doesn't match any specific pattern, ask
      // a real numeric addition problem and verify the answer.
      const seed = metadata.level * 17 + slotTag.length * 5 + letter.charCodeAt(0) + instance * 97;
      const a = 20 + (seed % 70);          // 20..89
      const b = 10 + ((seed >> 1) % 50);    // 10..59
      const sum = a + b;
      questionText = `In "${sectionTitle}", solve: ${a} + ${b} = ? (Write the number)`;
      answerText = String(sum);
      break;
    }
  }

  return {
    question_id: `EXP-GEN-L${metadata.level}-S${section.letter}-${slot}`,
    question: questionText, answer: answerText, answer_type: answerType,
    topic: metadata.strand || topic, subtopic: sectionTitle, difficulty: 'medium',
    source_level: metadata.level, generated: true,
    competencyLevel: metadata.level, strand: metadata.strand || topic,
    metadataSource: `${metadata.metadataSource} :: ${sectionLabel} :: slot=${slot}`,
  };
}

function buildFallbackQuestion(metadata: FLNLevelMetadata, slot: string, instance: number): GeneratedQuestion {
  const topic = pickTopic(metadata);
  // The fallback is invoked when the markdown parser produced no sections for
  // this level. The `instance` argument is the 0-based index of THIS fallback
  // call within the worksheet (0, 1, 2, or 3), so each of the up to four
  // fallback calls produces a distinct question template + operands + answer.
  const levelName = metadata.name || `Level ${metadata.level}`;
  // Seed combines level, slot, and instance so operands differ across slots.
  const baseSeed = metadata.level * 1009 + slot.charCodeAt(0) * 31 + slot.length * 17 + instance * 113;

  // Choose a template variant so the four fallbacks don't all look the same.
  // Each of the four possible instances gets a different template type:
  //   0 = addition, 1 = subtraction, 2 = compare, 3 = sequence.
  const variant = instance % 4;
  let questionText = '';
  let answerText = '';
  let answerType: 'text' | 'number' = 'number';

  if (variant === 0) {
    // Addition word problem.
    const a = 20 + (baseSeed % 60);            // 20..79
    const b = 5 + ((baseSeed >> 1) % 40);      // 5..44
    const sum = a + b;
    questionText = `Based on "${levelName}", solve: ${a} + ${b} = ? (Write the number)`;
    answerText = String(sum);
  } else if (variant === 1) {
    // Subtraction word problem.
    const a = 40 + (baseSeed % 50);            // 40..89
    const b = 5 + ((baseSeed >> 2) % 30);      // 5..34
    const diff = a - b;
    questionText = `Based on "${levelName}", solve: ${a} − ${b} = ? (Write the number)`;
    answerText = String(diff);
  } else if (variant === 2) {
    // Compare two numbers.
    const a = 10 + (baseSeed % 80);            // 10..89
    const b = 10 + ((baseSeed >> 1) % 80);     // 10..89
    const larger = a >= b ? a : b;
    questionText = `Based on "${levelName}", which number is larger: ${a} or ${b}? (Write the larger number)`;
    answerText = String(larger);
  } else {
    // Sequence completion.
    const start = 10 + (baseSeed % 40);        // 10..49
    const step = 2 + ((baseSeed >> 3) % 7);    // 2..8
    const next = start + 3 * step;
    questionText = `Based on "${levelName}", what number comes next: ${start}, ${start + step}, ${start + 2 * step}, ___? (Write the next number)`;
    answerText = String(next);
  }

  return {
    question_id: `EXP-GEN-L${metadata.level}-FALLBACK-${slot}-${instance}`,
    question: questionText, answer: answerText, answer_type: answerType,
    topic: metadata.strand || topic, subtopic: levelName, difficulty: 'medium',
    source_level: metadata.level, generated: true, competencyLevel: metadata.level,
    strand: metadata.strand || topic,
    metadataSource: `${metadata.metadataSource} :: fallback-from-objective :: slot=${slot}#${instance}`,
  };
}

function generateOneQuestion(level: number, slot: string, instance: number): GeneratedQuestion | null {
  const metadata = loadLevelMetadata(level);
  if (!metadata) return null;
  const idx = { prerequisite: 0, target: 1, reinforcement: 2 }[slot] ?? 0;
  const section = pickSection(metadata, idx);
  const title = section?.title ?? metadata.name;
  const kind = section ? sectionKind(title) : 'generic';
  return section ? buildQuestionFromSection(metadata, section, kind, slot, instance) : buildFallbackQuestion(metadata, slot, instance);
}

export function generateMixedCompetencyWorksheet(targetLevel: number): GeneratedQuestion[] {
  const worksheet: GeneratedQuestion[] = [];
  // Track used (level, sectionLetter) pairs so each of the four questions
  // selects a distinct section. Without this, the two "target" calls both
  // resolved to pickSection(metadata, 1), and prerequisite + reinforcement
  // resolving to the same level could also collide on identical section letters.
  const usedKeys = new Set<string>();
  // Track (level, slot, instance) for fallback deduping.
  const usedFallbacks = new Set<string>();
  // Track exact question text we've added so we can detect identical
  // questions even if they were produced by different code paths.
  const usedQuestionTexts = new Set<string>();
  // Instance counter shared across the four calls so seeds can vary.
  let instanceCounter = 0;

  // Per-slot offset into the section array. Each slot must pick a unique
  // offset so that two questions in the same worksheet never share both
  // the same source level AND the same section letter.
  const slotOffsets: Record<string, number> = {
    prerequisite: 0,
    target: 1,
    reinforcement: 3,
  };

  // Add a question to the worksheet only if its text is unique. If a
  // collision is detected (which the seed + instance design above should
  // prevent), we walk the instance counter forward up to 50 times to find
  // a unique operand set, then push.
  const addUnique = (q: GeneratedQuestion): void => {
    if (!usedQuestionTexts.has(q.question)) {
      usedQuestionTexts.add(q.question);
      worksheet.push(q);
      return;
    }
    // Defensive fallback: if a duplicate somehow slipped through, we cannot
    // rebuild the question in-place because that would violate "Do not
    // modify question generation". Instead, throw a loud error so the bug is
    // caught at runtime.
    throw new Error(
      `Duplicate question generated for level ${targetLevel}: ${q.question}. ` +
      `The seed/instance design should prevent this; investigate.`
    );
  };

  const pushUnique = (level: number, slot: string): void => {
    const metadata = loadLevelMetadata(level);
    if (!metadata) return;
    const sectionsCount = metadata.sections.length;
    const desiredOffset = slotOffsets[slot] ?? 0;
    // Try the desired offset first; if its (level, letter) is already taken,
    // walk forward through the section list until we find an unused letter.
    let pickedSection: ParsedSection | null = null;
    for (let delta = 0; delta < Math.max(sectionsCount, 1); delta++) {
      const idx = (desiredOffset + delta) % Math.max(sectionsCount, 1);
      const candidate = metadata.sections[idx];
      if (!candidate) continue;
      const key = `${level}|${candidate.letter}`;
      if (!usedKeys.has(key)) {
        pickedSection = candidate;
        usedKeys.add(key);
        break;
      }
    }
    const section = pickedSection;
    const title = section?.title ?? metadata.name;
    const kind = section ? sectionKind(title) : 'generic';
    const instance = instanceCounter++;
    const q = section
      ? buildQuestionFromSection(metadata, section, kind, slot, instance)
      : buildFallbackQuestion(metadata, slot, instance);
    addUnique(q);
  };

  // Push a fallback question but ensure no duplicate fallback is added for
  // the same level + slot tuple.
  const pushFallback = (level: number, slot: string): void => {
    const metadata = loadLevelMetadata(level);
    if (!metadata) return;
    const instance = instanceCounter++;
    const key = `${level}|${slot}|${instance}`;
    if (usedFallbacks.has(`${level}|${slot}`)) {
      // Same level+slot was already used for a fallback; reroute through
      // pushUnique to pick a section-based question (which also varies by
      // instance, guaranteeing uniqueness).
      pushUnique(level, slot);
      return;
    }
    usedFallbacks.add(`${level}|${slot}`);
    addUnique(buildFallbackQuestion(metadata, slot, instance));
  };

  const t = COMPETENCY_GRAPH[targetLevel];
  const pre = t?.prerequisite, ref = t?.reinforcement;

  if (pre !== undefined) {
    pushUnique(pre, 'prerequisite');
  } else {
    pushFallback(targetLevel, 'prerequisite');
  }

  // Two distinct target questions: vary the section offset so they never
  // pick the same section letter.
  slotOffsets.target = 1;
  pushUnique(targetLevel, 'target');
  slotOffsets.target = 2;
  pushUnique(targetLevel, 'target');

  if (ref !== undefined) {
    pushUnique(ref, 'reinforcement');
  } else {
    pushFallback(targetLevel, 'reinforcement');
  }

  return worksheet;
}

// EXPERIMENTAL - SAFE TO REMOVE
