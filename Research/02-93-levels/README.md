# The 93-level curriculum (previous version)

The second curriculum had **93 levels**. This folder holds the work that built it from research and the tables that connect its numbering to the other versions. The current curriculum is **109 levels**: see [../03-109-levels/](../03-109-levels/README.md).

Many documents here talk about "S-notation" (`S1.1` to `S7.18`). That is the research name for a level. The current data still uses S-codes, so they remain valid.

## framework-build/: how the levels were derived

These four form a chain. Read in this order only if you need the full history.

| File | What it is |
|---|---|
| [fln_framework_from_scratch.md](./framework-build/fln_framework_from_scratch.md) | The numeracy framework built from research: 85 concepts across 7 stages |
| [fln_level_networks.md](./framework-build/fln_level_networks.md) | The same concepts as prerequisite chains by strand. Code in `backend/src/competencyPrerequisites.ts` cites this as its source of truth |
| [fln_proposed_levels.md](./framework-build/fln_proposed_levels.md) | One level per concept, using S-notation |
| [fln_framework_evolution_log.md](./framework-build/fln_framework_evolution_log.md) | Running log of what was confirmed, revised, retracted or left open |

## crosswalks/: mapping between numbering systems

| File | What it maps |
|---|---|
| [fln_L_to_S_crosswalk.md](./crosswalks/fln_L_to_S_crosswalk.md), [.json](./crosswalks/fln_L_to_S_crosswalk.json), [per-level CSV](./crosswalks/fln_L_vs_S_per_level.csv) | `L` numbers (code) to `S` codes (research). The `.json` is read by `npm run check:level-notation-drift`, so do not rename it without updating that script |
| [fln_59_to_93_crosswalk.PROPOSED.md](./crosswalks/fln_59_to_93_crosswalk.PROPOSED.md), [.json](./crosswalks/fln_59_to_93_crosswalk.PROPOSED.json) | Old 59 levels to the 93. **A machine-made draft, not reviewed.** Do not treat it as correct |

## Related

- The 93-level skill specification lives in [`docs/skill-graph/`](../../docs/skill-graph/README.md) because the app code points to it.
