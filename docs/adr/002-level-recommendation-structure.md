# ADR 002 — Level Recommendation Structure: Per-Chain & Collapsed Coexistence

## Decision

The platform adopts a **dual coexistence model** for student level tracking and recommendations:

1. **Per-Strand / Per-Chain State (`strandLevels`):**
   - The platform tracks student progress independently across each curriculum strand chain (e.g., Number Sense, Addition/Subtraction, Multiplication/Division, Shapes & Spatial, Measurement, Patterns, Money, Time, Data).
   - `Student` records and evaluation engine outputs store optional per-strand level mappings (`strandLevels?: Record<string, number>`).
   - Diagnostic assessments, targeted practice recommendations, and level-personalized worksheet generation consume strand-specific level positions.

2. **Derived Collapsed Level (`currentLevel`):**
   - The single scalar `currentLevel: number | null` field is retained on the `Student` model.
   - `currentLevel` is derived as the baseline / minimum across active strand levels (or primary Number Sense milestone).
   - High-level dashboards, district/state aggregate reporting, and class-level placement bands (`classLevelRange`) consume this collapsed scalar to avoid cognitive overload for teachers while preserving granular diagnostic precision under the hood.

## Context

The FLN curriculum graph consists of 10 strand chains with distinct prerequisite progressions (documented in `Research/fln_level_networks.md`).

Historically, the `Student` schema in `backend/src/db.ts` provided only a single collapsed scalar:
```ts
currentLevel: number | null;
currentSubLevel?: number | null;
targetLevel: number | null;
```

`Research/fln_level_networks.md` Part 3 flagged an architectural decision on whether level recommendations should be per-chain (e.g. a child can be Stage 4 in Number Sense while Stage 3 in Patterns) or a single collapsed integer.

Forcing a single scalar level discards strand-specific progress, whereas forcing teachers to manage 10 separate numbers creates unnecessary UI complexity.

The dual coexistence model satisfies both needs: precise diagnostic targeting per strand in the background, and a clean, single-number summary for teacher dashboards.

## Consequences

- **Schema Update:** The `Student` interface in `backend/src/db.ts` is updated to include `strandLevels?: Record<string, number>`.
- **Evaluation Engine:** Evaluation engine services output both `strandLevels` and derived `currentLevel`.
- **Backward Compatibility:** All existing reporting aggregations (`avgLevel`, `currentLevelMin` filters, class level ranges) remain valid and operable without breaking changes.
