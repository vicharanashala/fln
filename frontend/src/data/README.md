# data

## Overview
Static curriculum data bundled into the frontend: the skill-to-level progression map and a generated curriculum summary.

## Interface
- `skillProgressionMap.ts`: `CORE_SKILLS` (SK01-SK24 with subskills), `LEVEL_SKILL_MAP` (109 levels), `MAX_FLN_LEVEL`, `STAGES`, `STAGE_LABELS`, `stageLabel`, `DOMAIN_TINT`, `STAGE_TINT`, `getLevelBySCode`, `getSkillsForLevel`, `getLevelsForSkill`, `getCoverageMatrix`, `getPrerequisiteEdges`, `getSubSkillsForLevel`, types `SkillDomain`, `RelationshipType`, `Subskill`, `CoreSkill`, `LevelSkillMapping`, `Prerequisite`.
- `curriculumSummary.json`: generated totals (`totalConcepts`, `totalStages`, `totalStrands`, `ageMin`, `ageMax`, per-stage counts), plus `maxCellCount` and a strand-by-stage `matrix` (consumed by `LandingView.tsx`). The generator also exports a `MATRIX_BANDS` constant that nothing uses. Written by the frontend `prebuild` script (`../scripts/build-curriculum-summary.ts`); do not hand-edit.

## Invariants
- `skillProgressionMap.ts` was produced by a one-off validation script (see the file header); no generator for it exists in `scripts/`. It is validated at import time (below); it mirrors the backend `curriculumMap.ts` registry, so edit both together.
- `MAX_FLN_LEVEL` equals `LEVEL_SKILL_MAP.length`. The import-time `sanity()` check hard-codes 109 levels, 24 skills and 109 unique `sCode` values, so changing the level count requires editing it.

## Side Effects
- `skillProgressionMap.ts` runs an import-time `sanity()` check (`:915-938`) that throws on an unknown skill or prerequisite id or when the level, skill or `sCode` counts differ from 109 / 24 / 109. Otherwise pure data and lookup functions.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
