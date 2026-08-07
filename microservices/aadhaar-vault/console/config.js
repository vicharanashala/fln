/* Aadhaar Vault Console — shared configuration
 *
 * Single source of truth for:
 *   - API routes (v1 prefix, paths, scopes)
 *   - localStorage keys (namespaced)
 *   - default values
 *   - feature flags
 *
 * Loaded as a global <script> before every console page. Attaches to
 * `window.AV` so app.js / stepup.js can read constants without an
 * import system (the console is plain browser JS — no bundler).
 */
(function (root) {
  'use strict';

  var SCOPES = {
    TOKENIZE:    'vault:tokenize',
    DETOKENIZE:  'vault:detokenize',
    AUDIT:       'vault:audit',
    MFA_ENROLL:  'vault:mfa:enroll',
    STEP_UP:     'vault:detokenize' // request / approve share the detokenize scope
  };

  var ROUTES = {
    HEALTH:                { method: 'GET',  path: '/health' },
    HEALTH_READY:          { method: 'GET',  path: '/health/ready' },
    TOKENIZE:              { method: 'POST', path: '/v1/tokenize', scope: SCOPES.TOKENIZE },
    LOOKUP_BY_REF:         { method: 'GET',  path: '/v1/tokenize/by-ref/:ref',         scope: SCOPES.TOKENIZE },
    LOOKUP_BY_TOKEN:       { method: 'GET',  path: '/v1/tokenize/:token',              scope: SCOPES.TOKENIZE },
    DETOKENIZE:            { method: 'POST', path: '/v1/detokenize', scope: SCOPES.DETOKENIZE },
    DETOKENIZE_REQUEST:    { method: 'POST', path: '/v1/detokenize/request',            scope: SCOPES.STEP_UP },
    DETOKENIZE_APPROVE:    { method: 'POST', path: '/v1/detokenize/:token/approve',      scope: SCOPES.STEP_UP },
    DETOKENIZE_BY_REF:     { method: 'GET',  path: '/v1/detokenize/by-ref/:ref',         scope: SCOPES.DETOKENIZE },
    AUDIT_LIST:            { method: 'GET',  path: '/v1/audit',                         scope: SCOPES.AUDIT },
    MFA_ENROLL:            { method: 'POST', path: '/v1/mfa/enroll',                    scope: SCOPES.MFA_ENROLL },
    MFA_VERIFY:            { method: 'POST', path: '/v1/mfa/verify',                    scope: SCOPES.DETOKENIZE }
  };

  // localStorage keys — namespaced so a shared browser profile
  // (e.g. a demo machine) does not collide with other apps.
  // NEW keys (DRAFTS, COLLAPSIBLE, PILL_FILTERS) are additive;
  // existing keys are preserved so the storage layout remains
  // stable across refactors.
  var STORAGE_KEYS = {
    CONSOLE:       'aadhaar-vault-console',     //+? referenced by tests/console.test.ts
    API_BASE:      'aadhaar-vault.apiBase',
    ACTOR:         'aadhaar-vault.actor',
    ACTOR_ROLE:    'aadhaar-vault.actorRole',
    JWT:           'aadhaar-vault.jwt',
    LAST_REQUEST:  'aadhaar-vault.lastRequest',
    LOG:           'aadhaar-vault.log',
    DRAFTS:        'aadhaar-vault.drafts',
    COLLAPSIBLE:   'aadhaar-vault.collapsible',
    PILL_FILTERS:  'aadhaar-vault.pillFilters'
  };

  var DEFAULTS = {
    ACTOR:    'demo-operator',
    ACTOR_ROLE: 'TEACHER',
    API_BASE: ''                  // empty+' relative to the page (same-origin)
  };

  // Feature flags. `true` keeps the pre-refactor mock fallback for the
  // offline demo flow; turning this off makes every button hit the
  // real API.
  var FLAGS = {
    MOCK_FALLBACK: true
  };

  // How many API requests to keep in the in-memory ring buffer.
  // 20 is enough for a 10-step demo flow without flooding the panel.
  var LOG_LIMIT = 20;

  // Form IDs whose inputs are auto-persisted as drafts so the
  // operator does not lose typed values on accidental reload.
  var DRAFT_FORMS = [
    'tokenize-form',
    'lookup-form',
    'detokenize-form',
    'approve-form',
    'stepup-form'
  ];

  // Collapsible section IDs and their default open/closed state.
  // The values here are the FIRST-RUN defaults; once the user
  // toggles a section the UI persists the choice in localStorage
  // under STORAGE_KEYS.COLLAPSIBLE.
  var COLLAPSIBLE_DEFAULTS = {
    'console.section.health':      true,
    'console.section.tokenize':   true,
    'console.section.lookup':     true,
    'console.section.detokenize': true,
    'console.section.approve':    true,
    'console.section.audit':      true,
    'console.section.history':    true
  };

  // Source-precedence values for `ui.applyValueWithPrecedence`.
  // Higher number = stronger authority. `user` always wins.
  var SOURCE_PRIORITY = {
    user:    4,
    auto:    3,
    draft:   2,
    default: 1
  };

  // Mapping of log.status code → pill CSS modifier. Centralized here
  // so the same colour scheme is applied by both `ui.statusPill` and
  // `logger.renderHistory`.
  var PILL_LEVELS = {
    ok:    'ok',
    warn:  'warn',
    error: 'error',
    info:  'info',
    idle:  'idle'
  };

  // Toast lifetime in milliseconds — covers the time it takes a
  // operator to read "Copied ✓" without leaving the toast on screen
  // through the next interaction.
  var TOAST_DURATION_MS = 1800;

  // Auto-save debounce for drafts: enough to coalesce typing bursts
  // without losing work to a reload.
  var DRAFT_SAVE_DEBOUNCE_MS = 300;

  root.AV = root.AV || {};
  // Convenience aliases for shared defaults. `defaultSettings` is the
  // shape used by `storage.getSettings()` / `storage.saveSettings()`
  // and corresponds to the per-workflow form initial values. Keeping
  // it as an alias of `DEFAULTS` avoids double-bookkeeping.
  var defaultSettings = JSON.parse(JSON.stringify(DEFAULTS));

  root.AV.config = {
    SCOPES: SCOPES,
    ROUTES: ROUTES,
    STORAGE_KEYS: STORAGE_KEYS,
    DEFAULTS: DEFAULTS,
    defaultSettings: defaultSettings,
    FLAGS: FLAGS,
    LOG_LIMIT: LOG_LIMIT,
    DRAFT_FORMS: DRAFT_FORMS,
    COLLAPSIBLE_DEFAULTS: COLLAPSIBLE_DEFAULTS,
    SOURCE_PRIORITY: SOURCE_PRIORITY,
    PILL_LEVELS: PILL_LEVELS,
    TOAST_DURATION_MS: TOAST_DURATION_MS,
    DRAFT_SAVE_DEBOUNCE_MS: DRAFT_SAVE_DEBOUNCE_MS
  };
})(typeof window !== 'undefined' ? window : globalThis);
