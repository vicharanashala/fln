/**
 * Unit tests for the HS256 JWT verifier.
 *
 * The verifier is the single line of defence between an inbound
 * bearer token and a `JwtPrincipal`. We exercise every error code
 * the application layer can switch on, plus the happy path.
 *
 * Token minting is done by `helpers/mint-test-token.ts` — the same
 * helper the integration tests in `auth-plugin.test.ts` use, so the
 * suite cannot silently drift out of sync.
 */
import { describe, it, expect } from 'vitest';

import { Hs256JwtVerifier } from '../src/infrastructure/auth/hs256-jwt-verifier.js';
import { mintTestToken } from './helpers/mint-test-token.js';

const SECRET = 'a-test-hmac-secret-min-32-bytes-string-bytes';
const ISS = 'aadhaar-vault-test';
const AUD = 'aadhaar-vault';

describe('Hs256JwtVerifier', () => {
  it('verifies a valid token and resolves subject + scopes', async () => {
    const v = new Hs256JwtVerifier({
      secret: SECRET,
      issuer: ISS,
      audience: AUD,
      clockToleranceSeconds: 5,
    });
    const tok = mintTestToken({
      secret: SECRET,
      subject: 'user-1',
      scopes: ['vault:tokenize', 'vault:read'],
      issuer: ISS,
      audience: AUD,
    });
    const p = await v.verify(tok);
    expect(p.subject).toBe('user-1');
    expect([...p.scopes].sort()).toEqual(['vault:read', 'vault:tokenize']);
  });

  it('rejects an empty token with token_missing', async () => {
    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    await expect(v.verify('')).rejects.toMatchObject({ code: 'token_missing' });
  });

  it('rejects a malformed token with token_malformed', async () => {
    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    await expect(v.verify('not-a-jwt')).rejects.toMatchObject({
      code: 'token_malformed',
    });
  });

  it('rejects an expired token with token_expired', async () => {
    const v = new Hs256JwtVerifier({
      secret: SECRET,
      issuer: ISS,
      audience: AUD,
      clockToleranceSeconds: 0,
    });
    const tok = mintTestToken({
      secret: SECRET,
      subject: 'user-1',
      issuer: ISS,
      audience: AUD,
      expiresInSec: -10,
    });
    await expect(v.verify(tok)).rejects.toMatchObject({ code: 'token_expired' });
  });

  it('rejects an issuer mismatch with issuer_mismatch', async () => {
    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    const tok = mintTestToken({
      secret: SECRET,
      subject: 'user-1',
      issuer: 'some-other-issuer',
      audience: AUD,
    });
    await expect(v.verify(tok)).rejects.toMatchObject({ code: 'issuer_mismatch' });
  });

  it('rejects an audience mismatch with audience_mismatch', async () => {
    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    const tok = mintTestToken({
      secret: SECRET,
      subject: 'user-1',
      issuer: ISS,
      audience: 'some-other-audience',
    });
    await expect(v.verify(tok)).rejects.toMatchObject({
      code: 'audience_mismatch',
    });
  });

  it('rejects an invalid signature with signature_invalid', async () => {
    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    const tok = mintTestToken({
      secret: 'a-different-secret-also-32-bytes-long-string!',
      subject: 'user-1',
      issuer: ISS,
      audience: AUD,
    });
    await expect(v.verify(tok)).rejects.toMatchObject({ code: 'signature_invalid' });
  });

  it('rejects a token whose `alg` is not HS256 (algorithm confusion)', async () => {
    // Mint a token with alg:none, signed with empty bytes. The verifier
    // must refuse it as `unsupported_algorithm` rather than trusting it.
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
      'utf8',
    )
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        iss: ISS,
        aud: AUD,
        scope: 'vault:tokenize',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
      'utf8',
    )
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const tok = `${header}.${payload}.`;

    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    await expect(v.verify(tok)).rejects.toMatchObject({
      code: 'unsupported_algorithm',
    });
  });

  it('rejects a token missing the `sub` claim with claim_missing', async () => {
    // Mint a token manually without a `sub` claim.
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: ISS,
        aud: AUD,
        scope: 'vault:tokenize',
        iat: now,
        exp: now + 300,
      }),
      'utf8',
    )
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', SECRET)
      .update(`${header}.${payload}`)
      .digest()
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const tok = `${header}.${payload}.${sig}`;

    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    await expect(v.verify(tok)).rejects.toMatchObject({ code: 'claim_missing' });
  });

  it('refuses to construct with a short secret', () => {
    expect(() => new Hs256JwtVerifier({ secret: 'too-short' })).toThrow(/32 bytes/);
  });

  it('refuses to construct with an empty secret', () => {
    expect(() => new Hs256JwtVerifier({ secret: '' })).toThrow(/non-empty/);
  });

  it('accepts a token issued with a tiny clockTolerance window', async () => {
    const v = new Hs256JwtVerifier({
      secret: SECRET,
      issuer: ISS,
      audience: AUD,
      clockToleranceSeconds: 5,
    });
    // Token expired 3 seconds ago — within tolerance.
    const tok = mintTestToken({
      secret: SECRET,
      subject: 'user-1',
      issuer: ISS,
      audience: AUD,
      expiresInSec: -3,
    });
    const p = await v.verify(tok);
    expect(p.subject).toBe('user-1');
  });

  it('parses `scp` claim as an array when present', async () => {
    // Custom token with `scp` (array) instead of `scope` (string).
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        iss: ISS,
        aud: AUD,
        scp: ['vault:tokenize', 'vault:read'],
        iat: now,
        exp: now + 300,
      }),
      'utf8',
    )
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', SECRET)
      .update(`${header}.${payload}`)
      .digest()
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const tok = `${header}.${payload}.${sig}`;

    const v = new Hs256JwtVerifier({ secret: SECRET, issuer: ISS, audience: AUD });
    const p = await v.verify(tok);
    expect([...p.scopes].sort()).toEqual(['vault:read', 'vault:tokenize']);
  });
});