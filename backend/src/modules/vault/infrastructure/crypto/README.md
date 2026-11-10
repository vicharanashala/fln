# infrastructure/crypto

## Overview
Authenticated encryption for Aadhaar payloads.

## Interface
- `node-crypto.service.ts`: `NodeCryptoService` (`algorithm = 'aes-256-gcm'`), `encrypt(key, plaintext, aad) -> {ciphertext, iv, authTag}`, `decrypt(key, envelope, aad) -> Buffer`.

## Invariants
- Key must be exactly 32 bytes; IV exactly 12 bytes (fresh `randomBytes` per encrypt); auth tag exactly 16 bytes. Violations throw plain `Error`. The IV is generated internally.
- AAD is bound on both sides; wrong AAD, key, or tampered ciphertext makes `decipher.final()` throw (commands translate to `DECRYPTION_FAILED`).

## Side Effects
- Consumes OS randomness. Does not zero inputs; callers do.

## Verification
- Run: `npm test --workspace @fln/backend`
