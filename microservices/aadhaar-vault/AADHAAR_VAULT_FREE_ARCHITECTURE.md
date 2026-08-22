# Aadhaar Vault — Free-Tier Architecture (v0.2)

> **Status:** Canonical architecture for the Aadhaar Vault microservice.
> **Scope:** Reproducible, open-source-first architecture that runs in a contributor's laptop, an institute lab, a free VM, or production — with the same API contract.
> **Revision:** v0.2 — incorporates operational refinements after v0.1 review.
> **Companion docs:** [`AADHAAR_VAULT.md`](./AADHAAR_VAULT.md) (design + working `server.js` stub), [`AADHAAR_VAULT_FREE_DEPLOY.md`](./AADHAAR_VAULT_FREE_DEPLOY.md) (deployment runbook).

---

## 📑 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Recommended Architecture](#3-recommended-architecture)
4. [Deployment Modes](#4-deployment-modes)
5. [Key Management Strategy](#5-key-management-strategy)
6. [Storage Model](#6-storage-model)
7. [Runtime API, Frontend Integration & Limits](#7-runtime-api-frontend-integration--limits)
8. [Security Model](#8-security-model)
9. [Offline and Low-Connectivity Approach](#9-offline-and-low-connectivity-approach)
10. [Recommended Repository Contribution](#10-recommended-repository-contribution)
11. [Concrete Code — `TokenizeAadhaar` Command](#11-concrete-code--tokenizeaadhaar-command)
12. [Revised Free-Tier Cost Matrix](#12-revised-free-tier-cost-matrix)
13. [Migration Plan from Current FLN Storage](#13-migration-plan-from-current-fln-storage)
14. [Implementation Milestones](#14-implementation-milestones)
15. [Daily Operations](#15-daily-operations)
16. [Architecture Decision Records](#16-architecture-decision-records)
17. [Compliance Mapping](#17-compliance-mapping)
18. [Closing Note](#18-closing-note)

---

## 1. Executive Summary

The Aadhaar Vault replaces raw government identity numbers (Aadhaar, Birth Certificate) in the FLN database with opaque tokens. Only audited, MFA-gated detokenization reveals the original value. The privacy contract is unchanged from v0.1; this v0.2 fixes what was overclaimed or under-specified.

**v0.2 corrections:**
- Renamed away from the institutional qualifier so the doc reads as the **project's architecture**, not "IIT Ropar's contribution."
- Dropped `cipher_version` and `key_provider` from schema, retained `algorithm`, `key_version`, `schema_version` (with rationale).
- Added operator stories for every KeyManager provider so reviewers don't pick one they can't operate.
- Added a witness strategy for the audit chain (FreeTSA for pilot, Polygon for production).
- Added concrete rate-limit values, JWT/JWKS architecture, OpenAPI auto-generation, frontend integration spec, CI/CD minimum, ADRs, and DPDP/RTE/Aadhaar compliance mapping.
- Renamed "light CQRS" → "Lightweight Command/Query Separation (CQRS-inspired)."
- Realistic timeline: **12–18 focused days** for a pilot-grade MVP (vs 6–8 days for a demonstrable prototype).

**What this doc is not:** a deployment runbook (see `AADHAAR_VAULT_FREE_DEPLOY.md`). This is the **architecture**; that file is the **ops**.

---

## 2. Design Principles

| Principle | Decision |
|---|---|
| Reproducible for reviewers | One command (`docker compose up`) brings up the full stack locally with no accounts. |
| Free by default | No credit card, no SaaS account, no paid KMS needed for development. |
| Honest compliance posture | The free stack is "reference-grade" or "pilot-grade"; production compliance still requires institutional review. |
| Open-source friendly | PostgreSQL, Docker Compose, generated OpenAPI, documented adapters — not vendor-locked managed services. |
| Minimal FLN coupling | FLN stores only `identityToken`, `identityLast4`, `identityType` — never the raw number. |
| Upgradeable security | Key provider and storage backend are interfaces, not hardcoded vendors. |
| Low operational burden | Contributors don't need to learn Vault unseal or cloud IAM before they can run the feature. |
| Aadhaar-first scope | Centered on child Aadhaar protection; Birth Certificate as fallback. MVP does not include PAN, passport, ABHA, or other adult/general-purpose identifiers. |
| Audit-evidence over vibes | STRIDE-mapped controls and external witnesses make non-repudiation real, not implied. |

---

## 3. Recommended Architecture

### 3.1 C4 Context Diagram

```text
Parents / Teachers / Volunteers
            |
            v
       FLN Frontend
            |
            v
       FLN Backend ----------------> Aadhaar Vault
            |                          |
            |                          v
            |                      PostgreSQL
            |
            v
   Existing FLN student records

Rule: FLN student records store Aadhaar vault tokens, not raw Aadhaar.
```

### 3.2 Container Diagram

```text
                          FLN Frontend
                              |
                              | HTTPS + JWT
                              v
                          FLN Backend
                              |
                              | Private HTTP + service JWT
                              v
+------------------------------------------------------------------+
|                  Aadhaar Vault Boundary                          |
|                                                                  |
|  +-----------------------+        +----------------------------+  |
|  | Vault API             |------> | Policy + Auth Layer        |  |
|  | Node.js / Fastify     |        | service JWT, RBAC, MFA     |  |
|  +-----------+-----------+        +-------------+--------------+  |
|              |                                  |                 |
|              v                                  v                 |
|  +-----------------------+        +----------------------------+  |
|  | Crypto Adapter        |        | Audit Chain Service        |  |
|  | local/Vault/KMS/HSM   |        | HMAC chain + witness link  |  |
|  +-----------+-----------+        +-------------+--------------+  |
|              |                                  |                 |
|              v                                  v                 |
|  +-----------------------------------------------------------+    |
|  | PostgreSQL                                                 |    |
|  | identity_tokens, audit_events, mfa_factors, key_metadata   |    |
|  +-----------------------------------------------------------+    |
|                                                                  |
|  Optional backup target: encrypted local file or MinIO bucket    |
+------------------------------------------------------------------+
```

### 3.3 Component Diagram — Clean Architecture

```text
REST Controllers
  tokenize.routes.ts
  lookup.routes.ts
  detokenize.routes.ts
  audit.routes.ts
      |
      v
Application Layer (Lightweight CQS, CQRS-inspired)
  commands/
    TokenizeAadhaar
    DetokenizeAadhaar
    RevokeAadhaarToken
  queries/
    LookupMaskedAadhaar
    ReadAuditHistory
    HealthStatus
      |
      v
Domain Layer
  AadhaarToken
  AuditEvent
  MfaChallenge
  PurposeOfUse
  TokenStatus
  DomainEvents
      |
      v
Ports
  IdentityRepository
  AuditRepository
  MfaRepository
  KeyManager
  EventPublisher
  Clock
      |
      v
Adapters
  PostgreSQL
  LocalDevKeyManager
  HashiCorpVaultKeyManager
  SopsAgeKeyManager
  AwsKmsKeyManager
  JwtVerifier
  TotpVerifier
  InProcessEventPublisher
```

This separation keeps the Aadhaar privacy domain independent of infrastructure. PostgreSQL, HashiCorp Vault, JWT, and TOTP are adapters; the core tokenization rules live in the domain and application layers.

### 3.4 Sequence — Tokenize

```text
FLN Backend
  -> Vault REST Controller
  -> TokenizeAadhaar command
  -> KeyManager.generateDataKey()
  -> Crypto service encrypts raw Aadhaar
  -> IdentityRepository.save(token record)
  -> EventPublisher.publish(AadhaarTokenized)
  -> Audit handler appends TOKENIZE event
  <- { token, last4, tokenType }
```

### 3.5 Sequence — Detokenize

```text
FLN Backend
  -> Vault REST Controller
  -> DetokenizeAadhaar command
  -> JwtVerifier verifies service identity
  -> TotpVerifier verifies human step-up
  -> IdentityRepository.findByToken()
  -> KeyManager.unwrapDataKey()
  -> Crypto service decrypts Aadhaar
  -> EventPublisher.publish(AadhaarDetokenized)
  -> Audit handler appends DETOKENIZE event
  <- { raw, auditId }
```

### 3.6 Why PostgreSQL over MongoDB

| Need | PostgreSQL fit |
|---|---|
| Token lookup | Indexed `token` column. |
| Audit ordering | Transactional append via `BIGSERIAL`. |
| Tamper-evident chain | Stable canonical JSONB + previous/current hash. |
| Reporting | SQL queries for compliance summaries. |
| Contributor setup | `docker compose up` — no cloud credentials. |
| Migration path | Move to Neon / Supabase / Cloud SQL / RDS without changing app logic. |

MongoDB can remain a supported adapter if the FLN backend prefers it (the existing repo uses Mongo), but the **default reference implementation** is PostgreSQL.

---

## 4. Deployment Modes

### Mode A — Contributor / Lab Reference Stack

Best for reviewers, demos, tests, classroom exercises.

| Component | Choice |
|---|---|
| Runtime | Docker Compose |
| Vault API | Node.js + Fastify |
| Database | PostgreSQL container |
| Key provider | `local-dev` from `.env` (refuses if `NODE_ENV=production`) |
| MFA | TOTP with encrypted secrets |
| Backup | Local encrypted export file (or skipped for dev) |
| Network | localhost only |
| Cost | **₹0, no cloud account** |

Default services:

```text
aadhaar-vault-api   :4101
aadhaar-vault-db    :5432
aadhaar-vault-minio :9000   (optional, for backup target)
```

### Mode B — Free Field Pilot Stack

Best for a small pilot with one real shared instance.

| Component | Preferred | Fallback |
|---|---|---|
| Compute | Institute VM, NKN-connected server, or Oracle Always-Free VM | Any donated Linux VM |
| Database | PostgreSQL on same VM with encrypted backups | Free managed PostgreSQL tier (Neon, Supabase) |
| Key provider | HashiCorp Vault with file/Raft storage, OR `sops-age` sealed local key | Cloud KMS if credits exist |
| Ingress | WireGuard / Tailscale private network | Nginx + TLS + IP allowlist |
| Backup | Nightly encrypted dump to institute storage | MinIO / S3-compatible free bucket |
| Witness | FreeTSA (free, public) | Institutional signed log |
| Monitoring | systemd / PM2 logs + uptime endpoint | Grafana / Prometheus |

### Mode C — Production Migration Stack

Best when a state/institution wants a reviewed deployment.

| Component | Production choice |
|---|---|
| Compute | Managed Kubernetes or hardened VM |
| Database | Managed PostgreSQL with PITR backups |
| Key provider | Cloud KMS / HSM with auto-unseal |
| Ingress | Private service mesh or mTLS gateway |
| Audit witness | Polygon public ledger anchor OR institutional WORM |
| Operations | SIEM, incident runbook, quarterly access review |

**The API contract is unchanged across all three modes.** A code that works in Mode A calls the same endpoints in Mode C with the same JSON shape.

---

## 5. Key Management Strategy

The KeyManager is a **port** in the clean architecture — adapters plug in. Four providers ship with the reference implementation:

```ts
interface KeyManager {
  generateDataKey(context: Buffer): Promise<{ plaintext: Buffer; wrapped: Buffer; keyVersion: string }>
  unwrapDataKey(wrapped: Buffer, context: Buffer): Promise<Buffer>
  signAuditCheckpoint(payload: Buffer): Promise<string>
  rotateKey(): Promise<{ newKeyVersion: string }>
}
```

| Provider | Use case | Free-tier fit |
|---|---|---|
| `local-dev` | Demos, tests, CI | Excellent — never for real PII |
| `hashicorp-vault` | Field pilot on single VM | Good with unseal ops maturity |
| `sops-age` | Low-ops pilot with manual key custody | Good — simpler than full Vault |
| `aws-kms` / `gcp-kms` / `azure-keyvault` | Reviewed production | Best with institutional budget |

### 5.1 Operator Stories

A provider is only as good as the human story behind it. Here's what each option means in operations.

#### A. `local-dev` — Developer/Reference Mode
- **Who holds keys:** the developer (in `.env`)
- **Startup ceremony:** none — read from environment at boot
- **Rotation:** manual env var update + Vault restart
- **Backup:** the developer's disk
- **Failure mode:** if `.env` leaks, **all tokens are decryptable**. Application refuses to start in this mode unless `NODE_ENV !== "production"` OR `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true` is set. This guard turns a silent leak into a startup crash.
- **When to use:** laptop demos, reviewer setup, CI tests. **Never with real child Aadhaar.**

#### B. `hashicorp-vault` — Single-VM Pilot
- **Who holds keys:** Vault daemon's root key, sealed behind 3-of-5 unseal keys held by 3 named operators
- **Startup ceremony:** operators paste unseal keys at boot; with `seal "transit"` (cloud KMS) auto-unseal can remove this
- **Rotation:** `vault write -f fln/transit/keys/aadhaar-master/rotate`; rotates the key version, future tokens use new version, existing wrapped DEKs still decryptable
- **Backup:** `vault operator raft snapshot save` (if Raft) or `cp /var/lib/vault/data` (if file backend); encrypted at rest by Vault
- **Failure mode:** lost unseal keys = unrecoverable. Mitigate by storing 3 copies with 3 named individuals + 1 in the team's password manager
- **When to use:** pilot Mode B with one shared instance and operators comfortable with Vault semantics

#### C. `sops-age` — Low-Ops Pilot with Manual Custody
- **Who holds keys:** N named recipients, each holding a `~/.config/sops/age/keys.txt` (or YubiKey-stored)
- **Startup ceremony:** at least K-of-N operators paste their age key files into a `bash -c 'sops decrypt ...'` ceremony at boot; typically 2-of-3
- **Rotation:** generate new age recipient, re-encrypt master key, retire old recipient file
- **Backup:** each operator keeps a paper / USB / YubiKey backup of their age key file in a separate location (geographic distribution)
- **Failure mode:** if K-of-N keys are lost, master key is irrecoverable. With 2-of-3 across 3 operators + 1 institutional copy, you can lose 1 operator and still recover
- **When to use:** pilot without Vault expertise; "I want strong keys but I'll trade sealed-secret ceremony for sealed-unseal ceremony"

#### D. Cloud KMS (`aws-kms`, `gcp-kms`, `azure-keyvault`)
- **Who holds keys:** the cloud provider's HSM-bound root
- **Startup ceremony:** none — IAM role authenticates the Vault at boot
- **Rotation:** managed by cloud provider (annual automatic for AWS KMS); KMS aliases update without service disruption
- **Backup:** KMS keys are HSM-protected; key material is non-extractable; backup is "the key exists in HSM" plus CloudTrail audit
- **Failure mode:** loss of IAM credentials = Vault cannot call KMS = tokens unwrappable. Mitigate with cross-account IAM role, MFA-protected access keys
- **When to use:** production Mode C — institutional budget exists, compliance requires HSM-backed trust

### 5.2 Internal Crypto Boundary

| Responsibility | Interface |
|---|---|
| Generate / wrap / unwrap DEKs | `KeyManager` |
| Encrypt / decrypt Aadhaar payloads | `CryptoService` |
| Persist token records | `IdentityRepository` |
| Persist audit chain events | `AuditRepository` |
| Persist MFA factors | `MfaRepository` |
| Publish domain events | `EventPublisher` |

### 5.3 Notes on HashiCorp Vault and HSM

HashiCorp Vault's default storage is software-isolated (mlock + audit log). With `seal "awskms"`, `seal "azurekeyvault"`, or `seal "pkcs11"`, it becomes HSM-backed — the master key is wrapped by a managed HSM and never sits in software. For an FLN deployment targeting institutional production, **always configure auto-unseal to a cloud KMS or PKCS#11 device.** This nuance is a footnote, not a section, because the v0.2 audience is contributing students and institute teams, not enterprise security architects.

---

## 6. Storage Model

Repository interfaces in the application layer. PostgreSQL is the reference implementation. Schema:

```sql
identity_tokens
  id uuid primary key
  token text unique not null
  token_type text not null
  identity_last4 text not null
  ciphertext bytea not null
  iv bytea not null
  auth_tag bytea not null
  wrapped_dek bytea not null
  algorithm text not null            -- 'aes-256-gcm' | 'xchacha20-poly1305'
  key_version text not null          -- 'kv-3' (current rotation counter)
  schema_version int not null        -- 1 | 2 (cipher envelope migration marker)
  status text not null               -- 'ACTIVE' | 'REVOKED'
  created_by text not null
  created_at timestamptz not null
  revoked_at timestamptz

audit_events
  sequence_id bigserial primary key
  event_id uuid unique not null
  event_type text not null           -- 'TOKENIZE' | 'DETOKENIZE' | 'LOOKUP' | 'MFA_ENROLL' | 'MFA_VERIFY' | 'REVOKE' | 'KEY_ROTATE'
  token text
  actor_id text not null
  actor_role text
  reason text not null
  source_ip inet
  user_agent text
  mfa_verified boolean not null default false
  previous_hash text not null
  current_hash text not null
  canonical_payload jsonb not null   -- the exact bytes that were HMAC'd
  created_at timestamptz not null

mfa_factors
  user_id text primary key
  totp_secret_ciphertext bytea not null
  totp_secret_wrapped_dek bytea not null
  backup_code_hashes jsonb not null
  failed_attempts int not null default 0
  locked_until timestamptz
  created_at timestamptz not null

key_metadata
  id text primary key
  algorithm text not null
  current_version text not null
  rotated_at timestamptz
  rotated_by text
  notes text
```

### 6.1 Why these three metadata columns

`algorithm` records the cipher used. `key_version` records which rotation the master key is from. `schema_version` records the envelope layout (e.g., v1: `(iv, tag)` only; v2: `(nonce, aad, tag)`). When a future migration introduces a new envelope shape, the decryptor dispatches on `schema_version` instead of writing heuristic inspections — keeping migration deterministic.

`cipher_version` and `key_provider` were dropped from the v0.1 draft: `cipher_version` was redundant with `(algorithm, key_version)`, and `key_provider` is operational metadata that can be inferred from the wrapped DEK format. Removing speculative columns keeps the schema lean.

---

## 7. Runtime API, Frontend Integration & Limits

### 7.1 API Contract

Stable `/v1` prefix. The FLN backend is the only authorized caller; the browser never calls Vault directly.

| Endpoint | Purpose | MFA | Auth |
|---|---|---|---|
| `POST /v1/tokenize` | Convert raw identity number to token | No | Service JWT |
| `GET /v1/lookup/:token` | Return masked value + metadata | No | Service JWT |
| `POST /v1/detokenize` | Reveal raw value for an approved reason | Yes (TOTP + reason + role) | Service JWT |
| `POST /v1/revoke` | Revoke a token | Yes (admin TOTP + reason) | Service JWT + admin role |
| `GET /v1/audit` | Query audit events with filters | Yes (admin only) | Service JWT + admin role |
| `GET /v1/health` | Readiness + dependency status | No | None |

### 7.2 Lightweight Command/Query Separation (CQRS-inspired)

The application layer splits mutations from queries:

| Type | Operations |
|---|---|
| **Commands** (writes, audited) | `TokenizeAadhaar`, `DetokenizeAadhaar`, `RevokeAadhaarToken`, `RotateKey` |
| **Queries** (reads, simpler) | `LookupMaskedAadhaar`, `ReadAuditHistory`, `HealthStatus` |

This is **not distributed CQRS** (no separate read database, no projection workers, no event sourcing pre-req). It's a folder split, audited write path, simple read path. The shared database remains PostgreSQL; commands append to the audit chain, queries don't.

### 7.3 JWT / JWKS Architecture

```text
FLN Backend                          Vault
   |                                   |
   |-- POST /v1/tokenize ----------->  |
   |   Authorization: Bearer <jwt>     |
   |                                   |
   |   (Vault needs public key to      |
   |    verify the JWT signature)      |
   |                                   |
   |   On boot, Vault fetches:         |
   |<-- GET /fln-backend/.well-known/jwks.json --|
   |   (public keys, cached)           |
   |                                   |
   |   When backend rotates keys:      |
   |   (new kid appears in JWKS)       |
   |   (Vault refreshes cache)         |
```

**Why:** the FLN backend's JWT signing key can rotate without Vault code changes. Vault fetches the JWKS once at boot and refreshes on cache miss (or on a configurable interval, default 1 hour).

**Implementation note:** use `jose` (npm) on the Vault side; the FLN backend already (or will) expose `/.well-known/jwks.json`. Keys are RS256 with 24-hour rotation. `kid` (key ID) header determines which public key Vault uses.

### 7.4 Rate Limits (concrete values)

Defaults; institutional reviewers should tighten for their environment.

| Resource | Limit | Window | Action on breach |
|---|---|---|---|
| Detokenize per actor | 10 | hour | 429 + audit `RATE_LIMIT_HIT` |
| Detokenize per token | 100 | day | 429 + audit `RATE_LIMIT_HIT` |
| Detokenize per school (aggregate) | 1000 | hour | 429 + alert |
| Tokenize per actor | 100 | minute | 429 + audit |
| MFA verify per user | 5 fail | 15 min | Account lock 15 min |
| Health endpoint | 60 | minute per IP | 429 |

Bucket implementation: in-memory sliding window is fine for single-instance; Redis if horizontal scaling is needed.

### 7.5 Frontend Integration Spec

The browser never calls Vault directly. The flow when a teacher views a student record:

```text
Browser                    FLN Backend              Vault
  |                            |                      |
  |-- view /student/:id -->    |                      |
  |                            |-- GET /lookup/:token -|
  |                            |<-- masked value ------|
  |<-- rendered record ------- |                      |
  |   "Aadhaar: XXXX-XXXX-9012"|                      |
  |   "Last 4 visible"         |                      |
  |                            |                      |
  |-- click "Reveal" --------> |                      |
  |   (teacher enters TOTP     |                      |
  |    in a modal)             |                      |
  |                            |-- POST /detokenize --|
  |                            |   {token, mfaProof,  |
  |                            |    callerUserId,     |
  |                            |    reason}           |
  |                            |<-- {raw, auditId} --|
  |<-- modal shows raw ------ |                      |
  |   "Aadhaar: 123456789012" |                      |
  |   "Audit ID: aud_abc123"  |                      |
  |   (auto-clears after 30s) |                      |
```

**Rules:**
- Vault always returns the full Aadhaar; the Frontend decides whether to display it.
- The display modal auto-clears after 30 seconds (frontend timer). No copy-paste allowed unless explicitly enabled by an admin policy.
- Audit ID is shown to the user so they have a receipt: "If asked, here is the audit ID for the last reveal."
- Frontend logs nothing about the raw value (no console.log, no analytics, no localStorage).

### 7.6 OpenAPI Auto-Generation

The `openapi.yaml` is generated, not hand-written:

```ts
// src/server.ts
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

await app.register(fastifySwagger, {
  transform: jsonSchemaTransform,
  openapi: {
    info: { title: 'Aadhaar Vault', version: '0.1.0' },
  },
});
await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
```

CI step:
```bash
npx tsx scripts/export-openapi.ts > openapi.gen.yaml
diff openapi.yaml openapi.gen.yaml || (echo "OpenAPI drift; rerun script"; exit 1)
```

This makes drift impossible; consumers can `wget /v1/openapi.json` directly from the running Vault.

---

## 8. Security Model

### 8.1 Tokenization

1. Validate Aadhaar / Birth Certificate / Govt ID format.
2. Generate random token: `vlt_v1_<base32-random>`.
3. Generate a per-record data encryption key through the configured `KeyManager`.
4. Encrypt the raw number with AES-256-GCM (or XChaCha20-Poly1305 if the `algorithm` column says so).
5. Store only ciphertext, IV/nonce, auth tag, wrapped DEK, last 4, metadata.
6. Append `TOKENIZE` audit event.

### 8.2 Detokenization

1. Verify service JWT (signature + `iss` + `aud` + `exp`).
2. Verify user role claim and explicit purpose (`reason`).
3. Require TOTP or backup code for human-initiated reveal.
4. Apply rate limits (per §7.4).
5. Unwrap DEK and decrypt only for the response lifetime.
6. Zero DEK from memory after use.
7. Append `DETOKENIZE` audit event before returning.

### 8.3 Domain Events

In-process `EventPublisher` for v0.1. Handlers are local; the bus becomes Redis Streams / NATS / Kafka only if the deployment grows.

| Event | Handlers |
|---|---|
| `AadhaarTokenized` | Append audit event, increment metrics. |
| `AadhaarDetokenized` | Append audit event, increment reveal counter, raise alert on suspicious volume. |
| `AadhaarTokenRevoked` | Append audit event, invalidate cached lookups. |
| `MfaVerificationFailed` | Append audit event, update lockout counter. |
| `KeyRotated` | Append audit event, update `key_metadata`. |

### 8.4 Audit Chain

Every audit event is canonicalized and HMAC'd:

```sql
canonical_payload = jsonb_build_object(
  'sequence_id', NEW.sequence_id,
  'event_id', NEW.event_id,
  'event_type', NEW.event_type,
  'token', NEW.token,
  'actor_id', NEW.actor_id,
  'actor_role', NEW.actor_role,
  'reason', NEW.reason,
  'source_ip', NEW.source_ip,
  'user_agent', NEW.user_agent,
  'mfa_verified', NEW.mfa_verified,
  'previous_hash', NEW.previous_hash,
  'created_at', NEW.created_at
)
-- canonical_payload is the bytes that get HMAC'd; the same row stores both
current_hash = HMAC_SHA256(audit_key, canonical_payload::text)
```

The `audit_key` is loaded from the KeyManager at startup; rotation of this key is itself an audit event (`KEY_ROTATE`).

#### 8.4.1 Witness Strategy (External Anchoring)

A local checkpoint file isn't a witness — an attacker who edits the audit log can also edit the local file. Non-repudiation requires an **external witness** to sign the latest `current_hash` periodically.

| Mode | Witness | Cost | What you get |
|---|---|---:|---|
| Mode A (reference) | None | ₹0 | Local-only hash chain, useful for tests |
| Mode B (pilot, free) | **FreeTSA** (RFC 3161 timestamp authority) | ₹0, public service | Signed timestamp attesting "this hash existed at time T" |
| Mode C (production) | **Polygon public ledger** anchor | ~₹70/year (1 tx/day) | Permanent public witness of daily checkpoints |
| Mode C (alt) | Institutional WORM (S3 Object Lock / Azure Immutable Blob / physical DVD) | Variable | Offsite, write-once-read-many |

**Pilot recommendation:** FreeTSA. Anchor daily at 23:59 IST:

```bash
# Get today's last audit row's current_hash
TODAY=$(date +%Y-%m-%d)
LAST_HASH=$(psql $VAULT_MONGO_URI -t -c "SELECT current_hash FROM audit_events ORDER BY sequence_id DESC LIMIT 1")
# Submit to FreeTSA
curl -s "https://freetsa.org/tsr" -o "$TODAY.tsr" -H "Content-Type: application/timestamp-query" \
  --data-binary @<(echo "$LAST_HASH" | openssl dgst -sha256 -binary | base64)
# Store the .tsr as evidence
aws s3 cp "$TODAY.tsr" s3://fln-vault-witnesses/$(date +%Y/%m/%d).tsr
# (Or store locally in Mode A/B with paper backup)
```

For Mode C, swap FreeTSA for a daily Polygon transaction: `polygonscan.com/tx/<hash>` becomes a permanent public witness. ~₹70/year at current gas.

### 8.5 STRIDE Threat Model

| STRIDE | Main risk | Mitigation |
|---|---|---|
| **Spoofing** | Fake FLN backend calls Vault | Service JWT (RS256), `iss`/`aud`/`exp` checks, JWKS rotation |
| **Tampering** | Token or audit row edited in DB | AES-GCM auth tags, HMAC audit chain, daily FreeTSA/Polygon witness |
| **Repudiation** | Actor denies revealing Aadhaar | Required reason, actor ID, MFA verified flag, IP / user-agent, immutable `sequence_id` |
| **Information disclosure** | Raw Aadhaar leaks via DB / logs / FE | Tokenization, encrypted backups, masked lookup only, detokenize endpoint requires MFA, browser auto-clear |
| **Denial of service** | Attackers exhaust detokenize / unwrap paths | Rate limits (§7.4), private ingress (Tailscale/WireGuard), degraded lookup-only mode |
| **Elevation of privilege** | Low-privilege user reveals Aadhaar | Role checks (RBAC), MFA required, admin-only audit/revoke, deny-by-default scopes |

---

## 9. Offline and Low-Connectivity Approach

| Operation | Offline behavior |
|---|---|
| Tokenize new identity | Queue locally in encrypted device storage; mark as `pending_sync`; sync when online. |
| Lookup masked identity | Use already-synced token metadata only. |
| Detokenize raw identity | **Do not allow offline detokenization.** Reveal requires online Vault + MFA. |
| Audit event | Queue signed local event, then reconcile on sync. |

The offline queue must be encrypted with a device-bound key (Android Keystore / iOS Secure Enclave / WebCrypto non-extractable). For v0.1, offline mode is a documented roadmap item, not default behavior.

---

## 10. Recommended Repository Contribution

```text
microservices/aadhaar-vault/
  docker-compose.yml
  README.md
  openapi.yaml              # generated, committed for diff review
  src/
    server.ts
    config.ts
    routes/
      tokenize.routes.ts
      lookup.routes.ts
      detokenize.routes.ts
      audit.routes.ts
      health.routes.ts
    services/
      crypto.service.ts
      audit-chain.service.ts
      mfa.service.ts
      auth.service.ts
      witness.service.ts       # daily FreeTSA / Polygon anchoring
    domain/
      aadhaar-token.ts
      audit-event.ts
      purpose-of-use.ts
      token-status.ts
    application/
      commands/
        tokenize-aadhaar.ts
        detokenize-aadhaar.ts
        revoke-aadhaar-token.ts
      queries/
        lookup-masked-aadhaar.ts
        read-audit-history.ts
        health-status.ts
      ports/
        identity.repository.ts
        audit.repository.ts
        mfa.repository.ts
        key-manager.ts
        event-publisher.ts
        rate-limiter.ts
    key-providers/
      index.ts
      local-dev-key-manager.ts
      hashicorp-vault-key-manager.ts
      sops-age-key-manager.ts
      aws-kms-key-manager.ts
    db/
      migrations/
      schema.sql
  tests/
    tokenize.test.ts
    detokenize-mfa.test.ts
    audit-chain-tamper.test.ts
    rate-limit.test.ts
    openapi-drift.test.ts
  docs/
    threat-model.md
    free-tier-runbook.md
    migration-from-raw-aadhaar.md
    frontend-integration.md
    operator-stories.md
```

Why each artifact matters:

| Artifact | Why it matters |
|---|---|
| `docker-compose.yml` | Reviewers run it in minutes. |
| `openapi.yaml` | Generated from schemas; CI ensures no drift. |
| `schema.sql` | Data model is explicit and auditable. |
| `tests/` | Tokenize, MFA, tamper-detection, rate-limit, OpenAPI drift. |
| `docs/threat-model.md` | Security posture honest and reviewable. |
| `docs/migration-from-raw-aadhaar.md` | Shows existing FLN records moving to tokens. |
| `docs/frontend-integration.md` | Tells FE team what to render. |
| `docs/operator-stories.md` | Per-provider operational reality. |

Keep the public name **Aadhaar Vault** for clarity. MVP may support `BIRTH_CERTIFICATE` as a child-enrollment fallback but should not extend to PAN / passport / ABHA / driving licence unless FLN maintainers explicitly request.

---

## 11. Concrete Code — `TokenizeAadhaar` Command

This is the **only** implementation sample in the doc. It exists to anchor every layer described above in real code so reviewers can argue with concrete artefacts instead of abstractions.

```ts
// src/application/commands/tokenize-aadhaar.ts

import crypto from 'node:crypto';
import type { KeyManager } from '../ports/key-manager';
import type { IdentityRepository } from '../ports/identity.repository';
import type { AuditRepository } from '../ports/audit.repository';
import type { EventPublisher } from '../ports/event-publisher';

export interface TokenizeAadhaarCommand {
  raw: string;
  type: 'AADHAAR' | 'BIRTH_CERTIFICATE';
  context: {
    actorId: string;
    actorRole: 'TEACHER' | 'SCHOOL_ADMIN' | 'STATE_ADMIN' | 'SUPER_ADMIN' | 'SERVICE';
    reason: string;
  };
}

export interface TokenizeAadhaarResult {
  token: string;
  last4: string;
  tokenType: string;
  auditId: string;
}

const SCHEMA_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';

export function makeTokenizeAadhaar(deps: {
  keyManager: KeyManager;
  identityRepo: IdentityRepository;
  auditRepo: AuditRepository;
  events: EventPublisher;
}) {
  return async function tokenizeAadhaar(
    cmd: TokenizeAadhaarCommand,
  ): Promise<TokenizeAadhaarResult> {
    // 1. Validate format
    if (cmd.type === 'AADHAAR' && !/^\d{12}$/.test(cmd.raw.replace(/\s/g, ''))) {
      throw new InvalidAadhaarFormat();
    }

    // 2. Generate envelope DEK through the KeyManager
    const ctx = Buffer.from(`tokenize:${cmd.context.actorId}`);
    const { plaintext: dek, wrapped, keyVersion } =
      await deps.keyManager.generateDataKey(ctx);

    try {
      // 3. Encrypt the raw number with the per-record DEK
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      const ciphertext = Buffer.concat([
        cipher.update(cmd.raw, 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      // 4. Generate an opaque token
      const token = `vlt_v1_${crypto.randomBytes(20).toString('base32')}`;

      // 5. Persist the record through the repository port
      await deps.identityRepo.save({
        token,
        tokenType: cmd.type,
        identityLast4: cmd.raw.slice(-4),
        ciphertext,
        iv,
        authTag: tag,
        wrappedDek: wrapped,
        algorithm: ALGORITHM,
        keyVersion,
        schemaVersion: SCHEMA_VERSION,
        status: 'ACTIVE',
        createdBy: cmd.context.actorId,
      });

      // 6. Append the audit event
      const auditId = await deps.auditRepo.append({
        eventType: 'TOKENIZE',
        token,
        actorId: cmd.context.actorId,
        actorRole: cmd.context.actorRole,
        reason: cmd.context.reason,
        mfaVerified: false,
      });

      // 7. Publish the domain event (in-process for v0.1)
      await deps.events.publish({
        type: 'AadhaarTokenized',
        token,
        last4: cmd.raw.slice(-4),
        actorId: cmd.context.actorId,
      });

      return {
        token,
        last4: cmd.raw.slice(-4),
        tokenType: cmd.type,
        auditId,
      };
    } finally {
      // 8. Zero the DEK from memory
      dek.fill(0);
    }
  };
}

class InvalidAadhaarFormat extends Error {
  readonly code = 'INVALID_AADHAAR_FORMAT';
}
```

**What this code demonstrates:**
- The four ports (`KeyManager`, `IdentityRepository`, `AuditRepository`, `EventPublisher`) are injected — adapters are swappable.
- The DEK plaintext is zeroed in a `finally` block.
- The audit chain is appended with `actorId`, `reason`, and `mfaVerified: false` (no MFA needed for tokenize).
- Domain event publishing is fire-and-forget within the request lifecycle.
- Errors are typed (`INVALID_AADHAAR_FORMAT` becomes a `400`).

A reviewer who reads this code plus the four interface files (≤200 lines total) has understood the entire tokenization subsystem.

---

## 12. Revised Free-Tier Cost Matrix

| Mode | Monthly cost | External accounts | Suitable for |
|---|---:|---|---|
| Local Docker Compose | 0 | None | Development, review, demo, CI |
| Institute lab VM | 0 | None if VM provided | Shared pilot |
| Free cloud VM + local PostgreSQL | 0 | Cloud VM account | Small field pilot |
| Free cloud VM + free managed PostgreSQL | 0 | Cloud VM + DB account | Pilot with easier DB ops |
| Production KMS + managed PostgreSQL | Paid | Cloud / institution accounts | Real production |

The honest takeaway: **zero-cost is achievable for development and small pilots, but the architecture must not depend on any single free vendor staying generous.** The "production-grade on ₹0/month" framing in earlier drafts was overclaim; this doc corrects it.

---

## 13. Migration Plan from Current FLN Storage

1. **Add fields** to the student collection/table:
   - `identityToken` (string, unique, nullable)
   - `identityLast4` (string)
   - `identityType` (enum: `AADHAAR`, `BIRTH_CERTIFICATE`, etc.)
   - `identitySource` (string — which system recorded it)
   - `identityVerifiedAt` (timestamp)

2. **Add a backend helper** (in FLN backend):
   ```ts
   async function tokenizeIdentity(
     raw: string,
     type: 'AADHAAR' | 'BIRTH_CERTIFICATE',
     context: TokenizeContext,
   ) {
     return vaultClient.post('/v1/tokenize', { raw, type, context });
   }
   ```

3. **New enrollments** call Vault before writing the student record.

4. **Existing records** get a one-time migration:
   - Read raw Aadhaar from existing row.
   - Call `/v1/tokenize`.
   - Update row with `identityToken`, `identityLast4`, `identityType`.
   - Null out raw `aadhaar` field.
   - Append a `MIGRATE` audit event with row count and operator ID.

5. **Block future raw writes** via schema validation, lint rules, and a CI test that scans fixtures for 12-digit sequences:
   ```ts
   // tests/ci/no-raw-aadhaar-in-fixtures.test.ts
   const fixtures = await glob('Database/test.*.json');
   for (const file of fixtures) {
     const content = await readFile(file, 'utf8');
     const matches = content.match(/\b\d{12}\b/g) || [];
     expect(matches).toEqual([]);  // any 12-digit run = test fail
   }
   ```

### Idempotency policy — requirements decision

Whether tokenize is idempotent (same Aadhaar across multiple schools returns the same token) or always mints a new token is a **requirements decision** with privacy implications. The Vault does not enforce idempotency by default; the policy is set by FLN maintainers and may differ by mode:
- **Strictly locality-preserving:** every school gets its own token, even for the same Aadhaar (preserves cross-school unlinkability but wastes storage).
- **Identity-preserving:** same Aadhaar everywhere → same token (saves storage and enables cross-school re-detection, e.g., for transfer students).

This is a question for the requirements session, not the architecture review.

---

## 14. Implementation Milestones

Total realistic timeline: **12–18 focused days** (6–8 days for demonstrable prototype + 6–10 days for pilot hardening).

| Milestone | Days (prototype) | Days (pilot-grade) | Deliverable |
|---|---:|---:|---|
| **M1** Reference stack | 1 | 2 | docker-compose, health endpoint, migrations applied. |
| **M2** Tokenization core | 2 | 4 | Tokenize + lookup + crypto adapter + 4 tests. |
| **M3** Detokenize controls | 2 | 4 | JWT auth, TOTP, reason enforcement, RBAC. |
| **M4** Audit integrity | 1 | 2 | HMAC chain, tamper test, FreeTSA/Polygon anchoring. |
| **M5** Frontend + FE doc | 0 | 1 | Frontend integration spec + sample component. |
| **M6** FLN integration | 1 | 2 | Backend helper, migration script, no-raw-fixtures test. |
| **M7** Hardening | — | 3 | Rate limits, MFA edge cases, JWKS rotation, real test coverage. |
| **M8** Documentation | 1 | 1 | Threat model, runbook, OpenAPI, contributor guide, ADRs, compliance mapping. |

Days are focused engineering days (4–6 productive hours), not calendar days.

### 14.1 CI/CD Minimum Pipeline

A pilot-ready repo should have at minimum:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
      - run: npx tsc --noEmit
      - run: npx eslint .
  docker:
    runs-on: ubuntu-latest
    steps:
      - run: docker compose up --abort-on-container-exit --exit-code-from test
  openapi:
    runs-on: ubuntu-latest
    steps:
      - run: npx tsx scripts/export-openapi.ts > openapi.gen.yaml
      - run: diff openapi.yaml openapi.gen.yaml
  fixtures-scan:
    runs-on: ubuntu-latest
    steps:
      - run: npx tsx tests/ci/no-raw-aadhaar-in-fixtures.test.ts
```

Adding concurrency controls, code coverage reporting, and security audit (`npm audit`) is straightforward.

---

## 15. Daily Operations

### 15.1 Backup Encryption Strategy

Daily, full backup of vault_tokens + audit_events + mfa_factors + key_metadata, encrypted with `age`:

```bash
# backup.sh — runs nightly at 02:00 via cron
BACKUP_DIR=/var/backups/aadhaar-vault
mkdir -p $BACKUP_DIR && chmod 700 $BACKUP_DIR
DATE=$(date +%Y%m%d-%H%M%S)

# Dump full DB
pg_dump --no-owner --format=plain \
  --file=$BACKUP_DIR/$DATE.sql \
  $VAULT_DB_URI

# Compress and encrypt with age (recipient = institutional backup key)
tar -czf - $BACKUP_DIR/$DATE.sql | \
  age -r age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
      > $BACKUP_DIR/$DATE.tar.gz.age

# Remove plaintext
shred -u $BACKUP_DIR/$DATE.sql

# Push to backup target (institute storage or MinIO)
aws s3 cp $BACKUP_DIR/$DATE.tar.gz.age \
  s3://fln-vault-backups/$(date +%Y/%m/%d)/

# Retain 7 years per DPDP "reasonable period"
find $BACKUP_DIR -name "*.age" -mtime +2555 -delete
```

**Restore procedure:**

```bash
# Restore drill (run monthly to verify)
age -d -i /path/to/age-key.txt $BACKUP_DIR/$DATE.tar.gz.age | \
  tar -xzf -

psql $VAULT_DB_URI < $BACKUP_DIR/$DATE.sql
```

### 15.2 Witness Anchoring

Daily at 23:59 IST, anchor the latest audit `current_hash` to FreeTSA:

```bash
# witness.sh — daily
LAST_HASH=$(psql $VAULT_DB_URI -t -c \
  "SELECT current_hash FROM audit_events ORDER BY sequence_id DESC LIMIT 1")
TODAY=$(date +%Y-%m-%d)

# Submit hash digest to FreeTSA
openssl dgst -sha256 -binary <<<"$LAST_HASH" | base64 > /tmp/digest.b64
curl -s "https://freetsa.org/tsr" \
  -H "Content-Type: application/timestamp-query" \
  --data-binary @/tmp/digest.b64 \
  -o /var/lib/aadhaar-vault/witnesses/$TODAY.tsr

# In Mode C: replace with Polygon transaction
# polygonscan.com/tx/0x... becomes the public anchor
```

### 15.3 Audit Chain Verification

Daily, verify the chain integrity (cron):

```ts
// scripts/verify-audit-chain.ts
import { Pool } from 'pg';
import crypto from 'node:crypto';

const pool = new Pool({ connectionString: process.env.VAULT_DB_URI });

(async () => {
  const { rows } = await pool.query(`
    SELECT sequence_id, event_id, event_type, token, actor_id, actor_role,
           reason, source_ip, user_agent, mfa_verified, previous_hash,
           canonical_payload, current_hash, created_at
      FROM audit_events
     ORDER BY sequence_id ASC
  `);

  let prev = 'GENESIS';
  let broken: string[] = [];

  for (const row of rows) {
    const canon = JSON.stringify({
      sequence_id: row.sequence_id.toString(),
      event_id: row.event_id,
      event_type: row.event_type,
      token: row.token,
      actor_id: row.actor_id,
      actor_role: row.actor_role,
      reason: row.reason,
      source_ip: row.source_ip,
      user_agent: row.user_agent,
      mfa_verified: row.mfa_verified,
      previous_hash: row.previous_hash,
      created_at: row.created_at.toISOString(),
    });

    const expected = crypto
      .createHmac('sha256', process.env.AUDIT_KEY!)
      .update(canon)
      .digest('hex');

    if (row.previous_hash !== prev || row.current_hash !== expected) {
      broken.push(`sequence_id=${row.sequence_id}`);
    }
    prev = row.current_hash;
  }

  if (broken.length > 0) {
    console.error('BROKEN:', broken);
    process.exit(1);
  }
  console.log('OK', rows.length, 'rows verified');
})();
```

If the verifier exits non-zero: **stop investigating and file a compliance incident.** Do not edit rows to repair the chain.

### 15.4 Lost-Phone / MFA Recovery

1. **Backup codes.** On enrollment, print 10 backup codes on paper. Each is single-use.
2. **Backup code path:** `POST /v1/detokenize` with `mfaProof: "<code>"` (mode flag in payload). Code is hashed + marked-used.
3. **Exhausted backup codes:** super-admin calls `POST /v1/admin/mfa-reset` with `reason` and `ticketId`. Returns fresh `otpauth://` URI; teacher scans with new phone.
4. **Lost admin phone:** 3-of-5 paper backup codes stored separately; quorum unseal via `sops-age` (Mode B) or institutional key escrow (Mode C).

### 15.5 Key Rotation

Per KeyManager provider:

| Provider | Rotation cadence | Procedure |
|---|---|---|
| `local-dev` | As needed | Update `KEY_VERSION` in `.env` + bounce |
| `hashicorp-vault` | Annual | `vault write -f fln/transit/keys/aadhaar-master/rotate`; existing wrapped DEKs auto-decrypt with old version |
| `sops-age` | Annual | Generate new age recipient, re-encrypt master key, redeploy |
| `aws-kms` | Automatic | AWS-managed; alias updates handled by IAM |

Rotation is itself an audit event (`KEY_ROTATE`) recorded in `audit_events` and `key_metadata`.

---

## 16. Architecture Decision Records

Three starter ADRs live under `docs/adr/`:

### 16.1 `0001-postgres-over-mongodb.md`

**Status:** Accepted, 2025.

**Context.** The Vault needs durable storage for opaque tokens, an append-only audit log with cryptographic chaining, and SQL-queryable reporting for compliance. The rest of FLN uses MongoDB.

**Decision.** Use PostgreSQL for the Vault's storage, independent of FLN's MongoDB. Treat them as separate persistence contexts that happen to live in the same project.

**Consequences.**
- (+) PostgreSQL's transactional append + `BIGSERIAL` give us ordering and atomic chain integrity for free.
- (+) Contributors can `docker compose up` without cloud accounts.
- (+) SQL reporting is the universal compliance query language.
- (-) Adds a second DB to the FLN stack; future contributors must understand both.
- (-) MongoDB adapter still exists for projects that need it, increasing test surface.

**Alternatives considered.**
- MongoDB only — sets us against the audit append + verification tooling.
- Cloud-managed Postgres (RDS/Neon) — requires account; defeats Mode A goal.

### 16.2 `0002-pluggable-keymanager.md`

**Status:** Accepted, 2025.

**Context.** Different deployment modes have different key custody requirements. A reference implementation needs a developer-friendly default; pilots often lack a managed KMS; production must be HSM-backed.

**Decision.** Define a `KeyManager` port with four adapters:
- `LocalDevKeyManager` (Mode A; refuses real PII)
- `HashiCorpVaultKeyManager` (Mode B; software isolation + optional HSM seal)
- `SopsAgeKeyManager` (Mode B with manual custody)
- `AwsKmsKeyManager` (Mode C; HSM-backed)

Selection via `KEY_PROVIDER` env var. Adapters are independent and testable in isolation.

**Consequences.**
- (+) Migration from Mode A → Mode C is a config change, not a code rewrite.
- (+) Provider swap is testable without touching domain logic.
- (-) Each adapter must be implemented and tested independently.

### 16.3 `0003-lightweight-cqs-cqrs-inspired.md`

**Status:** Accepted, 2025.

**Context.** The Vault's write path (tokenize, detokenize, revoke) is heavily audited and lives under policy gates. The read path (lookup, audit-history, health) is simpler and not audited. Separating them clarifies the system.

**Decision.** Adopt "Lightweight Command/Query Separation (CQRS-inspired)" — folders split into `application/commands/` and `application/queries/`. Each path has its own handler. The database remains a single PostgreSQL instance. This is **not** distributed CQRS: no separate read database, no projection workers, no event-sourcing pre-requisite.

**Consequences.**
- (+) Domain rules (purpose, MFA, rate limits) live in command handlers, clearly audit-eligible.
- (+) Query handlers stay minimal — easy to cache and protect with simple rate limits.
- (-) Adds folder structure to read for a small system; visible overhead.
- (-) The "CQRS" label invites reviewer questions we must answer up-front.

---

## 17. Compliance Mapping

### 17.1 DPDP Act 2023

| Section | Requirement | Design element | Where it lives |
|---|---|---|---|
| §4 | Personal data handling with consent | Tokenization replaces raw storage with opaque handle | `tokenize-aadhaar.ts`, `identity_tokens.token` |
| §6 | Notice of data collection | Migration script emits audit event with purpose and operator | `audit_events.event_type = 'MIGRATE'` |
| §8 | Reasonable security practices | Envelope encryption + KeyManager abstraction + audit chain | `KeyManager` port, all adapters |
| §10 | Right of access | "Show audit history for my Aadhaar" endpoint | `queries/read-audit-history.ts` |
| §11 | Purpose limitation + retention | `reason` required on every detokenize; audit row stores it | `commands/detokenize-aadhaar.ts` |
| §12 | Erasure | `POST /v1/revoke` marks tokens inactive (database-row, not deletion) | `commands/revoke-aadhaar-token.ts` |
| §17 | Breach notification | FreeTSA/Polygon witness + daily integrity check | `scripts/verify-audit-chain.ts`, `witness.service.ts` |
| §22 | Significant data fiduciary obligations | Compliance mapping table (this section) and ADRs | This document |

### 17.2 Aadhaar Act 2016

| Section | Requirement | Design element | Where it lives |
|---|---|---|---|
| §4(3) | Aadhaar not required for services | Vault does not gate any FLN feature on Aadhaar presence | FLN backend level |
| §29 | Display restrictions (only last 4 visible) | `lookup` returns `XXXX-XXXX-${last4}` only | `routes/lookup.routes.ts` |
| §29(2) | No display, broadcast, or publication | Frontend modal auto-clears after 30s; copy-paste disabled by default | `docs/frontend-integration.md` |
| §40 | Civil penalties for unauthorized disclosure | MFA + reason required for every detokenize | `commands/detokenize-aadhaar.ts` |

### 17.3 RTE Act 2009

| Section | Requirement | Design element | Where it lives |
|---|---|---|---|
| §31(2) | No capitation fee; no screening | Vault doesn't store sensitive personal info on the student record | FLN backend schema |
| Child identity protection (general) | Minimize collection of identity numbers for minors | Tokenize at enrollment; FLN DB never sees raw Aadhaar | Migration script §13 |

### 17.4 STQC / MeitY Guidelines for Government Identity

- **Storage encryption at rest:** ✅ AES-256-GCM with envelope encryption (Kafka-style DEK+master).
- **Key rotation:** ✅ Annual ceremony logged as audit event.
- **Audit log tamper-evidence:** ✅ HMAC chain + external witness (FreeTSA/Polygon).
- **Reason for access:** ✅ `reason` mandatory on detokenize.
- **MFA for elevated operations:** ✅ TOTP + backup codes.

---

## 18. Closing Note

This v0.2 corrects the overclaims and under-specifications of v0.1 while keeping the core promise: **FLN stores tokens, not raw Aadhaar.** The architecture is now:

- **Reproducible** for reviewers (`docker compose up` in 5 minutes).
- **Modular** for swapping infra (KeyManager + storage are ports).
- **Honest** about free-tier limits (zero-cost for development; institutional review required for production).
- **Auditable** for compliance (STRIDE + ADRs + DPDP mapping).
- **Operationable** for real pilots (operator stories + rate limits + witness strategy + CI/CD).

Two final notes for the team:

1. **What this doc is not:** a deployment runbook (see `AADHAAR_VAULT_FREE_DEPLOY.md`). This is the **architecture**; that file is **ops**. Keep them in sync — when the architecture changes (e.g., a new KeyManager provider), update both.

2. **What the doc is for:** institutional review. A reviewer at a state education department or a partner NGO should be able to read this document, find their relevant clause in §17 (Compliance Mapping), click through to the referenced file, and verify the claim in minutes.

---

*Document version: v0.2 · Authors: Aadhaar Vault architecture team · Companion: `AADHAAR_VAULT.md` (design + working stub), `AADHAAR_VAULT_FREE_DEPLOY.md` (30-min ops runbook) · Reviewers welcome — please file issues with concrete section references.*