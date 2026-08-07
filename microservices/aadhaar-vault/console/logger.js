/* Aadhaar Vault Console — request / response history
 *
 * A small in-memory + persisted ring buffer of recent API calls.
 * `app.js` calls `logger.log(...)` after every request, then asks
 * `logger.render(panelEl)` to repaint the audit / history panel.
 *
 *   entry = {
 *     id:        string,         // monotonic, 1-based
 *     ts:        ISO string,     // when the request started
 *     method:    string,         // HTTP verb
 *     path:      string,         // URL path (no host)
 *     status:    number|string,  // HTTP status, or 'ERR' / 'NET'
 *     duration:  number,         // milliseconds
 *     actor:     string,         // actor used for the request
 *     request:   object|string,  // payload sent
 *     response:  object|string,  // body returned (or error message)
 *     error:     string|null     // network / parse failure text
 *   }
 *
 * Filter API:
 *   logger.getFilters()        → { ok:true, error:true, warn:true, idle:true }
 *   logger.setFilters(map)     → persisted under STORAGE_KEYS.PILL_FILTERS
 *   logger.applyFilter(entry)  → true if entry should be shown
 *
 * Loaded after `storage.js`; attaches to `window.AV.logger`.
 */
(function (root) {
  'use strict';

  var config = (root.AV && root.AV.config) || {};
  var storage = root.AV && root.AV.storage;
  var ui = root.AV && root.AV.ui;

  var MAX_ENTRIES = config.LOG_MAX_ENTRIES || 100;
  var DEFAULT_FILTER = {
    ok:    true,
    error: true,
    warn:  true,
    idle:  true
  };

  // ---- State ---------------------------------------------------------

  var entries = [];
  if (storage) {
    var persisted = storage.getLog();
    if (Array.isArray(persisted)) entries = persisted;
  }
  var seq = entries.reduce(function (max, e) {
    return e && typeof e.id === 'number' && e.id > max ? e.id : max;
  }, 0);

  function persist() {
    if (storage) storage.setLog(entries);
  }

  // Resolve a status into the canonical bucket used by the filter UI.
  // Falls back to the local implementation if ui.stateOf is missing —
  // preserves independence for the test harness.
  function stateOf(status) {
    if (ui && typeof ui.stateOf === 'function') return ui.stateOf(status);
    if (status === 'ERR' || status === 'NET') return 'error';
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) return 'ok';
      if (status >= 300 && status < 400) return 'warn';
      return 'error';
    }
    return 'idle';
  }

  // ---- Public API ----------------------------------------------------

  function log(entry) {
    if (!entry || typeof entry !== 'object') return null;
    seq += 1;
    var stamped = Object.assign({}, entry, { id: seq });
    entries.unshift(stamped);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    persist();
    return stamped;
  }

  function all() {
    return entries.slice();
  }

  function clear() {
    entries = [];
    seq = 0;
    persist();
  }

  function get(id) {
    if (typeof id !== 'number') return null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === id) return entries[i];
    }
    return null;
  }

  // ---- Filter API ----------------------------------------------------

  function getFilters() {
    if (!storage) return Object.assign({}, DEFAULT_FILTER);
    var saved = storage.getPillFilter();
    if (!saved || typeof saved !== 'object') return Object.assign({}, DEFAULT_FILTER);
    return Object.assign({}, DEFAULT_FILTER, saved);
  }

  function setFilters(map) {
    if (!storage) return;
    var merged = Object.assign({}, DEFAULT_FILTER, map || {});
    storage.setPillFilter(merged);
  }

  function applyFilter(entry) {
    if (!entry) return false;
    var filters = getFilters();
    var level = stateOf(entry.status);
    return filters[level] !== false;
  }

  function filtered() {
    return entries.filter(applyFilter);
  }

  // ---- Row rendering -------------------------------------------------

  // Build a single row DOM element for the history panel. The CSS hook
  // is `.av-log-row` with level modifiers (`-ok`, `-error`, …) so
  // pills + rows share the same colour scheme.
  function renderRow(entry, doc) {
    doc = doc || (root.document || (root.AV && root.AV.config && root.AV.config.__doc));
    if (!doc) doc = { createElement: function (t) { return { tagName: t, children: [], appendChild: function (c) { this.children.push(c); }, classList: { add: function () {}, remove: function () {} }, dataset: {}, setAttribute: function () {}, textContent: '' }; } };
    var row = doc.createElement('div');
    row.className = 'av-log-row av-log-row-' + stateOf(entry.status);
    row.dataset.entryId = String(entry.id);

    var numCell = doc.createElement('span');
    numCell.className = 'av-log-cell av-log-cell-id';
    numCell.textContent = '#' + entry.id;
    row.appendChild(numCell);

    var timeCell = doc.createElement('span');
    timeCell.className = 'av-log-cell av-log-cell-time';
    timeCell.textContent = ui && ui.formatTimestamp ? ui.formatTimestamp(entry.ts) : (entry.ts || '');
    row.appendChild(timeCell);

    var methodCell = doc.createElement('span');
    methodCell.className = 'av-log-cell av-log-cell-method';
    methodCell.textContent = entry.method || '';
    row.appendChild(methodCell);

    var pathCell = doc.createElement('span');
    pathCell.className = 'av-log-cell av-log-cell-path';
    pathCell.textContent = entry.path || '';
    row.appendChild(pathCell);

    var statusCell = doc.createElement('span');
    statusCell.className = 'av-log-cell av-log-cell-status';
    if (ui && typeof ui.statusPill === 'function') {
      statusCell.appendChild(ui.statusPill(entry.status));
    } else {
      statusCell.textContent = entry.status == null ? '' : String(entry.status);
    }
    row.appendChild(statusCell);

    var durCell = doc.createElement('span');
    durCell.className = 'av-log-cell av-log-cell-dur';
    durCell.textContent = entry.duration != null ? entry.duration + 'ms' : '';
    row.appendChild(durCell);

    if (entry.actor) {
      var actorCell = doc.createElement('span');
      actorCell.className = 'av-log-cell av-log-cell-actor';
      actorCell.textContent = entry.actor;
      row.appendChild(actorCell);
    }

    return row;
  }

  // ---- Rendering -----------------------------------------------------

  // Render the buffer (filtered) into `panel`. The panel may be a
  // `<tbody>`, `<ul>`, or generic container. Filters are honoured
  // automatically — pass `panel.dataset.skipFilter = "true"` to
  // override (e.g. for export views).
  function render(panel, opts) {
    if (!panel) return;
    var skipFilter = !!(opts && opts.skipFilter) || panel.dataset && panel.dataset.skipFilter === 'true';
    var source = skipFilter ? entries : filtered();
    var doc = panel.ownerDocument || root.document;
    var frag = doc.createDocumentFragment();

    if (panel.tagName === 'TBODY') {
      source.forEach(function (e) {
        var tr = doc.createElement('tr');
        tr.dataset.entryId = String(e.id);
        appendCell(doc, tr, '#' + e.id);
        appendCell(doc, tr, ui && ui.formatTimestamp ? ui.formatTimestamp(e.ts) : (e.ts || ''));
        appendCell(doc, tr, e.method || '');
        appendCell(doc, tr, e.path || '');
        var pillCell = doc.createElement('td');
        if (ui && typeof ui.statusPill === 'function') {
          pillCell.appendChild(ui.statusPill(e.status));
        } else {
          pillCell.textContent = e.status == null ? '' : String(e.status);
        }
        tr.appendChild(pillCell);
        appendCell(doc, tr, e.duration != null ? e.duration + 'ms' : '');
        appendCell(doc, tr, e.actor || '');
        frag.appendChild(tr);
      });
    } else if (panel.tagName === 'UL') {
      source.forEach(function (e) {
        var li = doc.createElement('li');
        li.className = 'av-log-row av-log-row-' + stateOf(e.status);
        li.dataset.entryId = String(e.id);
        li.textContent = '#' + e.id + ' ' + (e.method || '') + ' ' +
          (e.path || '') + ' → ' + (e.status == null ? '' : String(e.status)) +
          ' (' + (e.duration != null ? e.duration + 'ms' : '-') + ')';
        frag.appendChild(li);
      });
    } else {
      source.forEach(function (e) {
        frag.appendChild(renderRow(e, doc));
      });
    }

    while (panel.firstChild) panel.removeChild(panel.firstChild);
    panel.appendChild(frag);
  }

  function appendCell(doc, tr, text) {
    var td = doc.createElement('td');
    td.textContent = text == null ? '' : String(text);
    tr.appendChild(td);
  }

  // ---- Convenience helpers ------------------------------------------
  //
  // `appendText(msg)` writes a one-line `text/plain` message into the
  // simple `[data-log-text]` element if present. It is intentionally
  // decoupled from the structured request log so the operator can
  // glance at a debug stream without filling the table.
  //
  // `bindCopyFilters(panelEl)` wires the `[data-filter]` pill
  // buttons inside `panelEl` to toggle the persisted filter map and
  // re-render. Safe to call multiple times — the listener is attached
  // once via a `WeakSet`.
  //
  // `clearAll()` is an alias for `clear()` to match the storage /
  // UI vocabulary.
  var _boundPanels = (typeof WeakSet === 'function') ? new WeakSet() : null;

  function appendText(msg) {
    var el = root.document && root.document.querySelector('[data-log-text]');
    if (!el) return;
    var stamp = new Date().toLocaleTimeString();
    el.textContent = '[' + stamp + '] ' + (msg == null ? '' : String(msg))
      + '\n' + (el.textContent || '');
    el.scrollTop = 0;
  }

  // Append a free-form workflow event ("✓ MFA Enrolled") to the
  // Activity Log panel of the current page. Owns the entry schema
  // so callers do not have to know it.
  function workflow(status, message, extra) {
    var statusStr =
      status === true ? 'ok' :
      status === false ? 'error' :
      'idle';
    var actor =
      (root.AV && root.AV.session && root.AV.session.actor) || '';
    var entry = {
      kind: 'workflow',
      label: 'workflow',
      ts: new Date().toISOString(),
      method: 'workflow',
      path: message || '',
      status: statusStr,
      duration: 0,
      actor: actor,
      request: message || '',
      response: null,
      error: status === false ? (message || null) : null
    };
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) {
        if (!(k in entry)) entry[k] = extra[k];
      });
    }
    var persisted = log(entry);

    // Live-append to whichever panel is currently visible so we do
    // not disturb the scroll position of prior rows.
    var doc = root.document;
    if (doc) {
      var live = doc.getElementById('log-tbody');
      if (live) {
        var row = doc.createElement('div');
        row.className = 'av-log-row av-log-row-' + statusStr +
          ' av-log-row-workflow';
        row.dataset.entryId = String(persisted.id);
        row.textContent = message || '';
        live.appendChild(row);
        live.scrollTop = live.scrollHeight;
      }
    }
    return persisted;
  }

  function bindCopyFilters(panelEl) {
    if (!panelEl || (panelEl.__filtersBound === true)) return;
    panelEl.__filtersBound = true;
    if (_boundPanels && typeof _boundPanels.has === 'function') _boundPanels.add(panelEl);
    var buttons = panelEl.querySelectorAll('[data-filter]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        var level = btn.getAttribute('data-filter');
        var filters = getFilters();
        btn.classList.toggle('pill--active', filters[level] !== false);
        btn.addEventListener('click', function () {
          var current = getFilters();
          current[level] = current[level] === false;
          setFilters(current);
          btn.classList.toggle('pill--active', current[level] !== false);
          render(panelEl);
        });
      })(buttons[i]);
    }
  }

  function clearAll() { clear(); }

  // ---- Export --------------------------------------------------------

  root.AV = root.AV || {};
  root.AV.logger = {
    log: log,
    all: all,
    get: get,
    clear: clear,
    clearAll: clearAll,
    render: render,
    renderRow: renderRow,
    getFilters: getFilters,
    setFilters: setFilters,
    applyFilter: applyFilter,
    filtered: filtered,
    stateOf: stateOf,
    appendText: appendText,
    bindCopyFilters: bindCopyFilters,
    workflow: workflow
  };
})(typeof window !== 'undefined' ? window : globalThis);
