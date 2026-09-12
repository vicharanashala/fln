/**
 * server/src/idGenerator.ts
 * ---------------------------------------------------------------------------
 * Centralized permanent ID generation for people in the FLN platform.
 *
 * The application has multiple human roles stored in the User model:
 *
 *   - ADMIN          -> State Admin
 *   - DISTRICT_ADMIN -> District Admin
 *   - BLOCK_ADMIN    -> Block Admin
 *   - SCHOOL         -> Principal / School user
 *   - TEACHER        -> Teacher
 *   - VOLUNTEER      -> Volunteer
 *
 * Students are stored separately but are also people who require a permanent
 * FLN identity.
 *
 * SUPERADMIN is intentionally excluded from runtime ID generation because the
 * current system provisions the Superadmin as a system-level account.
 *
 * ---------------------------------------------------------------------------
 * ID FORMAT
 * ---------------------------------------------------------------------------
 *
 * Every generated person ID has exactly 15 characters:
 *   Version (1)
 *   + Random identifier (12 Crockford Base32 characters = 60 bits)
 *   + Entity marker (1)
 *   + Checksum (1)
 *
 * Structure:
 *
 *   A 7K3M9Q2R8T5W4 X Z
 *   │ └───────────┘ │ │
 *   │    60 bits   │ └─ checksum
 *   │              └─── role marker
 *   └────────────────── scheme version
 *
 * The 60-bit random portion provides: 2^60 possible values
 *
 * This makes accidental collisions extremely unlikely at the scale expected
 * by the FLN platform.
 *
 * IMPORTANT:
 * Random generation by itself is NOT a mathematical uniqueness guarantee.
 * The database must enforce uniqueness on the `id` field. If a duplicate-key
 * error is ever returned, the caller should generate another ID and retry.
 *
 * ---------------------------------------------------------------------------
 * CROCKFORD BASE32
 * ---------------------------------------------------------------------------
 *
 * The alphabet deliberately excludes: I, L, O, U
 * to reduce visual/transcription ambiguity when IDs are printed or manually
 * entered.
 * 
 * Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ
 *
 * ---------------------------------------------------------------------------
 * VALIDATION
 * ---------------------------------------------------------------------------
 *
 * The checksum allows an ID to be structurally validated without querying the
 * database.
 * Validation can confirm:
 *   - correct length,
 *   - supported version,
 *   - supported entity marker,
 *   - valid Base32 characters,
 *   - correct checksum.
 *
 * Validation does NOT prove that the ID exists in the database.
 * Database lookup is still required to determine whether an ID belongs to a
 * registered person.
 *
 * ---------------------------------------------------------------------------
 */

import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Crockford Base32
// ---------------------------------------------------------------------------

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const ALPHABET_INDEX: Record<string, number> = Object.fromEntries(
  [...ALPHABET].map((character, index) => [character, index])
);

// ---------------------------------------------------------------------------
// ID format configuration
// ---------------------------------------------------------------------------

const SCHEME_VERSION = "A";

const RANDOM_SEGMENT_LENGTH = 12;

const ID_LENGTH =
  1 + RANDOM_SEGMENT_LENGTH + 1 + 1;

// ---------------------------------------------------------------------------
// Supported entity types
// ---------------------------------------------------------------------------

export type EntityType =
  | "TEACHER"
  | "STUDENT"
  | "ADMIN"
  | "DISTRICT_ADMIN"
  | "BLOCK_ADMIN"
  | "PRINCIPAL"
  | "VOLUNTEER";

// ---------------------------------------------------------------------------
// Entity markers
// ---------------------------------------------------------------------------

const TYPE_MARKER: Record<EntityType, string> = {
  TEACHER: "T",
  STUDENT: "S",
  ADMIN: "A",
  DISTRICT_ADMIN: "D",
  BLOCK_ADMIN: "B",
  PRINCIPAL: "P",
  VOLUNTEER: "V",
};

const MARKER_TO_TYPE: Record<string, EntityType> = {
  T: "TEACHER",
  S: "STUDENT",
  A: "ADMIN",
  D: "DISTRICT_ADMIN",
  B: "BLOCK_ADMIN",
  P: "PRINCIPAL",
  V: "VOLUNTEER",
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedId {
  version: string;
  entityType: EntityType | null;
  randomSegment: string;
  valid: boolean;
}

export class IdGenerationError extends Error {}

// ---------------------------------------------------------------------------
// Base32 helpers
// ---------------------------------------------------------------------------

function encodeBase32(buffer: Buffer): string {
  let value = BigInt("0x" + buffer.toString("hex"));
  let result = "";

  while (value > 0n) {
    const remainder = Number(value % 32n);
    result = ALPHABET[remainder] + result;
    value = value / 32n;
  }

  return result.padStart(RANDOM_SEGMENT_LENGTH, "0");
}

// ---------------------------------------------------------------------------
// Random 60-bit identifier
// ---------------------------------------------------------------------------

function generateRandomSegment(): string {
  /*
   * 60 bits require 7.5 bytes.
   *
   * Generate 8 bytes and mask off the upper 4 bits, leaving exactly
   * 60 random bits.
   */
  const bytes = randomBytes(8);

  bytes[0] &= 0x0f;

  return encodeBase32(bytes);
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

function computeChecksum(body: string): string {
  let sum = 0;

  for (let i = 0; i < body.length; i++) {
    const value = ALPHABET_INDEX[body[i]];

    if (value === undefined) {
      throw new IdGenerationError(
        `Invalid character '${body[i]}' while computing checksum.`
      );
    }

    sum += value * (i + 1);
  }

  return ALPHABET[sum % 32];
}

// ---------------------------------------------------------------------------
// Generic ID generation
// ---------------------------------------------------------------------------

export function generateId(entityType: EntityType): string {
  const marker = TYPE_MARKER[entityType];

  if (!marker) {
    throw new IdGenerationError(
      `Unsupported entity type: ${entityType}`
    );
  }

  const randomSegment = generateRandomSegment();

  const body =
    SCHEME_VERSION +
    randomSegment +
    marker;

  const checksum = computeChecksum(body);

  const id = body + checksum;

  if (id.length !== ID_LENGTH) {
    throw new IdGenerationError(
      `Generated ID has invalid length: ${id.length}. Expected ${ID_LENGTH}.`
    );
  }

  return id;
}

// ---------------------------------------------------------------------------
// Role-specific generation functions
// ---------------------------------------------------------------------------

export function generateTeacherId(): string {
  return generateId("TEACHER");
}

export function generateStudentId(): string {
  return generateId("STUDENT");
}

export function generateAdminId(): string {
  return generateId("ADMIN");
}

export function generateDistrictAdminId(): string {
  return generateId("DISTRICT_ADMIN");
}

export function generateBlockAdminId(): string {
  return generateId("BLOCK_ADMIN");
}

export function generatePrincipalId(): string {
  return generateId("PRINCIPAL");
}

export function generateVolunteerId(): string {
  return generateId("VOLUNTEER");
}

// ---------------------------------------------------------------------------
// ID parsing and validation
// ---------------------------------------------------------------------------

export function parseAndValidateId(id: string): ParsedId {
  const empty: ParsedId = {
    version: "",
    entityType: null,
    randomSegment: "",
    valid: false,
  };

  if (!id || id.length !== ID_LENGTH) {
    return empty;
  }

  const version = id[0];

  const randomSegment = id.slice(
    1,
    1 + RANDOM_SEGMENT_LENGTH
  );

  const marker = id[
    1 + RANDOM_SEGMENT_LENGTH
  ];

  const providedChecksum = id[id.length - 1];

  // Validate Base32 characters in the random segment.
  for (const character of randomSegment) {
    if (ALPHABET_INDEX[character] === undefined) {
      return {
        version,
        entityType: null,
        randomSegment,
        valid: false,
      };
    }
  }

  const entityType =
    MARKER_TO_TYPE[marker] ?? null;

  if (!entityType) {
    return {
      version,
      entityType: null,
      randomSegment,
      valid: false,
    };
  }

  const body = id.slice(0, -1);

  let expectedChecksum: string;

  try {
    expectedChecksum = computeChecksum(body);
  } catch {
    return {
      version,
      entityType,
      randomSegment,
      valid: false,
    };
  }

  const versionValid =
    version === SCHEME_VERSION;

  const checksumValid =
    expectedChecksum === providedChecksum;

  return {
    version,
    entityType,
    randomSegment,
    valid:
      versionValid &&
      checksumValid,
  };
}

// ---------------------------------------------------------------------------
// Simple validation helper
// ---------------------------------------------------------------------------

export function isValidId(id: string): boolean {
  try {
    return parseAndValidateId(id).valid;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

export function getEntityTypeFromId(
  id: string
): EntityType | null {
  return parseAndValidateId(id).entityType;
}