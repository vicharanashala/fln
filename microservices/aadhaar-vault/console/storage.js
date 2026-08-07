/* Aadhaar Vault Console — safe localStorage wrapper
 *
 * Why this exists:
 *   `console/app.js` and `console/stepup.js` both need to read/write
 *   the same handful of values (API base, actor, JWT, last response,
 *   log). The pre-refactor code did this inline with raw `localStorage`
 *   calls, which:
 *     - threw in browsers with disabled storage (Safari private mode,
 *       corporate profiles with cookie exceptions),
 *     - had no JSON encoding, so the operator had to remember which
 *       values were strings vs. objects,
 *     - duplicated the key list in three places.
 *
 *   This module centralises:
 *     - try/catch around every read/write (silent no-op on failure),
 *     - JSON encoding for object values,
 *     - typed accessors that match the keys declared in `config.js`,
 *     - a single `clear()` for the "Reset" button.
 *
 *   Loaded after `config.js`; attaches to `window.AV.storage`.
 */
(function (root) {
  'use strict';

  var KEYS = (root.AV && root.AV.config && root.AV.config.STORAGE_KEYS) || {};

  function safeGet(key) {
    try {
      return root.localStorage.getItem(key);
    } catch (_err) {
      // Private-mode / sanitised profile → behave as if unset.
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      root.localStorage.setItem(key, value);
    } catch (_err) {
      // Storage quota / disabled → silent no-op. The demo flow still
      // works in-memory via the live UI state.
    }
  }

  function safeRemove(key) {
    try {
      root.localStorage.removeItem(key);
    } catch (_err) { /* ignore */ }
  }

  function getString(key, fallback) {
    var v = safeGet(key);
    return v === null || v === undefined ? fallback : v;
  }

  function setString(key, value) {
    safeSet(key, value == null ? '' : String(value));
  }

  function getJSON(key, fallback) {
    var raw = safeGet(key);
    if (raw === null || raw === undefined || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      // Corrupted entry → drop it and return the fallback so the UI
      // can recover without crashing.
      safeRemove(key);
      return fallback;
    }
  }

  function setJSON(key, value) {
    if (value === undefined) {
      safeRemove(key);
      return;
    }
    try {
      safeSet(key, JSON.stringify(value));
    } catch (_err) { /* ignore */ }
  }

  // Public API.

  function getApiBase() {
    return getString(KEYS.API_BASE, root.AV.config.DEFAULTS.API_BASE);
  }
  function setApiBase(v) { setString(KEYS.API_BASE, v); }

  function getActor() {
    return getString(KEYS.ACTOR, root.AV.config.DEFAULTS.ACTOR);
  }
  function setActor(v) { setString(KEYS.ACTOR, v); }

  function getActorRole() {
    return getString(KEYS.ACTOR_ROLE, root.AV.config.DEFAULTS.ACTOR_ROLE || 'TEACHER');
  }
  function setActorRole(v) { setString(KEYS.ACTOR_ROLE, v || ''); }

  function getJwt() {
    return getString(KEYS.JWT, '');
  }
  function setJwt(v) { setString(KEYS.JWT, v || ''); }

  function getLastRequest() {
    return getJSON(KEYS.LAST_REQUEST, null);
  }
  function setLastRequest(value) { setJSON(KEYS.LAST_REQUEST, value); }

  function getLog() {
    return getJSON(KEYS.LOG, []);
  }
  function setLog(entries) { setJSON(KEYS.LOG, entries); }

  // ---- Drafts --------------------------------------------------------
  //
  // Form drafts are persisted in a single JSON blob keyed by form ID.
  // Reading the whole blob is cheap (the page has at most a handful
  // of forms) and lets us atomically update the map in one setItem().
  function getDrafts() {
    return getJSON(KEYS.DRAFTS, {}) || {};
  }

  function getDraft(formId) {
    if (!formId) return null;
    var all = getDrafts();
    return Object.prototype.hasOwnProperty.call(all, formId) ? all[formId] : null;
  }

  function saveDraft(formId, data) {
    if (!formId) return;
    var all = getDrafts();
    all[formId] = {
      data: data || {},
      savedAt: new Date().toISOString()
    };
    setJSON(KEYS.DRAFTS, all);
  }

  function clearDraft(formId) {
    if (!formId) return;
    var all = getDrafts();
    if (!Object.prototype.hasOwnProperty.call(all, formId)) return;
    delete all[formId];
    setJSON(KEYS.DRAFTS, all);
  }

  function listDraftFormIds() {
    return Object.keys(getDrafts());
  }

  // ---- Collapsible sections -----------------------------------------
  //
  // Maps a section ID → `true` (open) / `false` (closed). Reads return
  // `null` when nothing has been persisted yet so the UI can fall
  // back to the compile-time default.
  function getCollapsibleStates() {
    return getJSON(KEYS.COLLAPSIBLE, {}) || {};
  }

  function getCollapsibleState(id) {
    if (!id) return null;
    var all = getCollapsibleStates();
    return Object.prototype.hasOwnProperty.call(all, id) ? all[id] : null;
  }

  function setCollapsibleState(id, open) {
    if (!id) return;
    var all = getCollapsibleStates();
    all[id] = !!open;
    setJSON(KEYS.COLLAPSIBLE, all);
  }

  // ---- Pill filter preferences -------------------------------------
  //
  // Remember which pill levels the operator wants to see in the
  // history panel. Stored as a `{ level: true }` object.
  function getPillFilter() {
    var raw = getJSON(KEYS.PILL_FILTERS, null);
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  }

  function setPillFilter(levels) {
    if (!levels || typeof levels !== 'object') return;
    setJSON(KEYS.PILL_FILTERS, levels);
  }

  // ---- Aggregate settings view --------------------------------------
  //
  // `getSettings()` returns a single, read-only snapshot of every
  // console-wide setting that the API client needs in one go.
  // `saveSettings(partial)` merges the supplied keys onto the
  // current snapshot and persists the changed fields. Together
  // they remove the need for callers to call the per-key
  // getters/setters individually.
  function getSettings() {
    var apiBase = safeGet(KEYS.API_BASE) || '';
    var bearer  = safeGet(KEYS.JWT) || '';
    var actor   = safeGet(KEYS.ACTOR) || '';
    var role    = safeGet(KEYS.ACTOR_ROLE) || '';
    var baseFlags = (root.AV && root.AV.config && root.AV.config.FLAGS) || {};
    return {
      apiBase:   apiBase,
      bearer:    bearer,
      actor:     actor,
      actorRole: role,
      useMock:   baseFlags.MOCK_FALLBACK !== false
    };
  }

  function saveSettings(partial) {
    if (!partial || typeof partial !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(partial, 'apiBase'))   setApiBase(partial.apiBase);
    if (Object.prototype.hasOwnProperty.call(partial, 'bearer'))    setBearer(partial.bearer);
    if (Object.prototype.hasOwnProperty.call(partial, 'actor'))     setActor(partial.actor);
    if (Object.prototype.hasOwnProperty.call(partial, 'actorRole')) setActorRole(partial.actorRole);
  }

  // ---- Bearer / base-URL shortcuts ----------------------------------
  //
  // Convenience wrappers for the most common lookups so other
  // modules (e.g. api.js) do not need to know the full storage
  // keys.
  function getBearer() {
    return safeGet(KEYS.JWT) || '';
  }

  function setBearer(token) {
    setJwt(token || '');
  }

  function setBaseUrl(url) {
    setApiBase(url || '');
  }

  // Generic single-key setter used by the settings dialog. Keys
  // mirror the field names returned by `getSettings()`.
  function setSetting(key, value) {
    if (!key) return;
    switch (key) {
      case 'apiBase':   setApiBase(value); break;
      case 'bearer':    setBearer(value); break;
      case 'actor':     setActor(value); break;
      case 'actorRole': setActorRole(value); break;
      default:          /* unknown keys are intentionally ignored */ break;
    }
  }

  // ---- Reset --------------------------------------------------------
  //
  // Wipe every console-managed localStorage key. Preserves the
  // CONSOLE namespace marker so the same browser can still recognise
  // the vault demo profile after a reset.
  function clearAll() {
    Object.keys(KEYS).forEach(function (k) {
      if (k === 'CONSOLE') return;
      safeRemove(KEYS[k]);
    });
  }

  root.AV = root.AV || {};
  root.AV.storage = {
    getApiBase: getApiBase,
    setApiBase: setApiBase,
    getActor: getActor,
    setActor: setActor,
    getActorRole: getActorRole,
    setActorRole: setActorRole,
    getJwt: getJwt,
    setJwt: setJwt,
    getBearer: getBearer,
    setBearer: setBearer,
    setBaseUrl: setBaseUrl,
    setSetting: setSetting,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getLastRequest: getLastRequest,
    setLastRequest: setLastRequest,
    getLog: getLog,
    setLog: setLog,
    getDrafts: getDrafts,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    listDraftFormIds: listDraftFormIds,
    getCollapsibleStates: getCollapsibleStates,
    getCollapsibleState: getCollapsibleState,
    setCollapsibleState: setCollapsibleState,
    getPillFilter: getPillFilter,
    setPillFilter: setPillFilter,
    clearAll: clearAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
