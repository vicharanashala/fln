# scripts

## Overview
Operator scripts that are run by hand, not imported by the app.

## Interface
- `demo-cert.ts`: demo seed for SRS R-7 certification. Picks five seeded Class 4 students (`CLASS_NUMBER = 4`, `LEVEL = 5`, students A-E), injects hand-crafted `EvaluationReport`s with specific `conceptMastery` values, runs the eligibility engine, and prints each resulting certification. The seven topic names (`CLASS4_L5_TOPICS`) are hard-coded in the script to mirror the competency seed JSON; it does not read that file. Run with `npx tsx backend/src/scripts/demo-cert.ts`. Pass `--reset` to first wipe the five students' reports and certifications.

## Invariants
- Requires `npm run seed --workspace @fln/backend` first, so students already exist in Mongo.
- Calls `runCertificationEligibilityForStudent` from `services/certificationRecords.ts`, the production path that wraps the eligibility engine (`services/certificationEligibility.ts`), so it does not reimplement the rules. That path also writes certification records and triggers the logbook entry and email attempt for review-needed students.

## Side Effects
- Reads `.env` via dotenv, connects to MongoDB, and writes evaluation reports and certification records for the chosen students. With `--reset` it first runs a raw `deleteMany` on the `evaluationReports` and `certifications` collections for those five students through `dbStore.mongoDb`. Do not run against production data.

## Verification
- Run: `npm test --workspace @fln/backend` (no dedicated test; run the script and read its printed verdicts)
