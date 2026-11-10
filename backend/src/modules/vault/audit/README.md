# audit

## Overview
Encodes vault audit events as rows of the shared FLN `logbook` collection (`LogEntry`) and decodes them back. There is no separate audit store.

## Interface
- `vaultLogbookEntry(input: VaultAuditInput, caller: VaultAuditCallerMeta, id, now?) -> LogEntry`. `status` = `Success` for outcome `allow`, otherwise `Failed`. Missing school/user fall back to `'system'`. `userEmail` = `input.actor`. Role map: TEACHER->TEACHER, SCHOOL_ADMIN->SCHOOL, STATE_ADMIN->ADMIN, SUPER_ADMIN->SUPERADMIN.
- `details` string format: `vault: <activityType> identity=<id|null> reason="..." requestId="..." outcome=<allow|deny|error> token=<id> challenge=<id> factor=<id> meta=<JSON>`.
- `parseVaultLogbookEntry(log) -> VaultAuditRecord | null` (null unless `details` starts with `vault:` and parses with a valid outcome).
- `mintVaultLogId(now?, rand?) -> "vaultlog_<base36 ms>_<7-char base36>"` (uses `Math.random`).
- Types: `VaultAuditInput`, `VaultAuditCallerMeta`, `VaultAuditRecord`, `VaultLogbookEntry`.
- Action -> activityType: TOKENIZE, DETOKENIZE, STEP_UP_REQUEST, STEP_UP_APPROVE, MFA_ENROLL, MFA_VERIFY, MFA_ENROLLMENT_INITIATED|VERIFIED|FAILED|REVOKED (lowercased, snake_case). Unknown actions fall back to `'tokenize'`. The vault commands emit only `MFA_ENROLLMENT_VERIFIED` and `MFA_ENROLLMENT_FAILED` (verify-mfa); `INITIATED` and `REVOKED` are written by `src/routes/mfaEnrollment.ts`.
- Row `id`: the caller chooses it. Tokenize passes the request's `requestId` (or a random UUID when absent); the other commands pass `mintVaultLogId(now)`.

## Invariants
- `stripAadhaarFromMeta` drops top-level meta keys `aadhaar`, `aadhaar_number`, `raw` and any top-level string value that is exactly 12 digits, before serialisation.
- `reason` and `requestId` are quote- and backslash-escaped on write, but parsing does not fully round-trip. An empty `reason`/`requestId` is read back as `null`, not `""`.
- Only `last4`, never the full number, is meant to appear in tokenize meta. This is enforced by the tokenize command's convention, not by this module.
- Known limitation: the parser reads `meta=` up to the first whitespace, so meta JSON containing whitespace inside string values (e.g. a label with a space) fails `JSON.parse` and comes back as `meta: null`.

## Side Effects
- Pure functions; none. Persistence is done by callers (`dbStore.addLog`, or `writeLog` inside the tokenize transaction).

## Verification
- Run: `tsx --test src/modules/vault/tests/audit-in-logbook.test.ts` via `npm test --workspace @fln/backend`
