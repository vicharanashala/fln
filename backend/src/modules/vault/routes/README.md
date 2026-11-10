# routes

## Overview
Thin Express handlers. Each `registerXRoute(router, ctx)` validates body shape, calls one command on `ctx`, and maps errors to JSON `{error, message}`. Each of the six files also exports `makeXRouter(ctx)` for tests: `makeTokenizeRouter`, `makeDetokenizeRouter`, `makeMfaEnrollRouter`, `makeStepUpRequestRouter`, `makeStepUpApproveRouter`, `makeAuditRouter`.

## Interface
| Method and path | Scope | Command | Success |
| --- | --- | --- | --- |
| `POST /v1/tokenize` | `vault:tokenize` | tokenize (`raw`, `type`, `context`) | 201 |
| `POST /v1/detokenize/request` | `vault:detokenize` | requestDetokenization (`tokenId`, `factorId`, `context`) | 201 |
| `POST /v1/detokenize/step-up/:challengeId/approve` | `vault:detokenize` | approveStepUpChallenge (`code`, `context`) | 200 |
| `POST /v1/detokenize` | `vault:detokenize` | detokenize (`challengeId`, `context`) | 200 |
| `POST /v1/mfa/enroll` | `vault:mfa:enroll` | enrollMfa (`actor`, `label?`, `algorithm?`, `digits?`, `period?`, `context`) | 201 |
| `GET` and `POST /v1/audit` | `vault:audit` | readAuditHistory (`identityId`, `limit?`, `context`; GET merges query and body) | 200 |

`context` = `{reason, requestId?, sourceIp?, userAgent?}`, all strings. The actor (`actorId` = the user's email, `actorRole`) always comes from the authenticated session; any `actorId`, `actorRole` or (for `/v1/mfa/enroll`) `actor` in the body is ignored. Only SUPERADMIN users may call these routes (others get 403, no or an invalid token gets 401).

## Invariants
- Null `ctx` -> 503 `VAULT_DB_UNAVAILABLE` on every route.
- Error mapping: a command error is re-wrapped as `VaultError(code, message, undefined)` and gets the status from the `errors.ts` table; the routes do not check the code against `KNOWN_VAULT_CODES`. Known gap: a code that is not in the table gives `status` `undefined`, and `res.status(undefined)` then fails when the response is sent (an error thrown inside the async handler, not a mapped response). Step-up request is the exception: it passes the command's own `err.httpStatus`, including the command-only `INVALID_CONFIG` code that is not in `KNOWN_VAULT_CODES`. `VaultError` uses its own status; anything else is 500 `INTERNAL` with a generic message (no internals leaked).
- Body validation failures are 400 `INVALID_INPUT`.
- No route exists for MFA verify or factor listing/revoke; those are reachable only via the `aadhaarVault.ts` facade.

## Side Effects
- Whatever the invoked command does (DB writes, audit rows, events). Detokenize returns the plaintext Aadhaar in the response body. The audit route's doc comment names the scope `vault:audit:read`, but the code uses `vault:audit`.

## Verification
- Run: `tsx --test src/modules/vault/tests/step-up-e2e.test.ts` via `npm test --workspace @fln/backend`
