/**
 * Seed competency requirements into the legacy DBStore.
 *
 * The original Mongoose-based version referenced a database module that the
 * legacy backend no longer has. This stub preserves the same public surface
 * (`seedCompetencyRequirements()`) so future call-sites can invoke it after
 * wiring is finalised; for now, the seed JSON is loaded synchronously by
 * `dbStore.init()` via `getSeedCompetencyRequirements()`.
 */
import { dbStore, CompetencyRequirement } from '../db';

export async function seedCompetencyRequirements(): Promise<void> {
  // The legacy backend already loads these via getSeedCompetencyRequirements()
  // during DBStore.init(). This no-op keeps the function importable.
  const existing = await dbStore.getCompetencyRequirements();
  if (existing.length === 0) {
    console.warn('[seedCompetencyRequirements] no requirements found in DBStore; seed JSON may be missing.');
  } else {
    console.log(`[seedCompetencyRequirements] ${existing.length} requirements already present.`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('seedCompetencyRequirements.ts')) {
  seedCompetencyRequirements()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Competency seed failed:', err);
      process.exit(1);
    });
}