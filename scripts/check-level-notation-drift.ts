// Issue #280 ask #2: fails when the two level-numbering systems disagree.
//
// The project has two graphs of the same 93 levels:
//   - S-notation (S1.1-S7.18)  — Research/fln_level_networks.md, Research/fln_proposed_levels.md
//   - L-notation (L1-L93)      — frontend/src/data/skillProgressionMap.ts
//
// L(n) is defined as the n-th S-code in stage-then-index order (deterministic,
// no judgement involved) and is now computed directly in skillProgressionMap.ts
// (see LevelSkillMapping.sCode / sCodeFor()) rather than hand-maintained. This
// script is the automated version of the manual comparison that originally
// surfaced the drift documented in Research/fln_L_to_S_crosswalk.md — it
// checks that the *reference* crosswalk file (the machine-readable record of
// what the mapping is supposed to be) and the *code's* computed mapping still
// agree, so a future edit to either one can't silently drift from the other
// again.
//
// Usage: npx tsx scripts/check-level-notation-drift.ts
// Exit code 0 = no drift. Exit code 1 = drift found (prints every mismatch).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const crosswalkPath = path.join(ROOT, 'Research', 'fln_L_to_S_crosswalk.json');
  if (!fs.existsSync(crosswalkPath)) {
    console.error(`Reference crosswalk not found at ${crosswalkPath} — nothing to check against.`);
    process.exit(1);
  }
  const crosswalk: { L_to_S: Record<string, string> } = JSON.parse(fs.readFileSync(crosswalkPath, 'utf8'));
  const referenceMap = crosswalk.L_to_S;

  const skillMapPath = path.join(ROOT, 'frontend', 'src', 'data', 'skillProgressionMap.ts');
  const { LEVEL_SKILL_MAP } = await import(skillMapPath);

  const problems: string[] = [];

  // Levels present in one but not the other.
  const referenceIds = new Set(Object.keys(referenceMap));
  const codeIds = new Set<string>(LEVEL_SKILL_MAP.map((l: { levelId: string }) => l.levelId));
  for (const id of referenceIds) {
    if (!codeIds.has(id)) problems.push(`${id} is in the reference crosswalk but has no entry in LEVEL_SKILL_MAP.`);
  }
  for (const id of codeIds) {
    if (!referenceIds.has(id)) problems.push(`${id} is in LEVEL_SKILL_MAP but has no entry in the reference crosswalk.`);
  }

  // Same level, disagreeing sCode.
  for (const lvl of LEVEL_SKILL_MAP as Array<{ levelId: string; sCode: string }>) {
    const expected = referenceMap[lvl.levelId];
    if (expected && expected !== lvl.sCode) {
      problems.push(`${lvl.levelId}: code computes sCode "${lvl.sCode}" but the reference crosswalk says "${expected}".`);
    }
  }

  if (problems.length > 0) {
    console.error(`Level-notation drift found (${problems.length} problem(s)):\n`);
    for (const p of problems) console.error('  - ' + p);
    console.error(
      '\nEither the reference crosswalk (Research/fln_L_to_S_crosswalk.json) or the ' +
      'sCode computation in frontend/src/data/skillProgressionMap.ts has drifted from ' +
      'the other. Fix whichever one is wrong before merging.'
    );
    process.exit(1);
  }

  console.log(`OK — all ${LEVEL_SKILL_MAP.length} levels' sCode values match the reference crosswalk exactly.`);
}

main().catch(err => {
  console.error('check-level-notation-drift.ts failed to run:', err);
  process.exit(1);
});
