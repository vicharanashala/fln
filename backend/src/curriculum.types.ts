// Domain types: curriculum and question/content definitions.

import type { QuestionFamily } from './types/questionTemplateParams';

export interface Question {
  question_id: string;
  question: string;
  answer: string;
  answer_type: 'text' | 'number' | 'choice';
  choices?: string[];
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_level: number; // Mapping to mathematical level
  conceptId?: string; // Concept ID from 93-node framework (e.g. S1.1, S3.3)
  svgAsset?: string; // Standard pre-built SVG asset category
}

/**
 * One rendered file coming out of the standalone Levels_backend batch
 * pipeline (POST /api/generate-batch) for a single student x sublevel x
 * set. answerKey/coords are stored verbatim (shape from that service's
 * buildCleanAnswerKey / captureCoords) so the ICR evaluation pipeline can
 * mark against the real thing instead of a placeholder.
 */
export interface QuestionBankEntry {
  /**
   * Stable identity, derived from (level, section, questionNumber) — verified
   * unique across all 1202 seeded questions. Deliberately NOT derived from the
   * question text: 314 questions share their text with another, and fixing a
   * typo must not orphan a reviewer's mapping.
   *
   * This exists so review work survives a re-seed. Before it, `seedQuestionBank`
   * did deleteMany + insertMany, so every re-seed rotated the Mongo _ids and
   * would have silently destroyed every mapping a superadmin had made.
   */
  questionId: string;

  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml: string;

  // --- Review state. Written by a human, never by the seeder. ---

  /** The 93-space level this question actually assesses, once a human says so. */
  mappedLevel?: number | null;
  /** Immutable concept tag (S1.1 - S7.18), set from the mapped level. */
  conceptId?: string;
  /**
   * `untagged` — nobody has looked at it yet.
   * `mapped`   — a human assigned it to a 93-space level.
   * `retired`  — a human judged it not worth keeping. Kept, not deleted, so the
   *              decision is auditable and reversible; readers must filter it out.
   */
  reviewStatus?: 'untagged' | 'mapped' | 'retired';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

/** The one place the question identity is computed. Seeder and API must agree. */
export function questionBankId(level: number | string, section: string, questionNumber: number | string): string {
  return `qb_L${level}_${String(section).replace(/[^A-Za-z0-9.]+/g, '-')}_${questionNumber}`;
}

// Canonical set of assessment cycle names, used everywhere a cycle name is
// displayed or written (levelHistory.reason, Worksheet.cycle) so there is
// exactly one naming scheme across the whole app.
export const CYCLE_NAMES = ['Baseline', 'Mid-year', 'End-of-year'] as const;
export type CycleName = typeof CYCLE_NAMES[number];
export interface QuestionLogic {
  id: string;
  /** 1..LEVEL_COUNT, L-notation. Mutable — a logic filed under the wrong level can be re-tagged. */
  level: number;
  /** Denormalized for display so the list view needs no join. */
  levelName: string;
  /** At least one. Validated server-side against the level's primary+supporting skills. */
  skills: string[];
  /** Optional. Empty means "assess the skill at full granularity", which is a valid choice. */
  subskills: string[];
  logicText: string;
  /**
   * Which relationship taxonomy was in force when this was authored.
   * The project is moving from the code's 4-type model to the research's
   * 3-type model; pinning it per-document means both can coexist through the
   * migration instead of forcing a schema break.
   */
  taxonomy: '3-type' | '4-type';
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail: string;
  /** Soft delete: the generation pipeline may already hold this id, so the row stays for audit. */
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * A Superadmin-authored question: the stem a child reads, how the answer is
 * recorded, and the constraints that govern the numbers inside it.
 *
 * Distinct from `QuestionLogic`, which described a question in prose and left
 * the generator to interpret it. A template says the same thing in fields that
 * can be validated, compared and bulk-imported, so two authors describing the
 * same variation produce the same row rather than two sentences that only a
 * human can tell apart.
 *
 * Addressed by `conceptId`, never by level number. Levels are insertable and
 * re-orderable; the concept a question assesses is not. See `CurriculumLevel`.
 */
export interface QuestionTemplate {
  id: string;

  /** Canonical curriculum identity, e.g. "S3.4". The thing this question assesses. */
  conceptId: string;
  /**
   * Display alias only, resolved from `conceptId` at write time. Never the
   * identity: it is denormalised so the list view needs no join, and it is
   * recomputed whenever the concept changes.
   */
  levelNumber: number;
  levelName: string;

  /** At least one. Validated server-side against the level's primary+supporting skills. */
  skills: string[];
  /** Optional. Empty means "assess the skill at full granularity", which is a valid choice. */
  subskills: string[];

  /**
   * Whether this item is answered on a student worksheet, recorded by a
   * teacher watching the child, or valid either way. Added 2026-09-19 for
   * Balvatika's two-sheet decision (PR #517 §4): NCF-FS §6.1.2(a) rules out
   * written tests at this age for some outcomes (e.g. "counts in any order,
   * total stays the same" — the order can't be captured on paper, only
   * observed). Defaults to 'written' for existing rows, since every template
   * before this field existed was authored for the student worksheet path;
   * `'observed'`/`'both'` are opt-in on new rows, not inferred.
   */
  assessmentMode: 'written' | 'observed' | 'both';

  /**
   * What the question should make the child do, in the author's words. This is
   * an instruction to the generator, not a finished question: it names the
   * learning action, the visual behaviour, and how the answer is given.
   *
   * Required for structured records. Deliberately never contains a specific
   * number or object, so one intent can be rendered across every visual theme
   * without being re-authored.
   */
  generationIntent: string;

  /** Which family of question this intent produces. Governs how it is rendered. */
  questionFamily: QuestionFamily;

  /**
   * How this row was authored. `structured` rows carry a generationIntent and
   * no authored answer. `legacy-free-text` rows predate that and carry a stem.
   * Kept explicit so a migration never has to guess by sniffing empty strings.
   */
  paramMode: 'structured' | 'legacy-free-text' | 'hybrid';

  /**
   * Visual themes this intent may be drawn with, as ids into the SVG manifest.
   * Plural because one counting intent should work across fruit, animals and
   * vehicles; the renderer picks a variant per paper.
   */
  svgThemeIds: string[];

  /**
   * LEGACY. What the child reads, written out by hand. Retained read-only so
   * rows authored before the intent model are not lost; new structured records
   * leave it empty. Do not add new writers.
   */
  stem: string;
  /**
   * LEGACY. A hand-authored answer. Retained for the same reason as `stem`.
   *
   * Structured records must not carry one: the answer is produced by the
   * generator and lives on the generated Question as an internal answer key,
   * never as something a Superadmin typed into the authoring form.
   */
  answerSpec: string;

  // --- Structured parameters. See backend/src/types/questionTemplateParams.ts ---
  numeralRange: string | null;
  digitCount: string | null;
  /** Empty means "not specified", not "any operation". */
  operations: string[];
  maxOperandCount: number | null;
  carryBehavior: string | null;
  borrowBehavior: string | null;
  maxSumOrDifference: string | null;
  answerType: string | null;
  blankCount: number | null;
  questionCount: number | null;
  subjectCategory: string | null;

  /**
   * Human-readable name for this variation, derived from the parameters at
   * creation. Editable afterwards, and an edit is preserved: the derivation
   * runs again only when an author asks for it.
   */
  name: string;
  /**
   * Fingerprint of (conceptId + parameters). Two templates constraining the
   * same thing at the same concept share a key, which is what makes duplicate
   * variations findable. Deliberately not a unique index — two Superadmins may
   * legitimately author the same variation with different stems.
   */
  variantKey: string;
  /** Free-form author tags, lowercased and de-duplicated on write. */
  tags: string[];

  /** Where the row came from. Bulk imports are worth being able to find again. */
  source: 'form' | 'csv';

  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail: string;
  /** Soft delete: a generated paper may already cite this id, so the row stays for audit. */
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * One selectable value in the question-authoring form: a number range, an
 * operation, or a visual theme.
 *
 * These live in the database rather than in a TypeScript constant so a
 * Superadmin can add "0 to 500" without a deploy. The catalogue, the server
 * validation and the form all read these same rows, which is what stops a
 * value existing in the dropdown but being rejected on save.
 */
export interface QuestionOption {
  id: string;
  type: 'numeral-range' | 'operation' | 'svg-theme';
  /** Stable machine key, e.g. "0-500". Unique per type among active rows. */
  key: string;
  label: string;

  /** Range bounds. Only meaningful when type is 'numeral-range'. */
  min?: number;
  max?: number;

  /**
   * Whether anything can actually generate with this value yet.
   *
   * A label in the database is not an implementation: an author can record
   * that they want modulo questions, but the option stays out of the
   * generation catalogue until something can produce one. This is what stops
   * a Superadmin authoring rows that silently never generate.
   */
  implementationStatus: 'ready' | 'not-ready';

  /** Soft delete. Values are deactivated, never removed, because rows reference them. */
  active: boolean;

  /** Marks a value we intend to retire but have not migrated off yet. */
  deprecated?: boolean;

  metadata?: Record<string, unknown>;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One teacher's rating of one student on one observable concept, for one
 * assessment cycle. Added 2026-09-19 for Balvatika's teacher-observation
 * sheet (PR #517 §4/§4b) — the counterpart to `answerSubmissions` for
 * concepts that can't be captured on a written worksheet at all (NCF-FS
 * §6.1.2(a) forbids testing at this age for some outcomes; a teacher watches
 * and records instead).
 *
 * Deliberately a separate collection from `answerSubmissions`, not a variant
 * of it: the author is the teacher, not the child; there is no scanned
 * artefact or answer key; and the rating scale is the three-level Holistic
 * Progress Card scale (PR #517 §4b), not correct/incorrect. Folding this into
 * `answerSubmissions` would force every consumer of that collection to
 * branch on "was this actually answered by a student," which is exactly the
 * kind of two-incompatible-lifecycles problem `QuestionLogic`'s own comment
 * warns against for a different pair of collections.
 *
 * One record = one (studentId, conceptId, cycle) rating. A class-grid sheet
 * and a per-child half-page sheet (PR #517 §4's two supported teacher-sheet
 * layouts) both produce the same shape of record on the backend — the
 * layout is a rendering/scanning choice, not a data-model one.
 */

export interface CurriculumLevel {
  /**
   * Canonical, immutable identity. Generated once at first insert and never
   * regenerated — student evidence points here, so renumbering would orphan it.
   * Every other identifier on this document is an alias of this one.
   */
  conceptId: string;

  /** L-notation, 1..93. The alias the platform standardises on. */
  levelNumber: number;
  /** Research S-notation, e.g. "S4.3". */
  sCode: string;
  /**
   * The retired 1..59 worksheet-engine id, where one maps.
   *
   * Deliberately temporary: it is the bridge that lets 59-keyed content be
   * re-keyed by lookup rather than by hand, and lets anything still speaking
   * 59 keep working mid-migration. Null once a level has no 59-space ancestor,
   * and the field is dropped entirely once nothing reads it.
   */
  legacyLevel59: number | null;

  stage: string;
  capability: string;
  strand: string;

  /** From the skill map — a level is defined by the skills it assesses. */
  primarySkills: string[];
  supportingSkills: string[];
  subskills: string[];

  /**
   * Content coverage, recomputed at every seed. These are the honest answer to
   * "how many of the 93 can we actually render today" — false is a real gap,
   * not a defect.
   */
  hasStaticHtml: boolean;
  hasBuilder: boolean;

  curriculumVersion: string;
  createdAt: string;
  updatedAt: string;
}

