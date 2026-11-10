# pages

## Overview
Route-level pages that are not part of the authenticated dashboard shell.

## Interface
- `CoordinatorRegistration.tsx`: default export `CoordinatorRegistration`, mounted at `/register-coordinator` in `../App.tsx`. A State, District, Block, School cascade form (react-hook-form) that creates a teacher account through `../hooks/useCoordinator`.

## Invariants
- Reachable without login; all data goes through `../services/coordinatorService`.

## Side Effects
- Network calls (list locations, create teacher) via `apiFetch`.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
