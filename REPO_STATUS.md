# REPO_STATUS.md — Repository Snapshot

> **Snapshot taken:** 24 Jul 2026, after Session 5 Phase 2 (MFA factor model + TOTP verifier).
> **Branch under audit:** `feature/aadhaar-vault`, tracking `origin/feature/aadhaar-vault` (upstream set via `git push -u origin feature/aadhaar-vault`).
> **Last commit on branch:** `d30b42a feat(aadhaar-vault): Session 5 Phase 1 — Auth foundation (Bearer JWT plugin)`.
> **Uncommitted on branch (current Session 5 Phase 2):** MFA factor model (`vault_mfa_challenges` → `vault_mfa_factors`), `KeyManager.sealSecret/openSecret`, `TotpVerifier` port + `OtpAuthTotpVerifier` (RFC 6238) adapter, `PostgresMfaFactorRepository`. Test status: **98 tests passing across 9 suites**, `tsc --noEmit` clean, `application/` zero `fastify`/`otpauth`/`jose`/`pg` imports.
> **Repository:** [`DUKartik/FLN_Open_Source`](https://github.com/DUKartik/FLN_Open_Source) (forked from [`vicharanashala/fln`](https://github.com/vicharanashala/fln)).
> **Project:** Foundational Literacy & Numeracy (FLN) adaptive assessment platform for early-grade Indian classrooms (Classes 1–5, ages 6–10).
> **Audience:** contributors, reviewers, and new maintainers. For the operator's guide, see [`RUNNING_THE_PROJECT.md`](./RUNNING_THE_PROJECT.md).

---

## 1. What this project is

The platform delivers an adaptive, level-based diagnostic for early-grade math and reading, structured around a 59-level FLN syllabus (Quantity Comparison → Advanced Mastery). It runs in three layers that are intentionally decoupled:

1. A teacher SPA (Vite + React + TS) with a mock fetch interceptor that satisfies every `/api/*` call from `localStorage` seeds.
2. An Express backend on `:3000` that exposes the REST API.
3. A Puppeteer-driven batch service on `:4000` that produces printable worksheets.
4. A Python evaluation pipeline (`ai-services/`) that runs mostly rule-based today, with optional LLM augmentation.

The repo also ships an authoritative document set (`docs/`, `Research/`, `FLN Levels Structure/`) that defines the canonical contracts. Inline code lag is expected; **the docs win** when in doubt.

A pre-alpha **Aadhaar Vault microservice** (`microservices/aadhaar-vault/`) was introduced in this fork. Full architecture, decisions, and session history are recorded in §7. As of the Session 5 landing, the vault exposes `POST /v1/tokenize` behind a Bearer-JWT auth plugin, has **66 tests passing across 8 suites**, and `tsc --noEmit` clean.

---

## 2. Top-level layout

```
FLN_Open_Source/
├── README.md                 ← project pitch
├── PRD.md / SRS.md           ← product + software requirements
├── ARCHITECTURE.md           ← current system architecture
├── AUDIT.md / CHANGELOG.md   ← internal audit + release history
├── CLAUDE.md                 ← AI-assistant guidance for this repo
├── CONTRIBUTING.md           ← contributor guide
├── database_design.md        ← DB narrative
├── ER_diagram_db.md          ← ER diagram (Mermaid)
├── MIGRATION_PLAN.md         ← legacy → canonical merge plan
├── schema_design.md          ← DB schema reference
│
├── backend/                  ← Node REST API on :3000 (canonical)
│   ├── src/                  ← modular routes, services, models, middlewares
│   ├── data/db.json          ← fallback JSON store (gets rewritten on every mutation)
│   ├── test_submit.cjs       ← smoke-test (login + submission)
│   ├── package.json / tsconfig.json / .env.example
│   └── fln-backend/          ← SEPARATE Puppeteer batch service on :4000 (sub-project)
│
├── frontend/                 ← Vite + React + TS SPA on :5173
│   ├── index.html / vite.config.ts / tsconfig.json
│   ├── public/               ← static assets (incl. worksheets)
│   ├── src/                  ← pages, components, hooks, services, the mock fetch interceptor
│   └── server.err            ← leftover Vite dev log (should be gitignored)
│
├── ai-services/              ← Python adaptive evaluation pipeline
│   ├── run_pipeline.py / run_evaluation_c2p2.py
│   ├── personalized_evaluation_pipeline.py
│   ├── personalized_evaluation/   ← python package: scorers, prompt builders, generators
│   ├── prompts/ questions/ syllabus/ scripts/
│   ├── requirements.txt
│   └── PIPELINE.md
│
├── microservices/
│   └── aadhaar-vault/        ← NEW (this fork). PII tokenisation service. See §7.
│       ├── src/auth/         ← ports + plugin + factory (Session 5)
│       ├── src/application/ports/jwt-verifier.ts
│       ├── src/infrastructure/auth/hs256-jwt-verifier.ts
│       └── tests/auth.plugin.test.ts
│
├── docs/                     ← authoritative reference docs (see §6)
├── Research/                 ← pedagogy / assessment / case-study corpus
├── FLN Levels Structure/     ← one folder per FLN level (L1–L59) + their prompts
├── Database/                 ← seed JSON fixtures (users, schools, classes, students, questions)
├── scripts/                  ← dev helpers (dev-backend.js wrapper)
└── package.json              ← root-level npm workspaces script runner
```

---

## 3. Backend (`backend/`) — current state

**Stack:** Node.js, Express, Mongoose (MongoDB optional), TypeScript via `tsx` for dev / `esbuild` for prod. JSON-file fallback is the default in dev — the server boots even when MongoDB is unreachable.

**Two trees live inside `backend/`:**

| Path | Purpose | Listener |
|---|---|---|
| `backend/src/` + `package.json` (root of `backend/`) | Canonical REST API used by the SPA's intended design and documented in `docs/`. | `:3000` |
| `backend/fln-backend/` | A separate Express + Puppeteer app that batch-renders per-student worksheets using a headless Chromium driving `app/index.html`. | `:4000` |

> The two trees are not interchangeable. `MIGRATION_PLAN.md` describes the planned consolidation; treat `backend/src/` as the canonical thing to edit today.

**Status:**
- ✅ Boots with no DB (`mongoose.connect()` failure is caught and logged).
- ✅ Builds via `npm run build` → `backend/dist/server.cjs`.
- ✅ Curl-checkable via `/api/health`, `/api/stats`, `/api/auth/login`.
- ⚠ `backend/data/db.json` is a runtime-mutated file; it is not gitignored and shows up in `git diff` after every mutation. Revert with `git checkout -- backend/data/db.json` before committing.
- ⚠ `backend/.env` exists untracked locally for env-specific keys.

**Auth model:** both the mock and the real backend use a plaintext Bearer email identity today (i.e., auth is fake). `JWT_SECRET` is configured but not actually exercised by the login flow. Password validation enforces ≥8 chars, ≥1 uppercase, ≥1 digit, ≥1 special. Real auth has not landed yet.

**Routes:** see `backend/src/index.ts` for the full mount table (≈ 660 lines). Health, stats, auth, students, classes, schools, assessment, generation locks, evaluation, paper generation are all there.

---

## 4. Frontend (`frontend/`) — current state

**Stack:** Vite, React 18, TypeScript. Hot-reload by default; can be disabled with `DISABLE_HMR=true`.

**Status:**
- ✅ Vite dev server boots on http://localhost:5173 via `npm run dev:frontend`.
- ✅ Builds to `frontend/dist/` via `npm run build`.
- ✅ Builds the static file served by Express in production (when `FRONTEND_DIST_DIR` is set).

**The single most important fact about the frontend:** `frontend/src/main.tsx` (around line 8) installs a fetch interceptor that answers every `/api/*` call from `localStorage` seeds. The mock intercepts before the request hits the network or Vite's proxy. Consequences:

- The UI works without the Express backend running.
- The UI does not call the real backend today; if you want to bypass the mock, you must remove the interceptor.
- A feature returning "Network error" in the browser usually means the mock does not implement that endpoint yet — not that the backend is down.
- `VITE_API_URL` in `frontend/src/services/api.ts` points at `:5000` (a mismatched port); `VITE_API_TARGET` points the proxy at `:3000`. Neither path is hit because the interceptor wins. See `RUNNING_THE_PROJECT.md` §11 for the exact incantations.

**Why it has a leftover `server.err`:** that's a Vite dev log that was committed. Add it to `.gitignore`.

---

## 5. AI Services (`ai-services/`) — current state

**Stack:** Python 3.10+, `pip`, very few pinned deps (`requirements.txt` only pins `requests>=2.31.0`).

**Status:**
- ✅ Runnable as a script and (usually) importable.
- ✅ Deterministic rule-based level placement works without an API key.
- ⚠ Full AI-narrative grading requires `GEMINI_API_KEY` or `GROQ_API_KEY` in `backend/.env`, which the backend passes through. With no key, you still get an answer — it's just generic.
- ⚠ Inputs are `ai-services/{questions,syllabus,prompts}`. Outputs land wherever the specific runner script specifies — see `ai-services/scripts/` for the `0_*.py` → `3_*.py` stages.
- 🔬 The pipeline is invoked by the backend via `child_process` + file exchange (see `backend/src/index.ts`). Treating `ai-services/` as purely "a place to run a script" is OK, but the full path is via the backend, not directly.

For deeper docs see `ai-services/PIPELINE.md`.

---

## 6. `docs/` — author-of-truth reference set

Curated, hand-written docs that describe the canonical behaviour of the product. These supersede whatever you find inline in code.

| File | Purpose |
|---|---|
| `docs/README.md` | Index of docs. |
| `docs/backend-modules-reference.md` | Per-module reference for the canonical backend. |
| `docs/FLN_Levels_Complete_Data.md` | Authoritative table of all 59 levels (id, title, anchor competencies). |
| `docs/teacher-api-endpoints.md` | REST endpoints the teacher SPA calls. |
| `docs/teacher-workflow-overview.md` | End-to-end teacher journey. |
| `docs/teacher-diagnostic-workflow.md` | Diagnostics flow specifics. |
| `docs/teacher-bulk-diagnostic.md` | Bulk diagnostic upload. |
| `docs/teacher-worksheet-workflow.md` | Worksheet generation workflow. |
| `docs/teacher-governance-rules.md` | Authorisation & role invariants. |
| `docs/teacher-icr-scanner.md` | ICR (handwritten OCR) flow. |
| `docs/sample-baseline-class3.json` | Sample baseline assessment payload. |
| `docs/new-backend-frontend-reference.md` | Canonical merged reference for the new backend ↔ frontend contract in this fork. |

> When in doubt, the docs win. Inline code lag is expected (this is pre-v1.0 work).

---

## 7. `microservices/aadhaar-vault/` — new in this fork, **PRE-ALPHA**

### 7.1 Service overview

A standalone tokenisation service for Aadhaar-style identity numbers. It accepts a sensitive plaintext identifier, returns a reversible tokenised reference, and never persists plaintext to disk or logs. The service is structured around Clean Architecture so that Fastify, `pg`, and Node's `crypto` module never appear in the same module as business logic.

It is **pre-alpha**: the cryptographic and transactional primitives are landing one session at a time, and not every route in the design doc is exposed yet. See §7.14 for the honest list of remaining work.

### 7.2 Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict)
- **HTTP:** Fastify
- **Validation:** Zod (strict, additive — unknown keys rejected)
- **Database driver:** `pg` (production) and a hand-rolled `MemoryPool` (tests)
- **Container:** Docker + docker-compose (Postgres bundled)
- **Tests:** Vitest (runners in `forks` mode)
- **Crypto:** Node.js `crypto` (HKDF-SHA-256, AES-256-GCM)
- **Auth:** HS256 JWT (Bunyan-style symmetric secret) — auth foundation landed Session 5

### 7.3 Purpose

The service solves a single problem — *replace a plaintext identity number with a reversible token for downstream systems — and resolves it defensibly*. Specifically it must:

- never log plaintext;
- never persist plaintext;
- dedupe by `(identity_type, identity_hash)` so re-tokenising the same number yields the same row;
- bind tokens cryptographically to a `(tenant, purpose, pepper_version)` context so a token minted for one caller cannot be replayed against another;
- emit an audit event per mint operation;
- expose a tiny HTTP surface that returns either a token or a typed error code;
- require an authenticated principal with the right scope at the route boundary (Session 5).

### 7.4 Clean Architecture

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

### 7.5 Architectural decisions — recorded with rationale

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

### 7.6 Database architecture

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

### 7.7 Composition root

`buildServer` (`src/server.ts`) is the composition root. Adapters are bound as **factories** (`() => KeyManager | undefined`), not eager singletons. This means:

- Plugin decorator ordering does not matter.
- Tests can substitute any adapter by overriding a single factory.
- A not-yet-wired adapter degrades gracefully — the route returns 503 instead of crashing.

What is wired where:

- `KeyManager` is built by the factory in `infrastructure/key-providers/index.ts` and exposed on `app.keyManager`.
- `TransactionalVaultWriter`, `TokenRepository`, `CryptoService`, and `EventPublisher` are bound at server construction and exposed on `app` for the route layer.
- The route layer reads `app.tokenizeCommand` (an instance built from the ports) and calls it.
- **Session 5 addition:** `JwtVerifier` is built by `src/auth/factory.ts` from `SERVICE_JWT_HMAC_SECRET` / `SERVICE_JWT_ISSUER` / `SERVICE_JWT_AUDIENCE`, and exposed on `app.jwtVerifier`. The auth plugin reads it.

### 7.8 Transaction boundaries

There is exactly one transaction in the system today:

| Scope | Implemented by | Why |
|---|---|---|
| `identity_lookup + token_insert + audit_insert` | `PostgresTransactionalVaultWriter` | All three writes must succeed or fail together. A token without an audit row violates the design's invariant. |

The application port (`TransactionalVaultWriter`) enforces that `run(ctx, fn)` is the only path that touches persistence. The memory adapter gives the route-level integration test the same shape without a real database.

### 7.9 Cryptographic design

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

### 7.10 Memory hygiene

- `safeZero(buf)` (`src/util/dek-zero.ts`) overwrites an in-memory buffer with zeros before release.
- DEKs are wrapped before they leave a route: they are never logged; they are never serialised to disk in plaintext.
- Audit rows record only `last4` of the **token reference**, never the plaintext or the ciphertext.
- All `Buffer`s that may hold DEKs are wiped in their narrowest possible scope (per call site).

### 7.11 Auth foundation (Session 5)

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

**Config additions (`.env.example`)**

```
SERVICE_JWT_HMAC_SECRET=…                      # shared with the issuing service; ≥ 32 bytes
SERVICE_JWT_ISSUER=…                           # expected `iss`; rejects on mismatch
SERVICE_JWT_AUDIENCE=…                         # expected `aud`; rejects on mismatch
```

Missing/short secret or sentinels in `process.env` cause `buildServer` to refuse to start, not to fail on the first request.

### 7.12 Test strategy

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
| **Total** | | | **98** | |

**Architectural boundary test:** the application layer is verified separately by `grep -r "fastify" application/` — zero matches is the contract.

### 7.13 Current API surface (HEAD — `feature/aadhaar-vault` post Session 5)

| Method | Path | Body | Auth | Success | Possible errors |
|---|---|---|---|---|---|
| GET | `/health` | — | none | 200 `{status:"ok"}` | — |
| GET | `/health/ready` | — | none | 200 `{postgres:"ok",keyProvider:"ok"}` | 503 if either is down |
| POST | `/v1/tokenize` | `{ context, identity_type, plaintext, actorId, actorRole }` | `Bearer <jwt>` + `vault:tokenize` scope | 201 `{token_id,identity_id,token_type,key_version,last4}` | 400, 401, 403, 422, 500, 503 |

**401 envelope (any `code` from the verifier):**

```json
{ "error": "unauthorized", "message": "<human-readable>", "code": "token_expired" }
```

**403 envelope (scope miss):**

```json
{ "error": "forbidden", "message": "Missing required scope: vault:tokenize" }
```

Routes listed in design docs but **not yet implemented** at HEAD:
- `GET /v1/lookup`
- `DELETE /v1/token/:id`
- MFA challenge HTTP route (schema and adapter exist; no route)

### 7.14 Open work (honest list)

| # | Open item | Why it is incomplete | Severity | Expected session |
|---|---|---|---|---|
| 1 | ~~Auth middleware plugin is not implemented. `POST /v1/tokenize` reads `actorId`/`actorRole` from the request body.~~ | **RESOLVED — Session 5.** Auth plugin + HS256 verifier + scope enforcement + integration tests are landed. The route still accepts `actorId`/`actorRole` in the body for backward compatibility and as a server-side identity override; the principal is now derived from the verified JWT. | high | — |
| 2 | `GET /v1/lookup` and `DELETE /v1/token/:id` are described in the architecture doc but not implemented. | Deferred to keep this session's surface tight; design is settled, only routes + handlers remain. | medium | Session 6 |
| 3 | MFA factor model landed (persistent `vault_mfa_factors` table + RFC 6238 TOTP verifier, 31 tests). **No HTTP route yet** — `POST /v1/mfa/enroll` and `POST /v1/mfa/verify` are described in the design doc but not implemented. | Persistence and algorithm layer are settled; only routes + handlers remain. | medium | Session 6 |
| 4 | Production-grade `EventPublisher` (Redis Streams / Kafka / SQS). | The in-process adapter is sufficient for tests and the single-process deployment; any fan-out deployment needs a real transport. | low | Session 6+ |
| 5 | Audit-chain HMAC and key-rotation orchestration are intentionally out of the `KeyManager` port. | Those responsibilities belong to a future service that picks its own key material; bolting them onto `KeyManager` would couple concerns. | medium | Session 6+ |
| 6 | Real KMS adapter (AWS / GCP / HashiCorp Vault) replacing `LocalDevKeyManager`. | Design is intentional; the production-safety guard exists. The adapter code path is not yet codified. | medium | Session 6+ |
| 7 | Postgres-backed tests against the bundled `docker compose up postgres` are not yet wired into CI. | We have green in-memory tests and a clean adapter boundary; production DDL replay against the bundled Postgres is the next gate. | medium | Session 6 |
| 8 | DEK wiping inside the command path is centralised in `safeZero()` but not yet threaded through every callsite. | Per-callsite plumbing is small but spread across modules; deferred until the auth plugin lands. | low | Session 6 |
| 9 | `MemoryPool` SQL dialect is narrow by design; it throws on divergent queries. New query shapes in adapters must be added to the dialect to keep their tests green. | This is by design (failing fast), but it is ongoing work as the adapter surface grows. | low | ongoing |
| 10 | JWKS / RS256 verifier for production-grade issuer validation. | HS256 is fine for internal/trusted-issuer deployments; public-token-issuer deployments would need asymmetric verification. | medium | Session 7+ |
| 11 | Refresh / revocation list for tokens. | Out of scope for the current hour-bound token window; will become relevant when the lookup route lands. | low | Session 7+ |

---

## 8. `Database/` — fixtures

Five JSON seed files used by the backend's dev / seed flow:

- `Database/test.users.json`
- `Database/test.schools.json`
- `Database/test.classes.json`
- `Database/test.students.json`
- `Database/test.questions.json`

These are fixtures only. The schema they mirror is in `schema_design.md`; the ER diagram is in `ER_diagram_db.md`.

---

## 9. `Research/` — and `FLN Levels Structure/`

**`Research/`** is a pedagogy / assessment corpus. Notable files:

- `FLN_foundation.md` — overview.
- `FLN_Assessment_Framework.md` — how assessments are designed.
- `National_status_report.md` — NEP / ASER context.
- `Assessment_paper_validation.md`, `Assessment_paper_rubric.md`.
- `Class_2_Adaptive_Question_Progression_Levels_1_to_10.md` — the spec the AI pipeline implements for Class 2.
- `Child_psychology.md` — early-grade development context.
- `ALEKS_case_studies.md` — reference for adaptive-knowledge-space designs.
- `fln_level_networks.md`, `fln_proposed_levels.md`, `fln_framework_evolution_log.md`, `fln_framework_from_scratch.md` — newer working notes (drafts; not yet authoritative).

**`FLN Levels Structure/`** holds one folder per level (L1–L59) with the syllabus content, plus a parallel `ai-services/syllabus/` that is the machine-readable counterpart the pipeline ingests. Treat `docs/FLN_Levels_Complete_Data.md` as the canonical level numbering — if the folder names disagree with the doc, the doc wins.

---

## 10. Known issues & follow-ups

Issues are recorded with their originating context and marked RESOLVED when fixed. Historical issues are never deleted.

| # | Issue | Area | Severity | Status |
|---|---|---|---|---|
| 1 | Vault test suite failing under `pg-mem` (could not parse production DDL, hung at bootstrap). | aadhaar-vault | high (was) | **RESOLVED** — Session 2 replaced with `MemoryPool`. |
| 2 | Only one `KeyManager` adapter (`local-dev`) is implemented. Production needs a real KMS adapter (AWS / GCP / HashiCorp) before the prod-guard override should ever be toggled. | aadhaar-vault | medium | open — deferred to Session 6+ |
| 3 | Audit-chain HMAC and key-rotation orchestration are intentionally out of the `KeyManager` port and not yet implemented. | aadhaar-vault | medium | open — deferred to Session 6+ |
| 4 | `POST /v1/tokenize` had no auth middleware; read `actorId`/`actorRole` from the request body. | aadhaar-vault | high | **RESOLVED** — Session 5 lands HS256 JWT auth + scope enforcement. |
| 5 | `GET /v1/lookup` and `DELETE /v1/token/:id` described in the architecture doc but not implemented. | aadhaar-vault | medium | open — deferred to Session 6 |
| 6 | MFA challenge flow has schema + adapter but no HTTP route. | aadhaar-vault | medium | open — deferred to Session 6 |
| 7 | In-process `EventPublisher` only; production wiring (Redis Streams / Kafka / SQS) is not done. | aadhaar-vault | low | open — deferred to Session 6+ |
| 8 | The two backend trees (`backend/src/` and `backend/fln-backend/`) both exist and are not interchangeable. `MIGRATION_PLAN.md` describes the merge. | backend | medium | open |
| 9 | `backend/data/db.json` is runtime-mutated and not in `.gitignore`. | backend hygiene | low | open |
| 10 | `frontend/server.err` is committed (a Vite log). | frontend hygiene | low | open |
| 11 | Frontend auth is plaintext-Bearer-email; `JWT_SECRET` is configured but not actually used by login. | security | medium | open |
| 12 | Two pre-existing `tsc --noEmit` errors in the main backend: `backend/src/index.ts:665`, `backend/src/paperGenerator.ts:233`. Tests do not exist; type-check is the only static guard. | DX | medium | open |
| 13 | `frontend/src/VITE_API_URL` mismatch (`:5000` vs `:3000` proxy target) — currently moot because the mock wins. | frontend | low | open |
| 14 | No committed GitHub Actions workflow (`~/.github/workflows`). | CI | medium | open |
| 15 | `.gitignore` re-saved as UTF-16 on Windows silently disables ignore patterns — historic incident. | DX | low | open |

---

## 11. Active branches & branch history

- Default branch tracks the canonical `docs/` reference set and the historic backend tree.
- `microservices/aadhaar-vault/` was introduced in this fork. Chronological session log:

| Session | Commit | High-level summary | Tests added | Build |
|---|---|---|---|---|
| 1 | (pre-`74bb51b` baseline) | Fork spine: Postgres adapters typed, `MemoryPool`, migrator, health routes, Docker scaffolding. | harness only | docker-compose up: green |
| 2 | (pre-`74bb51b` baseline) | Harness stabilisation: `tests/db.test.ts` + `tests/boot.test.ts`; `pg-mem` removed. | db (6) + boot (6) | green |
| 3 | `74bb51b` | Cryptographic boundary: `KeyManager` port + `LocalDevKeyManager` adapter (HKDF-SHA-256 → AES-256-GCM), production-safety guard, `/health/ready` reports `keyProvider`. | key-manager (8) | green |
| 3.5 | `cd32d5f` | Memory hygiene: `src/util/dek-zero.ts` + focused unit tests. | dek-zero (5) | green |
| 4 | `8e616bb` | Tokenisation route + application command: `POST /v1/tokenize`, `TokenizeAadhaar` command, 4 new application ports, Node-crypto + in-process-event adapters, `002_tokens.sql`, memory + Postgres `transactional-vault-writer`, lazy DI in `buildServer`, `vitest` forks pool. | tokenize-aadhaar (7) + tokenize.route (7) | green |
| 5 | `d30b42a` | **Auth foundation (Phase 1):** `JwtVerifier` port, `Hs256JwtVerifier` adapter, Fastify auth plugin (`principal` + `requireScope`), `createJwtVerifier` factory, `.env.example` updates, `health` routes made public, `POST /v1/tokenize` gated by `vault:tokenize` scope. Dependency-free `mintTestToken` helper. 8th test suite. Central error handler now maps `JwtVerificationError` → 401 with `{error, message, code}` and `ScopeRequiredError` → 403. | hs256-jwt-verifier (13) + auth.plugin (9) = 22 new cases | green — 66/66 across 8 suites; `tsc --noEmit` clean |
| **5 Phase 2** | **HEAD (uncommitted)** | **MFA factor model + TOTP verifier:** rename `vault_mfa_challenges` → `vault_mfa_factors` (migration 003), `MfaFactorRepository` port, `PostgresMfaFactorRepository` adapter, `TotpVerifier` port, `OtpAuthTotpVerifier` (RFC 6238 — 31 tests including all three SHA vectors), `KeyManager.sealSecret/openSecret` extension, `app.totpVerifier` decorator, `db/index.ts` schema mirror updated. 9th test suite. Architectural invariant: `application/` zero `fastify`/`otpauth`/`jose`/`pg` imports — verified. | totp-verifier (31) + db (+5 = 11 total) | **green — 98/98 across 9 suites; `tsc --noEmit` clean** |

- `CHANGELOG.md` is the chronological source of truth for past releases.
- `AUDIT.md` carries the most recent audit summary.

---

## 12. Contributor guide

1. Read [`README.md`](./README.md) (project pitch) and [`RUNNING_THE_PROJECT.md`](./RUNNING_THE_PROJECT.md) §1–§4 to get the app running.
2. Read [`docs/teacher-workflow-overview.md`](./docs/teacher-workflow-overview.md) and [`docs/teacher-api-endpoints.md`](./docs/teacher-api-endpoints.md) to understand the user journey.
3. Skim [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system shape.
4. **If your change touches `backend/`, first read [`docs/backend-modules-reference.md`](./docs/backend-modules-reference.md)** — that is the source of truth, not the older `backend/fln-backend/server.js`.
5. **If your change touches AI scoring**, read [`Research/Class_2_Adaptive_Question_Progression_Levels_1_to_10.md`](./Research/Class_2_Adaptive_Question_Progression_Levels_1_to_10.md) **and** [`ai-services/PIPELINE.md`](./ai-services/PIPELINE.md).
6. **If your change touches the `aadhaar-vault` microservice**, first read [`microservices/aadhaar-vault/AADHAAR_VAULT_FREE_ARCHITECTURE.md`](./microservices/aadhaar-vault/AADHAAR_VAULT_FREE_ARCHITECTURE.md) **and** §7 of this file end-to-end. Then read [`microservices/aadhaar-vault/README.md`](./microservices/aadhaar-vault/README.md) before touching the schema or adapters. For auth‑adjacent changes, also read `src/auth/plugin.ts` and `src/application/ports/jwt-verifier.ts` — the contract is intentional.
7. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`CLAUDE.md`](./CLAUDE.md) for repo conventions.

---


_Treat this file as a snapshot. `CHANGELOG.md` and `AUDIT.md` are the chronological sources of truth._