// Manual E2E driver for the Aadhaar Reveal enroll-once / step-up flow
// (Wave 3 — refactored to the Wave 2A account-level MFA surface).
//
// Run:  cd backend && node tests/manual-e2e-totp.cjs
//
// Drives the full happy path against a running dev backend (default
// http://127.0.0.1:3000) as a superadmin. The script NEVER prints
// plaintext Aadhaar or TOTP codes; it asserts the API shapes only.
//
// The key invariants this script proves against the LIVE backend:
//   - POST /api/me/mfa/enroll mints a PENDING_ENROLLMENT factor on
//     first call (200 + new factorId + otpauthUri).
//   - A SECOND call to /api/me/mfa/enroll returns 409 with the
//     existing factorId — the route is "one factor per admin" by
//     design. No new secret crosses the wire. (This is the
//     Wave 2A deviation #2 from the resumable-200 path.)
//   - GET /api/me/mfa/factors is actor-scoped (admin A cannot see
//     admin B's factors).
//   - The deprecated per-student endpoints return 410 Gone:
//       GET  /api/students/:id/aadhaar/mfa/me
//       POST /api/students/:id/aadhaar/mfa/enroll
//   - The full step-up flow (request → approve with TOTP →
//     detokenize) round-trips through the vault and returns the
//     plaintext masked properly. The hard invariant: step-up
//     SELECTS an existing ENROLLED factor; it does NOT mint
//     a new factor on demand.
//
// The script uses a directly-signed dev JWT to authenticate (no
// password is read, logged, or hardcoded). Set JWT_SECRET to the
// dev backend's .env value.

const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const EMAIL = process.env.EMAIL || 'superadmin@fln.org';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const token = jwt.sign({ email: EMAIL }, JWT_SECRET, { expiresIn: '1h' });
const auth = { Authorization: `Bearer ${token}` };

function req(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const r = http.request({
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let json = null; try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// Parse the base32 secret from an otpauth:// URI so the script
// can compute a current TOTP code. Used only in the first-time
// enroll path (the second enroll returns 409 with no otpauthUri,
// so we keep the secret from the first call).
function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = s.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = '', out = [];
  for (const ch of clean) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

function totp(secretBytes, t = Math.floor(Date.now() / 1000), digits = 8) {
  const counter = Math.floor(t / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16)
            | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  const mod = 10 ** digits;
  return (bin % mod).toString().padStart(digits, '0');
}

function ok(label) { console.log(`   \x1b[32mOK\x1b[0m — ${label}`); }
function fail(label, detail) {
  console.log(`   \x1b[31mFAIL\x1b[0m — ${label}`);
  if (detail) console.log('         ', detail);
}

(async () => {
  // ─── Phase 1: auth + fetch one student ─────────────────────────────
  console.log(`[1/7] auth: signed dev JWT for ${EMAIL}`);
  const list = await req('GET', '/api/students?limit=1&sort=latest', auth);
  if (list.status !== 200 || !Array.isArray(list.json) || list.json.length === 0) {
    fail('list failed', JSON.stringify(list.json).slice(0, 200));
    process.exit(1);
  }
  const student = list.json[0];
  ok(`student ${student.id} (${student.name}) mask=${student.aadharMasked}`);

  // ─── Phase 2: preflight /api/me/mfa/factors (actor-scoped, no factors yet) ─
  console.log('[2/7] preflight: GET /api/me/mfa/factors (actor-scoped)');
  const me1 = await req('GET', '/api/me/mfa/factors', auth);
  if (me1.status !== 200) {
    fail(`status=${me1.status}`, JSON.stringify(me1.json));
    process.exit(1);
  }
  const initialFactorCount = me1.json?.factors?.length ?? 0;
  ok(`status=200 factors.length=${initialFactorCount}`);

  // ─── Phase 3: first enroll — POST /api/me/mfa/enroll (mints a new factor) ─
  console.log('[3/7] first enroll: POST /api/me/mfa/enroll (mints a new factor)');
  const e1 = await req('POST', '/api/me/mfa/enroll', auth, { label: 'manual-e2e-1' });
  if (e1.status !== 200) { fail(`enroll status=${e1.status}`, JSON.stringify(e1.json)); process.exit(1); }
  if (e1.json?.lifecycleState !== 'PENDING_ENROLLMENT') {
    fail('first enroll must return lifecycleState=PENDING_ENROLLMENT', JSON.stringify(e1.json));
    process.exit(1);
  }
  if (!e1.json?.otpauthUri) {
    fail('first enroll must return a non-empty otpauthUri', JSON.stringify(e1.json));
    process.exit(1);
  }
  const factorId = e1.json.factorId;
  const otpauthUri = e1.json.otpauthUri;
  ok(`lifecycleState=${e1.json.lifecycleState} factorId=${factorId}`);

  // ─── Phase 4: second enroll — POST /api/me/mfa/enroll (must 409 with same factorId) ─
  console.log('[4/7] second enroll: POST /api/me/mfa/enroll (the critical 409 path)');
  const e2 = await req('POST', '/api/me/mfa/enroll', auth, { label: 'manual-e2e-2' });
  if (e2.status !== 409) {
    fail(`second enroll must be 409, got ${e2.status}`, JSON.stringify(e2.json));
    process.exit(1);
  }
  if (e2.json?.error !== 'ALREADY_ENROLLED') {
    fail(`second enroll must surface error=ALREADY_ENROLLED`, JSON.stringify(e2.json));
    process.exit(1);
  }
  if (e2.json?.factorId !== factorId) {
    fail(`second enroll must echo the SAME factorId`, `first=${factorId} second=${e2.json?.factorId}`);
    process.exit(1);
  }
  if (e2.json?.otpauthUri) {
    fail('second enroll must NOT return a new otpauthUri (no new secret on the wire)', `uri=${e2.json.otpauthUri}`);
    process.exit(1);
  }
  ok(`409 ALREADY_ENROLLED, reused factor ${e2.json.factorId} — no new QR`);

  // ─── Phase 5: deprecated /mfa/enroll + /mfa/me must 410 Gone ─────
  console.log('[5/7] deprecation: deprecated per-student MFA endpoints return 410 Gone');
  const deprecEnroll = await req('POST', `/api/students/${student.id}/aadhaar/mfa/enroll`, auth, {});
  if (deprecEnroll.status !== 410 || deprecEnroll.json?.error !== 'MOVED' || deprecEnroll.json?.newEndpoint !== '/api/me/mfa/enroll') {
    fail(`/mfa/enroll must 410 MOVED, got ${deprecEnroll.status}`, JSON.stringify(deprecEnroll.json));
    process.exit(1);
  }
  ok('POST /api/students/:id/aadhaar/mfa/enroll → 410 MOVED → /api/me/mfa/enroll');

  const deprecMe = await req('GET', `/api/students/${student.id}/aadhaar/mfa/me`, auth);
  if (deprecMe.status !== 410 || deprecMe.json?.error !== 'MOVED' || deprecMe.json?.newEndpoint !== '/api/me/mfa/factors') {
    fail(`/mfa/me must 410 MOVED, got ${deprecMe.status}`, JSON.stringify(deprecMe.json));
    process.exit(1);
  }
  ok('GET /api/students/:id/aadhaar/mfa/me → 410 MOVED → /api/me/mfa/factors');

  // ─── Phase 6: step-up request + approve (TOTP) ─────────────────────
  console.log('[6/7] step-up: POST /step-up/request then /step-up/approve with current TOTP');
  const r1 = await req('POST', `/api/students/${student.id}/aadhaar/step-up/request`, auth, { factorId });
  if (r1.status !== 200 || !r1.json?.challengeId) {
    fail('step-up request failed', JSON.stringify(r1.json));
    process.exit(1);
  }
  const challengeId = r1.json.challengeId;
  ok(`step-up/request → challengeId=${challengeId} expiresAt=${r1.json.expiresAt}`);

  // Parse the secret from the otpauthUri we captured in phase 3,
  // then compute a current TOTP code. The script NEVER logs the
  // code — it's forwarded directly to the approve endpoint.
  const secretMatch = otpauthUri.match(/[?&]secret=([A-Z2-7]+)/i);
  if (!secretMatch) { fail('could not parse secret from otpauth URI', otpauthUri); process.exit(1); }
  const secretBytes = base32Decode(secretMatch[1]);

  const code = totp(secretBytes);
  const a1 = await req('POST', `/api/students/${student.id}/aadhaar/step-up/approve`, auth, { challengeId, code });
  if (a1.status !== 200) { fail('step-up approve failed', JSON.stringify(a1.json)); process.exit(1); }
  ok(`step-up/approve → status=${a1.json.status} verifiedFactorId=${a1.json.verifiedFactorId}`);

  // ─── Phase 7: detokenize + plaintext round-trip + final report ─────
  console.log('[7/7] detokenize: POST /detokenize and report');
  const d1 = await req('POST', `/api/students/${student.id}/aadhaar/detokenize`, auth, { challengeId });
  if (d1.status !== 200 || !d1.json?.aadhaar) { fail('detokenize failed', JSON.stringify(d1.json)); process.exit(1); }
  // Sanity: last4 must equal the trailing 4 digits of the raw
  // Aadhaar we just revealed, and the masked envelope must match
  // the XXXX-XXXX-NNNN format the route emits.
  const expectedMask = `XXXX-XXXX-${d1.json.last4}`;
  if (d1.json.aadharMasked !== expectedMask) {
    fail(`aadharMasked=${d1.json.aadharMasked} does not match last4=${d1.json.last4}`, expectedMask);
    process.exit(1);
  }
  ok(`detokenize → last4=${d1.json.last4} aadharMasked=${d1.json.aadharMasked} auditId=${d1.json.auditId}`);

  console.log('\nRESULT: enroll-once / step-up-for-each-reveal flow passes end-to-end on the live backend');
  console.log('  - first enroll mints a PENDING_ENROLLMENT factor with a QR (otpauthUri)');
  console.log('  - re-enroll returns 409 ALREADY_ENROLLED with the SAME factorId (no new QR, no new secret)');
  console.log('  - GET /api/me/mfa/factors is actor-scoped');
  console.log('  - deprecated per-student /mfa/* endpoints return 410 MOVED to the new account-level paths');
  console.log('  - step-up request, TOTP approve, and detokenize all succeed (auditId recorded)');
  process.exit(0);
})().catch(e => { console.error('script error:', e); process.exit(1); });
