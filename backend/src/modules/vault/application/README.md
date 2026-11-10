# application

## Overview
Use-case layer of the vault: command factories, port interfaces, and small helpers. No Express or Mongo imports except `dbStore` (used for audit logging by commands) and the `LogEntry` type imported by `ports/transactional-vault-writer.ts`. Commands are not purely port-based: audit persistence is not behind a port. Every other command imports `dbStore` for audit writes, and `read-audit-history.ts` reads through `dbStore` directly (test seam `deps.dbStore`).

## Subdirectories & Boundaries
- commands: [./commands/README.md](./commands/README.md) - seven command factories (tokenize, detokenize, step-up request/approve, MFA enroll/verify, audit read).
- ports: [./ports/README.md](./ports/README.md) - interfaces implemented by `infrastructure/`.
- util: [./util/README.md](./util/README.md) - `makeMfaSecretContext` (live) and `safeZero` (dead code: no file imports `application/util/dek-zero.ts`; commands import `../../util/dek-zero`, i.e. the vault-level `util/`).
