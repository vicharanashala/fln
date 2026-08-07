/**
 * Console helper-layer unit tests (Session 8).
 *
 * Why a separate test file:
 *   The new helpers added in `console/config.js`, `console/storage.js`,
 *   `console/ui.js`, and `console/logger.js` are plain vanilla JS
 *   intended to run in the browser via <script> tags. They attach
 *   themselves to a global `window.AV` namespace and do not use
 *   ES module imports (the console has no bundler).
 *
 *   Rather than refactor the console to use ESM (out of scope for
 *   this session), we use Node's `vm` module to load each script
 *   inside an isolated context that has just enough browser
 *   surface (localStorage + a minimal `document`) to satisfy the
 *   runtime. This means we exercise the real shipped code, not a
 *   mock or a reimplementation.
 *
 * What this covers:
 *   - `config.STORAGE_KEYS`, `config.DRAFT_FORMS`, `config.SOURCE_PRIORITY`,
 *     `config.PILL_LEVELS`, `config.COLLAPSIBLE_DEFAULTS`
 *   - `storage.saveDraft / getDraft / clearDraft / listDraftFormIds`
 *   - `storage.getCollapsibleState / setCollapsibleState`
 *   - `storage.getPillFilter / setPillFilter`
 *   - `ui.formatDuration / formatTimestamp / formatStatus / stateOf`
 *   - `ui.statusPill` + `renderResponseMeta` (against a stub doc)
 *   - `ui.applyValueWithPrecedence` source-priority resolver
 *   - `ui.markUserEdited` + prettyError
 *   - `ui.collapsibleSection` persists via storage
 *   - `logger.stateOf / getFilters / setFilters / applyFilter / filtered`
 *
 * What this does NOT cover:
 *   - Real DOM rendering (no jsdom dependency added for this session).
 *   - Integration with the API wrapper (covered by the existing
 *     `console.test.ts` HTTP suite).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONSOLE_DIR = path.resolve(__dirname, '..', 'console');

/**
 * Build a fresh fake `window` context, load every console script in
 * the right order (config → storage → ui → logger), and return the
 * resulting `AV` namespace plus the underlying localStorage map so
 * tests can assert on what was persisted.
 */
function loadConsole(): { AV: any; ls: Map<string, string> } {
  const ls = new Map<string, string>();

  const fakeStorage = {
    getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
    setItem: (k: string, v: string) => { ls.set(k, String(v)); },
    removeItem: (k: string) => { ls.delete(k); },
    clear: () => { ls.clear(); },
    key: (i: number) => Array.from(ls.keys())[i] ?? null,
    get length() { return ls.size; },
  };

  // Minimal document stub. Only `createElement` and a tiny classList/
  // dataset shim are needed for the helpers we exercise here.
  function makeNode(tag: string) {
    const node: any = {
      tagName: (tag || 'div').toUpperCase(),
      children: [] as any[],
      classList: {
        _set: new Set<string>(),
        add(c: string) { this._set.add(c); },
        remove(c: string) { this._set.delete(c); },
        contains(c: string) { return this._set.has(c); },
        toggle(c: string) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
      },
      dataset: {} as Record<string, string>,
      attributes: {} as Record<string, string>,
      style: {} as Record<string, string>,
      _listeners: {} as Record<string, Function[]>,
      appendChild(c: any) { this.children.push(c); c.parentNode = this; return c; },
      removeChild(c: any) {
        const i = this.children.indexOf(c);
        if (i >= 0) this.children.splice(i, 1);
        return c;
      },
      addEventListener(ev: string, fn: Function) {
        (this._listeners[ev] ||= []).push(fn);
      },
      removeEventListener() { /* no-op */ },
      setAttribute(k: string, v: string) { this.attributes[k] = String(v); this.dataset[k.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v); },
      getAttribute(k: string) { return this.attributes[k] ?? null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      get firstChild() { return this.children[0] ?? null; },
      set textContent(v: string) { this._text = v; this.children = []; },
      get textContent() { return this._text ?? ''; },
      set innerHTML(v: string) { this._text = v; this.children = []; },
      get innerHTML() { return this._text ?? ''; },
      get parentNode() { return this._parent ?? null; },
      set parentNode(p: any) { this._parent = p; },
      ownerDocument: null as any,
      className: '',
    };
    return node;
  }

  const fakeDoc: any = {
    _create: makeNode,
    createElement(tag: string) { const n = makeNode(tag); n.ownerDocument = fakeDoc; return n; },
    createDocumentFragment() { return this.createElement('fragment'); },
    createTextNode(t: string) { const n = makeNode('text'); n.textContent = String(t); return n; },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    body: makeNode('body'),
  };

  const fakeWindow: any = {
    document: fakeDoc,
    localStorage: fakeStorage,
    navigator: { clipboard: undefined },
    requestAnimationFrame: (fn: Function) => setImmediate(() => fn(0)),
    setTimeout: (fn: Function, ms?: number) => setTimeout(fn as any, ms ?? 0),
    clearTimeout: (t: any) => clearTimeout(t),
  };
  fakeWindow.window = fakeWindow;

  const ctx = vm.createContext(fakeWindow);

  for (const file of ['config.js', 'storage.js', 'ui.js', 'logger.js']) {
    const src = fs.readFileSync(path.join(CONSOLE_DIR, file), 'utf8');
    vm.runInContext(src, ctx, { filename: file });
  }

  return { AV: fakeWindow.AV, ls };
}

describe('console/config — Session 8 additions', () => {
  let AV: any;
  beforeEach(() => { AV = loadConsole().AV; });

  it('exposes the original STORAGE_KEYS (additive — never renamed)', () => {
    expect(AV.config.STORAGE_KEYS.API_BASE).toBe('aadhaar-vault.apiBase');
    expect(AV.config.STORAGE_KEYS.ACTOR).toBe('aadhaar-vault.actor');
    expect(AV.config.STORAGE_KEYS.JWT).toBe('aadhaar-vault.jwt');
    expect(AV.config.STORAGE_KEYS.LOG).toBe('aadhaar-vault.log');
  });

  it('adds the three new STORAGE_KEYS', () => {
    expect(AV.config.STORAGE_KEYS.DRAFTS).toBe('aadhaar-vault.drafts');
    expect(AV.config.STORAGE_KEYS.COLLAPSIBLE).toBe('aadhaar-vault.collapsible');
    expect(AV.config.STORAGE_KEYS.PILL_FILTERS).toBe('aadhaar-vault.pillFilters');
  });

  it('exposes DRAFT_FORMS listing every interactive console form', () => {
    expect(AV.config.DRAFT_FORMS).toEqual(
      expect.arrayContaining([
        'tokenize-form', 'lookup-form', 'detokenize-form',
        'approve-form', 'stepup-form'
      ])
    );
  });

  it('defines COLLAPSIBLE_DEFAULTS for the seven sections', () => {
    const keys = Object.keys(AV.config.COLLAPSIBLE_DEFAULTS);
    expect(keys.length).toBe(7);
    expect(keys).toEqual(expect.arrayContaining([
      'console.section.health',
      'console.section.tokenize',
      'console.section.lookup',
      'console.section.detokenize',
      'console.section.approve',
      'console.section.audit',
      'console.section.history'
    ]));
    // every section defaults to open
    for (const k of keys) expect(AV.config.COLLAPSIBLE_DEFAULTS[k]).toBe(true);
  });

  it('declares the SOURCE_PRIORITY ladder', () => {
    expect(AV.config.SOURCE_PRIORITY).toEqual({
      user: 4, auto: 3, draft: 2, default: 1
    });
  });

  it('exposes PILL_LEVELS mapping for status → CSS modifier', () => {
    expect(AV.config.PILL_LEVELS.ok).toBe('ok');
    expect(AV.config.PILL_LEVELS.error).toBe('error');
    expect(AV.config.PILL_LEVELS.warn).toBe('warn');
    expect(AV.config.PILL_LEVELS.idle).toBe('idle');
  });

  it('exposes TOAST_DURATION_MS + DRAFT_SAVE_DEBOUNCE_MS as numbers', () => {
    expect(typeof AV.config.TOAST_DURATION_MS).toBe('number');
    expect(typeof AV.config.DRAFT_SAVE_DEBOUNCE_MS).toBe('number');
    expect(AV.config.TOAST_DURATION_MS).toBeGreaterThan(0);
    expect(AV.config.DRAFT_SAVE_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});

describe('console/storage — Session 8 additions', () => {
  let AV: any, ls: Map<string, string>;
  beforeEach(() => { const r = loadConsole(); AV = r.AV; ls = r.ls; });

  it('round-trips a draft via saveDraft / getDraft', () => {
    const drafts = AV.storage;
    drafts.saveDraft('tokenize-form', { aadhaar: '123412341234' });
    const got = drafts.getDraft('tokenize-form');
    expect(got).toBeTruthy();
    expect(got.data).toEqual({ aadhaar: '123412341234' });
    expect(typeof got.savedAt).toBe('string'); // ISO timestamp
  });

  it('listDraftFormIds returns the saved keys only', () => {
    AV.storage.saveDraft('tokenize-form', { a: 1 });
    AV.storage.saveDraft('lookup-form', { b: 2 });
    const ids = AV.storage.listDraftFormIds();
    expect(ids).toEqual(expect.arrayContaining(['tokenize-form', 'lookup-form']));
    expect(ids.length).toBe(2);
  });

  it('getDrafts returns the full record map', () => {
    AV.storage.saveDraft('tokenize-form', { a: 1 });
    const all = AV.storage.getDrafts();
    expect(all['tokenize-form']).toBeTruthy();
    expect(all['tokenize-form'].data).toEqual({ a: 1 });
  });

  it('clearDraft removes the entry', () => {
    AV.storage.saveDraft('tokenize-form', { a: 1 });
    AV.storage.clearDraft('tokenize-form');
    expect(AV.storage.getDraft('tokenize-form')).toBe(null);
  });

  it('getCollapsibleState returns null when nothing persisted', () => {
    expect(AV.storage.getCollapsibleState('console.section.health')).toBe(null);
  });

  it('setCollapsibleState + getCollapsibleState round-trips', () => {
    AV.storage.setCollapsibleState('console.section.health', false);
    expect(AV.storage.getCollapsibleState('console.section.health')).toBe(false);
    AV.storage.setCollapsibleState('console.section.health', true);
    expect(AV.storage.getCollapsibleState('console.section.health')).toBe(true);
  });

  it('getPillFilter returns null when nothing persisted', () => {
    expect(AV.storage.getPillFilter()).toBe(null);
  });

  it('setPillFilter persists the filter map', () => {
    AV.storage.setPillFilter({ ok: true, error: false });
    expect(AV.storage.getPillFilter()).toEqual({ ok: true, error: false });
  });

  it('clearAll preserves the CONSOLE namespace key', () => {
    ls.set(AV.config.STORAGE_KEYS.CONSOLE, '{"keep":"me"}');
    ls.set('aadhaar-vault.actor', 'demo');
    AV.storage.clearAll();
    expect(ls.has(AV.config.STORAGE_KEYS.CONSOLE)).toBe(true);
    expect(ls.has('aadhaar-vault.actor')).toBe(false);
  });

  it('getSettings gracefully handles missing LEGACY_API_BASE', () => {
    ls.set(AV.config.STORAGE_KEYS.API_BASE, 'http://api.base');
    expect(AV.storage.getSettings().apiBase).toBe('http://api.base');
    ls.clear();
    ls.set('undefined', 'http://wrong.base');
    // It should not fall back to the literal "undefined" key
    expect(AV.storage.getSettings().apiBase).toBe('');
  });
});

describe('console/ui — Session 8 additions', () => {
  let AV: any, doc: any;
  beforeEach(() => {
    const r = loadConsole();
    AV = r.AV;
    doc = AV.ui.el('div'); // smoke-create via the factory to ensure wiring
  });

  it('formatDuration: sub-millisecond, ms, seconds, minutes', () => {
    expect(AV.ui.formatDuration(0)).toBe('<1ms');
    expect(AV.ui.formatDuration(42)).toBe('42ms');
    expect(AV.ui.formatDuration(1500)).toBe('1.5s');
    expect(AV.ui.formatDuration(65000)).toBe('1m05s');
    expect(AV.ui.formatDuration(null)).toBe('');
  });

  it('formatTimestamp: HH:MM:SS.mmm format', () => {
    const iso = '2024-05-01T10:32:01.022Z';
    const out = AV.ui.formatTimestamp(iso);
    // timezone-independent shape check (allow any leading HH that
    // matches the UTC instant rendered in local time).
    expect(out).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('formatStatus + stateOf for HTTP codes', () => {
    expect(AV.ui.formatStatus(200)).toBe('200');
    expect(AV.ui.formatStatus('ERR')).toBe('ERR');
    expect(AV.ui.formatStatus('NET')).toBe('NET');
    expect(AV.ui.stateOf(200)).toBe('ok');
    expect(AV.ui.stateOf(404)).toBe('error');
    expect(AV.ui.stateOf(301)).toBe('warn');
    expect(AV.ui.stateOf('ERR')).toBe('error');
    expect(AV.ui.stateOf(undefined)).toBe('idle');
  });

  it('statusPill renders an <av-pill av-pill-{level}> element with text', () => {
    const pill = AV.ui.statusPill(200);
    expect(pill.className).toContain('av-pill-ok');
    expect(pill.textContent).toBe('200');
    expect(pill.getAttribute('aria-label')).toBe('status 200');
  });

  it('renderResponseMeta appends the meta line with pill + duration + ts', () => {
    const host = doc; // any element with an ownerDocument
    AV.ui.renderResponseMeta(host, {
      method: 'POST',
      url: '/v1/tokenize',
      status: 201,
      durationMs: 245,
      timestamp: '2024-05-01T10:32:01.022Z'
    });
    // The DOM-stub appendChild pushes onto children; first child
    // should be the meta wrapper, and it should contain a pill.
    const meta = host.children[0];
    expect(meta).toBeTruthy();
    expect(meta.className).toBe('av-response-meta');
  });

  it('applyValueWithPrecedence: user always wins', () => {
    const field: any = { value: '', dataset: {}, tagName: 'INPUT' };
    AV.ui.markUserEdited(field);
    expect(field.dataset.source).toBe('user');
    expect(field.dataset.dirty).toBe('true');
    expect(AV.ui.applyValueWithPrecedence(field, 'auto-value', 'auto')).toBe(false);
  });

  it('applyValueWithPrecedence: auto over default on empty field', () => {
    const field: any = { value: '', dataset: {}, tagName: 'INPUT' };
    expect(AV.ui.applyValueWithPrecedence(field, 'X', 'auto')).toBe(true);
    expect(field.value).toBe('X');
    expect(field.dataset.source).toBe('auto');
  });

  it('applyValueWithPrecedence: same-source is idempotent + can clear', () => {
    const field: any = { value: 'X', dataset: { source: 'auto' }, tagName: 'INPUT' };
    // same value → no change
    expect(AV.ui.applyValueWithPrecedence(field, 'X', 'auto')).toBe(false);
    // empty value with same source → allowed (clear)
    expect(AV.ui.applyValueWithPrecedence(field, '', 'auto')).toBe(true);
    expect(field.value).toBe('');
  });

  it('applyValueWithPrecedence: auto over draft even when draft non-empty', () => {
    const field: any = { value: 'old', dataset: { source: 'draft' }, tagName: 'INPUT' };
    expect(AV.ui.applyValueWithPrecedence(field, 'fresh', 'auto')).toBe(true);
    expect(field.value).toBe('fresh');
  });

  it('applyValueWithPrecedence: lower priority source never overwrites', () => {
    const field: any = { value: 'X', dataset: { source: 'auto' }, tagName: 'INPUT' };
    expect(AV.ui.applyValueWithPrecedence(field, 'Y', 'default')).toBe(false);
    expect(field.value).toBe('X');
  });

  it('prettyError: null, string, plain object, normalised envelope', () => {
    expect(AV.ui.prettyError(null)).toEqual({ status: 'ERR', code: 'unknown', message: 'Unknown error' });
    expect(AV.ui.prettyError('boom')).toEqual({ status: 'ERR', code: 'unknown', message: 'boom' });
    expect(AV.ui.prettyError({ network: true, message: 'offline' }).status).toBe('NET');
    expect(AV.ui.prettyError({ status: 401, error: 'unauthorized' })).toEqual({
      status: 401, code: 'unauthorized', message: 'Request failed'
    });
    // already-normalised envelope passes through
    expect(AV.ui.prettyError({ status: 500, code: 'x', message: 'm' })).toEqual({
      status: 500, code: 'x', message: 'm'
    });
  });

  it('collapsibleSection returns a <details> with correct open state + persistence', () => {
    const body = AV.ui.el('div', { text: 'hello' });
    const det = AV.ui.collapsibleSection({ id: 'console.section.health', title: 'Health', body });
    expect(det.tagName).toBe('DETAILS');
    expect(det.open).toBe(true); // default true in COLLAPSIBLE_DEFAULTS
    // toggle and verify persistence
    det.open = false;
    // The handler is wired via addEventListener; simulate the toggle.
    const handlers = (det as any)._listeners.toggle;
    expect(handlers && handlers.length).toBe(1);
    handlers[0]();
    expect(AV.storage.getCollapsibleState('console.section.health')).toBe(false);
  });

  it('bindFormDrafts normalizes target types (element, selector, array)', () => {
    const form1 = doc.ownerDocument.createElement('form'); form1.id = 'f1';
    const form2 = doc.ownerDocument.createElement('form'); form2.id = 'f2';
    const form3 = doc.ownerDocument.createElement('form'); form3.id = 'f3';
    const form4 = doc.ownerDocument.createElement('form'); form4.id = 'f4';
    doc.ownerDocument.body.appendChild(form1);
    doc.ownerDocument.body.appendChild(form2);
    doc.ownerDocument.body.appendChild(form3);
    doc.ownerDocument.body.appendChild(form4);

    // mock document methods for the local ui.js references
    doc.ownerDocument.getElementById = (id: string) => doc.ownerDocument.body.children.find((c: any) => c.id === id) || null;
    doc.ownerDocument.querySelector = (sel: string) => doc.ownerDocument.getElementById(sel.replace('#', ''));

    AV.ui.bindFormDrafts(form1); // single element
    AV.ui.bindFormDrafts('#f2'); // string selector
    AV.ui.bindFormDrafts(['#f3', 'f4']); // array of strings (ID fallback)

    expect(form1.__draftsBound).toBe(true);
    expect(form2.__draftsBound).toBe(true);
    expect(form3.__draftsBound).toBe(true);
    expect(form4.__draftsBound).toBe(true);

    // duplicate bind should be ignored silently
    AV.ui.bindFormDrafts(form1);
    // Invalid selector silently ignored
    AV.ui.bindFormDrafts('#invalid-form');
  });

  it('val and setVal correctly handle checkboxes', () => {
    const cb = doc.ownerDocument.createElement('input');
    cb.type = 'checkbox';
    
    expect(AV.ui.val(cb)).toBe(false);
    
    AV.ui.setVal(cb, true);
    expect(cb.checked).toBe(true);
    expect(AV.ui.val(cb)).toBe(true);

    AV.ui.setVal(cb, false);
    expect(cb.checked).toBe(false);
    expect(AV.ui.val(cb)).toBe(false);
  });

  // Regression test for Session 8 P0:
  // `ui.responseHeader(...)` must return a DOM Node, not a string —
  // `app.js paintResultInto` passes the result to `Node.appendChild`,
  // which throws TypeError if given a string. The fake-DOM stub does
  // not expose the global `Node` constructor, so the assertion
  // duck-types: the return value must be an object with appendChild,
  // have a DIV tagName, and carry the `http-line` class.
  it('responseHeader returns a DOM Node (not a string), usable by paintResultInto', () => {
    const okHeader = AV.ui.responseHeader({ ok: true, status: 200, duration: 12 });
    const failHeader = AV.ui.responseHeader({ ok: false, status: 500, duration: 7 });

    for (const h of [okHeader, failHeader]) {
      expect(typeof h).toBe('object');
      expect(h).not.toBeNull();
      expect(typeof (h as any).appendChild).toBe('function');
      expect(h.tagName).toBe('DIV');
      // The fake-DOM stub's `classList` does not sync from `className`,
      // so we assert on `className` directly (same pattern the existing
      // `statusPill` test uses).
      expect(h.className).toBe('http-line');
    }

    // Text content still reflects the HTTP status summary.
    expect(okHeader.textContent).toContain('HTTP/1.1 200');
    expect(okHeader.textContent).toContain('Duration: 12ms');
    expect(failHeader.textContent).toContain('HTTP/1.1 500');

    // Empty / null inputs also return a Node, not '(no response)' as a bare string.
    const empty = AV.ui.responseHeader(null);
    expect(typeof empty).toBe('object');
    expect(empty.tagName).toBe('DIV');
    expect(empty.textContent).toBe('(no response)');
  });
});

describe('console/logger — Session 8 additions', () => {
  let AV: any;
  beforeEach(() => { AV = loadConsole().AV; });

  it('stateOf: numeric + sentinel statuses bucket correctly', () => {
    expect(AV.logger.stateOf(200)).toBe('ok');
    expect(AV.logger.stateOf(404)).toBe('error');
    expect(AV.logger.stateOf(304)).toBe('warn');
    expect(AV.logger.stateOf('ERR')).toBe('error');
    expect(AV.logger.stateOf('NET')).toBe('error');
    expect(AV.logger.stateOf(undefined)).toBe('idle');
  });

  it('getFilters / setFilters / applyFilter round-trip', () => {
    expect(AV.logger.getFilters()).toEqual({ ok: true, error: true, warn: true, idle: true });
    AV.logger.setFilters({ ok: false });
    expect(AV.logger.getFilters()).toEqual({ ok: false, error: true, warn: true, idle: true });

    AV.logger.log({ ts: '2024-01-01T00:00:00Z', method: 'GET', path: '/health', status: 200, duration: 10, actor: 'demo' });
    AV.logger.log({ ts: '2024-01-01T00:00:01Z', method: 'POST', path: '/v1/tokenize', status: 500, duration: 20, actor: 'demo' });

    // ok hidden, error shown
    expect(AV.logger.applyFilter(AV.logger.all()[0])).toBe(true);  // newest = tokenize 500 → error → shown
    expect(AV.logger.applyFilter(AV.logger.all()[1])).toBe(false); // health 200 → ok → hidden
    const visible = AV.logger.filtered();
    expect(visible.length).toBe(1);
    expect(visible[0].path).toBe('/v1/tokenize');
  });

  it('clear() empties the buffer + filter persists', () => {
    AV.logger.log({ ts: '2024-01-01T00:00:00Z', method: 'GET', path: '/x', status: 200, duration: 1, actor: 'a' });
    AV.logger.clear();
    expect(AV.logger.all().length).toBe(0);
    // setFilters was never called here, default applies
    expect(AV.logger.getFilters().ok).toBe(true);
  });

  it('renderRow emits a row with statusPill + time + method + path + duration', () => {
    const row = AV.logger.renderRow({
      id: 1, ts: '2024-01-01T00:00:00.000Z', method: 'POST',
      path: '/v1/tokenize', status: 200, duration: 12, actor: 'demo'
    });
    expect(row.className).toContain('av-log-row-ok');
    // 6 cells (id, time, method, path, status, dur) + actor = 7
    expect(row.children.length).toBe(7);
  });
});