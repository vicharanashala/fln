# Backend Modules

## Overview
Self-contained, layered feature modules mounted into the FLN Express backend by `backend/src/index.ts`. Today there is one module, the Aadhaar tokenization vault.

## Subdirectories & Boundaries
- Vault: [./vault/README.md](./vault/README.md) - in-process Aadhaar tokenization vault. Envelope-encrypted storage in MongoDB, TOTP step-up approval for detokenize, and audit rows written to the shared FLN `logbook` collection. Exposes `registerVaultRoutes(app)`. Also exports `getActiveVaultTransactionCount` and `waitForVaultTransactionsDrain` for graceful shutdown. Routes are not all under `/api`: `GET /health` and the `/v1/*` router are mounted at the app root. If Mongo is not connected (local file-store fallback) or key setup fails, no vault context is built, the routes stay mounted with a null context, and `/health` answers `degraded`.
