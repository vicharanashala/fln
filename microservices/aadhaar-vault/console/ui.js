/* Aadhaar Vault Console — DOM / UI helpers
 *
 * Single source of truth for:
 *   - DOM lookup shorthand (`$` / `$$`)
 *   - pretty-printed JSON with click-to-collapse large nodes
 *   - toast notifications (success / error / info)
 *   - copy-to-clipboard button factory
 *   - status-pill factory (color-coded request state)
 *   - busy / idle toggling for action buttons (prevents double-fire)
 *
 * Plain DOM APIs only — no frameworks. Loaded after `config.js`;
 * attaches to `window.AV.ui`.
 */
(function (root) {
  'use strict';

  var doc = root.document;

  // ---- DOM lookup ---------------------------------------------------

  function $(selector, scope) {
    return (scope || doc).querySelector(selector);
  }
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  // Tiny event-binding helper (Phase-1 micro-alias so app.js stays short).
  // `handler` may also be a string selector — in that case a delegated
  // listener is attached to the parent, matching descendants by that
  // selector. That one extra capability keeps app.js free of manual
  // forEach loops for repeated buttons.
  function on(target, evt, selectorOrHandler, handler) {
    if (!target) return function () {};
    // Direct binding form: on(el, 'click', fn)
    if (typeof selectorOrHandler === 'function') {
      target.addEventListener(evt, selectorOrHandler);
      return function () { target.removeEventListener(evt, selectorOrHandler); };
    }
    // Delegated form: on(parent, 'click', '.btn', fn)
    if (typeof selectorOrHandler === 'string' && typeof handler === 'function') {
      var wrapper = function (e) {
        var n = e.target;
        while (n && n !== target) {
          if (n.matches && n.matches(selectorOrHandler)) {
            handler.call(n, e);
            return;
          }
          n = n.parentNode;
        }
      };
      target.addEventListener(evt, wrapper);
      return function () { target.removeEventListener(evt, wrapper); };
    }
    return function () {};
  }

  // Read / write an input/select/textarea's value or checkbox state.
  // `val(null)` returns '' (the existing helper already returns false for
  // missing elements via setText — here we extend the same null-safety to
  // reads, because the calling code frequently uses `val($('#x')||null)`).
  function val(el) {
    if (!el) return '';
    if (el.type === 'checkbox') return !!el.checked;
    return el.value == null ? '' : el.value;
  }

  function setVal(el, v) {
    if (!el) return false;
    var s = v == null ? '' : String(v);
    if (el.type === 'checkbox') { el.checked = !!v; return !!v; }
    if (el.value !== s) { el.value = s; return true; }
    return false;
  }

  // ---- JSON pretty-print ------------------------------------------

  function escapeHtml(s) {
    var AMP = String.fromCharCode(38) + 'amp;';
    var LT  = String.fromCharCode(60) + 'lt;';
    var GT  = String.fromCharCode(62) + 'gt;';
    return String(s)
      .replace(/&/g, AMP)
      .replace(/</g, LT)
      .replace(/>/g, GT);
  }

  function syntaxHighlight(json) {
    // JSON.stringify with the 4-space indent, then escape, then
    // colour the six JSON token classes (string / number / bool /
    // null / key / punctuation).
    var raw = JSON.stringify(json, null, 2);
    if (raw === undefined) return '';
    var safe = escapeHtml(raw);
    return safe
      .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, function (_m, str, colon) {
        var cls = colon ? 'av-key' : 'av-string';
        return '<span class="' + cls + '">' + str + '</span>' + (colon || '');
      })
      .replace(/\b(true|false)\b/g, '<span class="av-bool">$1</span>')
      .replace(/\bnull\b/g, '<span class="av-null">null</span>')
      .replace(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, '<span class="av-number">$&</span>');
  }

  // Render a JSON value into an element. Click a line-number gutter
  // to collapse / expand a nested object (large payloads otherwise
  // push the response panel off-screen).
  function renderJson(targetEl, value) {
    if (!targetEl) return;
    if (value === undefined || value === null) {
      targetEl.textContent = String(value);
      return;
    }
    targetEl.innerHTML = syntaxHighlight(value);
    bindCollapse(targetEl);
  }

  function bindCollapse(rootEl) {
    // Long single-line strings wrap; arrays + objects can be
    // collapsed by clicking their opening bracket. The toggle is
    // idempotent and reversible.
    $$('.av-key', rootEl).forEach(function () { /* no-op; reserved */ });
    // Click any span wrapping `[` / `{` to collapse.
    var openers = rootEl.textContent.match(/[\[\{]/g);
    if (!openers) return;
    // Lightweight: clicking inside the <pre> toggles a `.av-collapsed`
    // class on the element. The CSS rule shows only the first line.
    rootEl.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      // Avoid swallowing copy-selection clicks.
      if (root.getSelection && root.getSelection().toString().length) return;
      rootEl.classList.toggle('av-collapsed');
    });
  }

  // ---- Toast -------------------------------------------------------

  var TOAST_HOST_ID = 'av-toast-host';

  function ensureToastHost() {
    var host = doc.getElementById(TOAST_HOST_ID);
    if (host) return host;
    host = doc.createElement('div');
    host.id = TOAST_HOST_ID;
    host.className = 'av-toast-host';
    doc.body.appendChild(host);
    return host;
  }

  function toast(message, kind, opts) {
    var host = ensureToastHost();
    var el = doc.createElement('div');
    el.className = 'av-toast av-toast-' + (kind || 'info');
    el.textContent = message;
    host.appendChild(el);
    var ttl = (opts && opts.ttl) || 3200;
    // Trigger fade-in on the next frame so the CSS transition runs.
    root.requestAnimationFrame(function () { el.classList.add('av-toast-show'); });
    var t = root.setTimeout(function () {
      el.classList.remove('av-toast-show');
      root.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, ttl);
    return { dismiss: function () { root.clearTimeout(t); el.remove(); } };
  }

  // ---- Status pill -------------------------------------------------

  // `state` is one of 'idle' | 'loading' | 'ok' | 'error' | 'warn'.
  function pill(state, label) {
    var span = doc.createElement('span');
    span.className = 'av-pill av-pill-' + (state || 'idle');
    span.textContent = label || (state || 'idle');
    return span;
  }

  // ---- Copy-to-clipboard button -----------------------------------

  function copyButton(textOrFn, label) {
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'av-copy-btn';
    btn.textContent = label || 'Copy';
    btn.addEventListener('click', function () {
      var value = typeof textOrFn === 'function' ? textOrFn() : textOrFn;
      if (value === undefined || value === null || value === '') {
        toast('Nothing to copy.', 'warn', { ttl: 1800 });
        return;
      }
      var payload = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      copyText(payload).then(function () {
        btn.classList.add('av-copy-btn-ok');
        btn.textContent = 'Copied';
        root.setTimeout(function () {
          btn.classList.remove('av-copy-btn-ok');
          btn.textContent = label || 'Copy';
        }, 1200);
      }).catch(function () {
        toast('Copy failed — clipboard blocked.', 'error');
      });
    });
    return btn;
  }

  function copyText(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers: temporary textarea + execCommand.
    return new Promise(function (resolve, reject) {
      try {
        var ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        doc.body.appendChild(ta);
        ta.select();
        doc.execCommand('copy');
        doc.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---- Set text content (null-safe) ------------------------------

  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  }

  // ---- DOM factory -----------------------------------------------
  // Lightweight replacement for document.createElement(tag) +
  // ad-hoc property assignments. Supported `attrs` keys:
  //   class, id, text, html, data-<k>, on<event>, anything else
  //   is set via setAttribute.
  function el(tag, attrs, children) {
    var node = doc.createElement(tag || 'div');
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k.indexOf('data-') === 0) {
          node.dataset[k.slice(5)] = String(v);
        } else {
          node.setAttribute(k, String(v));
        }
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
      });
    }
    return node;
  }

  // ---- Labelled <pre> block for request / response bodies --------

  function pre(label, value) {
    var wrap = el('div', { class: 'log-pre' });
    if (label) wrap.appendChild(el('div', { class: 'log-pre-label', text: label }));
    wrap.appendChild(el('pre', { class: 'log-pre-body' },
      typeof value === 'string' ? value : JSON.stringify(value, null, 2)));
    return wrap;
  }

  // ---- Form → plain object ---------------------------------------
  // One-level FormData → Object. Multi-value fields become arrays.

  function formToObject(form) {
    if (!form) return {};
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (v, k) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        var cur = data[k];
        if (Array.isArray(cur)) cur.push(v);
        else data[k] = [cur, v];
      } else {
        data[k] = v;
      }
    });
    return data;
  }

  // ---- Generic pill updater -------------------------------------
  // `state` maps onto a `step-pill-<state>` class. Replaces any
  // existing state class so the pill toggles cleanly between
  // pending / ok / fail / warn.

  var PILL_STATES = ['idle', 'pending', 'ok', 'fail', 'warn', 'error', 'loading'];
  function setPill(target, state, label) {
    if (!target) return;
    PILL_STATES.forEach(function (s) { target.classList.remove('step-pill-' + s); });
    target.classList.add('step-pill-' + (state || 'idle'));
    if (label != null) target.textContent = label;
  }

  // ---- Connection status pill ------------------------------------
  // Updates every `connection-pill` element it finds (dashboard
  // header) and the step-up `su-conn-pill` element if present.
  // `state` is one of: 'checking' | 'ok' | 'down' | 'warn'.
  function setConnection(state, label) {
    var states = ['checking', 'ok', 'down', 'warn', 'pending'];
    var human = {
      checking: 'checking…',
      ok:       'connected',
      down:     'disconnected',
      warn:     'unstable',
      pending:  'unprobed'
    };
    var lab = label || human[state] || state;

    ['#connection-pill', '#su-conn-pill'].forEach(function (sel) {
      var node = $(sel);
      if (!node) return;
      states.forEach(function (s) { node.classList.remove('step-pill-' + s, 'meta-pill-' + s); });
      node.dataset.state = state;
      node.classList.add('meta-pill-' + state, 'step-pill-' + state);
      node.textContent = lab;
    });
  }

  // ---- Button busy state ------------------------------------------

  function setBusy(button, busy, busyLabel) {
    if (!button) return function () {};
    if (busy) {
      button.dataset.avBusyLabel = button.textContent;
      button.disabled = true;
      button.classList.add('av-busy');
      if (busyLabel) button.textContent = busyLabel;
    } else {
      button.disabled = false;
      button.classList.remove('av-busy');
      if (button.dataset.avBusyLabel) {
        button.textContent = button.dataset.avBusyLabel;
        delete button.dataset.avBusyLabel;
      }
    }
    return function restore() { setBusy(button, false, busyLabel); };
  }

  // ---- Formatting helpers -----------------------------------------
  //
  // Pure functions — safe to call from the unit tests without a DOM.

  function formatDuration(ms) {
    if (ms == null || isNaN(ms)) return '';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return Math.round(ms) + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(2).replace(/\.?0+$/, '') + 's';
    var s = Math.round(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + 'm' + (r < 10 ? '0' + r : r) + 's';
  }

  function formatTimestamp(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function formatStatus(status) {
    if (status === 'ERR' || status === 'NET') return status;
    if (status == null) return '';
    return String(status);
  }

  function stateOf(status) {
    if (status === 'ERR' || status === 'NET') return 'error';
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) return 'ok';
      if (status >= 300 && status < 400) return 'warn';
      return 'error';
    }
    return 'idle';
  }

  // Render a coloured status pill. The CSS modifier matches the
  // logger's row colour scheme so the two visual elements stay in
  // sync (see `config.PILL_LEVELS`).
  function statusPill(status) {
    var level = stateOf(status);
    var span = document.createElement('span');
    span.className = 'av-pill av-pill-' + level;
    span.textContent = formatStatus(status);
    span.dataset.status = String(status);
    span.setAttribute('aria-label', 'status ' + formatStatus(status));
    return span;
  }

  // Render a small meta line above a response panel:
  //   "POST /v1/tokenize  →  200 OK  ·  12ms  ·  14:32:01.022"
  function renderResponseMeta(target, meta) {
    if (!target) return null;
    var doc = target.ownerDocument || document;
    var div = doc.createElement('div');
    div.className = 'av-response-meta';
    var method = meta && meta.method ? String(meta.method) : '';
    var url = meta && meta.url ? String(meta.url) : '';
    var dur = meta && meta.durationMs != null ? formatDuration(meta.durationMs) : '';
    var ts = meta && meta.timestamp ? formatTimestamp(meta.timestamp) : '';
    var status = meta && meta.status;

    var line = doc.createElement('span');
    line.className = 'av-response-meta-line';
    line.appendChild(doc.createTextNode(method + ' ' + url));
    if (status != null) {
      line.appendChild(doc.createTextNode('  →  '));
      line.appendChild(statusPill(status));
    }
    if (dur) {
      line.appendChild(doc.createTextNode('  ·  ' + dur));
    }
    if (ts) {
      line.appendChild(doc.createTextNode('  ·  ' + ts));
    }
    div.appendChild(line);
    target.appendChild(div);
    return div;
  }

  // ---- Source-precedence value application -----------------------
  //
  // Set a field's value only if the caller has higher authority than
  // what is currently rendered. Sources (in priority order):
  //
  //   user    (4) — user typed; never overwritten
  //   auto    (3) — derived from a previous API response
  //   draft   (2) — restored from a previous session
  //   default (1) — placeholder literal
  //
  // Rules:
  //   - User-edited fields (data-dirty="true") are sacred.
  //   - Same source: replace the value (idempotent reapply).
  //   - Higher priority source: overrides lower (only while field is empty,
  //     except `auto` overrides `draft` even when draft filled the field,
  //     because a fresh auto-derived value is more authoritative).
  //   - Lower priority source: never overwrite.
  //
  // Returns `true` if the value was applied, `false` otherwise.

  function applyValueWithPrecedence(field, value, source) {
    if (!field) return false;
    var PRIORITY = (root.AV && root.AV.config && root.AV.config.SOURCE_PRIORITY) || {
      user: 4, auto: 3, draft: 2, default: 1
    };
    var currentSource = field.dataset.source || 'default';
    var isUserEdited = field.dataset.dirty === 'true' || currentSource === 'user';

    if (isUserEdited) return false;

    var incomingPriority = PRIORITY[source] || 0;
    var currentPriority = PRIORITY[currentSource] || 0;
    var incomingValue = value == null ? '' : String(value);
    var currentValue = field.value == null ? '' : String(field.value);

    // Same source → idempotent update (also lets a caller clear the field
    // by passing an empty value).
    if (source === currentSource) {
      if (currentValue === incomingValue) return false;
      field.value = incomingValue;
      return true;
    }

    // Higher-priority source over lower priority empty field.
    if (currentValue === '' && incomingPriority > currentPriority) {
      field.value = incomingValue;
      field.dataset.source = source;
      return true;
    }

    // Special case: auto overrides a stale draft value even when the
    // field is non-empty — auto-derived data is more authoritative.
    if (currentSource === 'draft' && source === 'auto') {
      field.value = incomingValue;
      field.dataset.source = source;
      return true;
    }

    return false;
  }

  // Mark a field as user-edited so subsequent auto-derives won't
  // clobber the user's value. Usually wired up via `input` events.
  function markUserEdited(field) {
    if (!field) return;
    field.dataset.dirty = 'true';
    field.dataset.source = 'user';
  }

  // ---- Error envelope ---------------------------------------------
  //
  // Normalise the various shapes `fetch` may produce into a single
  // `{ status, code, message }` object that the UI can render
  // uniformly (status pill + message + body).

  function prettyError(err) {
    if (err == null) {
      return { status: 'ERR', code: 'unknown', message: 'Unknown error' };
    }
    if (typeof err === 'string') {
      return { status: 'ERR', code: 'unknown', message: err };
    }
    if (err && typeof err === 'object') {
      // Already-normalised envelope: pass through.
      if (err.status != null && err.message != null) return err;
      // fetch's TypeError-like network failure.
      if (err.network) {
        return {
          status: 'NET',
          code: err.code || 'network',
          message: err.message || 'Network error'
        };
      }
      return {
        status: err.status != null ? err.status : 'ERR',
        code: err.code || err.error || 'error',
        message: err.message || err.error_description || 'Request failed'
      };
    }
    return { status: 'ERR', code: 'unknown', message: String(err) };
  }

  // ---- Collapsible section ---------------------------------------
  //
  // Wrap a title bar + body in a `<details>` element so the native
  // disclosure widget handles keyboard / accessibility for free.
  // The opening state is read from storage (so the UI remembers
  // the operator's choice across reloads) and persisted on toggle.

  function collapsibleSection(opts) {
    if (!opts || !opts.id) return null;
    var storage = root.AV && root.AV.storage;
    var defaults = (root.AV && root.AV.config && root.AV.config.COLLAPSIBLE_DEFAULTS) || {};
    var defaultOpen = defaults[opts.id] !== false; // default: open

    var saved = storage ? storage.getCollapsibleState(opts.id) : null;
    var open = saved == null ? defaultOpen : !!saved;

    var details = document.createElement('details');
    details.className = 'av-collapsible';
    details.dataset.sectionId = opts.id;
    details.open = open;

    var summary = document.createElement('summary');
    summary.className = 'av-collapsible-summary';
    summary.textContent = opts.title || opts.id;

    var body = document.createElement('div');
    body.className = 'av-collapsible-body';
    // Duck-type the body so we don't depend on the browser-global
    // `Node` (which is absent in vm-based unit tests and would also
    // blow up in any non-DOM host like SSR). Anything with a
    // `nodeType` and an `appendChild` is treated as a DOM node;
    // strings become text nodes; everything else is coerced to
    // text via String().
    if (opts.body && typeof opts.body === 'object' && typeof opts.body.appendChild === 'function') {
      body.appendChild(opts.body);
    } else if (opts.body != null) {
      body.appendChild(doc.createTextNode(String(opts.body)));
    }

    details.appendChild(summary);
    details.appendChild(body);

    details.addEventListener('toggle', function () {
      if (storage) storage.setCollapsibleState(opts.id, details.open);
    });

    return details;
  }

  // ---- Convenience helpers ------------------------------------------
  //
  // `responseHeader(response)` formats the first line of an HTTP-style
  // response header block for the response panel. Falls back to a
  // single-line summary when the response is empty / missing.
  function responseHeader(response) {
    var line = document.createElement('div');
    line.className = 'http-line';
    if (!response || typeof response !== 'object') {
      line.textContent = '(no response)';
      return line;
    }
    var status = response.status != null ? response.status : '?';
    var statusText = response.statusText ? ' ' + response.statusText : '';
    var ms = response.duration != null ? response.duration + 'ms' : '-';
    var hdrs = response.headers && typeof response.headers === 'object'
      ? response.headers : {};
    var headerText = '';
    var keys = Object.keys(hdrs);
    if (keys.length) {
      headerText = keys.map(function (k) {
        return k + ': ' + (hdrs[k] == null ? '' : String(hdrs[k]));
      }).join('\n');
    }
    line.textContent =
      'HTTP/1.1 ' + status + statusText + '\nDuration: ' + ms + '\n' + headerText;
    return line;
  }

  // `attachCopyButtons(rootEl)` walks the subtree once and adds a
  // copy button next to every element that carries a `data-copy`
  // attribute. The element's `data-copy` value is what gets copied;
  // falling back to its `textContent` makes it convenient for
  // plain <code>/<pre> blocks.
  // Buttons are added at most once per element (`__copyBound`
  // guard) so re-rendering is safe.
  function attachCopyButtons(rootEl) {
    if (!rootEl) return;
    var doc = rootEl.ownerDocument || root.document;
    var targets = rootEl.querySelectorAll('[data-copy]');
    for (var i = 0; i < targets.length; i++) {
      (function (el) {
        if (el.__copyBound === true) return;
        el.__copyBound = true;
        var initial = el.getAttribute('data-copy');
        if (initial == null || initial === '') {
          initial = el.textContent || '';
        }
        var btn = copyButton(initial);
        btn.classList.add('copy-btn--inline');
        var parent = el.parentNode;
        var tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          if (parent && parent.insertBefore) parent.insertBefore(btn, el.nextSibling);
        } else if (parent) {
          parent.insertBefore(btn, el.nextSibling);
        }
      })(targets[i]);
    }
  }

  // `bindFormDrafts(targets)` restores a previously-saved draft (if
  // any) and persists the field values whenever the user types.
  // Submission clears the draft so a one-shot submit intent is not
  // later restored by mistake. Drafts are scoped by `formEl.id`,
  // which is why every demo <form> must keep a stable ID.
  var _draftTimers = {};
  function bindFormDrafts(targets) {
    var storageNS = root.AV && root.AV.storage;
    if (!storageNS || !targets) return;
    var list = Array.isArray(targets) ? targets : [targets];
    list.forEach(function (target) {
      var formEl = typeof target === 'string' ? (doc.getElementById(target) || $(target)) : target;
      if (!formEl || !formEl.id) return;
      if (formEl.__draftsBound === true) return;
      formEl.__draftsBound = true;
      var id = formEl.id;
      var draft = storageNS.getDraft(id);
      if (draft && draft.data && typeof draft.data === 'object') {
        Object.keys(draft.data).forEach(function (name) {
          if (name.indexOf('__') === 0) return; // skip internal flags
          var field = formEl.elements.namedItem(name);
          if (!field || field.disabled) return;
          if ('value' in field) {
            var v = draft.data[name];
            field.value = v == null ? '' : String(v);
          }
        });
      }
      formEl.addEventListener('input', function () {
        if (_draftTimers[id]) clearTimeout(_draftTimers[id]);
        _draftTimers[id] = setTimeout(function () {
          var data = formToObject(formEl);
          if (storageNS) storageNS.saveDraft(id, data);
        }, 300);
      });
      formEl.addEventListener('submit', function () {
        if (_draftTimers[id]) clearTimeout(_draftTimers[id]);
        if (storageNS) storageNS.clearDraft(id);
      });
    });
  }

  // `confirm(msg)` is a tiny wrapper around `window.confirm`. In
  // Node (e.g. tests via `vm.runInContext`) there is no `confirm`,
  // so we treat the call as approved; the demo flow never relies on
  // the return value being `false`.
  function confirm(msg) {
    if (typeof root.confirm === 'function') {
      try { return !!root.confirm(msg); } catch (_err) { return true; }
    }
    return true;
  }

  // ---- Public API --------------------------------------------------

  root.AV = root.AV || {};
  root.AV.ui = {
    $: $,
    $$: $$,
    on: on,
    val: val,
    setVal: setVal,
    el: el,
    pre: pre,
    setText: setText,
    formToObject: formToObject,
    setPill: setPill,
    setConnection: setConnection,
    renderJson: renderJson,
    toast: toast,
    pill: pill,
    copyButton: copyButton,
    copyText: copyText,
    setBusy: setBusy,
    escapeHtml: escapeHtml,
    syntaxHighlight: syntaxHighlight,
    formatDuration: formatDuration,
    formatTimestamp: formatTimestamp,
    formatStatus: formatStatus,
    stateOf: stateOf,
    statusPill: statusPill,
    renderResponseMeta: renderResponseMeta,
    applyValueWithPrecedence: applyValueWithPrecedence,
    markUserEdited: markUserEdited,
    prettyError: prettyError,
    collapsibleSection: collapsibleSection,
    responseHeader: responseHeader,
    attachCopyButtons: attachCopyButtons,
    bindFormDrafts: bindFormDrafts,
    confirm: confirm
  };
})(typeof window !== 'undefined' ? window : globalThis);
