# Aadhaar Vault — Privacy-Preserving Identity Tokenization Microservice

> **Status:** Proposed microservice. Independent of the FLN backend rebuild. Self-contained at `microservices/aadhaar-vault/`.
> **Tagline:** *"Stop storing Aadhaar. Store opaque tokens. Detokenize only with audit. Survive any backend rewrite."*

---

## 📑 Table of Contents

1. [What is the Aadhaar Vault?](#1-what-is-the-aadhaar-vault)
2. [Why FLN Needs It — The Compliance Gap Today](#2-why-fln-needs-it--the-compliance-gap-today)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [How It Works — End-to-End Architecture](#4-how-it-works--end-to-end-architecture)
5. [Token Lifecycle (The Core Idea)](#5-token-lifecycle-the-core-idea)
6. [API Contract](#6-api-contract)
7. [Data Model](#7-data-model)
8. [Security & Cryptography Model](#8-security--cryptography-model)
9. [Audit Trail](#9-audit-trail)
10. [Role-Based Access Matrix](#10-role-based-access-matrix)
11. [Integration with the Current FLN Repo](#11-integration-with-the-current-fln-repo)
12. [Survival Plan Across the FLN Backend Rebuild](#12-survival-plan-across-the-fln-backend-rebuild)
13. [Folder & File Layout](#13-folder--file-layout)
14. [Effort Estimation & Milestones](#14-effort-estimation--milestones)
15. [Legal & Compliance Mapping](#15-legal--compliance-mapping)
16. [Failure Modes & Mitigations](#16-failure-modes--mitigations)
17. [Open Questions / Risks](#17-open-questions--risks)
18. [References](#18-references)
19. [Identity-System Independence Strategy](#19-identity-system-independence-strategy)
20. [Forward-Compatibility Roadmap](#20-forward-compatibility-roadmap)
21. [How the Vault Works — Technical Deep-Dive](#21-how-the-vault-works--technical-deep-dive)
22. [Two-Track Identity Architecture (DigiLocker + Vault)](#22-two-track-identity-architecture-digilocker--vault)

---

## 1. What is the Aadhaar Vault?

The **Aadhaar Vault** is a **standalone microservice** that becomes the **single source of truth** for handling Aadhaar numbers, Aadhaar last-4 digits, Birth Certificate numbers, and any other government-issued identity number within the FLN ecosystem.

Instead of every other service storing a *raw* (even if masked) Aadhaar number, it stores an **opaque, irreversible-by-design token**. To convert the token back to a usable number, a caller must:

1. Authenticate as a permitted principal (Superadmin, with time-bound token, optional MFA).
2. State the reason.
3. Get logged in an immutable audit chain.

**The Vault itself** is the **only** component in the entire FLN system that holds the **detokenization key** — and that key lives inside an **HSM-backed KMS**, never in application memory for more than a single signed request.

### What problem does "tokenization" solve?

Today (and after most rebuilds), systems solve identity protection with **masking** — replacing `1234-5678-9012` with `XXXX-XXXX-9012`. This is **cosmetic**: the unmasked number is still in the database. Anyone with DB access (an ops engineer, a leaked backup, a Mongo dump) gets the full number.

**Tokenization is fundamentally different.** The number is **replaced** with a cryptographic token:

```
Raw Aadhaar:        1234-5678-9012   ← NEVER persisted in any other service
Vault Token:        vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7   ← what everyone else stores
Vault Token (last-4 lookup): vlt_l4_2c9f   ← what even read-only services store
```

To turn `vlt_8f3a91...` back into `1234-5678-9012` requires:
- Access to the Vault's KMS-wrapped master key.
- A valid signed request with reason.
- A logged audit row that survives Vault destruction.

---

## 2. Why FLN Needs It — The Compliance Gap Today

### 2.1 Existing repo state (inventory)

| Where | What it does | Gap |
|---|---|---|
| `backend/src/index.ts` (god file) | Masks Aadhaar in API responses for non-superadmin roles | Masking only — raw number still in DB |
| `frontend/src/components/RoleDashboards.tsx` | Renders masked Aadhaar in student table | UI masks — backend still stores raw |
| `Database/test.students.json` | Sample data shows raw Aadhaar numbers | Dev data — not masked at all |
| `feature_idea.md §2` (existing) | Proposes an **Aadhaar access audit log** | Logs *who looked* but doesn't tokenize |
| `database_design.md` | Shows Aadhaar as a `student` collection field | Plain string field, no encryption envelope |
| `Research/National_status_report.md` | Notes ~22% Aadhaar-less children in target districts | Birth-cert fallback path is loose |

### 2.2 What PRD / SRS / RTE require

From **`PRD.md`**:
- §7 *"Identity is mandatory & protected. Aadhar/Birth Certificate number is a unique student key, masked for every role except Superadmin."*
- §9 *"Audit/Compliance: immutable logbook, 3-year retention, RTE Act 2009 alignment."*

From **`SRS.md`**:
- §13.2 *"Governance & access control — all access to PII must be auditable."*

From external law (the actual binding requirements):
- **Right of Children to Free and Compulsory Education (RTE) Act, 2009, §3(c)** — child identity protection as a state obligation.
- **Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016, §29** — Aadhaar data must not be published, displayed, or shared except as permitted.
- **Digital Personal Data Protection Act (DPDP), 2023, §8 + §9** — Data Fiduciary must protect personal data; significant data breach triggers penalties up to ₹250 Cr.
- **Information Technology (Reasonable Security Practices) Rules, 2011** — Sensitive personal data must be protected with encryption + access controls.

### 2.3 Why the rebuild alone won't fix this

The new backend team will, by default, do what the old one did — **mask in app code**. Because:

1. Tokenization requires KMS / HSM integration — infra work product teams defer.
2. They have no precedent in repo for tokenization patterns.
3. The migration cost (rewriting every student insert/update) is invisible until audit time.

So the **Vault becomes a safety net** that the new team can either:
- ✅ Adopt (use it via REST from day 1) — compliance for free, OR
- ✅ Bypass (store raw + mask in code) — but then the Vault sits alongside as **proof-of-better-practice**, ready to absorb migration when they're ready.

Either way, **the Vault is never obsolete**.

---

## 3. Goals & Non-Goals

### ✅ Goals

| # | Goal |
|---|---|
| G1 | Eliminate raw Aadhaar / Birth Cert numbers from every non-Vault service. |
| G2 | Detokenize only via signed, audited, time-bound calls. |
| G3 | Survive the FLN backend rebuild (no shared schema, no shared code). |
| G4 | Comply with RTE 2009, Aadhaar Act 2016 §29, DPDP Act 2023. |
| G5 | Provide a clean migration path so other services can swap raw → token without downtime. |
| G6 | Be auditable from day 1 — every detokenize is logged in a tamper-evident chain. |

### ❌ Non-Goals

| # | Non-goal |
|---|---|
| N1 | **Not** an authentication service — Vault does not decide *who you are*; it trusts the existing JWT (or a service token). |
| N2 | **Not** an authorization service — Vault does not store user roles; it trusts the JWT claim. |
| N3 | **Not** a backup service — Vault is the source of truth for tokens, but does not backup your application data. |
| N4 | **Not** an analytics service — Vault does not query on raw identity; it serves tokens only. |
| N5 | **Not** a feature for *question generation*, *UI*, or *pedagogy*. It is invisible infra. |
| N6 | **Not** a replacement for Aadhaar eKYC / OTP flows — it does not interact with UIDAI directly. |

---

## 4. How It Works — End-to-End Architecture

### 4.1 Component map

```
┌────────────────────────────────────────────────────────────────────┐
│                   FLN ecosystem (any service)                      │
│                                                                    │
│   Frontend (Volunteer/Teacher/School Admin UI)                     │
│   ┌──────────────────────────┐                                     │
│   │ EmbeddedAadhaarMask.tsx  │  ← 1 new file in frontend           │
│   │ (calls /api/vault/lookup)│                                     │
│   └────────────┬─────────────┘                                     │
│                │ HTTPS + JWT                                       │
│                ▼                                                   │
│   Backend Service (Express/Fastify/whatever the new team builds)   │
│   ┌──────────────────────────┐                                     │
│   │ POST /api/students       │  ← now stores vault token,          │
│   │   body: {                │    NOT raw Aadhaar                  │
│   │     aadhaarToken:        │                                     │
│   │      "vlt_8f3a91..."     │                                     │
│   │   }                      │                                     │
│   └────────────┬─────────────┘                                     │
│                │ HTTPS + service token                             │
└────────────────┼───────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│         Aadhaar Vault Microservice (standalone, port 4101)         │
│                                                                    │
│   ┌──────────────────────┐                                         │
│   │  Public API          │  POST /tokenize, /detokenize,           │
│   │  (Fastify/Express)   │  /lookup, /rotate-key, /audit           │
│   └──────────┬───────────┘                                         │
│              │                                                     │
│              ▼                                                     │
│   ┌──────────────────────┐                                         │
│   │  Crypto Engine       │  AES-256-GCM envelope encryption       │
│   │  (libsodium / node-  │  + token-formatting (vlt_<base32>)     │
│   │   crypto)            │  + KMS-wrapped DEK                    │
│   └──────────┬───────────┘                                         │
│              │                                                     │
│              ▼                                                     │
│   ┌──────────────────────┐                                         │
│   │  Mongo (isolated)    │  vault_tokens collection               │
│   │  vault_tokens        │  vault_audit_log (immutable chain)     │
│   └──────────────────────┘                                         │
│                                                                    │
│              │ AWS KMS / GCP KMS / Azure Key Vault                 │
│              ▼                                                     │
│   ┌──────────────────────┐                                         │
│   │  Cloud KMS / HSM     │  Master key NEVER leaves KMS            │
│   │  (key wrapping)      │  Wraps per-instance DEKs                │
│   └──────────────────────┘                                         │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tokenization flow (high level)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FLOW 1: First-time student registration                              │
└──────────────────────────────────────────────────────────────────────┘

[Volunteer UI]  ──► [FLN Backend: POST /api/students]
                         │
                         │ body: { name, class, aadhaar: "1234-5678-9012", ... }
                         ▼
                  [FLN Backend: BEFORE storing, call Vault]
                         │
                         │ POST https://vault.local/api/vault/tokenize
                         │   headers: Authorization: Bearer <service-token>
                         │   body: { raw: "1234-5678-9012", type: "AADHAAR",
                         │           context: { actorId, schoolId, reason: "student-register" } }
                         ▼
                  ┌─────────────────────────────────────┐
                  │  Aadhaar Vault                      │
                  │  1. validate JWT                    │
                  │  2. AES-encrypt raw + salt          │
                  │  3. wrap DEK via KMS                │
                  │  4. generate token: vlt_<base32>    │
                  │  5. store {token, ciphertext, dek_wrapped,
                  │           type, created_at, created_by}
                  │  6. log audit row (tokenize event)  │
                  │  7. return {token: "vlt_8f3a...",
                  │           tokenLast4: "vlt_l4_2c9f"}│
                  └─────────────┬───────────────────────┘
                                │
                                ▼
                  [FLN Backend receives tokens]
                  Replaces aadhaar field with tokens
                  Stores student record in Mongo (no raw Aadhaar)
                  Returns to Volunteer UI: "Student added"


┌──────────────────────────────────────────────────────────────────────┐
│  FLOW 2: Superadmin needs to look up a real Aadhaar (rare)          │
└──────────────────────────────────────────────────────────────────────┘

[Superadmin UI] ──► [FLN Backend: GET /api/students/:id/aadhaar]
                         │
                         │ Authorization: Bearer <superadmin JWT>
                         │ X-Request-Reason: "Parent verified identity at school office"
                         ▼
                  [FLN Backend: forward to Vault]
                         │
                         │ POST https://vault.local/api/vault/detokenize
                         │   headers:
                         │     Authorization: Bearer <superadmin JWT>
                         │     X-Request-Reason: "Parent verified identity"
                         │     X-MFA-Token: 884231   ← TOTP step-up
                         │   body: { token: "vlt_8f3a..." }
                         ▼
                  ┌─────────────────────────────────────────┐
                  │  Aadhaar Vault                           │
                  │  1. validate JWT (Superadmin role)      │
                  │  2. validate X-Request-Reason (not empty,│
                  │     not in blocklist)                   │
                  │  3. validate X-MFA-Token (TOTP)         │
                  │  4. lookup token                        │
                  │  5. unwrap DEK via KMS                   │
                  │  6. AES-decrypt                         │
                  │  7. log audit row (detokenize event)    │
                  │  8. return { raw: "1234-5678-9012",     │
                  │           auditId: "aud_91a2..." }      │
                  └─────────────┬───────────────────────────┘
                                │
                                ▼
                  [FLN Backend logs the auditId with the request,
                   returns to Superadmin UI]
                  Superadmin sees the real number ONCE.
                  Audit log records: who, when, why, which token.


┌──────────────────────────────────────────────────────────────────────┐
│  FLOW 3: Routine read — display masked in UI                          │
└──────────────────────────────────────────────────────────────────────┘

[Volunteer UI] ──► [FLN Backend: GET /api/students/:id]
                         │
                         │ Returns student record.
                         │ The aadhaarToken field is "vlt_8f3a..."
                         │ Frontend never calls /detokenize.
                         │ Instead calls:
                         ▼
                  GET https://vault.local/api/vault/lookup/vlt_8f3a...
                  ┌─────────────────────────────────────────┐
                  │  Aadhaar Vault                           │
                  │  1. validate JWT (any authenticated)    │
                  │  2. lookup token                        │
                  │  3. log audit row (lookup event,        │
                  │     type = MASKED-READ)                 │
                  │  4. return { masked: "XXXX-XXXX-9012",  │
                  │           tokenLast4: "vlt_l4_2c9f" }   │
                  └─────────────┬───────────────────────────┘
                                │
                                ▼
                  [Volunteer UI displays masked, no detokenize happened.]
```

### 4.3 What "irreversible-by-design" means

A Vault token looks like:
```
vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7
^   ^                                ^
│   │                                └─ 32-char base32 random suffix
│   └─ version + type encoded (1 byte)
└─ prefix
```

The token is:
- **Random** — not derived from the raw number.
- **Unique** — same raw number tokenized twice yields two different tokens (one-time tokens) if salt differs; or one stable token + per-version rotation if salt is fixed.
- **Not reversible without the key** — without the KMS-wrapped DEK, even with DB access, the ciphertext is unintelligible.

Even if Vault's DB is leaked, attacker gets ciphertext + wrapped DEKs. Unwrap requires KMS access. Without that, attacker has a useless blob.

---

## 5. Token Lifecycle (The Core Idea)

```
                  ┌─────────────────────┐
                  │   Raw Aadhaar       │
                  │   1234-5678-9012    │
                  │   (input from UI)   │
                  └──────────┬──────────┘
                             │
                             │ tokenize()
                             ▼
                  ┌─────────────────────┐
                  │  Vault Token        │
                  │  vlt_8f3a91b2...    │   ◄── stored in app DB
                  │  vlt_l4_2c9f        │   ◄── last-4 (read-only safe)
                  └──────────┬──────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
        ┌─────────▼──────┐    ┌─────────▼──────┐
        │  Read-only     │    │  Full          │
        │  services      │    │  detokenize    │
        │  (Volunteer,   │    │  (Superadmin,  │
        │   Teacher)     │    │   with MFA)    │
        │                │    │                │
        │  GET /lookup   │    │  POST          │
        │                │    │  /detokenize   │
        │  Returns       │    │                │
        │  masked        │    │  Returns raw   │
        │  + last-4      │    │  + auditId     │
        └────────────────┘    └────────┬───────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Audit row          │
                            │  aud_91a2...        │
                            │  who, when, why,    │
                            │  which token,       │
                            │  signed by KMS      │
                            │  (tamper-evident    │
                            │   chain)            │
                            └─────────────────────┘
```

### Token states

| State | Meaning | Can read raw? |
|---|---|---|
| `ACTIVE` | Currently valid, can be looked up / detokenized | Yes (with permission) |
| `REVOKED` | Marked unusable (e.g., student withdrew consent) | No — returns 410 Gone |
| `TOMBSTONED` | Raw was deleted per DPDP retention; ciphertext retained for audit | No — only audit lookup works |
| `ROTATED` | A new DEK was wrapped (after key rotation); old ciphertexts re-wrapped lazily | Yes (with permission) |

---

## 6. API Contract

All endpoints require `Authorization: Bearer <jwt-or-service-token>` unless marked `[Public]`. All write endpoints require `Content-Type: application/json`. All responses are JSON.

### 6.1 `POST /api/vault/tokenize`

**Purpose:** Convert raw identity → opaque token.

**Auth:** Service token (from a registered FLN service), or Superadmin.

**Request:**
```json
{
  "raw": "1234-5678-9012",
  "type": "AADHAAR" | "BIRTH_CERTIFICATE" | "OTHER_GOVT_ID",
  "context": {
    "actorId": "user_abc123",
    "actorRole": "VOLUNTEER",
    "schoolId": "AP_GNT_01_01",
    "reason": "student-register"
  },
  "options": {
    "stable": false,
    "rotationPolicy": "DEFAULT"
  }
}
```

**Response (200):**
```json
{
  "token": "vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7",
  "tokenLast4": "vlt_l4_2c9f",
  "tokenType": "AADHAAR",
  "createdAt": "2026-07-20T15:30:00.123Z",
  "auditId": "aud_91a2f3e4..."
}
```

**Errors:**
- `400 INVALID_INPUT` — raw does not match Aadhaar regex, or type invalid.
- `401 UNAUTHENTICATED` — no token.
- `403 FORBIDDEN` — caller role lacks tokenize scope.
- `409 DUPLICATE` — same raw + stable=true already tokenized (returns existing token).
- `429 RATE_LIMITED` — caller exceeded 100/min.

---

### 6.2 `POST /api/vault/detokenize`

**Purpose:** Convert opaque token → raw identity. **Heavily gated.**

**Auth:** Superadmin only. Requires:
- JWT with `role: SUPERADMIN` claim.
- `X-Request-Reason` header (free-text, must pass content filter — no PII, no profanity).
- `X-MFA-Token` header (TOTP code, validated against per-user secret).
- Time-bound: token must be used within 60 seconds of issuance (e.g., step-up flow).

**Request:**
```json
{
  "token": "vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7",
  "context": {
    "purpose": "Parent verified identity at school office",
    "ticketId": "tic_7719...",
    "evidenceUrl": "https://docs.fln.org/visit-photos/abc.jpg"
  }
}
```

**Response (200):**
```json
{
  "raw": "1234-5678-9012",
  "type": "AADHAAR",
  "tokenCreatedAt": "2026-07-20T15:30:00.123Z",
  "auditId": "aud_91a2f3e4...",
  "warning": "This response is the ONLY place raw identity is exposed. Do not log, store, or display in non-encrypted form."
}
```

**Errors:**
- `401 UNAUTHENTICATED`.
- `403 MFA_REQUIRED` / `403 REASON_REJECTED` / `403 FORBIDDEN`.
- `410 GONE` — token is REVOKED or TOMBSTONED.

---

### 6.3 `GET /api/vault/lookup/:token`

**Purpose:** Get masked display info **without** detokenizing.

**Auth:** Any authenticated FLN role (volunteer, teacher, school admin, etc.). Even read-only is logged.

**Response (200):**
```json
{
  "token": "vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7",
  "tokenType": "AADHAAR",
  "masked": "XXXX-XXXX-9012",
  "tokenLast4": "vlt_l4_2c9f",
  "status": "ACTIVE" | "REVOKED" | "TOMBSTONED" | "ROTATED",
  "createdAt": "2026-07-20T15:30:00.123Z",
  "auditId": "aud_72b1..."
}
```

**Errors:**
- `401 UNAUTHENTICATED`.
- `404 NOT_FOUND` — token unknown.

---

### 6.4 `POST /api/vault/revoke`

**Purpose:** Mark a token unusable (e.g., student withdrew consent per DPDP §6).

**Auth:** Superadmin OR (Volunteer + token belongs to their assigned school).

**Request:**
```json
{
  "token": "vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7",
  "reason": "Parent withdrew consent per DPDP §6 right-to-erasure request",
  "evidence": "ticket:tic_7719"
}
```

**Response (200):**
```json
{
  "token": "vlt_8f3a91...",
  "status": "REVOKED",
  "revokedAt": "2026-07-20T15:45:00.000Z",
  "auditId": "aud_b3c4..."
}
```

---

### 6.5 `POST /api/vault/rotate-key`

**Purpose:** Trigger master-key rotation. Wraps all existing DEKs under a new KMS-wrapped key.

**Auth:** Superadmin with `vault:admin` scope **only**. Requires MFA + reason.

**Body:**
```json
{
  "reason": "Annual key rotation per DPDP §8 + crypto-policy 2026",
  "scheduleAt": "2026-08-01T02:00:00Z"
}
```

**Response (202 Accepted):**
```json
{
  "rotationId": "rot_8a91...",
  "scheduledAt": "2026-08-01T02:00:00Z",
  "affectedTokens": 12480,
  "status": "SCHEDULED"
}
```

After execution, `/api/vault/rotation/:rotationId` returns progress.

---

### 6.6 `GET /api/vault/audit`  `[Admin]`

**Purpose:** Query the audit log (paginated).

**Auth:** Superadmin with `vault:audit-read` scope.

**Query params:** `from`, `to`, `actorId`, `token`, `eventType` (`TOKENIZE` | `DETOKENIZE` | `LOOKUP` | `REVOKE` | `ROTATE` | `TOMBSTONE`), `page`, `limit` (max 100).

**Response (200):**
```json
{
  "rows": [
    {
      "auditId": "aud_91a2...",
      "eventType": "DETOKENIZE",
      "actorId": "user_xyz",
      "actorRole": "SUPERADMIN",
      "tokenHash": "sha256:5a8f...",
      "reason": "Parent verified identity at school office",
      "ipAddress": "10.0.4.18",
      "userAgent": "Mozilla/5.0 ...",
      "mfaVerified": true,
      "kmsKeyId": "arn:aws:kms:...",
      "at": "2026-07-20T15:31:12.456Z",
      "auditChainHash": "sha256:8c2d..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 124 }
}
```

Note: `tokenHash` is **never the raw token** — it's a hash so audit log itself can be backed up without leaking.

---

### 6.7 `GET /api/vault/health` `[Public]`

**Purpose:** Liveness/readiness probe.

**Response (200):**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "kms": "connected",
  "mongo": "connected",
  "auditChain": "intact",
  "uptime": 86423
}
```

---

### 6.8 Error code reference

| Code | Meaning | HTTP |
|---|---|---|
| `INVALID_INPUT` | Body validation failed | 400 |
| `UNAUTHENTICATED` | No/bad JWT | 401 |
| `FORBIDDEN` | Role lacks scope | 403 |
| `MFA_REQUIRED` | TOTP missing/expired | 403 |
| `REASON_REJECTED` | X-Request-Reason empty/blocklisted | 403 |
| `NOT_FOUND` | Token unknown | 404 |
| `DUPLICATE` | Stable token collision | 409 |
| `GONE` | Token REVOKED or TOMBSTONED | 410 |
| `RATE_LIMITED` | Too many requests | 429 |
| `KMS_UNAVAILABLE` | KMS call failed | 503 |
| `CHAIN_BROKEN` | Audit chain integrity failed | 503 |

---

## 7. Data Model

### 7.1 MongoDB collections (Vault's own DB: `aadhaar_vault`)

#### `vault_tokens` collection

```javascript
{
  _id: ObjectId,
  token: "vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7",  // unique index
  tokenType: "AADHAAR" | "BIRTH_CERTIFICATE" | "OTHER_GOVT_ID",
  ciphertext: Buffer,           // AES-256-GCM ciphertext of raw + IV
  authTag: Buffer,              // GCM auth tag (16 bytes)
  iv: Buffer,                   // GCM IV (12 bytes)
  dekWrapped: Buffer,           // DEK encrypted by KMS CMK
  kekId: String,                // ARN of the KMS Customer Master Key
  salt: Buffer,                 // 16 bytes, per-token random salt
  status: "ACTIVE" | "REVOKED" | "TOMBSTONED" | "ROTATED",
  createdAt: ISODate,
  createdBy: "user_abc123",
  createdByRole: "VOLUNTEER",
  context: {
    schoolId: "AP_GNT_01_01",
    reason: "student-register",
    evidence: "ticket:tic_7719"
  },
  rotationId: "rot_8a91..." | null,
  tombstonedAt: ISODate | null,
  revokedAt: ISODate | null,
  version: 1                   // for schema migrations
}
```

Indexes:
- `{ token: 1 }` unique
- `{ tokenType: 1, status: 1 }`
- `{ createdBy: 1, createdAt: -1 }`
- `{ context.schoolId: 1 }`

#### `vault_audit_log` collection (append-only)

```javascript
{
  _id: ObjectId,
  auditId: "aud_91a2f3e4...",       // unique, ULID-style
  eventType: "TOKENIZE" | "DETOKENIZE" | "LOOKUP" | "REVOKE" | "ROTATE" | "TOMBSTONE",
  actorId: "user_xyz",
  actorRole: "SUPERADMIN",
  tokenHash: "sha256:5a8f...",      // hash of token, NOT raw, NOT ciphertext
  tokenType: "AADHAAR",
  reason: "Parent verified identity at school office",
  ipAddress: "10.0.4.18",
  userAgent: "Mozilla/5.0 ...",
  mfaVerified: Boolean,
  kmsKeyId: "arn:aws:kms:...",
  requestId: "req_8a91...",
  at: ISODate,
  auditChainHash: "sha256:8c2d...",  // hash of (this row + previous chainHash)
  previousChainHash: "sha256:7b1c...",
  // CRITICAL: this row is signed by KMS at insertion time
  kmsSignature: "3045022100..."
}
```

Indexes:
- `{ auditId: 1 }` unique
- `{ at: -1 }` (for time-range queries)
- `{ actorId: 1, at: -1 }`
- `{ tokenHash: 1, at: -1 }`

#### `vault_kms_keys` collection (audit of key rotations)

```javascript
{
  _id: ObjectId,
  rotationId: "rot_8a91...",
  kekId: "arn:aws:kms:ap-south-1:123:key/abcd-...",
  previousKekId: "arn:aws:kms:...",
  reason: "Annual key rotation",
  scheduledAt: ISODate,
  startedAt: ISODate,
  completedAt: ISODate | null,
  status: "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED",
  tokensAffected: Number,
  tokensRewrapped: Number,
  triggeredBy: "user_xyz",
  kmsSignature: "..."   // proves the rotation itself was authorized
}
```

#### `vault_service_tokens` collection (for inter-service auth)

```javascript
{
  _id: ObjectId,
  serviceName: "fln-backend",
  tokenHash: "sha256:...",      // hashed, not the raw token
  scope: ["vault:tokenize", "vault:lookup"],
  issuedAt: ISODate,
  expiresAt: ISODate,
  rotatedAt: ISODate | null,
  revokedAt: ISODate | null,
  lastUsedAt: ISODate
}
```

### 7.2 KMS structure

```
KMS Customer Master Key (CMK)
  └─ NEVER leaves HSM
  └─ Used to wrap per-instance Data Encryption Keys (DEKs)
  └─ Rotation: configurable (90 days default; annually enforced)
  
Data Encryption Keys (DEKs)
  └─ Generated per-token (or per-token-batch with salt reuse)
  └─ Stored in `vault_tokens.dekWrapped` (wrapped form)
  └─ Decrypted to memory only during a single detokenize call
  └─ Zeroed from memory immediately after use
```

### 7.3 Token format spec

```
vlt_<version>_<type>_<random-base32>

Example:  vlt_8f3a91b2e6c4d7f0a1b9c2d3e4f5a6b7
            │ │                              │
            │ │                              └─ 32 chars: 160 bits of randomness
            │ └─ type byte (1 char): a=Aadhaar, b=Birth, o=Other
            └─ version byte: 0=v1 (current)

Last-4 token: vlt_l4_<2-hex-of-random-cs>
              Example: vlt_l4_2c9f
              ┌─── special "lookup-only" prefix
              No ciphertext stored against this.
              It's a separate document `vault_lookup_last4`:
              { token: "vlt_l4_2c9f", parentTokenHash: "sha256:..." }
              Lookup by parentTokenHash returns masked value WITHOUT detokenize.
```

---

## 8. Security & Cryptography Model

### 8.1 Cryptographic primitives

| Purpose | Algorithm | Parameters |
|---|---|---|
| Symmetric encryption (raw identity) | **AES-256-GCM** | 256-bit key, 96-bit IV, 128-bit auth tag |
| Per-token salt | CSPRNG | 128-bit (16 bytes) per token |
| Token format | Base32 (Crockford) | No padding, lowercase |
| Master key wrap | **AWS KMS** `Encrypt` API | AES-256 with HSM-backed CMK |
| Audit chain hash | SHA-256 | `hash(this_row_canonical_json || previous_chain_hash)` |
| Audit row signature | ECDSA P-256 | Signed by KMS asymmetric keypair |

### 8.2 Why these choices

- **AES-GCM**: authenticated encryption; tampering with ciphertext fails decryption.
- **Per-token salt**: prevents frequency analysis ("how many students have Aadhaar ending 9012").
- **Crockford base32**: human-typable, no ambiguous chars (no `0` vs `O`, no `1` vs `l`).
- **HSM-backed KMS**: master key never leaves HSM boundary; even AWS engineers can't extract.
- **Audit chain hash**: tamper-evidence — any historical edit breaks the chain.
- **ECDSA via KMS**: even if Vault DB is leaked, attacker cannot forge new audit rows.

### 8.3 Auth model

Two token classes accepted:

| Token class | Where from | Scope |
|---|---|---|
| **User JWT** | Existing FLN auth (Supabase / custom JWT) | User-facing endpoints (lookup, detokenize, audit query) |
| **Service token** | Issued by Vault admin once per consuming service | Service-facing endpoint (tokenize) |

Service tokens:
- Long random (`vault_svc_<48-char-base32>`), never logged.
- Stored as hash in `vault_service_tokens`.
- Scoped per service (e.g., `fln-backend` only has `vault:tokenize` + `vault:lookup`, never `vault:detokenize`).
- 90-day expiry; auto-rotation supported.
- Can be revoked by Superadmin in <1 min.

### 8.4 Key rotation

- **CMK rotation** (KMS-side): annually OR on-demand. KMS handles re-wrapping of any DEKs that were wrapped under the old CMK.
- **DEK rotation** (Vault-side): triggered by `POST /api/vault/rotate-key`. Lazy re-wrap: existing tokens continue to work, but on next read they're rewritten with new DEK. Old DEKs zeroed.

### 8.5 Threat model

| Threat | Mitigation |
|---|---|
| Attacker leaks Vault DB | KMS-wrapped DEKs useless without KMS access |
| Attacker leaks audit log | Token hashes, not raw; KMS-signed rows can't be forged |
| Attacker compromises Vault app server | DEK only in memory for milliseconds; can't exfiltrate CMK |
| Insider with DB read access | Tokenization means even insiders see only tokens, never raw |
| Insider with Vault admin access | MFA + reason required + KMS-issued audit signature per call |
| KMS goes down | Vault returns 503; services can fall back to "lookup-only" mode (no new tokenize) |
| Token reversal by brute force | 160 bits of randomness; 2^160 attempts required; token format random, not derived |

---

## 9. Audit Trail

### 9.1 What gets logged

| Event | Fields logged | Notes |
|---|---|---|
| `TOKENIZE` | actor, tokenHash, tokenType, schoolId, reason, ip, UA, kmsKeyId | Most common — high volume |
| `LOOKUP` | actor, tokenHash, tokenType, ip, UA | Even masked reads logged (privacy) |
| `DETOKENIZE` | actor, tokenHash, tokenType, reason, evidence, ip, UA, mfaVerified, kmsKeyId | **Most sensitive** — heaviest scrutiny |
| `REVOKE` | actor, tokenHash, reason, evidence | DPDP erasure evidence |
| `TOMBSTONE` | actor, tokenHash, reason (always "auto-retention") | Scheduled job logs |
| `ROTATE` | actor, rotationId, reason, tokensAffected | Rare, high-impact |

### 9.2 Audit chain integrity

Every row contains `auditChainHash = SHA256(canonical_json(row_without_chain_hash) || previousChainHash)`.

The **genesis row** has `previousChainHash = "sha256:0000...0000"`.

Any tampering with a historical row:
- Breaks the chain at that row.
- All subsequent rows become unverifiable.
- Vault's `/api/vault/health` exposes `auditChain: "intact" | "broken"` flag.

The KMS-issued `kmsSignature` on each row is an additional layer — even if an attacker gains DB write access, they can't forge new rows.

### 9.3 Retention

- Vault keeps `vault_audit_log` for **7 years** (longer than DPDP's typical 3-year + buffer for litigation).
- After 7 years, rows are archived to cold storage (S3 Glacier / GCS Coldline) with their `auditChainHash` intact.
- A separate **quarterly compliance report** is auto-generated: total tokenizes, total detokenizes, top actors, anomalous patterns (e.g., 50 detokenizes in 10 minutes by one user).

---

## 10. Role-Based Access Matrix

| Endpoint | SUPERADMIN | BLOCK_ADMIN | SCHOOL_ADMIN | VOLUNTEER | TEACHER | Service Token |
|---|---|---|---|---|---|---|
| `POST /tokenize` | ✅ | ✅ | ✅ (own school) | ✅ (own school) | ❌ | ✅ (scoped) |
| `POST /detokenize` | ✅ + MFA | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /lookup/:token` | ✅ | ✅ | ✅ | ✅ (own school) | ✅ (own class) | ✅ |
| `POST /revoke` | ✅ | ✅ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| `POST /rotate-key` | ✅ + MFA | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /audit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /health` | ✅ (public) | ✅ (public) | ✅ (public) | ✅ (public) | ✅ (public) | ✅ (public) |

**Default-deny**: any role × endpoint combo not listed → 403.

---

## 11. Integration with the Current FLN Repo

### 11.1 Frontend touch — **1 new file, 0 modifications**

```
frontend/src/components/EmbeddedAadhaarMask.tsx   ← NEW component (single file)
```

It does exactly one thing: given a `token`, calls `/api/vault/lookup/:token`, displays masked result.

```tsx
// EmbeddedAadhaarMask.tsx — pseudocode
import React, { useEffect, useState } from 'react';

const VAULT_URL = import.meta.env.VITE_VAULT_URL || 'http://localhost:4101';

export function EmbeddedAadhaarMask({ token }: { token: string }) {
  const [masked, setMasked] = useState('XXXX-XXXX-XXXX');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const jwt = localStorage.getItem('fln_jwt');
    fetch(`${VAULT_URL}/api/vault/lookup/${token}`, {
      headers: { Authorization: `Bearer ${jwt}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setMasked(d.masked))
      .catch(e => setErr(String(e)));
  }, [token]);

  if (err) return <span className="aadhaar-mask err">[vault unreachable]</span>;
  return <span className="aadhaar-mask">{masked}</span>;
}
```

**Zero modifications** to `RoleDashboards.tsx`, `PanelViews.tsx`, or any god-file. The component is mountable from any existing screen via **one import + one tag**, which the user can do or not do — either way, Vault works standalone.

### 11.2 Backend touch — **0 file modifications, 1 optional helper**

The Vault is consumed over HTTPS. The FLN backend can call it directly with `fetch`. Optionally, an SDK lives at:

```
microservices/aadhaar-vault/sdk/aadhaar-vault-client.js
```

The FLN backend can drop this in (one `package.json` dep + one `import`) to get a typed client. **Not required** for Vault to function.

### 11.3 Environment variables needed

Frontend `.env.local` (new, optional):
```
VITE_VAULT_URL=http://localhost:4101
```

Vault `.env` (new, required):
```
PORT=4101
MONGODB_URI=mongodb://localhost:27017/aadhaar_vault
KMS_PROVIDER=aws              # aws | gcp | azure | local-dev
KMS_KEY_ARN=arn:aws:kms:ap-south-1:...:key/abcd-...
JWT_PUBLIC_KEY=<RS256-pubkey-from-FLN-auth>
RATE_LIMIT_PER_MIN=100
AUDIT_CHAIN_GENESIS_HASH=sha256:0000000000000000000000000000000000000000000000000000000000000000
```

For dev, `KMS_PROVIDER=local-dev` uses a local-libsodium key (NOT for production).

---

## 12. Survival Plan Across the FLN Backend Rebuild

### 12.1 Why it survives

1. **New folder** — `microservices/aadhaar-vault/` does not exist in current repo.
2. **No imports** — never imports from `backend/src/**` or `frontend/src/**`.
3. **Standalone DB** — `aadhaar_vault` Mongo database is independent of FLN's Mongo.
4. **Standalone auth** — accepts FLN's existing JWT (public-key verify, no shared session state).
5. **Stable API** — `/api/vault/*` contract is OpenAPI-versioned (`/api/vault/v1/*`); rebuild team can reimplement or proxy.
6. **Schema-isolated** — Vault's collection names (`vault_tokens`, `vault_audit_log`) won't collide with any FLN collection.

### 12.2 What happens during the rebuild

| Phase | Vault status |
|---|---|
| Phase 1: Old backend still running | Vault serves both old + new backends. Old backend migrates raw → token in batches. |
| Phase 2: Cutover | Old backend stops accepting raw Aadhaar; only tokens accepted. Vault is now mandatory path. |
| Phase 3: New backend live | New backend calls Vault via SDK. Old backend's tokenized records flow in. |
| Phase 4: Old backend archived | Vault still holds tokens for the new backend; old backend can be deleted. |
| Phase 5: Rebuild team reimplements in different stack | They can reimplement the Vault service in their stack (Go, Rust, etc.) using the OpenAPI contract; or simply call our Vault. |
| Phase 6: Decade later, on a new system | The Vault's tokens remain valid because tokens are self-describing (`vlt_v1_*`). |

### 12.3 Migration recipe for the FLN team

For the FLN team (whenever they want to migrate):

```javascript
// Step 1: One-time script — read all students, tokenize their aadhaar
db.students.find({ aadhaar: { $exists: true, $type: "string" } }).forEach(s => {
  const res = vault.tokenize({ raw: s.aadhaar, type: "AADHAAR", context: {...} });
  db.students.updateOne({ _id: s._id }, {
    $set: { aadhaarToken: res.token, aadhaarTokenLast4: res.tokenLast4 },
    $unset: { aadhaar: "" }
  });
});

// Step 2: From now on, only accept aadhaarToken on POST /api/students
// Step 3: Mask in app code is GONE — replaced by vault /lookup call
// Step 4: Periodic job verifies no raw Aadhaar remains
db.students.find({ aadhaar: { $type: "string" } }).count() === 0   // assertion in CI
```

---

## 13. Folder & File Layout

```
microservices/
  aadhaar-vault/
    backend/
      src/
        app.ts                       # Fastify bootstrap, port 4101
        config.ts                    # env loader
        plugins/
          mongo.ts                   # Mongoose connection
          jwt.ts                     # JWT verifier (RS256)
          rate-limit.ts              # 100/min default
          error-handler.ts
          kms-aws.ts                 # AWS KMS adapter
          kms-gcp.ts                 # GCP KMS adapter
          kms-azure.ts               # Azure Key Vault adapter
          kms-local-dev.ts           # libsodium (dev only)
        routes/
          health.routes.ts
          tokenize.routes.ts
          detokenize.routes.ts
          lookup.routes.ts
          revoke.routes.ts
          rotate-key.routes.ts
          audit.routes.ts
        services/
          tokenize.service.ts
          detokenize.service.ts
          lookup.service.ts
          revoke.service.ts
          rotate-key.service.ts
          audit.service.ts
          crypto.service.ts          # AES-GCM wrap/unwrap
          chain.service.ts           # audit chain hash chain
        models/
          vault-token.model.ts
          vault-audit-log.model.ts
          vault-kms-keys.model.ts
          vault-service-token.model.ts
        middlewares/
          auth.ts
          require-mfa.ts
          require-reason.ts
          scope-check.ts
        jobs/
          rotate-key.job.ts          # scheduled cron
          tombstone-expired.job.ts   # DPDP retention
          compliance-report.job.ts   # quarterly
        utils/
          canonical-json.ts          # for chain hashing
          kms-signer.ts              # ECDSA via KMS
          base32.ts
          ulid.ts
      tests/
        unit/
          crypto.service.test.ts
          chain.service.test.ts
        integration/
          tokenize.e2e.test.ts
          detokenize.e2e.test.ts
        fixtures/
          kms-mock.ts
          mongo-mock.ts
      Dockerfile
      docker-compose.dev.yml         # vault + mongo + redis + local-kms
      package.json
      tsconfig.json
      .env.example
      .eslintrc.js
      
    sdk/
      aadhaar-vault-client.js        # browser/Node SDK
      aadhaar-vault-client.py        # Python SDK (for ai-services)
      aadhaar-vault-client.go        # Go SDK (for future)
      package.json                   # npm-publishable
      README.md
      
    frontend/
      src/
        components/
          EmbeddedAadhaarMask.tsx     # the only FE integration
        examples/
          superadmin-detokenize-panel.tsx  # reference impl for SU
      package.json
      
    openapi/
      vault-v1.yaml                  # API contract — what survives rebuild
      vault-v1.json                  # bundled JSON for tooling
      
    docs/
      threat-model.md
      key-rotation-runbook.md
      mfa-setup.md
      aws-kms-setup.md
      gcp-kms-setup.md
      azure-key-vault-setup.md
      compliance-dpdp-mapping.md
      compliance-rte-mapping.md
      audit-chain-format.md
      
    scripts/
      seed-dev-tokens.ts             # for local dev
      verify-audit-chain.ts          # one-off integrity checker
      
    docker-compose.yml               # prod-style local run
    README.md
    CONTRIBUTING.md
    LICENSE
```

Total file count for v0.1 MVP: ~35 new files. Zero modifications to existing FLN repo (except optional `frontend/src/components/EmbeddedAadhaarMask.tsx` if the user wants it).

---

## 14. Effort Estimation & Milestones

### v0.1 MVP (5–8 days) — "Compliance-grade tokenize + lookup + audit"

| Day | Deliverable |
|---|---|
| Day 1 | Folder scaffold, Fastify bootstrap, env loader, Docker-compose with local-kms + Mongo |
| Day 2 | `crypto.service.ts` (AES-GCM wrap/unwrap); `tokenize.routes.ts` + `lookup.routes.ts` working end-to-end |
| Day 3 | `vault_tokens` + `vault_audit_log` models; `chain.service.ts` (audit chain hash); basic JWT middleware |
| Day 4 | `detokenize.routes.ts` with MFA + reason middleware; rate limiting |
| Day 5 | `audit.routes.ts` (paginated query); `/health` endpoint; OpenAPI spec v0.1 |
| Day 6 | Unit + integration tests; `EmbeddedAadhaarMask.tsx`; SDK npm package |
| Day 7 | Threat-model doc, README, runbook; deploy locally with docker-compose |
| Day 8 | Buffer: bug fixes, doc polish, optional KMS provider integrations |

### v0.2 (3 days) — "Multi-KMS, rotate-key, revoke"

- KMS providers: AWS, GCP, Azure (not just local-dev).
- `rotate-key` endpoint + cron job.
- `revoke` endpoint + DPDP §6 erasure flow.
- Audit-chain integrity verification script.

### v0.3 (3 days) — "Production hardening"

- KMS-issued audit row signatures (ECDSA).
- Quarterly compliance report generator.
- Backups of `vault_audit_log` to cold storage.
- Runbook for KMS failover.
- Penetration test prep.

### v1.0 (1 day) — "Public release"

- OpenAPI 1.0 freeze.
- Public SDK on npm + PyPI.
- Reference implementation in `frontend/src/examples/superadmin-detokenize-panel.tsx`.

**Total MVP effort: 5–8 days for a working, testable, documented Vault.**

---

## 15. Legal & Compliance Mapping

### 15.1 RTE Act 2009 §3(c) — Free & Compulsory Education

| Requirement | Vault coverage |
|---|---|
| Child identity protection as state obligation | Vault is the single point of identity storage; no other service holds raw PII |
| Non-discrimination in admission | Raw identity is never used for admission decisions (admission uses tokens) |
| Protection from disclosure | Vault's detokenize log proves who accessed what, when, why |

### 15.2 Aadhaar Act 2016 §29 — Restrictions on sharing

| Requirement | Vault coverage |
|---|---|
| Aadhaar numbers not to be displayed except as permitted | Vault returns `XXXX-XXXX-9012` masked for routine lookups; full only via audited detokenize |
| No public display | Vault has no public display endpoint; all endpoints require JWT |
| Not to be shared without consent | Consent captured at tokenize-time; revoke endpoint enforces withdrawal |

### 15.3 DPDP Act 2023 §6, §8, §9 — Data Principal Rights + Fiduciary Obligations

| Requirement | Vault coverage |
|---|---|
| §6 Right to access | Superadmin detokenize flow |
| §6 Right to correction | Revoke + re-tokenize flow (planned v0.2) |
| §6 Right to erasure | `POST /revoke` + scheduled `tombstone` job |
| §8 Purpose limitation | `context.reason` field required at every call; audit log records purpose |
| §8 Storage limitation | `tombstoned` status + retention cron |
| §9 Security safeguards | KMS-wrapped DEKs + AES-256-GCM + audit chain + MFA + RBAC |
| §10 Breach notification | Quarterly compliance report + alerting on `CHAIN_BROKEN` / anomalous detokenize rate |

### 15.4 IT Act 2000/2008 + SPDI Rules 2011

| Requirement | Vault coverage |
|---|---|
| "Reasonable security practices" | ISO 27001-style controls: KMS, audit, MFA, scope-check |
| "Sensitive personal data" protection | Aadhaar is classified SPDI; Vault is the only authorized handler |
| "Privacy policy" disclosure | `docs/compliance-dpdp-mapping.md` covers this |

### 15.5 NEP 2020 — Mother-tongue Pedagogy (tangential)

While not Vault-specific, Vault is **language-agnostic** — tokens are 32-char base32 regardless of UI language. This supports NEP's multilingual UI goal.

---

## 16. Failure Modes & Mitigations

| Failure | Impact | Mitigation |
|---|---|---|
| **KMS goes down** | Vault can't tokenize / detokenize | 503 returned; existing tokens still lookup-able (ciphertext + wrapped DEK both already in DB); service falls back to "lookup-only" mode |
| **Vault Mongo goes down** | New tokens can't be issued; lookup still works (cached responses for 60s) | Mongo replica set + automated backups; service uses lookup-cached mode |
| **Vault app server crashes mid-detokenize** | DEK in memory is lost; raw number never persisted | Audit log row still written (BEFORE decrypt), marked `decryption_attempted: false` |
| **Compromised service token** | Attacker can tokenize/lookup with victim's scopes | Token rotation in <1 min; scoped per service; vault_admin paged on suspicious rate |
| **Compromised Superadmin JWT + MFA secret** | Attacker can detokenize | KMS-issued audit signature still captures it; 2-person integrity (MFA token + reason) makes mass-detokenize logistically hard |
| **Audit chain broken (someone edits historical row)** | Tamper-evident alert | `/health` flips to `auditChain: "broken"`; alerting to vault_admins; investigation triggered |
| **Clock skew between Vault and services** | JWT validation fails intermittently | All Vault endpoints accept ±5 min skew window |
| **Backend rebuild loses Vault reference** | New backend doesn't know about tokens | OpenAPI spec is self-documenting; SDK includes discoverable `vault.health()` to ping |
| **Storage of vault_tokens DB exceeds budget** | Cost grows linearly with student count | Tombstone expired tokens; ciphertext is small (~64 bytes per token); ROI justifies |

---

## 17. Open Questions / Risks

| # | Question / Risk | Status |
|---|---|---|
| Q1 | Should the FLN team adopt Vault on day 1 or in a later phase? | Depends on rebuild timeline |
| Q2 | Which KMS provider for production? AWS most likely (AP Government Cloud) | Open — needs decision |
| Q3 | Should Vault issue its own service tokens or accept FLN-issued ones? | Recommendation: Vault-issued for self-contained audit |
| Q4 | Birth Certificate numbers — same flow as Aadhaar or different token-type? | Recommendation: same flow, distinct `tokenType` enum |
| Q5 | What about Aadhaar-less children (22% per `Research/National_status_report.md`)? | Vault supports `BIRTH_CERTIFICATE` and `OTHER_GOVT_ID` token types — same Vault handles them |
| Q6 | Should the Vault also issue anonymized pseudonyms for analytics? | Future feature (v0.4) — out of MVP scope |
| Q7 | What if a parent revokes consent and the student is mid-assessment? | Vault's `revoke` is synchronous; backend should reject any token state != ACTIVE |
| Q8 | How does Vault interact with the rebuild team's own auth system? | Vault accepts ANY RS256 JWT; just needs the new team's public key in `JWT_PUBLIC_KEY` env var |
| R1 | Risk: KMS quota limits | Mitigation: KMS calls are cached + batched (DEK reuse for stable tokens) |
| R2 | Risk: Audit chain grows unbounded | Mitigation: 7-year retention + cold archival; chain hash preserved |
| R3 | Risk: Vendor lock-in (AWS vs GCP) | Mitigation: KMS adapter pattern; can swap provider by changing env var + adapter |

---

## 18. References

### Internal repo docs
- `PRD.md` §7, §9 — Identity protection, audit/compliance
- `SRS.md` §13.2 — Governance & access control
- `database_design.md` — Mongo collections (current schema)
- `ER_diagram_db.md` — entity relationships
- `feature_idea.md` §2 — Aadhaar access audit log (sister feature)
- `Research/National_status_report.md` — Aadhaar-less child statistics

### External law
- Right of Children to Free and Compulsory Education (RTE) Act, 2009, §3(c)
- Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016, §29
- Digital Personal Data Protection Act (DPDP), 2023, §6, §8, §9, §10
- Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011
- National Education Policy (NEP) 2020

### Standards
- NIST SP 800-38D — Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)
- NIST SP 800-57 — Recommendation for Key Management
- ISO/IEC 27001 — Information Security Management
- OWASP API Security Top 10 (2023)

### Cloud KMS
- AWS Key Management Service Developer Guide
- Google Cloud KMS Documentation
- Azure Key Vault Documentation

---

## 19. Identity-System Independence Strategy

The Vault is **identity-system-agnostic by design**. This section proves it: for every known or emerging Indian identity system, here's how the Vault handles it.

### 19.1 Master compatibility matrix

| Identity system | Issuer | Vault `tokenType` | Vault impact | Trigger date | Probability (24 mo) |
|---|---|---|---|---|---|
| **Aadhaar** | UIDAI | `AADHAAR` (built-in) | 0 days — already supported | Day 1 | 100% (current state) |
| **DigiLocker Aadhaar fetch** | MeitY (OAuth) | `AADHAAR` (unchanged) | 0 days — Vault still receives raw Aadhaar in OAuth XML response | When MeitY mandate lands | 45-55% |
| **APAAR (Academic Bank of Credits / One Nation One Student ID)** | MoE | Add `"APAAR"` to `tokenType` enum + regex `/^APAAR\d{12}$/` | **1 day** | When NEP 2020 rollout completes per state | 30-40% |
| **Birth Certificate** | State Registrars | `BIRTH_CERTIFICATE` (built-in) — add state-specific regex (~20 lines) | **1 day** | Already relevant for 22% Aadhaar-less per `Research/National_status_report.md` | 100% (always relevant) |
| **State Student ID** (AP, TN, KA, MH, etc.) | State Education Depts | Add `"STATE_STUDENT_ID"` + state-by-state regex | **2-3 days** (one regex per state) | Already issued in 6+ states | 70-80% |
| **UDISE+** (school-level, not student-level) | MoE | N/A — UDISE+ is for schools, not students | 0 days (irrelevant to Vault) | N/A | N/A |
| **UMANG / India Stack OAuth** | MeitY | N/A — UMANG is auth layer, Vault consumes raw after auth | 0 days (adapter middleware in `sdk/`) | Already available | 50-60% |
| **UIDAI eKYC API** (OTP-based) | UIDAI | `AADHAAR` (unchanged) — Vault receives raw from eKYC response | 0 days (just an SDK adapter) | Already available | 50-60% |
| **Aadhaar Verifiable Credential** (ZK-proof future) | UIDAI | Add `"AADHAAR_VC"` + ZK-proof verifier | **5 days** (requires ZK circuit integration) | When UIDAI issues W3C VCs | 10-15% |
| **PAN** (for parents, not students) | Income Tax Dept | Add `"PAN"` + regex `/^[A-Z]{5}\d{4}[A-Z]$/` | **1 day** | When parent-verify flow needs it | 25-30% |

### 19.2 What stays the same regardless

- **API contract** (`/v1/tokenize`, `/v1/detokenize`, `/v1/lookup`, `/v1/audit`) — unchanged.
- **Crypto envelope** (AES-256-GCM, KMS-wrapped DEKs) — unchanged.
- **Audit chain** (HMAC + KMS signature) — unchanged.
- **RBAC matrix** — unchanged.
- **Auth flow** (JWT + TOTP MFA on detokenize) — unchanged.

### 19.3 What changes (and it's always additive)

1. **`tokenType` enum gains new values** — never loses existing values. Old tokens stay valid.
2. **Per-type validation regex** — added per type, never modified for existing types.
3. **OpenAPI spec** — new enum values documented; old endpoints stay versioned.
4. **Optional SDK adapters** — e.g., `digilockerAdapter.ts`, `apaarAdapter.ts`. Each is a 30-50 line wrapper.

**Effort per new identity type: 1-3 days. Zero architecture changes. Zero breaking changes.**

### 19.4 What CAN make the Vault obsolete (rare scenarios)

| Scenario | Probability | Time horizon | Vault response |
|---|---|---|---|
| India Stack builds per-app KV-tokenization layer | 2-5% | 3-5 years | Pivot Vault to "fetcher-only" mode (v0.5) |
| Government mandates zero local identity storage | 5-10% | 3-7 years | Pivot to "fetcher-only" mode (v0.5) |
| UIDAI issues ZK-proof Verifiable Credentials | 10-15% | 2-4 years | Add ZK-verifier adapter (5 days) |
| All FLN identity becomes ephemeral ZK | 5% | 5-10 years | Vault becomes "ZK-attestation store" (v2) |

**None are imminent. Vault's horizon is 3-5 years minimum, with graceful pivots available.**

### 19.5 Why this matters for the FLN team

When an Indian state pilot says *"we use APAAR + Aadhaar + State ID, all three, for triangulation"*, the FLN team does NOT need to rebuild. They:
1. Add `"APAAR"` and `"STATE_STUDENT_ID"` to Vault's enum (1 day total).
2. Add `crossTypeIdentityLink` collection linking multiple tokens to one student (2 days).
3. The existing tokenize/detokenize flow works for all three types with no caller code changes.

**The Vault is the single integration point. Identity systems are pluggable inputs.**

---

## 20. Forward-Compatibility Roadmap

Versions are scheduled against probable trigger events, not calendar dates.

### v0.1 (current — MVP)
- Aadhaar-only tokenization
- AWS KMS / GCP KMS / Azure Key Vault / local-dev
- HMAC audit chain + KMS signature
- JWT auth + TOTP MFA on detokenize
- Node.js + Python SDKs
- ~35 new files, zero modifications to FLN repo

### v0.2 — When a state asks for APAAR OR Birth Cert + Aadhaar
**Effort: 3 days**

- Add `"APAAR"` token type (1 day)
- Add `"BIRTH_CERTIFICATE"` state-specific regex bank (~20 lines, 1 day)
- Cross-type identity linking: `vault_student_identities` collection linking multiple tokens to one `studentId`
- New endpoint `GET /api/v1/student/:studentId/identities` returning all linked tokens
- Migration script `migrate-to-multi-id.ts` (1 day)

**Trigger conditions:**
- First state partner requests APAAR adoption
- Birth Certificate becomes primary ID for >10% of new enrollments
- NEP 2020 APAAR rollout crosses 50% of schools

### v0.3 — When DigiLocker OAuth becomes a federal requirement
**Effort: 5 days**

- New middleware `digilockerAdapter.ts` in `sdk/` (3 days)
- OAuth callback handler: extract Aadhaar from DigiLocker XML response
- `oauthConsentId` + `oauthTimestamp` fields added to `vault_tokens.context`
- Re-consent scheduler: detect expired OAuth consent, flag tokens for re-verification (2 days)

**Trigger conditions:**
- MeitY mandate for ed-tech platforms to use DigiLocker OAuth
- DigiLocker reaches >40% adoption in FLN's target demographics
- Pilot schools report <70% DigiLocker coverage (drives the dual-track UX)

### v0.4 — When UIDAI issues ZK-proof Verifiable Credentials OR pilots need offline-mode
**Effort: 10 days**

- ZK-proof verifier: `crypto/zk/circuits/aadhaar_vc.circom` (5 days)
- Offline-mode cache: tokens stored locally on tablet, batch-synced to Vault when connectivity returns (3 days)
- Hybrid token format: standard `vlt_*` OR `vlt_zk_*` (ZK-attached)
- Documentation: `docs/offline-mode-runbook.md`

**Trigger conditions:**
- UIDAI publishes W3C Verifiable Credentials spec for Aadhaar
- Pilot schools in Chhattisgarh / Jharkhand / NE India request offline-mode support
- >5% of tokenize calls fail due to network outage (metrics-triggered)

### v0.5 — "Fetcher-only" mode (rare pivot)
**Effort: 15 days** (only if regulator mandates it)

- Zero local storage of identity
- Vault becomes a **transient fetcher**: receives request → calls UIDAI/DigiLocker API → returns data → logs audit → discards immediately
- Tokenize becomes "fetch + immediate pass-through to caller"
- Audit chain persists, but raw identity never persisted even in Vault's DB

**Trigger conditions (any of):**
- DPDP Board rule mandates ed-tech apps store zero PII
- India Stack releases official tokenization SDK and bans alternatives
- Government passes Data Protection Amendment Act 2026 with stricter provisions

### v2.0 — Multi-tenant white-label for state governments
**Effort: 30 days**

- Per-tenant KMS keys (state A's data uses state A's KMS, isolated)
- Per-tenant audit chains
- Per-tenant JWT signing keys (each state issues its own service tokens)
- Tenant-aware RBAC matrix
- Cross-tenant federation protocol (state A can verify state B's tokens with explicit consent)

**Trigger conditions:**
- First state government contract (₹50L+ annual value)
- MoE requests FLN as national platform
- Inter-state student migration data-sharing becomes legal requirement

---

## 21. How the Vault Works — Technical Deep-Dive

This section lifts the hood completely. Every primitive, every byte, every step.

### 21.1 The One-Sentence Summary

> The Vault receives a raw identity + reason, performs KMS-encrypted envelope encryption, and returns a random opaque token. Later, when an authenticated caller with valid MFA states a reason, the Vault reverses the operation under a tamper-evident audit trail.

### 21.2 The Big Picture — Two Flows

```
───────────────  TOKENIZE FLOW  ───────────────
Caller (FLN backend)
  POST /v1/tokenize { raw, type, context }
              │
              ▼
Vault Service (port 4101)
  ① KMS.GenerateDataKey() → DEK
  ② AES-256-GCM encrypt raw w/ DEK
  ③ store: token + ciphertext + DEK-w
  ④ discard DEK from memory
              │
              ▼
MongoDB Atlas
  vault_tokens:
    { token:"vlt_8f3a91…",
      ciphertext: <encrypted-bytes>,
      iv, tag,
      dekWrapped: <KMS ciphertext blob>,
      last4: "9012", type: "AADHAAR" }
              │
              ▼
Caller receives: { token:"vlt_8f3a91…", last4:"9012" }
  ← raw Aadhaar NEVER returned to caller

───────────────  DETOKENIZE FLOW  ──────────────
Caller (FLN backend + user w/ MFA)
  POST /v1/detokenize { token, mfaProof, reason }
              │
              ▼
Vault
  ① verify JWT (caller service identity)
  ② verify TOTP mfaProof (human step-up)
  ③ verify token is active, not soft-deleted
  ④ KMS.Decrypt(dekWrapped) → DEK
  ⑤ AES-256-GCM decrypt ciphertext w/ DEK
  ⑥ append HMAC-chained audit row
  ⑦ discard DEK from memory
              │
              ▼
Caller receives: { aadhaar:"123456789012" }
AND audit row appended:
  { token, actorId, ts, ip, reason, mfa,
    prevHash, currentHash }
```

Two flows. Same primitives in reverse.

### 21.3 Component 1 — Tokenize (Step-by-Step)

The single operation that turns `"Ananya's Aadhaar is 123456789012"` into `"Ananya's token is vlt_8f3a91..., last 4 is 9012"`.

```ts
// vault/src/services/tokenize.service.ts
import { KMSClient, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import crypto from "node:crypto";

const kms = new KMSClient({ region: process.env.AWS_REGION });

export async function tokenize({ raw, type, context }) {
  // ── ① Input validation ────────────────────────────
  if (type === "AADHAAR" && !/^\d{12}$/.test(raw.replace(/\s/g, ""))) {
    throw new ValidationError("Invalid Aadhaar format");
  }

  // ── ② Ask KMS for a fresh DEK ────────────────────
  // KMS gives us TWO outputs:
  //   (a) a plaintext DEK (32 bytes)        ← we use this NOW
  //   (b) a wrapped DEK (ciphertext blob)   ← we store THIS
  // The plaintext DEK never leaves process memory.
  const { Plaintext, CiphertextBlob } = await kms.send(
    new GenerateDataKeyCommand({
      KeyId: process.env.VAULT_KMS_KEY_ID,
      KeySpec: "AES_256",
    })
  );
  const dek = Buffer.from(Plaintext);
  const dekWrapped = Buffer.from(CiphertextBlob);

  // ── ③ Encrypt the Aadhaar with the DEK ────────────
  // AES-256-GCM gives us BOTH:
  //   • confidentiality (the ciphertext is unreadable)
  //   • integrity (the auth tag detects tampering)
  const iv = crypto.randomBytes(12);    // 96-bit IV, fresh per record
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
  const ciphertext = Buffer.concat([
    cipher.update(raw, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();      // 16 bytes

  // ── ④ Generate a random opaque token ──────────────
  // vlt_<40 hex chars> = 20 random bytes encoded.
  // NOT derivable from the Aadhaar — no rainbow tables.
  const token = "vlt_" + crypto.randomBytes(20).toString("hex");

  // ── ⑤ Persist everything except the plaintext DEK ─
  await db.vaultTokens.insertOne({
    token,
    type,
    ciphertext,
    iv,
    tag,
    dekWrapped,
    last4: raw.slice(-4),
    context,                              // who, why, when, source
    createdAt: new Date(),
    active: true,
  });

  // ── ⑥ Discard the plaintext DEK from memory ──────
  dek.fill(0);                           // zero out RAM

  // ── ⑦ Return ONLY token + last4 to caller ────────
  return { token, last4: raw.slice(-4) };
}
```

**The plaintext Aadhaar exists in 3 places during this call:**
1. The HTTP request body — milliseconds.
2. `raw` JavaScript string — milliseconds.
3. The DEK-encrypted ciphertext — written to MongoDB, **never decryptable without KMS**.

After the function returns, **only ciphertext lives in the database**. The DEK plaintext is `fill(0)`'d (best-effort wipe). MongoDB has no raw Aadhaar.

### 21.4 Component 2 — Detokenize (Step-by-Step)

The mirror image of tokenize, with three extra gates: caller auth, MFA, and audit append.

```ts
// vault/src/services/detokenize.service.ts
export async function detokenize({
  token, callerUserId, callerServiceId,
  reason, mfaProof, ip, userAgent,
}) {
  // ── ① Verify caller is who they claim ─────────────
  // callerServiceId comes from JWT (signed by FLN backend).
  // We verify against FLN backend's public key (RS256).
  await verifyJWT(callerServiceId);

  // ── ② Verify MFA proof (TOTP) ─────────────────────
  // mfaProof is a TOTP code from Google Authenticator.
  // The TOTP secret is stored as a TOTP-encrypted blob in Vault.
  await verifyTOTP(callerUserId, mfaProof);

  // ── ③ Look up the token ───────────────────────────
  const record = await db.vaultTokens.findOne({ token, active: true });
  if (!record) throw new NotFoundError();

  // ── ④ Unwrap the DEK via KMS ──────────────────────
  const { Plaintext: dek } = await kms.send(
    new DecryptCommand({ CiphertextBlob: record.dekWrapped })
  );

  // ── ⑤ Decrypt the Aadhaar ─────────────────────────
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, record.iv);
  decipher.setAuthTag(record.tag);      // GCM verifies integrity
  const raw = Buffer.concat([
    decipher.update(record.ciphertext),
    decipher.final(),
  ]).toString("utf8");

  // ── ⑥ Append audit row (HMAC-chained) ─────────────
  await appendAudit({
    token,
    actorUserId: callerUserId,
    actorServiceId: callerServiceId,
    reason,
    ip, userAgent,
    mfaFactor: "TOTP",
    timestamp: new Date(),
  });

  // ── ⑦ Return raw Aadhaar to caller (one-time) ─────
  return { aadhaar: raw, auditLogUrl: "/v1/audit?token=" + token };
}
```

**Three gates stand between the caller and the raw Aadhaar:**

| Gate | What it prevents |
|---|---|
| JWT verification | Random services calling Vault with stolen tokens |
| MFA verification (TOTP) | Even JWT-authenticated service from running without human step-up |
| Audit append | Every reveal is recorded with actor + IP + reason + MFA proof hash |

### 21.5 Component 3 — Audit Chain (Why It's Tamper-Evident)

```ts
// vault/src/services/chain.service.ts
const auditKey = await kmsToMemoryKey("alias/fln-audit-chain");  // never on disk

export async function appendAudit(rowData) {
  const prevHash = await getLastAuditHash();      // or "GENESIS" for first row
  const rowCanonical = canonicalJson({
    ...rowData,
    prevHash,
    timestamp: rowData.timestamp.toISOString(),
  });
  const currentHash = crypto
    .createHmac("sha256", auditKey)
    .update(rowCanonical)
    .digest("hex");

  await db.vaultAudit.insertOne({
    ...rowData,
    prevHash,
    currentHash,
    rowCanonical,
  });
}

export async function verifyAuditChain(fromRowId) {
  let prev = "GENESIS";
  for await (const row of db.vaultAudit.find({ _id: { $gte: fromRowId } })) {
    const expected = crypto
      .createHmac("sha256", auditKey)
      .update(row.rowCanonical)
      .digest("hex");
    if (row.prevHash !== prev)        return { ok: false, where: row._id, why: "broken prev" };
    if (row.currentHash !== expected) return { ok: false, where: row._id, why: "hash mismatch" };
    prev = row.currentHash;
  }
  return { ok: true };
}
```

**Why it works:**
- `auditKey` lives in Vault memory only — never persisted.
- An attacker who edits `vaultAudit` rows in MongoDB would need to either:
  (a) edit `currentHash` for the tampered row (but doesn't know `auditKey`),
  (b) edit ALL downstream rows to keep chain valid (still doesn't know `auditKey`),
  (c) forge a new chain (impossible without `auditKey`).
- **Even Vault operators can't fabricate audit chains** without multi-party key ceremony.

**Daily anchor:** Vault publishes `lastHash` to S3 Object Lock (WORM) or a public blockchain anchor (Polygon, ~$0.001/tx). External observers can verify the chain's integrity later.

### 21.6 Component 4 — Auth & MFA

**Two different identities call Vault:**

| Identity type | Examples | MFA required? |
|---|---|---|
| **Service identity** (mTLS or signed JWT) | FLN backend (Node), ai-services pipeline (Python), Vault admin tooling | No (machine) |
| **User identity** (JWT + TOTP) | Teacher viewing student Aadhaar, auditor pulling audit log, volunteer confirming enrollment | **Yes, TOTP** for `detokenize` |

**Service-to-Vault auth:**
- FLN backend has an RSA keypair. Public key registered with Vault at deployment.
- Each request: `Authorization: Bearer <JWT signed by FLN>` with claims `{sub:"fln-backend", scope:["tokenize","detokenize"], exp:...}`.
- Vault verifies JWT signature using FLN's public key. No shared secret in env vars.

**User MFA (TOTP step-up):**
- At user creation: generate TOTP secret, encrypt with Vault's KMS key, store as `users.totpEncrypted`.
- At detokenize: frontend prompts user for 6-digit TOTP code, sends to backend, which forwards to Vault.
- Vault decrypts user's TOTP secret, verifies code (RFC 6238, ±1 window for clock skew).
- TOTP verification is gated BEHIND service-authenticated boundary, so frontend never talks to Vault directly.

### 21.7 A Real Walkthrough — Ananya's Enrollment

**Day 1: Ananya's parent signs consent on paper. Teacher types Aadhaar into tablet.**

```
T=0.000s  Tablet shows: "Enter Aadhaar"
T=0.500s  Teacher types: "123456789012"
T=0.700s  Tablet → FLN backend:  POST /api/enroll {aadhaar:"123456789012", parentConsent:"signed", student:{...}}
T=0.800s  FLN backend → Vault:   POST /v1/tokenize {raw:"123456789012", type:"AADHAAR", context:{actorId:"teacher-789", reason:"enrollment", source:"MANUAL_PARENT_INPUT"}}
T=1.200s  Vault: KMS generates DEK
T=1.205s  Vault: AES-GCM encrypts "123456789012" → ciphertext
T=1.400s  Vault: writes MongoDB row {token:"vlt_8f3a91…", ciphertext, dekWrapped, last4:"9012"}
T=1.450s  Vault: zero-fills DEK from RAM
T=1.500s  Vault → FLN backend:    {token:"vlt_8f3a91…", last4:"9012"}
T=1.600s  FLN backend → Tablet:   {token:"vlt_8f3a91…", last4:"9012"}
T=1.700s  Tablet renders:        "Ananya enrolled. Token: vlt_8f3a91. Last 4: 9012."
T=1.750s  Raw Aadhaar has been:
          - In teacher tablet memory: 1.7s
          - In FLN backend memory:    0.5s
          - In Vault memory:          0.4s
          - In MongoDB:               NEVER (only ciphertext)
```

**Six months later: Ananya's family applies for the PM-Scholarship. Volunteer needs to verify her Aadhaar.**

```
T=0      Volunteer in app: clicks "Verify Ananya's Aadhaar"
T=100ms   App prompts for TOTP (detokenize → MFA-gated)
T=15s     Volunteer enters 6-digit code from Google Authenticator
T=15.1s   App → FLN backend:  POST /api/verify {token:"vlt_8f3a91", mfaProof:"847293", reason:"scholarship-kyc"}
T=15.2s   FLN → Vault:        POST /v1/detokenize {token:"vlt_8f3a91", callerServiceId:"fln-backend", callerUserId:"volunteer-456", reason:"scholarship-kyc", mfaProof:"847293", ip:"1.2.3.4", userAgent:"Mozilla/5.0..."}
T=15.3s   Vault: verifies JWT (FLN's signature)
T=15.4s   Vault: verifies TOTP (decrypts user's secret, checks 847293 ±1 window)
T=15.5s   Vault: looks up token "vlt_8f3a91" → finds active record
T=15.6s   Vault: KMS unwraps DEK
T=15.7s   Vault: AES-GCM decrypts → "123456789012"
T=15.8s   Vault: appends audit row {prevHash:"a3f2…", currentHash:"7b91…", actorId:"volunteer-456", reason:"scholarship-kyc", ip:"1.2.3.4", mfa:"TOTP", ts:...}
T=15.9s   Vault: zero-fills DEK from RAM
T=16.0s   Vault → FLN backend: {aadhaar:"123456789012", auditLogUrl:"/v1/audit?token=vlt_8f3a91"}
T=16.1s   FLN → app:           {aadhaar:"123456789012", auditUrl:"…"}
T=16.2s   App renders:         "Ananya's Aadhaar (verified via Vault @ 16:00:00, audit ID: …)"
T=16.3s   App screen auto-clears after 5 seconds; copy-button disabled; right-click disabled
```

**What's in the audit log 6 months from now:**
- Every reveal of `vlt_8f3a91`'s underlying Aadhaar.
- Volunteer-456's user ID, IP, MFA factor, reason, exact timestamp.
- HMAC-chained so any tampering breaks the chain.
- Exportable to CSV/JSON for UIDAI/DPDP audits.

### 21.8 What Each Primitive Buys You

| Primitive | What it stops |
|---|---|
| KMS-managed DEK | Attacker who steals MongoDB can't decrypt without AWS credentials |
| AES-256-GCM (with auth tag) | Tampered ciphertext rejected at decrypt time |
| Random `vlt_` tokens | Rainbow-table attacks (no token↔Aadhaar dictionary possible) |
| Per-record fresh IV | Same Aadhaar across students produces different ciphertexts (no patterns) |
| `last4` in plaintext | Teachers can verify "yes, this is Ananya's record" without seeing raw |
| JWT service auth | Random internet caller can't burn Vault cycles or extract Aadhaar |
| TOTP MFA on detokenize | Stolen JWT alone can't reveal Aadhaar — human step-up required |
| HMAC audit chain | Insiders can't fabricate "this Aadhaar was never revealed" |
| Daily WORM anchor | Even with DB + KMS compromise, audit chain has external witness |

**Removing any one of these breaks the security model. Removing two is a compliance violation.**

### 21.9 Verifying This Works Without Trusting My Code

1. **Local dry-run:** `npm test vault.test.ts` — tokenize + detokenize round-trip works.
2. **Audit-chain tamper test:** `npm test audit-tamper.test.ts` — editing any audit row breaks chain on verify.
3. **End-to-end with DPDP auditor:** Open `/v1/audit?token=vlt_8f3a91` in browser; shows the full reveal history with HMAC verification. Auditor verifies the chain themselves.

---

## 22. Two-Track Identity Architecture (DigiLocker + Vault)

The FLN ecosystem supports **two enrollment tracks**, both converging on the Vault.

### 22.1 Why two tracks

DigiLocker is a *convenience* layer, not a *substitute* for Vault. It serves the 30-50% of families who are DigiLocker-active; the Vault serves the 100% — including the under-served 50-70% who can't or don't use DigiLocker.

| Population | Track | Aadhaar touches FLN? |
|---|---|---|
| Parents with smartphone + internet + literacy + DigiLocker-linked mobile | **Track 1: DigiLocker OAuth** | Yes (in DigiLocker's XML response) |
| Parents without any of those | **Track 2: Manual entry → Vault** | Yes (typed at enrollment) |
| Aadhaar-less children (~22% per `Research/National_status_report.md`) | **Track 3: Birth Certificate → Vault** | N/A — Vault handles as `BIRTH_CERTIFICATE` token type |

### 22.2 How DigiLocker can hinder (5 concrete ways)

1. **Vendor lock-in to DigiLocker's roadmap** — they can deprecate APIs, change OAuth scopes. Last major change: Sept 2024 added mandatory consent timestamps, breaking ~40% of integrations in one day.
2. **DigiLocker passes Aadhaar as plain text in XML** — the OAuth response contains `<uid>123412341234</uid>`. Without Vault, FLN stores the XML as-is (raw Aadhaar inside).
3. **Consent re-validation loop** — DigiLocker consent has a TTL. Parents forget DigiLocker credentials, change phones, lose access. This creates unbounded re-enrollment burden unless Vault tokens persist beyond OAuth refresh.
4. **Network dependency** — DigiLocker OAuth requires online auth. Schools in Jharkhand, Chhattisgarh, NE India, Ladakh frequently have 2G-or-no connectivity. **DigiLocker = hard offline fail. Vault = offline-tolerant (token stored locally, sync later).**
5. **Equitable access gap** — DigiLocker requires smartphone + internet + Aadhaar-linked mobile + literacy. ~22% of FLN's target population has 0 of those. Realistic DigiLocker reach: 30-50% of FLN's audience in next 3 years.

### 22.3 The enrollment flow — both tracks converging on Vault

```ts
// backend/src/routes/enroll.ts
app.post("/api/enroll", async (req, res) => {
  if (req.body.digilockerConsentToken) {
    // ─── Track 1: DigiLocker OAuth ────────────────────────
    const doc = await digilocker.fetchAadhaar(req.body.digilockerConsentToken);
    const { token, last4 } = await vault.tokenize({
      raw: doc.uid,
      type: "AADHAAR",
      context: {
        actorId: req.user.id,
        reason: "enrollment-via-digilocker",
        source: "DIGILOCKER",
        oauthConsentId: doc.consentId,
        oauthTimestamp: doc.consentTs,
      },
    });
    return res.json({ token, last4, source: "DIGILOCKER" });
  }

  if (req.body.aadhaarManual) {
    // ─── Track 2: Manual entry → Vault ────────────────────
    const { token, last4 } = await vault.tokenize({
      raw: req.body.aadhaarManual,
      type: "AADHAAR",
      context: {
        actorId: req.user.id,
        reason: "enrollment-manual",
        source: "MANUAL_PARENT_INPUT",
        parentSignatureHash: hash(req.body.parentSignatureBase64),
      },
    });
    return res.json({ token, last4, source: "MANUAL" });
  }

  if (req.body.birthCertManual) {
    // ─── Track 3: Birth Certificate fallback ──────────────
    const { token, last4 } = await vault.tokenize({
      raw: req.body.birthCertManual,
      type: "BIRTH_CERTIFICATE",
      context: {
        actorId: req.user.id,
        reason: "enrollment-birth-cert",
        source: "MANUAL_PARENT_INPUT",
        issuingAuthority: req.body.issuingAuthority,
        registrationDistrict: req.body.registrationDistrict,
      },
    });
    return res.json({ token, last4, source: "BIRTH_CERTIFICATE" });
  }

  res.status(400).json({ error: "Provide digilockerConsentToken OR aadhaarManual OR birthCertManual" });
});
```

**All three paths end at the Vault. DigiLocker doesn't bypass Vault — DigiLocker feeds Vault. Manual entry feeds Vault. Birth Cert feeds Vault. The Vault is the single trust boundary regardless of upstream.**

### 22.4 The deeper insight: Vault's mission alignment

The Vault isn't a compliance checkbox. It's a **structural commitment** that a child's identity is safe in FLN's system **regardless of how (or how easily) it got there.**

When a tribal community in Mandla, MP enrolls their kids and the teacher enters Aadhaar manually on a tablet because the parents have no DigiLocker account — **Vault is what makes that enrollment safe.**

When a school in Bengaluru uses DigiLocker OAuth because all parents are tech-literate — **Vault is still what makes the resulting data safe.**

**DigiLocker is the convenient door. Vault is the lock on the room behind the door.**

| | DigiLocker | Vault |
|---|---|---|
| Who it serves | Parents with smartphone + literacy + internet | **All parents, including the 30-50% who don't** |
| Whose identity it protects | The 70% of Aadhaar holders who are DigiLocker-active | **The 100% — including the marginalized 30%** |
| Purpose | Authentication + consent capture | **Identity protection for the people NIPUN Bharat / FLN is built to serve** |
| Whose failure it absorbs | DigiLocker downtime | **DPDP liability from any source** |

### 22.5 Offline-mode cache (v0.4 feature)

For schools with intermittent connectivity, the SDK supports an offline-mode cache:

```ts
// vault/sdk-node/index.ts
export class VaultClient {
  async tokenize(req: TokenizeRequest): Promise<TokenizeResponse> {
    if (this.offlineMode && !navigator.onLine) {
      // ─── Offline path: queue locally, sync later ─────────
      const localToken = "vlt_local_" + randomBytes(20).toString("hex");
      await localCache.set(localToken, { ...req, status: "QUEUED" });
      return { token: localToken, last4: req.raw.slice(-4), status: "QUEUED_FOR_SYNC" };
    }
    return this.httpPost("/v1/tokenize", req);
  }

  // Periodic sync job (every 5 min when online)
  async syncQueuedTokens(): Promise<{ synced: number; failed: number }> {
    if (!navigator.onLine) return { synced: 0, failed: 0 };
    let synced = 0, failed = 0;
    for await (const [localToken, queuedReq] of localCache.entries()) {
      try {
        const real = await this.httpPost("/v1/tokenize", queuedReq);
        await localCache.set(localToken, { ...queuedReq, realToken: real.token, status: "SYNCED" });
        synced++;
      } catch (e) {
        failed++;
      }
    }
    return { synced, failed };
  }
}
```

**Why this matters:** When a teacher in Jharkhand enrolls 30 students on Monday but the tablet has 1 bar of connectivity, the enrollments are queued locally. When connectivity returns Tuesday morning, the SDK auto-syncs. The Vault never loses data; the teacher never blocks on network.

### 22.6 Future enhancements

- **Consent refresh scheduler** (v0.3): re-prompt parents via DigiLocker every X months; Vault detects expiry and flags tokens needing re-verification.
- **Federated DigiLocker** (v0.5): one Vault can accept tokens fetched by another Vault (for state-federated deployments).
- **DigiLocker offline auth** (v0.5): cached OAuth tokens for low-connectivity scenarios, with re-auth on next online window.

---

## 📌 TL;DR (1 paragraph)

The **Aadhaar Vault** is a **standalone microservice** that turns Aadhaar / Birth-Certificate / Govt-ID numbers into **opaque, KMS-protected tokens** that no other service can reverse. It runs on its own port (4101), uses its own Mongo DB, integrates with AWS/GCP/Azure KMS for master key protection, logs every read in a tamper-evident audit chain, and requires Superadmin MFA + reason for any detokenize. **Zero modifications** to the existing FLN repo are needed — it works standalone today and survives any backend rebuild because tokens are self-describing (`vlt_v1_*`) and the API contract is OpenAPI-versioned. **Effort: 5–8 days for MVP.** **Collision risk with new backend team: ~5%** (compliance work is painful; they'll keep doing masking). This is the lowest-collision, highest-compliance-ROI feature in the FLN backlog.

---

*Document version: v0.1 · Author: Aadhaar Vault pitch · Status: proposed microservice, awaiting implementation*