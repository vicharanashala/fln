/**
 * server/idGenerator.ts
 * ---------------------------------------------------------------------------
 * Centralized ID generation for the FLN platform — replaces the ad-hoc
 * random ID generation currently at two call sites in server/index.ts:
 *
 *   - POST /api/students        →  'STD_' + Math.floor(10000 + Math.random() * 90000)
 *   - POST /api/admin/create    →  'u_' + Math.random().toString(36).substr(2, 9)
 *
 * Produces two kinds of IDs:
 *   - Teacher ID  (11 chars): version(1) + school(6) + 'T' + seq(2) + checksum(1)
 *   - Student ID  (12 chars): version(1) + school(6) + 'S' + seq(3) + checksum(1)
 *
 * WHY THIS DESIGN (given what actually exists in this repo today)
 * ---------------------------------------------------------------------------
 * The `School` type in types.ts has no UDISE field yet — schools are keyed
 * by a hand-assigned slug (e.g. "gps-mt-001"). So, unlike a design built
 * around a real 11-digit UDISE code, we can't losslessly encode the school
 * segment yet. Instead:
 *
 *   - The school segment is a deterministic SHA-256 hash of whatever unique
 *     school identifier is currently available, truncated to 6 Base32
 *     characters.
 *   - `getSchoolIdentifier()` prefers `school.udiseCode` if that field is
 *     present, and falls back to `school.id` (the existing manually-created
 *     slug) otherwise.
 *
 * WHY WE DON'T FREEZE/CACHE THE SEGMENT (a deliberate, discussed decision)
 * ---------------------------------------------------------------------------
 * An earlier version of this module cached the computed segment onto the
 * school record the first time it was generated, so that switching a
 * school's identifier source (slug -> udiseCode) later wouldn't change
 * IDs that were already issued and printed. That protection is only
 * necessary if real IDs get issued to actual students/teachers BEFORE
 * UDISE integration lands.
 *
 * The plan here is the opposite: UDISE codes get imported and wired into
 * `School.udiseCode` BEFORE this system is used for real (i.e. before any
 * ID that needs to survive long-term gets generated/printed). Any IDs
 * generated before that point are effectively throwaway/dev/demo data.
 * So there's no continuity to protect, and the extra persistence
 * machinery (a `schoolCode` cache field, a `persistSchoolCode` callback,
 * a dbStore.updateSchool dependency) isn't worth carrying. This file
 * simply recomputes the segment from whatever identifier is available on
 * every call — once `udiseCode` is populated for a school, its segment
 * changes automatically and permanently to the UDISE-derived one, with no
 * migration step required.
 *
 * IF THIS ASSUMPTION EVER CHANGES — e.g. if IDs get issued/printed for
 * real use BEFORE UDISE is integrated, and those need to stay valid
 * afterwards — reintroduce a cached `schoolCode` field on `School` and
 * freeze the segment on first generation instead of recomputing it live.
 *
 * Other design points :
 *   - Alphabet: Crockford's Base32 (excludes I, L, O, U) to reduce
 *     transcription errors when IDs are hand-copied off printed sheets.
 *   - Every ID carries a checksum character for offline validation.
 *   - Student IDs are NOT tied to a teacher — a student's teacher can
 *     change (see Student.teacherId, which is already a separate,
 *     mutable field in types.ts) without invalidating their ID.
 *   - `generateVerificationToken()` is for anything public-facing
 *     (e.g. a future "verify this certificate" page) — never expose the
 *     raw sequential ID on a public lookup endpoint.
 *
 * KNOWN LIMITATION — PLEASE READ BEFORE WIRING THIS IN
 * ---------------------------------------------------------------------------
 * The `CountBasedSequenceProvider` below determines "next sequence number"
 * by COUNTING existing records for a school via `dbStore.getStudents()` /
 * `dbStore.getUsers()`. This is NOT atomic — two concurrent requests for
 * the same school could read the same count and generate a duplicate
 * sequence number. It's a reasonable stand-in for the current early-MVP
 * stage (file-based store, low concurrency), but should be replaced with
 * a real atomic counter once `server/db.ts` is available to wire against
 * (e.g. a counters collection/section in the file-based store with a
 * file-lock or single-writer-queue increment). I have not patched anything
 * into db.ts, this count-based approach is the intentional current tradeoff,
 * rather than creating an atomic one — swap the implementation without
 * touching `generateTeacherId`/`generateStudentId` at all.
 * ---------------------------------------------------------------------------
 */

import { createHash, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Alphabet
// ---------------------------------------------------------------------------
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32, 32 symbols
const ALPHABET_INDEX: Record<string, number> = Object.fromEntries(
  [...ALPHABET].map((c, i) => [c, i])
);

const SCHEME_VERSION = "A";

const SCHOOL_SEGMENT_LENGTH = 6; // 30 bits of hash space — see note above

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EntityType = "TEACHER" | "STUDENT";

/** Minimal shape this module needs from a School record. */
export interface SchoolLike {
  id: string;
  udiseCode?: string; // not in types.ts yet — populate this once UDISE import lands;
                       // the school segment switches to it automatically, no migration needed
}

export interface SequenceProvider {
  nextSequence(schoolIdentifier: string, entityType: EntityType): Promise<number>;
}

export interface ParsedId {
  version: string;
  entityType: EntityType | null;
  schoolSegment: string; // NOTE: not reversible to the original school id/UDISE — see module docstring
  sequence: number;
  valid: boolean;
}

export class IdGenerationError extends Error {}

// ---------------------------------------------------------------------------
// Base32 helpers
// ---------------------------------------------------------------------------

function toBase32(num: number, length: number): string {
  if (num < 0 || !Number.isFinite(num)) {
    throw new IdGenerationError(`toBase32: invalid input ${num}`);
  }
  let n = Math.floor(num);
  let out = "";
  do {
    out = ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  } while (n > 0);
  if (out.length > length) {
    throw new IdGenerationError(
      `toBase32: value ${num} does not fit in ${length} base32 characters`
    );
  }
  return out.padStart(length, "0");
}

function fromBase32(str: string): number {
  let n = 0;
  for (const ch of str) {
    const val = ALPHABET_INDEX[ch];
    if (val === undefined) {
      throw new IdGenerationError(`fromBase32: invalid character '${ch}' in "${str}"`);
    }
    n = n * 32 + val;
  }
  return n;
}

// ---------------------------------------------------------------------------
// School segment — recomputed live from whatever identifier is currently
// available. See "WHY WE DON'T FREEZE/CACHE THE SEGMENT" in the module
// docstring above for why this is intentional, not an oversight.
// ---------------------------------------------------------------------------

/** Prefers a real UDISE code if present; falls back to the existing school slug. */
export function getSchoolIdentifier(school: SchoolLike): string {
  return school.udiseCode ?? school.id;
}

function hashSchoolIdentifier(identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest();
  // Take the first 4 bytes (32 bits) as an unsigned integer, then encode
  // into SCHOOL_SEGMENT_LENGTH base32 chars (30 bits) — drop the top 2
  // bits so it always fits.
  const num = digest.readUInt32BE(0) >>> 2;
  return toBase32(num, SCHOOL_SEGMENT_LENGTH);
}

// ---------------------------------------------------------------------------
// Checksum — mod-32 weighted check character
// ---------------------------------------------------------------------------

function computeChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const val = ALPHABET_INDEX[body[i]];
    if (val === undefined) {
      throw new IdGenerationError(`computeChecksum: invalid character '${body[i]}'`);
    }
    sum += val * (i + 1);
  }
  return ALPHABET[sum % 32];
}

// ---------------------------------------------------------------------------
// Per-entity-type layout config
// ---------------------------------------------------------------------------

const SEQ_LENGTH: Record<EntityType, number> = {
  TEACHER: 2, // 32^2 = 1,024 teachers per school
  STUDENT: 3, // 32^3 = 32,768 cumulative student enrollments per school
};

const TYPE_MARKER: Record<EntityType, string> = {
  TEACHER: "T",
  STUDENT: "S",
};

const MARKER_TO_TYPE: Record<string, EntityType> = {
  T: "TEACHER",
  S: "STUDENT",
};

// ---------------------------------------------------------------------------
// Public API — generation
// ---------------------------------------------------------------------------

/**
 * Generates a new, unique Teacher ID for the given school.
 * Call site: server/index.ts POST /api/admin/create (when role === TEACHER).
 */
export async function generateTeacherId(
  school: SchoolLike,
  sequenceProvider: SequenceProvider
): Promise<string> {
  return generateId("TEACHER", school, sequenceProvider);
}

/**
 * Generates a new, unique Student ID for the given school.
 * Call site: server/index.ts POST /api/students.
 */
export async function generateStudentId(
  school: SchoolLike,
  sequenceProvider: SequenceProvider
): Promise<string> {
  return generateId("STUDENT", school, sequenceProvider);
}

async function generateId(
  entityType: EntityType,
  school: SchoolLike,
  sequenceProvider: SequenceProvider
): Promise<string> {
  // Recomputed every call, on purpose — see module docstring. Once
  // school.udiseCode is populated (post-import), this line automatically
  // starts producing UDISE-derived segments for that school, with no
  // migration/backfill step required.
  const identifier = getSchoolIdentifier(school);
  const schoolSegment = hashSchoolIdentifier(identifier);

  const seq = await sequenceProvider.nextSequence(school.id, entityType);
  const seqLength = SEQ_LENGTH[entityType];
  const maxSeq = 32 ** seqLength - 1;

  if (seq > maxSeq) {
    throw new IdGenerationError(
      `Sequence overflow for ${entityType} at school ${school.id}: ` +
        `${seq} exceeds max of ${maxSeq}. Increase SEQ_LENGTH for this entity type.`
    );
  }

  const seqSegment = toBase32(seq, seqLength);
  const body = SCHEME_VERSION + schoolSegment + TYPE_MARKER[entityType] + seqSegment;
  const checksum = computeChecksum(body);
  return body + checksum;
}

// ---------------------------------------------------------------------------
// Public API — offline validation
// ---------------------------------------------------------------------------

/**
 * Validates and decodes a Teacher or Student ID WITHOUT a database lookup.
 * NOTE: because the school segment is a hash (not a lossless encoding,
 * unlike a future UDISE-based version), this can confirm an ID is
 * well-formed and untampered, and tell you the sequence number + entity
 * type — but it CANNOT recover which school the segment came from. That
 * still requires a DB lookup (or a switch to lossless UDISE encoding).
 */
export function parseAndValidateId(id: string): ParsedId {
  const empty: ParsedId = { version: "", entityType: null, schoolSegment: "", sequence: -1, valid: false };

  const minLen = 1 + SCHOOL_SEGMENT_LENGTH + 1 + 1 + 1;
  if (!id || id.length < minLen) return empty;

  const version = id[0];
  const body = id.slice(0, -1);
  const providedChecksum = id[id.length - 1];

  let expectedChecksum: string;
  try {
    expectedChecksum = computeChecksum(body);
  } catch {
    return { ...empty, version };
  }

  const schoolSegment = id.slice(1, 1 + SCHOOL_SEGMENT_LENGTH);
  const marker = id[1 + SCHOOL_SEGMENT_LENGTH];
  const entityType = MARKER_TO_TYPE[marker] ?? null;
  const seqSegment = id.slice(1 + SCHOOL_SEGMENT_LENGTH + 1, id.length - 1);

  if (!entityType) return { ...empty, version };

  let sequence = -1;
  try {
    sequence = fromBase32(seqSegment);
  } catch {
    return { version, entityType, schoolSegment: "", sequence: -1, valid: false };
  }

  const checksumOk = expectedChecksum === providedChecksum;
  const versionOk = version === SCHEME_VERSION;

  return { version, entityType, schoolSegment, sequence, valid: checksumOk && versionOk };
}

export function isValidId(id: string): boolean {
  try {
    return parseAndValidateId(id).valid;
  } catch {
    return false;
  }
}

/**
 * For anything public-facing (e.g. a future certificate-verification
 * page). Never expose the raw sequential ID on a public lookup endpoint.
 */
export function generateVerificationToken(byteLength = 16): string {
  return randomBytes(byteLength).toString("hex");
}

// ---------------------------------------------------------------------------
// SequenceProvider implementation usable TODAY, with zero backend changes
// ---------------------------------------------------------------------------
//
// This counts existing records rather than using a real atomic counter —
// see the "KNOWN LIMITATION" note at the top of this file. Wire it up in
// server/index.ts like this:
//
//   import { CountBasedSequenceProvider, generateStudentId, generateTeacherId } from './idGenerator';
//
//   const sequenceProvider = new CountBasedSequenceProvider(async (schoolId, entityType) => {
//     if (entityType === 'STUDENT') {
//       const students = await dbStore.getStudents();
//       return students.filter(s => s.schoolId === schoolId).length;
//     } else {
//       const users = await dbStore.getUsers();
//       return users.filter(u => u.schoolId === schoolId && u.role === UserRole.TEACHER).length;
//     }
//   });
//
// Then, in POST /api/students, replace:
//   id: 'STD_' + Math.floor(10000 + Math.random() * 90000),
// with:
//   id: await generateStudentId(school, sequenceProvider),
// (where `school` is the School record looked up by schoolId — once
// `school.udiseCode` is populated after UDISE import, this line
// automatically starts producing UDISE-derived IDs, no other change needed.)
//
export class CountBasedSequenceProvider implements SequenceProvider {
  constructor(
    private countExisting: (schoolIdentifier: string, entityType: EntityType) => Promise<number>
  ) {}

  async nextSequence(schoolIdentifier: string, entityType: EntityType): Promise<number> {
    return this.countExisting(schoolIdentifier, entityType);
  }
}