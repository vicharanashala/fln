# backend/scripts

## Overview

Operator-run, one-off maintenance scripts for the `@fln/backend` workspace. They are run by hand with `tsx`, are not imported by the server, and are not part of the build. Both live TypeScript scripts reuse the server's data layer (`connectDB`, `dbStore` from `../src/db`), so they work against MongoDB when `MONGODB_URI` is set.

## Interface

Scripts are CLI entry points with no exported symbols.

| File | Purpose | Invocation |
| --- | --- | --- |
| `audit-aadhaar-at-rest.ts` | Read-only audit of student documents for raw (untokenized) Aadhaar. Prints totals only: raw 12-digit `aadharMasked`, raw 12-digit run embedded in `aadharMasked`, missing `aadhaarIdentityId`, fully tokenized, and unexpected `aadhaar*`/`aadhar*` fields. | `npm run audit:aadhaar --workspace @fln/backend`, or `cd backend && npx tsx scripts/audit-aadhaar-at-rest.ts` |
| `renameUnnamedArchetypes.ts` | Re-names misconception archetypes (`MisconceptionCluster`) still carrying a placeholder name (for example "Unnamed pattern: ...") that were created while Gemini was unreachable. Dry run by default. | `npx tsx backend/scripts/renameUnnamedArchetypes.ts [--apply] [--deterministic]` |

`renameUnnamedArchetypes.ts` flags:

- (none): dry run; prints `NAME`/`SKIP` lines and writes nothing.
- `--apply`: writes the new names via `dbStore.updateMisconceptionCluster`.
- `--deterministic`: names from each archetype's stored centroid (`deterministicArchetypeProfile`), with no model call or API key. Combine with `--apply` to write.

It depends on `analyseCohort`, `nameArchetypes`, `deterministicArchetypeProfile` and `vectorFromCentroid` from `../src/misconceptionFingerprint`, and `isPlaceholderArchetypeName` from `../src/studentArchetypeService`. Without `--deterministic` the model path processes only the class groups `Class 2`, `Class 3` and `Class 4` (`:42,121`); `--deterministic` renames every stale archetype regardless of class group.

Zero-byte placeholder files, currently with no content or behavior: `listTeachers.cjs`, `loginAndMe.cjs`, `loginMeInspect.cjs`, `printUser.cjs`, `printUser.js`. Do not rely on them.

## Invariants

- `audit-aadhaar-at-rest.ts` never creates, modifies, or deletes documents. It never prints Aadhaar values, tokens, or identity ids, and never calls detokenization or any vault endpoint. Keep it that way: it reports counts only.
- Against MongoDB it projects only `aadharMasked`, `aadhaarTokenId`, `aadhaarIdentityId` from the `students` collection. Without MongoDB it audits the local file store (`data/db.json`).
- "Fully tokenized" means `aadharMasked` matches `XXXX-XXXX-dddd` and both `aadhaarTokenId` and `aadhaarIdentityId` are non-empty.
- `renameUnnamedArchetypes.ts` must call `connectDB()` before `dbStore.init()`; otherwise `init()` silently falls back to the file DB. It throws and refuses to run if `dbStore.useMongo` is false.
- Only archetypes with no `nameSetBy` and a placeholder name are touched; hand-named archetypes are never overwritten.
- In model mode, an archetype whose name came from the fallback (`namedByFallback` and not `incoherent`) is skipped, so one stand-in name is never swapped for another. It is safe to re-run.
- Archetypes are matched back to stored records by member student ids, not by `slug`.
- Exit code is 0 on success and 1 on failure for both scripts.

## Side Effects

- Both scripts load `.env` (`dotenv/config`; the rename script also loads `backend/.env`) and open the MongoDB connection when `MONGODB_URI` is set. Both end the process with `process.exit`.
- `audit-aadhaar-at-rest.ts`: reads only, prints a report to stdout.
- `renameUnnamedArchetypes.ts`: reads students, answer submissions, worksheets and clusters. Without `--apply` it writes nothing. With `--apply` it updates `name`, `description`, `teacherAction`, `forwardRisk` (or the deterministic profile fields) and `updatedAt` on stored clusters. In model mode it calls Gemini via `nameArchetypes`, consuming API quota.

## Verification

- Run: `npm test --workspace @fln/backend` from the repo root.
- This test script runs the Aadhaar hardening, detokenize, vault, panel-isolation, assessment-mode and vault-config tests under `backend/tests` and `backend/src/modules/vault/tests`. It does not execute anything in this directory.
- To smoke-test a script, run the read-only audit or the rename dry run (no flags) against a non-production data store.
