# Aadhaar Vault — How to Run

> **Operator guide for `microservices/aadhaar-vault/` only.**
> For the repo-wide docs see [`../../REPO_STATUS.md`](../../REPO_STATUS.md) and [`../../RUNNING_THE_PROJECT.md`](../../RUNNING_THE_PROJECT.md). For the long-form design see [`AADHAAR_VAULT.md`](./AADHAAR_VAULT.md). For the microservice's current status see [`STATUS.md`](./STATUS.md).

---

## Table of contents

1. [TL;DR — fastest path](#1-tldr--fastest-path)
2. [Prerequisites](#2-prerequisites)
3. [One-time setup](#3-one-time-setup)
4. [Run locally (no Docker)](#4-run-locally-no-docker)
5. [Run with Docker Compose (bundled Postgres)](#5-run-with-docker-compose-bundled-postgres)
6. [Run the test suite](#6-run-the-test-suite)
7. [Mint a JWT and call the API](#7-mint-a-jwt-and-call-the-api)
8. [Environment variables reference](#8-environment-variables-reference)
9. [Smoke tests / verification](#9-smoke-tests--verification)
9a. [Step-Up detokenization walkthrough](#9a-step-up-detokenization-walkthrough)
10. [Production build & Docker image](#10-production-build--docker-image)
11. [Troubleshooting](#11-troubleshooting)
12. [URL reference](#12-url-reference)

---

## 1. TL;DR — fastest path

```bash
cd microservices/aadhaar-vault
cp .env.example .env

# generate the two required secrets
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # LOCAL_DEV_MASTER_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # SERVICE_JWT_HMAC_SECRET

# paste them into .env, then:
npm install
docker compose up -d postgres                     # or use a host Postgres
npm run migrate                                    # runs migrations 001–003 in order
npm run dev                                        # boots the service on :4101

# in another terminal:
curl http://localhost:4101/health
# {"status":"ok"}
```

That's it. See §3 for the full setup, §7 for hitting the real route.

---

## 2. Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Node.js** | 20.x or newer | The whole service is on Node 20+ (native `crypto.subtle` patterns, `Buffer` semantics) |
| **npm** | 10.x or newer | Workspace install |
| **Docker + Docker Compose** | any modern | Recommended way to run Postgres. Optional if you have a host Postgres. |
| **Postgres** | 14+ (any version that supports `BIGSERIAL`, `JSONB`, `BYTEA`, `timestamptz`, partial indexes) | Required for the service. `docker compose up postgres` brings up a matching image. |
| **Git** | any modern | Clone the repo |
| **OS** | Windows 10/11, macOS, Linux | Tested paths: `cmd.exe` + PowerShell (Windows), `bash` (mac/Linux). Windows UTF-16 `.gitignore` pitfall: see §11. |

You don't need any LLM API key. The vault does no AI work.

---

## 3. One-time setup

From the repo root:

```bash
git clone https://github.com/DUKartik/FLN_Open_Source.git
cd FLN_Open_Source
```

(If you're already inside an existing checkout, just `cd` to `microservices/aadhaar-vault/`.)

### 3.1 Install JS dependencies

```bash
cd microservices/aadhaar-vault
npm install
```

### 3.2 Create `.env`

```bash
cp .env.example .env
```

Open `.env` and set the two required secrets. The fastest way to generate them:

```bash
# LOCAL_DEV_MASTER_KEY (base64, ≥ 32 bytes when decoded)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# SERVICE_JWT_HMAC_SECRET (raw string, ≥ 32 chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Paste the two values into `.env`. Set `DATABASE_URL` to wherever your Postgres is listening (default for the bundled container is `postgres://vault:vault@localhost:5432/vault`).

### 3.3 Start Postgres

```bash
docker compose up -d postgres
# or, if you have a host Postgres:
#   createdb vault
```

### 3.4 Run the migrations

```bash
npm run migrate
```

This replays `src/db/migrations/*.sql` in lexicographic order:

| # | File | Tables / changes |
|---|---|---|
| 001 | `001_initial_schema.sql` | `identities`, `audit_events`, `mfa_challenges`, `key_metadata` |
| 002 | `002_tokens.sql` | `tokens` |
| 003 | `003_rename_mfa_challenges_to_mfa_factors.sql` | rename `mfa_challenges` → `mfa_factors`; add `last_used_at`, `revoked_at` |

The migrator is idempotent — it tracks applied migrations in a side table and skips already-applied files.

### 3.5 Verify the service boots

```bash
npm run dev
```

You should see something like:

```
{"level":"info","host":"0.0.0.0","port":4101,"msg":"aadhaar-vault listening"}
{"level":"info","postgres":"ok","keyProvider":"ok","msg":"ready"}
```

---

## 4. Run locally (no Docker)

If you already have a host Postgres (or want to skip Docker for any reason):

```bash
# 1. Create the database
createdb vault          # macOS/Linux with Postgres.app or psql
# or in psql:
#   CREATE DATABASE vault;

# 2. Point the service at it
export DATABASE_URL=postgres://<user>:<pass>@localhost:5432/vault

# 3. Set the two required secrets (see §3.2)
export LOCAL_DEV_MASTER_KEY="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")"
export SERVICE_JWT_HMAC_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")"

# 4. Migrate
npm run migrate

# 5. Boot
npm run dev
```

The dev script uses `tsx watch` and reloads on file change.

---

## 5. Run with Docker Compose (bundled Postgres)

The repo ships `docker-compose.yml` with a Postgres container. Run the service itself in the foreground with Node (so you get logs and `tsx watch`), or build the image and run it in compose.

### Option A: Postgres in compose, app in foreground

```bash
docker compose up -d postgres
npm install
npm run migrate
npm run dev
```

### Option B: Both in compose

```bash
docker compose up --build
```

`Dockerfile` is multi-stage: `npm ci` → `npm run build` (esbuild) → distroless runtime. The compose file maps `127.0.0.1:4101:4101` and reads `.env` from the host.

---

## 6. Run the test suite

```bash
# all suites, all forks
npm test

# one suite
npx vitest run tests/tokenize-aadhaar.test.ts

# with a grep
npx vitest run -t "happy path"

# with verbose output
npx vitest run --reporter=verbose

# type-check only (no behaviour test)
npx tsc --noEmit
```

Expected: **98/98** passing across 9 suites, `tsc --noEmit` clean, `application/` zero `fastify`/`pg`/`jose`/`otpauth` imports.

You can verify the architectural invariant by hand:

```bash
# from inside microservices/aadhaar-vault/
grep -rE "from ['\"](fastify|pg|jose|otpauth)" src/application/   # MUST return zero matches
```

---

## 7. Mint a JWT and call the API

`POST /v1/tokenize` requires a Bearer JWT signed with HS256 and carrying the `vault:tokenize` scope. The repo ships a dependency-free minter in `tests/helpers/mint-test-token.ts`. You can use it from a one-liner:

### 7.1 Mint a test token

```bash
# read the secret from .env
export SERVICE_JWT_HMAC_SECRET="$(grep '^SERVICE_JWT_HMAC_SECRET=' .env | cut -d= -f2-)"

# mint a 1-hour token with vault:tokenize scope
TOKEN=$(node -e "
  const c = require('crypto');
  const secret = process.env.SERVICE_JWT_HMAC_SECRET;
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({
    iss: 'local-issuer',
    sub: 'tester-001',
    aud: 'aadhaar-vault',
    iat: now,
    nbf: now,
    exp: now + 3600,
    scope: 'vault:tokenize'
  })).toString('base64url');
  const sig = c.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  console.log(header + '.' + payload + '.' + sig);
")

echo "$TOKEN"
```

### 7.2 Feed the console Settings page

The console is not a username/password login screen. Secure routes are authorized by the Bearer JWT you paste into Settings, and request bodies use the actor fields you configure there.

Open:

```text
http://localhost:4101/console/index.html#settings
```

Use these values:

| Field | Value |
|---|---|
| Vault base URL | `http://localhost:4101` |
| Bearer token (HS256 JWT) | paste `$TOKEN` from above, without the `Bearer ` prefix |
| Default actor ID | `tester-001` |
| Default actor role | `TEACHER` |
| Use mock when API unreachable | unchecked when testing the real service |

If you want one console token that can call every current secure route, mint it with all vault scopes:

```bash
TOKEN=$(node -e "
  const c = require('crypto');
  const secret = process.env.SERVICE_JWT_HMAC_SECRET;
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({
    iss: 'local-issuer',
    sub: 'tester-001',
    aud: 'aadhaar-vault',
    iat: now,
    nbf: now,
    exp: now + 3600,
    scope: 'vault:tokenize vault:detokenize vault:mfa:enroll vault:mfa:verify vault:audit'
  })).toString('base64url');
  const sig = c.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  console.log(header + '.' + payload + '.' + sig);
")
```

After saving Settings, the Tokenize, Detokenize, MFA, and Audit screens will send `Authorization: Bearer <token>` automatically.

### 7.3 Hit `/health` (public)

```bash
curl http://localhost:4101/health
# {"status":"ok"}
```

### 7.4 Hit `/v1/tokenize` (auth + scope required)

```bash
curl -X POST http://localhost:4101/v1/tokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context": "tenant-acme/purpose-onboarding/pepper-v1",
    "identity_type": "aadhaar",
    "plaintext": "123412341234",
    "actorId": "tester-001",
    "actorRole": "operator"
  }'
```

Expected `201`:

```json
{
  "token_id": 1,
  "identity_id": 1,
  "token_type": "aadhaar",
  "key_version": 1,
  "last4": "1234"
}
```

### 7.5 Common error shapes

- `401` no/invalid token: `{"error":"unauthorized","message":"...","code":"token_expired"}` (or `token_missing`, `token_malformed`, `signature_invalid`, `issuer_mismatch`, `audience_mismatch`, `claim_missing`, `unsupported_algorithm`).
- `403` missing scope: `{"error":"forbidden","message":"Missing required scope: vault:tokenize"}`.
- `400` Zod error or unknown key: `{"error":"bad_request","message":"..."}`.
- `503` keyManager or db not wired: `{"error":"service_unavailable","message":"..."}`.

---

## 8. Environment variables reference

All env vars go in `microservices/aadhaar-vault/.env` (copy from `.env.example`). They are read by `src/config.ts` at boot.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | recommended | `development` | `production` enforces the `LocalDevKeyManager` guard |
| `HOST` | no | `0.0.0.0` | bind interface |
| `PORT` | no | `4101` | listen port |
| `LOCAL_DEV_MASTER_KEY` | **yes** | — | base64-encoded master key; refuses to boot below 32 bytes |
| `SERVICE_JWT_HMAC_SECRET` | **yes** | — | shared HS256 secret; refuses to boot below 32 bytes |
| `SERVICE_JWT_ISSUER` | no | unset | expected `iss` claim; rejects on mismatch when set |
| `SERVICE_JWT_AUDIENCE` | no | unset | expected `aud` claim; rejects on mismatch when set |
| `VAULT_ALLOW_UNSAFE_KEY_PROVIDER` | **only in prod** | unset | `true` to override the `LocalDevKeyManager` guard (logged) |
| `DATABASE_URL` | **yes** | — | Postgres connection string (`postgres://user:pass@host:port/db`) |
| `LOG_LEVEL` | no | `info` | pino level: `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `VAULT_DISABLE_DB_CHECK` | no | unset | `true` skips the DB ping in `/health/ready` (test convenience) |

**Never commit real keys.** `.env` is gitignored.

---

## 9. Smoke tests / verification

After the service is up:

### 9.1 Liveness

```bash
curl -i http://localhost:4101/health
# expect: HTTP/1.1 200 OK ; body {"status":"ok"}
```

### 9.2 Readiness

```bash
curl -i http://localhost:4101/health/ready
# expect: HTTP/1.1 200 OK ; body {"postgres":"ok","keyProvider":"ok"}
```

If you see 503, see §11.

### 9.3 401 without a token

```bash
curl -i -X POST http://localhost:4101/v1/tokenize \
  -H "Content-Type: application/json" \
  -d '{"context":"x/y/z","identity_type":"aadhaar","plaintext":"123412341234"}'
# expect: HTTP/1.1 401 Unauthorized ; body {"error":"unauthorized","message":"Missing or malformed Authorization header"}
```

### 9.4 403 with the wrong scope

Mint a token with `scope: ""` (or some other scope). Same body. Expect 403.

### 9.5 Full round-trip

See §7.4 above.

### 9.6 Type-check

```bash
npx tsc --noEmit
# expect: no output (clean). If you see pre-existing errors, check STATUS.md §10.
```

---

## 10. Production build & Docker image

```bash
# build the bundled server
npm run build       # esbuild → dist/server.cjs

# run the bundle
node dist/server.cjs
```

### 10.1 Build the Docker image

```bash
docker build -t aadhaar-vault:dev .
docker run --rm -p 4101:4101 --env-file .env aadhaar-vault:dev
```

### 10.2 Bring up Postgres + the app via compose

```bash
docker compose up --build -d
docker compose logs -f aadhaar-vault
```

### 10.3 Pre-deploy checklist

- `NODE_ENV=production`
- `LOCAL_DEV_MASTER_KEY` is generated by a real KMS or sealed-secret store, **not** committed
- `SERVICE_JWT_HMAC_SECRET` is rotated by the issuing service; you store only the current version
- `VAULT_ALLOW_UNSAFE_KEY_PROVIDER` is **unset** in production
- Postgres is on TLS; `DATABASE_URL` uses `sslmode=require` (or your cluster's equivalent)
- Logs are shipped somewhere the operator can query; `LOG_LEVEL=info`
- `/health` and `/health/ready` are wired into your LB / k8s probes (liveness vs readiness, respectively)

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Boot fails with `LOCAL_DEV_MASTER_KEY missing` | `.env` not loaded or the key is empty | `cp .env.example .env` and set both required secrets; re-run |
| Boot fails with `LOCAL_DEV_MASTER_KEY shorter than 32 bytes` | key too short | regenerate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| Boot fails with `SERVICE_JWT_HMAC_SECRET shorter than 32 bytes` | secret too short | regenerate with the same command above |
| `/health/ready` returns 503 with `postgres: "down"` | DB unreachable or migrations not applied | `docker compose ps postgres`; `npm run migrate`; verify `DATABASE_URL` |
| `/health/ready` returns 503 with `keyProvider: "down"` | `LocalDevKeyManager` refused to construct | in production: unset `VAULT_ALLOW_UNSAFE_KEY_PROVIDER` and provide a real KMS adapter; in dev: ensure `LOCAL_DEV_MASTER_KEY` is set |
| `EADDRINUSE :4101` | Another process (often the main FLN backend) holds the port | `netstat -ano \| grep :4101` + `taskkill //PID <pid> //F` (Windows), or `lsof -ti:4101 \| xargs kill` (Unix). Or change `PORT` in `.env`. |
| `npm run migrate` hangs forever | Wrong `DATABASE_URL` or Postgres not reachable | `psql "$DATABASE_URL" -c 'select 1'` first |
| `401 unauthorized` with `code: "signature_invalid"` | Token was minted with a different secret than the server is reading | Re-export `SERVICE_JWT_HMAC_SECRET` from `.env` (not from your shell) and re-mint |
| `403 forbidden` on a route that should accept your token | Token's `scope` (or `scp`) does not contain the required scope | Re-mint with `scope: "vault:tokenize"` (space-delimited string) or `scp: ["vault:tokenize"]` (array) |
| `400 bad_request` with `message: "Unrecognized key"` | Body contains a field the schema doesn't allow | This is intentional — the contract is additive. Remove the unknown field, or update the Zod schema if you really need the new field. |
| `application/` shows up with framework imports after my change | New `import 'fastify'` in a port module | That violates the architectural invariant. Move the call through an adapter. Re-run `grep -rE "from ['\"](fastify|pg|jose|otpauth)" src/application/` and confirm zero. |
| `tsc --noEmit` reports errors in `src/application/ports/*.ts` | You typed the port against a concrete library instead of an interface | Ports must speak only in TS primitives + interface types. See `application/ports/jwt-verifier.ts` for the shape. |
| `npx vitest run` shows only a few suites | Workers collapsed | The config uses `pool: 'forks'`. Run `npx vitest run --no-file-parallelism` to debug. |
| Windows: `.gitignore` shows mojibake and ignores silently fail | Saved as UTF-16 | Reopen as UTF-8 (VS Code status bar → "Reopen with Encoding"), save, commit |

If a fix isn't here — open an issue or ask the team before guessing on anything involving auth, the cryptographic primitives, or migration ordering.

---

## 12. URL reference

| Endpoint | URL | Auth | Purpose |
|---|---|---|---|
| Liveness | `GET http://localhost:4101/health` | none | k8s liveness probe |
| Readiness | `GET http://localhost:4101/health/ready` | none | k8s readiness probe; reports `postgres` + `keyProvider` |
| Tokenise | `POST http://localhost:4101/v1/tokenize` | `Bearer <jwt>` + `vault:tokenize` | mint a token for an identity |
| MFA enroll | `POST http://localhost:4101/v1/mfa/enroll` | `Bearer <jwt>` + `vault:mfa:enroll` | register a TOTP factor for an actor |
| Request detokenization | `POST http://localhost:4101/v1/detokenize/request` | `Bearer <jwt>` + `vault:detokenize` | mint a step-up challenge |
| Verify MFA | `POST http://localhost:4101/v1/mfa/verify` | `Bearer <jwt>` + `vault:mfa:verify` | approve a step-up challenge |
| Detokenize (Step-Up) | `POST http://localhost:4101/v1/detokenize` | `Bearer <jwt>` + `vault:detokenize` | consume a challenge, return plaintext |
| Audit | `GET http://localhost:4101/v1/audit` | `Bearer <jwt>` + `vault:audit:read` | read recent audit events |

See [§9a](#9a-step-up-detokenization-walkthrough) for the full Step-Up walkthrough and [STEP_UP_AUTH.md](./STEP_UP_AUTH.md) for the threat model.

---

## 9a. Step-Up detokenization walkthrough

Detokenization requires an active, MFA-approved step-up challenge. The three-call
sequence is intentionally split so that **plaintext Aadhaar never travels
without a fresh human approval**.

### 9a.1 Mint a one-time token + challenge token

The full token must include all the scopes used in this section:

```bash
TOKEN=$(node -e "
  const c = require('crypto');
  const secret = process.env.SERVICE_JWT_HMAC_SECRET;
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({
    iss: 'local-issuer',
    sub: 'tester-001',
    aud: 'aadhaar-vault',
    iat: now, nbf: now, exp: now + 3600,
    scope: 'vault:tokenize vault:detokenize vault:mfa:enroll vault:mfa:verify vault:audit:read'
  })).toString('base64url');
  const sig = c.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  console.log(header + '.' + payload + '.' + sig);
")
```

### 9a.2 Tokenise an Aadhaar number

```bash
TOKENISE=$(curl -s -X POST http://localhost:4101/v1/tokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "aadhaar": "998877665544",
    "identityType": "AADHAAR",
    "context": {
      "actorId":   "tester-001",
      "actorRole": "SUPER_ADMIN",
      "reason":    "onboarding"
    }
  }')

VID=$(echo "$TOKENISE" | jq -r .token)
```

### 9a.3 Enrol an MFA factor (TOTP)

```bash
ENROL=$(curl -s -X POST http://localhost:4101/v1/mfa/enroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actor":   "tester-001",
    "role":    "SUPER_ADMIN",
    "context": { "actorId": "tester-001", "actorRole": "SUPER_ADMIN", "reason": "step-up enroll" }
  }')

FACTOR_ID=$(echo "$ENROL"  | jq -r .factorId)
SECRET=$(echo "$ENROL"      | jq -r .otpauthUri | sed -E 's/.*secret=([A-Z2-7]+).*/\1/')
echo "factor=$FACTOR_ID secret=$SECRET"
```

### 9a.4 Request a detokenization challenge

```bash
REQ=$(curl -s -X POST http://localhost:4101/v1/detokenize/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\":             \"$VID\",
    \"requiredFactorId\":  \"$FACTOR_ID\",
    \"context\": {
      \"actorId\":   \"tester-001\",
      \"actorRole\": \"SUPER_ADMIN\",
      \"reason\":    \"step-up request\"
    }
  }")

CHALLENGE_ID=$(echo "$REQ" | jq -r .challengeId)
EXPIRES=$(echo "$REQ"      | jq -r .expiresAt)
echo "challenge=$CHALLENGE_ID expires=$EXPIRES"
```

### 9a.5 Compute the TOTP code and verify MFA

The vault uses RFC 6238 SHA-1 TOTP, 6 digits, 30-second period. A reference
implementation in plain Node:

```bash
CODE=$(node -e "
  const { createHmac } = require('crypto');
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const sec  = '$SECRET'.toUpperCase().replace(/=+\$/g,'');
  let bits = ''; for (const ch of sec) bits += B32.indexOf(ch).toString(2).padStart(5,'0');
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b,2)));
  const h   = createHmac('sha1', key).update(buf).digest();
  const o   = h[h.length-1] & 0x0f;
  const code = ((h[o]&0x7f)<<24) | ((h[o+1]&0xff)<<16) | ((h[o+2]&0xff)<<8) | (h[o+3]&0xff);
  console.log(String(code % 1_000_000).padStart(6,'0'));
")

curl -s -X POST http://localhost:4101/v1/mfa/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"challengeId\": \"$CHALLENGE_ID\",
    \"factorId\":    \"$FACTOR_ID\",
    \"code\":        \"$CODE\",
    \"reason\":      \"approved\"
  }"
# → { "verified": true, "failureReason": null, "delta": 0 }
```

### 9a.6 Detokenize (consume the challenge)

```bash
curl -s -X POST http://localhost:4101/v1/detokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"challengeId\": \"$CHALLENGE_ID\",
    \"context\": {
      \"actorId\":   \"tester-001\",
      \"actorRole\": \"SUPER_ADMIN\",
      \"reason\":    \"onboarding look-up\"
    }
  }"
# → { "token": "…", "identityId": 1, "aadhaar": "998877665544", "last4": "5544", "auditId": 7 }
```

### 9a.7 Replay (must be rejected)

```bash
curl -i -X POST http://localhost:4101/v1/detokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"challengeId\": \"$CHALLENGE_ID\", \"context\": { ... } }"
# → HTTP/1.1 409 Conflict
# → { "error": "challenge_consumed", ... }   (NEVER the plaintext again)
```

### 9a.8 End-to-end script

The repository also ships a self-contained walkthrough that boots the server,
runs every assertion, and exits non-zero on the first failure:

```bash
npm run smoke:stepup
```

This replaces the legacy `npm run smoke:probe` walkthrough. It exercises the
real HTTP surface (`fetch` against `http://localhost:4101`) and asserts:

- tokenize succeeds
- challenge request succeeds
- MFA verify approves the challenge
- detokenize returns the plaintext exactly once
- replaying the same `challengeId` returns `409 CHALLENGE_CONSUMED`
- an expired challenge returns `410 CHALLENGE_EXPIRED`
- a different actor's JWT is rejected with `403`
- exactly one `DETOKENIZE` audit row is appended
- exactly one `StepUpChallengeCompleted` event is published

See [STEP_UP_AUTH.md](./STEP_UP_AUTH.md) for the threat model and the
challenge state-machine documentation.

---

## Quick recap — minimum commands for a working day

```bash
cd microservices/aadhaar-vault

# one-time
cp .env.example .env
# edit .env: set LOCAL_DEV_MASTER_KEY and SERVICE_JWT_HMAC_SECRET
npm install
docker compose up -d postgres
npm run migrate

# every day
npm run dev                                            # http://localhost:4101

# tests + type-check
npm test                                               # 98/98 expected
npx tsc --noEmit                                       # clean expected

# smoke test
curl http://localhost:4101/health
# then mint a JWT (see §7) and POST /v1/tokenize
