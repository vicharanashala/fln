# FLN v2

A clean rebuild of the FLN assessment platform (Balvatika to Class 3), developed on the `rebuild/v2` branch. `main` keeps running unchanged until v2 passes the parity checklist in `docs/PARITY.md`.

## Layout
- `packages/curriculum`: the single source of truth for the 109 levels, concepts and class ranges. No other file may hard-code a level number (`npm run check:levels`).
- `packages/domain`: pure, tested logic: answer matching, error classification, paper lock, scan quality, result bands (Emerging 0-1, Developing 2-3, Secure 4-5 on five questions per concept) and observation codes.
- `apps/`: the API and the web app (added next).
- `Research/`, `data/`, `assets/`: curriculum research, the question bank and fonts, carried over unchanged from `main`.

## Rules
- One data store (MongoDB); no JSON-file fallback.
- No lint suppressions file; every error is fixed.
- Code moved from `main` keeps its tests unchanged, so a passing test is proof of parity.

## Check everything
```bash
npm install
npm run check   # types, lint, tests, level-number check
```
