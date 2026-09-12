import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CompetencyRequirement, MasteryLevel } from '../db';

/**
 * Read-only competency-requirements registry for the certification engine.
 * Loads backend/src/data/competencyRequirements.seed.json — the same seed
 * data DBStore.init() uses (see getSeedCompetencyRequirements in db.ts) and
 * what backend/src/utils/seedCompetencyRequirements.ts reports on.
 *
 * Lookups are O(1) on the (classNumber, level) bucket, then a linear scan of topics
 * within the bucket. With ~16 seed records this is fine; if the curriculum grows
 * past a few hundred entries, swap for an indexed Map.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_FILE = path.resolve(__dirname, '../data/competencyRequirements.seed.json');

let cache: CompetencyRequirement[] | null = null;

function load(): CompetencyRequirement[] {
  if (cache) return cache;
  const raw = fs.readFileSync(SEED_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as CompetencyRequirement[];
  cache = parsed;
  return cache;
}

export function getAllCompetencyRequirements(): CompetencyRequirement[] {
  return load();
}

export function getRequirementsForClassLevel(classNumber: number, level: number): CompetencyRequirement[] {
  return load().filter((r) => r.classNumber === classNumber && r.level === level);
}

export function getMandatoryRequirementTopics(classNumber: number, level: number): string[] {
  return getRequirementsForClassLevel(classNumber, level)
    .filter((r) => r.isMandatory)
    .map((r) => r.topic);
}

export type { CompetencyRequirement, MasteryLevel };