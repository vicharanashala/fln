# Certification Module (SRS R-7)

Implements competency-based certification eligibility for students in Classes 2-4.

## What this module does

- Holds a **pure** eligibility decision engine (`services/eligibility.service.ts`).
- Holds the **Mongoose** `Certification` model + read-only repository.
- Holds the **orchestration service** (`services/certification.service.ts`) that
  loads requirements, calls the engine, and (in a future phase) upserts a
  `Certification` record.

The legacy backend has a byte-identical engine (`backend/src/certification.ts`)
and a separate orchestration layer (`backend/src/certificationRecords.ts`)
because all `EvaluationReport` writes still happen in the legacy `index.ts`.

## Outcome precedence (load-bearing)

1. `insufficient_evidence` — at least one mandatory topic has no verdict yet.
2. `not_eligible` — at least one mandatory topic was tested and is below the
   declared `meetsThreshold`.
3. `eligible` — every mandatory topic was tested AND meets its threshold.

Do not reorder. Untested topics must not be reported as failures.

## Mastery comparison

`Strong > Satisfactory > Needs Practice`

A requirement with `meetsThreshold: 'Satisfactory'` is met by either
`'Satisfactory'` or `'Strong'`. `meetsThreshold: 'Strong'` is met only by
`'Strong'`. Defined as the `MASTERY_RANK` comparator inside
`services/eligibility.service.ts`.

## Idempotency key

`Certification` rows are uniquely keyed on `(studentId, classNumber, level)`.
If a student moves Class 3 -> Class 4, a new row opens for the new class;
the old row stays immutable as the audit record of what they earned.

`version` is monotonic per `(studentId, classNumber, level)`. Every
re-evaluation that mutates the row increments it.

## Re-evaluation trigger

The legacy `backend/src/index.ts` calls `runCertificationEligibility(student)`
as **fire-and-forget** at the two `EvaluationReport` creation sites (the
diagnostic handler and `/api/evaluation/submit`). The orchestration:

- Reads the latest `conceptMastery` via `dbStore.getLatestConceptMastery`.
- Calls `decideEligibility` with the mandatory requirements for the student's
  `(classNumber, level)`.
- Upserts a `Certification` row:
  - No existing row + `eligible` -> create `active` cert.
  - Existing `active` + new `eligible` -> no-op (already certified).
  - Existing `active` + new `not_eligible` or `insufficient_evidence` ->
    transition to `review_needed`. **The student is NOT silently un-certified.**
  - Existing `review_needed` + new evidence -> keep `review_needed`, refresh
    `decisionSnapshot`, increment `version`. Only an admin endpoint can
    resolve it (shipped in Phase 3, see below).
  - Existing `revoked` + new evidence -> no-op on the cert itself, but a
    defensive `addLog` warning is written (activityType 'verify'). The cert
    is preserved as the immutable audit record of the admin's decision.

## Admin review (Phase 3)

`POST /api/certification/review/:certificationId` (legacy `index.ts`,
admin allowlist `[SUPERADMIN, ADMIN]`). Body: `{ decision: 'confirm' | 'revoke', reason?: string }`.

- `confirm` clears `reviewReason`, sets `status: 'active'`, stamps
  `reviewedBy`/`reviewedAt`, bumps `version`. `decisionSnapshot` is
  preserved — it records the engine's last view of the evidence.
- `revoke` overwrites `reviewReason` with the admin's trimmed reason
  (required, non-empty), sets `status: 'revoked'`, stamps
  `reviewedBy`/`reviewedAt`, bumps `version`. Same `decisionSnapshot`
  preservation.
- Optimistic concurrency: filter is `{ id, version: expectedVersion }`. If
  no match, returns 409 "concurrent modification".
- IDOR guard: `canAccessStudent(user, student)` after cert lookup.
- Failure modes: 401 (no auth), 403 (role or scope), 404 (cert or student
  missing), 400 (invalid decision or missing revoke reason), 409 (wrong
  starting state or concurrent modification).

The pure helper `resolveCertificationReview(cert, decision, reviewer, reason)`
lives in `backend/src/certificationRecords.ts` and is exhaustively tested
in the legacy assert script.

## Analytics contract (Phase 4)

The analytics surfaces (`/api/stats`, `/api/analytics`, frontend dashboards)
read certification counts from `Certification` rows, NOT from the obsolete
`student.currentLevel >= 5` shortcut.

**"Certified" definition (Phase 4 v1):** A student is "certified" iff they
have at least one `Certification` row with `status === 'active'`. Counted
once even if multiple active rows exist (e.g. one for class 3, one for
class 4 after a class move). `revoked` and `review_needed` rows are
excluded. This is the closest reading of the old `currentLevel >= 5`
shortcut and matches the v1 SRS mental model.

**Per-cohort counting (future work):** A more nuanced definition would
count students only for the cert matching their current `classGroup`.
Not implemented in Phase 4 — tracked as a refinement.

**Empty-cert-collection behavior:** If the `certifications` collection is
empty (fresh DB, accidental reset, engine never ran), `/api/stats` and
`/api/analytics` return `certifiedCount: 0`. A one-time `console.warn`
fires per analytics handler invocation. There is **no fallback** to the
old `currentLevel >= 5` shortcut — that would mask PATCH bypass
permanently. Surface the gap honestly.

**Single source of truth:** `countActiveCertificationsFromMemory` and
`buildPerSchoolStats` (in `backend/src/certificationRecords.ts`) are the
only places that compute certification stats. Both the top-level
`certifiedCount` and the `pipeline.certified` field on `/api/analytics`
call the same helper — they cannot drift.

**Frontend integration:** `RoleDashboards.tsx` (Admin/State/District/Block)
and `PanelViews.tsx` (Teacher/School dashboards) now read from
`/api/analytics`'s additive `schools[]` and `certificationRate` fields.
The client-side `currentLevel >= 5` filters were removed.

**Deferred items logged:**
- Frontend `Certification View` capability gating (SRS §13.1 excludes
  volunteer) — Phase 5.
- Hardcoded mock constants cleanup in `frontend/src/constants.ts:21-26,
  320-356` and `PanelViews.tsx:118-144, 1279, 1299, 1335-1336, 1360,
  1488` — separate UX cleanup task.
- Dead `useMongo` flag in `backend/src/db.ts:358` — cleanup backlog.

## Frontend cutover (Phase 5)

Two new surfaces ship in Phase 5 so admins can resolve `review_needed`
certs in the UI and teachers can see per-student status.

### New endpoint

`GET /api/certifications?status=<active|review_needed|revoked>&studentId=<id>`
in `backend/src/index.ts`. Two call shapes:

- **Queue view (no `studentId`):** Admin allowlist `[SUPERADMIN, ADMIN]`.
  Returns `Certification[]` filtered by `status` (default: all).
- **Per-student view (with `studentId`):** Any role that passes
  `canAccessStudent(user, student)`. Returns `Certification[]` for that
  student. Used by `CertificationHistoryCard`.

Backed by `DBStore.listCertifications(filter?)` in `backend/src/db.ts`
(read-only, hits Mongo directly, does not touch the in-memory mirror).

### Admin review panel

`frontend/src/components/CertificationReviewPanel.tsx` — the action
queue. Lists certs filtered by status (default `review_needed`; toggle
to "All"). Confirm/Revoke action buttons per row. Revoke opens a local
`RevokeModal` with Esc/click-outside/focus-on-open/textarea label
(more accessible than `FLNLevelReferenceModal`). Auto-clears success
toast after 5s (mirrors the `postAnnouncement` pattern at
`RoleDashboards.tsx:603-608`). Defends against demo role-switching via
a `useEffect` keyed on `currentUser.role` that clears local state on
change.

`frontend/src/components/Layout.tsx` adds the sidebar entry "Certification
Reviews" under `UserRole.SUPERADMIN` and `UserRole.ADMIN` cases only.
DISTRICT_ADMIN/BLOCK_ADMIN do NOT see the entry — matches the backend
allowlist. State-driven routing (no URL) means a volunteer can't reach
the panel via address bar.

### Per-student cert display

`frontend/src/components/CertificationHistoryCard.tsx` — one card per
Certification row, shown next to the student profile header in
`PanelViews.tsx`. Fetches `GET /api/certifications?studentId=...` and
renders `(classNumber, level, status, version, issuedAt, reviewReason)`.
The `useRef` cache is scoped to the card's mount lifetime so switching
between students is fast without risking cross-session staleness.

### Live-server verification (manual curl)

```bash
# Queue view (admin)
curl -H 'Authorization: Bearer <admin jwt>' \
  http://localhost:3000/api/certifications?status=review_needed
# → 200, array of review_needed certs

# Queue view (teacher — must 403)
curl -H 'Authorization: Bearer <teacher jwt>' \
  http://localhost:3000/api/certifications
# → 403 { error: 'Forbidden: insufficient privileges for queue view.' }

# Invalid status
curl -H 'Authorization: Bearer <admin jwt>' \
  'http://localhost:3000/api/certifications?status=garbage'
# → 400 { error: "status must be 'active', 'review_needed', or 'revoked'." }

# Per-student view (teacher, valid student)
curl -H 'Authorization: Bearer <teacher jwt>' \
  'http://localhost:3000/api/certifications?studentId=<their-student-id>'
# → 200, array (possibly empty)

# Per-student view (out-of-scope student)
curl -H 'Authorization: Bearer <teacher jwt>' \
  'http://localhost:3000/api/certifications?studentId=<other-school-student>'
# → 403 { error: 'Forbidden: student outside your scope.' }

# Concurrent confirm 409 (requires seed data)
curl -X POST -H 'Authorization: Bearer <admin-a jwt>' \
  http://localhost:3000/api/certification/review/<id> \
  -H 'Content-Type: application/json' -d '{"decision":"confirm"}' &
curl -X POST -H 'Authorization: Bearer <admin-b jwt>' \
  http://localhost:3000/api/certification/review/<id> \
  -H 'Content-Type: application/json' -d '{"decision":"confirm"}' &
# → one succeeds, the other gets 409 "Concurrent modification: ..."
```

The pure-helper parts (400 on empty revoke reason, INVALID_DECISION on
bad input, WRONG_STATE on wrong starting state) are covered by
`backend/src/__checks__/certification-list.check.ts` (runnable).

### Deferred items still

- **Frontend capability gating helper** (`hasCapability`). Backend
  enforce; frontend hides via the role allowlist. A future helper would
  centralize this.
- **Mock-data cleanup** in `frontend/src/constants.ts` and
  `PanelViews.tsx:118-144` etc. — separate UX task.
- **`useMongo` flag cleanup** in `db.ts:358`.

## Race handling

The legacy orchestration uses an in-memory
`Map<studentId, Promise<void>>` to chain concurrent triggers per student. Two
worksheet submissions for the same student at the same time run in order
rather than racing on the cert row. **This serialisation is lost on process
restart** — acceptable for single-process dev/prod. When scaling to multiple
replicas, swap for a Mongo-backed lock or Redis.

## `classGroup` parsing (legacy)

The legacy `Student` schema stores `classGroup` as `"Class 2" | "Class 3" |
"Class 4"`. The orchestration extracts the integer via a `/\d+/` match. A
malformed value falls back to `0` and the trigger no-ops; the worksheet
submission still succeeds.

## Admin notifications (Phase 6)

When a `Certification` row transitions from `active` to `review_needed`,
`notification.service.ts` fires two notifications in parallel. Both are
fire-and-forget — failures are logged but never block the cert transition
itself.

1. **In-app logbook entry** — always written via `dbStore.addLog()`. Visible
   to Admin / Block Admin / Superadmin via `/api/logbook` (the existing
   in-app logbook surface). The entry's `details` field records the cert
   id, student id, class/level, and the human-readable reason.

2. **Email to all SUPERADMIN + ADMIN users** — sent via nodemailer when
   `SMTP_HOST` is set in `backend/.env`. Otherwise the email payload is
   logged to stdout so the demo runs end-to-end without SMTP credentials.
   The payload includes the cert id, student id, class/level, reason, and
   the `POST /api/certification/review/:id` endpoint to act on it.

The notification is observability, not a hard gate — if the email fails,
the cert is still flagged and admins still see it on next panel load.

**Why not real-time push?** Server-Sent Events would give instant toast
notifications, but require frontend EventSource wiring and only notify
admins who have the panel open. Email + logbook is the right default for
a low-frequency governance event.

## Out of scope (deferred)

- **Analytics rewiring.** All 9+ `currentLevel >= 5` sites in
  `backend/src/index.ts`, `RoleDashboards.tsx`, and `PanelViews.tsx` stay
  as-is until the analytics phase. The `Certification` rows are now the
  source of truth; the shortcut is preserved as a compatibility fallback.
- **Frontend cutover** to real `/api/certification/*` endpoints. Blocked
  by the broken auth model (see repo `CLAUDE.md`); read-only paths can move
  first, writes cannot.
- **New-backend write path.** The Mongoose `Certification` model has the
  schema/enum parity (`'revoked'` is in the STATUSES array) but no
  evaluation-creation flow yet, so no `review_needed` rows ever exist
  there. The route + resolveReview method on the Mongoose side will land
  when evaluation migrates.
- **New-backend admin route.** The legacy route is the live one; the new
  backend mirrors only the schema. No `POST /api/certification/review/*`
  on the Mongoose backend this phase.

## Verification

Runnable assert scripts (zero deps, no Vitest):

```bash
npx tsx backend/src/modules/certification/__checks__/eligibility.check.ts
npx tsx backend/src/__checks__/certification.check.ts
```

Both must print `N passed, 0 failed` and exit 0. If they diverge, the two
backends are out of sync — see "Two-backend drift" below.

## Two-backend drift

The new-backend engine (`eligibility.service.ts`) and the legacy mirror
(`certification.ts`) MUST stay byte-identical in their decision logic. The
two assert scripts guard this; if a change is intentional, update both
engines in the same commit.

## Files in this module

| File | Role |
|---|---|
| `interfaces/certification.interface.ts` | `ICertification`, `CertificationStatus` |
| `models/certification.model.ts` | Mongoose schema, unique `(studentId, classNumber, level)` |
| `repositories/certification.repository.ts` | Read-only Mongoose wrapper |
| `services/eligibility.service.ts` | Pure `decideEligibility` |
| `services/certification.service.ts` | Orchestration stub (writes disabled) |
| `services/notification.service.ts` | Phase 6 admin notifications (logbook + email) |
| `__checks__/eligibility.check.ts` | Runnable assert harness |

Legacy parallel:

| File | Role |
|---|---|
| `backend/src/certification.ts` | Pure engine mirror |
| `backend/src/certificationRecords.ts` | Orchestration + per-student serialisation |
| `backend/src/db.ts` | `Certification` interface, `DBStore` accessors |
| `backend/src/__checks__/certification.check.ts` | Runnable assert harness |