/**
 * server/idGenerator.ts
 * ---------------------------------------------------------------------------
 * Centralized ID generation for the FLN platform (v2 — person-based,
 * 60-bit / 15-character).
 *
 * IDs are permanent, opaque, randomly-generated identifiers for a PERSON
 * (teacher or student), independent of any school, state, district,
 * mentor, or affiliation. A student who changes school, moves across
 * districts, is home-schooled, or is mentored independently keeps the
 * exact same ID for life. How a person is CURRENTLY connected to the
 * system (school + teacher, or independent + mentor) is tracked
 * separately on the Student/User record itself (schoolId, teacherId,
 * mentorId, affiliationType) — never encoded into the ID.
 *
 * This explicitly EXCLUDES state/district/block/school from the ID, on
 * the same principle applied one level further: administrative
 * boundaries change (district splits/renames, school transfers) and
 * embedding them would either go stale or leak a child's location from a
 * bare ID string. That information lives on School/Affiliation, one
 * lookup away — never duplicated into the identity itself.
 *
 * ID format (15 characters total):
 *
 *   [version: 1] + [random payload: 12] + [type marker: 1] + [checksum: 1]
 *
 * WHY 60 BITS, GIVEN A ~10 CRORE (100,000,000) STUDENT TARGET
 * ---------------------------------------------------------------------------
 * Using the birthday-paradox approximation (expected collisions ≈
 * n² / (2 × 2^bits)) at n = 100,000,000:
 *   - 60 bits: ~0.0043 expected collisions — roughly a
 *     1-in-230 chance of a single collision ever occurring across all 10
 *     crore IDs.
 * 60 bits was chosen as the balance between that safety margin and total
 * ID length (15 chars vs. 19 for an 80-bit version) for a code that
 * teachers/children may need to hand-copy from printed material.
 *
 * ⚠️ UNIQUENESS ENFORCEMENT — NOT YET WIRED UP, MUST HAPPEN BEFORE PRODUCTION
 * ---------------------------------------------------------------------------
 * This module does NOT check a database for prior use — it has no
 * database dependency at all (generation is pure/synchronous). At 60
 * bits, real-world collisions are expected to be very rare but are NOT
 * impossible, so correctness still depends entirely on
 * the caller enforcing uniqueness at the database level.
 *
 * FOR NOW, per current project decision: db.ts is NOT being updated yet
 * to add a unique index on `id` or to handle duplicate-key errors on
 * insert. This module is being written and shipped on the ASSUMPTION
 * that uniqueness checking will be added on the database side before
 * this goes anywhere near production data. Concretely, before real
 * students/teachers are onboarded, db.ts needs:
 *
 *   1. A unique index on the `id` field for both the `students` and
 *      `users` collections (Mongo's own uniqueness only covers the
 *      separate internal `_id`, not this `id` field, as-is today).
 *   2. The insert call sites (addStudent / addUser) wrapped in a retry
 *      loop that regenerates the ID and retries on a duplicate-key error:
 *
 *        let student: Student | undefined;
 *        for (let attempt = 0; attempt < 5 && !student; attempt++) {
 *          const candidate = { ...rest, id: generateStudentId() };
 *          try {
 *            student = await dbStore.addStudent(candidate);
 *          } catch (err: any) {
 *            if (err?.code !== 11000) throw err; // 11000 = Mongo duplicate key
 *            // else: collision (rare at 60 bits) — loop and try a new id
 *          }
 *        }
 *        if (!student) throw new Error('Failed to generate a unique student ID after 5 attempts.');
 *
 *   3. The equivalent handling for the file-based fallback store, which
 *      has no index at all today and would need an explicit existence
 *      check before insert (a separate, already-flagged gap in db.ts,
 *      independent of this file).
 *
 * None of the above is implemented yet — this is a deliberate, agreed
 * scope decision for now, not an oversight. Do not treat IDs from this
 * module as guaranteed-unique until the above is done.
 *
 * OTHER DESIGN POINTS (unchanged from the previous version)
 * ---------------------------------------------------------------------------
 *   - Alphabet: Crockford's Base32 (excludes I, L, O, U) to reduce
 *     transcription errors when IDs are hand-copied off printed sheets.
 *   - Type marker (T/S): lets a raw ID string alone identify whether it's
 *     a teacher or student ID, without a database lookup.
 *   - Checksum: lets any ID be validated offline for transcription
 *     errors/corruption, with no database round-trip.
 *   - Scheme version: lets the ID format itself change later without
 *     invalidating IDs already printed on certificates.
 *   - `generateVerificationToken()`: kept SEPARATE from the permanent ID,
 *     for anything public-facing (e.g. a certificate verification page).
 *     The permanent ID is still used for authenticated internal lookups,
 *     so it should never be the thing exposed on an unauthenticated
 *     public endpoint.
 *   - Guardian reference: deliberately NOT modeled as a formal id/entity
 *     here — per current project decision, independent students continue
 *     to use lightweight plain-string guardian fields (name/relation/
 *     contact), matching what already exists on Student in db.ts. To be
 *     revisited later if guardians need to become a first-class entity.
 * ---------------------------------------------------------------------------
 */

import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Alphabet
// ---------------------------------------------------------------------------
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32, 32 symbols
const ALPHABET_INDEX: Record<string, number> = Object.fromEntries(
  [...ALPHABET].map((c, i) => [c, i])
);

const SCHEME_VERSION = "A";
const RANDOM_SEGMENT_LENGTH = 12; // 12 chars x 5 bits = 60 bits of randomness

export type EntityType = "TEACHER" | "STUDENT";

const TYPE_MARKER: Record<EntityType, string> = {
  TEACHER: "T",
  STUDENT: "S",
};

const MARKER_TO_TYPE: Record<string, EntityType> = {
  T: "TEACHER",
  S: "STUDENT",
};

export class IdGenerationError extends Error {}

// ---------------------------------------------------------------------------
// Base32 helpers — operate directly on random bytes/bits, not through a
// single JS number, so this works cleanly for any character length
// without worrying about Number precision limits.
// ---------------------------------------------------------------------------

/** Generates `numChars` Crockford Base32 characters of cryptographically secure randomness. */
function randomBase32(numChars: number): string {
  const numBits = numChars * 5;
  const numBytes = Math.ceil(numBits / 8);
  const bytes = randomBytes(numBytes);

  let bits = "";
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, "0");
  }

  let out = "";
  for (let i = 0; i < numChars; i++) {
    const chunk = bits.slice(i * 5, i * 5 + 5).padEnd(5, "0");
    out += ALPHABET[parseInt(chunk, 2)];
  }
  return out;
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
// Public API — generation
// ---------------------------------------------------------------------------

/**
 * Generates a new candidate Teacher ID (15 characters).
 *
 * ⚠️ Not guaranteed globally unique by itself — see the module-level
 * "UNIQUENESS ENFORCEMENT" note. Once db.ts enforces a unique index,
 * call this again to get a fresh candidate on a duplicate-key retry.
 */
export function generateTeacherId(): string {
  return generateId("TEACHER");
}

/**
 * Generates a new candidate Student ID (15 characters).
 * Same caveat as generateTeacherId() 
 */
export function generateStudentId(): string {
  return generateId("STUDENT");
}

function generateId(entityType: EntityType): string {
  const randomSegment = randomBase32(RANDOM_SEGMENT_LENGTH);
  const body = SCHEME_VERSION + randomSegment + TYPE_MARKER[entityType];
  const checksum = computeChecksum(body);
  return body + checksum;
}

// ---------------------------------------------------------------------------
// Public API — offline validation
// ---------------------------------------------------------------------------

export interface ParsedId {
  version: string;
  entityType: EntityType | null;
  valid: boolean;
}

/**
 * Validates a Teacher or Student ID WITHOUT a database lookup — checks
 * structural well-formedness and the checksum. This confirms the ID
 * wasn't mistyped/miscopied and tells you whether it's a teacher or
 * student ID. It CANNOT tell you whether the ID actually exists/was ever
 * issued — that still requires a database lookup.
 */
export function parseAndValidateId(id: string): ParsedId {
  const empty: ParsedId = { version: "", entityType: null, valid: false };

  const expectedLength = 1 + RANDOM_SEGMENT_LENGTH + 1 + 1;
  if (!id || id.length !== expectedLength) return empty;

  const version = id[0];
  const body = id.slice(0, -1);
  const providedChecksum = id[id.length - 1];

  let expectedChecksum: string;
  try {
    expectedChecksum = computeChecksum(body);
  } catch {
    return { ...empty, version };
  }

  const marker = id[1 + RANDOM_SEGMENT_LENGTH];
  const entityType = MARKER_TO_TYPE[marker] ?? null;
  if (!entityType) return { ...empty, version };

  const checksumOk = expectedChecksum === providedChecksum;
  const versionOk = version === SCHEME_VERSION;

  return { version, entityType, valid: checksumOk && versionOk };
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
 * page). Deliberately unrelated to the permanent ID — never expose the
 * permanent Teacher/Student ID on a public, unauthenticated endpoint,
 * since there's nothing else gating access to a record once you have
 * its ID.
 */
export function generateVerificationToken(byteLength = 16): string {
  return randomBytes(byteLength).toString("hex");
}