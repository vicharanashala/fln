/* Aadhaar Vault Console — API client
 *
 * One central place every request flows through.
 *
 *   const result = await AV.api.call('POST', '/v1/tokenize', body);
 *   // → { ok, status, body, duration, mocked }
 *
 * Behaviour:
 *   • Reads API base URL + bearer from `AV.storage.getSettings()`.
 *   • Sends `Authorization: Bearer <jwt>` when a bearer is set.
 *   • JSON-parses responses; leaves `body: { raw }` when the body is
 *     not valid JSON (so the UI can show the raw payload).
 *   • Times every request and pushes an entry to `AV.logger`.
 *   • When the live request fails (network error / fetch threw /
 *     no `fetch` available) AND settings.useMock === true, returns
 *     a synthetic response from `mockFor(...)` and marks it
 *     `mocked: true` so the UI can flag it.
 *
 * Loaded after storage.js, logger.js, ui.js; attaches to
 * `window.AV.api`.
 */
(function (root) {
  'use strict';

  var AV = root.AV = root.AV || {};
  var storage = AV.storage;
  var logger  = AV.logger;
  var ui      = AV.ui;
  var config  = AV.config || {};

  // ---- Internal helpers ----------------------------------------------

  // 32-bit random hex string of `n` bytes.
  function rand(n) {
    if (root.crypto && root.crypto.getRandomValues) {
      var bytes = new Uint8Array(n);
      root.crypto.getRandomValues(bytes);
      var out = '';
      for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i].toString(16);
        out += (b.length < 2 ? '0' : '') + b;
      }
      return out;
    }
    var fallback = '';
    for (var j = 0; j < n; j++) {
      fallback += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    }
    return fallback;
  }

  // Strip a trailing slash so `${base}${path}` is well-formed.
  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  // Empty value → same origin (recommended; the Fastify static
  // plugin serves /console/ from the same host as the API, so no
  // CORS preflight is needed).
  function resolveBaseUrl(raw) {
    var v = trimSlash(raw);
    if (!v && root.location && root.location.origin) {
      return trimSlash(root.location.origin);
    }
    return v;
  }

  // `currentBearerOverride` is set by `overrideBearer(token)` and
  // shadowed *only* for outgoing requests — never persisted. This
  // lets the demo workflow swap tokens without writing to
  // localStorage every time, while `buildHeaders` still falls back
  // to the saved bearer when no override is active.
  var currentBearerOverride = null;

  function buildHeaders(extra) {
    var settings = storage.getSettings();
    var h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    var bearer = currentBearerOverride != null
      ? currentBearerOverride
      : settings.bearer;
    if (bearer) h['Authorization'] = 'Bearer ' + bearer;
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
      }
    }
    return h;
  }

  // `parseJwt(token)` decodes the payload of a JWT and returns the
  // plain JavaScript object. Signature is intentionally NOT verified
  // — the console has no access to the secret and only needs to peek
  // at `exp` / claims for UI hints (e.g. "token expires in 3min").
  // Returns `null` for non-JWT inputs.
  function parseJwt(token) {
    if (!token || typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length < 2) return null;
    var payload = parts[1];
    // base64url → base64 (replace `-`/`_`, then pad with `=`).
    var b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    try {
      // Available in browsers and Node ≥ 16.
      var decoded = (root.atob || function (s) {
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(s, 'base64').toString('binary');
        }
        return null;
      })(b64);
      if (decoded == null) return null;
      // atob returns a binary string; convert to UTF-8 to support
      // accented subject / org claims.
      var json = (root.TextDecoder && typeof Uint8Array === 'function')
        ? new TextDecoder('utf-8').decode(new Uint8Array(
            decoded.split('').map(function (c) { return c.charCodeAt(0); })))
        : (function () {
            try { return decodeURIComponent(escape(decoded)); }
            catch (_e) { return decoded; }
          })();
      return JSON.parse(json);
    } catch (_err) {
      return null;
    }
  }

  function buildUrl(path, settings) {
    if (typeof path === 'string' && path.startsWith('http')) return path;
    return resolveBaseUrl(settings.baseUrl) + path;
  }

  // ---- Live fetch wrapper --------------------------------------------

  async function apiCall(method, path, body) {
    var settings = storage.getSettings();
    var url = buildUrl(path, settings);
    var started = (root.performance && root.performance.now)
      ? root.performance.now()
      : Date.now();

    var logEntry = {
      ts:        new Date().toISOString(),
      method:    method,
      path:      path,
      status:    null,
      duration:  null,
      actor:     settings.actorId || '',
      request:   body || null,
      response:  null,
      error:     null
    };

    if (typeof root.fetch !== 'function') {
      logEntry.status = 'NET';
      logEntry.error  = 'fetch is not available in this environment';
      logEntry.duration = Math.round(Date.now() - started);
      if (logger) logger.log(logEntry);
      if (ui) ui.setConnection('down');
      return {
        ok: false,
        status: 0,
        body: null,
        error: logEntry.error,
        duration: logEntry.duration
      };
    }

    try {
      var res = await root.fetch(url, {
        method: method,
        headers: buildHeaders(),
        body: body != null ? JSON.stringify(body) : undefined,
        mode: 'cors'
      });
      logEntry.duration = Math.round(
        ((root.performance && root.performance.now) ? root.performance.now() : Date.now()) - started
      );
      logEntry.status = res.status;

      var text = '';
      try { text = await res.text(); } catch (_) { /* body may be opaque */ }

      if (text) {
        try { logEntry.response = JSON.parse(text); }
        catch (_) { logEntry.response = { raw: text }; }
      }

      if (logger) logger.log(logEntry);
      if (ui) ui.setConnection(res.ok ? 'ok' : 'down');

      return {
        ok: res.ok,
        status: res.status,
        body: logEntry.response,
        duration: logEntry.duration,
        error: res.ok ? null : 'HTTP ' + res.status
      };
    } catch (err) {
      logEntry.duration = Math.round(
        ((root.performance && root.performance.now) ? root.performance.now() : Date.now()) - started
      );
      logEntry.status = 'NET';
      logEntry.error = (err && err.message) || String(err);

      if (logger) logger.log(logEntry);
      if (ui) ui.setConnection('down');

      return {
        ok: false,
        status: 0,
        body: null,
        error: logEntry.error,
        duration: logEntry.duration
      };
    }
  }

  // ---- Mock fallback -------------------------------------------------
  //
  // These mocks produce the EXACT JSON shapes the real API returns,
  // so swapping mock → live is invisible. Shapes mirror the route
  // handlers under src/routes/.

  function mockFor(method, path, body, settings) {
    var now = new Date().toISOString();
    var version = (settings && settings.version) || '0.1.0';
    var actor   = (settings && settings.actorId) || 'volunteer-789';
    // JWT subject for mfa/verify.actor, when present.
    function jwtSub() {
      var tok = settings && settings.bearer;
      var parsed = parseJwt(tok);
      return (parsed && parsed.sub) || '';
    }

    if (path === '/health') {
      return { status: 'ok', service: 'aadhaar-vault', version: version, timestamp: now };
    }
    if (path === '/health/ready') {
      return { status: 'ready', checks: { postgres: 'ok', keyProvider: 'ok' }, version: version };
    }
    if (method === 'POST' && path === '/v1/tokenize') {
      var raw = String((body && body.raw) || '').replace(/\D/g, '');
      return {
        token:      'av_' + rand(10),
        last4:      raw.slice(-4) || '0000',
        tokenType:  (body && body.type) || 'AADHAAR',
        auditId:    String(Math.floor(Math.random() * 9000) + 1000),
        identityId: String(Math.floor(Math.random() * 9000) + 1000),
        keyVersion: 'kv-1'
      };
    }
    if (method === 'POST' && path === '/v1/detokenize') {
      return {
        token:      (body && body.challengeId) || 'av_…',
        identityId: String(Math.floor(Math.random() * 9000) + 1000),
        aadhaar:    '123412341234',
        last4:      '1234',
        auditId:    String(Math.floor(Math.random() * 9000) + 1000)
      };
    }
    if (method === 'POST' && path === '/v1/detokenize/request') {
      var tokenIdForReq = (body && body.tokenId) || '';
      var factorIdForReq = (body && body.factorId) || 'factor_…';
      var expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      return {
        challengeId: 'ch_' + rand(10),
        expiresAt:   expiresAt,
        requiredFactor: {
          factorId:    factorIdForReq,
          actor:       (body && body.context && body.context.actorId) || actor,
          label:       'wizard:' + ((body && body.context && body.context.actorId) || actor),
          factorType:  'totp'
        }
      };
    }
    if (
      method === 'POST' &&
      path.indexOf('/v1/detokenize/step-up/') === 0 &&
      path.indexOf('/approve') === path.length - '/approve'.length
    ) {
      var challengeIdForApprove =
        path.slice('/v1/detokenize/step-up/'.length, -'/approve'.length) || 'ch_…';
      return {
        challengeId:      challengeIdForApprove,
        status:           'approved',
        approvedAt:       now,
        verifiedFactorId: (body && body.factorId) || 'factor_…'
      };
    }
    if (method === 'POST' && path === '/v1/mfa/enroll') {
      var factorId = (root.crypto && root.crypto.randomUUID)
        ? root.crypto.randomUUID()
        : '00000000-0000-4000-8000-' + rand(6);
      var secret = rand(10);
      var enrollActor = (body && body.actor) || actor;
      return {
        factorId: factorId,
        otpauthUri: 'otpauth://totp/aadhaar-vault:' +
                    enrollActor +
                    '?secret=' + secret +
                    '&issuer=IIT%20Ropar&algorithm=SHA1&digits=6&period=30',
        factor: {
          factorId:         factorId,
          actor:            enrollActor,
          factorType:       'totp',
          status:           'active',
          label:            (body && body.label) || 'admin',
          algorithm:        'SHA1',
          digits:           6,
          period:           30,
          encryptedSecret:  'base64:' + rand(16),
          lastUsedAt:       null,
          expiresAt:        null,
          createdAt:        now
        }
      };
    }
    if (method === 'POST' && path === '/v1/mfa/verify') {
      var verifyFactorId = (body && body.factorId) || 'factor_…';
      var verifyActor    = jwtSub() || ((body && body.actor) || actor);
      return {
        valid:    true,
        factorId: verifyFactorId,
        actor:    verifyActor,
        delta:    0,
        factor: {
          factorId:   verifyFactorId,
          actor:      verifyActor,
          factorType: 'totp',
          status:     'active',
          algorithm:  'SHA1',
          digits:     6,
          period:     30,
          lastUsedAt: now,
          expiresAt:  null,
          createdAt:  now
        }
      };
    }
    if (method === 'GET' && path.indexOf('/v1/audit') === 0) {
      var q           = path.split('?')[1] || '';
      var qs          = new URLSearchParams(q);
      var limit       = Math.min(Math.max(parseInt(qs.get('limit') || '25', 10), 1), 200);
      var identityIdQ = qs.get('identityId') || '';
      var actions     = ['TOKENIZE', 'DETOKENIZE', 'MFA_ENROLL', 'MFA_VERIFY', 'LOOKUP'];
      var actors      = ['volunteer-789', 'superadmin-001', 'teacher-042'];
      var outcomes    = ['allow', 'deny', 'error'];
      var reasons     = ['student-enrollment', 'scholarship-kyc', 'mfa-setup', 'detokenize-step-up'];
      var rows = [];
      for (var i = 0; i < limit; i++) {
        rows.push({
          auditId:    String(1000000 + i),
          identityId: identityIdQ || ('sha256:' + rand(8)),
          actor:      actors[i % actors.length],
          action:     actions[i % actions.length],
          outcome:    outcomes[i % outcomes.length],
          reason:     reasons[i % reasons.length],
          requestId:  'req_' + rand(6),
          meta:       null,
          occurredAt: new Date(Date.now() - i * 3600000).toISOString()
        });
      }
      return {
        identityId: identityIdQ || null,
        limit:      limit,
        pageSize:   limit,
        entries:    rows
      };
    }
    return { mock: true, method: method, path: path, body: body || null };
  }

  // ---- Public entry point -------------------------------------------

  // Smart caller — tries the live API; if unreachable AND
  // settings.useMock === true, returns a synthetic response.
  async function call(method, path, body) {
    var settings = storage.getSettings();
    var live = await apiCall(method, path, body);
    if (!live.ok && live.status === 0 && settings.useMock) {
      var fake = mockFor(method, path, body, settings);
      // Record the mock entry as well, so the request log shows
      // what the operator actually saw.
      if (logger) {
        logger.log({
          ts: new Date().toISOString(),
          method: method,
          path: path,
          status: 200,
          duration: 0,
          actor: settings.actorId || '',
          request: body || null,
          response: fake,
          error: null
        });
      }
      if (ui) ui.setConnection('ok');
      return { ok: true, status: 200, body: fake, duration: live.duration, mocked: true };
    }
    return Object.assign({ mocked: false }, live);
  }

  // Convenience: GET/POST shortcuts. They are intentionally thin.
  async function get(path)        { return await call('GET',    path); }
  async function post(path, body) { return await call('POST', path, body); }

  // `overrideBearer(token)` replaces the bearer used by outgoing
  // requests for the lifetime of the page (no persistence). Passing
  // `null` / `''` clears the override so the saved bearer is used
  // again. Returns the new effective bearer.
  function overrideBearer(token) {
    if (token == null || token === '' || token === 'null' || token === 'undefined') {
      currentBearerOverride = null;
    } else {
      currentBearerOverride = String(token);
    }
    return currentBearerOverride == null
      ? (storage.getSettings().bearer || null)
      : currentBearerOverride;
  }

  AV.api = {
    call:    call,
    get:     get,
    post:    post,
    parseJwt: parseJwt,
    overrideBearer: overrideBearer,
    mockFor: function (method, path, body) {
      return mockFor(method, path, body, storage.getSettings());
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
