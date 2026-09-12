/**
 * MFA secret seal/open context — application-layer helper (ported
 * verbatim from
 * src/application/util/mfa-secret-context.ts).
 *
 * The `KeyManager.sealSecret` / `KeyManager.openSecret` port requires
 * a "context" buffer that binds the wrapped output to a domain scope.
 * For DEKs the command constructs the context inline
 * (`tokenize:<actor>:<identityId>`); for MFA secrets the context is
 * independent of the actor — the *factor* is the binding scope:
 *
 *   - The same factor must seal and open with the *same* context, or
 *     AES-GCM tag verification fails (fail closed).
 *   - A different factor must seal and open with a *different* context,
 *     so a stolen encryptedSecret blob from one factor row cannot be
 *     transplanted into a row for another factor.
 *
 * Centralising the format here guarantees the enroll and verify
 * commands produce byte-identical contexts for the same factor id.
 * If the format is ever changed, BOTH call sites are updated by a
 * single import, and any persisted `encryptedSecret` blob from a
 * prior format will refuse to open (the desired "old key is
 * dead" property).
 *
 * **Format (v1):**
 *
 *   `mfa-factor:<factorId>`
 *
 *   - ASCII, length-prefix-free.
 *   - Domain tag `mfa-factor:` distinguishes the binding from the DEK
 *     wrap (`tokenize:...`) and from any future seal use.
 *   - `<factorId>` is the UUIDv7 the application minted at
 *     enrollment. It is stable for the lifetime of the row.
 *
 * **Plaintext hygiene.** This helper returns a *new* `Buffer` on
 * every call. The caller is responsible for zeroing it via
 * {@link safeZero} once `sealSecret` / `openSecret` have consumed
 * it — the AES-GCM tag is computed over (key, iv, plaintext, aad)
 * so the context is not secret in the classical sense, but we zero
 * it as a defense-in-depth measure (matches the broader rule that
 * any buffer the application layer allocates and feeds to a crypto
 * primitive gets zeroed on every exit branch).
 */
export function makeMfaSecretContext(factorId: string): Buffer {
  if (typeof factorId !== "string" || factorId.length === 0) {
    // Defensive — both call sites pass a freshly minted
    // UUIDv7 string, but a future caller that misuses the
    // helper should fail loudly here rather than silently
    // produce a domain-bare context.
    throw new Error(
      "makeMfaSecretContext: factorId must be a non-empty string.",
    );
  }
  return Buffer.from(`mfa-factor:${factorId}`, "utf8");
}
