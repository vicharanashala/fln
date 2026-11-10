# hooks

## Overview
React hooks: TanStack Query wrappers for the coordinator-registration flow and persisted roster filters for the teacher/school student lists.

## Interface
- `useCoordinator.ts`: `useStates`, `useDistricts(stateId)`, `useBlocks(districtId)`, `useSchools(blockId)`, `useCreateTeacher` (wrap `../services/coordinatorService`).
- `useRosterFilters.ts`: `useRosterFilters(userId, role)`, `rosterFiltersKey`, `ROSTER_FILTERS_DEFAULT`, `ROSTER_FILTERS_KEY_PREFIX`, `savedRosterAppliesToSchool`, `resolveRestoredClassTab`, types `RosterFilterState`, `RosterScopeRow`.

## Invariants
- Cascading location queries are keyed by their parent id (`['districts', stateId]`); the lists use a 5 minute stale time.
- Roster filters are stored per user and role (`fln_roster_filter` key prefix) and a saved filter is restored only if it still applies to the current school/class scope.

## Side Effects
- Network calls via `apiFetch`; `useRosterFilters` reads and writes `localStorage`.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
