# Aadhaar Vault Microservice

The Aadhaar Vault is an isolated Fastify + PostgreSQL service for tokenizing and protecting FLN student identity numbers. It keeps raw Aadhaar or birth-certificate values out of the main FLN backend by storing encrypted identity records and returning opaque vault tokens to the rest of the platform.

This service lives entirely under `microservices/aadhaar-vault/` and is intentionally separate from the existing `backend/`, `frontend/`, and `Database/` folders.

## Current Status

Implemented in this service:

- Fastify HTTP API with public health probes.
- PostgreSQL-backed vault repositories and migrate-on-boot SQL migrations.
- Aadhaar and birth-certificate tokenization.
- Detokenization command and route wiring.
- Append-only audit history reads.
- TOTP MFA enrollment and verification.
- HS256 bearer JWT verification with route-level scope checks.
- Local development key manager and Node crypto service.
- In-process test database (`MemoryPool`) for fast unit and route tests.
- Static browser console under `console/`.

Deferred or limited:

- `KEY_PROVIDER=local-dev` is development-only and is blocked in production unless explicitly overridden.
- Only `SERVICE_JWT_ALGORITHM=HS256` is currently wired. RS256/JWKS support is not implemented yet.
- No OpenAPI document is generated yet.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 20+, TypeScript, ESM |
| Web framework | Fastify 4 |
| Validation | Zod |
| Database | PostgreSQL 16 via `pg` |
| Crypto | Node `crypto` service plus key-manager port |
| Auth | HS256 JWT verifier using `jose` |
| MFA | TOTP using `otpauth` |
| Logging | Pino with PII redaction |
| Tests | Vitest |
| Container | Dockerfile and docker-compose Postgres service |

## Directory Layout

```text
microservices/aadhaar-vault/
+-- console/                  # Static browser console for local/manual use
+-- src/
|   +-- application/          # Commands and ports
|   +-- auth/                 # JWT verifier factory and Fastify auth plugin
|   +-- db/                   # Pool, migrations, repositories, MemoryPool
|   +-- infrastructure/       # Crypto, events, key provider, MFA, DB adapters
|   +-- routes/               # HTTP route modules
|   +-- config.ts             # Typed env loader and safety guards
|   +-- logger.ts             # Pino logger with redaction
|   +-- server.ts             # Fastify bootstrap
+-- tests/                    # Unit and route tests
+-- docker-compose.yml        # Local Postgres and optional API container
+-- Dockerfile
+-- package.json
+-- README.md
```

## Quick Start

```bash
cd microservices/aadhaar-vault

# 1. Start local PostgreSQL
docker compose up -d postgres

# 2. Install dependencies
npm install

# 3. Create local env
cp .env.example .env

# 4. Run tests
npm test

# 5. Start the development server
npm run dev
```

The API listens on `http://127.0.0.1:4101` by default.

The service applies SQL migrations automatically when it boots with `VAULT_DB_URI` set. Tests do not require Postgres; they use the in-process `MemoryPool`.

## Configuration

Runtime configuration is parsed by `src/config.ts` with Zod. Invalid or unsafe configuration fails boot instead of falling back silently.

Important variables:

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Runtime mode: `development`, `test`, or `production`. |
| `PORT` | No | `4101` | HTTP port. |
| `HOST` | No | `0.0.0.0` | HTTP bind host. |
| `LOG_LEVEL` | No | `info` | Pino log level. |
| `VAULT_DB_URI` | Yes outside test | `postgres://vault:vault@localhost:5432/aadhaar_vault` | PostgreSQL connection string. |
| `KEY_PROVIDER` | No | `local-dev` | Key-manager implementation selector. |
| `LOCAL_DEV_MASTER_KEY` | Dev only | Base64 value in `.env.example` | Local development wrapping key. Never use in production. |
| `KEY_VERSION` | No | `kv-1` | Active key version label for local-dev key manager. |
| `SERVICE_JWT_HMAC_SECRET` | Yes outside test | Generate a strong secret | Shared HS256 secret for verifying FLN backend bearer tokens. |
| `SERVICE_JWT_AUDIENCE` | Recommended | `fln-vault` | Required JWT audience. |
| `SERVICE_JWT_ISSUER` | Recommended | `https://fln-backend.example.invalid` | Required JWT issuer. |
| `SERVICE_JWT_ALGORITHM` | No | `HS256` | Auth algorithm selector. Only HS256 is supported today. |
| `SERVICE_JWT_CLOCK_TOLERANCE_SECONDS` | No | `30` | JWT clock skew tolerance. |
| `VAULT_ALLOW_UNSAFE_KEY_PROVIDER` | Production escape hatch | `false` | Allows `local-dev` in production only when explicitly set to `true`. |

Generate a local JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## HTTP API

All non-health routes require `Authorization: Bearer <jwt>`. The JWT `sub` is treated as the trusted actor identity for audit purposes when present.

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Basic service metadata. |
| `GET` | `/health/live` | Public | Liveness probe. Always returns 200 when the process is alive. |
| `GET` | `/health/ready` | Public | Readiness probe for Postgres and key provider. Returns 503 when not ready. |

### Vault Routes

| Method | Path | Required scope | Description |
| --- | --- | --- | --- |
| `POST` | `/v1/tokenize` | `vault:tokenize` | Encrypts a raw identity number and returns an opaque token plus metadata. |
| `POST` | `/v1/detokenize/request` | `vault:detokenize` | Mints a single-use, time-boxed step-up challenge bound to an actor and a TOTP factor. |
| `POST` | `/v1/mfa/verify` | `vault:mfa:verify` | Approves a step-up challenge by verifying a TOTP code; transitions the challenge to `APPROVED`. |
| `POST` | `/v1/detokenize` | `vault:detokenize` | Consumes an approved challenge atomically (CAS `APPROVED`→`CONSUMED`) and returns the plaintext exactly once. Replays return `409 CHALLENGE_CONSUMED`; expired challenges return `410 CHALLENGE_EXPIRED`; wrong-actor attempts return `403 CHALLENGE_FACTOR_MISMATCH`. |
| `GET` | `/v1/audit` | `vault:audit` | Reads audit history for an identity. |
| `POST` | `/v1/mfa/enroll` | `vault:mfa:enroll` | Enrolls a TOTP factor for an actor. |

### Tokenize Example

```bash
curl -X POST http://127.0.0.1:4101/v1/tokenize \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "raw": "123412341234",
    "type": "AADHAAR",
    "context": {
      "actorId": "teacher-1",
      "actorRole": "TEACHER",
      "reason": "Enrollment identity verification"
    }
  }'
```

Successful response:

```json
{
  "token": "av_...",
  "last4": "1234",
  "tokenType": "AADHAAR",
  "auditId": "1",
  "identityId": "...",
  "keyVersion": "kv-1"
}
```

### Detokenize Example

```bash
curl -X POST http://127.0.0.1:4101/v1/detokenize \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "token": "av_...",
    "context": {
      "actorId": "state-admin-1",
      "actorRole": "STATE_ADMIN",
      "reason": "Authorized support lookup"
    }
  }'
```

### Audit Example

```bash
curl "http://127.0.0.1:4101/v1/audit?identityId=<identity-id>&actorRole=STATE_ADMIN&reason=Authorized%20audit%20review&limit=50" \
  -H "authorization: Bearer $TOKEN"
```

### MFA Enrollment Example

```bash
curl -X POST http://127.0.0.1:4101/v1/mfa/enroll \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "actor": "teacher-1",
    "label": "Teacher phone",
    "context": {
      "actorId": "school-admin-1",
      "actorRole": "SCHOOL_ADMIN",
      "reason": "MFA enrollment for vault access"
    }
  }'
```

### MFA Verification Example

```bash
curl -X POST http://127.0.0.1:4101/v1/mfa/verify \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "factorId": "<factor-id>",
    "code": "123456",
    "context": {
      "actorRole": "TEACHER",
      "reason": "Step-up verification for vault access"
    }
  }'
```

## Database

Migrations live in `src/db/migrations/` and are applied in lexicographic order by `src/db/migrator.ts`.

Current tables include:

- `vault_schema_migrations`
- `vault_identities`
- `vault_tokens`
- `vault_audit_log`
- `vault_mfa_factors`
- `vault_key_metadata`

The production path uses real Postgres transactions for tokenization writes. The test path uses a purpose-built `MemoryPool` that implements the SQL shapes emitted by the repositories.

## Development Commands

```bash
npm run dev       # Start Fastify with tsx watch
npm run build     # Compile TypeScript to dist/
npm start         # Run compiled dist/server.js
npm run lint      # Type-check without emitting
npm test          # Run Vitest suite
npm run test:watch
```

## Security Notes

- Raw identity values should only appear at the API boundary and inside the crypto command flow.
- Pino logging is configured to redact Aadhaar-shaped 12-digit strings.
- Authenticated routes enforce explicit scopes through `req.requireScope(...)`.
- The verified JWT subject overrides client-supplied `context.actorId` where the route has a body-level actor fallback.
- Audit reads intentionally do not accept `actorId` as a query parameter; the actor comes from the JWT subject.
- `KEY_PROVIDER=local-dev` is not production-safe.
- `.env` is gitignored. Do not commit real secrets.

## Step-Up Authentication (detokenize requires MFA approval)

Since Session 7, plaintext Aadhaar numbers cannot be returned by a single
JWT-scope call. Every detokenize must follow a three-step workflow:

1. **`POST /v1/detokenize/request`** — mints a single-use challenge bound to
   an actor and a TOTP factor; the challenge expires in seconds.
2. **`POST /v1/mfa/verify`** — verifies the TOTP code against the challenge,
   transitions it `PENDING` → `APPROVED`.
3. **`POST /v1/detokenize`** — atomically consumes the approved challenge
   (CAS `APPROVED` → `CONSUMED`) and returns the plaintext exactly once.

Replay is impossible: the same `challengeId` returns `409 CHALLENGE_CONSUMED`.
Expired challenges return `410 CHALLENGE_EXPIRED`. A different actor's JWT
returns `403 CHALLENGE_FACTOR_MISMATCH` and never sees plaintext.

For the full threat model, state machine, and sequence diagram see
[`STEP_UP_AUTH.md`](./STEP_UP_AUTH.md). For a curl walkthrough see
[`RUN.md` §9a](./RUN.md#9a-step-up-detokenization-walkthrough).

## References

- `AADHAAR_VAULT.md`
- `AADHAAR_VAULT_FREE_ARCHITECTURE.md`
- `STEP_UP_AUTH.md` — feature spec / threat model for Step-Up Auth
- `RUN.md`
- `REPO_STATUS.md`
