/* =========================================================
 * Aadhaar Vault — Step-Up Developer Console
 * 5-step wizard:
 *   1. Select Token
 *   2. Enroll MFA  (browser-computed TOTP via otpauth)
 *   3. Request Step-Up
 *   4. Approve Challenge (TOTP taken from session)
 *   5. Detokenize
 *
 * The standalone Verify MFA step is removed.
 * Approve Challenge performs complete TOTP verification.
 *
 * No backend code is touched — only the four existing endpoints
 * are used: POST /v1/mfa/enroll, POST /v1/detokenize/request,
 *           POST /v1/detokenize/step-up/{id}/approve, POST /v1/detokenize
 * ========================================================= */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : globalThis;
  var AV = root.AV || (root.AV = {});
  var LOG = AV.logger || {
    workflow: function () {},
    error: function () {},
    http: function () {}
  };

  // =========================================================
  // Runtime workflow session model
  // =========================================================
  var SESSION_KEY = 'av.stepup.session.v2';

  var RUNTIME_SESSION_DEFAULTS = {
    tokenId: '',
    // ── Step 2 outputs ──────────────────────────────────────
    factorId: '',
    otpauthUri: '',
    enrollCreatedAt: '',
    currentTOTP: '',
    approveTOTP: '',
    totpRemaining: 0,
    totpPeriod: 30,
    totpDigits: 6,
    // ── Step 3 outputs ──────────────────────────────────────
    challengeId: '',
    challengeExpires: '',
    challengeStatus: '',
    // ── Step 4 outputs ──────────────────────────────────────
    challengeApproved: false,
    approveStatus: '',
    approveApprovedAt: '',
    approveVerifiedFactor: '',
    // ── Step 5 outputs ──────────────────────────────────────
    detokenized: '',
    detokenLast4: '',
    detokenIdentityId: '',
    detokenAuditId: '',
    lastApiCall: null
  };

  var runtimeSession = createRuntimeSession();
  var session = runtimeSession;

  // -----------------------------------------------------------------
  // Diagnostics state (step-up console additions)
  // -----------------------------------------------------------------
  var diagnostics = {
    devMode: false,
    lastApiCall: null,
    apiCallLog: []
  };

  // =========================================================
  // Card state machine
  //   state ∈ { idle, success, failed }
  // =========================================================
  var stepState = {
    select: 'idle',
    enroll: 'idle',
    request: 'idle',
    approve: 'idle',
    detokenize: 'idle'
  };

  // Per-card in-flight flags (disable buttons while a request is running)
  var running = {
    enroll: false,
    request: false,
    approve: false,
    detokenize: false
  };

  // =========================================================
  // DOM helpers
  // =========================================================
  function byId(id) { return document.getElementById(id); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function getVal(id) {
    var el = byId(id);
    if (!el) return '';
    if (el.type === 'checkbox') return !!el.checked;
    return el.value || '';
  }
  function setVal(id, v) {
    var el = byId(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = (v == null) ? '' : String(v);
  }
  function setText(id, v) {
    var el = byId(id);
    if (el) el.textContent = (v == null || v === '') ? '—' : String(v);
  }
  function setHidden(id, hidden) {
    var el = byId(id);
    if (el) el.hidden = !!hidden;
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  function fmtTimestamp(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
  }

  // =========================================================
  // Configuration + runtime session helpers
  // =========================================================
  function createRuntimeSession() {
    var out = {};
    Object.keys(RUNTIME_SESSION_DEFAULTS).forEach(function (k) {
      out[k] = RUNTIME_SESSION_DEFAULTS[k];
    });
    return out;
  }

  function settings() {
    return (AV.storage && AV.storage.getSettings)
      ? AV.storage.getSettings()
      : { apiBase: '', bearer: '', actor: '', actorRole: '' };
  }

  function clearPersistedWorkflow() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  // =========================================================
  // Bearer pre-flight, JWT decode (INSPECTION ONLY), error shaping
  // -------------------------------------------------------------
  // The browser never decides whether a token is valid.
  // decodeJwt() only extracts the base64 payload so the operator
  // can see the claims; it does NOT verify the signature, issuer,
  // audience, scope, or expiry. Authentication is always decided
  // by the backend's auth plugin (src/auth/plugin.ts).
  // =========================================================

  /**
   * Pre-flight check used by every authenticated handler.
   * Throws a human-readable Error when the shared bearer setting is empty,
   * so no fetch is issued and the wizard stays on its current step.
   *
   * @param {string} label  Short human label, e.g. "Enroll MFA".
   */
  function requireBearer(label) {
    var b = settings().bearer;
    if (!b || typeof b !== 'string' || !b.trim()) {
      throw new Error(
        label + ' requires a bearer token. ' +
        'Open Step 1 (Select Token) and paste a valid JWT first.'
      );
    }
  }

  /**
   * RFC 4648 base64url decode with proper '=' padding.
   * Returns a UTF-8 string. Works in any browser; does NOT depend
   * on `atob` polyfills.
   *
   * @param {string} input  base64url-encoded segment.
   * @returns {string}
   */
  function b64urlDecode(input) {
    var s = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    var padLen = (4 - (s.length % 4)) % 4;
    for (var i = 0; i < padLen; i++) s += '=';
    if (typeof atob === 'function') {
      try {
        // atob gives us a binary string; interpret each char as a
        // byte. The JWT payload is JSON which is ASCII-only, so a
        // naive `decodeURIComponent(escape(atob(...)))` is safe.
        return decodeURIComponent(escape(atob(s)));
      } catch (_) { /* fall through to Buffer path */ }
    }
    // Node / non-browser fallback (mirrors api.js parseJwt).
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(s, 'base64').toString('utf8');
    }
    throw new Error('No base64 decoder available');
  }

  /**
   * Decode a JWT body for INSPECTION ONLY. The signature segment
   * is intentionally ignored — the backend remains the single
   * source of truth. Returns one of:
   *   { ok: true,  claims: object, expSec: number|null }
   *   { ok: false, reason: string }
   *
   * @param {string} token
   */
  function decodeJwt(token) {
    if (!token || typeof token !== 'string') {
      return { ok: false, reason: 'no token' };
    }
    var parts = token.split('.');
    if (parts.length !== 3) {
      return { ok: false, reason: 'not a 3-segment JWT' };
    }
    var json;
    try {
      json = b64urlDecode(parts[1]);
    } catch (e) {
      return { ok: false, reason: 'base64 decode failed: ' + (e && e.message || e) };
    }
    var claims;
    try {
      claims = JSON.parse(json);
    } catch (e) {
      return { ok: false, reason: 'claims JSON parse failed: ' + (e && e.message || e) };
    }
    if (!claims || typeof claims !== 'object') {
      return { ok: false, reason: 'claims is not an object' };
    }
    var expSec = null;
    if (typeof claims.exp === 'number' && isFinite(claims.exp)) expSec = claims.exp;
    return { ok: true, claims: claims, expSec: expSec };
  }

  /**
   * Render `decodeJwt` results into a small shape used by the
   * "Bearer Token Claims" panel and by the failure shaper.
   * Returns:
   *   { sub, iss, aud, iat, exp, scopes, ttlSeconds, expired,
   *     decodeOk, decodeReason, badge }
   *
   * `badge` is one of 'unknown' | 'expired' | 'ok' | 'invalid'.
   */
  function describeJwtClaims() {
    var result = decodeJwt(settings().bearer);
    if (!result.ok) {
      return {
        sub: '—', iss: '—', aud: '—', iat: '—', exp: '—',
        scopes: '—', ttlSeconds: null, expired: null,
        decodeOk: false, decodeReason: result.reason,
        badge: 'invalid'
      };
    }
    var c = result.claims;
    var nowSec = Math.floor(Date.now() / 1000);
    var ttl = null;
    var expired = null;
    if (result.expSec !== null) {
      ttl = result.expSec - nowSec;
      expired = ttl <= 0;
    }
    var scopes = '—';
    if (typeof c.scope === 'string') {
      scopes = c.scope.split(/\s+/).filter(Boolean).join(' ') || '—';
    } else if (Array.isArray(c.scopes)) {
      scopes = c.scopes.join(' ');
    } else if (Array.isArray(c.scope)) {
      scopes = c.scope.join(' ');
    }
    var fmtTime = function (sec) {
      if (sec == null || !isFinite(sec)) return '—';
      var d = new Date(sec * 1000);
      if (isNaN(d.getTime())) return '—';
      return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
    };
    return {
      sub: c.sub || c.subject || '—',
      iss: c.iss || c.issuer || '—',
      aud: (Array.isArray(c.aud) ? c.aud.join(',') : (c.aud || c.audience || '—')),
      iat: fmtTime(typeof c.iat === 'number' ? c.iat : null),
      exp: fmtTime(result.expSec),
      scopes: scopes,
      ttlSeconds: ttl,
      expired: expired,
      decodeOk: true,
      decodeReason: 'ok',
      badge: expired === true ? 'expired' : 'ok'
    };
  }

  function fmtTtl(ttl) {
    if (ttl == null || !isFinite(ttl)) return '—';
    if (ttl <= 0) return 'EXPIRED (' + Math.abs(ttl) + 's ago)';
    var m = Math.floor(ttl / 60);
    var s = ttl - m * 60;
    if (m === 0) return s + 's';
    return m + 'm ' + s + 's';
  }

  /**
   * Format a non-ok `AV.api.call` response into the multi-line
   * "HTTP n / Code: ... / Message: ..." shape used in step logs
   * and the on-screen status. The backend shape is
   *   { error, code, message, details? } for the auth plugin,
   *   { error, message, details? }     for route handlers.
   */
  function describeFailure(op, resp) {
    var status = (resp && typeof resp.status === 'number') ? resp.status : 0;
    var lines = [];
    lines.push('HTTP ' + status + (op ? (' — ' + op + ' failed') : ''));
    var body = resp && resp.body;
    if (body && typeof body === 'object') {
      var code = body.code || body.error;
      var msg  = body.message;
      if (code) lines.push('Code: ' + code);
      if (msg && msg !== code) lines.push('Message: ' + msg);
      if (body.details) lines.push('Details: ' + JSON.stringify(body.details));
    } else if (typeof body === 'string' && body.length) {
      lines.push('Body: ' + body.slice(0, 500));
    } else if (resp && resp.error && resp.error !== ('HTTP ' + status)) {
      lines.push('Transport: ' + resp.error);
    }
    return lines.join('\n');
  }

  /**
   * Render the bearer-claims panel. Idempotent: safe to call from
   * refreshAll(), onSaveSession(), and a 30s timer.
   */
  function refreshBearerClaims() {
    var badgeEl = byId('bearer-status-badge');
    var info = describeJwtClaims();
    setText('bearer-sub', info.sub);
    setText('bearer-iss', info.iss);
    setText('bearer-aud', info.aud);
    setText('bearer-iat', info.iat);
    setText('bearer-exp', info.exp);
    setText('bearer-ttl', fmtTtl(info.ttlSeconds));
    setText('bearer-scope', info.scopes);
    setText(
      'bearer-decode-status',
      info.decodeOk ? 'decoded (not verified)' : ('invalid: ' + info.decodeReason)
    );
    if (badgeEl) {
      badgeEl.dataset.state = info.badge;
      var label;
      if (info.badge === 'expired') label = 'EXPIRED';
      else if (info.badge === 'invalid') label = 'invalid';
      else if (info.badge === 'ok') label = 'valid';
      else label = 'unknown';
      badgeEl.textContent = label;
    }
  }

  // 30-second ticker so the "time until expiry" counter and the
  // EXPIRED badge flip without a button click. The backend remains
  // authoritative on whether the token is actually accepted.
  var bearerTicker = null;
  function startBearerTicker() {
    if (bearerTicker) return;
    bearerTicker = setInterval(refreshBearerClaims, 30_000);
  }
  function stopBearerTicker() {
    if (bearerTicker) {
      clearInterval(bearerTicker);
      bearerTicker = null;
    }
  }

  // =========================================================
  // TOTP engine (RFC 6238) — browser side, no backend round-trip
  // =========================================================
  var BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Decode(input) {
    if (!input) return new Uint8Array();
    var cleaned = String(input).replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
    var bits = '';
    for (var i = 0; i < cleaned.length; i++) {
      var v = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (v < 0) continue;
      bits += v.toString(2);
      while (bits.length % 5 !== 0) bits = '0' + bits;
    }
    var bytes = [];
    for (var j = 0; j + 8 <= bits.length; j += 8) {
      bytes.push(parseInt(bits.substr(j, 8), 2));
    }
    return new Uint8Array(bytes);
  }

  function parseOtpauth(uri) {
    if (!uri) return null;
    try {
      var u = new URL(uri);
      if (u.protocol !== 'otpauth:') return null;
      var secret = u.searchParams.get('secret') || '';
      var period = parseInt(u.searchParams.get('period') || '30', 10);
      var digits = parseInt(u.searchParams.get('digits') || '6', 10);
      var algorithm = (u.searchParams.get('algorithm') || 'SHA1').toUpperCase();
      if (!period || period < 1) period = 30;
      if (!digits || digits < 4) digits = 6;
      return { secret: secret, period: period, digits: digits, algorithm: algorithm };
    } catch (e) {
      return null;
    }
  }

  function algorithmToHash(algo) {
    if (algo === 'SHA256') return 'SHA-256';
    if (algo === 'SHA512') return 'SHA-512';
    return 'SHA-1';
  }

  function counterToBytes(counter) {
    var buf = new ArrayBuffer(8);
    var view = new DataView(buf);
    // 64-bit big-endian — DataView only supports 32-bit, so split
    var high = Math.floor(counter / 0x100000000);
    var low = counter & 0xffffffff;
    view.setUint32(0, high);
    view.setUint32(4, low);
    return new Uint8Array(buf);
  }

  async function computeTOTP(otpauthUri) {
    var parsed = parseOtpauth(otpauthUri);
    if (!parsed) return null;
    if (!root.crypto || !root.crypto.subtle) return null;
    var keyBytes = base32Decode(parsed.secret);
    if (keyBytes.length === 0) return null;
    var now = Math.floor(Date.now() / 1000);
    var counter = Math.floor(now / parsed.period);
    var remaining = parsed.period - (now % parsed.period);
    var key = await root.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: algorithmToHash(parsed.algorithm) },
      false,
      ['sign']
    );
    var sig = new Uint8Array(await root.crypto.subtle.sign('HMAC', key, counterToBytes(counter)));
    var offset = sig[sig.length - 1] & 0x0f;
    var bin =
      ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff);
    var mod = Math.pow(10, parsed.digits);
    var code = pad(bin % mod, parsed.digits);
    return { code: code, remaining: remaining, period: parsed.period, digits: parsed.digits };
  }

  // =========================================================
  // TOTP ticker — recomputes on each 30-second boundary
  // =========================================================
  var totpTimer = null;
  var lastCounter = -1;

  function startTotpTicker() {
    stopTotpTicker();
    if (!session.otpauthUri) return;
    totpTimer = setInterval(onTotpTick, 1000);
    onTotpTick();
  }
  function stopTotpTicker() {
    if (totpTimer) {
      clearInterval(totpTimer);
      totpTimer = null;
    }
    lastCounter = -1;
  }
  async function onTotpTick() {
    if (!session.otpauthUri) return;
    var parsed = parseOtpauth(session.otpauthUri);
    if (!parsed) return;
    var now = Math.floor(Date.now() / 1000);
    var counter = Math.floor(now / parsed.period);
    var remaining = parsed.period - (now % parsed.period);
    session.totpRemaining = remaining;
    if (counter !== lastCounter) {
      var result = await computeTOTP(session.otpauthUri);
      if (result) {
        session.currentTOTP = result.code;
        session.totpPeriod = result.period;
        session.totpDigits = result.digits;
        lastCounter = counter;
      }
    }
    refreshTotpDisplay();
    refreshDevInfo();
  }
  async function refreshTotp(force) {
    if (!session.otpauthUri) return;
    var result = await computeTOTP(session.otpauthUri);
    if (result) {
      session.currentTOTP = result.code;
      session.totpRemaining = result.remaining;
      session.totpPeriod = result.period;
      session.totpDigits = result.digits;
      var now = Math.floor(Date.now() / 1000);
      lastCounter = Math.floor(now / result.period);
    }
    refreshTotpDisplay();
    refreshDevInfo();
  }
  function onRefreshTotp() {
    if (!session.otpauthUri) {
      LOG.workflow('Refresh TOTP', '⏳ No otpauth URI available — enroll MFA first', {});
      return;
    }
    refreshTotp(true);
  }

  // =========================================================
  // Card state UI
  // =========================================================
  function setStepState(card, state) {
    stepState[card] = state;
    var stateEl = byId('state-' + card);
    if (stateEl) {
      stateEl.dataset.state = state;
      if (state === 'success') stateEl.textContent = '✅ Completed';
      else if (state === 'failed') stateEl.textContent = '❌ Failed';
      else stateEl.textContent = '⏳ Pending';
    }
    var pillEl = byId('pill-' + card);
    if (pillEl) {
      pillEl.className = 'av-pill state-pill state-' + state;
      pillEl.textContent = (state === 'success') ? 'Success' :
                           (state === 'failed') ? 'Failed' : 'Idle';
    }
  }

  function setRunningUI(card, isRunning, label) {
    var btn = byId('btn-' + cardToBtn(card));
    if (btn) {
      btn.disabled = !!isRunning;
      btn.textContent = label || btn.textContent;
    }
  }
  function cardToBtn(card) {
    if (card === 'enroll') return 'enroll';
    if (card === 'request') return 'request';
    if (card === 'approve') return 'approve';
    if (card === 'detokenize') return 'detach';
    return card;
  }

  function setCardEnabled(card, enabled) {
    var el = byId('card-' + card);
    if (!el) return;
    if (enabled) el.classList.remove('is-disabled');
    else el.classList.add('is-disabled');
  }

  function refreshUnlocks() {
    var cfg = settings();
    var haveSession = !!(cfg.apiBase && cfg.bearer && cfg.actor && cfg.actorRole && session.tokenId);
    var btnEnroll = byId('btn-enroll');
    var btnRequest = byId('btn-request');
    var btnApprove = byId('btn-approve');
    var btnDetach = byId('btn-detach');

    if (btnEnroll) btnEnroll.disabled = !haveSession || !cfg.actor || !cfg.actorRole || running.enroll;
    if (btnRequest) btnRequest.disabled = !(stepState.enroll === 'success' && session.factorId) || running.request;
    if (btnApprove) btnApprove.disabled = !(stepState.request === 'success' && session.challengeId && getApproveTotp()) || running.approve;
    if (btnDetach) btnDetach.disabled = !(stepState.approve === 'success' && session.challengeApproved) || running.detokenize;

    setCardEnabled('select', true);
    setCardEnabled('enroll', stepState.select === 'success');
    setCardEnabled('request', stepState.enroll === 'success');
    setCardEnabled('approve', stepState.request === 'success');
    setCardEnabled('detokenize', stepState.approve === 'success');
  }

  // =========================================================
  // Renderers
  // =========================================================
  function refreshAll() {
    renderForm();
    renderEnroll();
    renderRequest();
    renderApprove();
    renderDetokenize();
    refreshTotpDisplay();
    refreshDevInfo();
    refreshSessionInspector();
    refreshUnlocks();
    refreshBearerClaims();
  }

  function renderForm() {
    var cfg = settings();
    setVal('sel-api', cfg.apiBase);
    setVal('sel-bearer', cfg.bearer);
    setVal('sel-actor', cfg.actor);
    setVal('sel-role', cfg.actorRole);
    setVal('sel-token', session.tokenId);
  }

  function renderEnroll() {
    setText('enroll-factor-id', session.factorId);
    setText('enroll-otpauth', session.otpauthUri);
    setText('enroll-created', fmtTimestamp(session.enrollCreatedAt));
    setHidden('totp-display', !session.otpauthUri);
  }

  function renderRequest() {
    setText('request-token', session.tokenId);
    setText('request-factor', session.factorId);
    setText('request-challenge-id', session.challengeId);
    setText('request-expires', fmtTimestamp(session.challengeExpires));
  }

  function renderApprove() {
    setText('approve-challenge-id', session.challengeId);
    setVal('approve-totp', session.approveTOTP || session.currentTOTP || '');
    setText('approve-status', session.approveStatus || '—');
    setText('approve-verify-factor', session.approveVerifiedFactor);
    setText('approve-approved-at', fmtTimestamp(session.approveApprovedAt));
  }

  function renderDetokenize() {
    var cfg = settings();
    setText('detach-challenge', session.challengeId);
    setText('detach-actor', cfg.actor);
    setText('detach-token', session.tokenId);
    setText('detach-aadhaar', session.detokenized);
    setText('detach-last4', session.detokenLast4);
    setText('detach-identity', session.detokenIdentityId);
    setText('detach-audit', session.detokenAuditId);
  }

  function refreshTotpDisplay() {
    var code = session.currentTOTP || '——————';
    var remaining = (session.totpRemaining == null) ? 0 : session.totpRemaining;
    setText('totp-code', code);
    setText('totp-remaining', remaining + ' s');
    var period = session.totpPeriod || 30;
    var pct = Math.max(0, Math.min(100, (remaining / period) * 100));
    var bar = byId('totp-progress-bar');
    if (bar) bar.style.width = pct.toFixed(1) + '%';
    paintBrowserUtc();
  }

  function refreshDevInfo() {
    var cfg = settings();
    setText('dev-factor-id', session.factorId);
    setText('dev-otpauth', session.otpauthUri);
    setText('dev-current-totp', session.currentTOTP);
    setText('dev-remaining', session.totpRemaining + ' s');
    setText('dev-challenge-id', session.challengeId);
    setText('dev-challenge-status', session.challengeStatus || (session.challengeApproved ? 'approved' : '—'));
    setText('dev-challenge-expires', fmtTimestamp(session.challengeExpires));
    setText('dev-verified-factor', session.approveVerifiedFactor);
    setText('dev-approved-at', fmtTimestamp(session.approveApprovedAt));
    setText('dev-detokenized', session.detokenized ? 'yes' : 'no');
    setText('dev-actor-id', cfg.actor);
    setText('dev-api-base', cfg.apiBase);
    setText('dev-mode', diagnostics.devMode ? 'ON' : 'OFF');
    if (diagnostics.lastApiCall) {
      setText('dev-last-api', (diagnostics.lastApiCall.method || '') + ' ' + (diagnostics.lastApiCall.url || ''));
    } else {
      setText('dev-last-api', '—');
    }
    paintBrowserUtc();
  }

  function refreshSessionInspector() {
    var el = byId('session-inspector');
    if (!el) return;
    var snapshot = JSON.parse(JSON.stringify(session));
    snapshot.running = JSON.parse(JSON.stringify(running));
    snapshot.stepState = JSON.parse(JSON.stringify(stepState));
    try {
      el.textContent = JSON.stringify(snapshot, null, 2);
    } catch (e) {
      el.textContent = String(snapshot);
    }
  }

  // =========================================================
  // Per-card error / API inspector (step-up console additions)
  // -------------------------------------------------------------
  // These helpers are wired into the four authenticated handlers
  // (Enroll MFA, Request Step-Up, Approve Challenge, Detokenize).
  // Each handler clears its card error at the start of a request,
  // renders the error block on failure, and the AV.api.call
  // interceptor records the request/response into the per-card
  // API inspector and the global diagnostics store.
  // =========================================================
  function parseErrorInfo(err) {
    var msg = (err && err.message) ? err.message : String(err);
    var info = { status: null, code: null, message: null, details: null };
    if (!msg) return info;
    var lines = msg.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m;
      if ((m = line.match(/^HTTP\s+(\d+)/))) info.status = parseInt(m[1], 10);
      else if ((m = line.match(/^Code:\s+(.*)$/))) info.code = m[1];
      else if ((m = line.match(/^Message:\s+(.*)$/))) info.message = m[1];
      else if ((m = line.match(/^Details:\s+(.*)$/))) {
        try { info.details = JSON.parse(m[1]); } catch (e) { info.details = m[1]; }
      }
    }
    if (info.status == null && info.code == null && info.message == null) {
      info.message = msg;
    }
    return info;
  }

  function clearCardError(stepId) {
    var err = byId('card-error-' + stepId);
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
  }

  function renderCardError(stepId, info) {
    var err = byId('card-error-' + stepId);
    if (!err) return;
    var lines = [];
    if (info && info.status) lines.push('HTTP ' + info.status);
    if (info && info.code) lines.push('Code: ' + info.code);
    if (info && info.message && info.message !== info.code) lines.push('Message: ' + info.message);
    if (info && info.details != null) {
      try { lines.push('Details: ' + JSON.stringify(info.details)); }
      catch (e) { lines.push('Details: ' + String(info.details)); }
    }
    if (!lines.length) lines.push('Request failed.');
    err.textContent = lines.join('\n');
    err.hidden = false;
  }

  function renderApiInspector(stepId, rec) {
    var panel = byId('api-inspector-' + stepId);
    if (!panel) return;
    var pre = panel.querySelector('pre');
    if (!pre) return;
    if (!rec) {
      panel.hidden = true;
      pre.textContent = '—';
      return;
    }
    var dump = {
      time: rec.time || new Date().toISOString(),
      method: rec.method,
      url: rec.url,
      requestHeaders: rec.requestHeaders || null,
      requestBody: rec.requestBody || null,
      responseStatus: rec.responseStatus || null,
      responseBody: rec.responseBody || null,
      error: rec.error || null
    };
    pre.textContent = JSON.stringify(dump, null, 2);
    panel.hidden = false;
  }

  function recordApiCall(stepId, rec) {
    var entry = {
      stepId: stepId,
      time: new Date().toISOString(),
      method: rec.method,
      url: rec.url,
      requestHeaders: rec.requestHeaders || null,
      requestBody: rec.requestBody || null,
      responseStatus: rec.responseStatus || null,
      responseBody: rec.responseBody || null,
      error: rec.error || null
    };
    diagnostics.lastApiCall = entry;
    session.lastApiCall = entry;
    diagnostics.apiCallLog.push(entry);
    if (diagnostics.apiCallLog.length > 50) diagnostics.apiCallLog.shift();
    var devLast = byId('dev-last-api');
    if (devLast) devLast.textContent = (rec.method || '') + ' ' + (rec.url || '');
    renderApiInspector(stepId, entry);
  }

  function redactHeaders(headers) {
    if (!headers || typeof headers !== 'object') return headers;
    var h = {};
    Object.keys(headers).forEach(function (k) {
      if (/^(authorization|cookie|x-api-key)$/i.test(k)) h[k] = '<redacted>';
      else h[k] = headers[k];
    });
    return h;
  }

  function stepIdForUrl(method, url) {
    if (method !== 'POST') return null;
    if (/\/v1\/mfa\/enroll(\?|$)/.test(url)) return 'enroll';
    if (/\/v1\/detokenize\/request(\?|$)/.test(url)) return 'request';
    if (/\/v1\/detokenize\/step-up\/[^/]+\/approve(\?|$)/.test(url)) return 'approve';
    if (/\/v1\/detokenize(\?|$)/.test(url)) return 'detokenize';
    return null;
  }

  function installApiCallInterceptor() {
    if (!AV.api || typeof AV.api.call !== 'function') return;
    if (AV.api.call.__avStepupWrapped) return;
    var original = AV.api.call;
    var wrapped = function (method, url, body, headers) {
      var promise;
      try { promise = original.call(AV.api, method, url, body, headers); }
      catch (e) { promise = Promise.reject(e); }
      var stepId = stepIdForUrl(method, url);
      if (!stepId) return promise;
      Promise.resolve(promise).then(function (resp) {
        recordApiCall(stepId, {
          method: method,
          url: url,
          requestHeaders: redactHeaders(headers),
          requestBody: body,
          responseStatus: resp && resp.status,
          responseBody: resp && resp.body
        });
      }).catch(function (err) {
        recordApiCall(stepId, {
          method: method,
          url: url,
          requestHeaders: redactHeaders(headers),
          requestBody: body,
          error: err && (err.message || String(err))
        });
      });
      return promise;
    };
    wrapped.__avStepupWrapped = true;
    AV.api.call = wrapped;
  }

  function validateSession() {
    var info = describeJwtClaims();
    var banner = byId('token-warn');
    var cfg = settings();
    if (!cfg.apiBase || !cfg.bearer || !cfg.actor || !cfg.actorRole || !session.tokenId) {
      if (banner) {
        banner.textContent = 'Session incomplete — fill Step 1 (Select Token) before running other steps.';
        banner.hidden = false;
      }
      return false;
    }
    if (info.badge === 'expired') {
      if (banner) {
        banner.textContent = 'Bearer token EXPIRED — paste a fresh JWT in Step 1.';
        banner.hidden = false;
      }
      return false;
    }
    if (info.badge === 'invalid') {
      if (banner) {
        banner.textContent = 'Bearer token is not a valid JWT (' + info.decodeReason + ').';
        banner.hidden = false;
      }
      return false;
    }
    if (banner) banner.hidden = true;
    return true;
  }

  function paintBrowserUtc() {
    var utc = new Date().toISOString();
    setText('dev-browser-utc', utc);
    setText('bearer-browser-utc', utc);
  }

  function buildDebugBundle() {
    var info = describeJwtClaims();
    var cfg = settings();
    return {
      generatedAt: new Date().toISOString(),
      apiBase: cfg.apiBase,
      actor: cfg.actor,
      actorRole: cfg.actorRole,
      tokenId: session.tokenId,
      factorId: session.factorId,
      otpauthUri: session.otpauthUri,
      currentTOTP: session.currentTOTP,
      totpRemaining: session.totpRemaining,
      challengeId: session.challengeId,
      challengeExpires: session.challengeExpires,
      challengeStatus: session.challengeStatus,
      challengeApproved: session.challengeApproved,
      approveVerifiedFactor: session.approveVerifiedFactor,
      detokenLast4: session.detokenLast4,
      detokenIdentityId: session.detokenIdentityId,
      detokenAuditId: session.detokenAuditId,
      jwt: {
        sub: info.sub, iss: info.iss, aud: info.aud,
        exp: info.exp, ttl: fmtTtl(info.ttlSeconds),
        badge: info.badge
      },
      devMode: diagnostics.devMode,
      lastApiCall: session.lastApiCall,
      apiCallLog: diagnostics.apiCallLog.slice(-10)
    };
  }

  function copyDebugBundle() {
    var bundle = JSON.stringify(buildDebugBundle(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(bundle).catch(function () { fallbackCopy(bundle); });
    } else {
      fallbackCopy(bundle);
    }
    LOG.workflow('Copy Debug Bundle', '✅ Copied (' + bundle.length + ' bytes)', {});
  }

  function toggleDevMode() {
    diagnostics.devMode = !diagnostics.devMode;
    var btn = byId('toggle-dev-mode');
    if (btn) {
      btn.setAttribute('aria-pressed', diagnostics.devMode ? 'true' : 'false');
      btn.textContent = 'Developer Mode: ' + (diagnostics.devMode ? 'On' : 'Off');
    }
    refreshDevInfo();
  }

  // =========================================================
  // Network helpers
  // =========================================================
  function buildAuthHeaders() {
    var cfg = settings();
    var h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (cfg.bearer) h['Authorization'] = 'Bearer ' + cfg.bearer;
    if (cfg.actor) h['-X-Actor'] = cfg.actor;
    if (cfg.actorRole) h['-X-Actor-Role'] = cfg.actorRole;
    return h;
  }

  // =========================================================
  // Backend request bodies — single source of truth
  // =========================================================
  //
  // Every endpoint that takes a JSON body has its body built here.
  // This keeps the backend contract in one place and lets a future
  // schema change touch exactly one builder per endpoint.
  //
  //   buildEnrollBody()   → POST /v1/mfa/enroll
  //   buildRequestBody()  → POST /v1/detokenize/request
  //   buildApproveBody()  → POST /v1/detokenize/step-up/{id}/approve
  //   buildDetachBody()   → POST /v1/detokenize
  //
  // Each builder returns `null` when a required session field is
  // missing; the caller is expected to short-circuit and surface a
  // validation message instead of issuing a malformed request.
  function buildEnrollBody() {
    var cfg = settings();
    if (!cfg.actor || !cfg.actorRole) return null;
    return {
      actor: cfg.actor,
      context: {
        actorId:    cfg.actor,
        actorRole:  cfg.actorRole,
        reason:     'step-up-mfa-enrollment'
      }
    };
  }

  function buildRequestBody() {
    var cfg = settings();
    if (!session.tokenId || !session.factorId || !cfg.actor || !cfg.actorRole) return null;
    return {
      tokenId:    session.tokenId,
      factorId:   session.factorId,
      context: {
        actorId:    cfg.actor,
        actorRole:  cfg.actorRole,
        reason:     'step-up-detokenization-request'
      }
    };
  }

  function buildApproveBody() {
    var cfg = settings();
    var code = getApproveTotp();
    if (!code || !cfg.actor || !cfg.actorRole) return null;
    return {
      code:    code,
      context: {
        actorId:    cfg.actor,
        actorRole:  cfg.actorRole,
        reason:     'step-up-challenge-approval'
      }
    };
  }

  function buildDetachBody() {
    var cfg = settings();
    if (!session.challengeId || !cfg.actor || !cfg.actorRole) return null;
    return {
      challengeId: session.challengeId,
      context: {
        actorId:    cfg.actor,
        actorRole:  cfg.actorRole,
        reason:     'step-up-detokenization-release'
      }
    };
  }

  function apiPath(p) {
    var base = (settings().apiBase || '').replace(/\/+$/, '');
    return base + p;
  }

  function unwrapBody(resp) {
    if (!resp || !resp.body) return {};
    if (typeof resp.body === 'object') return resp.body;
    try { return JSON.parse(resp.body); } catch (e) { return {}; }
  }

  function getApproveTotp() {
    var typed = getVal('approve-totp').trim();
    return typed || session.approveTOTP || session.currentTOTP || '';
  }

  // =========================================================
  // Handlers
  // =========================================================
  function onSaveSession() {
    var cfg = {
      apiBase: getVal('sel-api').trim(),
      bearer: getVal('sel-bearer').trim(),
      actor: getVal('sel-actor').trim(),
      actorRole: getVal('sel-role').trim()
    };
    session.tokenId = getVal('sel-token').trim();

    var missing = [];
    if (!cfg.apiBase) missing.push('API Base');
    if (!cfg.bearer) missing.push('Bearer Token');
    if (!cfg.actor) missing.push('Actor ID');
    if (!cfg.actorRole) missing.push('Actor Role');
    if (!session.tokenId) missing.push('Token ID');
    if (missing.length) {
      LOG.workflow('Select Token', '❌ Missing fields: ' + missing.join(', '), {});
      setStepState('select', 'failed');
      refreshUnlocks();
      return;
    }

    if (AV.storage && AV.storage.saveSettings) AV.storage.saveSettings(cfg);
    clearPersistedWorkflow();
    LOG.workflow('Select Token', '✅ Session saved', {
      actor: cfg.actor,
      actorRole: cfg.actorRole,
      tokenId: session.tokenId
    });
    setStepState('select', 'success');
    refreshAll();
    // The bearer just changed — repaint the claims panel and make
    // sure the 30s ticker is running so the EXPIRED badge flips.
    refreshBearerClaims();
    startBearerTicker();
  }

  async function onEnroll() {
    if (running.enroll) return;
    running.enroll = true;
    setRunningUI('enroll', true, 'Enrolling MFA…');
    setStepState('enroll', 'idle');
    // clear stale outputs
    session.factorId = '';
    session.otpauthUri = '';
    session.enrollCreatedAt = '';
    session.currentTOTP = '';
    session.approveTOTP = '';
    session.totpRemaining = 0;
    stopTotpTicker();
    refreshAll();
    clearCardError('enroll');
    try {
      // Pre-flight 1 — bearer present. Backend auth plugin is the
      // source of truth; this only guards against an obvious
      // missing-token mistake and keeps the wizard on its step.
      requireBearer('Enroll MFA');
      // Pre-flight 2: build the Enroll body from the saved Step 1
      // session. Issuing a POST with `null` body was previously
      // rejected by the backend's content-type parser with 400
      // FST_ERR_CTP_INVALID_JSON_BODY.
      var enrollBody = buildEnrollBody();
      if (!enrollBody) {
        var missing = [];
        var cfg = settings();
        if (!cfg.actor) missing.push('actor');
        if (!cfg.actorRole) missing.push('actorRole');
        throw new Error('Missing required session field(s): ' + missing.join(', ') + ' — save Step 1 first');
      }
      var resp = await AV.api.call('POST', apiPath('/v1/mfa/enroll'), enrollBody, buildAuthHeaders());
      if (!resp || !resp.ok) {
        throw new Error(describeFailure('Enroll MFA', resp));
      }
      var body = unwrapBody(resp);
      session.factorId = body.factorId || '';
      session.otpauthUri = body.otpauthUri || body.otpauth || body.uri || '';
      session.enrollCreatedAt = body.createdAt || new Date().toISOString();
      if (!session.otpauthUri) throw new Error('Server response missing otpauthUri');
      LOG.workflow('Enroll MFA', '✅ Factor created', { factorId: session.factorId });
      setStepState('enroll', 'success');
      await refreshTotp(true);
      startTotpTicker();
    } catch (err) {
      LOG.workflow('Enroll MFA', '❌ Failed:\n' + (err && err.message ? err.message : err), {});
      setStepState('enroll', 'failed');
      renderCardError('enroll', parseErrorInfo(err));
    } finally {
      running.enroll = false;
      setRunningUI('enroll', false, 'Enroll MFA');
      refreshAll();
    }
  }

  async function onRequest() {
    if (running.request) return;
    if (!session.factorId || !session.tokenId) return;
    running.request = true;
    setRunningUI('request', true, 'Requesting…');
    setStepState('request', 'idle');
    session.challengeId = '';
    session.challengeExpires = '';
    session.challengeStatus = '';
    refreshAll();
    clearCardError('request');
    try {
      requireBearer('Request Step-Up');
      var reqBody = buildRequestBody();
      if (!reqBody) {
        throw new Error('Missing required session field(s) — complete Steps 1 and 2 first');
      }
      var resp = await AV.api.call('POST', apiPath('/v1/detokenize/request'), reqBody, buildAuthHeaders());
      if (!resp || !resp.ok) {
        throw new Error(describeFailure('Request Step-Up', resp));
      }
      var data = unwrapBody(resp);
      session.challengeId = data.challengeId || data.id || '';
      session.challengeExpires = data.expiresAt || data.expires_at || '';
      session.challengeStatus = data.status || 'pending';
      // Reset approval state — a new challenge must be approved
      session.challengeApproved = false;
      session.approveStatus = '';
      session.approveApprovedAt = '';
      session.approveVerifiedFactor = '';
      session.approveTOTP = '';
      LOG.workflow('Request Step-Up', '✅ Challenge created', { challengeId: session.challengeId });
      setStepState('request', 'success');
    } catch (err) {
      LOG.workflow('Request Step-Up', '❌ Failed:\n' + (err && err.message ? err.message : err), {});
      setStepState('request', 'failed');
      renderCardError('request', parseErrorInfo(err));
    } finally {
      running.request = false;
      setRunningUI('request', false, 'Request Step-Up');
      refreshAll();
    }
  }

  async function onApprove() {
    if (running.approve) return;
    if (!session.challengeId) return;
    session.approveTOTP = getVal('approve-totp').trim();
    if (!getApproveTotp()) {
      LOG.workflow('Approve Challenge', '❌ No TOTP available — refresh or wait for next code', {});
      return;
    }
    running.approve = true;
    setRunningUI('approve', true, 'Approving…');
    setStepState('approve', 'idle');
    refreshAll();
    clearCardError('approve');
    try {
      requireBearer('Approve Challenge');
      var approveBody = buildApproveBody();
      if (!approveBody) {
        throw new Error('Missing TOTP or factor — complete Steps 2 and 3 first');
      }
      var resp = await AV.api.call(
        'POST',
        apiPath('/v1/detokenize/step-up/' + encodeURIComponent(session.challengeId) + '/approve'),
        approveBody,
        buildAuthHeaders()
      );
      if (!resp || !resp.ok) {
        throw new Error(describeFailure('Approve Challenge', resp));
      }
      var data = unwrapBody(resp);
      session.approveStatus = data.status || 'approved';
      session.approveApprovedAt = data.approvedAt || new Date().toISOString();
      session.approveVerifiedFactor = data.verifiedFactorId || data.factorId || session.factorId;
      session.challengeApproved = (session.approveStatus === 'approved');
      session.challengeStatus = session.approveStatus;
      LOG.workflow('Approve Challenge', '✅ Challenge approved', {
        challengeId: session.challengeId,
        verifiedFactor: session.approveVerifiedFactor
      });
      setStepState('approve', 'success');
    } catch (err) {
      LOG.workflow('Approve Challenge', '❌ Failed:\n' + (err && err.message ? err.message : err), {});
      session.challengeApproved = false;
      session.approveStatus = 'failed';
      setStepState('approve', 'failed');
      renderCardError('approve', parseErrorInfo(err));
    } finally {
      running.approve = false;
      setRunningUI('approve', false, 'Approve Challenge');
      refreshAll();
    }
  }

  async function onDetach() {
    if (running.detokenize) return;
    if (!session.challengeId || !session.challengeApproved) return;
    running.detokenize = true;
    setRunningUI('detokenize', true, 'Decrypting…');
    setStepState('detokenize', 'idle');
    refreshAll();
    clearCardError('detokenize');
    try {
      requireBearer('Detokenize');
      var detachBody = buildDetachBody();
      if (!detachBody) {
        throw new Error('Missing challenge or actor — complete Steps 1–4 first');
      }
      var resp = await AV.api.call('POST', apiPath('/v1/detokenize'), detachBody, buildAuthHeaders());
      if (!resp || !resp.ok) {
        throw new Error(describeFailure('Detokenize', resp));
      }
      var data = unwrapBody(resp);
      session.detokenized = data.aadhaar || '';
      session.detokenLast4 = data.last4 || '';
      session.detokenIdentityId = data.identityId || data.identity_id || '';
      session.detokenAuditId = data.auditId || data.audit_id || '';
      LOG.workflow('Detokenize', '✅ Aadhaar released', {
        last4: session.detokenLast4,
        auditId: session.detokenAuditId
      });
      setStepState('detokenize', 'success');
    } catch (err) {
      LOG.workflow('Detokenize', '❌ Failed:\n' + (err && err.message ? err.message : err), {});
      setStepState('detokenize', 'failed');
      renderCardError('detokenize', parseErrorInfo(err));
    } finally {
      running.detokenize = false;
      setRunningUI('detokenize', false, 'Detokenize');
      refreshAll();
    }
  }

  function onReset() {
    Object.keys(RUNTIME_SESSION_DEFAULTS).forEach(function (k) {
      session[k] = RUNTIME_SESSION_DEFAULTS[k];
    });
    Object.keys(stepState).forEach(function (k) {
      setStepState(k, 'idle');
    });
    Object.keys(running).forEach(function (k) {
      running[k] = false;
    });
    setRunningUI('enroll', false, 'Enroll MFA');
    setRunningUI('request', false, 'Request Step-Up');
    setRunningUI('approve', false, 'Approve Challenge');
    setRunningUI('detokenize', false, 'Detokenize');
    stopTotpTicker();
    clearPersistedWorkflow();
    LOG.workflow('Reset Workflow', '🧹 Workflow cleared (session preserved)', {});
    refreshAll();
  }

  // =========================================================
  // Copy buttons
  // =========================================================
  function copyToClipboard(selector) {
    var el = (selector && selector.charAt(0) === '#') ? byId(selector.substr(1)) : document.querySelector(selector);
    if (!el) return;
    var text = el.textContent || el.value || '';
    if (!text || text === '—') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // =========================================================
  // Hookup
  // =========================================================
  function hookup() {
    byId('btn-save-session').addEventListener('click', onSaveSession);
    byId('btn-enroll').addEventListener('click', onEnroll);
    byId('btn-request').addEventListener('click', onRequest);
    byId('btn-approve').addEventListener('click', onApprove);
    byId('btn-detach').addEventListener('click', onDetach);
    byId('reset-workflow').addEventListener('click', onReset);
    byId('btn-refresh-totp').addEventListener('click', onRefreshTotp);
    var approveTotp = byId('approve-totp');
    if (approveTotp) {
      approveTotp.addEventListener('input', function () {
        session.approveTOTP = approveTotp.value.trim();
        refreshUnlocks();
      });
    }
    var copyDebug = byId('btn-copy-bundle');
    if (copyDebug) copyDebug.addEventListener('click', copyDebugBundle);
    var devBtn = byId('toggle-dev-mode');
    if (devBtn) devBtn.addEventListener('click', toggleDevMode);
    qsa('.copy-btn').forEach(function (b) {
      b.addEventListener('click', function () { copyToClipboard(b.dataset.target); });
    });
    // Wrap AV.api.call so every authenticated request records
    // its method/url/body/response into the diagnostics store and
    // the per-card API inspector. Idempotent — safe across reloads.
    installApiCallInterceptor();
  }

  function init() {
    clearPersistedWorkflow();
    Object.keys(stepState).forEach(function (k) {
      setStepState(k, 'idle');
    });
    hookup();
    refreshAll();
    // First paint of the bearer-claims panel and a 30s ticker so
    // the EXPIRED badge flips on its own. The backend remains the
    // source of truth.
    refreshBearerClaims();
    if (settings().bearer) startBearerTicker();
    // Surface any session/banner state (expired / invalid JWT,
    // incomplete session). Non-destructive — just paints the
    // banner so the operator knows to fix Step 1 first.
    validateSession();
    paintBrowserUtc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  root.AV_STEPUP = {
    // State / lifecycle
    runtimeSession: runtimeSession,
    session: runtimeSession,
    stepState: stepState,
    running: running,
    diagnostics: diagnostics,
    onReset: onReset,
    // TOTP engine (browser side, RFC 6238)
    computeTOTP: computeTOTP,
    parseOtpauth: parseOtpauth,
    // Bearer / JWT inspection (UI-only; backend is source of truth)
    decodeJwt: decodeJwt,
    describeJwtClaims: describeJwtClaims,
    refreshBearerClaims: refreshBearerClaims,
    requireBearer: requireBearer,
    describeFailure: describeFailure,
    startBearerTicker: startBearerTicker,
    stopBearerTicker: stopBearerTicker,
    validateSession: validateSession,
    // Body builders
    buildEnrollBody: buildEnrollBody,
    buildRequestBody: buildRequestBody,
    buildApproveBody: buildApproveBody,
    buildDetachBody: buildDetachBody,
    // Diagnostics (step-up console additions)
    buildDebugBundle: buildDebugBundle,
    copyDebugBundle: copyDebugBundle,
    toggleDevMode: toggleDevMode,
    installApiCallInterceptor: installApiCallInterceptor,
    parseErrorInfo: parseErrorInfo,
    paintBrowserUtc: paintBrowserUtc,
    clearCardError: clearCardError,
    renderCardError: renderCardError,
    recordApiCall: recordApiCall
  };
})();
