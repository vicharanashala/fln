# ui

## Overview
Presentational loading and empty-state primitives shared by dashboards and rosters.

## Interface
- `DashboardSkeleton.tsx`: `DashboardSkeleton`.
- `EmptyStateCard.tsx`: `EmptyStateCard`.
- `RosterSkeleton.tsx`: `RosterSkeleton`.

## Invariants
- Stateless; no data fetching.

## Side Effects
- None.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
