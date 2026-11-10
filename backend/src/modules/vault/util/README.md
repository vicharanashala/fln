# util

## Overview
Module-level utility used by the command layer.

## Interface
- `dek-zero.ts`: `safeZero(buf: Buffer): void` fills the Buffer with zeros; returns early without throwing if the argument is not a Buffer (including null/undefined, which the type does not allow). Imported by tokenize, detokenize, enroll-mfa, verify-mfa, and approve-step-up commands. See also [../application/util](../application/util/README.md).

## Invariants
- Zeroing is in place; `Buffer.alloc(0)` reassignment is not a substitute.

## Side Effects
- Mutates the passed Buffer.

## Verification
- Run: `npm test --workspace @fln/backend`
