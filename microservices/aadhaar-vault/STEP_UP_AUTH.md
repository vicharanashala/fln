# Step-Up Authentication — Threat Model & Design

> **Session 7 (A–D) — Step-Up Authentication feature reference.**
>
> This is the canonical feature spec for the Step-Up Authentication workflow
> introduced by Sessions 7A–7D. For operator instructions see
> [`RUN.md §9a`](./RUN.md#9a-step-up-detokenization-walkthrough). For the
> broader microservice narrative see [`AADHAAR_VAULT.md`](./AADHAAR_VAULT.md)
> and [`AADHAAR_VAULT_FREE_ARCHITECTURE.md`](./AADHAAR_VAULT_FREE_ARCHITECTURE.md).

---

## 1. Why Step-Up?

Aadhaar numbers are an extremely sensitive identity primitive. A token alone
proves the vault issued a record, but it does **not** prove the caller is the
human the policy actually intends to authorize. Step-Up Authentication closes
that gap: every detokenization must be preceded by an MFA-approved,
single-use, time-boxed challenge.

The vault therefore refuses to return plaintext on the back of a single
bearer-token call. Two complementary controls protect every read:

1. **Token** — stable, opaque, scoped, JWT-bearer-protected.
2. **Challenge** — single-use, MFA-approved, expires in seconds, owned by a
   specific actor and bound to a specific factor.

Both must be present and valid before any plaintext crosses the wire.

---

## 2. Challenge State Machine

```
            ┌──────────┐  /v1/detokenize/request
            │ PENDING  │ ◄─────────────────────── (create)
            └────┬─────┘
                 │  /v1/mfa/verify  (delta ≥ 0)
                 ▼
            ┌──────────┐
            │ APPROVED │  (terminal-but-still-use-once)
            └────┬─────┘
                 │  /v1/detokenize   (CAS consume)
                 ▼
            ┌──────────┐
            │ CONSUMED │  (terminal — never reaches plaintext again)
            └──────────┘
```

Alternative transitions:

```
PENDING ── expires_at < now() ──►  rejected at consume   (CHALLENGE_EXPIRED)
APPROVED ── expires_at < now() ──► rejected at consume   (CHALLENGE_EXPIRED)
PENDING ── factor mismatch   ──► rejected at verify      (CHALLENGE_FACTOR_MISMATCH)
CONSUMED ── any retry         ──► rejected at consume    (CHALLENGE_CONSUMED)
```

There are **no other legal transitions**. There is no `FAILED` state — failed
MFA attempts simply leave the row in `PENDING` and write a `CHALLENGE_FAILED`
event. There is no `REVOKED` state — operators do not delete challenges;
they expire naturally and the row stays for audit.

### 2.1 Why `APPROVED` is intermediate, not final

We could collapse `PENDING` and `APPROVED` into one state, but keeping them
separate:

- lets the audit log show **who** approved and **when**,
- lets a partially-approved challenge be revoked by an operator (manual
  deletion of the row), and
- gives the smoke script a deterministic way to assert that the
  `StepUpChallengeCompleted` event was published exactly once.

### 2.2 CAS guarantee

The `consume` operation is a single SQL `UPDATE … WHERE status = 'APPROVED'`
returning the affected row count. Two concurrent `/v1/detokenize` calls cannot
both observe `APPROVED` — exactly one wins. The loser observes
`rowCount = 0`, surfaces `CHALLENGE_CONSUMED`, and returns `409`. The
repository's `consume()` method makes the row visibility atomic; the route
never returns plaintext without a positive consume.

### 2.3 Why consume happens **before** crypto

A subtle invariant: the plaintext is only ever decrypted **after** the
challenge has been atomically transitioned to `CONSUMED`. We deliberately do
not decrypt first and consume second, because that would leave a window in
which:

- the actor has seen the plaintext, and
- the row is still `APPROVED`,

which would mean a second concurrent caller could see the same plaintext.
Swapping the order closes that window — once `CONSUMED`, no future call can
ever reach the decrypt path.

---

## 3. Event Sequence

The vault publishes domain events through the `EventPublisher` port
(implementation: `InProcessEventPublisher`). For a successful Step-Up
detokenize, the event stream is:

```
1. StepUpChallengeRequested   (on /v1/detokenize/request)
2. StepUpChallengeApproved    (on /v1/mfa/verify, only if delta ≥ 0)
3. StepUpChallengeCompleted   (on /v1/detokenize, after CAS consume)
```

For a rejected flow:

```
StepUpChallengeRequested
StepUpChallengeFailed        (verify returned delta > 0 or wrong code)
   ─── or ───
StepUpChallengeExpired       (consume observed expires_at < now())
   ─── or ───
StepUpChallengeReplayBlocked (consume observed status != APPROVED)
```

These events are **append-only**. They never carry Aadhaar plaintext, never
carry factor secrets, and never carry the raw TOTP code.

---

## 4. Audit Sequence

The audit log is intentionally separate from the event stream:

| Audit row              | When                                                    |
|------------------------|---------------------------------------------------------|
| `TOKENIZE`             | `/v1/tokenize` succeeded                                |
| `MFA_ENROLL`           | `/v1/mfa/enroll` succeeded                              |
| `MFA_VERIFY_SUCCESS`   | `/v1/mfa/verify` returned `verified: true`              |
| `MFA_VERIFY_FAIL`      | `/v1/mfa/verify` returned `verified: false`             |
| `CHALLENGE_REQUEST`    | `/v1/detokenize/request` succeeded                      |
| `DETOKENIZE`           | `/v1/detokenize` returned the plaintext                 |
| `DETOKENIZE_REJECTED`  | `/v1/detokenize` returned any 4xx / 410                 |
| `AUDIT_READ`           | `/v1/audit` was called                                  |

Audit rows record **identifiers only** — actor, factor, challenge, audit IDs —
never the plaintext, the factor secret, or the verification code.

---

## 5. HTTP Sequence Diagram

```
client      vault              mfa-factor        event-bus      postgres
  │  POST /v1/tokenize          │                  │              │
  │ ─────────────────────────► │  create identity │              │
  │                            │                  │              │
  │ ◄────── 200 { token } ─── │  insert token    │              │
  │                            │ ─────────────► │              │
  │                            │                  │ ─────────►  │
  │                            │                  │              │
  │  POST /v1/mfa/enroll       │                  │              │
  │ ─────────────────────────► │  gen TOTP secret │              │
  │                            │  encrypt secret  │              │
  │                            │ ─────────────► │              │
  │ ◄────── 200 { factorId,   │                  │              │
  │              otpauthUri }  │                  │              │
  │                            │                  │              │
  │  POST /v1/detokenize/request                    │
  │ ─────────────────────────► │  create challenge │
  │                            │  PENDING + exp   │
  │                            │ ─────────────► │              │
  │ ◄────── 200 { challengeId,│                  │              │
  │              expiresAt }   │                  │              │
  │                            │                  │              │
  │  POST /v1/mfa/verify      │                  │              │
  │ ─────────────────────────► │  TOTP verify     │
  │                            │  status=APPROVED │
  │                            │ ─────────────► │              │
  │ ◄────── 200 { verified }  │                  │              │
  │                            │                  │              │
  │  POST /v1/detokenize      │                  │              │
  │ ─────────────────────────► │  CAS consume     │
  │                            │  ───► if rowCount=1:            │
  │                            │       status=CONSUMED           │
  │                            │       decrypt & return          │
  │ ◄────── 200 { aadhaar }  │  publish Completed │           │
  │                            │ ─────────────► │              │
  │                            │                  │              │
  │  POST /v1/detokenize      │                  │              │
  │    (REPLAY same id)       │  CAS consume     │
  │ ─────────────────────────► │  ───► rowCount=0 │
  │ ◄────── 409 CHALLENGE_CONSUMED                │
```

The `consume` and `decrypt` are inside a single transactional vault writer
boundary (Session 7A), so a crash mid-flow leaves the row in
`APPROVED`, never in an inconsistent state.

---

## 6. Security Rationale

### 6.1 Why replay is impossible

The vault performs a compare-and-set on the challenge row before it ever
reads the encrypted token. The SQL is:

```sql
UPDATE step_up_challenges
SET    status = 'CONSUMED',
       consumed_at = now(),
       consumed_by_audit_id = $2
WHERE  challenge_id = $1
  AND  status = 'APPROVED'
  AND  expires_at > now()
RETURNING challenge_id, actor_id, identity_id;
```

Two observations make replay impossible:

- The `WHERE status = 'APPROVED'` clause: even a duplicated request cannot
  find a `CONSUMED` row to update, so `rowCount = 0`.
- The transition is irreversible: there is no path back to `APPROVED`. The
  row is terminal.

The vault **never** returns the plaintext to a caller that didn't win the
CAS race.

### 6.2 Why challenge ownership is verified

The `/v1/detokenize` handler compares the authenticated `actorId` from the
JWT against the `actor_id` stored on the challenge row. If they differ, the
handler refuses the consume attempt, the row stays `APPROVED`, and the
attempt is recorded as `CHALLENGE_FACTOR_MISMATCH`. This stops an
attacker with their own valid JWT (and MFA factor) from consuming
**someone else's** challenge.

### 6.3 Why factor ownership is verified

The `/v1/mfa/verify` handler enforces that the factor used to approve a
challenge is:

- registered to the same `actorId` as the challenge row, and
- not revoked (`status = 'ACTIVE'`), and
- not older than its `expires_at` if one is set.

A factor belonging to `actor-X` cannot be used to approve a challenge owned
by `actor-Y`.

### 6.4 Why plaintext exists only after successful consume

The decrypt path runs **only inside** the CAS-update-then-return path of the
`DetokenizeAadhaar` command. There is no other code path that calls the
crypto service's `decryptIdentity()` for a `tokens` row. Every other detok
attempt short-circuits before reaching the crypto boundary.

### 6.5 Why expired approvals cannot decrypt

Two layers of time-boxing protect the consume path:

1. The `expires_at` column is set at `request` time and persisted in the
   challenge row.
2. The `consume` SQL includes `AND expires_at > now()`. An expired row is
   not even consumed — it stays in `APPROVED` (or `PENDING`) and the vault
   surfaces `CHALLENGE_EXPIRED` with `410 Gone`.

This is intentionally a hard wall: there is no grace period, no clock skew
buffer beyond the small Postgres-driver round-trip, and no manual override.

### 6.6 Why audit and events carry identifiers, not Aadhaar

The audit row's `details` JSONB and the event payload both store:

- `actorId` (string)
- `challengeId` (UUID)
- `factorId` (UUID)
- `auditId` (UUID)
- `identityId` (UUID)
- `last4` (the trailing 4 digits of the Aadhaar — useful for support, not
  enough to reconstruct the number)

They never store:

- the full Aadhaar number,
- the factor secret (encrypted or otherwise),
- the TOTP code that was verified,
- the JWT bearer token.

This means an attacker with read access to the `audit_events` table can
reconstruct **who did what when**, but cannot reconstruct the secret
material. The only place the plaintext lives is in flight — request
handler → response body — and the response body is consumed immediately by
the legitimate caller.

---

## 7. Architecture Narrative

The four layers of the vault keep distinct responsibilities:

```
┌────────────────────────────────────────────────────────────┐
│  HTTP layer    src/routes/*.ts                             │
│  • Parse JSON, validate Zod                                │
│  • Build caller context (JWT subject → trusted actorId)   │
│  • Call ONE command, project result to JSON                │
│  • No business logic                                       │
└────────────────────────┬───────────────────────────────────┘
                         │ calls commands…
┌────────────────────────▼───────────────────────────────────┐
│  Application layer  src/application/commands/*.ts          │
│  • Pure use cases (tokenize, request detok, verify MFA,   │
│    consume challenge)                                      │
│  • Orchestrates ports + transactional vault writer         │
│  • Emits events, writes audit                              │
│  • No fastify / pg / jose imports                          │
└────────────────────────┬───────────────────────────────────┘
                         │ calls ports…
┌────────────────────────▼───────────────────────────────────┐
│  Ports + adapters                                          │
│  • Ports (interfaces) live in src/application/ports/       │
│  • Adapters (Postgres, Node crypto, In-process events)     │
│    live in src/infrastructure/                             │
│  • Adapters speak SQL, do JWT verify, talk to KMS          │
└────────────────────────┬───────────────────────────────────┘
                         │ writes/reads…
┌────────────────────────▼───────────────────────────────────┐
│  Persistence  src/db/*                                     │
│  • Migrations (001–004)                                    │
│  • Repositories are thin SQL wrappers                     │
│  • No workflow logic, no transaction control              │
└────────────────────────────────────────────────────────────┘
```

### Why routes contain no business logic

Routes are HTTP adapters. They know the wire format, the auth header, the
scope strings, and the HTTP status mapping. They do **not** know what
"approve a challenge" or "consume a row atomically" means. By keeping them
thin, every command is independently testable from a Fastify `inject()`
without spinning up a real network listener.

### Why repositories contain no workflow logic

Repositories are SQL wrappers. They map TS types onto parameterized
statements and return rows or row counts. They do **not** call other
repositories, do **not** know what `consume` implies for audit, and do
**not** roll back transactions. The transactional vault writer is the
**only** module that opens a transaction; commands own the boundaries.

### Why commands orchestrate use cases

Commands are the only places where a use case lives end-to-end. The
`RequestDetokenization` command, for example, calls the identity
repository, the challenge repository, the audit repository, the event
publisher, and the transactional vault writer — and it does so in the order
required for correctness. If you wanted to swap "request challenge" with a
CLI command or a cron job, you would call the same command.

---

## 8. Failure Modes

| Failure                                       | Surface                             | Audit row           |
|-----------------------------------------------|-------------------------------------|---------------------|
| JWT missing / malformed / expired             | `401 unauthorized`                  | none                |
| JWT valid, scope missing                      | `403 forbidden`                     | none                |
| Required factor not enrolled for actor        | `400 CHALLENGE_FACTOR_MISSING`      | `CHALLENGE_REJECTED` |
| TOTP code wrong                               | `200 { verified: false }`           | `MFA_VERIFY_FAIL`   |
| Factor revoked                                | `403 CHALLENGE_FACTOR_REVOKED`      | `CHALLENGE_REJECTED` |
| Challenge not found                          | `404 CHALLENGE_NOT_FOUND`           | `CHALLENGE_REJECTED` |
| Challenge expired                            | `410 CHALLENGE_EXPIRED`             | `DETOKENIZE_REJECTED`|
| Challenge already consumed                   | `409 CHALLENGE_CONSUMED`            | `DETOKENIZE_REJECTED`|
| Challenge owned by another actor              | `403 CHALLENGE_FACTOR_MISMATCH`     | `DETOKENIZE_REJECTED`|
| DB unavailable                                | `503 service_unavailable`           | none                |

---

## 9. Operational Signals

If you wire these into your dashboards:

- A spike of `CHALLENGE_REJECTED` audit rows is a sign of brute-force.
- A spike of `MFA_VERIFY_FAIL` followed by `CHALLENGE_REQUEST` is a sign
  of an actor repeatedly re-trying with the wrong code.
- A burst of `CHALLENGE_EXPIRED` is a sign the JWT-lifetime vs
  challenge-lifetime ratio is too tight — operators may want to extend the
  challenge TTL (currently 5 minutes, hard-coded at `request` time).
- Any `DETOKENIZE` audit row with `actorId != token's original requester`
  is a sign of account compromise; page on it.

---

## 10. Glossary

| Term            | Meaning                                                                |
|-----------------|------------------------------------------------------------------------|
| **Challenge**   | A single-use, MFA-approved, time-boxed authorization for detokenize.   |
| **Factor**      | A registered MFA credential (currently TOTP).                         |
| **Token**       | The opaque vault-issued identifier for an identity (Aadhaar row).     |
| **CAS consume** | Compare-and-set update from `APPROVED` → `CONSUMED`.                  |
| **Replay**      | A second detokenize attempt with the same `challengeId`.               |
| **Step-Up**     | The workflow of `request → MFA-verify → consume → plaintext`.          |