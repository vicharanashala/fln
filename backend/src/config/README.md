# config

## Overview
Static curriculum and worksheet configuration plus environment loading for the backend. Holds the level-to-concept registry, NCF-FS competency mapping, paper-type shapes, the server-side skill/level map, and worksheet layout rules. This is the `src/config/` directory, distinct from `src/config.ts` (paths, Python bin, rate limiter).

## Interface
- `curriculumMap.ts`: `CURRICULUM_MAPPING` (level number to `LevelConceptConfig`), `getConceptForLevel`, `getLevelForConcept`, `isBalvatikaStage`, and the `LevelConceptConfig` type. The map has 109 entries (levels 1-109).
- `ncfCompetencies.ts`: `NCF_COMPETENCY_BY_CONCEPT`, `getCompetencyForConcept`, `NcfCompetencyCode` (C-8.1 to C-8.13, or `null` where unsourced). The map covers only S3.x-S6.x concepts; `getCompetencyForConcept` returns `undefined` for concepts not in the map (Stage 1/2 and Stage 7), and `null` for mapped but unsourced ones.
- `paperTypeConfig.ts`: `PAPER_TYPE_CONFIG`, `getPaperTypeConfig`, `spreadQuestionCount`, `PaperType` (`diagnostic | midline | endline | personalized`), `PaperTypeConfig` (`paperType`, `questionCount`, `approvedTemplatesOnly`).
- `skillLevelMap.ts`: read-only view of the 109-level, 24-skill, 183-subskill map (counts from the `skillLevelMap.json` snapshot; the header comment in `skillLevelMap.ts` still says 93/179). Also exports `LevelInfo` and `SkillInfo`: `listStages`, `resolveStage`, `LEVEL_COUNT`, `levelIdFor`, `getLevel`, `getSkill`, `getSkillsForLevel`, `isSkillMappedToLevel`, `getSubskillsForSkills`, `isSubskillUnderSkills`, `buildLevelMapPayload`.
- `worksheetLayoutRules.ts`: `MIN_FONT_SIZE_PT`, `MIN_ANSWER_BOX_HEIGHT_PT`, `QUESTIONS_PER_PAGE_MAX`, `OVERFLOW_POLICY`, `planQuestionPages`, `ANSWER_SPACE_RULES`, `answerSpaceFor`, `themeSupportsCircling`, `PAGE_BOTTOM_MARGIN_PT`, `QUESTION_GAP_PT`, `DEFAULT_ANSWER_TYPE`, `CIRCLE_PADDING_PT`, `AnswerSpaceStyle`, `AnswerSpaceRule`.
- `environment.ts`: `env` (port from `PORT_NEW`, `nodeEnv`, `mongodbUri`, JWT settings), loaded from `backend/.env`. Currently unused: nothing in `src` or `tests` imports it.

## Invariants
- Reordering levels only changes `levelNumber` assignments in `curriculumMap.ts`; concept IDs (S-codes) are meant to be immutable, but `QuestionService.updateLevelMapping` (`services/questionService.ts`) mutates `CURRICULUM_MAPPING[level].conceptId` in memory at runtime; `testConceptGenerator.ts` calls it. Treat that as a known limitation of the in-memory map, not a supported way to reorder levels.
- `skillLevelMap.ts` reads a snapshot, `src/data/skillLevelMap.json`, of the frontend `skillProgressionMap.ts`, because the two workspaces cannot import each other. The snapshot must be regenerated when the frontend map changes.
- Layout minimums (font size, answer box height) always win; only the page count flexes.
- Paper-type shapes fix question counts only (and an `approvedTemplatesOnly` flag); no level is fixed per paper type. All four types are placeholder values (10, 10, 10 and 8 questions), all with `approvedTemplatesOnly: true`.
- Known limitation: `environment.ts` defaults (`PORT_NEW` 5000, a local `mongodbUri`) are dead code and differ from the live server, which reads `PORT` (default 3000) in `index.ts` and JWT settings in `auth.ts`.

## Side Effects
- `environment.ts` calls `dotenv.config` on import. Other files are pure; `skillLevelMap.ts` reads the JSON snapshot at load.

## Verification
- `npm test --workspace @fln/backend` does not run these files. Use the separate scripts: `test:balvatika-stage` (`curriculumMap.test.ts`), `test:paper-type-config`, `test:worksheet-layout-rules`, `test:ncf-competencies`.
- Colocated: `curriculumMap.test.ts`; also `tests/paper-type-config.test.ts`, `tests/worksheet-layout-rules.test.ts`, `tests/ncf-competencies.test.ts`.
