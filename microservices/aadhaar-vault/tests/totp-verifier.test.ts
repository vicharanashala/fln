/**
 * RFC 6238 Appendix B — TOTP reference vectors.
 *
 * The vectors in this file are taken verbatim from RFC 6238 Appendix B.
 * They use the ASCII secrets:
 *
 *   SHA-1   : "12345678901234567890"                          (20 bytes)
 *   SHA-256 : "12345678901234567890123456789012"              (32 bytes)
 *   SHA-512 : "1234567890123456789012345678901234567890" +
 *              "1234567890123456789012345678901234"           (64 bytes)
 *
 * with `digits=8`, `period=30`, `T0=0`. Each vector pins a wall-clock
 * time and the expected code for each hash algorithm.
 *
 * Why digit inference is tested
 * -----------------------------
 *   The port's `verifyCode` derives the digit count from the
 *   user-typed code's length (8-digit vectors → 8-digit TOTP). This
 *   is what makes the same verifier class accept RFC vectors while
 *   production factors remain 6-digit (the authenticator-app
 *   default). The adapter rebuilds a `TOTP` per call to honour the
 *   submitted length.
 *
 * Replay protection
 * -----------------
 *   The matched `delta` is asserted for the window=0 path (must be
 *   0) and exercised for the window=1 path (must be -1 / 0 / +1).
 */
import { describe, expect, it } from 'vitest';

import { OtpAuthTotpVerifier } from '../src/infrastructure/mfa/totp-verifier.js';
import { safeZero } from '../src/util/dek-zero.js';

const SECRET_SHA1 = Buffer.from('12345678901234567890', 'ascii');
const SECRET_SHA256 = Buffer.from(
    '12345678901234567890123456789012',
    'ascii',
);
const SECRET_SHA512 = Buffer.from(
    '1234567890123456789012345678901234567890123456789012345678901234',
    'ascii',
);

const verifier = new OtpAuthTotpVerifier();

// [time_seconds, sha1_code, sha256_code, sha512_code]
const VECTORS: ReadonlyArray<
    readonly [number, string, string, string]
> = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
];

describe('RFC 6238 Appendix B — TOTP reference vectors', () => {
    describe('SHA-1', () => {
        for (const [time, expected] of VECTORS) {
            it(`T=${time}s → ${expected}`, async () => {
                const code = await verifier.verifyCode(
                    SECRET_SHA1,
                    expected,
                    0,
                    time * 1000,
                );
                expect(code).toEqual({ valid: true, delta: 0 });
            });
        }
    });

    describe('SHA-256', () => {
        for (const [time, , expected] of VECTORS) {
            it(`T=${time}s → ${expected}`, async () => {
                const code = await verifier.verifyCode(
                    SECRET_SHA256,
                    expected,
                    0,
                    time * 1000,
                );
                expect(code).toEqual({ valid: true, delta: 0 });
            });
        }
    });

    describe('SHA-512', () => {
        for (const [time, , , expected] of VECTORS) {
            it(`T=${time}s → ${expected}`, async () => {
                const code = await verifier.verifyCode(
                    SECRET_SHA512,
                    expected,
                    0,
                    time * 1000,
                );
                expect(code).toEqual({ valid: true, delta: 0 });
            });
        }
    });

    it('currentCode agrees with verifyCode at the same instant', async () => {
        const nowMs = 1_700_000_000_000;
        const code = await verifier.currentCode(SECRET_SHA1, nowMs);
        const v = await verifier.verifyCode(SECRET_SHA1, code, 0, nowMs);
        expect(v.valid).toBe(true);
    });
});

describe('TOTP verifier — window and clock drift', () => {
    const NOW_S = 1_700_000_000;
    const secret = SECRET_SHA1; // 20-byte secret

    it('window=1 accepts the previous step (delta = -1)', async () => {
        const prev = await verifier.currentCode(secret, (NOW_S - 30) * 1000);
        const r = await verifier.verifyCode(secret, prev, 1, NOW_S * 1000);
        expect(r.valid).toBe(true);
        if (r.valid) expect(r.delta).toBe(-1);
    });

    it('window=1 accepts the next step (delta = +1)', async () => {
        const next = await verifier.currentCode(secret, (NOW_S + 30) * 1000);
        const r = await verifier.verifyCode(secret, next, 1, NOW_S * 1000);
        expect(r.valid).toBe(true);
        if (r.valid) expect(r.delta).toBe(1);
    });

    it('window=0 refuses the previous step', async () => {
        const prev = await verifier.currentCode(secret, (NOW_S - 30) * 1000);
        const r = await verifier.verifyCode(secret, prev, 0, NOW_S * 1000);
        expect(r.valid).toBe(false);
    });

    it('window=0 refuses the next step', async () => {
        const next = await verifier.currentCode(secret, (NOW_S + 30) * 1000);
        const r = await verifier.verifyCode(secret, next, 0, NOW_S * 1000);
        expect(r.valid).toBe(false);
    });
});

describe('TOTP verifier — input validation', () => {
    const secret = SECRET_SHA1;
    const now = 1_700_000_000_000;

    it('rejects non-numeric codes', async () => {
        const r = await verifier.verifyCode(secret, 'abcdef', 0, now);
        expect(r.valid).toBe(false);
    });

    it('rejects codes that contain whitespace after normalisation still fail', async () => {
        // Whitespace IS stripped; the resulting "123abc" is non-numeric.
        const r = await verifier.verifyCode(secret, '123 abc', 0, now);
        expect(r.valid).toBe(false);
    });

    it('rejects an empty Buffer secret', async () => {
        await expect(
            verifier.verifyCode(Buffer.alloc(0), '000000', 0, now),
        ).rejects.toThrow();
    });

    it('rejects a negative window', async () => {
        await expect(
            verifier.verifyCode(secret, '000000', -1, now),
        ).rejects.toThrow();
    });
});

describe('TOTP verifier — enrollment', () => {
    it('produces a well-formed otpauth:// URI and a fresh secret', async () => {
        const e = await verifier.generateEnrollment('user-42', 'Primary phone');
        // SHA-1 default → 20-byte secret.
        expect(e.secret).toBeInstanceOf(Buffer);
        expect(e.secret.length).toBe(20);
        // URI conforms to the otpauth scheme.
        expect(e.otpauthUri.startsWith('otpauth://totp/')).toBe(true);
        expect(e.otpauthUri).toMatch(/[?&]secret=[A-Z2-7]+/);
        expect(e.otpauthUri).toContain('FLN%20Vault');
        expect(e.otpauthUri).toContain('algorithm=SHA1');
        expect(e.otpauthUri).toContain('digits=6');
        expect(e.otpauthUri).toContain('period=30');
        safeZero(e.secret);
    });

    it('produces a 32-byte secret for SHA-256', async () => {
        const e = await verifier.generateEnrollment('user-42', 'Primary', {
            algorithm: 'SHA256',
        });
        expect(e.secret.length).toBe(32);
        expect(e.otpauthUri).toContain('algorithm=SHA256');
        safeZero(e.secret);
    });

    it('produces a 64-byte secret for SHA-512', async () => {
        const e = await verifier.generateEnrollment('user-42', 'Primary', {
            algorithm: 'SHA512',
        });
        expect(e.secret.length).toBe(64);
        expect(e.otpauthUri).toContain('algorithm=SHA512');
        safeZero(e.secret);
    });

    it('rejects empty actor and label', async () => {
        await expect(verifier.generateEnrollment('', 'label')).rejects.toThrow();
        await expect(verifier.generateEnrollment('actor', '')).rejects.toThrow();
    });
});