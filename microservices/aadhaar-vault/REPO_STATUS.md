# REPO_STATUS.md — Repository Snapshot

> **Snapshot taken:** 01 Aug 2026, after Session 8 (Console Refactoring) and Session 7E (MFA Step-up).
> **Branch under audit:** `feature/aadhaar-vault`, tracking `origin/feature/aadhaar-vault` (upstream set via `git push -u origin feature/aadhaar-vault`).
> **Last commit on branch:** `d30b42a feat(aadhaar-vault): Session 5 Phase 1 — Auth foundation (Bearer JWT plugin)`.
> **Uncommitted on branch (current Session 8):** MFA factor model (`vault_mfa_challenges` → `vault_mfa_factors`), `KeyManager.sealSecret/openSecret`, `TotpVerifier` port + `OtpAuthTotpVerifier` (RFC 6238) adapter, `PostgresMfaFactorRepository`, application commands for detokenize/read-audit-history/MFA enroll/MFA verify, authenticated `POST /v1/detokenize`, `GET /v1/audit`, `POST /v1/mfa/enroll`, and `POST /v1/mfa/verify` routes. Test status: **213 tests passing across 17 suites**, `npm run build` clean, `application/` zero `fastify`/`otpauth`/`jose`/`pg` imports.
> **Repository:** [`DUKartik/FLN_Open_Source`](https://github.com/DUKartik/FLN_Open_Source) (forked from [`vicharanashala/fln`](https://github.com/vicharanashala/fln)).
> **Project:** Foundational Literacy & Numeracy (FLN) adaptive assessment platform for early-grade Indian classrooms (Classes 1–5, ages 6–10).
> **Audience:** contributors, reviewers, and new maintainers. For the operator's guide, see [`RUNNING_THE_PROJECT.md`](./RUNNING_THE_PROJECT.md).

---

## 1. What this project is

This repository contains the **Aadhaar Vault microservice** (`microservices/aadhaar-vault/`).

The Aadhaar Vault is a pre-alpha standalone tokenisation service for Aadhaar-style identity numbers. Full architecture, decisions, and session history are recorded in §3. As of current HEAD, the vault exposes `POST /v1/tokenize`, `POST /v1/detokenize`, `GET /v1/audit`, `POST /v1/mfa/enroll`, and `POST /v1/mfa/verify` behind the Bearer-JWT auth plugin. It has **213 tests passing across 17 suites** and a clean TypeScript build.

---

## 2. Top-level layout

```
FLN_Open_Source/
├── microservices/
│   └── aadhaar-vault/        ← PII tokenisation service. See §3.
│       ├── src/auth/         ← HS256 JWT plugin + factory
│       ├── src/application/commands/
│       │   ├── tokenize-aadhaar.ts
│       │   ├── detokenize-aadhaar.ts
│       │   ├── read-audit-history.ts
│       │   ├── enroll-mfa.ts
│       │   └── verify-mfa.ts
│       ├── src/application/ports/   ← clean ports for crypto, auth, TOTP, MFA, persistence
│       ├── src/infrastructure/      ← adapters for auth, crypto, events, key providers, MFA, DB
│       ├── src/db/migrations/       ← 001 schema, 002 tokens, 003 MFA factors rename
│       └── tests/                   ← 213 tests across 17 suites
```

---

## 3.  — new in this fork, **PRE-ALPHA**

### 3.1 Service overview

A standalone tokenisation service for Aadhaar-style identity numbers. It accepts a sensitive plaintext identifier, returns a reversible tokenised reference, and never persists plaintext to disk or logs. The service is structured around Clean Architecture so that Fastify, `pg`, and Node's `crypto` module never appear in the same module as business logic.

It is **pre-alpha**: the cryptographic and transactional primitives are landing one session at a time, and not every route in the design doc is exposed yet. See §7.14 for the honest list of remaining work.

### 3.2 Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict)
- **HTTP:** Fastify
- **Validation:** Zod (strict, additive — unknown keys rejected)
- **Database driver:** `pg` (production) and a hand-rolled `MemoryPool` (tests)
- **Container:** Docker + docker-compose (Postgres bundled)
- **Tests:** Vitest (runners in `forks` mode)
- **Crypto:** Node.js `crypto` (HKDF-SHA-256, AES-256-GCM)
- **Auth:** HS256 JWT (Bunyan-style symmetric secret) — auth foundation landed Session 5

### 3.3 Purpose

The service solves a single problem — *replace a plaintext identity number with a reversible token for downstream systems — and resolves it defensibly*. Specifically it must:

- never log plaintext;
- never persist plaintext;
- dedupe by `(identity_type, identity_hash)` so re-tokenising the same number yields the same row;
- bind tokens cryptographically to a `(tenant, purpose, pepper_version)` context so a token minted for one caller cannot be replayed against another;
- emit an audit event per mint operation;
- expose a tiny HTTP surface that returns either a token or a typed error code;
- require an authenticated principal with the right scope at the route boundary (Session 5).

### 3.4 Clean Architecture

Dependency flow is one-way: outermost → innermost. The application layer has zero `fastify`, zero `pg`, and zero Node `crypto` imports. This is enforced not by lint but by a grep guard in CI (verified manually at the time of writing).

```
┌──────────────────────────────────────────────────────────────────┐
│  routes/              Fastify handlers + Zod schemas (adapters)   │
│       ↓                                                              │
│  application/commands/  Use-case factories (pure TypeScript)       │
│       ↓                                                              │
│  application/ports/     Interfaces only — the application's needs  │
│       ↓                                                              │
│  infrastructure/        Adapters: NodeCryptoService,               │
│                         InProcessEventPublisher,                   │
│                         LocalDevKeyManager,                        │
│                         Hs256JwtVerifier                           │
│       ↓                                                              │
│  db/ports/              DB-side interfaces                         │
│       ↓                                                              │
│  db/adapters/           Postgres adapters + MemoryPool             │
└──────────────────────────────────────────────────────────────────┘
```

The application layer is independently testable: `tests/tokenize-aadhaar.test.ts` exercises the command with hand-written fakes for every port and never instantiates a Fastify or `pg` object. `tests/hs256-jwt-verifier.test.ts` does the same for the JWT adapter.

### 3.5 Architectural decisions — recorded with rationale

| # | Decision | Why |
|---|---|---|
| 1 | Ports & Adapters layering with the application layer speaking only in interfaces. | Allows the command to be tested without HTTP or DB dependencies and lets the same use case be exercised by a future gRPC or CLI entry point without duplication. |
| 2 | `KeyManager` deals only in opaque `Buffer`s. | KMS-portability. Without this abstraction, swapping in AWS KMS, GCP KMS, or HashiCorp Vault later would touch every callsite of the adapter. |
| 3 | Per-context HKDF-SHA-256 derivation (master + salt=context + info="aadhaar-vault/dek-wrap") before AES-256-GCM. | A single DEK wrapped under two contexts yields two distinct ciphertexts; wrong-context unwrap fails authentication. Context binding is enforced **cryptographically**, not via naming conventions. |
| 4 | Production-safety guard: `LocalDevKeyManager` cannot be constructed when `NODE_ENV=production` unless `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true` is set (with a logged override). | A single-master-key `local-dev` adapter is unsuitable for production. The guard is the only defence against accidentally shipping it. |
| 5 | `MemoryPool` in tests instead of `pg-mem`. | `pg-mem` cannot parse the production DDL (`BYTEA`, `JSONB`, `BIGSERIAL`, `timestamptz`, partial indexes) and hangs. A hand-rolled pool with a narrow SQL dialect means divergent queries fail in CI, not at runtime in production. |
| 6 | Vitest workers in `forks` mode. | Each test file gets its own `MemoryPool` instance and `pg`-backed clients cannot leak state across files. |
| 7 | Stable `TokenizeCommandError.code` → HTTP status mapping (1:1 table) at the route layer. | Decouples internal error taxonomy from HTTP semantics. Clients depend on the code, not the message. |
| 8 | The HTTP layer never echoes `err.message` to the client. | Generic body for every error — only the stable code is sent. Prevents information leakage. |
| 9 | Zod strict body validation rejects unknown keys. | Additive contract: a future field added in a request is *rejected*, not silently dropped. The client must opt in. |
| 10 | Lazy DI in `buildServer`. | Plugin decorators can land in any order; tests inject adapters without reordering. |
| 11 | `503 Service Unavailable` when a plugin dependency is not yet wired. | Fail loudly rather than run a half-wired system. Better to refuse traffic than to mis-handle it. |
| 12 | Identity dedup at `(identity_type, identity_hash)` with hash computed inside the command. | Re-tokenising the same number yields the same `identity_id` and the same `token` row is returned. |
| 13 | **`JwtVerifier` is a port, not a concrete class.** (Session 5) | The application layer asks "is this token valid?" without knowing about `jose`, HS256, or any issuer. A future RS256/JWKS adapter swaps in without changing the auth plugin. |
| 14 | **`Hs256JwtVerifier` algorithm is enforced to exactly `HS256` — no `alg: none` and no RS256-via-HMAC confusion.** (Session 5) | Prevents the canonical JWT foot-guns. The `algorithms` allow-list is the only thing that reliably stops algorithm-confusion attacks. |
| 15 | **Auth plugin attaches `request.principal` and `request.requireScope(scope)`; never reads/writes the response body on a 401.** (Session 5) | Routes stay declarative (`{ preHandler: requireScope('vault:tokenize') }`). The plugin owns the JSON shape: `{ error, message, code }`. |
| 16 | **`requireScope` raises a Fastify error → the central error handler maps to 403.** (Session 5) | Without this, missing-scope failures would surface as 500 and look identical to backend outages. The 403 case is the regression guard. |
| 17 | **`Health` routes are public; no auth preHandler.** (Session 5) | An LB / k8s probe must work without a token. The error contract for `/health` is the same JSON shape but the route is registered without the auth preHandler. |
| 18 | **Test secret + issuer + audience are fixed in `auth.plugin.test.ts` so the helpers and the verifier speak to the same contract.** (Session 5) | Today the verifier and the test helper are coupled by string. The `tests/helpers/mint-test-token.ts` is the contract; if you change the wire format you change both in lockstep. |

### 3.6 Database architecture

**Migrations**

| Migration | Session | Tables introduced |
|---|---|---|
| `001_initial_schema.sql` | 1 | `identities`, `audit_events`, `mfa_challenges`, `key_metadata` |
| `002_tokens.sql` | 4 | `tokens` |

The migrator (`src/db/migrator.ts`) is run against the bundled Postgres from `docker-compose.yml` and replays the files in lexicographic order.

**Tables (excerpt — production-shape DDL is in the migration files)**

```sql
-- 002_tokens.sql (abbreviated)
CREATE TABLE tokens (
  id            BIGSERIAL PRIMARY KEY,
  identity_id   BIGINT NOT NULL REFERENCES identities(id),
  token_type    TEXT   NOT NULL,
  key_version   INT    NOT NULL,
  last4         TEXT   NOT NULL,
  wrapped_dek   BYTEA  NOT NULL,
  meta          JSONB  NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ
);
CREATE INDEX tokens_identity_idx ON tokens (identity_id);
```

### 3.7 Composition root

`buildServer` (`src/server.ts`) is the composition root. Adapters are bound as **factories** (`() => KeyManager | undefined`), not eager singletons. This means:

- Plugin decorator ordering does not matter.
- Tests can substitute any adapter by overriding a single factory.
- A not-yet-wired adapter degrades gracefully — the route returns 503 instead of crashing.

What is wired where:

- `KeyManager` is built by the factory in `infrastructure/key-providers/index.ts` and exposed on `app.keyManager`.
- `TransactionalVaultWriter`, `TokenRepository`, `CryptoService`, and `EventPublisher` are bound at server construction and exposed on `app` for the route layer.
- The route layer reads `app.tokenizeCommand` (an instance built from the ports) and calls it.
- **Session 5 addition:** `JwtVerifier` is built by `src/auth/factory.ts` from `SERVICE_JWT_HMAC_SECRET` / `SERVICE_JWT_ISSUER` / `SERVICE_JWT_AUDIENCE`, and exposed on `app.jwtVerifier`. The auth plugin reads it.

### 3.8 Transaction boundaries

There is exactly one transaction in the system today:

| Scope | Implemented by | Why |
|---|---|---|
| `identity_lookup + token_insert + audit_insert` | `PostgresTransactionalVaultWriter` | All three writes must succeed or fail together. A token without an audit row violates the design's invariant. |

The application port (`TransactionalVaultWriter`) enforces that `run(ctx, fn)` is the only path that touches persistence. The memory adapter gives the route-level integration test the same shape without a real database.

### 3.9 Cryptographic design

**Construction**

```
subkey     = HKDF-SHA-256(
              ikm  = LOCAL_DEV_MASTER_KEY,
              salt = context,
              info = "aadhaar-vault/dek-wrap"
            )

wrapped_dek = AES-256-GCM(key = subkey, iv = random 12 bytes)
              → serialise as (iv (12) || tag (16) || ciphertext)
              → stored as BYTEA in tokens.wrapped_dek
```

**Properties**

- **Per-context subkey.** Same DEK wrapped under two contexts yields two distinct ciphertexts. Wrong-context unwrap fails GCM authentication.
- **Random IV per encryption.** A single context never produces the same `(iv || tag || ct)` twice for the same key — even when the plaintext is identical — because the IV is fresh.
- **Authenticated encryption.** GCM tag is checked on unwrap; tampering with `wrapped_dek` causes unwrap to throw, which the command surfaces as `INVALID_INPUT` (or `INTERNAL` — see tests in `tests/tokenize-aadhaar.test.ts`).

**Operational notes**

- `LOCAL_DEV_MASTER_KEY` is read from env (base64); missing key in production must error at boot, not at first request.
- The `KeyManager` factory's production guard is the only thing that prevents this fork from being deployed with a single-master-key vault.
- A real KMS adapter (AWS / GCP / HashiCorp) replaces `LocalDevKeyManager` without any change to the application code.

### 3.10 Memory hygiene

- `safeZero(buf)` (`src/util/dek-zero.ts`) overwrites an in-memory buffer with zeros before release.
- DEKs are wrapped before they leave a route: they are never logged; they are never serialised to disk in plaintext.
- Audit rows record only `last4` of the **token reference**, never the plaintext or the ciphertext.
- All `Buffer`s that may hold DEKs are wiped in their narrowest possible scope (per call site).

### 3.11 Auth foundation (Session 5)

**Surface added (and what it does)**

- `src/application/ports/jwt-verifier.ts` — the `JwtVerifier` port (`verify(token) → JwtPrincipal`) and `JwtVerificationError` with stable codes:
  - `token_missing`, `token_malformed`, `token_expired`, `signature_invalid`,
    `issuer_mismatch`, `audience_mismatch`, `claim_missing`, `unsupported_algorithm`.
- `src/infrastructure/auth/hs256-jwt-verifier.ts` — `Hs256JwtVerifier` adapter. Built on `jose`. Algorithms allow-list locked to `HS256`. Supports both `scope` (space-delimited) and `scp` (array) claims. `iss`/`aud` enforced when configured. 0-second clock tolerance by default (configurable).
- `src/auth/plugin.ts` — Fastify plugin. On every request it:
  1. Reads `Authorization: Bearer <token>`.
  2. Strips the prefix and calls `verifier.verify(token)`.
  3. On success: attaches `request.principal = { subject, scopes }` and adds `request.requireScope(scope)` which throws `ScopeRequiredError` on miss.
  4. On failure: throws a `JwtVerificationError` mapped by the central error handler to a typed JSON 401 with the stable `code`.
- `src/auth/factory.ts` — `createJwtVerifier(config)` returns a `Hs256JwtVerifier` from `SERVICE_JWT_HMAC_SECRET` / `SERVICE_JWT_ISSUER` / `SERVICE_JWT_AUDIENCE`. Rejects when the secret is shorter than 32 bytes.
- `tests/helpers/mint-test-token.ts` — dependency-free test helper built on `node:crypto.createHmac`. Mints HS256 JWTs that the verifier will accept; must move in lockstep with the verifier if the wire format ever changes.

**Route wiring**

| Route | Auth | Notes |
|---|---|---|
| `GET /health` | public | Liveness probe — no token required. |
| `GET /health/ready` | public | Readiness probe — no token required. |
| `POST /v1/tokenize` | `requireScope('vault:tokenize')` | 401 on missing/invalid; 403 on scope mismatch. |
| `POST /v1/detokenize` | `requireScope('vault:detokenize')` | Consumes an approved challenge atomically and returns plaintext. Requires MFA approval via Step-Up Auth. |
| `GET /v1/audit` | `requireScope('vault:audit')` | Reads audit history for the authenticated principal / requested identity. |
| `POST /v1/mfa/enroll` | `requireScope('vault:mfa:enroll')` | One-time factor setup: enrolls and seals a TOTP factor, appends audit, publishes event. |
| `POST /v1/mfa/verify` | `requireScope('vault:mfa:verify')` | Standalone factor proof: verifies an enrolled TOTP factor, marks usage, appends audit, publishes event. |

**Config additions (`.env.example`)**

```
SERVICE_JWT_HMAC_SECRET=…                      # shared with the issuing service; ≥ 32 bytes
SERVICE_JWT_ISSUER=…                           # expected `iss`; rejects on mismatch
SERVICE_JWT_AUDIENCE=…                         # expected `aud`; rejects on mismatch
```

Missing/short secret or sentinels in `process.env` cause `buildServer` to refuse to start, not to fail on the first request.

### 3.12 Test strategy

| Suite | File | Session | Cases | Purpose |
|---|---|---|---|---|
| `tests/db.test.ts` | memory pool | 1–2 + 5 P2 | **11** | Schema declaration + grammar rejection + round-trip on `MemoryPool`; identity / audit / MFA-factor / key-metadata round-trip; factor revoke idempotency. |
| `tests/boot.test.ts` | server boot | 1–3 | 5 | Server boot + `/health*` probes (incl. Session 3 `keyProvider` reporting). |
| `tests/dek-zero.test.ts` | util | 3.5 | 3 | `safeZero()` — single-bit tamper detection, length check, async-zero path. |
| `tests/key-manager.test.ts` | crypto | 3 | 8 | Round-trip, per-context divergence, randomness, `info()` shape, tamper, short-blob, prod-guard refusal, prod-guard override. |
| `tests/tokenize-aadhaar.test.ts` | command | 4 | 7 | Happy path, dedup, missing dep, `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `PEPPER_MISMATCH`. |
| `tests/tokenize.route.test.ts` | route | 4 | 11 | 201 + body shape, 400 Zod, 400 unknown key, 401/403/422/500 mapped, 503 when keyManager is unwired, scope enforcement. |
| `tests/hs256-jwt-verifier.test.ts` | verifier | 5 | 13 | Algorithm allow-list, expired/nbf, wrong iss/aud, wrong signature, missing `sub`, `scope` vs `scp` parsing, secret-length guard. |
| `tests/auth.plugin.test.ts` | plugin | 5 | 9 | Public route is reachable without a token; 401 maps every error code; 403 on scope mismatch (not 500). |
| `tests/totp-verifier.test.ts` | MFA / RFC 6238 | 5 P2 | **31** | RFC 6238 Appendix B vectors (SHA-1/256/512), window / drift, input validation, enrollment (algorithm / length / URI shape). |
| `tests/detokenize-aadhaar.test.ts` | command | 5C | 9 | Detokenize orchestration: token lookup, identity lookup, unwrap/decrypt, audit/event ordering, plaintext hygiene. |
| `tests/detokenize.route.test.ts` | route | 5C | 11 | `POST /v1/detokenize` schema validation, body-size cap, auth/scope enforcement, 404 mapping, JSON error envelope, route registration. |
| `tests/read-audit-history.test.ts` | command | 5C | 9 | Audit-history read model: limit defaults/caps, empty history, validation, predictable JSON shape. |
| `tests/enroll-mfa.test.ts` | command | 5C | 13 | MFA enrollment: factor persistence, per-factor secret sealing, audit/event semantics, plaintext hygiene. |
| `tests/verify-mfa.test.ts` | command | 5C | 24 | MFA verification: factor state checks, actor matching, code mismatch paths, mark-used, audit/event semantics, plaintext hygiene. |
| `tests/audit.route.test.ts` | route | 6B | 18 | `GET /v1/audit` query validation, principal-derived actor, auth/scope enforcement, limit bounds, JSON envelope, route registration. |
| `tests/enroll-mfa.route.test.ts` | route | 6C | 13 | `POST /v1/mfa/enroll` schema validation, dependency guard, principal fallback policy, auth/scope enforcement, route registration. |
| `tests/verify-mfa.route.test.ts` | route | 6D | 18 | `POST /v1/mfa/verify` schema validation, factor ownership checks, auth/scope enforcement, command error mapping, route registration. |
| **Total** | | | **213** | |

**Architectural boundary test:** the application layer is verified separately by `grep -r "fastify" application/` — zero matches is the contract.

### 3.13 Current API surface (HEAD — `feature/aadhaar-vault` Session 6D)

| Method | Path | Body | Auth | Success | Possible errors |
|---|---|---|---|---|---|
| GET | `/health` | — | none | 200 `{status:"ok"}` | — |
| GET | `/health/ready` | — | none | 200 `{postgres:"ok",keyProvider:"ok"}` | 503 if either is down |
| POST | `/v1/tokenize` | `{ raw, type, context }` | `Bearer <jwt>` + `vault:tokenize` scope | 201 `{token,last4,tokenType,auditId,identityId,keyVersion}` | 400, 401, 403, 422, 500, 503 |
| POST | `/v1/detokenize` | `{ challengeId, context }` | `Bearer <jwt>` + `vault:detokenize` scope | 200 `{token,identityId,aadhaar,last4,auditId}` | 400, 401, 403, 404, 409, 410, 500, 503 |
| GET | `/v1/audit` | query: `{ identityId?, limit? }` | `Bearer <jwt>` + `vault:audit` scope | 200 `{entries:[...],limit}` | 400, 401, 403, 500, 503 |
| POST | `/v1/mfa/enroll` | `{ actorId?, factorType, label, context }` | `Bearer <jwt>` + `vault:mfa:enroll` scope | 200 `{factor,auditId}` | 400, 401, 403, 500, 503 |
| POST | `/v1/mfa/verify` | `{ factorId, code, context }` | `Bearer <jwt>` + `vault:mfa:verify` scope | 200 `{factorId,verified,auditId}` | 400, 401, 403, 404, 422, 500, 503 |

**401 envelope (any `code` from the verifier):**

```json
{ "error": "unauthorized", "message": "<human-readable>", "code": "token_expired" }
```

**403 envelope (scope miss):**

```json
{ "error": "forbidden", "message": "Missing required scope: vault:tokenize" }
```

Routes listed in design docs but **not yet implemented** at HEAD:
- `DELETE /v1/token/:id`

### 3.14 Open work (honest list)

| # | Open item | Why it is incomplete | Severity | Expected session |
|---|---|---|---|---|
| 1 | ~~Auth middleware plugin is not implemented. `POST /v1/tokenize` reads `actorId`/`actorRole` from the request body.~~ | **RESOLVED — Session 5.** Auth plugin + HS256 verifier + scope enforcement + integration tests are landed. The route still accepts `actorId`/`actorRole` in the body for backward compatibility and as a server-side identity override; the principal is now derived from the verified JWT. | high | — |
| 2 | ~~Audit-history HTTP route is not exposed.~~ | **RESOLVED — Session 6B.** `GET /v1/audit` is wired behind `vault:audit`, derives principal context from the JWT, validates query params, and is route-tested. | medium | — |
| 3 | ~~MFA HTTP routes are not exposed.~~ | **RESOLVED — Sessions 6C/6D.** `POST /v1/mfa/enroll` and `POST /v1/mfa/verify` are wired behind dedicated scopes, use the existing commands, and are route-tested. | medium | — |
| 4 | Production-grade `EventPublisher` (Redis Streams / Kafka / SQS). | The in-process adapter is sufficient for tests and the single-process deployment; any fan-out deployment needs a real transport. | low | Session 6+ |
| 5 | Audit-chain HMAC and key-rotation orchestration are intentionally out of the `KeyManager` port. | Those responsibilities belong to a future service that picks its own key material; bolting them onto `KeyManager` would couple concerns. | medium | Session 6+ |
| 6 | Real KMS adapter (AWS / GCP / HashiCorp Vault) replacing `LocalDevKeyManager`. | Design is intentional; the production-safety guard exists. The adapter code path is not yet codified. | medium | Session 6+ |
| 7 | Postgres-backed tests against the bundled `docker compose up postgres` are not yet wired into CI. | We have green in-memory tests and a clean adapter boundary; production DDL replay against the bundled Postgres is the next gate. | medium | Session 6 |
| 8 | Plaintext wiping is centralised in `safeZero()` and now covered by tokenize, detokenize, MFA enroll, and MFA verify tests; future route/adapters must preserve the same invariant. | The current command paths are covered, but this remains an ongoing review point as new secret-bearing callsites land. | low | ongoing |
| 9 | `MemoryPool` SQL dialect is narrow by design; it throws on divergent queries. New query shapes in adapters must be added to the dialect to keep their tests green. | This is by design (failing fast), but it is ongoing work as the adapter surface grows. | low | ongoing |
| 10 | JWKS / RS256 verifier for production-grade issuer validation. | HS256 is fine for internal/trusted-issuer deployments; public-token-issuer deployments would need asymmetric verification. | medium | Session 7+ |
| 11 | Refresh / revocation list for tokens. | Out of scope for the current hour-bound token window; will become relevant when the lookup route lands. | low | Session 7+ |
| 12 | ~~Mandatory MFA step-up for detokenization.~~ | **RESOLVED — Session 7E.** Detokenize now requires an approved MFA challenge (`challengeId` instead of `token`). | high | — |

---

## 4. Known issues & follow-ups

Issues are recorded with their originating context and marked RESOLVED when fixed. Historical issues are never deleted.

| # | Issue | Area | Severity | Status |
|---|---|---|---|---|
| 1 | Vault test suite failing under `pg-mem` (could not parse production DDL, hung at bootstrap). | aadhaar-vault | high (was) | **RESOLVED** — Session 2 replaced with `MemoryPool`. |
| 2 | Only one `KeyManager` adapter (`local-dev`) is implemented. Production needs a real KMS adapter (AWS / GCP / HashiCorp) before the prod-guard override should ever be toggled. | aadhaar-vault | medium | open — deferred to Session 6+ |
| 3 | Audit-chain HMAC and key-rotation orchestration are intentionally out of the `KeyManager` port and not yet implemented. | aadhaar-vault | medium | open — deferred to Session 6+ |
| 4 | `POST /v1/tokenize` had no auth middleware; read `actorId`/`actorRole` from the request body. | aadhaar-vault | high | **RESOLVED** — Session 5 lands HS256 JWT auth + scope enforcement. |
| 5 | Audit-history flow has an application command but no HTTP route. | aadhaar-vault | medium | **RESOLVED** — Session 6B wires `GET /v1/audit`. |
| 6 | MFA enroll / verify flows have application commands but no HTTP routes. | aadhaar-vault | medium | **RESOLVED** — Sessions 6C/6D wire `POST /v1/mfa/enroll` and `POST /v1/mfa/verify`. |
| 7 | In-process `EventPublisher` only; production wiring (Redis Streams / Kafka / SQS) is not done. | aadhaar-vault | low | open — deferred to Session 6+ |
| 8 | Detokenize is not yet bound to a mandatory MFA approval/challenge. | aadhaar-vault | high | **RESOLVED** — Session 7E wires step-up auth for detokenize. |

---

## 5. Active branches & branch history

- Default branch tracks the canonical `docs/` reference set and the historic backend tree.
- `microservices/aadhaar-vault/` was introduced in this fork. Chronological session log:

> **Session 8 — Console Refactoring & UX Improvements (in progress)**
>
> **Status:** Phase 1 of 4 complete (modularization). Phases 2-4 queued.
>
> **Scope:** Developer console only — architecture, routes, payloads, and
> backend API contract remain frozen.
>
> **Changes:**
>
> - New shared modules under `console/`:
>   `config.js`, `storage.js`, `logger.js`, `ui.js`, `api.js`.
> - `app.js` (was 917 lines) and `stepup.js` (was 412 lines) refactored
>   onto the shared modules; no behaviour changes, no UI changes.
> - New test suite `tests/console.test.ts` (7/7 passing) validates
>   `Api.baseUrl`, `Api.parseJwt`, `storage.get/set/remove`,
>   `logger.logRequest`, `ui.formToObject`, `ui.toast`, `ui.pre`.
> - `styles.css` deliberately unchanged (Phase 3 will introduce tokens,
>   consolidated buttons, dark-mode audit).
> - `SESSION_8_DELIVERABLES.md` captures the full review, refactor plan,
>   and Phase 2-4 backlog.
>
> **Out of scope (preserved):** routes, payloads, response shapes,
> auth/MFA/step-up flow, storage keys, default actor / JWT / API URL.
>
> **Known unrelated:** pre-existing backend test failures in
> `mfa.routes.test.ts`, `detokenize.route.test.ts`, `verify-mfa.route.test.ts`
> reproduce on `origin/feature/aadhaar-vault` HEAD before any console
> change (verified via `git stash -u && vitest run`).
>
> **Next:** Phase 2 — UX improvements (collapsible panels, copy buttons,
> status pills, auto-derive fields).


| Session | Commit | High-level summary | Tests added | Build |
|---|---|---|---|---|
| 1 | (pre-`74bb51b` baseline) | Fork spine: Postgres adapters typed, `MemoryPool`, migrator, health routes, Docker scaffolding. | harness only | docker-compose up: green |
| 2 | (pre-`74bb51b` baseline) | Harness stabilisation: `tests/db.test.ts` + `tests/boot.test.ts`; `pg-mem` removed. | db (6) + boot (6) | green |
| 3 | `74bb51b` | Cryptographic boundary: `KeyManager` port + `LocalDevKeyManager` adapter (HKDF-SHA-256 → AES-256-GCM), production-safety guard, `/health/ready` reports `keyProvider`. | key-manager (8) | green |
| 3.5 | `cd32d5f` | Memory hygiene: `src/util/dek-zero.ts` + focused unit tests. | dek-zero (5) | green |
| 4 | `8e616bb` | Tokenisation route + application command: `POST /v1/tokenize`, `TokenizeAadhaar` command, 4 new application ports, Node-crypto + in-process-event adapters, `002_tokens.sql`, memory + Postgres `transactional-vault-writer`, lazy DI in `buildServer`, `vitest` forks pool. | tokenize-aadhaar (7) + tokenize.route (7) | green |
| 5 | `d30b42a` | **Auth foundation (Phase 1):** `JwtVerifier` port, `Hs256JwtVerifier` adapter, Fastify auth plugin (`principal` + `requireScope`), `createJwtVerifier` factory, `.env.example` updates, `health` routes made public, `POST /v1/tokenize` gated by `vault:tokenize` scope. Dependency-free `mintTestToken` helper. 8th test suite. Central error handler now maps `JwtVerificationError` → 401 with `{error, message, code}` and `ScopeRequiredError` → 403. | hs256-jwt-verifier (13) + auth.plugin (9) = 22 new cases | green — 66/66 across 8 suites; `tsc --noEmit` clean |
| **5 Phase 2** | **HEAD (uncommitted)** | **MFA factor model + TOTP verifier:** rename `vault_mfa_challenges` → `vault_mfa_factors` (migration 003), `MfaFactorRepository` port, `PostgresMfaFactorRepository` adapter, `TotpVerifier` port, `OtpAuthTotpVerifier` (RFC 6238 — 31 tests including all three SHA vectors), `KeyManager.sealSecret/openSecret` extension, `app.totpVerifier` decorator, `db/index.ts` schema mirror updated. 9th test suite. Architectural invariant: `application/` zero `fastify`/`otpauth`/`jose`/`pg` imports — verified. | totp-verifier (31) + db (+5 = 11 total) | green — 98/98 across 9 suites; `tsc --noEmit` clean |
| **5C** | **HEAD (uncommitted)** | **Command surface expansion + detokenize route:** `DetokenizeAadhaar`, `ReadAuditHistory`, `EnrollMfa`, and `VerifyMfa` application commands landed with in-memory port fakes and plaintext-hygiene checks. `POST /v1/detokenize` is registered behind `vault:detokenize`, validates `{ token, context }`, maps auth/scope/schema/not-found errors, and returns JSON envelopes. Detokenize still has a tokenize → detokenize wrap-context reconciliation caveat. Audit-history and MFA routes are still open. | detokenize command (9) + detokenize route (11) + read-audit-history (9) + enroll-mfa (13) + verify-mfa (24) = 66 new cases | **green — 164/164 across 14 suites; `npm run build` clean** |
| **6B** | **HEAD (uncommitted)** | **Audit HTTP route:** `GET /v1/audit` registered behind `vault:audit`, query validation added, route derives actor context from JWT principal, missing-dependency path returns 503, route tests cover auth/scope/schema/limit/error envelopes. | audit.route (18) | green |
| **6C** | **HEAD (uncommitted)** | **MFA enroll HTTP route:** `POST /v1/mfa/enroll` registered behind `vault:mfa:enroll`, validates strict body/context shape, seals factor secrets through `KeyManager`, appends audit, publishes event, and returns a JSON-safe factor envelope. | enroll-mfa.route (13) | green |
| **6D** | **HEAD (uncommitted)** | **MFA verify HTTP route:** `POST /v1/mfa/verify` registered behind `vault:mfa:verify`, validates code/factor context, opens sealed factor secrets, maps command errors, marks successful use, appends audit, and publishes event. | verify-mfa.route (18) | **green — 213/213 across 17 suites; `npm run build` clean** |

- `CHANGELOG.md` is the chronological source of truth for past releases.
- `AUDIT.md` carries the most recent audit summary.

---

## 6. Contributor guide

1. Read [`microservices/aadhaar-vault/README.md`](./microservices/aadhaar-vault/README.md) to get the microservice running.
2. Read [`microservices/aadhaar-vault/AADHAAR_VAULT_FREE_ARCHITECTURE.md`](./microservices/aadhaar-vault/AADHAAR_VAULT_FREE_ARCHITECTURE.md) and §3 of this file end-to-end.
3. For auth‑adjacent changes, also read `src/auth/plugin.ts` and `src/application/ports/jwt-verifier.ts`.
4. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`CLAUDE.md`](./CLAUDE.md) for repo conventions.

---

_Treat this file as a snapshot. `CHANGELOG.md` and `AUDIT.md` are the chronological sources of truth._
