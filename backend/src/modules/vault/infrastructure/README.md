# infrastructure

## Overview
Adapters implementing the application ports.

## Subdirectories & Boundaries
- auth: [./auth/README.md](./auth/README.md) - HS256 service-JWT verifier (not yet wired).
- crypto: [./crypto/README.md](./crypto/README.md) - AES-256-GCM envelope encryption.
- db: [./db/README.md](./db/README.md) - Mongo repositories, transactional writer, in-flight transaction counter.
- events: [./events/README.md](./events/README.md) - logging-only event publisher.
- key-providers: [./key-providers/README.md](./key-providers/README.md) - key manager factory and local-dev provider.
- mfa: [./mfa/README.md](./mfa/README.md) - TOTP generation and verification.
