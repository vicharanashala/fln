# FLN Skill Progression (93 Levels → SK01–SK24)

> **Status:** v0.2 — full 93-level mapping shipped Sep 2026.
> Source of truth: `FLN_93_Level_Skill_Graph_Specification.md` (this folder).
> Earlier work (27 pre-school levels only) has been subsumed by the spec but the
> dashboard wiring and the failure-diagnosis UI philosophy are preserved.

## Layered model (Spec §0)

```
93 FLN Levels
   ↓
24 Core Skills (SK01-SK24)
   ↓
~150 Granular Subskills (SK01.01 ... SK24.07)
   ↓
Question types
   ↓
Student evidence
   ↓
Skill mastery / gap estimate
   ↓
Next-level / diagnostic questions / intervention
```

## Dashboard wiring (where to find it)

- `frontend/src/data/skillProgressionMap.ts` — the canonical instance data:
  `CORE_SKILLS` (24) + `LEVEL_SKILL_MAP` (93), with primary/supporting skills per
  level, prerequisite edges, evidence tags, stage derivation.
- `frontend/src/components/SkillGraphPanel.tsx` — modal panel opened from the
  Teacher dashboard's **"🧠 Skill Progression (93 levels)"** button. Three views:
  - **Level × Skill matrix** — 93 × 24 grid (filterable by stage). Cells show
    `P` (primary), `S` (supporting), `x` (touched but not assigned), `·` (none).
    Click a level row to open its detail; click a column header to filter the graph.
  - **Skill Graph** — Mermaid source filtered to one skill's primary + supporting
    levels. Paste into mermaid.live for visual rendering. Edges use 4 relationship
    types (`supports` / `often_precedes` / `related_to` / `required_for_procedure`)
    per Spec §10.
  - **Level Detail** — primary skills, supporting skills, all subskills touched,
    question-type suggestions, evidence tags, prerequisite edges.

## Why primary vs supporting matters (Spec §10)

Each level/question distinguishes:

- **Primary skill** — the capability the level is *designed to assess*.
- **Supporting skill** — needed to perform the task but not the learning target.

In the matrix and graph, this is why some cells are bolder (primary, green-200)
and others lighter (supporting, green-50). Diagnosis shouldn't infer that the
child is weak at *supporting* skills just because they fail a level — it should
specifically check those.

## Mapping strategy used

1. Pulled **level titles + capability labels** verbatim from the spec §4 table.
2. Mapped each level to `primarySkills` and `supportingSkills` per spec §4.
3. Added **prerequisite edges** conservatively — only when one level's success is
   required for the procedure of the next. Otherwise `often_precedes` or
   `supports`.
4. Subskills enumerated per Spec §3 (~150 total across SK01-SK24).
5. Stage (`Pre-school 1` ... `Class 4`) derived from levelNumber so the data
   matches `RoleDashboards.tsx`'s `FLN_LEVELS_LIST` band cuts.

## Failure diagnosis (Spec §6, §7)

A child failing L46 (2-Digit Addition w/ Regrouping) is **not** simply "weak at
addition". The spec shows the diagnosis should:

1. Look at all primary + supporting skills for L46:
   `SK13 (Addition), SK11 (Place Value), SK12 (Composition/Decomposition)`.
2. Pull prior evidence at adjacent levels (L45, L32, L33).
3. Generate diagnostic Qs along the prereq path:
   `Q1: 7+5 → Q2: 18+7 → Q3: tens/ones in 27 → Q4: make 10 ones = 1 ten → Q5: 27+18`.
4. Target the gap, not the symptom.

This is the eventual implementation; the panel today only shows the static graph.

## What this is **not** yet

- **Not** wired to the real backend. Frontend still runs on mock interceptor per `CLAUDE.md`. No write-path cutover.
- **Not** an adaptive assessment engine. Mastery estimation, gap diagnosis, next-assessment-recommendation — Spec §6/§7 are design only.
- **Not** a question generator. The mapping is the input; `conceptQuestionGenerator.ts` is still on level keys.

## See also

- [FLN_93_Level_Skill_Graph_Specification.md](./FLN_93_Level_Skill_Graph_Specification.md) — the parent spec (read first).
- [FLN_Math_Skill_Progression_Framework.md](./FLN_Math_Skill_Progression_Framework.md) — the earlier 27-level framework doc this 93-level spec extended.
- [docs/93-levels-and-question-types.md](../93-levels-and-question-types.md) — current 93-level registry with oral-only flags.
- `frontend/src/components/SkillGraphPanel.tsx` — panel UI.
- `frontend/src/data/skillProgressionMap.ts` — data layer.
