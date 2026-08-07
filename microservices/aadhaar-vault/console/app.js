/* Aadhaar Vault Console — main page
 * (aadhaar-vault-console:main)
 *
 * Single page entry point. The console is a developer / demo tool
 * that exercises the Vault REST API.
 *
 * Refactored to act purely as the Tokenization Console.
 */
(function (root) {
  'use strict';

  var AV      = root.AV || {};
  var storage = AV.storage;
  var api     = AV.api;
  var ui      = AV.ui;
  var logger  = AV.logger;
  var config  = AV.config;

  var $           = ui.$;
  var on          = ui.on;
  var val         = ui.val;
  var setVal      = ui.setVal;
  var setText     = ui.setText;
  var toast       = ui.toast;
  var formData    = ui.formToObject;

  var session = {
    lastToken:      '',
    lastIdentityId: ''
  };

  /* ------------------------------------------------------------------
   * 1. SETTINGS SYNC
   * ------------------------------------------------------------------ */

  function readSettingsFromForm() {
    var s = storage.getSettings();
    var base = $('#set-base-url');
    var bearer = $('#set-bearer');
    if (base) s.apiBase = val(base);
    if (bearer) s.bearer = val(bearer);
    storage.saveSettings(s);
    return s;
  }

  function writeSettingsToForm() {
    var s = storage.getSettings();
    var base = $('#set-base-url');
    var bearer = $('#set-bearer');
    if (base && s.apiBase) setVal(base, s.apiBase);
    if (bearer && s.bearer) setVal(bearer, s.bearer);
    
    // Also fill actor defaults if possible
    var actorId = $('#tz-actor-id');
    var actorRole = $('#tz-actor-role');
    if (actorId && !actorId.value && s.actor) setVal(actorId, s.actor);
    if (actorRole && !actorRole.value && s.actorRole) setVal(actorRole, s.actorRole);
  }

  /* ------------------------------------------------------------------
   * 2. TOKENIZATION
   * ------------------------------------------------------------------ */

  function bindTokenize() {
    var form = $('#form-tokenize');
    if (!form) return;

    on(form, 'submit', function (e) {
      e.preventDefault();
      
      // Persist API base & Bearer from form to config
      var s = readSettingsFromForm();
      if (api && typeof api.overrideBearer === 'function' && s.bearer) {
        api.overrideBearer(s.bearer);
      }

      var data = formData(form);
      var rawDigits = String(data.raw || '').replace(/\D/g, '');
      if (rawDigits.length < 12) { toast('Aadhaar must be 12 digits', 'err'); return; }
      
      var payload = {
        raw: rawDigits,
        type: 'AADHAAR',
        context: {
          actorId:   data['tz-actor-id'] || data.actorId || '',
          actorRole: data['tz-actor-role'] || data.actorRole || '',
          reason:    data.reason || ''
        }
      };
      
      api.post('/v1/tokenize', payload).then(function (r) {
        setText($('#tz-duration'), r.duration != null ? (r.duration + ' ms') : '');
        paintResultInto($('#tz-body'), r);
        
        if (r.ok && r.body) {
          session.lastToken = r.body.token || '';
          session.lastIdentityId = r.body.identityId || '';
          
          setText($('#tz-token'), session.lastToken || '—');
          setText($('#tz-identity'), session.lastIdentityId || '—');
          setText($('#tz-last4'), r.body.last4 || '—');
          setText($('#tz-audit'), r.body.auditId || '—');
          setText($('#tz-timestamp'), r.body.timestamp || new Date().toISOString());
          
          toast('Tokenized successfully', 'ok');
        } else {
          toast(r.error || 'Tokenize failed', 'err');
        }
      });
    });
  }

  function paintResultInto(el, r) {
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(ui.responseHeader(r));
    var code = document.createElement('code');
    code.textContent = JSON.stringify(r.body || {}, null, 2);
    el.appendChild(code);
  }

  /* ------------------------------------------------------------------
   * 3. CONNECTION PILL & MISC UI
   * ------------------------------------------------------------------ */

  function startConnectionPolling() {
    var pill = $('#connection-pill');
    if (!pill || !api || typeof api.get !== 'function') return;
    setText(pill, 'Checking…');
    function ping() {
      api.get('/health').then(function (r) {
        pill.setAttribute('data-state', r.ok ? 'ok' : 'err');
        var txt = pill.querySelector('.conn-text');
        if (txt) txt.textContent = r.ok ? 'Online' : 'Offline';
      }).catch(function () {
        pill.setAttribute('data-state', 'err');
        var txt = pill.querySelector('.conn-text');
        if (txt) txt.textContent = 'Offline';
      });
    }
    ping();
    setInterval(ping, 15000);
  }

  function bindCopyButtons() {
    if (!ui || typeof ui.attachCopyButtons !== 'function') return;
    ui.attachCopyButtons();
    document.querySelectorAll('[data-copy-text]').forEach(function (btn) {
      if (btn.__wiredCopy) return;
      btn.__wiredCopy = true;
      on(btn, 'click', function () {
        var t = btn.getAttribute('data-copy-text');
        if (t) {
          navigator.clipboard && navigator.clipboard.writeText(t).then(function () { toast('Copied', 'ok'); });
        }
      });
    });
  }

  /* ------------------------------------------------------------------
   * 4. BOOT
   * ------------------------------------------------------------------ */

  function boot() {
    writeSettingsToForm();
    bindTokenize();
    bindCopyButtons();
    startConnectionPolling();
    
    // Bind form draft persistence for tokenize form if available
    if (ui && typeof ui.bindFormDrafts === 'function') {
      ui.bindFormDrafts(['#form-tokenize']);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);