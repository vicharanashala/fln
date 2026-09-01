# ONBOARDING — Kartik Nath Khatri

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy** — the ability to read with comprehension and perform basic arithmetic, including letter and word recognition, reading fluency, basic comprehension, number sense, and simple operations. It broadly covers the foundational years from pre-school through Grade 3.

FLN is the foundation for later learning. If a child does not develop these skills early, difficulties can compound into later academic struggles, repetition, and dropout.

The platform serves **students, teachers, schools, volunteers, and administrators** across block, district, state, and superadmin levels. Its purpose is to help schools and teachers:

1. assess where each student currently stands in FLN,
2. act on that assessment through targeted learning and remediation, and
3. track progress over time.

The platform therefore connects assessment, remediation, worksheets, evaluation, certification, identity, and role-based administration into a single education technology system.

---

## 2. What do you understand by FLN as a system?

I understand FLN as a connected system of users, organizations, identity, assessment, remediation, and progress tracking.

### Users and Roles

The platform contains multiple roles:

- Superadmin
- State / district / block administrators
- School administrators
- Teachers
- Volunteers
- Students

Each role receives access to the subset of students and functionality relevant to its responsibilities.

### Organizational Structure

The platform models an educational hierarchy:

```text
State
  │
  └── District
        │
        └── Block
              │
              └── School
                    │
                    └── Class / Section
                          │
                          └── Student
```

Students are associated with schools and teachers through the application's organizational relationships.

### Student Identity

Aadhaar is a sensitive identity attribute associated with students.

The important architectural requirement is that the main FLN application should **not need to store plaintext Aadhaar** merely to identify a student or perform duplicate detection.

This led to the Aadhaar Vault architecture described later in this document.

### Assessment

The platform contains a diagnostic assessment workflow where FLN papers are generated and evaluated.

The assessment pipeline can:

```text
Generate Assessment
        ↓
Student Attempts Assessment
        ↓
Evaluate Answers
        ↓
Determine Learning Level
        ↓
Update Student Progress
```

Student progress includes concepts such as:

- current learning level,
- level history,
- streaks,
- remediation level.

### Worksheets and OCR / ICR

The platform can generate personalized worksheets, which can then be printed, completed, scanned, and processed using optical / ink recognition pipelines.

### Certification

When a student satisfies the relevant FLN qualification criteria, the platform can generate a certificate.

### Supporting Systems

The wider platform also contains:

- announcements,
- support tickets,
- evaluation reports,
- dashboards,
- role-scoped views,
- generation controls,
- timing restrictions,
- assessment attempt governance.

These components communicate through REST APIs and frontend applications, with important governance rules enforced server-side.

---

## 3. Current State of the Repository

This section describes the repository as it stands on the main branch — the shared baseline this contribution builds on. The Aadhaar Vault itself does not exist on main; it is introduced by this contribution in the sections that follow.

### Technology Stack

The main platform uses a MERN-based architecture:

- MongoDB
- Express
- React
- Node.js

Additional components include:

- React + TypeScript + Vite frontend
- Express backend
- Python-based evaluation / level-placement services

There is currently no dedicated identity service. Sensitive student identifiers are handled directly inside the main application and stored alongside regular application data.

### Backend

The main backend lives under:

```text
backend/src/
```

with route modules for students, worksheets, evaluation, analytics, diagnostics, tickets, announcements, schools, teachers, classes, interventions, logbook, geo, stats, best practices, and administration.

It uses MongoDB as its primary store, with a local JSON fallback:

```text
data/db.json
```

### Frontend

The main frontend lives under:

```text
frontend/src/
```

built with Vite and Tailwind CSS. It combines real API integrations (`services/apiClient.ts`) with direct browser `localStorage` persistence in several components, so not every workflow reaches the backend today.

### AI / Evaluation Services

Python services under:

```text
ai-services/
```

support answer comparison, evaluation, report generation, and learning-level placement workflows.

### Authentication

The main backend uses JWT-based authentication:

- login verifies email and password against bcrypt hashes,
- password-complexity rules are enforced,
- login attempts are rate-limited,
- seeded development accounts share a demo password,
- each issued JWT is verified on every subsequent request.

### Database

The main FLN application uses a single MongoDB database for everything — including student identity fields such as the Aadhaar value discussed in the next section.

There is no separate datastore providing an isolated security boundary for sensitive identity data.

### Development Ports

The local development setup currently uses:

```text
Frontend     : 5173   (Vite default)
Main Backend : 3000   (code default in backend/src/index.ts)
```

---

# 4. Gap Identified in the Existing System

## GAP-1 — Raw Aadhaar Stored in the Main Application Database

The primary security problem identified was that the main FLN backend previously persisted the complete Aadhaar number in the student record.

The registration path accepted an Aadhaar number, normalized it to digits, and stored the value in the student's MongoDB document.

The field was named:

```text
aadharMasked
```

but the stored value could contain the complete plaintext Aadhaar.

### Why this is a problem

Aadhaar is highly sensitive identity information.

Keeping plaintext Aadhaar inside the primary application database creates unnecessary exposure through:

- database compromise,
- backups,
- accidental exports,
- over-permissioned database access,
- application-level reads,
- debugging and operational tooling.

It also creates a misleading data contract because a field named `aadharMasked` should not contain an unmasked 12-digit identifier.

### Duplicate Detection Problem

The original system also relied on scanning student records to compare Aadhaar values for duplicate detection.

That creates two problems:

1. plaintext Aadhaar must remain available to perform the comparison;
2. scanning the entire student collection does not scale well.

The system therefore needed a privacy-preserving identity mechanism that could identify the same Aadhaar without requiring the main application to store or compare plaintext Aadhaar.

---

# 5. Project Idea — Secure Aadhaar Vault

## One Core Idea

### Build a dedicated security boundary around Aadhaar.

Instead of allowing the main FLN application to store raw Aadhaar, a dedicated Aadhaar Vault handles:

- Aadhaar tokenization,
- encrypted storage,
- deterministic identity generation,
- duplicate detection,
- controlled plaintext release,
- MFA-protected Step-Up authorization,
- audit logging.

The main application stores only the opaque Vault token, derived identity identifier, and Aadhaar mask; plaintext Aadhaar remains within the Vault security boundary.

The architecture becomes:

```text
                 FLN Application
                       │
                       │ Raw Aadhaar
                       ▼
               ┌─────────────────┐
               │  Aadhaar Vault  │
               └─────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Encrypt       Identity      Token
       PII            ID          ID
          │            │            │
          └────────────┼────────────┘
                       ▼
                Vault PostgreSQL
```

The main application's database stores only the information it needs to reference the identity:

```text
Aadhaar Mask
Vault Token ID
Aadhaar Identity ID
```

The plaintext Aadhaar remains inside the Vault's protected storage boundary.

---

# 6. Aadhaar Tokenization Flow

The registration process becomes:

```text
Student Registration
        │
        ▼
Main FLN Backend
        │
        │ Aadhaar
        ▼
POST /v1/tokenize
        │
        ▼
Aadhaar Vault
        │
        ├── Validate Aadhaar
        │
        ├── Generate identity identifier
        │
        ├── Generate DEK
        │
        ├── Encrypt Aadhaar
        │
        ├── Protect DEK
        │
        ├── Generate Vault Token
        │
        └── Write Audit Event
        │
        ▼
Main FLN Backend
        │
        └── Store:
             • mask
             • token ID
             • identity ID
```

The important security property is:

> **The main FLN database no longer needs plaintext Aadhaar to represent or reference the student identity.**

---

# 7. Encryption Architecture

The Vault uses envelope encryption.

At a high level:

```text
Plain Aadhaar
      │
      ▼
Generated Data Encryption Key
      │
      ▼
AES-256-GCM
      │
      ▼
Ciphertext + IV + Authentication Tag
```

The data encryption key is then protected through the Vault's KeyManager abstraction.

The current development implementation uses:

```text
HKDF-SHA-256
        +
AES-256-GCM
```

The KeyManager is intentionally abstracted so that a production KMS-backed implementation can be introduced separately.

The local development key provider is not intended to be the final production key-management solution.

The encrypted database record therefore contains the encrypted representation rather than plaintext Aadhaar.

---

# 8. Deterministic Identity and Duplicate Detection

Tokenization alone is not enough.

The FLN platform still needs to determine whether a student with the same Aadhaar already exists.

The Vault therefore provides a deterministic identity identifier associated with the Aadhaar.

The main backend can use:

```text
aadhaarIdentityId
```

for duplicate detection without storing or comparing plaintext Aadhaar.

The resulting flow is:

```text
New Aadhaar
     │
     ▼
Vault Tokenization
     │
     ▼
Identity ID
     │
     ▼
Check existing identity IDs
     │
     ├── Already exists → reject duplicate
     │
     └── New identity → continue registration
```

This makes duplicate detection independent of the visible Aadhaar mask.

For example, two Aadhaar numbers ending in the same four digits must not be treated as duplicates merely because their masks are identical.

The identity identifier provides the required distinction.

---

# 9. Controlled Detokenization

Tokenization is intentionally easier to perform than detokenization.

Tokenization creates an opaque reference.

Detokenization releases the original sensitive value.

Therefore the two operations have different security requirements.

The detokenization flow is:

```text
Vault Token
     │
     ▼
Request Step-Up
     │
     ▼
Short-lived Challenge
     │
     ▼
TOTP Approval
     │
     ▼
Approved Challenge
     │
     ▼
Detokenize
     │
     ▼
Plain Aadhaar
```

The Vault does not treat possession of a token alone as sufficient to release plaintext.

A valid authenticated caller must also satisfy the Step-Up authorization flow.

---

# 10. Step-Up Security Model

The Step-Up mechanism introduces a second authorization boundary around plaintext release.

The flow is:

### Step 1 — MFA Enrollment

The authorized developer/operator enrolls a temporary TOTP factor.

The Vault returns:

```text
Factor ID
OTP URI
Creation information
```

The developer console can derive the current TOTP from the URI for development purposes.

### Step 2 — Request Step-Up

The caller requests permission to detokenize a particular token.

The Vault creates a short-lived challenge associated with the authenticated actor and MFA factor.

### Step 3 — Approve Challenge

The current TOTP is submitted to the challenge approval endpoint.

The Vault validates the factor and code.

A successful approval transitions the challenge to:

```text
APPROVED
```

### Step 4 — Detokenize

The caller submits the approved challenge.

The Vault atomically consumes the challenge before returning plaintext.

The intended state transition is:

```text
PENDING
   │
   ▼
APPROVED
   │
   ▼
CONSUMED
```

A consumed challenge cannot be reused.

An expired challenge cannot be approved or consumed.

This provides replay protection around plaintext release.

---

# 11. Authentication vs Authorization

An important architectural distinction is maintained between:

### JWT Authentication

The JWT identifies the caller.

The JWT `sub` represents the authenticated principal.

It does not represent the Aadhaar owner.

It does not represent the Vault token.

It is the identity of the caller making the request.

### Authorization

JWT scopes determine which API operations the caller can attempt.

For example:

```text
vault:tokenize
vault:detokenize
vault:mfa:enroll
vault:mfa:verify
vault:audit
```

The literal JWT subject is not intended to be a hardcoded identifier such as `tester-001`.

The Vault separates authentication, scope authorization, and Step-Up authentication. A production deployment must additionally enforce a trusted policy defining which principals are actually entitled to release plaintext Aadhaar.

### MFA / Step-Up

MFA provides an additional proof for sensitive operations.

It does not replace authorization.

The security model is therefore:

```text
Authentication
      +
Authorization
      +
Step-Up Authentication
      +
Challenge State
      ↓
Sensitive Detokenization
```

---

# 12. Audit Logging

Security-sensitive Vault operations produce audit records.

The authenticated JWT subject is used as the actor associated with the event.

This allows the system to answer:

```text
Who performed the operation?
When did it happen?
What operation occurred?
Which token/challenge was involved?
What was the result?
```

The current audit implementation is append-only.

A future enhancement may introduce a cryptographically hash-chained tamper-evident audit log, but that is **not currently implemented** and should not be described as a completed feature.

---

# 13. Main FLN Backend Integration

The Vault is not useful if the main registration path continues storing plaintext Aadhaar.

The registration flow was therefore changed so that:

```text
POST /api/students
        │
        ▼
Validate Aadhaar
        │
        ▼
Vault tokenize
        │
        ▼
Receive:
  token ID
  identity ID
  mask
        │
        ▼
Store only non-plaintext references
        │
        ▼
MongoDB
```

The same approach is applied to the CSV bulk-import path through the shared student-creation logic.

If the Vault is unavailable, registration fails rather than falling back to storing plaintext Aadhaar.

This preserves the security boundary instead of silently weakening it when the Vault cannot be reached.

---

# 14. Developer Console

The Vault contains a dedicated developer console for demonstrating and testing the two major operations.

## Tokenization Console

The main console focuses on:

```text
Aadhaar
   ↓
Tokenization
   ↓
Vault Token
```

It demonstrates the creation of an opaque Vault token without exposing detokenization controls in the same workflow.

## Step-Up Detokenization Console

The dedicated Step-Up console handles:

```text
Select Token
      ↓
Enroll MFA
      ↓
Request Step-Up
      ↓
Approve Challenge
      ↓
Detokenize
```

This separation makes the security boundary visible to developers.

The tokenization console and sensitive detokenization console are therefore treated as separate developer workflows.

---

# 15. Backend API Surface

The Aadhaar Vault currently exposes the following major operations:

### Tokenization

```http
POST /v1/tokenize
```

Creates an encrypted Vault record and returns an opaque token.

### MFA Enrollment

```http
POST /v1/mfa/enroll
```

Creates an MFA factor for Step-Up operations.

### Step-Up Request

```http
POST /v1/detokenize/request
```

Creates a short-lived detokenization challenge.

### Challenge Approval

```http
POST /v1/detokenize/step-up/:challengeId/approve
```

Approves the challenge using TOTP.

### Detokenization

```http
POST /v1/detokenize
```

Consumes an approved challenge and releases plaintext.

### Audit

```http
GET /v1/audit
```

Provides authorized access to Vault audit information.

### Health

```http
GET /health
GET /health/ready
```

Provides service and dependency readiness information.

---

# 16. Security Properties

The implementation is designed around several important security properties.

### Plaintext isolation

The main application's MongoDB does not need to store plaintext Aadhaar.

### Encryption at rest

Vault records contain encrypted Aadhaar using AES-256-GCM.

### Key separation

Data encryption is separated from the KeyManager abstraction.

### Authentication

Vault APIs require validated bearer JWTs where appropriate.

### Scope-based authorization

Routes enforce the required Vault scopes.

### Step-Up protection

Sensitive plaintext release requires an additional challenge approval.

### Replay protection

Challenges are consumed atomically and cannot be reused.

### Expiry

Step-Up challenges have limited validity.

### Actor binding

Challenges are associated with the authenticated actor and required factor.

### Auditability

Sensitive operations produce audit records.

### Logging protection

Aadhaar-shaped 12-digit values are redacted from application logs.

---

# 17. Contribution

The contribution was delivered through:

**PR #114 — `feat: secure Aadhaar tokenization and step-up detokenization`**

The contribution introduces a standalone Aadhaar Vault security boundary for the FLN platform.

### Core implementation

- Built a Fastify + PostgreSQL microservice dedicated to sensitive Aadhaar storage.
- Replaced direct plaintext Aadhaar persistence with opaque Vault tokens and derived identity identifiers.
- Implemented envelope encryption using AES-256-GCM with the KeyManager abstraction and HKDF-SHA-256 development key derivation.
- Added deterministic identity generation to support privacy-preserving duplicate detection.
- Implemented JWT authentication and route-level scope authorization.
- Added TOTP-based MFA and short-lived Step-Up challenges for sensitive detokenization.
- Added actor/factor binding, challenge expiry, replay protection, and single-use challenge consumption.
- Added append-only audit logging and Aadhaar-shaped value redaction from logs.
- Integrated the Vault with the FLN student registration and CSV import paths.
- Built dedicated developer consoles for tokenization and Step-Up detokenization.
- Added automated tests covering cryptographic operations, API routes, challenge handling, replay protection, and end-to-end workflows.

---

# 18. Current Test and Implementation Status

The Vault has been exercised through unit, integration, and end-to-end testing.

The tested areas include:

- cryptographic operations,
- tokenization,
- MFA operations,
- challenge creation,
- challenge approval,
- challenge expiry,
- replay protection,
- actor/factor binding,
- detokenization,
- audit operations,
- developer-console workflows.

At the time of this onboarding document, the repository contained **25 Vitest suites and 377 tests**, with known failures concentrated in test-fixture/schema drift and stale console assertions rather than the core tokenization and cryptographic paths.

These failures should be treated as known repository status rather than silently presented as a completely green test suite.

---

# 19. Important Current Limitations

The following should not be presented as completed features:

### Production KMS

The current development KeyManager uses a local development implementation.

A production KMS-backed implementation remains a future deployment concern.

### Tamper-evident audit chain

The architecture has considered a hash-chained audit log, but the current audit table is append-only and does not yet implement the complete hash chain.

### Production MFA lifecycle

The developer console currently demonstrates the complete MFA / Step-Up workflow in developer mode.

A production deployment would require a proper long-lived operator MFA enrollment and lifecycle rather than treating every developer workflow as a fresh factor-enrollment experience.

### Authorization policy

Authentication, scopes, MFA, and Step-Up are separate concepts. Production deployment must ensure that possession of a valid JWT and ability to complete MFA is not treated as an unrestricted entitlement to view plaintext Aadhaar.

---

# 20. Overall Understanding

The most important thing I learned from this contribution is that protecting sensitive identity data is not simply an encryption problem.

The security boundary has to exist across the entire lifecycle:

```text
                    Aadhaar
                       │
                       ▼
                 Tokenization
                       │
                       ▼
                 Encryption
                       │
                       ▼
              Protected Vault
                       │
                       ▼
                 Opaque Token
                       │
              ┌────────┴────────┐
              │                 │
         Normal usage       Sensitive access
                                │
                                ▼
                         Step-Up Challenge
                                │
                                ▼
                             TOTP
                                │
                                ▼
                         Approval
                                │
                                ▼
                       Single-use Consume
                                │
                                ▼
                         Plain Aadhaar
                                │
                                ▼
                             Audit
```

The core architectural principle is:

> **The main application should work with an opaque identity reference, while plaintext Aadhaar remains inside a dedicated security boundary and can only be released through an explicitly authorized, audited, step-up-protected workflow.**

This is the central idea behind the Aadhaar Vault contribution.
