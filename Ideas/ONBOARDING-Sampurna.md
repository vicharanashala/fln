# Contributor Onboarding: FLN Assessment & Remediation Platform

**Contributor:** Sampurna  
**Target Repository:** vicharanashala/fln  
**Focus Area:** Backend Architecture, Security & Rate Limiting, Aadhaar Vault, Assessment Delivery & Diagnostics  

---

## 1. What is FLN?

**FLN** stands for **Foundational Literacy and Numeracy**. In primary education—specifically focusing on children from Balvatika (the year before Class 1) up to Class 3—foundational literacy and numeracy represent the indispensable cognitive bridge required for all subsequent learning. The educational core of the FLN initiative (aligned with national mandates like NIPUN Bharat) is grounded in a simple pedagogical truth: a child who has not attained foundational competency in number recognition, place value, basic arithmetic, and reading comprehension cannot successfully engage with higher-grade curricula.

### The Educational Problem

In traditional classroom ecosystems, especially within low-resource government schools:
1. **The Compounding Learning Gap**: Children are conventionally evaluated through infrequent, high-stakes summative exams and promoted by age/grade cohorts regardless of their actual conceptual mastery. A student who struggles with single-digit addition in Class 2 is promoted to Class 3, where two-digit addition and place value are taught. Without foundational mastery, the student falls further behind each year, leading to math anxiety, disengagement, and eventual dropout.
2. **Mixed-Ability Classrooms Without Tooling**: A single primary teacher often teaches a diverse group of 30 to 50 students whose numeracy proficiencies span several grade levels. Without automated diagnostic tools, teachers cannot identify where each child's frontier of development lies, nor can they feasibly prepare personalized practice sheets tailored to each student's specific gaps.
3. **The Digital Divide**: In rural and public schools across India, students do not have personal laptops, tablets, or consistent internet access. Fully digital educational apps fail in these settings because physical devices are unavailable at the student desk.

### The Purpose of the FLN Platform

The FLN platform bridges this divide through an intelligent **hybrid paper-and-cloud architecture**:
- **Granular Progression**: Rather than arbitrary pass/fail marks, students advance across a developmental continuum of 109 numeracy levels spanning Stages 1 through 7 (from early perceptual counting to multi-digit division and fractions).
- **Dynamic Paper Generation**: The system dynamically generates individualized paper worksheets featuring unique QR codes and individualized questions tailored to each child's current level.
- **Optical Ingestion & AI Diagnostic Evaluation**: Completed worksheets are scanned or photographed by teachers using ICR/OCR scanning pipelines (`ai-services/`). An AI engine evaluates student work, classifies errors, identifies conceptual misconceptions, and computes the student's next instructional level.
- **Data-Driven Governance**: Aggregates learning telemetry through multi-tiered administrative levels (from classroom to national superadmin) to provide actionable visibility into systemic learning gaps.

---

## 2. What do you understand by FLN as a system?

FLN is a distributed, multi-stakeholder diagnostic and remediation platform connecting physical classroom paper assessments with cloud-based diagnostic evaluation.

### Key Actors and Governance Roles

The system is governed by a strict 7-tier role-based access control (RBAC) hierarchy defined in `backend/src/db.ts` (`UserRole`) and enforced via authentication middleware (`getAuthUser` and `canAccessStudent` in `backend/src/auth.ts`):

| Role | Operational Boundary | Primary System Responsibilities |
|---|---|---|
| `SUPERADMIN` | National / Global | Manages global curriculum frameworks, authors question templates, configures system parameters, oversees nationwide telemetry. |
| `ADMIN` | State level | High-level regional oversight, state-wide school and district analytics, managing state compliance. |
| `DISTRICT_ADMIN` | District level | District analytics, monitoring school compliance and performance across constituent blocks. |
| `BLOCK_ADMIN` | Block / Sub-district | Operational monitoring of schools and clusters within a specific administrative block. |
| `SCHOOL` | Single institution | School principal dashboard, teacher allocation, institutional student roster management. |
| `TEACHER` | Class / School | Classroom instruction, generating printable worksheets, administering exams, scanning student work, reviewing AI evaluations. |
| `VOLUNTEER` | Assigned schools | Field assessment duty strictly limited to schools in their `assignedSchools` list. |

### Core Entities and Data Relationships

```
                     ┌──────────────────┐
                     │      School      │
                     └────────┬─────────┘
                              │ 1:N
                     ┌────────▼─────────┐
                     │    ClassGroup    │
                     └────────┬─────────┘
                              │ 1:N
                     ┌────────▼─────────┐
                     │     Student      │◄──────────┐
                     └────────┬─────────┘           │
                              │ 1:N                 │
┌──────────────────────┐      │                     │
│   QuestionTemplate   │      │                     │
└──────────┬───────────┘      │                     │
           │ 1:N              │                     │
┌──────────▼───────────┐      │                     │
│      Worksheet       ├──────┼─────────────────────┤
│ (Timing, Cycle Locks)│      │                     │
└──────────┬───────────┘      │                     │
           │                  │                     │
           ▼                  ▼                     │
┌───────────────────────────────────────┐           │
│           AnswerSubmission            │           │
│        (Raw Student Responses)        │           │
└──────────────────┬────────────────────┘           │
                   │                                │
                   ▼                                │
┌───────────────────────────────────────┐           │
│           EvaluationReport            ├───────────┘
│(Scores, Gaps, Recommended Next Level) │ (Updates Level & Progress)
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│         MisconceptionCluster          │
│   (Pedagogical Archetype Grouping)    │
└───────────────────────────────────────┘
```

1. **Student** (`backend/src/db.ts`): Core learner entity tracking `currentLevel`, `targetLevel`, `levelHistory`, attendance, and demographic metadata. PII is safeguarded; national identifiers are tokenized (`aadhaarTokenId`, `aadharMasked`) via the Aadhaar Vault.
2. **School & ClassGroup**: Establish geographic and institutional boundaries, isolating student rosters and governing teacher authorization.
3. **QuestionTemplate & QuestionBank**: Reusable assessment items authored by superadmins with metadata: `skills`, `difficulty`, `tags`, and `assessmentMode` (`written`, `observed`, or `both`).
4. **Worksheet**: Generated question sets constrained by assessment cycle locks (`Baseline`, `Mid-year`, `End-of-year`) and timing windows (`printWindow`, `submissionWindow`).
5. **AnswerSubmission**: Captures raw student responses per question, preserving handwriting scan results or manual entry.
6. **EvaluationReport**: Stores evaluated assessment outcomes (question correctness, skill mastery, detected root causes, and recommended next level), driving level promotion.
7. **Aadhaar Vault**: High-security, fail-closed cryptographic tokenization module using envelope encryption (AES-256-GCM) with TOTP-based step-up multi-factor authentication (MFA).

---

## 3. Current State of the Repository — What Has Been Done So Far

The FLN repository is structured as an **npm-workspaces monorepo** consisting of three active codebases:

| Workspace / Directory | Tech Stack | Responsibilities |
|---|---|---|
| `frontend/` (`@fln/frontend`) | React 19, Vite, Tailwind CSS, TanStack Query | Client application serving interactive dashboards across all 7 roles, ICR scanning interfaces, and curriculum/question authoring panels. Proxies `/api/*` requests to `:3000`. |
| `backend/` (`@fln/backend`) | Node.js, Express, TypeScript, native MongoDB driver, Puppeteer, esbuild | Modular Express REST API handling authentication, student records, worksheet PDF rendering, and vault encryption. |
| `backend/fln-backend/` (`fln-worksheet-backend`) | Node.js, Express, Puppeteer | Batch-generates personalised worksheets, answer keys, and OMR coordinates by driving headless browser rendering. |
| `ai-services/` | Python 3, Google Gemini API, PyMuPDF, OCR | Computer vision and AI scoring pipeline that extracts handwriting from scanned worksheets and classifies errors. |

### Architectural Highlights

1. **Modular Backend Routes**: The backend API has moved away from monolithic server files into modular route controllers located in `backend/src/routes/` (`auth.ts`, `students.ts`, `schools.ts`, `mfaEnrollment.ts`, `aadhaarDetokenize.ts`, `worksheets.ts`, `evaluation.ts`, etc.), registered during application bootstrap in `backend/src/index.ts`.
2. **Dual-Mode Persistence**: Primary production storage utilizes MongoDB with multi-document transactions. For offline local development and testing, `dbStore` (`backend/src/db.ts`) seamlessly falls back to a file-based storage engine (`backend/data/db.json`).
3. **Aadhaar Vault & MFA Step-Up**: Strict cryptographic tokenization using AES-256-GCM envelope encryption with HKDF-derived keys. Plaintext Aadhaar numbers never reside in the main database. Revealing a student's Aadhaar requires an administrative Step-Up challenge verified against an enrolled TOTP authenticator (`backend/src/routes/mfaEnrollment.ts` and `aadhaarDetokenize.ts`).
4. **Automated Curriculum DAG Validation**: At server startup, `validateConceptPrerequisites()` (`backend/src/competencyPrerequisites.ts`) compiles and validates the entire 109-level curriculum prerequisite directed acyclic graph (DAG), ensuring zero cycles and zero dangling concept IDs before the server accepts traffic.

---

## 4. Gaps Observed in the Code

During thorough exploration and testing of the repository, the following architectural, security, and usability gaps were identified:

### Gap 1: Missing Rate Limiting and Reverse Proxy IP Trust on MFA and Aadhaar Detokenization Endpoints
- **Location**:
  - `backend/src/index.ts` (line 243)
  - `backend/src/routes/mfaEnrollment.ts` (lines 163, 300)
  - `backend/src/routes/aadhaarDetokenize.ts` (lines 204, 266, 306)
- **What**:
  1. The authentication rate limiter (`authRateLimiter`, configured in `backend/src/config.ts` to allow 50 requests per 15 minutes) was only applied to `POST /api/auth/login`. The sensitive routes that check TOTP codes, mint step-up challenges, and reveal Aadhaar numbers (`/api/me/mfa/enroll`, `/api/me/mfa/verify`, `/api/students/:id/aadhaar/step-up/request`, `/api/students/:id/aadhaar/step-up/approve`, and `/api/students/:id/aadhaar/detokenize`) had **zero rate limiting**.
  2. The Express server never called `app.set('trust proxy', 1)`. In production deployments sitting behind a reverse proxy (e.g., Nginx), Express reads the proxy's IP address rather than the client's actual IP forwarded in `X-Forwarded-For`.
- **Why it matters**:
  - A 6-digit TOTP code has 1,000,000 possible combinations. Without rate limiting, an attacker with stolen credentials could execute automated brute-force attacks against the step-up approval route to detokenize sensitive citizen Aadhaar data.
  - Without `trust proxy`, all client requests forwarded by Nginx share the single proxy IP address in the eyes of Express. Consequently, all users across the system would share a single rate-limiting bucket (leading to collective denial-of-service on legitimate users) while making it impossible to single out and block a specific malicious IP.
- **Reference**: GitHub Issue **#753**.

### Gap 2: Misleading School Metric Card in AnalyticsPanel During Loading, Error, and Empty States
- **Location**:
  - `frontend/src/components/panels/AnalyticsPanel.tsx` (lines 35, 43, 51)
- **What**:
  - On the Analytics dashboard for school principals and teachers, the top summary card displays `"Total Schools: 0 — Assigned facility"` even while the schools API (`/api/schools`) is still loading, has failed with a network/server error, or returned an empty array (`"No school data available"`), showing `0` in those states.
  - The calculation on line 35 derived the count from `currentUser.schoolId`:
    ```ts
    const totalSchoolsCount = isPrincipal ? (currentUser.schoolId ? (schools.some(s => s.id === currentUser.schoolId) ? 1 : 0) : 0) : schools.length;
    ```
    This now evaluates to `0` while the schools list is loading, when it fails, and when it is empty, because the card does not look at the loading or error state. The card should show "—" in the first two cases and `0` only when the list is really empty.
- **Why it matters**:
  - Confuses educators by presenting contradictory UI states: the summary card claims a school exists (`Total Schools: 1`) while the table directly below displays an error banner (`"Failed to load schools"`) or an empty notice.
  - Violates UI state honesty; metric cards should accurately reflect backend data status.
- **Reference**: GitHub Issue **#695**.

### Gap 3: Absence of Automated Integration Tests for School Onboarding API
- **Location**:
  - `backend/src/routes/schools.ts` (`POST /api/schools`)
  - `backend/tests/`
- **What**:
  - PR #662 introduced school onboarding (`POST /api/schools`), which creates a school entity, registers a principal user account with bcrypt password hashing, and seeds initial class groups.
  - However, no automated regression tests were created for this workflow. There was no verification for role authorization (rejecting teachers and unauthenticated callers with `403`), duplicate prevention (preventing duplicate school IDs, UDISE codes, and principal emails with `400`), payload validation (6-digit PIN, 11-digit UDISE, valid establishment year, password complexity), and security leak prevention (ensuring neither plaintext passwords nor `passwordHash` are returned in the response).
- **Why it matters**:
  - School onboarding is a foundational administrative workflow. Without automated tests, future changes to user models, database schemas, or route validators can silently break school registration or compromise credentials without detection.
- **Reference**: GitHub Issue **#698**.

### Gap 4: Non-Atomic Full-Collection Persistence in DBStore
- **Location**:
  - `backend/src/db.ts` (`persistCollection`, lines 1497–1508; `save`, lines 1492–1495)
- **What**:
  - When persisting changes to MongoDB, `persistCollection(key)` executes a `deleteMany({})` followed by `insertMany(items)` over the entire collection. In file storage mode, `save()` rewrites the entire `data/db.json` file.
- **Why it matters**:
  - Deleting and reinserting full collections is non-atomic and creates substantial I/O overhead. Under concurrent write requests, this introduces race conditions where transient reads may encounter empty collections or data overwrites.

---

## 5. Ideas for the Project

### Idea 1: Rate Limiting & Proxy Trust Hardening for All Sensitive Routes (Addresses Gap 1)
- **What**: Configure `app.set('trust proxy', 1)` in Express and apply `authRateLimiter` middleware to all endpoints handling authentication, MFA enrollment/verification, and Aadhaar detokenization step-up challenges.
- **Why**: Throttles brute-force attempts to 50 requests per 15-minute window per genuine client IP address. Hardens the Aadhaar Vault against automated dictionary attacks and ensures rate limiters operate reliably behind Nginx.
- **How**:
  1. Add `app.set('trust proxy', 1);` immediately after Express initialization in `backend/src/index.ts`.
  2. Import and attach `authRateLimiter` to `/api/me/mfa/enroll` and `/api/me/mfa/verify` in `backend/src/routes/mfaEnrollment.ts`.
  3. Attach `authRateLimiter` to `/api/students/:id/aadhaar/step-up/request`, `/approve`, and `/detokenize` in `backend/src/routes/aadhaarDetokenize.ts`.
  4. Author automated unit tests to verify middleware binding on all sensitive routes.

### Idea 2: Robust Data-Driven Metrics and Loading Placeholders in AnalyticsPanel (Addresses Gap 2)
- **What**: Update `AnalyticsPanel.tsx` to base metric card numbers on scoped, resolved API responses (`data.length`) rather than static user metadata.
- **Why**: Ensures visual consistency and prevents false counts when data is unavailable or loading.
- **How**:
  1. Update `totalSchoolsCount` to return a dash (`"—"`) when `schoolsLoading` is true or `schoolsError` is set.
  2. Render `0` when the fetched data array is empty (`data.length === 0`).
  3. Author Vitest unit tests to assert correct rendering across loading, error, empty, and populated states.

### Idea 3: Comprehensive Automated Integration Test Suite for School Onboarding (Addresses Gap 3)
- **What**: Construct an isolated integration test file `backend/tests/school-onboarding.test.ts` modeled after `backend/tests/choice-error-tags.test.ts`.
- **Why**: Guarantees that future modifications do not break school creation, authorization barriers, or credential hashing.
- **How**:
  1. Set up an isolated test Express server with temporary file storage (`process.chdir(tmpDir)`).
  2. Test valid school onboarding with superadmin credentials and verify database entity creation.
  3. Assert `403 Forbidden` for unauthorized roles (teacher, school admin, unauthenticated).
  4. Assert `400 Bad Request` for duplicate school IDs, duplicate UDISE codes, duplicate principal emails, and invalid input formats (non-6-digit PIN, non-11-digit UDISE, invalid year).
  5. Assert that JSON responses never leak `passwordHash` or plaintext passwords.
  6. Add `"test:school-onboarding"` to `backend/package.json`.

---

## 6. Your Contribution

As part of my onboarding contribution to the FLN project, I focused on resolving **Issue #753: Trust the proxy and rate-limit the code-checking routes**.

### Summary of Implementation

#### 1. Enabled Reverse Proxy IP Trust (`backend/src/index.ts`)
Configured Express to trust the first upstream reverse proxy (Nginx):
```ts
const app = express();
app.set('trust proxy', 1);
```
This ensures that `req.ip` reflects the actual client IP address forwarded via the `X-Forwarded-For` header rather than the local reverse proxy address.

#### 2. Applied Rate Limiting to MFA Enrollment & Verification (`backend/src/routes/mfaEnrollment.ts`)
Imported `authRateLimiter` from `../config` and bound it as middleware to both factor creation and TOTP code verification routes:
- `POST /api/me/mfa/enroll` (lines 163)
- `POST /api/me/mfa/verify` (lines 300)

#### 3. Applied Rate Limiting to Aadhaar Detokenization Step-Up Routes (`backend/src/routes/aadhaarDetokenize.ts`)
Secured all three stages of the Aadhaar reveal pipeline with `authRateLimiter`:
- `POST /api/students/:id/aadhaar/step-up/request` (lines 204) — Throttles step-up challenge creation.
- `POST /api/students/:id/aadhaar/step-up/approve` (lines 266) — Throttles TOTP verification to defend against brute-force guessing.
- `POST /api/students/:id/aadhaar/detokenize` (lines 306) — Throttles plaintext Aadhaar retrieval.

#### 4. Authored Comprehensive Unit Test Suite (`backend/tests/rate-limiting-secret-routes.test.ts`)
Created an automated test suite verifying:
- `authRateLimiter` middleware is actively attached to all 5 sensitive routes (`/api/me/mfa/enroll`, `/api/me/mfa/verify`, `/api/students/:id/aadhaar/step-up/request`, `/approve`, `/detokenize`).
- Non-secret routes (such as factor listing and deprecation envelopes) are not erroneously throttled.
- `backend/src/index.ts` explicitly configures `app.set('trust proxy', 1)`.

#### 5. Added Dedicated Test Script (`backend/package.json`)
Added `"test:rate-limiting": "tsx --test tests/rate-limiting-secret-routes.test.ts"` to `backend/package.json` to allow automated verification in CI pipelines.

### Verification & Testing Results

- **New Test Suite**: Executed `npm run test:rate-limiting --workspace @fln/backend` — **2/2 tests passing**.
- **MFA Enrollment Suite**: Executed `npx tsx --test tests/mfa-enrollment.test.ts` — **15/15 tests passing**.
- **Aadhaar Detokenization Suite**: Executed `tests/aadhaar-detokenize.test.ts` — **12/12 tests passing**.
- **Vault Config Suite**: Executed `npx tsx --test tests/vault-config.test.ts` — **10/10 tests passing**.
- **Zero Regressions**: Existing authentication and detokenization flows remain completely intact with enhanced brute-force security.
