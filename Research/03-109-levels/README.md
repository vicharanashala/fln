# The 109 levels (current)

If you ask "where is the list of levels and subskills?", this folder is the answer.

## What the 109 levels are

The curriculum is **109 levels**, numbered 1 to 109, running from Preschool 1 to Class 4. Each level is one checkpoint: "can the child do this one thing?" Each level touches a few **skills** (24 in total, `SK01` to `SK24`), and each skill is made of **subskills** (183 in total, for example `SK13.01`).

```
109 Levels  ->  24 Skills  ->  183 Subskills  ->  Questions  ->  Student evidence
```

| Stage (name in code) | Shown as | Levels | Count |
|---|---|---|---|
| Pre-school 1 | Preschool 1 | 1-8 | 8 |
| Pre-school 2 | Preschool 2 | 9-18 | 10 |
| Pre-school 3 | **Balvatika** (the year before Class 1) | 19-46 | 28 |
| Class 1 | Class 1 | 47-60 | 14 |
| Class 2 | Class 2 | 61-77 | 17 |
| Class 3 | Class 3 | 78-91 | 14 |
| Class 4 | Class 4 | 92-109 | 18 |

Current build scope is Balvatika to Class 3. Class 4 is in the data but is not part of the MVP; see the main [README](../../README.md).

## Files in this folder

| File | Open it when you want to... |
|---|---|
| [all-levels.md](./all-levels.md) | see every level in order: number, concept ID, what it is about, which skills it touches |
| [skills-and-subskills.md](./skills-and-subskills.md) | see every skill and subskill, and which levels use each skill |
| [levels-and-subskills.csv](./levels-and-subskills.csv) | open it in Excel or Sheets, filter it, or share it with a reviewer (one row per level and subskill, 2,125 rows) |
| [fln_year_before_class1.md](./fln_year_before_class1.md) | understand the Balvatika decisions (17 Sep 2026) |
| [micro-skill-graph/](./micro-skill-graph/) | explore the interactive micro-skill graph and read the review that changed it |

The first three are **generated**. Do not edit them by hand. The one source of truth is
[`backend/src/data/skillLevelMap.json`](../../backend/src/data/skillLevelMap.json). To change a level or subskill, edit that JSON, then run:

```
node scripts/export-levels-docs.js
```

## The names, so they stop being confusing

| Term | Example | Meaning |
|---|---|---|
| Level number | `L46`, or `46` | Position 1-109. A display label. It is baked into stored question IDs, so do not renumber it casually |
| Concept ID (S-code) | `S1.1` ... `S7.18` | The research name for the same level. `L1` is `S1.1` |
| Skill | `SK13` Addition | A mathematical capability. Many levels share a skill |
| Subskill | `SK13.01` | A smaller piece of a skill |
| Legacy 59 / 93 | `legacyLevel59` | Older numberings, kept in [../01-original-59-levels/](../01-original-59-levels/README.md) and [../02-93-levels/](../02-93-levels/README.md) |

## Where the same data lives in code

- `backend/src/data/skillLevelMap.json`: the source for this folder.
- `backend/src/config/curriculumMap.ts`: the 109 keys the backend uses.
- `frontend/src/data/skillProgressionMap.ts`: what the Teacher dashboard's Skill Progression panel shows.
- `npm run check:level-notation-drift`: fails if these disagree.

## Read next

1. [docs/skill-graph/README.md](../../docs/skill-graph/README.md) and [PREREQUISITE_GROUP_ARCHITECTURE.md](../../docs/skill-graph/PREREQUISITE_GROUP_ARCHITECTURE.md) for how levels connect (AND/OR prerequisites).
2. [docs/curriculum-terminology-and-id-mapping.md](../../docs/curriculum-terminology-and-id-mapping.md) for the ID rules.
3. [../04-background-research/](../04-background-research/README.md) for the reasoning and sources.
