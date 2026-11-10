# @fln/frontend Blueprint

## System Overview
React 19 + Vite 6 + Tailwind 4 single-page app for the FLN assessment platform (npm workspace `@fln/frontend`). Role-based dashboards (superadmin, state/district/block admin, principal, teacher, volunteer) call the Express backend under `/api`; the Vite dev server proxies `/api`, `/output` and `/worksheets` to `VITE_API_TARGET` (default `http://localhost:3000`), so in dev the worksheet pages come through the backend (which mounts Vite's middleware), not from Vite's own `public/` serving. The `.env.example` file also documents `VITE_ENABLE_DEMO_LOGINS` (build flag that mounts the demo login panel). Set `VITE_BASE_PATH` for a subpath deployment.

## Local Interface & Invariants
- `index.html`, `.env.example`, `vite.config.ts` (alias `@` to the frontend root), `tsconfig.json`, `package.json` scripts: `dev`, `build` (prebuild regenerates `src/data/curriculumSummary.json`), `preview`, `test` (vitest run), `lint` (`tsc --noEmit`).
- Do not edit the HMR/watch settings in `vite.config.ts` (marked as AI Studio settings).

## Subdirectories & System Boundaries
- src: [./src/README.md](./src/README.md) - application code (entry, components, services, hooks, data, i18n, utils).
- public: [./public/README.md](./public/README.md) - static assets and standalone worksheet generators.

## Global Invariants
- Backend traffic goes through `src/services/apiClient.ts`; the auth token is `localStorage.fln_token`. One exception: `src/components/panels/DiagnosticTestPanel.tsx:130` calls raw `fetch` for the diagnostic PDF URL (no base-path prefix, no 401 handling).
- Curriculum data in `src/data` mirrors the backend curriculum registry. `src/constants.ts` (`FLN_LEVELS`, `FLN_STRANDS`) holds separate hand-maintained curriculum copies that are not derived from or checked against the registry; nothing in `src` uses them.

## Global Side Effects
- Network calls to the backend, `localStorage` writes, browser downloads, Google Fonts requests.

## System Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)

---

## Developer notes (original, preserved)

## Name
### @fln/frontend

## Synopsis


## Description

## Example

## Install
This package is `"private": true` and an npm workspace member, not a published package. Install from the repo root: `npm install`.

## Test
`npm test`

## License

