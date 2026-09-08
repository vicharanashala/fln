/**
 * Vault collection names.
 *
 * One source of truth so every Mongo adapter, index builder, and test
 * refers to the same string. Adding a new collection is a one-line
 * change here — there is no convention to grep for.
 */
export const VAULT_COLLECTIONS = {
  /** One row per unique identity (the deterministic subjectHash PK). */
  identities: 'vault_identities',
  /** One row per tokenization. Multiple rows can share an identityId
   *  if a re-tokenization is requested, but in v0.1 each call mints
   *  exactly one token per identity. */
  tokens: 'vault_tokens',
  /** (Phase 3) Step-up challenges. CAS via findOneAndUpdate. */
  stepUpChallenges: 'vault_step_up_challenges',
  /** (Phase 4) TOTP factors. */
  mfaFactors: 'vault_mfa_factors',
} as const;

export type VaultCollectionName = typeof VAULT_COLLECTIONS[keyof typeof VAULT_COLLECTIONS];
