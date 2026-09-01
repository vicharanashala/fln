// Generates the backend-readable snapshot of the level -> skill -> subskill mapping.
//
// Why this exists: the canonical mapping lives in
// `frontend/src/data/skillProgressionMap.ts`, but `frontend` and `backend` are
// separate npm workspaces with separate tsconfigs and a bundled backend build —
// the server cannot import that module at runtime. The Question Intervention
// feature needs *server-side* validation of "is this skill actually mapped to
// this level" (the client dropdowns are UX, not a guard), so the backend needs
// its own copy of the data.
//
// A committed JSON snapshot plus a drift check is the same shape as
// `scripts/check-level-notation-drift.ts` already uses for the L/S crosswalk:
// one source of truth, a derived artifact, and CI that fails when they diverge.
//
// Usage:
//   npx tsx scripts/generate-skill-level-map.ts           # regenerate the snapshot
//   npx tsx scripts/generate-skill-level-map.ts --check    # drift check (CI); exit 1 on mismatch

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OUTPUT_PATH = path.join(ROOT, 'backend', 'src', 'data', 'skillLevelMap.json');

export interface SkillLevelMapSnapshot {
  /** Regeneration provenance — not used at runtime, but makes a stale file obvious. */
  generatedFrom: string;
  levelCount: number;
  /** "L30" -> { levelNumber, capability, stage, skills: ["SK05","SK06"] } */
  levels: Record<string, {
    levelNumber: number;
    capability: string;
    stage: string;
    sCode: string;
    skills: string[];
  }>;
  /** "SK05" -> { name, domain, subskills: [{ id, name }] } */
  skills: Record<string, {
    name: string;
    domain: string;
    subskills: Array<{ id: string; name: string }>;
  }>;
}

async function build(): Promise<SkillLevelMapSnapshot> {
  const skillMapPath = path.join(ROOT, 'frontend', 'src', 'data', 'skillProgressionMap.ts');
  if (!fs.existsSync(skillMapPath)) {
    console.error(`Source map not found at ${skillMapPath}`);
    process.exit(1);
  }

  const mod = await import(skillMapPath);
  const LEVEL_SKILL_MAP = mod.LEVEL_SKILL_MAP as Array<{
    levelId: string;
    levelNumber: number;
    sCode: string;
    capability: string;
    stage: string;
    primarySkills: string[];
    supportingSkills: string[];
  }>;
  const CORE_SKILLS = mod.CORE_SKILLS as Array<{
    id: string;
    name: string;
    domain: string;
    subskills: Array<{ id: string; name: string; observable: boolean }>;
  }>;

  const levels: SkillLevelMapSnapshot['levels'] = {};
  for (const l of LEVEL_SKILL_MAP) {
    // A logic may legitimately target either a primary or a supporting skill of
    // the level, so the validation set is the union. Deduped and sorted so the
    // generated file is stable across runs (otherwise the drift check flaps).
    const skills = Array.from(new Set([...l.primarySkills, ...l.supportingSkills])).sort();
    levels[l.levelId] = {
      levelNumber: l.levelNumber,
      capability: l.capability,
      stage: l.stage,
      sCode: l.sCode,
      skills,
    };
  }

  const skills: SkillLevelMapSnapshot['skills'] = {};
  for (const s of CORE_SKILLS) {
    skills[s.id] = {
      name: s.name,
      domain: s.domain,
      subskills: s.subskills.map(ss => ({ id: ss.id, name: ss.name })),
    };
  }

  return {
    generatedFrom: 'frontend/src/data/skillProgressionMap.ts',
    levelCount: LEVEL_SKILL_MAP.length,
    levels,
    skills,
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const snapshot = await build();
  const serialized = JSON.stringify(snapshot, null, 2) + '\n';

  if (check) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(`DRIFT: ${path.relative(ROOT, OUTPUT_PATH)} does not exist.`);
      console.error('Run: npx tsx scripts/generate-skill-level-map.ts');
      process.exit(1);
    }
    const existing = fs.readFileSync(OUTPUT_PATH, 'utf8');
    if (existing !== serialized) {
      console.error(`DRIFT: ${path.relative(ROOT, OUTPUT_PATH)} is out of date with skillProgressionMap.ts.`);
      console.error('Run: npx tsx scripts/generate-skill-level-map.ts');
      process.exit(1);
    }
    console.log(`OK — skill/level snapshot matches source (${snapshot.levelCount} levels, ${Object.keys(snapshot.skills).length} skills).`);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, serialized);
  const subskillCount = Object.values(snapshot.skills).reduce((n, s) => n + s.subskills.length, 0);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`  ${snapshot.levelCount} levels, ${Object.keys(snapshot.skills).length} skills, ${subskillCount} subskills`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
